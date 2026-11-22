import { describe, expect, it } from 'vitest';

import { budgetProgress, groupByDay, recurringPayments, summarize, trend } from '../src/lib/stats.ts';
import type { Transaction } from '../src/lib/types.ts';

let n = 0;
function t(date: string, amount: number, extra: Partial<Transaction> = {}): Transaction {
  return {
    id: `t${++n}`,
    occurred_at: new Date(date).toISOString(),
    amount,
    direction: 'debit',
    payee: null,
    payee_key: null,
    merchant: 'Shop',
    vpa: null,
    category: 'Other',
    category_source: 'merchant',
    bank: null,
    account: null,
    upi_ref: null,
    channel: 'upi',
    source: 'sms',
    note: null,
    hidden: false,
    sms_id: null,
    ...extra,
  };
}

const NOW = new Date(2026, 10, 10, 12); // 10 Nov 2026, local time
const NOV = { year: 2026, month: 10 };

const data: Transaction[] = [
  t('2026-11-02T10:00:00', 300, { category: 'Food', merchant: 'Swiggy' }),
  t('2026-11-05T10:00:00', 700, { category: 'Shopping', merchant: 'Amazon' }),
  t('2026-11-05T18:00:00', 200, { category: 'Food', merchant: 'Swiggy' }),
  t('2026-11-06T10:00:00', 5000, { direction: 'credit', category: 'Income' }),
  t('2026-11-07T10:00:00', 999, { hidden: true }),
  // October: 600 in the first 10 days, 1400 total
  t('2026-10-03T10:00:00', 600),
  t('2026-10-20T10:00:00', 800),
  // September and August
  t('2026-09-10T10:00:00', 1000),
  t('2026-08-10T10:00:00', 1600),
];

describe('summarize', () => {
  const s = summarize(data, NOV, NOW);

  it('totals spend and income, skipping hidden rows', () => {
    expect(s.spent).toBe(1200);
    expect(s.received).toBe(5000);
    expect(s.net).toBe(3800);
    expect(s.count).toBe(4);
  });

  it('daily average uses days so far in the current month, and projects month end', () => {
    expect(s.daysCounted).toBe(10);
    expect(s.dailyAverage).toBe(120);
    expect(s.projected).toBe(3600);
  });

  it('compares with the same days of last month', () => {
    expect(s.lastMonthSpent).toBe(1400);
    expect(s.changeVsLastMonth).toBe(100); // 1200 vs 600
  });

  it('averages the previous 3 months', () => {
    expect(s.averageMonth).toBe(1333.33); // (1400 + 1000 + 1600) / 3
  });

  it('breaks down by category and merchant', () => {
    expect(s.byCategory.map((c) => [c.category, c.amount])).toEqual([
      ['Shopping', 700],
      ['Food', 500],
    ]);
    expect(s.topMerchants[0]).toEqual({ name: 'Amazon', amount: 700, count: 1 });
    expect(s.topMerchants[1]).toEqual({ name: 'Swiggy', amount: 500, count: 2 });
    expect(s.daily[4]).toBe(900);
    expect(s.biggest?.amount).toBe(700);
  });

  it('a past month uses all its days and has no projection', () => {
    const oct = summarize(data, { year: 2026, month: 9 }, NOW);
    expect(oct.daysCounted).toBe(31);
    expect(oct.projected).toBeNull();
    expect(oct.changeVsLastMonth).toBe(40); // 1400 vs 1000
  });
});

describe('groupByDay', () => {
  it('groups newest first with day spend', () => {
    const g = groupByDay(data.filter((x) => x.occurred_at.startsWith('2026-11')));
    expect(g[0].items[0].amount).toBe(999);
    const fifth = g.find((x) => x.date.getDate() === 5)!;
    expect(fifth.items).toHaveLength(2);
    expect(fifth.spent).toBe(900);
  });
});

describe('trend', () => {
  it('gives spent and received for each month, oldest first', () => {
    const all = [
      t('2026-09-03T10:00:00', 100),
      t('2026-10-03T10:00:00', 200),
      t('2026-10-04T10:00:00', 500, { direction: 'credit' }),
      t('2026-11-03T10:00:00', 50, { hidden: true }),
    ];
    const r = trend(all, { year: 2026, month: 10 }, 3);
    expect(r.map((p) => [p.month.month, p.spent, p.received])).toEqual([
      [8, 100, 0],
      [9, 200, 500],
      [10, 0, 0],
    ]);
  });
});

describe('recurringPayments', () => {
  const now = new Date('2026-11-21T12:00:00');
  const netflix = (d: string, amt = 649) => t(d, amt, { payee_key: 'netflix@icici', merchant: 'Netflix', category: 'Entertainment' });

  it('finds a monthly subscription and predicts the next date', () => {
    const r = recurringPayments([netflix('2026-08-12T09:00:00'), netflix('2026-09-12T09:00:00'), netflix('2026-10-12T09:00:00')], now);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: 'Netflix', amount: 649, months: 3, category: 'Entertainment' });
    expect(r[0].next.getMonth()).toBe(10);
    expect(r[0].next.getDate()).toBe(12);
  });

  it('ignores payees paid many times a month, varying amounts, or fewer than 3 months', () => {
    const shop = ['2026-08-01', '2026-08-05', '2026-08-09', '2026-09-02', '2026-09-08', '2026-10-01'].map((d) =>
      t(`${d}T12:00:00`, 300, { payee_key: 'swiggy@icici' }),
    );
    const wobbly = ['2026-08-10', '2026-09-10', '2026-10-10'].map((d, i) => t(`${d}T12:00:00`, [100, 900, 2500][i], { payee_key: 'x@y' }));
    const twice = [netflix('2026-09-12T09:00:00'), netflix('2026-10-12T09:00:00')];
    expect(recurringPayments([...shop, ...wobbly, ...twice], now)).toEqual([]);
  });

  it('counts cash payments added by hand under the same name', () => {
    const rent = ['2026-08-01', '2026-09-01', '2026-10-01'].map((d) => t(`${d}T09:00:00`, 15000, { source: 'manual', merchant: 'Rent' }));
    expect(recurringPayments(rent, now)[0]).toMatchObject({ name: 'Rent', amount: 15000 });
  });

  it('skips hidden payments', () => {
    const r = recurringPayments(
      ['2026-08-12', '2026-09-12', '2026-10-12'].map((d, i) => ({ ...netflix(`${d}T09:00:00`), hidden: i === 0 })),
      now,
    );
    expect(r).toEqual([]);
  });
});

describe('budgetProgress', () => {
  it('shows spend against each limit and warns when on pace to go over', () => {
    const now = new Date('2026-11-10T12:00:00');
    const s = summarize(
      [t('2026-11-02T10:00:00', 3000, { category: 'Food' }), t('2026-11-05T10:00:00', 500, { category: 'Bills' })],
      { year: 2026, month: 10 },
      now,
    );
    const r = budgetProgress(s, [
      { category: 'Food', monthly_limit: 6000 },
      { category: 'Bills', monthly_limit: 5000 },
      { category: 'Travel', monthly_limit: 2000 },
    ]);
    expect(r[0]).toMatchObject({ category: 'Food', spent: 3000, limit: 6000, used: 0.5, left: 3000, onPaceToExceed: true });
    expect(r.find((b) => b.category === 'Bills')).toMatchObject({ spent: 500, onPaceToExceed: false });
    expect(r.find((b) => b.category === 'Travel')).toMatchObject({ spent: 0, used: 0 });
  });
});
