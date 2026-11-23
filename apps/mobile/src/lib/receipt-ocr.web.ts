// Receipt scanning for the iPhone app (PWA) and any browser: pick or take a photo, read its text on the phone.
// The photo never leaves the device and is never stored. OCR is Tesseract.js, served from our own /ocr/ folder
// (copied there at build time by scripts/copy-ocr.mjs), and loaded only when someone actually scans.

export const canScanReceipts = true;

export type ScanProgress = { stage: 'loading' | 'reading'; progress: number };

/**
 * Opens the photo picker. `camera: true` goes straight to the rear camera; otherwise iOS offers
 * Take Photo / Photo Library / Choose File. Must be called directly from a tap (browsers require it).
 * Resolves with the chosen image, or null if the person cancels.
 */
export function pickReceiptPhoto({ camera = false }: { camera?: boolean } = {}): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    document.querySelectorAll('input[data-receipt-picker]').forEach((el) => el.remove());
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camera) input.setAttribute('capture', 'environment');
    input.setAttribute('data-receipt-picker', '');
    input.style.position = 'fixed';
    input.style.left = '-1000px';
    input.style.opacity = '0';
    let done = false;
    const finish = (file: File | null) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

/** Holds a photo picked on one screen (the home camera button) for the Add screen to read. */
let pending: File | null = null;
export function setPendingReceipt(file: File | null) {
  pending = file;
}
export function takePendingReceipt(): File | null {
  const f = pending;
  pending = null;
  return f;
}

/** Reads the text on a receipt photo. Progress goes 0 → 1 across loading the engine and reading. */
export async function readReceiptText(file: File, onProgress?: (p: ScanProgress) => void): Promise<string> {
  const canvas = await prepareImage(file);
  const { createWorker, OEM, PSM } = await import('tesseract.js');
  const base = `${window.location.origin}/ocr`;
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: `${base}/worker.min.js`,
    corePath: `${base}/${supportsSimd() ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'}`,
    langPath: base,
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => {
      if (!onProgress) return;
      if (m.status === 'recognizing text') onProgress({ stage: 'reading', progress: m.progress });
      else onProgress({ stage: 'loading', progress: m.progress });
    },
  });
  try {
    // One uniform block keeps each label on the same line as its amount ("Grand Total ... 441.00"). The
    // single-column and automatic modes dropped the right-hand column of prices on photos (tested: 18/18 totals
    // vs 7/18). Keep spacing so "Qty Rate Amt" columns stay apart.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' });
    const { data } = await worker.recognize(canvas);
    return data.text ?? '';
  } finally {
    await worker.terminate();
  }
}

/** WebAssembly SIMD makes OCR noticeably faster (iOS 16.4+). Same check as tesseract.js's own. */
function supportsSimd(): boolean {
  try {
    return WebAssembly.validate(
      new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]),
    );
  } catch {
    return false;
  }
}

/** Longest side after resizing. Phone photos are 12 MP; OCR is faster and steadier around 2 MP. */
const MAX_SIDE = 2000;

/**
 * Loads the photo (the browser applies its EXIF rotation), scales it down, turns it grey and stretches the
 * contrast so faded thermal print gets darker. Tesseract does its own black/white step after this.
 */
async function prepareImage(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That photo couldn’t be opened. Try another one.'));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('This browser can’t read photos.');
    ctx.drawImage(img, 0, 0, w, h);

    const pixels = ctx.getImageData(0, 0, w, h);
    const d = pixels.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) {
      const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
      d[i] = g;
      hist[g | 0]++;
    }
    // Stretch the 2nd–98th percentile of brightness to the full range.
    const n = w * h;
    let lo = 0;
    let hi = 255;
    for (let acc = 0, v = 0; v < 256; v++) if ((acc += hist[v]) >= n * 0.02) { lo = v; break; }
    for (let acc = 0, v = 255; v >= 0; v--) if ((acc += hist[v]) >= n * 0.02) { hi = v; break; }
    const range = Math.max(1, hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / range));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
