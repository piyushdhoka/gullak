// Gullak's notification voice: short, warm, a little cheeky, always useful.
// In the spirit of Duolingo's owl and Zomato's push copy: the mascot talks, every notification
// says one concrete thing (an amount, a name, a number of days), and a tap goes exactly where you'd expect.
//
// Rules the copy follows:
//  - The title carries the fact (amount + who). The body carries the personality and the next step.
//  - One emoji, at the end of the title, picked by category. Never more.
//  - Never shame the spending. Tease the situation, not the person.
//  - Lines are picked by a stable hash of the payment id, so the same payment always reads the same
//    and tests are deterministic, while consecutive payments vary.
//
// Pure TypeScript: runs in the Edge Functions (Deno), the app and the tests.

import type { PushPayload } from './ingest-core.ts';

/** A notification action button. Shown on Android / desktop Chrome; iOS shows the notification without them. */
export interface PushAction {
  action: string;
  title: string;
  /** Where this button goes. Falls back to the notification's own url. */
  url?: string;
}

export type PushKind =
  | 'payment'
  | 'income'
  | 'new-payee'
  | 'big-spend'
  | 'budget-warning'
  | 'budget-over'
  | 'quiet'
  | 'daily-diary'
  | 'jar-milestone'
  | 'subscription-due'
  | 'import-done';

/** A PushPayload plus the extras the service worker knows how to render. Every extra is optional. */
export interface RichPush extends PushPayload {
  kind: PushKind;
  actions?: PushAction[];
  /** Big image under the text (Android / desktop Chrome). */
  image?: string;
  /** Keep it on screen until it is acted on (budget burst, quiet nudge). */
  requireInteraction?: boolean;
  /** Buzz again even when it replaces one with the same tag. */
  renotify?: boolean;
  /** Vibration pattern in ms. */
  vibrate?: number[];
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

/** ₹1,250 for whole rupees, ₹1,250.50 otherwise. */
export function rupees(n: number): string {
  return Number.isInteger(n) ? inr.format(n) : inrExact.format(n);
}

/** Stable pick from a list, keyed by a string (payment id, date…). */
export function pick<T>(list: readonly T[], key: string): T {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return list[(h >>> 0) % list.length];
}

export const CATEGORY_EMOJI: Record<string, string> = {
  Food: '🍔',
  Groceries: '🛒',
  Shopping: '🛍️',
  Transport: '🛺',
  Travel: '✈️',
  Bills: '💡',
  Entertainment: '🎬',
  Health: '💊',
  Investments: '📈',
  Transfers: '👤',
  Cash: '💵',
  Income: '💰',
  Refund: '↩️',
  Other: '🪙',
};

// One line per category, picked per payment. Each says what Gullak did, plus a nudge.
const PAYMENT_LINES: Record<string, readonly string[]> = {
  Food: ['Filed under Food. Hope it was worth it.', 'Into the Food jar. Chai counts too.', 'Food, noted. Gullak is hungry now.'],
  Groceries: ['Filed under Groceries. Fridge: restocked.', 'Groceries, noted. Adulting level up.'],
  Shopping: ['Filed under Shopping. Gullak saw nothing. (It saw.)', 'Shopping, noted. Add to cart is a lifestyle.'],
  Transport: ['Filed under Transport. Safe ride!', 'Transport, noted. Meter down, Gullak up.'],
  Travel: ['Filed under Travel. Window seat?', 'Travel, noted. Send Gullak a postcard.'],
  Bills: ['Bill paid and filed. No late fee, no drama.', 'Bills, noted. Lights stay on.'],
  Entertainment: ['Filed under Entertainment. Popcorn not included.', 'Entertainment, noted. Enjoy the show.'],
  Health: ['Filed under Health. Get well soon.', 'Health, noted. Take care of yourself.'],
  Investments: ['Filed under Investments. Future you says thanks.', 'Invested and noted. Gullak approves.'],
  Transfers: ['Filed under Transfers.', 'Transfer noted.'],
  Cash: ['Cash out, noted.', 'Filed under Cash.'],
  Other: ['Filed under Other. Tap to change it.', 'Noted. Tap if the category is off.'],
};

const INCOME_LINES = [
  'Gullak is doing a little happy dance.',
  'Coins in the pot. Treat yourself, a little.',
  'Money in! Maybe feed a Jar?',
] as const;

const NEW_PAYEE_LINES = [
  'New name for Gullak. One tap and it remembers forever.',
  'Who is this? Pick a category once and Gullak never asks again.',
  'Gullak hasn’t met them yet. Introduce them in one tap.',
] as const;

const QUIET_LINES = [
  'No payments in {days} days. Is the Shortcut still on, or are you just that good?',
  'It’s quiet in here. {days} days without a payment. Check that capture still works?',
  'Gullak misses you. {days} days, zero payments. Everything okay with the Shortcut?',
] as const;

export interface PaymentInfo {
  id: string;
  amount: number;
  direction: 'debit' | 'credit';
  merchant?: string | null;
  payee?: string | null;
  category: string;
  /** 'unknown' means the model wasn't sure: the payment waits in Review. */
  category_source: string;
  bank?: string | null;
  account?: string | null;
}

/** Above this, a debit gets the "big spend" treatment. */
export const BIG_SPEND = 10_000;

function who(p: PaymentInfo): string {
  return p.merchant ?? p.payee ?? (p.direction === 'debit' ? 'a payment' : 'money received');
}

function where(p: PaymentInfo): string {
  return [p.bank, p.account ? `•${p.account}` : null].filter(Boolean).join(' ');
}

/** The notification for a payment that just came in from a bank SMS. */
export function paymentPush(p: PaymentInfo): RichPush {
  const name = who(p);
  const txn = `/transaction?id=${p.id}`;

  if (p.direction === 'credit') {
    return {
      kind: 'income',
      title: `+${rupees(p.amount)} from ${name} 💰`,
      body: [pick(INCOME_LINES, p.id), where(p)].filter(Boolean).join(' '),
      url: txn,
      tag: p.id,
      actions: [
        { action: 'open', title: 'See it', url: txn },
        { action: 'jars', title: 'Feed a Jar', url: '/jars' },
      ],
    };
  }

  if (p.category_source === 'unknown') {
    return {
      kind: 'new-payee',
      title: `${rupees(p.amount)} to ${name} 🤔`,
      body: pick(NEW_PAYEE_LINES, p.id),
      url: '/review',
      tag: p.id,
      renotify: true,
      actions: [
        { action: 'review', title: 'Pick category', url: '/review' },
        { action: 'open', title: 'Details', url: txn },
      ],
    };
  }

  if (p.amount >= BIG_SPEND) {
    return {
      kind: 'big-spend',
      title: `Whoa, ${rupees(p.amount)} at ${name} 😳`,
      body: `Filed under ${p.category}. Big one. Not you? Check it now.`,
      url: txn,
      tag: p.id,
      vibrate: [80, 60, 80, 60, 160],
      actions: [
        { action: 'open', title: 'Check it', url: txn },
        { action: 'summary', title: 'My month', url: '/' },
      ],
    };
  }

  const lines = PAYMENT_LINES[p.category] ?? PAYMENT_LINES.Other;
  return {
    kind: 'payment',
    title: `${rupees(p.amount)} at ${name} ${CATEGORY_EMOJI[p.category] ?? '🪙'}`,
    body: pick(lines, p.id),
    url: txn,
    tag: p.id,
    actions: [
      { action: 'open', title: 'Change category', url: txn },
      { action: 'summary', title: 'My month', url: '/' },
    ],
  };
}

/** A category budget crossing 80% (warning) or 100% (over). `daysLeft` in the month. */
export function budgetPush(b: { category: string; limit: number; spent: number; daysLeft: number; month: string }): RichPush {
  const emoji = CATEGORY_EMOJI[b.category] ?? '🪙';
  const tag = `budget-${b.category}-${b.month}`;
  if (b.spent > b.limit) {
    return {
      kind: 'budget-over',
      title: `${b.category} budget just burst 💥`,
      body: `${rupees(b.spent - b.limit)} over, ${b.daysLeft} day${b.daysLeft === 1 ? '' : 's'} to go. Gullak believes in a comeback.`,
      url: '/budgets',
      tag,
      requireInteraction: true,
      actions: [
        { action: 'budgets', title: 'See budgets', url: '/budgets' },
        { action: 'ask', title: 'Ask Gullu', url: '/ask' },
      ],
    };
  }
  const left = b.limit - b.spent;
  return {
    kind: 'budget-warning',
    title: `${rupees(left)} left for ${b.category} ${emoji}`,
    body: `${b.daysLeft} day${b.daysLeft === 1 ? '' : 's'} to go this month. Pace yourself, champ.`,
    url: '/budgets',
    tag,
    actions: [{ action: 'budgets', title: 'See budgets', url: '/budgets' }],
  };
}

/** Duolingo-style nudge when nothing has been captured for a while (usually a broken Shortcut). */
export function quietPush(days: number, key: string): RichPush {
  return {
    kind: 'quiet',
    title: 'Gullak is hungry 🥺',
    body: pick(QUIET_LINES, key).replace('{days}', String(days)),
    url: '/setup',
    tag: 'quiet',
    requireInteraction: true,
    actions: [
      { action: 'setup', title: 'Check capture', url: '/setup' },
      { action: 'add', title: 'Add cash', url: '/add' },
    ],
  };
}

/** The evening one-liner: today's total and where most of it went. `streak` = days in a row with a diary. */
export function diaryPush(d: { date: string; spent: number; topName?: string | null; topCategory?: string | null; streak?: number }): RichPush {
  const tag = `diary-${d.date}`;
  if (d.spent <= 0) {
    return {
      kind: 'daily-diary',
      title: 'A no-spend day 🌱',
      body: d.streak && d.streak > 1 ? `${d.streak} days of Gullak diaries in a row. The sprout is growing.` : 'Zero rupees out today. The sprout approves.',
      url: '/',
      tag,
    };
  }
  const emoji = d.topCategory ? (CATEGORY_EMOJI[d.topCategory] ?? '🪙') : '🪙';
  const most = d.topName ? `, mostly ${d.topName}` : '';
  return {
    kind: 'daily-diary',
    title: `${rupees(d.spent)} today${most} ${emoji}`,
    body: d.streak && d.streak > 1 ? `Day ${d.streak} of your money diary. Tap for the full day.` : 'Your money diary for today. Tap for the full day.',
    url: '/activity',
    tag,
    actions: [{ action: 'activity', title: 'See today', url: '/activity' }],
  };
}

/** A Gullak Jar passing 25 / 50 / 75 / 100%. */
export function jarPush(j: { id: string; name: string; emoji?: string | null; percent: 25 | 50 | 75 | 100; left: number }): RichPush {
  const icon = j.emoji ?? '🫙';
  const url = `/jar?id=${j.id}`;
  if (j.percent === 100) {
    return {
      kind: 'jar-milestone',
      title: `${j.name} jar is full! ${icon}`,
      body: 'Every coin made it. Go enjoy it, you earned this one.',
      url,
      tag: `jar-${j.id}`,
      requireInteraction: true,
      actions: [{ action: 'open', title: 'Celebrate', url }],
    };
  }
  return {
    kind: 'jar-milestone',
    title: `${j.name} jar is ${j.percent}% full ${icon}`,
    body: `${rupees(j.left)} to go. Keep dropping coins in.`,
    url,
    tag: `jar-${j.id}`,
    actions: [{ action: 'open', title: 'See jar', url }],
  };
}

/** A repeating payment expected tomorrow. */
export function subscriptionPush(s: { name: string; amount: number; key: string }): RichPush {
  return {
    kind: 'subscription-due',
    title: `${s.name} will take ${rupees(s.amount)} tomorrow 🔁`,
    body: 'Still using it? Now is the moment to cancel if not.',
    url: '/subscriptions',
    tag: `sub-${s.key}`,
    actions: [{ action: 'subs', title: 'See repeats', url: '/subscriptions' }],
  };
}

/** After an Android first-run import of past SMS. */
export function importPush(saved: number, review: number): RichPush {
  return {
    kind: 'import-done',
    title: `${saved} payment${saved === 1 ? '' : 's'} moved in 📦`,
    body: review
      ? `Gullak unpacked your past SMS. ${review} new payee${review === 1 ? '' : 's'} to introduce, one tap each.`
      : 'Gullak unpacked your past SMS. Your month is ready.',
    url: review ? '/review' : '/',
    tag: 'import',
    actions: review ? [{ action: 'review', title: 'Sort payees', url: '/review' }] : undefined,
  };
}
