// Receipt scanning on the native apps: not built yet. The Android app will read receipts on the phone with
// Google ML Kit (free, needs a development build). The iPhone app is the PWA and uses receipt-ocr.web.ts.
// Same exports as the web file, so screens can import '@/lib/receipt-ocr' on every platform.

export const canScanReceipts = false;

export type ScanProgress = { stage: 'loading' | 'reading'; progress: number };

export async function pickReceiptPhoto(_options: { camera?: boolean } = {}): Promise<File | null> {
  return null;
}

export function setPendingReceipt(_file: File | null) {}

export function takePendingReceipt(): File | null {
  return null;
}

export async function readReceiptText(_file: File, _onProgress?: (p: ScanProgress) => void): Promise<string> {
  throw new Error('Scanning receipts is coming to the Android app soon.');
}
