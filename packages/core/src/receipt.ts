// Reading a bill or receipt: turns the text that OCR found on a photo into a guess for the Add screen.
// Pure TypeScript, no network: the photo and its text never leave the phone.
//
// What it looks for (Indian receipts: restaurants, kirana, supermarkets, petrol pumps, pharmacies):
//   amount    the TOTAL / GRAND TOTAL / NET AMOUNT / AMOUNT PAYABLE line, never tax, subtotal, discount or change
//   date      day-first dates (23/11/2026, 23-11-26, 23-Nov-2026, 23 Nov 26) and ISO; prefers a line saying "Date"
//   time      12:45, 07:05 PM
//   merchant  the shop name at the top, skipping "TAX INVOICE", GSTIN, phone, address lines
//   category  known merchants, the shop name, then what the bill lists (litres → Transport, tablets → Health …)
//   paidBy    UPI / card / cash, when the receipt says so
//
// OCR on a phone photo is noisy, so every field can be null and the person always checks before saving.

import { findMerchant, keywordCategory, type Category } from './categorize.ts';

export interface ReceiptGuess {
  amount: number | null;
  /** True when the amount came from a labelled total line; false for a best guess. */
  amountSure: boolean;
  /** Calendar date printed on the receipt, YYYY-MM-DD. */
  date: string | null;
  /** Time printed on the receipt, HH:MM (24-hour). */
  time: string | null;
  merchant: string | null;
  category: Category | null;
  paidBy: 'upi' | 'card' | 'cash' | null;
}

const EMPTY: ReceiptGuess = { amount: null, amountSure: false, date: null, time: null, merchant: null, category: null, paidBy: null };

/** Largest believable single receipt (₹10 lakh). Bigger numbers are bill numbers, phone numbers, GSTINs. */
const MAX_AMOUNT = 1_000_000;

export function parseReceipt(text: string, now: Date = new Date()): ReceiptGuess {
  const lines = cleanLines(text);
  if (!lines.length) return { ...EMPTY };
  const { amount, sure } = findTotal(lines);
  const { date, time } = findDateTime(lines, now);
  const merchant = findShopName(lines);
  return {
    amount,
    amountSure: sure,
    date,
    time,
    merchant,
    category: findCategory(merchant, lines),
    paidBy: findPaidBy(lines),
  };
}

// ---------------------------------------------------------------- lines

function cleanLines(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) =>
      l
        .replace(/[|]/g, ' ')
        // OCR reads O as 0 inside words ("T0TAL", "N0V"); numbers are left alone.
        .replace(/(?<=[A-Za-z])0(?=[A-Za-z])/g, 'O')
        .replace(/[–—]/g, '-')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((l) => l.length > 0);
}

// ---------------------------------------------------------------- amount

/** Labels that name the amount actually paid, strongest first. */
const TOTAL_LABELS: [RegExp, number][] = [
  [/\b(grand\s*total|g\.?\s*total|net\s*(amount|amt|payable|total|bill)|amount\s*payable|total\s*payable|payable\s*amount|amount\s*due|bill\s*amount|total\s*amount|total\s*amt|amt\s*payable|to\s*pay|net\s*rs|total\s*rs|total\s*inr|total\s*₹|sale\s*amount|invoice\s*(total|amount|value))\b/i, 10],
  [/\btotal\b/i, 6],
  [/\b(amount|amt)\b/i, 2],
];

/** Lines that carry an amount that is NOT what was paid. */
const NOT_TOTAL =
  /\b(sub\s*-?\s*total|subtotal|total\s*(qty|quantity|items?|no\.?\s*of|pcs|savings?|discount|tax|gst)|items?\s*total|tax|c\s*gst|s\s*gst|i\s*gst|u\s*gst|cgst|sgst|igst|ugst|gst|vat|cess|service\s*charge|disc(ount)?|saving|you\s*saved|saved|round(ed)?\s*off|r\/?off|change|tendered|cash\s*(paid|received|recd|given)|received|balance|bal\.?|mrp|rate|price|qty|quantity|points?|loyalty|tip|taxable|hsn|sac)\b/i;

/** Money on a line: 1,250.00  1250.5  12,34,567  450 */
const MONEY = /(?<![\d/:.-])(\d{1,3}(?:,\d{2,3})+|\d{1,7})(?:[.,](\d{1,2}))?(?![\d/:%-])/g;

function moneyValues(line: string): { value: number; decimals: boolean }[] {
  // Glue OCR-split decimals ("450 . 00") and treat O/o inside numbers as 0 ("1O5.00").
  const norm = line
    // "Rs. 260/-" is how many Indian bills write whole rupees.
    .replace(/(\d)\s*\/\s*-/g, '$1')
    // OCR adds a space after a thousands comma ("1, 876.25").
    .replace(/(\d),\s+(\d{2,3}(?:[.,]\d{2})?)\b/g, '$1,$2')
    // OCR reads commas as dots ("1.876.25", "12.34.567.00"): with several separators, the last one before
    // exactly two digits is the decimal point and the rest are thousands. Dates (15.11.2026) don't end in 2 digits.
    .replace(/\d{1,3}(?:[.,]\d{2,3})+[.,]\d{2}(?!\d)/g, (num) => {
      const cut = num.length - 3;
      return `${num.slice(0, cut).replace(/[.,]/g, '')}.${num.slice(cut + 1)}`;
    })
    .replace(/(\d)\s*([.,])\s*(\d{2})\b/g, '$1$2$3')
    .replace(/(?<=\d)[Oo](?=[\d.,]|\b)|(?<=[\d.,])[Oo](?=\d)/g, '0')
    .replace(/(?:rs\.?|inr|₹)\s*/gi, ' ');
  const out: { value: number; decimals: boolean }[] = [];
  for (const m of norm.matchAll(MONEY)) {
    // Skip things that look like dates, times, phone numbers or percentages around the match.
    const value = Number(m[1].replace(/,/g, '') + (m[2] ? `.${m[2].padEnd(2, '0')}` : ''));
    if (!Number.isFinite(value) || value <= 0 || value > MAX_AMOUNT) continue;
    out.push({ value, decimals: m[2] !== undefined });
  }
  return out;
}

function findTotal(lines: string[]): { amount: number | null; sure: boolean } {
  let best: { value: number; score: number } | null = null;
  lines.forEach((line, i) => {
    const label = TOTAL_LABELS.find(([re]) => re.test(line));
    if (!label) return;
    if (NOT_TOTAL.test(line) && label[1] < 10) return;
    // The strong labels can sit on a line with tax words ("Net Amount incl. GST"); still skip pure tax/subtotal lines.
    if (/\b(sub\s*-?\s*total|subtotal|taxable)\b/i.test(line)) return;
    let values = moneyValues(line.replace(label[0], ' '));
    // "TOTAL" on one line, the number on the next.
    if (!values.length && lines[i + 1] && !TOTAL_LABELS[0][0].test(lines[i + 1]) && !NOT_TOTAL.test(lines[i + 1])) {
      values = moneyValues(lines[i + 1]);
    }
    if (!values.length) return;
    const v = values[values.length - 1];
    // Prefer strong labels, then amounts with paise, then lines further down the bill.
    const score = label[1] * 100 + (v.decimals ? 20 : 0) + (i / lines.length) * 10;
    if (!best || score > best.score) best = { value: v.value, score };
  });
  if (best) return { amount: round2((best as { value: number }).value), sure: (best as { score: number }).score >= 600 };

  // No labelled total: the largest amount with paise, away from tax / change / quantity lines.
  const candidates = lines
    .filter((l) => !NOT_TOTAL.test(l) && !isDateOrPhoneLine(l))
    .flatMap((l) => moneyValues(l))
    .filter((v) => v.decimals);
  if (!candidates.length) return { amount: null, sure: false };
  return { amount: round2(Math.max(...candidates.map((v) => v.value))), sure: false };
}

function isDateOrPhoneLine(line: string) {
  return /\b(date|dt|time|ph|phone|mob|mobile|tel|gstin|gst\s*no|fssai|bill\s*no|invoice\s*no|inv\s*no|order\s*no|token|table|kot|pin)\b/i.test(line);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- date and time

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function findDateTime(lines: string[], now: Date): { date: string | null; time: string | null } {
  type Hit = { date: string; score: number };
  const hits: Hit[] = [];
  let time: string | null = null;
  const nowDay = ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const oldest = ymd(now.getFullYear() - 2, now.getMonth() + 1, now.getDate());

  lines.forEach((line, i) => {
    const labelled = /\b(date|dt|dated|bill\s*dt)\b/i.test(line) ? 50 : 0;
    const add = (y: number, m: number, d: number, base: number) => {
      if (y < 100) y += 2000;
      if (!validDate(y, m, d)) return;
      const iso = ymd(y, m, d);
      // Not in the future (a day's slack for time zones), not older than two years.
      if (iso > addDays(nowDay, 1) || iso < oldest) return;
      hits.push({ date: iso, score: base + labelled - i * 0.01 });
    };
    // 23/11/2026, 23-11-26, 23.11.2026
    for (const m of line.matchAll(/(?<!\d)(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4}|\d{2})(?!\d)/g)) {
      add(Number(m[3]), Number(m[2]), Number(m[1]), 30);
    }
    // 2026-11-23
    for (const m of line.matchAll(/(?<!\d)(20\d{2})[/.-](\d{1,2})[/.-](\d{1,2})(?!\d)/g)) {
      add(Number(m[1]), Number(m[2]), Number(m[3]), 30);
    }
    // 23-Nov-2026, 23 Nov 26, 23Nov2026
    for (const m of line.matchAll(/(?<!\d)(\d{1,2})\s*[-/. ]?\s*([A-Za-z]{3,4})[a-z]*\s*[-/., ]?\s*(\d{4}|\d{2})(?!\d)/g)) {
      const mon = MONTHS[m[2].toLowerCase()];
      if (mon) add(Number(m[3]), mon, Number(m[1]), 35);
    }
    // 17 Nov with the year cut off or unreadable: the most recent 17 Nov that isn't in the future.
    // Scores below a full date, so a readable year always wins.
    for (const m of line.matchAll(/(?<!\d)(\d{1,2})\s*[-/. ]?\s*([A-Za-z]{3,4})[a-z]*/g)) {
      const mon = MONTHS[m[2].toLowerCase()];
      if (!mon) continue;
      const day = Number(m[1]);
      const y = ymd(now.getFullYear(), mon, day) > addDays(nowDay, 1) ? now.getFullYear() - 1 : now.getFullYear();
      add(y, mon, day, 15);
    }
    // Nov 23, 2026
    for (const m of line.matchAll(/\b([A-Za-z]{3,4})[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/g)) {
      const mon = MONTHS[m[1].toLowerCase()];
      if (mon) add(Number(m[3]), mon, Number(m[2]), 35);
    }
    if (!time) {
      const t = line.match(/(?<![\d.])([01]?\d|2[0-3])\s*:\s*([0-5]\d)(?:\s*:\s*[0-5]\d)?\s*([AaPp])?\.?\s*[Mm]?\.?(?![\d])/);
      if (t) {
        let h = Number(t[1]);
        const ap = t[3]?.toLowerCase();
        if (ap === 'p' && h < 12) h += 12;
        if (ap === 'a' && h === 12) h = 0;
        time = `${String(h).padStart(2, '0')}:${t[2]}`;
      }
    }
  });
  hits.sort((a, b) => b.score - a.score);
  return { date: hits[0]?.date ?? null, time };
}

function validDate(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

// ---------------------------------------------------------------- shop name

/** Header lines that are never the shop's name. */
const NOT_NAME =
  /\b(tax\s*invoice|invoice|bill\s*of\s*supply|cash\s*memo|cash\s*bill|retail\s*invoice|receipt|estimate|duplicate|original|customer\s*copy|merchant\s*copy|welcome|thank|gstin|gst\s*no|gst\s*in|fssai|cin|pan|lic\s*no|ph\b|phone|mob|mobile|tel\b|contact|email|www\.|http|\.com|road|rd\.?\b|marg|nagar|street|st\.|lane|chowk|colony|sector|near|opp\.?|behind|shop\s*no|plot|floor|building|bldg|society|pune|mumbai|delhi|bengaluru|bangalore|hyderabad|chennai|kolkata|maharashtra|india|pin\s*code|bill\s*no|inv(oice)?\s*no|date|time|table|cashier|counter|kot|order|token|guest|pax|steward|waiter)\b/i;

function findShopName(lines: string[]): string | null {
  // Only the top of the bill, and never address/phone/header lines ("Near Metro Station" is not Metro).
  const candidates = lines.slice(0, 8).filter((line) => {
    if (NOT_NAME.test(line) || /\d{6}/.test(line)) return false; // headers, addresses, PIN codes, phone numbers
    const letters = (line.match(/[A-Za-z]/g) ?? []).length;
    return letters >= 3 && letters / line.length >= 0.6;
  });
  // A known chain wins (DMart, Apollo, Indian Oil …), using its proper name.
  for (const line of candidates) {
    const known = findMerchant(line, null);
    if (known) return known.name;
  }
  for (const line of candidates) {
    const name = line.replace(/[^A-Za-z0-9&'. -]/g, ' ').replace(/\s+/g, ' ').trim();
    if (name.length >= 3) return tidyName(name).slice(0, 40);
  }
  return null;
}

function tidyName(s: string) {
  // ALL CAPS on receipts → Title Case. (Chains like KFC or DMart get their proper name from the merchant list.)
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------- category

/** What the bill itself lists, when the shop name doesn't say. */
const CONTENT_HINTS: [RegExp, Category][] = [
  [/\b(petrol|diesel|hsd|fuel|nozzle|pump\s*no|litres?|ltrs?|xtra\s*premium|power\s*petrol|density|vehicle\s*no|cng)\b/i, 'Transport'],
  [/\b(tab(let)?s?|cap(sule)?s?|syp|syrup|inj|ointment|batch|exp(iry)?\.?\s*dt|mfg|schedule\s*h|pharmac|chemist|drug\s*lic|dl\s*no|rx)\b/i, 'Health'],
  [/\b(kot|table\s*no|steward|waiter|dine|covers?|pax|paneer|roti|naan|thali|biryani|dosa|idli|masala|tikka|chai|coffee|lassi|veg\b|non[-\s]?veg|starter|beverage|service\s*charge)\b/i, 'Food'],
  [/\b(atta|rice|dal|sugar|oil|ghee|milk|curd|salt|soap|detergent|biscuit|namkeen|\bkg\b|\bgm\b|\bgms\b|grocery|fmcg|hyper\s*market|supermarts?)\b/i, 'Groceries'],
  [/\b(consumer\s*no|units?\s*consumed|meter|electricity|bill\s*month|broadband|recharge)\b/i, 'Bills'],
  [/\b(screen|show\s*time|seat|movie|ticket)\b/i, 'Entertainment'],
  [/\b(shirt|jeans|kurta|saree|size|footwear|shoes|garment|apparel)\b/i, 'Shopping'],
];

function findCategory(merchant: string | null, lines: string[]): Category | null {
  const known = merchant ? findMerchant(merchant, null) : null;
  if (known) return known.category;
  const byName = keywordCategory(merchant);
  if (byName) return byName;
  const body = lines.join('\n');
  for (const [re, category] of CONTENT_HINTS) if (re.test(body)) return category;
  return null;
}

// ---------------------------------------------------------------- payment mode

function findPaidBy(lines: string[]): ReceiptGuess['paidBy'] {
  const body = lines.join('\n');
  if (/\b(upi|gpay|google\s*pay|phone\s*pe|phonepe|paytm|bhim|bharat\s*qr|vpa)\b/i.test(body)) return 'upi';
  if (/\b(card|visa|master\s*card|mastercard|rupay|amex|debit\s*card|credit\s*card|swipe|pos\s*txn|card\s*no|xx{2,}\d{4})\b/i.test(body)) return 'card';
  if (/\b(cash\s*(paid|received|recd|tendered|payment)|paid\s*(by|in)\s*cash|mode\s*[:-]?\s*cash|payment\s*(mode|type)?\s*[:-]?\s*cash|tender\s*[:-]?\s*cash)\b/i.test(body)) {
    return 'cash';
  }
  return null;
}
