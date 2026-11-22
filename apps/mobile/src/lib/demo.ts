// Sample data shown when Supabase isn't connected yet, so the UI can be tried out.

import type { SmsMessage, Transaction } from './types';

const SPENDS: [string, string, number, number][] = [
  // merchant, category, min, max
  ['Swiggy', 'Food', 180, 650],
  ['Zomato', 'Food', 220, 700],
  ['Chai Point', 'Food', 40, 120],
  ['Blinkit', 'Groceries', 150, 900],
  ['Zepto', 'Groceries', 120, 600],
  ['Uber', 'Transport', 90, 420],
  ['Rapido', 'Transport', 40, 160],
  ['Amazon', 'Shopping', 300, 2500],
  ['Myntra', 'Shopping', 600, 2200],
  ['Airtel', 'Bills', 299, 299],
  ['Netflix', 'Entertainment', 499, 499],
  ['Apollo', 'Health', 150, 800],
  ['Rahul K', 'Transfers', 100, 1500],
];

function rand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function demoTransactions(now = new Date()): Transaction[] {
  const out: Transaction[] = [];
  let id = 0;
  const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    const perDay = 1 + Math.floor(rand(d.getTime() / 8.64e7) * 3);
    for (let i = 0; i < perDay; i++) {
      const r = rand(d.getTime() / 1e6 + i * 7.1);
      const [merchant, category, min, max] = SPENDS[Math.floor(r * SPENDS.length)];
      const when = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9 + Math.floor(rand(r * 99) * 13), Math.floor(rand(r * 7) * 60));
      if (when > now) continue;
      const amount = Math.round((min + rand(r * 31) * (max - min)) * (min === max ? 1 : 1)) || min;
      out.push(row(`demo-${++id}`, when, amount, 'debit', merchant, category));
    }
    // Small QR-code shops: unknown payees that go to Review.
    if (rand(d.getTime() / 3e7) > 0.7) {
      const qr = ['paytmqr2810050501', 'Q482915273', 'bharatpe0981234567'][Math.floor(rand(d.getTime() / 5e7) * 3)];
      const when = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 30);
      if (when <= now) {
        const t = row(`demo-${++id}`, when, 20 + Math.round(rand(d.getTime() / 7e7) * 80), 'debit', qr, 'Other');
        out.push({ ...t, merchant: null, payee: qr, vpa: `${qr.toLowerCase()}@paytm`, payee_key: `${qr.toLowerCase()}@paytm`, category_source: 'unknown' });
      }
    }
    if (d.getDate() === 1) {
      out.push(row(`demo-${++id}`, new Date(d.getFullYear(), d.getMonth(), 1, 10), 85000, 'credit', 'Acme Technologies', 'Income'));
    }
  }
  return out.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

function row(
  id: string,
  when: Date,
  amount: number,
  direction: 'debit' | 'credit',
  merchant: string,
  category: string,
): Transaction {
  const vpa = category === 'Transfers' ? 'rahul.k@okicici' : `${merchant.toLowerCase().replace(/\W/g, '')}@ybl`;
  return {
    id,
    occurred_at: when.toISOString(),
    amount,
    direction,
    payee: merchant.toUpperCase(),
    payee_key: vpa,
    merchant,
    vpa: direction === 'debit' ? vpa : null,
    category,
    category_source: category === 'Income' || category === 'Transfers' ? 'heuristic' : 'merchant',
    bank: 'HDFC Bank',
    account: '1234',
    upi_ref: String(500000000000 + Math.floor(rand(when.getTime()) * 99999999999)),
    channel: direction === 'debit' ? 'upi' : 'netbanking',
    source: 'sms',
    note: null,
    hidden: false,
    sms_id: null,
  };
}

export const demoInbox: SmsMessage[] = [
  {
    id: 'demo-sms-1',
    body: 'Your A/c XX1234 has been debited for an e-mandate. Call 1800 if not you. -HDFC Bank',
    received_at: new Date().toISOString(),
    status: 'unrecognised',
    reason: 'no amount',
  },
];

/** Sample monthly limits for demo mode. */
export const demoBudgets: { category: string; monthly_limit: number }[] = [
  { category: 'Food', monthly_limit: 6000 },
  { category: 'Groceries', monthly_limit: 5000 },
  { category: 'Shopping', monthly_limit: 4000 },
];

/** Sample savings goals for demo mode. */
export const demoJars = [
  { id: 'demo-goa', name: 'Goa trip', emoji: '🏖️', target: 30000, target_date: new Date(new Date().getFullYear(), new Date().getMonth() + 4, 15).toISOString().slice(0, 10), created_at: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString() },
  { id: 'demo-phone', name: 'New phone', emoji: '📱', target: 45000, target_date: null, created_at: new Date().toISOString() },
];

export const demoJarEntries = [
  { id: 'demo-e1', jar_id: 'demo-goa', amount: 5000, note: 'Start', created_at: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 2).toISOString() },
  { id: 'demo-e2', jar_id: 'demo-goa', amount: 3000, note: null, created_at: new Date().toISOString() },
  { id: 'demo-e3', jar_id: 'demo-phone', amount: 12000, note: null, created_at: new Date().toISOString() },
];
