import React from 'react';
import { FighterArchetype } from '../game/types';

interface FighterCrestProps {
  archetype: FighterArchetype;
  size?: number;
  className?: string;
}

const INK = '#141019';

export const FighterCrest: React.FC<FighterCrestProps> = ({
  archetype,
  size = 44,
  className = '',
}) => {
  const { primaryColor, secondaryColor, accentColor, eyeColor, headStyle } = archetype;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="8"
        fill="#2b2433"
        stroke={INK}
        strokeWidth="3.5"
      />
      <rect
        x="6"
        y="6"
        width="52"
        height="52"
        rx="5"
        fill={secondaryColor}
        stroke={primaryColor}
        strokeWidth="2"
      />

      {/* Draped Cloak / Shoulders */}
      <path
        d="M12 58 L20 39 L44 39 L52 58 Z"
        fill={primaryColor}
        stroke={INK}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />

      {headStyle === 'flame' && (
        <path
          d="M20 38 C16 26 24 14 34 8 C33 17 41 16 44 24 C47 31 44 38 38 40 L24 40 Z"
          fill={accentColor}
          stroke={INK}
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
      )}

      {headStyle === 'horned_mask' && (
        <>
          <path
            d="M21 22 C17 12 20 8 25 14 L27 22 Z M43 22 C47 12 44 8 39 14 L37 22 Z"
            fill={accentColor}
            stroke={INK}
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <ellipse
            cx="32"
            cy="28"
            rx="12"
            ry="13"
            fill="#efe7d6"
            stroke={INK}
            strokeWidth="2.8"
          />
        </>
      )}

      {(headStyle === 'hood' || headStyle === 'skull_hood') && (
        <>
          <path
            d="M15 36 L22 14 L35 10 L47 20 L46 38 Z"
            fill={primaryColor}
            stroke={INK}
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <circle
            cx="32"
            cy="29"
            r="10"
            fill={headStyle === 'skull_hood' ? '#e6dec8' : '#18141f'}
            stroke={INK}
            strokeWidth="2.4"
          />
        </>
      )}

      {headStyle === 'ronin_hat' && (
        <>
          <circle cx="32" cy="30" r="10" fill="#18141f" stroke={INK} strokeWidth="2.8" />
          <path
            d="M10 24 L32 11 L54 24 Z"
            fill={primaryColor}
            stroke={INK}
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
        </>
      )}

      {headStyle === 'brute_horns' && (
        <>
          <path
            d="M20 24 L10 15 L18 30 Z M44 24 L54 15 L46 30 Z"
            fill={accentColor}
            stroke={INK}
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <rect
            x="20"
            y="18"
            width="24"
            height="22"
            rx="7"
            fill={secondaryColor}
            stroke={INK}
            strokeWidth="2.8"
          />
        </>
      )}

      {headStyle === 'cyber_visor' && (
        <>
          <circle cx="32" cy="28" r="12" fill={secondaryColor} stroke={INK} strokeWidth="2.8" />
          <rect
            x="22"
            y="24"
            width="22"
            height="7"
            rx="3"
            fill={accentColor}
            stroke={INK}
            strokeWidth="2.2"
          />
        </>
      )}

      {headStyle === 'imp_horns' && (
        <>
          <path
            d="M22 20 L16 9 L28 17 Z M42 20 L48 9 L36 17 Z"
            fill={accentColor}
            stroke={INK}
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="29" r="11" fill={primaryColor} stroke={INK} strokeWidth="2.8" />
        </>
      )}

      {headStyle !== 'cyber_visor' && (
        <>
          <ellipse
            cx="27"
            cy="29"
            rx="2.9"
            ry="4"
            fill={headStyle === 'horned_mask' || headStyle === 'skull_hood' ? INK : eyeColor}
          />
          <ellipse
            cx="37"
            cy="29"
            rx="2.9"
            ry="4"
            fill={headStyle === 'horned_mask' || headStyle === 'skull_hood' ? INK : eyeColor}
          />
        </>
      )}
    </svg>
  );
};
