// Dashboard maths. Pure functions (no React, no aliases) so they can be unit-tested.

import type { Transaction } from './types';

export interface Month {
  year: number;
  /** 0–11 */
  month: number;
}

export function monthOf(date: Date): Month {
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function addMonths(m: Month, delta: number): Month {
  const d = new Date(m.year, m.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function sameMonth(a: Month, b: Month) {
  return a.year === b.year && a.month === b.month;
}

export function daysInMonth(m: Month) {
  return new Date(m.year, m.month + 1, 0).getDate();
}

export function inMonth(t: Transaction, m: Month) {
  const d = new Date(t.occurred_at);
  return d.getFullYear() === m.year && d.getMonth() === m.month;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function spentIn(txns: Transaction[], m: Month) {
  return round2(
    txns.filter((t) => !t.hidden && t.direction === 'debit' && inMonth(t, m)).reduce((s, t) => s + t.amount, 0),
  );
}

export interface CategoryTotal {
  category: string;
  amount: number;
  count: number;
  share: number;
}

export interface MerchantTotal {
  name: string;
  amount: number;
  count: number;
}

export interface MonthSummary {
  month: Month;
  spent: number;
  received: number;
  net: number;
  count: number;
  /** Days counted for the daily average: days so far for the current month, else the whole month. */
  daysCounted: number;
  dailyAverage: number;
  /** Projected month-end spend (current month only). */
  projected: number | null;
  lastMonthSpent: number;
  /** % change vs last month, comparing the same number of days for the current month. */
  changeVsLastMonth: number | null;
  /** Average monthly spend over the 3 months before this one that have any data. */
  averageMonth: number | null;
  byCategory: CategoryTotal[];
  topMerchants: MerchantTotal[];
  /** Spend per day of month, index 0 = day 1. */
  daily: number[];
  biggest: Transaction | null;
}

export function summarize(all: Transaction[], month: Month, now: Date = new Date()): MonthSummary {
  const txns = all.filter((t) => !t.hidden && inMonth(t, month));
  const debits = txns.filter((t) => t.direction === 'debit');
  const credits = txns.filter((t) => t.direction === 'credit');

  const spent = round2(debits.reduce((s, t) => s + t.amount, 0));
  const received = round2(credits.reduce((s, t) => s + t.amount, 0));

  const isCurrent = sameMonth(month, monthOf(now));
  const dim = daysInMonth(month);
  const daysCounted = isCurrent ? now.getDate() : dim;
  const dailyAverage = daysCounted ? round2(spent / daysCounted) : 0;
  const projected = isCurrent ? round2(dailyAverage * dim) : null;

  const prev = addMonths(month, -1);
  const lastMonthSpent = spentIn(all, prev);
  let comparable = lastMonthSpent;
  if (isCurrent) {
    // Compare like with like: last month's first N days.
    comparable = round2(
      all
        .filter((t) => !t.hidden && t.direction === 'debit' && inMonth(t, prev))
        .filter((t) => new Date(t.occurred_at).getDate() <= daysCounted)
        .reduce((s, t) => s + t.amount, 0),
    );
  }
  const changeVsLastMonth = comparable > 0 ? Math.round(((spent - comparable) / comparable) * 100) : null;

  const earlier = [1, 2, 3].map((i) => spentIn(all, addMonths(month, -i))).filter((v) => v > 0);
  const averageMonth = earlier.length ? round2(earlier.reduce((s, v) => s + v, 0) / earlier.length) : null;

  const cat = new Map<string, { amount: number; count: number }>();
  const mer = new Map<string, MerchantTotal>();
  const daily = new Array<number>(dim).fill(0);
  let biggest: Transaction | null = null;
  for (const t of debits) {
    const c = cat.get(t.category) ?? { amount: 0, count: 0 };
    c.amount += t.amount;
    c.count += 1;
    cat.set(t.category, c);

    const name = t.merchant ?? t.payee ?? 'Unknown';
    const m = mer.get(name) ?? { name, amount: 0, count: 0 };
    m.amount += t.amount;
    m.count += 1;
    mer.set(name, m);

    daily[new Date(t.occurred_at).getDate() - 1] += t.amount;
    if (!biggest || t.amount > biggest.amount) biggest = t;
  }

  const byCategory = [...cat.entries()]
    .map(([category, v]) => ({
      category,
      amount: round2(v.amount),
      count: v.count,
      share: spent ? v.amount / spent : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topMerchants = [...mer.values()]
    .map((m) => ({ ...m, amount: round2(m.amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    month,
    spent,
    received,
    net: round2(received - spent),
    count: txns.length,
    daysCounted,
    dailyAverage,
    projected,
    lastMonthSpent,
    changeVsLastMonth,
    averageMonth,
    byCategory,
    topMerchants,
    daily: daily.map(round2),
    biggest,
  };
}

/** Groups transactions (newest first) by local calendar day. */
export function groupByDay(txns: Transaction[]): { day: string; date: Date; items: Transaction[]; spent: number }[] {
  const sorted = [...txns].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const groups: { day: string; date: Date; items: Transaction[]; spent: number }[] = [];
  for (const t of sorted) {
    const d = new Date(t.occurred_at);
    const day = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let g = groups[groups.length - 1];
    if (!g || g.day !== day) {
      g = { day, date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), items: [], spent: 0 };
      groups.push(g);
    }
    g.items.push(t);
    if (t.direction === 'debit' && !t.hidden) g.spent = round2(g.spent + t.amount);
  }
  return groups;
}
