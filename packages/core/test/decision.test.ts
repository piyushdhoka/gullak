import { describe, expect, it, vi } from 'vitest';

import { categoryOdds, decisionClassifier, decisionInput, DECISION_URL } from '../src/decision.ts';

function reply(probabilities: Record<string, number>, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify({ answers: { category: { type: 'choice', probabilities } } }), { status }));
}

describe('decisionInput', () => {
  it('sends only the payee, UPI ID and direction', () => {
    const text = decisionInput({ payee: 'SHREE GANESH MEDICAL', vpa: 'sgmedical@ybl', direction: 'debit' });
    expect(text).toContain('SHREE GANESH MEDICAL');
    expect(text).toContain('sgmedical@ybl');
    expect(text).not.toMatch(/A\/c|Avl Bal|XX\d/);
  });
});

describe('categoryOdds', () => {
  it('posts a choice question and returns categories, most likely first', async () => {
    const fetchFn = reply({ Health: 0.86, Groceries: 0.12, Other: 0.02 });
    const odds = await categoryOdds({ payee: 'Ganesh Medical', vpa: null, direction: 'debit' }, { apiKey: 'k', fetchFn: fetchFn as unknown as typeof fetch });
    expect(odds).toEqual([
      { category: 'Health', p: 0.86 },
      { category: 'Groceries', p: 0.12 },
      { category: 'Other', p: 0.02 },
    ]);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(DECISION_URL);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gemini-decision-1');
    expect(body.questions.category.type).toBe('choice');
    // Money going out is never offered as income or a refund.
    expect(Object.keys(body.questions.category.criteria)).not.toContain('Income');
    expect(Object.keys(body.questions.category.criteria)).toContain('Health');
  });

  it('drops anything that is not a category and surfaces API errors', async () => {
    const odd = reply({ Health: 0.5, Lunch: 0.5 });
    expect(await categoryOdds({ payee: 'x', vpa: null, direction: 'debit' }, { apiKey: 'k', fetchFn: odd as unknown as typeof fetch })).toEqual([
      { category: 'Health', p: 0.5 },
    ]);
    const down = vi.fn(async () => new Response('quota', { status: 429 }));
    await expect(categoryOdds({ payee: 'x', vpa: null, direction: 'debit' }, { apiKey: 'k', fetchFn: down as unknown as typeof fetch })).rejects.toThrow('429');
  });
});

describe('decisionClassifier', () => {
  it('returns the top category with its probability', async () => {
    const classify = decisionClassifier({ apiKey: 'k', fetchFn: reply({ Food: 0.7, Groceries: 0.3 }) as unknown as typeof fetch });
    expect(await classify({ payee: 'Annapurna Bhojnalaya', vpa: null, direction: 'debit', text: 'ignored' })).toEqual({ category: 'Food', confidence: 0.7 });
  });

  it('never asks about QR codes or payment IDs', async () => {
    const fetchFn = reply({ Food: 1 });
    const classify = decisionClassifier({ apiKey: 'k', fetchFn: fetchFn as unknown as typeof fetch });
    expect(await classify({ payee: 'paytmqr2810050501011', vpa: 'paytmqr2810050501011@paytm', direction: 'debit', text: '' })).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
