import { useId } from 'react';
import type { Category } from '../api/types';

interface Shape {
  /** Painted body, including wheel arches. */
  body: string;
  windows: string[];
  /** Panel lines, drawn faintly. */
  lines: string[];
  headlight: string;
  taillight: string;
  wheels: [number, number];
  wheelRadius?: number;
  /** Extra dark parts (seats of a convertible, a roof rail). */
  trim?: string[];
}

// Side views facing right on a 240 × 96 canvas, ground at y = 92, wheel centres at y = 78.
const SHAPES: Record<Category, Shape> = {
  Sedan: {
    body: 'M18 72 C17 64 22 59 31 58 L76 53 C88 42 101 35 117 34 L149 34 C163 35 176 43 189 53 L214 57 C222 58 226 63 226 69 L226 74 C226 77 224 78 221 78 L195 78 A15 15 0 0 0 165 78 L77 78 A15 15 0 0 0 47 78 L22 78 C19 78 18 76 18 73 Z',
    windows: ['M84 53 C94 44 104 38.5 117 38 L129 38 L129 53 Z', 'M134 38 L148 38 C160 38.5 170 44.5 181 53 L134 53 Z'],
    lines: ['M131 56 L131 75', 'M30 61 L214 61'],
    headlight: 'M217 61 L225 62.5 L225 66 L216 64.5 Z',
    taillight: 'M19 62 L26 61 L26 65 L19 66 Z',
    wheels: [62, 180],
  },
  SUV: {
    body: 'M14 68 C14 60 19 55 28 54 L58 52 C66 38 74 29 90 28 L168 28 C180 29 190 38 199 49 L218 53 C225 55 228 60 228 66 L228 74 C228 77 226 78 223 78 L198 78 A16 16 0 0 0 166 78 L78 78 A16 16 0 0 0 46 78 L18 78 C15 78 14 76 14 73 Z',
    windows: ['M64 51 C70 40 76 33 90 32.5 L118 32.5 L118 51 Z', 'M123 32.5 L165 32.5 C175 33 184 41 192 51 L123 51 Z'],
    lines: ['M120 54 L120 75', 'M24 58 L220 58'],
    headlight: 'M219 58 L227 60 L227 64 L218 62 Z',
    taillight: 'M15 58 L22 57 L22 62 L15 63 Z',
    wheels: [62, 182],
    wheelRadius: 15,
    trim: ['M86 25 L172 25 L172 27 L86 27 Z'],
  },
  Hatchback: {
    body: 'M22 72 C21 60 24 50 30 45 L44 34 C50 30 57 29 68 29 L134 29 C148 30 160 38 174 50 L202 55 C210 57 214 62 214 68 L214 74 C214 77 212 78 209 78 L187 78 A15 15 0 0 0 157 78 L79 78 A15 15 0 0 0 49 78 L26 78 C23 78 22 76 22 73 Z',
    windows: [
      'M38 48 L49 37 C54 34 59 33 67 33 L98 33 L98 50 L36 50 Z',
      'M103 33 L132 33 C144 33.5 154 40 166 50 L103 50 Z',
    ],
    lines: ['M100 53 L100 75', 'M28 58 L208 58'],
    headlight: 'M205 59 L213 61 L213 65 L204 63 Z',
    taillight: 'M23 52 L29 51 L29 57 L23 58 Z',
    wheels: [64, 172],
  },
  Truck: {
    body: 'M12 75 L12 55 C12 54 13 53 14 53 L100 53 L106 49 L113 31 C115 27 119 25 125 25 L160 25 C168 25 174 29 180 37 L190 50 L218 54 C225 55 228 60 228 66 L228 74 C228 77 226 78 223 78 L200 78 A16 16 0 0 0 168 78 L74 78 A16 16 0 0 0 42 78 L15 78 C13 78 12 77 12 75 Z',
    windows: ['M117 30 L149 30 L149 48 L111 48 Z', 'M154 30 L159 30 C165 30 170 34 175 41 L180 48 L154 48 Z'],
    lines: ['M16 58 L100 58', 'M151 52 L151 75', 'M104 53 L104 75'],
    headlight: 'M219 58 L227 60 L227 64 L218 62 Z',
    taillight: 'M13 57 L18 57 L18 63 L13 63 Z',
    wheels: [58, 184],
    wheelRadius: 15,
  },
  Coupe: {
    body: 'M16 71 C16 64 21 60 29 59 L84 55 C98 44 112 38 128 37 L146 37 C160 38 174 46 190 55 L216 59 C223 60 227 64 227 69 L227 74 C227 77 225 78 222 78 L195 78 A15 15 0 0 0 165 78 L79 78 A15 15 0 0 0 49 78 L20 78 C17 78 16 76 16 73 Z',
    windows: ['M92 55 C103 46 114 41.5 128 41 L146 41 C157 41.5 167 47 178 55 Z'],
    lines: ['M140 58 L140 75', 'M28 63 L216 63'],
    headlight: 'M218 62 L226 63.5 L226 67 L217 65.5 Z',
    taillight: 'M17 63 L24 62 L24 66 L17 67 Z',
    wheels: [64, 180],
  },
  Convertible: {
    body: 'M16 71 C16 64 21 60 29 59 L100 57 L170 57 L216 59 C223 60 227 64 227 69 L227 74 C227 77 225 78 222 78 L195 78 A15 15 0 0 0 165 78 L79 78 A15 15 0 0 0 49 78 L20 78 C17 78 16 76 16 73 Z',
    windows: ['M150 57 L157 44 L161 44 L156 57 Z'],
    lines: ['M138 60 L138 75', 'M28 63 L216 63'],
    headlight: 'M218 62 L226 63.5 L226 67 L217 65.5 Z',
    taillight: 'M17 63 L24 62 L24 66 L17 67 Z',
    wheels: [64, 180],
    trim: [
      'M108 57 L108 49 C108 47 110 46 112 46 L118 46 C120 46 122 47 122 49 L122 57 Z',
      'M127 57 L127 49 C127 47 129 46 131 46 L137 46 C139 46 141 47 141 49 L141 57 Z',
    ],
  },
  Van: {
    body: 'M10 74 L10 40 C10 30 16 25 26 25 L166 25 C178 25 188 32 199 45 L216 52 C224 54 228 59 228 66 L228 74 C228 77 226 78 223 78 L198 78 A16 16 0 0 0 166 78 L72 78 A16 16 0 0 0 40 78 L13 78 C11 78 10 76 10 74 Z',
    windows: [
      'M18 33 C18 31 19 30 21 30 L58 30 L58 47 L18 47 Z',
      'M63 30 L118 30 L118 47 L63 47 Z',
      'M123 30 L164 30 C174 30 183 37 191 47 L123 47 Z',
    ],
    lines: ['M62 50 L62 75', 'M120 50 L120 75', 'M62 53 L118 53', 'M16 58 L220 58'],
    headlight: 'M219 57 L227 59 L227 63 L218 61 Z',
    taillight: 'M11 50 L16 50 L16 60 L11 60 Z',
    wheels: [56, 182],
    wheelRadius: 15,
  },
  Electric: {
    body: 'M16 71 C16 63 22 59 30 58 L78 53 C92 41 106 34 124 33 L148 33 C168 34 186 45 200 55 L218 58 C224 59 227 63 227 68 L227 74 C227 77 225 78 222 78 L197 78 A15 15 0 0 0 167 78 L77 78 A15 15 0 0 0 47 78 L20 78 C17 78 16 76 16 73 Z',
    windows: ['M86 53 C98 43 110 37.5 124 37 L136 37 L136 53 Z', 'M140 37 L148 37 C163 37.5 177 45 190 54 L140 53 Z'],
    lines: ['M138 56 L138 75', 'M30 61 L216 61'],
    headlight: 'M212 60 L226 62 L226 64 L211 62 Z',
    taillight: 'M17 62 L28 61 L28 63 L17 64 Z',
    wheels: [62, 182],
  },
};

const HEX = /^#[0-9a-f]{6}$/i;

interface CarIllustrationProps {
  category: Category;
  /** Paint colour, #rrggbb. Anything else falls back to a neutral grey. */
  hex: string;
  /** Accessible description; omit for a decorative thumbnail. */
  label?: string;
  className?: string;
}

/**
 * A side-view illustration of the model's body style, painted in the chosen colour. Drawn as SVG so it is
 * self-hosted, crisp at any size and allowed by the strict CSP; only validated hex values reach the fill.
 */
export function CarIllustration({ category, hex, label, className = '' }: CarIllustrationProps) {
  const shape = SHAPES[category] ?? SHAPES.Sedan;
  const id = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const paint = HEX.test(hex) ? hex : '#8a8f98';
  const radius = shape.wheelRadius ?? 14;

  return (
    <svg
      viewBox="0 0 240 96"
      className={`text-border-strong ${className}`}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <defs>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="0.42" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.68" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#3a4752" />
          <stop offset="1" stopColor="#12171c" />
        </linearGradient>
      </defs>

      <ellipse cx="120" cy="90" rx="108" ry="4.5" fill="#000000" opacity="0.14" />
      <path d={shape.body} fill={paint} />
      <path d={shape.body} fill={`url(#${id}-sheen)`} />
      {shape.windows.map((d) => (
        <path key={d} d={d} fill={`url(#${id}-glass)`} stroke="#ffffff" strokeOpacity="0.18" strokeWidth="0.75" />
      ))}
      {shape.trim?.map((d) => (
        <path key={d} d={d} fill="#1b1d21" />
      ))}
      {shape.lines.map((d) => (
        <path key={d} d={d} fill="none" stroke="#000000" strokeOpacity="0.18" strokeWidth="0.8" />
      ))}
      <path d={shape.headlight} fill="#f4f1de" />
      <path d={shape.taillight} fill="#b3261e" />
      <path d={shape.body} fill="none" stroke="currentColor" strokeWidth="1" />

      {shape.wheels.map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="78" r={radius} fill="#1b1c1f" />
          <circle cx={cx} cy="78" r={radius * 0.6} fill="#b9bcc0" />
          <circle cx={cx} cy="78" r={radius * 0.6} fill="none" stroke="#6b6f74" strokeWidth="1" />
          <circle cx={cx} cy="78" r={radius * 0.2} fill="#3a3d42" />
        </g>
      ))}
    </svg>
  );
}
