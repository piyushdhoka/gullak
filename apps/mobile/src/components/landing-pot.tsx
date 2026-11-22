// The website's copy of the app's PotMeter (src/components/pot-meter.tsx), as a plain DOM SVG:
// the mascot's clay pot drawn pixel by pixel, filling with gold coins. Colours are CSS variables
// from landing.module.css, so the pot follows the page's light / dark theme with no JS.

import { memo, useMemo } from 'react';

const W = 24;
const H = 31;
const RIM_TOP = 9;
const RIM_BOTTOM = 12;
const COIN_CY = 5.4;
const BELLY_CY = 21;
const BAND = 21;
const FOOT = 29;

const C = {
  tint: 'var(--clay)',
  clayDeep: 'var(--clay-deep)',
  gold: 'var(--coin)',
  outline: 'var(--outline)',
  green: 'var(--sprout)',
  cream: '#F7DDB0',
};
const COIN_LIGHT = '#FFD866';
const COIN_DARK = '#D98E0A';
const COIN_SEAM = '#A86A04';
const LEAF = '#7BD15A';

type Grid = (string | null)[][];

function inBody(x: number, y: number) {
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

function draw(progress: number, done: boolean): Grid {
  const g: Grid = Array.from({ length: H }, () => Array<string | null>(W).fill(null));
  const set = (x: number, y: number, col: string) => {
    if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = col;
  };

  if (done) {
    for (let y = 1; y <= RIM_TOP; y++) set(12, y, C.outline);
    for (let y = 1; y <= RIM_TOP; y++) set(11, y, C.green);
    const leaf = (cells: [number, number][]) => cells.forEach(([x, y]) => set(x, y, C.green));
    const edge = (cells: [number, number][]) => cells.forEach(([x, y]) => set(x, y, C.outline));
    edge([[7, 0], [8, 0], [9, 0], [6, 1], [6, 2], [7, 3], [8, 3], [9, 3], [10, 2], [10, 1]]);
    leaf([[7, 1], [8, 1], [9, 1], [7, 2], [8, 2], [9, 2]]);
    set(7, 1, LEAF);
    edge([[14, 0], [15, 0], [16, 0], [17, 1], [17, 2], [14, 3], [15, 3], [16, 3], [13, 1], [13, 2]]);
    leaf([[14, 1], [15, 1], [16, 1], [14, 2], [15, 2], [16, 2]]);
    set(16, 1, LEAF);
  }

  let top = H;
  let bottom = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inPot(x, y)) continue;
      const edge = !inPot(x - 1, y) || !inPot(x + 1, y) || !inPot(x, y - 1) || !inPot(x, y + 1);
      if (edge || (inRim(x, y) && y === RIM_BOTTOM)) g[y][x] = C.outline;
      else if (inFoot(x, y)) g[y][x] = C.clayDeep;
      else if (inRim(x, y)) g[y][x] = y === RIM_BOTTOM - 1 ? C.clayDeep : C.tint;
      else {
        g[y][x] = C.tint;
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }

  const rows = bottom - top + 1;
  const p = Math.max(0, Math.min(1, progress));
  const filled = done ? rows : p > 0 ? Math.max(1, Math.round(p * rows)) : 0;
  const level = bottom - filled + 1;
  for (let y = level; y <= bottom; y++) {
    const layer = Math.floor((bottom - y) / 2);
    const upper = (bottom - y) % 2 === 1;
    for (let x = 0; x < W; x++) {
      if (g[y][x] !== C.tint) continue;
      const seam = (x + (layer % 2) * 2) % 4 === 0;
      g[y][x] = seam ? COIN_SEAM : upper ? COIN_LIGHT : COIN_DARK;
    }
  }
  if (filled > 0 && filled < rows) {
    for (let x = 0; x < W; x++) if (g[level][x] && g[level][x] !== C.outline) g[level][x] = COIN_LIGHT;
  }

  for (let y = top; y <= bottom; y++)
    for (let x = 0; x < W; x++) {
      if (g[y][x] !== C.tint) continue;
      if (g[y][x + 1] === C.outline || g[y][x + 2] === C.outline || g[y + 1]?.[x] === C.outline) g[y][x] = C.clayDeep;
    }

  for (let x = 0; x < W; x++) {
    const y = BAND + (x % 4 < 2 ? 0 : 1);
    if (g[y][x] && g[y][x] !== C.outline) g[y][x] = C.cream;
    if (x % 4 === 3 && g[BAND - 2][x] && g[BAND - 2][x] !== C.outline) g[BAND - 2][x] = C.cream;
  }

  for (const [x, y] of [[5, 15], [4, 16], [4, 17], [3, 18]] as const) {
    if (g[y][x] === C.tint) g[y][x] = C.cream;
  }

  for (let y = 0; y < RIM_TOP; y++)
    for (let x = 7; x <= 16; x++) {
      const dx = (x + 0.5 - 12) / 3.9;
      const dy = (y + 0.5 - COIN_CY) / 3.9;
      const e = dx * dx + dy * dy;
      if (e > 1) continue;
      if (e > 0.62) g[y][x] = C.outline;
      else if (e > 0.3) g[y][x] = dx < 0 && dy < 0.3 ? COIN_LIGHT : C.gold;
      else g[y][x] = x === 12 || x === 11 ? COIN_DARK : C.gold;
    }
  for (let x = 8; x <= 15; x++) set(x, RIM_TOP, C.outline);

  return g;
}

/** A pixel-art gullak whose belly fills with coins as `progress` goes 0 → 1. Decorative (aria-hidden). */
export const LandingPot = memo(function LandingPot({ progress, size = 120, className }: { progress: number; size?: number; className?: string }) {
  const done = progress >= 1;
  const rects = useMemo(() => {
    const grid = draw(progress, done);
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
  }, [progress, done]);

  return (
    <svg className={className} width={size} height={(size * H) / W} viewBox={`0 0 ${W} ${H}`} aria-hidden shapeRendering="crispEdges">
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w + 0.02} height={1.02} style={{ fill: r.fill }} />
      ))}
    </svg>
  );
});
