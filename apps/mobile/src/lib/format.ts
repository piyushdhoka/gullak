import type { Month } from './stats';
import type { Transaction } from './types';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function money(n: number, opts: { whole?: boolean } = {}) {
  return (opts.whole ? inrWhole : inr).format(n);
}

/** "−₹250.00" for spends, "+₹500.00" for money in. */
export function signedMoney(t: Pick<Transaction, 'amount' | 'direction'>) {
  return `${t.direction === 'debit' ? '−' : '+'}${money(t.amount)}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function monthName(m: Month, withYear = false) {
  return withYear ? `${MONTHS[m.month]} ${m.year}` : MONTHS[m.month];
}

export function shortMonth(m: Month) {
  return MONTHS[m.month].slice(0, 3);
}

export function time(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function dayLabel(date: Date, now = new Date()) {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return date.toLocaleDateString('en-IN', { weekday: 'long' });
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

export function fullDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function displayName(t: Transaction) {
  return t.merchant ?? t.payee ?? (t.direction === 'debit' ? 'Payment' : 'Money received');
}

export function accountLabel(t: Pick<Transaction, 'bank' | 'account'>) {
  return [t.bank, t.account ? `•${t.account}` : null].filter(Boolean).join(' ') || null;
}
