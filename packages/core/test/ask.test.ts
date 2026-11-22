import { describe, expect, it, vi } from 'vitest';

import { ask, openAICompatible, runTool, type AskData, type ChatFn } from '../src/ask.ts';
import type { Transaction } from '../src/types.ts';

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

const now = new Date('2026-11-22T12:00:00');
const data: AskData = {
  now,
  transactions: [
    t('2026-11-03T09:00:00', 20, { merchant: 'Sharma Tea Stall', category: 'Food' }),
    t('2026-11-05T09:00:00', 30, { payee: 'CHAI POINT', merchant: 'Chai Point', category: 'Food' }),
    t('2026-11-06T12:00:00', 450, { merchant: 'Swiggy', category: 'Food' }),
    t('2026-11-07T12:00:00', 999, { merchant: 'Hidden', category: 'Food', hidden: true }),
    t('2026-10-10T12:00:00', 2500, { merchant: 'IndiGo', category: 'Travel', note: 'Goa flights' }),
    t('2026-11-01T10:00:00', 65000, { direction: 'credit', merchant: 'Acme', category: 'Income' }),
  ],
  budgets: [{ category: 'Food', monthly_limit: 3000 }],
  jars: [{ id: 'j', name: 'Goa trip', emoji: null, target: 30000, target_date: '2027-03-22', created_at: '2026-11-01T00:00:00Z' }],
  jarEntries: [{ id: 'e', jar_id: 'j', amount: 5000, note: null, created_at: '2026-11-02T00:00:00Z' }],
};

describe('runTool', () => {
  it('spending: searches names and notes, skips hidden payments', () => {
    const chai = runTool('spending', { from: '2026-11-01', to: '2026-11-22', search: 'tea' }, data) as { spent: number; payments: number };
    expect(chai).toMatchObject({ spent: 20, payments: 1 });
    const food = runTool('spending', { from: '2026-11-01', to: '2026-11-22', category: 'Food' }, data) as { spent: number; received: number };
    expect(food.spent).toBe(500);
    const goa = runTool('spending', { from: '2026-10-01', to: '2026-10-31', search: 'goa' }, data) as { spent: number };
    expect(goa.spent).toBe(2500);
  });

  it('rejects bad dates instead of guessing', () => {
    expect(runTool('spending', { from: 'last week', to: 'today' }, data)).toEqual({ error: 'from and to must be dates like 2026-11-01' });
  });

  it('month summary, trend, budgets, jars and biggest payments', () => {
    expect(runTool('month_summary', { month: '2026-11' }, data)).toMatchObject({ month: '2026-11', spent: 500, received: 65000 });
    expect((runTool('trend', { months: 2 }, data) as { month: string }[]).map((p) => p.month)).toEqual(['2026-10', '2026-11']);
    expect(runTool('budgets', {}, data)).toEqual([expect.objectContaining({ category: 'Food', spent: 500, left: 2500 })]);
    expect(runTool('jars', {}, data)).toEqual([expect.objectContaining({ name: 'Goa trip', saved: 5000, target: 30000 })]);
    expect(runTool('biggest_payments', { from: '2026-10-01', to: '2026-11-22', limit: 1 }, data)).toEqual([
      { date: '2026-10-10', who: 'IndiGo', amount: 2500, category: 'Travel' },
    ]);
  });

  it('unknown tools return an error', () => {
    expect(runTool('drop_table', {}, data)).toEqual({ error: 'No tool called drop_table' });
  });
});

describe('ask loop', () => {
  it('calls tools, feeds results back, and returns the answer', async () => {
    const chat = vi.fn<ChatFn>(async (messages) => {
      if (!messages.some((m) => m.role === 'tool')) {
        return {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: 'c1', type: 'function', function: { name: 'spending', arguments: '{"from":"2026-11-01","to":"2026-11-22","search":"chai"}' } }],
        };
      }
      const result = JSON.parse(messages.find((m) => m.role === 'tool')!.content!);
      return { role: 'assistant', content: `You spent ₹${result.spent} on chai this month.` };
    });
    const r = await ask([{ role: 'user', content: 'How much on chai this month?' }], data, chat);
    expect(r).toEqual({ answer: 'You spent ₹30 on chai this month.', used: ['spending'] });
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it('never sends SMS text: tool results carry only totals and names', async () => {
    const seen: string[] = [];
    const chat: ChatFn = async (messages) => {
      seen.push(JSON.stringify(messages));
      return messages.some((m) => m.role === 'tool')
        ? { role: 'assistant', content: 'ok' }
        : { role: 'assistant', content: null, tool_calls: [{ id: 'c', type: 'function', function: { name: 'month_summary', arguments: '{"month":"2026-11"}' } }] };
    };
    await ask([{ role: 'user', content: 'November?' }], data, chat);
    expect(seen.join(' ')).not.toMatch(/sms_id|Sent Rs|A\/C/);
  });

  it('sends Gemini’s thought signature back with the tool call', async () => {
    const sig = { google: { thought_signature: 'abc' } };
    const seen: unknown[] = [];
    const chat: ChatFn = async (messages) => {
      seen.push(...messages);
      return messages.some((m) => m.role === 'tool')
        ? { role: 'assistant', content: 'ok' }
        : { role: 'assistant', content: null, tool_calls: [{ id: 'c', type: 'function', function: { name: 'trend', arguments: '{}' }, extra_content: sig }] };
    };
    await ask([{ role: 'user', content: 'trend?' }], data, chat);
    expect(seen).toContainEqual(expect.objectContaining({ role: 'assistant', tool_calls: [expect.objectContaining({ extra_content: sig })] }));
  });

  it('stops after a few tool rounds', async () => {
    const chat: ChatFn = vi.fn(async () => ({
      role: 'assistant' as const,
      content: 'still thinking',
      tool_calls: [{ id: 'c', type: 'function' as const, function: { name: 'trend', arguments: '{}' } }],
    }));
    const r = await ask([{ role: 'user', content: 'loop' }], data, chat);
    expect(chat).toHaveBeenCalledTimes(5);
    expect(r.answer).toBe('still thinking');
  });
});

describe('openAICompatible', () => {
  it('posts to /chat/completions with tools and reads the reply', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'hi' } }] }), { status: 200 }));
    const chat = openAICompatible({ baseUrl: 'https://example.test/v1/', apiKey: 'k', model: 'm', fetchFn: fetchFn as unknown as typeof fetch });
    expect(await chat([{ role: 'user', content: 'x' }], [] as never)).toEqual({ role: 'assistant', content: 'hi', tool_calls: undefined });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.test/v1/chat/completions');
    expect(JSON.parse(init.body as string)).toMatchObject({ model: 'm', tool_choice: 'auto' });
  });

  it('surfaces provider errors', async () => {
    const fetchFn = vi.fn(async () => new Response('no', { status: 429 }));
    const chat = openAICompatible({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', fetchFn: fetchFn as unknown as typeof fetch });
    await expect(chat([], [] as never)).rejects.toThrow('AI provider answered 429');
  });
});
