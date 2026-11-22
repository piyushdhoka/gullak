import { describe, expect, it, vi } from 'vitest';

import {
  formatPush,
  normaliseReceivedAt,
  processCapture,
  type IngestDeps,
  type NewTransaction,
} from '../src/ingest-core.ts';

const HDFC = 'Sent Rs.250.00\nFrom HDFC Bank A/C *1234\nTo SWIGGY\nOn 11/10/26\nRef 528461234567\nNot You?';
const NOW = new Date('2026-11-21T10:00:00.000Z');

function fakeDeps(opts: { rule?: string; pushFails?: boolean } = {}) {
  const sms: Record<string, { status?: string; reason?: string | null }> = {};
  const txns = new Map<string, NewTransaction>();
  const pushes: unknown[] = [];
  let n = 0;
  const deps: IngestDeps = {
    insertSms: vi.fn(async () => {
      const id = `sms-${++n}`;
      sms[id] = {};
      return id;
    }),
    updateSms: vi.fn(async (id, patch) => {
      sms[id] = patch;
    }),
    getPayeeRule: vi.fn(async () => opts.rule ?? null),
    insertTransaction: vi.fn(async (row) => {
      if ([...txns.values()].some((t) => t.user_id === row.user_id && t.dedupe_key === row.dedupe_key)) return null;
      const id = `txn-${txns.size + 1}`;
      txns.set(id, row);
      return id;
    }),
    notify: vi.fn(async (_u, p) => {
      if (opts.pushFails) throw new Error('push down');
      pushes.push(p);
    }),
  };
  return { deps, sms, txns, pushes };
}

describe('processCapture', () => {
  it('saves a parsed SMS, asks the model and pushes', async () => {
    const { deps, sms, txns, pushes } = fakeDeps();
    deps.classify = vi.fn(async () => ({ category: 'Food', confidence: 0.91 }));
    const r = await processCapture(deps, { userId: 'u1', text: HDFC, receivedAt: '2026-11-21T09:59:00Z', now: NOW });
    expect(r.status).toBe('saved');
    expect([...txns.values()][0]).toMatchObject({
      amount: 250,
      direction: 'debit',
      category: 'Food',
      category_source: 'model',
      merchant: 'Swiggy',
      dedupe_key: 'upi:528461234567:debit',
      occurred_at: '2026-11-21T09:59:00.000Z',
    });
    expect(sms['sms-1'].status).toBe('parsed');
    expect(pushes).toHaveLength(1);
  });

  it('without a model, everything goes to review', async () => {
    const { deps, txns, pushes } = fakeDeps();
    await processCapture(deps, { userId: 'u1', text: HDFC, now: NOW });
    expect([...txns.values()][0]).toMatchObject({ category: 'Other', category_source: 'unknown' });
    expect(pushes[0]).toMatchObject({ url: '/review' });
  });

  it('marks the second copy of the same payment as duplicate', async () => {
    const { deps, sms, txns, pushes } = fakeDeps();
    await processCapture(deps, { userId: 'u1', text: HDFC, now: NOW });
    const r = await processCapture(deps, { userId: 'u1', text: HDFC, now: NOW });
    expect(r.status).toBe('duplicate');
    expect(txns.size).toBe(1);
    expect(sms['sms-2'].status).toBe('duplicate');
    expect(pushes).toHaveLength(1);
  });

  it("uses the owner's payee rule", async () => {
    const { deps, txns } = fakeDeps({ rule: 'Groceries' });
    await processCapture(deps, { userId: 'u1', text: HDFC, now: NOW });
    expect([...txns.values()][0].category).toBe('Groceries');
  });

  it('keeps ignored SMS with a reason and does not push', async () => {
    const { deps, sms, txns, pushes } = fakeDeps();
    const r = await processCapture(deps, { userId: 'u1', text: '123456 is your OTP for Rs 10', now: NOW });
    expect(r).toEqual({ status: 'ignored', reason: 'otp' });
    expect(sms['sms-1']).toEqual({ status: 'ignored', reason: 'otp' });
    expect(txns.size).toBe(0);
    expect(pushes).toHaveLength(0);
  });

  const UNKNOWN = 'Sent Rs.120.00\nFrom HDFC Bank A/C *1234\nTo SHREE GANESH ENTERPRISES\nOn 11/10/26\nRef 528461239999';

  const QR = 'Sent Rs.40.00\nFrom HDFC Bank A/C *1234\nTo paytmqr2810050501@paytm\nOn 11/10/26\nRef 528461238888';

  it("uses the owner's rule without asking the model", async () => {
    const { deps, txns } = fakeDeps({ rule: 'Health' });
    deps.classify = vi.fn(async () => ({ category: 'Food', confidence: 0.99 }));
    await processCapture(deps, { userId: 'u1', text: UNKNOWN, now: NOW });
    expect(deps.classify).not.toHaveBeenCalled();
    expect([...txns.values()][0]).toMatchObject({ category: 'Health', category_source: 'user' });
  });

  it('asks the model about QR payments too; a confident answer is used', async () => {
    const { deps, txns } = fakeDeps();
    deps.classify = vi.fn(async () => ({ category: 'Food', confidence: 0.8 }));
    await processCapture(deps, { userId: 'u1', text: QR, now: NOW });
    expect(deps.classify).toHaveBeenCalledTimes(1);
    expect([...txns.values()][0]).toMatchObject({ category: 'Food', category_source: 'model' });
  });

  it('ignores a low-confidence answer, and the threshold is configurable', async () => {
    const a = fakeDeps();
    a.deps.classify = vi.fn(async () => ({ category: 'Health', confidence: 0.41 }));
    await processCapture(a.deps, { userId: 'u1', text: UNKNOWN, now: NOW });
    expect([...a.txns.values()][0]).toMatchObject({ category: 'Other', category_source: 'unknown' });

    const b = fakeDeps();
    b.deps.classify = vi.fn(async () => ({ category: 'Health', confidence: 0.41 }));
    await processCapture(b.deps, { userId: 'u1', text: UNKNOWN, now: NOW, minConfidence: 0.4 });
    expect([...b.txns.values()][0].category).toBe('Health');
  });

  it('keeps it for review when the model fails or answers nonsense', async () => {
    const a = fakeDeps();
    a.deps.classify = vi.fn(async () => {
      throw new Error('timeout');
    });
    expect((await processCapture(a.deps, { userId: 'u1', text: UNKNOWN, now: NOW })).status).toBe('saved');
    expect([...a.txns.values()][0]).toMatchObject({ category: 'Other', category_source: 'unknown' });

    const b = fakeDeps();
    b.deps.classify = vi.fn(async () => ({ category: 'Snacks', confidence: 0.99 }));
    await processCapture(b.deps, { userId: 'u1', text: UNKNOWN, now: NOW });
    expect([...b.txns.values()][0].category).toBe('Other');
  });

  it('drops personal messages without storing them', async () => {
    const { deps, sms } = fakeDeps();
    const r = await processCapture(deps, { userId: 'u1', text: 'Reached home, call you in 10 min', now: NOW });
    expect(r.status).toBe('ignored');
    expect(deps.insertSms).not.toHaveBeenCalled();
    expect(Object.keys(sms)).toHaveLength(0);
  });

  it('a failing push does not lose the transaction', async () => {
    const { deps, txns } = fakeDeps({ pushFails: true });
    const r = await processCapture(deps, { userId: 'u1', text: HDFC, now: NOW });
    expect(r.status).toBe('saved');
    expect(txns.size).toBe(1);
  });
});

describe('normaliseReceivedAt', () => {
  it('falls back to now for missing, invalid, far-future or very old times', () => {
    expect(normaliseReceivedAt(null, NOW)).toBe(NOW.toISOString());
    expect(normaliseReceivedAt('not a date', NOW)).toBe(NOW.toISOString());
    expect(normaliseReceivedAt('2026-11-22T10:00:00Z', NOW)).toBe(NOW.toISOString());
    expect(normaliseReceivedAt('2026-10-01T10:00:00Z', NOW)).toBe(NOW.toISOString());
  });
});

describe('formatPush', () => {
  it('reads like an iOS notification', () => {
    const p = formatPush(
      {
        amount: 1250.5,
        direction: 'debit',
        merchant: 'Swiggy',
        category: 'Food',
        category_source: 'model',
        bank: 'HDFC Bank',
        account: '1234',
      } as NewTransaction,
      'abc',
    );
    expect(p.title).toBe('−₹1,250.50 · Swiggy');
    expect(p.body).toBe('Food · HDFC Bank •1234');
    expect(p.url).toBe('/transaction?id=abc');
  });
});
