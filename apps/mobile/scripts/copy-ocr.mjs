// Copies the receipt-scanner (OCR) files into public/ocr so the PWA serves them itself (no CDN).
// Runs automatically before `build:web`, `web` and `start` (see package.json). public/ocr is git-ignored.
//
//   worker.min.js                       tesseract.js worker
//   tesseract-core-simd-lstm.wasm.js    OCR engine for phones with WebAssembly SIMD (recent iPhones, Android)
//   tesseract-core-lstm.wasm.js         OCR engine fallback for older phones
//   eng.traineddata.gz                  English text model ("best_int": accurate and small, ~3 MB)

import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '..', 'package.json'));
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));

const out = join(here, '..', 'public', 'ocr');
mkdirSync(out, { recursive: true });

const files = [
  [join(pkgDir('tesseract.js'), 'dist', 'worker.min.js'), 'worker.min.js'],
  [join(pkgDir('tesseract.js-core'), 'tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
  [join(pkgDir('tesseract.js-core'), 'tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
  [join(pkgDir('@tesseract.js-data/eng'), '4.0.0_best_int', 'eng.traineddata.gz'), 'eng.traineddata.gz'],
];

let total = 0;
for (const [from, name] of files) {
  copyFileSync(from, join(out, name));
  total += statSync(from).size;
}
console.log(`ocr: copied ${files.length} files (${(total / 1e6).toFixed(1)} MB) to public/ocr`);
