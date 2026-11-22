import { describe, expect, it } from 'vitest';

import { jarPlan, type Jar, type JarEntry } from '../src/jars.ts';
import type { Transaction } from '../src/types.ts';

let n = 0;
function t(date: string, amount: number, category: string): Transaction {
  return {
    id: `t${++n}`,
    occurred_at: new Date(date).toISOString(),
    amount,
    direction: 'debit',
    payee: null,
    payee_key: null,
    merchant: 'Shop',
    vpa: null,
    category,
    category_source: 'merchant',
    bank: null,
    account: null,
    upi_ref: null,
    channel: 'upi',
    source: 'sms',
    note: null,
    hidden: false,
    sms_id: null,
  };
}

const now = new Date('2026-11-22T12:00:00');
const goa: Jar = { id: 'j1', name: 'Goa trip', emoji: '🏖️', target: 30000, target_date: '2027-03-22', created_at: '2026-11-22T00:00:00Z' };
const put = (amount: number, id = 'e'): JarEntry => ({ id, jar_id: 'j1', amount, note: null, created_at: '2026-11-22T00:00:00Z' });

// Food ₹6,000/month and Shopping ₹2,000/month over Aug–Oct.
const history = ['2026-08-10', '2026-09-10', '2026-10-10'].flatMap((d) => [t(`${d}T12:00:00`, 6000, 'Food'), t(`${d}T13:00:00`, 2000, 'Shopping')]);

describe('jarPlan', () => {
  it('works out what is left, per week and per month', () => {
    const p = jarPlan(goa, [put(6000)], history, now);
    expect(p).toMatchObject({ saved: 6000, left: 24000, progress: 0.2, status: 'on_track' });
    expect(p.daysLeft).toBe(121);
    expect(p.perWeek).toBeCloseTo(24000 / (121 / 7), 0);
    expect(p.perMonth).toBeCloseTo(24000 / (121 / 30.4), 0);
  });

  it('nudges the biggest flexible category, never more than 30% of it', () => {
    const p = jarPlan(goa, [], history, now);
    expect(p.nudge).toMatchObject({ category: 'Food', usual: 6000, cut: 1800 });
    expect(p.nudge?.text).toMatch(/₹1,800 less on food each month \(usually ₹6,000\) covers \d+% of what Goa trip needs/);
  });

  it('says it is covered when a small cut is enough', () => {
    const small: Jar = { ...goa, target: 2000 };
    expect(jarPlan(small, [], history, now).nudge?.text).toMatch(/less on food each month \(you usually spend ₹6,000\) and Goa trip is covered/);
  });

  it('flags a jar that has fallen behind its even pace', () => {
    const started: Jar = { ...goa, created_at: '2026-09-22T00:00:00Z' };
    expect(jarPlan(started, [put(1000)], history, now).status).toBe('behind');
    expect(jarPlan(started, [put(12000)], history, now).status).toBe('on_track');
  });

  it('handles done, no deadline, overdue, withdrawals and no spending history', () => {
    expect(jarPlan(goa, [put(30000)], history, now)).toMatchObject({ status: 'done', progress: 1, left: 0 });
    expect(jarPlan({ ...goa, target_date: null }, [put(5000)], history, now)).toMatchObject({ status: 'no_date', left: 25000 });
    expect(jarPlan({ ...goa, target_date: '2026-11-01' }, [], history, now).status).toBe('overdue');
    expect(jarPlan(goa, [put(10000, 'a'), put(-4000, 'b')], history, now).saved).toBe(6000);
    expect(jarPlan(goa, [], [], now).nudge).toBeNull();
  });
});
