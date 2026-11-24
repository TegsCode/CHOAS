import test from 'node:test';
import assert from 'node:assert/strict';
import type { ServerWsMessage } from './netTypes.ts';
import {
  clampPlayerInput,
  RoomManager,
  sanitizePlayerName,
  sanitizeRoomSettings,
} from './roomServer.ts';

test('sanitizePlayerName strips HTML/control chars and limits length safely', () => {
  assert.equal(sanitizePlayerName('<script>alert(1)</script>Hero', 'Fallback'), 'scriptalert(1)/s');
  assert.equal(sanitizePlayerName('   ', 'Fallback'), 'Fallback');
  assert.equal(sanitizePlayerName('Ashka_99', 'Fallback'), 'Ashka_99');
});

test('clampPlayerInput bounds axes, normalizes aim vector, and coerces booleans', () => {
  const clamped = clampPlayerInput({
    moveX: 99,
    moveY: -12,
    jumpHeld: 1,
    attackPressed: true,
    aimX: 3,
    aimY: 4,
  });
  assert.equal(clamped.moveX, 1);
  assert.equal(clamped.moveY, -1);
  assert.equal(clamped.jumpHeld, true);
  assert.equal(clamped.attackPressed, true);
  assert.ok(Math.abs((clamped.aimX ?? 0) - 0.6) < 0.001);
  assert.ok(Math.abs((clamped.aimY ?? 0) - 0.8) < 0.001);
});

test('sanitizeRoomSettings enforces valid arenas, modes, and 2..8 maxPlayers', () => {
  const next = sanitizeRoomSettings(
    { arenaId: 'meadow', gameMode: 'stock_brawl', maxPlayers: 4, fillWithBots: true },
    { arenaId: 'tutorial' as never, gameMode: 'team_chaos', maxPlayers: 99, fillWithBots: false }
  );
  assert.equal(next.arenaId, 'meadow'); // disallowed arena stays unchanged
  assert.equal(next.gameMode, 'team_chaos');
  assert.equal(next.maxPlayers, 8);
  assert.equal(next.fillWithBots, false);
});

test('RoomManager handles create, join, start_match, input edges, host migration, and cleanup', () => {
  const sent: Array<{ clientId: string; msg: ServerWsMessage }> = [];
  const mgr = new RoomManager((clientId, msg) => sent.push({ clientId, msg }));

  mgr.handleClientMessage('c1', {
    type: 'create_room',
    name: 'HostHero',
    archetypeId: 'ember',
    settings: { arenaId: 'canopy', gameMode: 'stock_brawl', maxPlayers: 4, fillWithBots: true },
  });

  const rooms = mgr.getPublicRooms();
  assert.equal(rooms.length, 1);
  const code = rooms[0].code;
  assert.equal(code.length, 5);
  assert.equal(rooms[0].hostName, 'HostHero');

  // Second player joins by code
  mgr.handleClientMessage('c2', {
    type: 'join_room',
    code,
    name: 'Challenger',
    archetypeId: 'wraith',
  });

  const room = mgr.getRoom(code)!;
  assert.equal(room.players.length, 2);
  assert.equal(room.players[1].slot, 1);

  // Start match -> spawns 4 fighters (2 humans + 2 bots)
  mgr.handleClientMessage('c1', { type: 'start_match' });
  assert.equal(room.status, 'playing');
  assert.ok(room.sim);
  assert.equal(room.sim!.fighters.length, 4);

  // Send input with jump edge and step 2 ticks (60Hz -> 30Hz snapshot broadcast)
  mgr.handleClientMessage('c1', {
    type: 'player_input',
    input: {
      moveX: 1,
      moveY: 0,
      jumpHeld: true,
      jumpPressed: true,
      dashPressed: false,
      slideHeld: false,
      slidePressed: false,
      grappleHeld: false,
      grapplePressed: false,
      pullHeld: false,
      divePressed: false,
      attackPressed: false,
      defendHeld: false,
    },
  });

  mgr.stepRooms(1 / 60);
  mgr.stepRooms(1 / 60);

  const snapshots = sent.filter((x) => x.clientId === 'c2' && x.msg.type === 'sim_snapshot');
  assert.equal(snapshots.length, 1, '30Hz snapshot should broadcast on tick 2');

  // Host leaves -> Challenger becomes host; then Challenger leaves -> room cleaned up
  mgr.leaveRoom('c1');
  assert.equal(room.players.length, 1);
  assert.equal(room.players[0].clientId, 'c2');
  assert.equal(room.players[0].isHost, true);

  mgr.leaveRoom('c2');
  assert.equal(mgr.getPublicRooms().length, 0);
});
