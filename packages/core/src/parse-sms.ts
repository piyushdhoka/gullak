// Bank SMS → transaction parser.
// Pure TypeScript with no dependencies so it runs in Deno (Edge Functions) and Node (tests).

export type Direction = 'debit' | 'credit';
export type Channel = 'upi' | 'card' | 'netbanking' | 'atm' | 'other';

export interface ParsedTxn {
  amount: number;
  direction: Direction;
  /** Counterparty as written in the SMS (merchant, person, or VPA local part). */
  payee: string | null;
  /** Stable lowercase key used to remember a category for this payee. */
  payeeKey: string | null;
  vpa: string | null;
  bank: string | null;
  /** Last 3–4 digits of the account or card. */
  account: string | null;
  upiRef: string | null;
  channel: Channel;
  /** Available balance the bank reports after this payment, when the SMS includes it. */
  balance: number | null;
}

export type ParseResult =
  | { kind: 'transaction'; txn: ParsedTxn }
  | { kind: 'ignored'; reason: string }
  | { kind: 'unrecognised'; reason: string };

const IGNORE_RULES: [string, RegExp][] = [
  ['otp', /\b(otp|one[\s-]?time\s+password|verification\s+code|passcode)\b/i],
  ['collect request', /\b(has\s+requested|requested\s+(money|rs|inr)|collect\s+request|payment\s+request)\b/i],
  ['failed', /\b(failed|declined|unsuccessful|could\s+not\s+be\s+processed|rejected)\b/i],
  ['future debit', /\bwill\s+be\s+(debited|deducted|charged)\b/i],
  [
    'bill or statement',
    /\b(statement\s+(is\s+)?generated|total\s+(amt|amount)\s+due|min(imum)?\.?\s+(amt|amount)\s+due|is\s+due\s+on|payment\s+due)\b/i,
  ],
  ['card bill payment', /\breceived\s+towards\s+your\b.*\bcard\b/i],
];

const PROMO = /\b(cashback|offer|use\s+code|t&c|apply\s+now|pre-?approved|voucher|coupon|discount|win\b|congratulations)/i;

const DEBIT_WORDS = /\b(debited|debit|sent|spent|paid|withdrawn|withdrawal|purchased?|deducted|transferred)\b/i;
const CREDIT_WORDS = /\b(credited|received|deposited|refund(ed)?|reversed|reversal)\b/i;

const CURRENCY_AMOUNT = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)/gi;
const BARE_AMOUNT = /\b(?:debited|credited|withdrawn)\s+(?:by|for|with|of)?\s*([\d,]+(?:\.\d+)?)/i;
const BALANCE_BEFORE = /(bal(ance)?|limit|avl|available)[\s.:a-z]*$/i;

const ACCOUNT = /\b(?:a\/c|ac|acct|account|card)(?:\s*(?:no\.?|number|ending(?:\s*with)?))?[\s.:#-]*[x*]*\s*(\d{3,6})(?!\d)/i;

const UPI_REFS = [
  /\bUPI\/[A-Z0-9]+\/(\d{10,16})/i,
  /\b(?:upi\s*ref(?:erence)?\s*(?:no\.?)?|ref(?:erence)?\s*(?:no\.?|number)?|refno|rrn|upi)[\s.:#-]*(\d{10,16})/i,
];

const BANKS: [RegExp, string][] = [
  [/\bhdfc\b/i, 'HDFC Bank'],
  [/\bsbi\b|\bstate\s+bank\b/i, 'SBI'],
  [/\bicici\b/i, 'ICICI Bank'],
  [/\baxis\b/i, 'Axis Bank'],
  [/\bkotak\b/i, 'Kotak'],
  [/\bidfc\b/i, 'IDFC FIRST'],
  [/\byes\s*bank\b/i, 'Yes Bank'],
  [/\bindusind\b/i, 'IndusInd'],
  [/\bpnb\b|\bpunjab\s+national\b/i, 'PNB'],
  [/\bbank\s+of\s+baroda\b|\bbob\b/i, 'Bank of Baroda'],
  [/\bcanara\b/i, 'Canara Bank'],
  [/\bunion\s+bank\b/i, 'Union Bank'],
  [/\bfederal\b/i, 'Federal Bank'],
  [/\bau\s+(small\s+finance\s+)?bank\b/i, 'AU Bank'],
  [/\brbl\b/i, 'RBL Bank'],
  [/\bidbi\b/i, 'IDBI Bank'],
  [/\bindian\s+overseas\b|\biob\b/i, 'IOB'],
  [/\bbank\s+of\s+india\b/i, 'Bank of India'],
  [/\bhsbc\b/i, 'HSBC'],
  [/\bstandard\s+chartered\b/i, 'Standard Chartered'],
  [/\bamex\b|\bamerican\s+express\b/i, 'Amex'],
];

// Where a counterparty name ends.
const END =
  String.raw`(?=\s+(?:on|ref|refno|upi|via|avl|has|is|was|for|from|not|info|ifsc|dated|using|thru|through|by)\b|[.;,(\n:]|\s*$)`;

const DEBIT_PAYEE: RegExp[] = [
  /\bUPI\/[A-Z0-9]+\/\d{6,}\/([^/\n]+)/gi,
  /;\s*([^;.\n]+?)\s+credited\b/gi,
  new RegExp(String.raw`\b(?:trf\s+)?to\s*:?\s+(?:vpa\s+)?([^\n]+?)` + END, 'gi'),
  new RegExp(String.raw`\bat\s+([^\n]+?)` + END, 'gi'),
  new RegExp(String.raw`\btowards\s+([^\n]+?)` + END, 'gi'),
];

const CREDIT_PAYEE: RegExp[] = [
  /\bUPI\/[A-Z0-9]+\/\d{6,}\/([^/\n]+)/gi,
  new RegExp(String.raw`\bfrom\s*:?\s+(?:vpa\s+)?([^\n]+?)` + END, 'gi'),
  new RegExp(String.raw`\bby\s+([^\n]+?)` + END, 'gi'),
];

const NOT_A_PAYEE =
  /\b(a\/?c|acct|account|card|your|neft|imps|rtgs|upi|atm|date|rs\.?|inr|bank\s+a\/?c)\b|x{2,}\d|\*\d|₹|https?:|^\d[\d\s]*$/i;

function stripCardWords(text: string) {
  // "Credit Card" / "Debit Card" must not decide the direction.
  return text.replace(/\b(credit|debit)\s*card\b/gi, 'card');
}

function firstIndex(re: RegExp, text: string) {
  const m = re.exec(text);
  return m ? m.index : -1;
}

function findDirection(text: string): Direction | null {
  const t = stripCardWords(text);
  const d = firstIndex(DEBIT_WORDS, t);
  const c = firstIndex(CREDIT_WORDS, t);
  if (d < 0 && c < 0) return null;
  if (d < 0) return 'credit';
  if (c < 0) return 'debit';
  return d < c ? 'debit' : 'credit';
}

function toNumber(raw: string) {
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

function findAmount(text: string): number | null {
  CURRENCY_AMOUNT.lastIndex = 0;
  for (let m = CURRENCY_AMOUNT.exec(text); m; m = CURRENCY_AMOUNT.exec(text)) {
    const before = text.slice(Math.max(0, m.index - 25), m.index);
    if (BALANCE_BEFORE.test(before)) continue;
    const n = toNumber(m[1]);
    if (n > 0) return n;
  }
  const bare = BARE_AMOUNT.exec(text);
  if (bare) {
    const n = toNumber(bare[1]);
    if (n > 0) return n;
  }
  return null;
}

function findVpa(text: string): string | null {
  const re = /\b([a-z0-9][a-z0-9._-]*@[a-z][a-z0-9]+)/gi;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const after = text.slice(m.index + m[0].length);
    if (/^\.[a-z]{2,}/i.test(after)) continue; // an email/domain, not a VPA
    return m[1].toLowerCase();
  }
  return null;
}

function cleanName(raw: string) {
  return raw.replace(/\s+/g, ' ').replace(/^[\s\-:]+|[\s\-:.]+$/g, '').trim();
}

function findPayee(text: string, direction: Direction): string | null {
  const patterns = direction === 'debit' ? DEBIT_PAYEE : CREDIT_PAYEE;
  let best: { index: number; name: string } | null = null;
  for (const re of patterns) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const name = cleanName(m[1]);
      if (!name || name.length > 60 || NOT_A_PAYEE.test(name)) continue;
      if (!best || m.index < best.index) best = { index: m.index, name };
      break;
    }
  }
  return best?.name ?? null;
}

// "Avl Bal Rs 12,450.75", "Available Balance: INR 5,000", "Bal: Rs.70,120.00". Card "Avl Limit" is not a balance.
const BALANCE =
  /\b(?:avl\.?\s*bal(?:ance)?|available\s+bal(?:ance)?|a\/c\s+bal(?:ance)?|bal(?:ance)?)\b[\s.:-]*(?:is\s*)?(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)/i;

function findBalance(text: string): number | null {
  const m = BALANCE.exec(text);
  if (!m) return null;
  const n = toNumber(m[1]);
  return Number.isFinite(n) ? n : null;
}

function findAccount(text: string): string | null {
  const m = ACCOUNT.exec(text);
  return m ? m[1].slice(-4) : null;
}

function findUpiRef(text: string): string | null {
  for (const re of UPI_REFS) {
    const m = re.exec(text);
    if (m) return m[1];
  }
  return null;
}

function findBank(text: string): string | null {
  for (const [re, name] of BANKS) if (re.test(text)) return name;
  return null;
}

function findChannel(text: string, vpa: string | null): Channel {
  if (/\batm\b|cash\s+withdrawal/i.test(text)) return 'atm';
  if (vpa || /\bupi\b|\bvpa\b/i.test(text)) return 'upi';
  if (/\bcard\b/i.test(text)) return 'card';
  if (/\b(neft|imps|rtgs|net\s?banking)\b/i.test(text)) return 'netbanking';
  return 'other';
}

export function payeeKeyOf(payee: string | null, vpa: string | null): string | null {
  if (vpa) return vpa.toLowerCase();
  if (!payee) return null;
  const key = payee.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return key || null;
}

export function parseSms(input: string): ParseResult {
  const text = (input ?? '').replace(/\r\n?/g, '\n').trim();
  if (!text) return { kind: 'unrecognised', reason: 'empty message' };

  for (const [reason, re] of IGNORE_RULES) {
    if (re.test(text)) return { kind: 'ignored', reason };
  }

  const account = findAccount(text);
  if (!account && PROMO.test(text)) return { kind: 'ignored', reason: 'promotion' };

  const direction = findDirection(text);
  const amount = findAmount(text);
  if (!direction) return { kind: 'unrecognised', reason: 'no debit/credit wording' };
  if (amount == null) return { kind: 'unrecognised', reason: 'no amount' };

  const vpa = findVpa(text);
  const payee = vpa ? vpa.split('@')[0] : findPayee(text, direction);

  return {
    kind: 'transaction',
    txn: {
      amount,
      direction,
      payee,
      payeeKey: payeeKeyOf(payee, vpa),
      vpa,
      bank: findBank(text),
      account,
      upiRef: findUpiRef(text),
      channel: findChannel(text, vpa),
      balance: findBalance(text),
    },
  };
}
