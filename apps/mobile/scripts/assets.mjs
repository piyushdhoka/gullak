// Builds every image the app needs from assets/images/mascot.png, as small as possible.
// - removes the flat white background and crops tight
// - public/mascot-{96,192,384}.webp + .png  (shown at 32–136 CSS px; ×3 covers iPhone screens)
// - public/apple-touch-icon.png, icon-192.png, icon-512.png  (mascot on a cream tile)
// - public/favicon-32.png, assets/images/favicon.png
// - public/badge-96.png  (notification badge: white silhouette)
// - assets/images/icon.png (app icon), splash-icon.png, logo-192.png (sign-in screen)
// PNGs are palette-quantised (pixel art has few colours), so they stay tiny.
// Usage: npm run icons

import { statSync } from 'node:fs';
import { join } from 'node:path';

import { writeFileSync } from 'node:fs';

import QRCode from 'qrcode';
import sharp from 'sharp';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const src = join(root, 'assets/images/mascot.png');
const CREAM = { r: 251, g: 231, b: 196, alpha: 1 };

// 1. Cut out: make near-white pixels transparent, then trim.
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const seen = new Uint8Array(width * height);
const stack = [];
for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
const isBg = (i) => data[i * 4] > 236 && data[i * 4 + 1] > 236 && data[i * 4 + 2] > 236;
while (stack.length) {
  const i = stack.pop();
  if (seen[i] || !isBg(i)) continue;
  seen[i] = 1;
  data[i * 4 + 3] = 0;
  const x = i % width;
  const y = (i - x) / width;
  if (x > 0) stack.push(i - 1);
  if (x < width - 1) stack.push(i + 1);
  if (y > 0) stack.push(i - width);
  if (y < height - 1) stack.push(i + width);
}
const cut = await sharp(data, { raw: { width, height, channels: 4 } }).trim().png().toBuffer();

const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

/** The mascot centred on a square. With a `tile` colour it's composited onto an opaque tile. */
const square = async (size, pad = 0.02, tile = null) => {
  const inner = Math.round(size * (1 - 2 * pad));
  const sprite = await sharp(cut).resize(inner, inner, { fit: 'contain', background: CLEAR, kernel: 'lanczos3' }).png().toBuffer();
  const offset = Math.floor((size - inner) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background: tile ?? CLEAR } }).composite([
    { input: sprite, left: offset, top: offset },
  ]);
};

// Composite first, then encode: palette PNG for icons, WebP for the website.
const png = async (img) => sharp(await (await img).png().toBuffer()).png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 });
const webp = async (img) => sharp(await (await img).png().toBuffer()).webp({ quality: 88, alphaQuality: 100, effort: 6 });
const out = [];
async function save(img, rel) {
  const path = join(root, rel);
  await (await img).toFile(path);
  out.push(`${rel}  ${(statSync(path).size / 1024).toFixed(1)} KB`);
}

for (const s of [96, 192, 384]) {
  await save(png(square(s)), `public/mascot-${s}.png`);
  await save(webp(square(s)), `public/mascot-${s}.webp`);
}
await save(png(square(180, 0.1, CREAM)), 'public/apple-touch-icon.png');
await save(png(square(192, 0.1, CREAM)), 'public/icon-192.png');
await save(png(square(512, 0.1, CREAM)), 'public/icon-512.png');
await save(png(square(32, 0.02)), 'public/favicon-32.png');
await save(png(square(48, 0.02)), 'assets/images/favicon.png');
await save(png(square(1024, 0.1, CREAM)), 'assets/images/icon.png');
await save(png(square(288, 0.04)), 'assets/images/splash-icon.png');
await save(png(square(192, 0.1, CREAM)), 'assets/images/logo-192.png');
/** White silhouette of the mascot on transparent: the system tints it. */
const silhouette = async (size, pad) =>
  sharp({ create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).composite([
    { input: await (await square(size, pad)).png().toBuffer(), blend: 'dest-in' },
  ]);
// Notification badge (Android status bar, Chrome).
await save(silhouette(96, 0.06), 'public/badge-96.png');
// Android adaptive icon (cream backgroundColor in app.json): the launcher mask keeps only the middle 66 of 108 dp.
await save(png(square(1024, 0.22)), 'assets/images/android-icon-foreground.png');
await save(silhouette(1024, 0.22), 'assets/images/android-icon-monochrome.png');
// QR code for laptop visitors: scan with the iPhone camera to open Gullak in Safari.
const qr = await QRCode.toString('https://gullak.sparkstudio.co.in', {
  type: 'svg',
  margin: 0,
  errorCorrectionLevel: 'M',
  color: { dark: '#1C0F0C', light: '#00000000' },
});
writeFileSync(join(root, 'public/qr.svg'), qr);
out.push(`public/qr.svg  ${(qr.length / 1024).toFixed(1)} KB`);

console.log(out.join('\n'));
