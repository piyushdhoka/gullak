// Gullak's icon set: one consistent hand-drawn family that replaces every emoji in the UI.
// 24-unit grid, 1.9 round strokes, plus a soft duotone fill (the same colour at low opacity), so the
// icons read crisply at 14–40px on clay, cream and midnight alike. react-native-svg: same on web and native.

import type { ReactNode } from 'react';
import { Text } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type GlyphName =
  // categories
  | 'food'
  | 'groceries'
  | 'shopping'
  | 'transport'
  | 'travel'
  | 'bills'
  | 'entertainment'
  | 'health'
  | 'investments'
  | 'transfers'
  | 'cash'
  | 'income'
  | 'refund'
  | 'other'
  // app
  | 'bell'
  | 'target'
  | 'repeat'
  | 'jar'
  | 'mail'
  | 'eyeOff'
  | 'question'
  | 'coin'
  | 'camera'
  // jar goals
  | 'beach'
  | 'phone'
  | 'laptop'
  | 'gift'
  | 'scooter'
  | 'cap'
  | 'ring'
  | 'home'
  | 'diya'
  | 'lifebuoy';

type Draw = (ink: string, soft: string) => ReactNode;

// Shorthands: s = stroked path, f = soft-filled (and stroked) path, c = stroked circle, d = solid dot.
const s = (d: string, ink: string, key: string | number) => <Path key={key} d={d} stroke={ink} />;
const f = (d: string, ink: string, soft: string, key: string | number) => <Path key={key} d={d} stroke={ink} fill={soft} />;
const c = (cx: number, cy: number, r: number, ink: string, key: string | number, fill = 'none') => (
  <Circle key={key} cx={cx} cy={cy} r={r} stroke={ink} fill={fill} />
);
const d = (cx: number, cy: number, r: number, ink: string, key: string | number) => (
  <Circle key={key} cx={cx} cy={cy} r={r} fill={ink} stroke="none" />
);

const GLYPHS: Record<GlyphName, Draw> = {
  food: (i, o) => [
    f('M3.5 11.5h17a8.5 8.5 0 0 1-17 0z', i, o, 0),
    s('M8 21h8', i, 1),
    s('M8.5 3.5c.9 1-.9 1.8 0 3', i, 2),
    s('M12 3c.9 1-.9 1.8 0 3', i, 3),
    s('M15.5 3.5c.9 1-.9 1.8 0 3', i, 4),
  ],
  groceries: (i, o) => [
    f('M6.6 8H20.3l-1.9 6.6a1.6 1.6 0 0 1-1.5 1.1H9.3a1.6 1.6 0 0 1-1.5-1.2z', i, o, 0),
    s('M2.8 4h2.5l2.5 10.5', i, 1),
    c(9.5, 19.5, 1.6, i, 2),
    c(16.8, 19.5, 1.6, i, 3),
  ],
  shopping: (i, o) => [
    f('M4.8 8h14.4l-1 12.1a1.6 1.6 0 0 1-1.6 1.4H7.4a1.6 1.6 0 0 1-1.6-1.4z', i, o, 0),
    s('M9 10.5V7a3 3 0 0 1 6 0v3.5', i, 1),
  ],
  transport: (i, o) => [
    f('M4 16.5v-4l1.9-4.8a2 2 0 0 1 1.9-1.2h8.4a2 2 0 0 1 1.9 1.2L20 12.5v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', i, o, 0),
    s('M5.6 12.5h12.8', i, 1),
    c(7.8, 17.8, 1.9, i, 2, '#00000000'),
    c(16.2, 17.8, 1.9, i, 3, '#00000000'),
    d(7, 14.8, 0.9, i, 4),
    d(17, 14.8, 0.9, i, 5),
  ],
  travel: (i, o) => [
    f(
      'M12 3c.9 0 1.6.7 1.6 1.6v5.3l7 4.3v2.1l-7-2.2V19l1.9 1.4v1.4L12 21l-3.5.8v-1.4l1.9-1.4v-4.9l-7 2.2v-2.1l7-4.3V4.6C10.4 3.7 11.1 3 12 3z',
      i,
      o,
      0,
    ),
  ],
  bills: (i, o) => [
    f('M6 2.8h12v18.4l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z', i, o, 0),
    s('M9 7.5h6', i, 1),
    s('M9 11.5h6', i, 2),
    s('M9 15.5h3.5', i, 3),
  ],
  entertainment: (i, o) => [
    f('M3.5 7a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4z', i, o, 0),
    s('M15 7v1.5M15 11.2v1.6M15 15.5V17', i, 1),
    s('M7.5 10.5h4M7.5 13.5h3', i, 2),
  ],
  health: (i, o) => [
    f('M7.2 16.8a3.6 3.6 0 0 1 0-5.1l4.5-4.5a3.6 3.6 0 0 1 5.1 5.1l-4.5 4.5a3.6 3.6 0 0 1-5.1 0z', i, o, 0),
    s('M9.5 9.5l5 5', i, 1),
  ],
  investments: (i, o) => [
    f('M3 20.5V17l5.5-5.5 4 4 7.5-7.5v12.5z', i, o, 0),
    s('M3 17l5.5-5.5 4 4L21 7', i, 1),
    s('M15.5 7H21v5.5', i, 2),
  ],
  transfers: (i) => [s('M4 8h14', i, 0), s('M14.5 4.5L18 8l-3.5 3.5', i, 1), s('M20 16H6', i, 2), s('M9.5 12.5L6 16l3.5 3.5', i, 3)],
  cash: (i, o) => [
    <Rect key={0} x={2.8} y={6} width={18.4} height={12} rx={2} stroke={i} fill={o} />,
    c(12, 12, 2.6, i, 1),
    d(6.5, 12, 1, i, 2),
    d(17.5, 12, 1, i, 3),
  ],
  income: (i, o) => [
    f('M3.5 14v4.2a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V14h-4.5l-1.5 2.5h-5L7.9 14z', i, o, 0),
    s('M12 3v9', i, 1),
    s('M8.2 8.5L12 12.3l3.8-3.8', i, 2),
  ],
  refund: (i) => [s('M9 13.5L4 8.5l5-5', i, 0), s('M4 8.5h10.5a6 6 0 0 1 0 12H11', i, 1)],
  other: (i, o) => [
    f('M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z', i, o, 0),
    s('M3.5 7.5L12 12l8.5-4.5', i, 1),
    s('M12 12v9', i, 2),
    s('M7.8 5.3l8.5 4.5', i, 3),
  ],

  bell: (i, o) => [f('M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4z', i, o, 0), s('M10 21a2 2 0 0 0 4 0', i, 1), s('M12 3v2', i, 2)],
  target: (i, o) => [c(11, 13, 8, i, 0), c(11, 13, 4.5, i, 1, o), d(11, 13, 1.4, i, 2), s('M11 13l8-8', i, 3), s('M16 4.5h3.5V8', i, 4)],
  repeat: (i) => [
    s('M16.5 2.5L20 6l-3.5 3.5', i, 0),
    s('M4 11.5V9.5a3.5 3.5 0 0 1 3.5-3.5H20', i, 1),
    s('M7.5 21.5L4 18l3.5-3.5', i, 2),
    s('M20 12.5v2a3.5 3.5 0 0 1-3.5 3.5H4', i, 3),
  ],
  jar: (i, o) => [
    f('M7.2 9h9.6c2.1 1.5 3.2 3.6 3.2 6.2a5.8 5.8 0 0 1-5.8 5.8H9.8A5.8 5.8 0 0 1 4 15.2C4 12.6 5.1 10.5 7.2 9z', i, o, 0),
    <Rect key={1} x={7.5} y={5.5} width={9} height={3.5} rx={1.2} stroke={i} fill="none" />,
    s('M10.3 5.5V4.4a1.7 1.7 0 0 1 3.4 0v1.1', i, 2),
    s('M6.6 14.2c1.1-.9 2.1.9 3.2 0s2.1.9 3.2 0 2.1.9 3.2 0 1.1.9 1.6.6', i, 3),
  ],
  mail: (i, o) => [<Rect key={0} x={3} y={5} width={18} height={14} rx={2.2} stroke={i} fill={o} />, s('M3.8 7l8.2 6 8.2-6', i, 1)],
  eyeOff: (i, o) => [
    f('M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6z', i, o, 0),
    c(12, 12, 2.8, i, 1),
    s('M4 4l16 16', i, 2),
  ],
  question: (i, o) => [
    f('M5 3.5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6.2L8.5 20.5v-4H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z', i, o, 0),
    s('M9.8 8.3a2.3 2.3 0 1 1 3.3 2c-.6.3-1.1.8-1.1 1.4v.4', i, 1),
    d(12, 14.4, 1, i, 2),
  ],
  camera: (i, o) => [
    f('M3.5 9a2 2 0 0 1 2-2h2.3l1.5-2.2h5.4L16.2 7h2.3a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z', i, o, 0),
    c(12, 13, 3.7, i, 1),
    d(17.4, 10, 0.95, i, 2),
  ],
  coin: (i, o) => [
    c(12, 12, 8.8, i, 0, o),
    c(12, 12, 5.8, i, 1),
    s('M9.9 9.2h4.2M9.9 11.2h4.2M11.1 9.2c2.3 0 2.3 4-.1 4H9.9l3.4 3.1', i, 2),
  ],

  beach: (i, o) => [f('M3 11a9 9 0 0 1 18 0z', i, o, 0), s('M12 2.5V11', i, 1), s('M12 11v7.5a2 2 0 0 0 4 0', i, 2), s('M8 11c0-4 1.8-7.5 4-8.5M16 11c0-4-1.8-7.5-4-8.5', i, 3)],
  phone: (i, o) => [<Rect key={0} x={6.5} y={2.5} width={11} height={19} rx={2.6} stroke={i} fill={o} />, s('M10.5 18.5h3', i, 1)],
  laptop: (i, o) => [f('M5 5.5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1V15H5z', i, o, 0), s('M2.5 18h19l-1.2 1.8H3.7z', i, 1)],
  gift: (i, o) => [
    <Rect key={0} x={3.5} y={9.5} width={17} height={3.5} rx={1} stroke={i} fill="none" />,
    f('M5 13h14v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z', i, o, 1),
    s('M12 9.5V21', i, 2),
    s('M12 9.5c-1.4-3-5.2-3.6-5.2-1.3S10 9.5 12 9.5zM12 9.5c1.4-3 5.2-3.6 5.2-1.3S14 9.5 12 9.5z', i, 3),
  ],
  scooter: (i, o) => [
    c(5.8, 17.2, 2.6, i, 0, o),
    c(18.2, 17.2, 2.6, i, 1, o),
    s('M5.8 17.2h6.4l3.3-8.7h2.2', i, 2),
    s('M15.5 8.5l2.7 8.7', i, 3),
    s('M12.5 5.5h3.3', i, 4),
  ],
  cap: (i, o) => [f('M12 4L2 9l10 5 10-5z', i, o, 0), s('M6 11.2v4.3c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.3', i, 1), s('M22 9v5', i, 2)],
  ring: (i, o) => [c(12, 15, 6, i, 0), f('M9.5 6.5l1-2.2h3l1 2.2-2.5 2.6z', i, o, 1)],
  home: (i, o) => [f('M6 9.8L12 5l6 4.8V20H6z', i, o, 0), s('M3.5 11.5L12 4.5l8.5 7', i, 1), s('M10 20v-5.2h4V20', i, 2)],
  diya: (i, o) => [f('M3 13.5c0 3.5 4 6 9 6s9-2.5 9-6z', i, o, 0), f('M12 3c2.1 2.6 2.1 4.6 0 7-2.1-2.4-2.1-4.4 0-7z', i, o, 1), s('M2.5 13.5h19', i, 2)],
  lifebuoy: (i, o) => [
    c(12, 12, 8.8, i, 0, o),
    c(12, 12, 3.6, i, 1),
    s('M5.8 5.8l3.7 3.7M14.5 14.5l3.7 3.7M18.2 5.8l-3.7 3.7M9.5 14.5l-3.7 3.7', i, 2),
  ],
};

/** Soft fill: the ink colour at ~22% (works for hex like #FFFFFF / #1C0F0C and for tokens). */
function softOf(ink: string): string {
  return /^#[0-9a-f]{6}$/i.test(ink) ? `${ink}38` : 'none';
}

export function Glyph({ name, size = 20, color }: { name: GlyphName; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {GLYPHS[name](color, softOf(color))}
    </Svg>
  );
}

/** The jar goals offered when creating a jar, stored (as before) by their emoji, drawn as glyphs. */
export const JAR_ICONS: { emoji: string; glyph: GlyphName; label: string }[] = [
  { emoji: '🏖️', glyph: 'beach', label: 'Trip' },
  { emoji: '✈️', glyph: 'travel', label: 'Flight' },
  { emoji: '📱', glyph: 'phone', label: 'Phone' },
  { emoji: '💻', glyph: 'laptop', label: 'Laptop' },
  { emoji: '🎁', glyph: 'gift', label: 'Gift' },
  { emoji: '🏍️', glyph: 'scooter', label: 'Bike' },
  { emoji: '🎓', glyph: 'cap', label: 'Studies' },
  { emoji: '💍', glyph: 'ring', label: 'Wedding' },
  { emoji: '🏠', glyph: 'home', label: 'Home' },
  { emoji: '🪔', glyph: 'diya', label: 'Festival' },
  { emoji: '🛟', glyph: 'lifebuoy', label: 'Emergency' },
  { emoji: '🐷', glyph: 'jar', label: 'Savings' },
];

/** A jar's icon: its glyph when the stored emoji is one of ours, otherwise the emoji itself. */
export function JarIcon({ emoji, size = 22, color }: { emoji?: string | null; size?: number; color: string }) {
  const known = JAR_ICONS.find((j) => j.emoji === (emoji ?? '🐷'));
  if (known) return <Glyph name={known.glyph} size={size} color={color} />;
  return <Text style={{ fontSize: size * 0.85, lineHeight: size }}>{emoji}</Text>;
}
