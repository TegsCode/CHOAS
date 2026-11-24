import 'dotenv/config';
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './src/game/roomServer.ts';
import type { ClientWsMessage, ServerWsMessage } from './src/game/netTypes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  const clients = new Map<string, WebSocket>();
  const roomManager = new RoomManager((clientId: string, msg: ServerWsMessage) => {
    const ws = clients.get(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: roomManager.getPublicRooms().length });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: roomManager.getPublicRooms() });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 8192,
  });

  let nextClientSeq = 1;
  wss.on('connection', (ws) => {
    const clientId = `c_${Date.now().toString(36)}_${nextClientSeq++}`;
    clients.set(clientId, ws);

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'welcome', clientId } satisfies ServerWsMessage));
    }

    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(String(data)) as ClientWsMessage;
        roomManager.handleClientMessage(clientId, parsed);
      } catch {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid packet format.' } satisfies ServerWsMessage));
        }
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      roomManager.leaveRoom(clientId, false);
    });

    ws.on('error', () => {
      clients.delete(clientId);
      roomManager.leaveRoom(clientId, false);
    });
  });

  // Authoritative 60Hz simulation loop when at least one online room is in a match
  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    const dt = Math.min((now - lastTick) / 1000, 0.05);
    lastTick = now;
    if (roomManager.hasActivePlayingRooms()) {
      roomManager.stepRooms(1 / 60);
    }
    void dt;
  }, 16);

  if (IS_PROD) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      try {
        const templatePath = path.resolve(__dirname, 'index.html');
        let html = fs.readFileSync(templatePath, 'utf-8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        next(err);
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CHAOS server listening on http://0.0.0.0:${PORT} (${IS_PROD ? 'prod' : 'dev'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
