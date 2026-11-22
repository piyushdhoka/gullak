import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../server/src/app.ts';
import { openDb } from '../server/src/db.ts';

const SWIGGY = 'Sent Rs.250.00\nFrom HDFC Bank A/C *1234\nTo SWIGGY\nOn 11/10/26\nRef 528461234567';
const QR = 'Sent Rs.40.00\nFrom HDFC Bank A/C *1234\nTo paytmqr2810050501@paytm\nOn 11/10/26\nRef 528461238888';
const QR_AGAIN = 'Sent Rs.60.00\nFrom HDFC Bank A/C *1234\nTo paytmqr2810050501@paytm\nOn 12/10/26\nRef 528461239999';

let app: ReturnType<typeof createApp>;
let pushes: unknown[];

beforeEach(() => {
  pushes = [];
  app = createApp({ db: openDb(':memory:'), push: async (_t, p) => void pushes.push(p) });
});

async function call(method: string, path: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const res = await app.request(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...opts.headers,
    },
    body: opts.body === undefined ? undefined : typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

async function owner() {
  const r = await call('POST', '/api/auth/signup', { body: { email: 'me@example.com', password: 'correct horse' } });
  expect(r.status).toBe(201);
  return r.body.token as string;
}

describe('config', () => {
  it('shares the Shortcut link only when one is set', async () => {
    expect((await call('GET', '/api/config')).body).toEqual({ shortcutUrl: null });
    app = createApp({ db: openDb(':memory:'), shortcutUrl: 'https://www.icloud.com/shortcuts/abc' });
    expect((await call('GET', '/api/config')).body).toEqual({ shortcutUrl: 'https://www.icloud.com/shortcuts/abc' });
  });
});

describe('auth', () => {
  it('first sign-up becomes the owner; a second sign-up is refused', async () => {
    expect((await call('GET', '/api/auth/status')).body).toEqual({ hasUser: false, signupOpen: true });
    await owner();
    expect((await call('GET', '/api/auth/status')).body).toEqual({ hasUser: true, signupOpen: false });
    const second = await call('POST', '/api/auth/signup', { body: { email: 'x@example.com', password: '12345678' } });
    expect(second.status).toBe(403);
  });

  it('logs in with the right password only, and logout ends the session', async () => {
    await owner();
    expect((await call('POST', '/api/auth/login', { body: { email: 'me@example.com', password: 'nope' } })).status).toBe(401);
    const ok = await call('POST', '/api/auth/login', { body: { email: 'ME@example.com', password: 'correct horse' } });
    expect(ok.status).toBe(200);
    expect((await call('GET', '/api/me', { token: ok.body.token })).body.email).toBe('me@example.com');
    await call('POST', '/api/auth/logout', { token: ok.body.token });
    expect((await call('GET', '/api/me', { token: ok.body.token })).status).toBe(401);
  });

  it('rejects malformed credentials cleanly instead of crashing', async () => {
    await owner();
    const r = await call('POST', '/api/auth/login', { body: { email: 'me@example.com', password: { value: 'x' } } });
    expect(r.status).toBe(401);
    expect((await call('POST', '/api/auth/login', { body: 'not json' })).status).toBe(401);
  });

  it('protects data endpoints', async () => {
    expect((await call('GET', '/api/transactions')).status).toBe(401);
    expect((await call('GET', '/api/transactions', { token: 'forged' })).status).toBe(401);
  });
});

describe('capture via the Shortcut', () => {
  it('rejects a missing or wrong capture key', async () => {
    expect((await call('POST', '/ingest', { body: { text: SWIGGY } })).status).toBe(401);
    expect((await call('POST', '/ingest', { body: { text: SWIGGY }, headers: { 'x-capture-key': 'cap_wrong' } })).status).toBe(401);
  });

  it('saves, de-duplicates and pushes; the app sees it', async () => {
    const token = await owner();
    const { body } = await call('POST', '/api/capture-key', { token });
    const headers = { 'x-capture-key': body.key as string };
    const sub = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p', auth: 'a' } };
    expect((await call('POST', '/api/push/subscribe', { token, body: sub })).status).toBe(200);
    expect((await call('POST', '/api/push/subscribe', { token, body: { endpoint: 'http://evil' } })).status).toBe(400);

    const first = await call('POST', '/ingest', { body: { text: SWIGGY, received_at: new Date().toISOString() }, headers });
    expect(first.body).toMatchObject({ status: 'saved', transaction: { category: 'Food', merchant: 'Swiggy' } });
    expect((await call('POST', '/ingest', { body: { text: SWIGGY }, headers })).body.status).toBe('duplicate');
    expect(pushes).toHaveLength(1);

    const list = await call('GET', '/api/transactions', { token });
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ amount: 250, hidden: false, category_source: 'merchant' });

    const key = await call('GET', '/api/capture-key', { token });
    expect(key.body.last_used_at).toBeTruthy();
  });

  it('accepts a plain-text body and drops personal messages without storing them', async () => {
    const token = await owner();
    const { body } = await call('POST', '/api/capture-key', { token });
    const headers = { 'x-capture-key': body.key as string, 'Content-Type': 'text/plain' };
    expect((await call('POST', '/ingest', { body: SWIGGY, headers })).body.status).toBe('saved');
    expect((await call('POST', '/ingest', { body: 'See you at 8?', headers })).body.status).toBe('ignored');
    expect((await call('GET', '/api/inbox', { token })).body).toHaveLength(0);
  });

  it('tolerates paste slips: auto-capitalised first letter, stray spaces and quotes', async () => {
    const token = await owner();
    const key = (await call('POST', '/api/capture-key', { token })).body.key as string;
    const messy = ` "${key.charAt(0).toUpperCase()}${key.slice(1, 20)} ${key.slice(20)}" `;
    const r = await call('POST', '/ingest', { body: { text: SWIGGY }, headers: { 'x-capture-key': messy } });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('saved');
  });

  it('accepts the key inside the address, so the Shortcut needs no header', async () => {
    const token = await owner();
    const key = (await call('POST', '/api/capture-key', { token })).body.key as string;
    const r = await call('POST', `/ingest/${key}`, { body: { text: SWIGGY } });
    expect(r.body.status).toBe('saved');
    expect((await call('POST', '/ingest/cap_wrong', { body: { text: SWIGGY } })).status).toBe(401);
  });

  it('a new key replaces the old one', async () => {
    const token = await owner();
    const a = (await call('POST', '/api/capture-key', { token })).body.key;
    const b = (await call('POST', '/api/capture-key', { token })).body.key;
    expect(a).not.toBe(b);
    expect((await call('POST', '/ingest', { body: { text: SWIGGY }, headers: { 'x-capture-key': a } })).status).toBe(401);
    expect((await call('POST', '/ingest', { body: { text: SWIGGY }, headers: { 'x-capture-key': b } })).status).toBe(200);
  });
});

describe('review: one tap per unknown payee', () => {
  it('groups unknown QR payments; one choice fixes the past and future', async () => {
    const token = await owner();
    const headers = { 'x-capture-key': (await call('POST', '/api/capture-key', { token })).body.key as string };
    await call('POST', '/ingest', { body: { text: QR }, headers });
    await call('POST', '/ingest', { body: { text: QR_AGAIN }, headers });

    const review = await call('GET', '/api/review', { token });
    expect(review.body).toEqual([
      expect.objectContaining({ key: 'paytmqr2810050501@paytm', count: 2, total: 100 }),
    ]);

    await call('POST', '/api/review', { token, body: { key: 'paytmqr2810050501@paytm', category: 'Food' } });
    expect((await call('GET', '/api/review', { token })).body).toHaveLength(0);
    const list = (await call('GET', '/api/transactions', { token })).body;
    expect(list.every((t: any) => t.category === 'Food' && t.category_source === 'user')).toBe(true);

    // Next payment to the same QR is categorised automatically.
    const next = 'Sent Rs.30.00\nFrom HDFC Bank A/C *1234\nTo paytmqr2810050501@paytm\nOn 13/10/26\nRef 528461230000';
    const r = await call('POST', '/ingest', { body: { text: next }, headers });
    expect(r.body.transaction).toMatchObject({ category: 'Food', category_source: 'user' });
  });

  it('changing one payment can re-apply to that payee', async () => {
    const token = await owner();
    const headers = { 'x-capture-key': (await call('POST', '/api/capture-key', { token })).body.key as string };
    await call('POST', '/ingest', { body: { text: QR }, headers });
    await call('POST', '/ingest', { body: { text: QR_AGAIN }, headers });
    const [t] = (await call('GET', '/api/transactions', { token })).body;
    const r = await call('POST', `/api/transactions/${t.id}/category`, { token, body: { category: 'Groceries', applyToPayee: true } });
    expect(r.body.changed).toBe(2);
    expect((await call('POST', `/api/transactions/${t.id}/category`, { token, body: { category: 'Snacks' } })).status).toBe(400);
  });
});

describe('edits are scoped to the owner', () => {
  it('note and hidden update, unknown ids 404', async () => {
    const token = await owner();
    const headers = { 'x-capture-key': (await call('POST', '/api/capture-key', { token })).body.key as string };
    await call('POST', '/ingest', { body: { text: SWIGGY }, headers });
    const [t] = (await call('GET', '/api/transactions', { token })).body;
    expect((await call('PATCH', `/api/transactions/${t.id}`, { token, body: { note: 'team lunch', hidden: true } })).status).toBe(200);
    const [after] = (await call('GET', '/api/transactions', { token })).body;
    expect(after).toMatchObject({ note: 'team lunch', hidden: true });
    expect((await call('PATCH', '/api/transactions/nope', { token, body: { hidden: false } })).status).toBe(404);
  });
});
