// Runs on the laptop only: a made-up inbox, in-memory storage and a fake server. No real SMS, no network.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
const inbox: { address: string; body: string; date: number }[] = [];
const invoke = vi.fn();

vi.mock('react-native', () => ({ Platform: { OS: 'android' }, PermissionsAndroid: {} }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
  },
}));
vi.mock('../../modules/sms-inbox', () => ({
  SmsInbox: {
    readInbox: async (since: number, limit: number) => inbox.filter((m) => m.date > since).slice(0, limit),
  },
}));
vi.mock('./api', () => ({ supabase: { functions: { invoke } } }));

const { smsMark, startSms, syncSms } = await import('./sms');

const NOW = Date.UTC(2026, 10, 23, 12);
const DAY = 86_400_000;
const debit = (n: number) => `Sent Rs.${n}.00 From HDFC Bank A/C *1234 To SWIGGY On 23/11/26 Ref 5284612345${n}`;

/** What the fake server was sent, one entry per request. */
const sent = () => invoke.mock.calls.map(([, { body }]) => ({ backfill: body.backfill, texts: body.messages.map((m: { text: string }) => m.text) }));

beforeEach(() => {
  store.clear();
  inbox.length = 0;
  invoke.mockReset();
  invoke.mockImplementation(async (_fn: string, { body }: { body: { messages: unknown[] } }) => ({
    data: { saved: body.messages.length, duplicate: 0 },
    error: null,
  }));
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});

describe('SMS capture from now on', () => {
  it('reads nothing until it is turned on', async () => {
    inbox.push({ address: 'VM-HDFCBK', body: debit(10), date: NOW - DAY });
    expect(await syncSms('u1')).toEqual({ sent: 0, saved: 0, duplicate: 0 });
    expect(invoke).not.toHaveBeenCalled();
    expect(await smsMark('u1')).toBeNull();
  });

  it('never sends SMS that were on the phone before turning it on', async () => {
    inbox.push({ address: 'VM-HDFCBK', body: debit(10), date: NOW - 60_000 });
    await startSms('u1');
    expect(await syncSms('u1')).toEqual({ sent: 0, saved: 0, duplicate: 0 });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('sends only new bank payment SMS, never personal ones, and moves the mark', async () => {
    await startSms('u1');
    inbox.push(
      { address: 'VM-HDFCBK', body: debit(20), date: NOW + 1_000 },
      { address: '+919876543210', body: 'Paid you Rs.500 for dinner', date: NOW + 2_000 },
      { address: 'AD-AXISBK-S', body: 'Your OTP is 1234. Do not share.', date: NOW + 3_000 },
    );
    expect(await syncSms('u1')).toEqual({ sent: 1, saved: 1, duplicate: 0 });
    expect(sent()).toEqual([{ backfill: false, texts: [debit(20)] }]);
    expect(await smsMark('u1')).toBe(NOW + 3_000);

    // Opening the app again sends nothing twice.
    invoke.mockClear();
    expect(await syncSms('u1')).toEqual({ sent: 0, saved: 0, duplicate: 0 });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('keeps the real date of SMS from days the app was not opened', async () => {
    await startSms('u1');
    inbox.push({ address: 'VM-HDFCBK', body: debit(30), date: NOW + 1_000 });
    vi.setSystemTime(NOW + 5 * DAY);
    inbox.push({ address: 'VM-HDFCBK', body: debit(40), date: NOW + 5 * DAY - 1_000 });
    await syncSms('u1');
    expect(sent()).toEqual([
      { backfill: true, texts: [debit(30)] },
      { backfill: false, texts: [debit(40)] },
    ]);
  });

  it('stops at the failed batch so the next open retries it', async () => {
    await startSms('u1');
    inbox.push({ address: 'VM-HDFCBK', body: debit(50), date: NOW + 1_000 });
    invoke.mockResolvedValueOnce({ data: null, error: new Error('offline') });
    await expect(syncSms('u1')).rejects.toThrow('offline');
    expect(await smsMark('u1')).toBe(NOW);
    expect(await syncSms('u1')).toEqual({ sent: 1, saved: 1, duplicate: 0 });
  });

  it('keeps each account separate', async () => {
    await startSms('u1');
    expect(await smsMark('u2')).toBeNull();
  });
});
