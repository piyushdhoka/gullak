// Gullak Jars: savings goals ("Goa trip, ₹30,000 by March") with a plan and a nudge from real spending.
// Pure functions, shared by the apps and Ask Gullak. An AI provider can later reword the nudge; the
// numbers always come from here.

import { addMonths, monthOf, type Month } from './stats.ts';
import type { Transaction } from './types.ts';

export interface Jar {
  id: string;
  name: string;
  emoji: string | null;
  target: number;
  /** YYYY-MM-DD, or null for "no deadline". */
  target_date: string | null;
  created_at: string;
}

export interface JarEntry {
  id: string;
  jar_id: string;
  /** Positive = put in, negative = taken out. */
  amount: number;
  note: string | null;
  created_at: string;
}

export interface Nudge {
  category: string;
  /** What you usually spend on it per month (last 3 full months). */
  usual: number;
  /** Suggested monthly cut. */
  cut: number;
  text: string;
}

export interface JarPlan {
  saved: number;
  left: number;
  /** 0–1. */
  progress: number;
  daysLeft: number | null;
  perWeek: number | null;
  perMonth: number | null;
  status: 'done' | 'on_track' | 'behind' | 'no_date' | 'overdue';
  /** Where the jar "should" be today if filled evenly from creation to deadline. */
  expectedByNow: number | null;
  nudge: Nudge | null;
}

/** Categories people can usually trim; essentials (bills, health, groceries) are never suggested. */
export const FLEXIBLE = ['Food', 'Shopping', 'Entertainment', 'Travel', 'Other'] as const;

const DAY = 86_400_000;
const round = (n: number) => Math.round(n * 100) / 100;
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

function parseDay(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59);
}

function inMonth(t: Transaction, m: Month) {
  const d = new Date(t.occurred_at);
  return d.getFullYear() === m.year && d.getMonth() === m.month;
}

/** Average monthly spend per flexible category over the 3 full months before `now`. */
export function usualFlexibleSpend(txns: Transaction[], now: Date): { category: string; usual: number }[] {
  const months = [1, 2, 3].map((i) => addMonths(monthOf(now), -i));
  return FLEXIBLE.map((category) => {
    const total = txns
      .filter((t) => !t.hidden && t.direction === 'debit' && t.category === category && months.some((m) => inMonth(t, m)))
      .reduce((s, t) => s + t.amount, 0);
    return { category, usual: round(total / 3) };
  })
    .filter((c) => c.usual > 0)
    .sort((a, b) => b.usual - a.usual);
}

export function jarPlan(jar: Jar, entries: JarEntry[], txns: Transaction[], now: Date = new Date()): JarPlan {
  const saved = round(entries.filter((e) => e.jar_id === jar.id).reduce((s, e) => s + Number(e.amount), 0));
  const target = Number(jar.target);
  const left = round(Math.max(0, target - saved));
  const progress = target > 0 ? Math.min(1, Math.max(0, saved / target)) : 0;

  if (left === 0) return { saved, left, progress: 1, daysLeft: null, perWeek: null, perMonth: null, status: 'done', expectedByNow: null, nudge: null };

  if (!jar.target_date) {
    return { saved, left, progress, daysLeft: null, perWeek: null, perMonth: null, status: 'no_date', expectedByNow: null, nudge: null };
  }

  const end = parseDay(jar.target_date);
  const msLeft = end.getTime() - now.getTime();
  if (msLeft <= 0) {
    return { saved, left, progress, daysLeft: 0, perWeek: null, perMonth: null, status: 'overdue', expectedByNow: target, nudge: null };
  }

  const daysLeft = Math.ceil(msLeft / DAY);
  const perWeek = round(left / Math.max(1, daysLeft / 7));
  const perMonth = round(left / Math.max(1, daysLeft / 30.4));

  const start = new Date(jar.created_at).getTime();
  const total = Math.max(DAY, end.getTime() - start);
  const expectedByNow = round(target * Math.min(1, Math.max(0, (now.getTime() - start) / total)));
  const status = saved + 1 >= expectedByNow * 0.9 ? 'on_track' : 'behind';

  const flexible = usualFlexibleSpend(txns, now);
  let nudge: Nudge | null = null;
  if (flexible.length) {
    const top = flexible[0];
    // Never suggest cutting more than 30% of a category; round to a friendly ₹50.
    const cut = Math.max(50, Math.round(Math.min(perMonth, top.usual * 0.3) / 50) * 50);
    const covers = Math.min(100, Math.round((cut / perMonth) * 100));
    const label = top.category === 'Other' ? 'miscellaneous spends' : top.category.toLowerCase();
    nudge = {
      category: top.category,
      usual: top.usual,
      cut,
      text:
        covers >= 100
          ? `Spend about ${inr.format(cut)} less on ${label} each month (you usually spend ${inr.format(top.usual)}) and ${jar.name} is covered.`
          : `Spending ${inr.format(cut)} less on ${label} each month (usually ${inr.format(top.usual)}) covers ${covers}% of what ${jar.name} needs.`,
    };
  }

  return { saved, left, progress, daysLeft, perWeek, perMonth, status, expectedByNow, nudge };
}
