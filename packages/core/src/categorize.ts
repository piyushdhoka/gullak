// Category + merchant guessing. Owner's own payee rules always win over these built-ins.

import type { Channel, Direction } from './parse-sms.ts';

export const CATEGORIES = [
  'Food',
  'Groceries',
  'Shopping',
  'Transport',
  'Travel',
  'Bills',
  'Entertainment',
  'Health',
  'Investments',
  'Transfers',
  'Cash',
  'Income',
  'Refund',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

// [keyword (matched against letters+digits only), display name, category]
const MERCHANTS: [string, string, Category][] = [
  ['swiggy', 'Swiggy', 'Food'],
  ['bundltech', 'Swiggy', 'Food'],
  ['zomato', 'Zomato', 'Food'],
  ['dominos', "Domino's", 'Food'],
  ['jubilantfood', "Domino's", 'Food'],
  ['mcdonald', "McDonald's", 'Food'],
  ['kfc', 'KFC', 'Food'],
  ['starbucks', 'Starbucks', 'Food'],
  ['chaipoint', 'Chai Point', 'Food'],
  ['eatsure', 'EatSure', 'Food'],
  ['blinkit', 'Blinkit', 'Groceries'],
  ['grofers', 'Blinkit', 'Groceries'],
  ['zepto', 'Zepto', 'Groceries'],
  ['kiranakart', 'Zepto', 'Groceries'],
  ['bigbasket', 'BigBasket', 'Groceries'],
  ['instamart', 'Instamart', 'Groceries'],
  ['dmart', 'DMart', 'Groceries'],
  ['avenuesupermart', 'DMart', 'Groceries'],
  ['jiomart', 'JioMart', 'Groceries'],
  ['amazon', 'Amazon', 'Shopping'],
  ['flipkart', 'Flipkart', 'Shopping'],
  ['myntra', 'Myntra', 'Shopping'],
  ['ajio', 'AJIO', 'Shopping'],
  ['meesho', 'Meesho', 'Shopping'],
  ['nykaa', 'Nykaa', 'Shopping'],
  ['decathlon', 'Decathlon', 'Shopping'],
  ['ikea', 'IKEA', 'Shopping'],
  ['croma', 'Croma', 'Shopping'],
  ['uber', 'Uber', 'Transport'],
  ['olacabs', 'Ola', 'Transport'],
  ['anitechnologies', 'Ola', 'Transport'],
  ['rapido', 'Rapido', 'Transport'],
  ['metro', 'Metro', 'Transport'],
  ['fastag', 'FASTag', 'Transport'],
  ['indianoil', 'Indian Oil', 'Transport'],
  ['iocl', 'Indian Oil', 'Transport'],
  ['hpcl', 'HP Petrol', 'Transport'],
  ['bpcl', 'Bharat Petroleum', 'Transport'],
  ['shellindia', 'Shell', 'Transport'],
  ['irctc', 'IRCTC', 'Travel'],
  ['makemytrip', 'MakeMyTrip', 'Travel'],
  ['goibibo', 'Goibibo', 'Travel'],
  ['cleartrip', 'Cleartrip', 'Travel'],
  ['ixigo', 'ixigo', 'Travel'],
  ['redbus', 'redBus', 'Travel'],
  ['indigo', 'IndiGo', 'Travel'],
  ['interglobe', 'IndiGo', 'Travel'],
  ['airindia', 'Air India', 'Travel'],
  ['akasa', 'Akasa Air', 'Travel'],
  ['oyo', 'OYO', 'Travel'],
  ['airbnb', 'Airbnb', 'Travel'],
  ['booking', 'Booking.com', 'Travel'],
  ['jiohotstar', 'JioHotstar', 'Entertainment'],
  ['jio', 'Jio', 'Bills'],
  ['airtel', 'Airtel', 'Bills'],
  ['vodafone', 'Vi', 'Bills'],
  ['bsnl', 'BSNL', 'Bills'],
  ['electricity', 'Electricity', 'Bills'],
  ['bescom', 'BESCOM', 'Bills'],
  ['msedcl', 'MSEDCL', 'Bills'],
  ['mahadiscom', 'MSEDCL', 'Bills'],
  ['tatapower', 'Tata Power', 'Bills'],
  ['adanielectricity', 'Adani Electricity', 'Bills'],
  ['actfibernet', 'ACT Fibernet', 'Bills'],
  ['recharge', 'Recharge', 'Bills'],
  ['netflix', 'Netflix', 'Entertainment'],
  ['spotify', 'Spotify', 'Entertainment'],
  ['hotstar', 'JioHotstar', 'Entertainment'],
  ['primevideo', 'Prime Video', 'Entertainment'],
  ['bookmyshow', 'BookMyShow', 'Entertainment'],
  ['bigtree', 'BookMyShow', 'Entertainment'],
  ['pvr', 'PVR INOX', 'Entertainment'],
  ['youtube', 'YouTube', 'Entertainment'],
  ['appleservices', 'Apple', 'Entertainment'],
  ['applemedia', 'Apple', 'Entertainment'],
  ['apollo', 'Apollo', 'Health'],
  ['pharmeasy', 'PharmEasy', 'Health'],
  ['1mg', 'Tata 1mg', 'Health'],
  ['netmeds', 'Netmeds', 'Health'],
  ['practo', 'Practo', 'Health'],
  ['cultfit', 'cult.fit', 'Health'],
  ['hospital', 'Hospital', 'Health'],
  ['zerodha', 'Zerodha', 'Investments'],
  ['groww', 'Groww', 'Investments'],
  ['upstox', 'Upstox', 'Investments'],
  ['kuvera', 'Kuvera', 'Investments'],
  ['indmoney', 'INDmoney', 'Investments'],
  ['indianclearingcorp', 'Mutual fund (ICCL)', 'Investments'],
  ['iccl', 'Mutual fund (ICCL)', 'Investments'],
  ['bsestarmf', 'Mutual fund', 'Investments'],
  ['mutualfund', 'Mutual fund', 'Investments'],
];

// VPA local parts that look like a business rather than a person.
const BUSINESS_HINT = /(qr|pay|store|shop|mart|ltd|pvt|merchant|bharatpe|razorpay|cashfree|billdesk|paytm|payu|\d{6,})/i;

// Payment-gateway / QR identifiers that say nothing about what was bought.
const OPAQUE_HINT =
  /^(paytmqr|paytm-?\d|bharatpe|q\d{5,}|ibkpos|gpay-?\d|upiqr|mab\.|yespay|razorpay|rzp|cf\.|cashfree|payu|billdesk|phonepe|ppe|ezetap|pinelabs|mswipe|vyapar|stq|bqr|bpqr|sbiqr|hdfcqr|merchant)/i;

/**
 * True when the payee is just an ID (QR code, gateway handle, mostly digits). A model can't
 * categorise these from the name, so they go to the owner for one tap instead.
 */
export function isOpaquePayee(payee: string | null, vpa: string | null): boolean {
  const name = (payee ?? vpa?.split('@')[0] ?? '').trim();
  if (!name) return true;
  const local = (vpa?.split('@')[0] ?? name).toLowerCase();
  if (OPAQUE_HINT.test(local) || OPAQUE_HINT.test(name)) return true;
  const letters = name.replace(/[^a-z]/gi, '');
  const digits = name.replace(/\D/g, '');
  // Needs at least one real word (3+ letters in a row) and must not be mostly digits.
  if (!/[a-z]{3,}/i.test(name)) return true;
  return digits.length >= 4 && digits.length >= letters.length;
}

// Words that make a readable payee a business, not a person.
const BUSINESS_WORDS =
  /(medic|pharma|chemist|store|stores|mart|kirana|enterprise|traders?|trading|foods?|cafe|hotel|restaurant|dhaba|bakery|sweets|agency|agencies|services?|solutions|garments|textile|fashion|electronics|mobiles|hardware|motors|petrol|fuel|clinic|hospital|diagnostic|lab|salon|parlour|gym|fitness|school|academy|tutorial|travels?|tours|pvt|ltd|llp|co\b|company|shop|bazaar|center|centre|general)/i;

// Readable shop names often say what they sell. Checked after the known-merchant list.
const SHOP_KEYWORDS: [RegExp, Category][] = [
  [/(medic|pharma|chemist|drug|clinic|hospital|diagnostic|patholog|dental|\blabs?\b|gym|fitness|yoga)/i, 'Health'],
  [/(kirana|provision|grocer|supermarket|super market|general store|dairy|milk|vegetable|fruits?\b|\bmart\b)/i, 'Groceries'],
  [/(restaurant|dhaba|cafe|caf[eé]|bakery|bakers|sweets|mithai|biryani|pizza|burger|juice|chai|tea stall|canteen|mess\b|foods?\b|kitchen|eatery|hotel)/i, 'Food'],
  [/(petrol|fuel|filling station|service station|parking|toll|auto ?parts|tyres?)/i, 'Transport'],
  [/(travels|tours|holidays|resort|lodge|guest ?house)/i, 'Travel'],
  [/(electronics|mobiles?\b|garments|fashion|textile|footwear|jewel|optical|stationer|book ?(store|depot)|gift|hardware|furniture)/i, 'Shopping'],
  [/(electricity|water (bill|board)|gas (agency|bill)|broadband|internet|cable|dth|recharge)/i, 'Bills'],
  [/(cinema|theatre|multiplex|gaming)/i, 'Entertainment'],
];

export function keywordCategory(payee: string | null): Category | null {
  if (!payee) return null;
  for (const [re, category] of SHOP_KEYWORDS) if (re.test(payee)) return category;
  return null;
}

/** A VPA made of a 10-digit Indian mobile number is almost always a person. */
function isMobileVpa(vpa: string | null) {
  return !!vpa && /^(\+?91)?[6-9]\d{9}(-\d)?$/.test(vpa.split('@')[0]);
}

function compact(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function findMerchant(payee: string | null, vpa: string | null): { name: string; category: Category } | null {
  const hay = compact(`${payee ?? ''} ${vpa ?? ''}`);
  if (!hay) return null;
  for (const [kw, name, category] of MERCHANTS) {
    if (hay.includes(kw)) return { name, category };
  }
  return null;
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .trim();
}

export interface CategorizeInput {
  direction: Direction;
  channel: Channel;
  payee: string | null;
  vpa: string | null;
  text: string;
}

/**
 * Where a category came from:
 * - `user`: the owner picked it (directly or via a saved payee rule)
 * - `merchant`: known merchant list
 * - `heuristic`: direction / ATM / person-to-person signals
 * - `model`: the optional classifier, above its confidence threshold
 * - `unknown`: nothing reliable; shown in Review for one tap
 */
export type CategorySource = 'user' | 'merchant' | 'heuristic' | 'model' | 'unknown';

export interface CategorizeResult {
  /** A built-in category, or one of the owner's own (from their payee rule). */
  category: string;
  /** Clean display name, e.g. "Swiggy" or "Rahul Kumar". */
  merchant: string | null;
  source: CategorySource;
}

export function categorize(input: CategorizeInput, ownerRule?: string | null): CategorizeResult {
  const known = findMerchant(input.payee, input.vpa);
  const opaque = isOpaquePayee(input.payee, input.vpa);
  const merchant = known?.name ?? (input.payee && !opaque ? titleCase(input.payee) : input.payee);

  const rule = ownerRule?.trim();
  if (rule) return { category: rule, merchant, source: 'user' };

  if (input.direction === 'credit') {
    if (/\b(refund|reversal|reversed)\b/i.test(input.text)) return { category: 'Refund', merchant, source: 'heuristic' };
    return { category: 'Income', merchant, source: 'heuristic' };
  }

  if (input.channel === 'atm') return { category: 'Cash', merchant: merchant ?? 'ATM', source: 'heuristic' };
  if (known) return { category: known.category, merchant, source: 'merchant' };

  const keyword = opaque ? null : keywordCategory(input.payee ?? input.vpa?.split('@')[0] ?? null);
  if (keyword) return { category: keyword, merchant, source: 'heuristic' };

  if (/\bUPI\/P2A\//i.test(input.text) || isMobileVpa(input.vpa)) {
    return { category: 'Transfers', merchant, source: 'heuristic' };
  }
  const local = input.vpa?.split('@')[0] ?? '';
  const merchantPayment = /\bUPI\/P2M\//i.test(input.text);
  if (
    !merchantPayment &&
    !opaque &&
    input.vpa &&
    !BUSINESS_HINT.test(local) &&
    !BUSINESS_WORDS.test(`${local} ${input.payee ?? ''}`) &&
    /^[a-z]+([._][a-z]+)*\d{0,3}$/i.test(local)
  ) {
    // name-like VPA such as rahul.k@okicici
    return { category: 'Transfers', merchant, source: 'heuristic' };
  }

  return { category: 'Other', merchant, source: 'unknown' };
}
