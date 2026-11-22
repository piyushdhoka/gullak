// The Gullak Jar as a meter: the mascot's clay pot, drawn pixel by pixel, filling up with gold coins
// as a savings goal fills. A full pot grows the mascot's green sprout.
// One SVG; each row of same-coloured pixels is merged into a single rect so even big pots stay light.

import { memo, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { useColors, type Palette } from '@/ui/theme';

const W = 24;
const H = 31;
// Rows: sprout 0..3, coin 3..9, rim (lip) 9..12, belly 12..29, feet 29..30.
const RIM_TOP = 9;
const RIM_BOTTOM = 12;
const COIN_CY = 5.4;
const BELLY_CY = 21;
const BAND = 21;
const FOOT = 29;

// Coin shades. Fixed: the coin is gold in both themes.
const COIN_LIGHT = '#FFD866';
const COIN_DARK = '#D98E0A';
const COIN_SEAM = '#A86A04';
const LEAF = '#7BD15A';

type Grid = (string | null)[][];

function inBody(x: number, y: number) {
  // The belly: a round-ish ellipse under the lip.
  const px = x + 0.5 - 12;
  const py = y + 0.5 - BELLY_CY;
  return (px / 11.4) ** 2 + (py / 8.6) ** 2 <= 1 && y > RIM_BOTTOM;
}
function inRim(x: number, y: number) {
  return y >= RIM_TOP && y <= RIM_BOTTOM && x >= 5 && x <= 18;
}
function inFoot(x: number, y: number) {
  return y >= FOOT && y <= FOOT + 1 && ((x >= 6 && x <= 8) || (x >= 15 && x <= 17));
}
const inPot = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && (inBody(x, y) || inRim(x, y) || inFoot(x, y));

function draw(c: Palette, progress: number, done: boolean): Grid {
  const g: Grid = Array.from({ length: H }, () => Array<string | null>(W).fill(null));
  const set = (x: number, y: number, col: string) => {
    if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = col;
  };

  // Sprout, behind the coin: only once the jar is full.
  if (done) {
    for (let y = 1; y <= RIM_TOP; y++) set(12, y, c.outline);
    for (let y = 1; y <= RIM_TOP; y++) set(11, y, c.green);
    const leaf = (cells: [number, number][]) => cells.forEach(([x, y]) => set(x, y, c.green));
    const edge = (cells: [number, number][]) => cells.forEach(([x, y]) => set(x, y, c.outline));
    edge([[7, 0], [8, 0], [9, 0], [6, 1], [6, 2], [7, 3], [8, 3], [9, 3], [10, 2], [10, 1]]);
    leaf([[7, 1], [8, 1], [9, 1], [7, 2], [8, 2], [9, 2]]);
    set(7, 1, LEAF);
    edge([[14, 0], [15, 0], [16, 0], [17, 1], [17, 2], [14, 3], [15, 3], [16, 3], [13, 1], [13, 2]]);
    leaf([[14, 1], [15, 1], [16, 1], [14, 2], [15, 2], [16, 2]]);
    set(16, 1, LEAF);
  }

  // Body, rim and feet: outline wherever a pixel touches the outside.
  let top = H;
  let bottom = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inPot(x, y)) continue;
      const edge = !inPot(x - 1, y) || !inPot(x + 1, y) || !inPot(x, y - 1) || !inPot(x, y + 1);
      if (edge || (inRim(x, y) && y === RIM_BOTTOM)) g[y][x] = c.outline;
      else if (inFoot(x, y)) g[y][x] = c.clayDeep;
      else if (inRim(x, y)) g[y][x] = y === RIM_BOTTOM - 1 ? c.clayDeep : c.tint;
      else {
        g[y][x] = c.tint;
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }

  // Coins fill the belly from the bottom, in staggered two-row layers like stacked coins.
  const rows = bottom - top + 1;
  const p = Math.max(0, Math.min(1, progress));
  const filled = done ? rows : p > 0 ? Math.max(1, Math.round(p * rows)) : 0;
  const level = bottom - filled + 1;
  for (let y = level; y <= bottom; y++) {
    const layer = Math.floor((bottom - y) / 2);
    const upper = (bottom - y) % 2 === 1;
    for (let x = 0; x < W; x++) {
      if (g[y][x] !== c.tint) continue;
      const seam = (x + (layer % 2) * 2) % 4 === 0;
      g[y][x] = seam ? COIN_SEAM : upper ? COIN_LIGHT : COIN_DARK;
    }
  }
  if (filled > 0 && filled < rows) {
    // The top of the pile catches the light.
    for (let x = 0; x < W; x++) if (g[level][x] && g[level][x] !== c.outline) g[level][x] = COIN_LIGHT;
  }

  // Shadow side (right) and the bottom of the empty clay.
  for (let y = top; y <= bottom; y++)
    for (let x = 0; x < W; x++) {
      if (g[y][x] !== c.tint) continue;
      if (g[y][x + 1] === c.outline || g[y][x + 2] === c.outline || g[y + 1]?.[x] === c.outline) g[y][x] = c.clayDeep;
    }

  // The cream wave band round the belly, with dots above the troughs. Always painted: it's the pot's.
  const band = BAND;
  for (let x = 0; x < W; x++) {
    const y = band + ((x % 4) < 2 ? 0 : 1);
    if (g[y][x] && g[y][x] !== c.outline) g[y][x] = c.cream;
    if (x % 4 === 3 && g[band - 2][x] && g[band - 2][x] !== c.outline) g[band - 2][x] = c.cream;
  }

  // A glint on the clay, top left.
  for (const [x, y] of [[5, 15], [4, 16], [4, 17], [3, 18]] as const) {
    if (g[y][x] === c.tint) g[y][x] = `${c.cream}`;
  }

  // The coin in the mouth: a pixel disc with a bright ring and a stamped mark, sunk into the slot.
  for (let y = 0; y < RIM_TOP; y++)
    for (let x = 7; x <= 16; x++) {
      const dx = (x + 0.5 - 12) / 3.9;
      const dy = (y + 0.5 - COIN_CY) / 3.9;
      const e = dx * dx + dy * dy;
      if (e > 1) continue;
      if (e > 0.62) g[y][x] = c.outline;
      else if (e > 0.3) g[y][x] = dx < 0 && dy < 0.3 ? COIN_LIGHT : c.gold;
      else g[y][x] = x === 12 || x === 11 ? COIN_DARK : c.gold;
    }
  // The slot itself.
  for (let x = 8; x <= 15; x++) set(x, RIM_TOP, c.outline);

  return g;
}

/**
 * A pixel-art Gullak pot whose belly fills with gold coins as `progress` goes 0 → 1.
 * `done` (or progress ≥ 1) fills it completely and grows the sprout.
 */
export const PotMeter = memo(function PotMeter({
  progress,
  size = 64,
  done,
  label,
  ground = false,
  style,
}: {
  progress: number;
  /** Width in px; the height follows the pot's proportions. */
  size?: number;
  done?: boolean;
  /** Screen-reader label; defaults to "N% full". Pass `null` to hide it (decorative). */
  label?: string | null;
  /** Draw a soft pixel shadow under the feet. */
  ground?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const full = done ?? progress >= 1;
  const grid = useMemo(() => draw(c, progress, full), [c, progress, full]);
  const height = (size * H) / W;
  const rects = useMemo(() => {
    const out: { x: number; y: number; w: number; fill: string }[] = [];
    grid.forEach((row, y) => {
      let x = 0;
      while (x < W) {
        const fill = row[x];
        if (!fill) {
          x++;
          continue;
        }
        let end = x + 1;
        while (end < W && row[end] === fill) end++;
        out.push({ x, y, w: end - x, fill });
        x = end;
      }
    });
    return out;
  }, [grid]);

  const pct = Math.round(Math.max(0, Math.min(1, full ? 1 : progress)) * 100);
  const a11y = label === null ? {} : { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label ?? `Jar ${pct}% full` };

  return (
    <View style={[{ width: size, height }, style]} {...a11y} importantForAccessibility={label === null ? 'no-hide-descendants' : 'yes'}>
      <Svg width={size} height={height} viewBox={`0 0 ${W} ${H}`}>
        {ground ? <Rect x={5} y={H - 1} width={14} height={1} fill={c.fill} /> : null}
        {rects.map((r, i) => (
          // Overlap by a hair so no seams show between runs when the SVG is scaled.
          <Rect key={i} x={r.x} y={r.y} width={r.w + 0.02} height={1.02} fill={r.fill} />
        ))}
      </Svg>
    </View>
  );
});
