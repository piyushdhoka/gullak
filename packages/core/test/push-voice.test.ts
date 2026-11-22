import { describe, expect, it } from 'vitest';

import { budgetPush, diaryPush, jarPush, paymentPush, pick, quietPush, rupees } from '../src/push-voice.ts';

const base = { id: 'abc', amount: 249, direction: 'debit' as const, merchant: 'Swiggy', category: 'Food', category_source: 'model' };

describe('push voice', () => {
  it('formats rupees without stray paise', () => {
    expect(rupees(1250)).toBe('₹1,250');
    expect(rupees(1250.5)).toBe('₹1,250.50');
  });

  it('picks the same line for the same key', () => {
    expect(pick(['a', 'b', 'c'], 'x1')).toBe(pick(['a', 'b', 'c'], 'x1'));
  });

  it('puts the fact in the title and opens the payment', () => {
    const p = paymentPush(base);
    expect(p.kind).toBe('payment');
    expect(p.title).toBe('₹249 at Swiggy 🍔');
    expect(p.url).toBe('/transaction?id=abc');
    expect(p.actions?.map((a) => a.title)).toEqual(['Change category', 'My month']);
  });

  it('sends unknown payees to Review', () => {
    const p = paymentPush({ ...base, merchant: null, payee: 'RAJU KIRANA', category_source: 'unknown' });
    expect(p.kind).toBe('new-payee');
    expect(p.title).toBe('₹249 to RAJU KIRANA 🤔');
    expect(p.url).toBe('/review');
  });

  it('flags big spends', () => {
    expect(paymentPush({ ...base, amount: 12000 }).kind).toBe('big-spend');
  });

  it('celebrates money in', () => {
    const p = paymentPush({ ...base, direction: 'credit', merchant: 'ACME PAYROLL', amount: 45000 });
    expect(p.title).toBe('+₹45,000 from ACME PAYROLL 💰');
  });

  it('warns before a budget bursts and shouts after', () => {
    const warn = budgetPush({ category: 'Food', limit: 5000, spent: 4200, daysLeft: 9, month: '2026-11' });
    expect(warn.title).toBe('₹800 left for Food 🍔');
    const over = budgetPush({ category: 'Food', limit: 5000, spent: 5600, daysLeft: 1, month: '2026-11' });
    expect(over.kind).toBe('budget-over');
    expect(over.body).toContain('₹600 over, 1 day to go');
    expect(over.requireInteraction).toBe(true);
  });

  it('nudges when capture goes quiet', () => {
    const q = quietPush(3, '2026-11-22');
    expect(q.body).toContain('3 days');
    expect(q.url).toBe('/setup');
  });

  it('writes the evening diary', () => {
    expect(diaryPush({ date: '2026-11-22', spent: 640, topName: 'Zepto', topCategory: 'Groceries' }).title).toBe(
      '₹640 today, mostly Zepto 🛒',
    );
    expect(diaryPush({ date: '2026-11-22', spent: 0 }).title).toBe('A no-spend day 🌱');
  });

  it('marks jar milestones', () => {
    expect(jarPush({ id: 'j1', name: 'Goa', emoji: '🏖️', percent: 50, left: 15000 }).title).toBe('Goa jar is 50% full 🏖️');
  });
});
