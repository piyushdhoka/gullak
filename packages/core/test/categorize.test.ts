import { describe, expect, it } from 'vitest';

import { categorize, displayName, isOpaquePayee } from '../src/categorize.ts';
import { buildCategoryPrompt, CATEGORY_GRAMMAR, completionRequest, readAnswer } from '../src/classify.ts';

const base = { direction: 'debit' as const, channel: 'upi' as const, payee: null, vpa: null, text: '' };

describe('categorize (no hand-written rules)', () => {
  it("uses the owner's rule, including their own category names", () => {
    expect(categorize({ ...base, payee: 'SWIGGY' }, 'Groceries')).toMatchObject({ category: 'Groceries', source: 'user' });
    expect(categorize({ ...base, payee: 'SWIGGY' }, 'Office lunch')).toMatchObject({ category: 'Office lunch', source: 'user' });
  });

  it('leaves everything else undecided for the model, even well-known merchants', () => {
    expect(categorize({ ...base, payee: 'SWIGGY' })).toEqual({ category: 'Other', merchant: 'Swiggy', source: 'unknown' });
    expect(categorize({ ...base, payee: 'SWIGGY' }, '  ').source).toBe('unknown');
  });
});

describe('displayName', () => {
  it('tidies readable names and leaves IDs alone', () => {
    expect(displayName('SHREE GANESH ENTERPRISES', null)).toBe('Shree Ganesh Enterprises');
    expect(displayName('rahul.k', 'rahul.k@okicici')).toBe('Rahul K');
    expect(displayName('paytmqr2810050501', 'paytmqr2810050501@paytm')).toBe('paytmqr2810050501');
    expect(displayName(null, null)).toBeNull();
  });

  it('spots QR codes and gateway IDs', () => {
    expect(isOpaquePayee('paytmqr2810050501', 'paytmqr2810050501@paytm')).toBe(true);
    expect(isOpaquePayee('9876543210', '9876543210@ybl')).toBe(true);
    expect(isOpaquePayee('Rahul Kumar', null)).toBe(false);
  });
});

describe('category model prompt (SemIf style)', () => {
  const input = { payee: 'SHREE GANESH MEDICAL', vpa: null, direction: 'debit' as const, text: 'Sent Rs.120.00 To SHREE GANESH MEDICAL' };

  it('lists every category by name and ends where the answer goes', () => {
    const p = buildCategoryPrompt(input);
    expect(p).toContain('- Food:');
    expect(p).toContain('- Other:');
    expect(p).toContain('Money paid to: SHREE GANESH MEDICAL');
    expect(p.endsWith('<|im_start|>assistant\n<think>\n\n</think>\n\n')).toBe(true);
  });

  it('keeps the fixed instructions first so the server can cache them', () => {
    const a = buildCategoryPrompt(input);
    const b = buildCategoryPrompt({ ...input, payee: 'ZEPTO', text: 'Rs 374 to zepto' });
    expect(b.startsWith(a.slice(0, a.indexOf('Payment:')))).toBe(true);
  });

  it('restricts the answer to the 14 category names', () => {
    const req = completionRequest(input);
    expect(req.grammar).toBe(CATEGORY_GRAMMAR);
    expect(CATEGORY_GRAMMAR).toContain('"Groceries" | "Shopping"');
    expect(req).toMatchObject({ temperature: 0, n_probs: 20, cache_prompt: true });
  });
});

describe('readAnswer', () => {
  it('uses only probability mass that could still spell a category', () => {
    const r = readAnswer({
      content: 'Health',
      completion_probabilities: [
        { token: 'Health', logprob: Math.log(0.6), top_logprobs: [
          { token: 'Health', logprob: Math.log(0.6) },
          { token: 'Food', logprob: Math.log(0.2) },
          { token: 'The', logprob: Math.log(0.2) },
        ] },
      ],
    });
    expect(r?.category).toBe('Health');
    expect(r?.confidence).toBeCloseTo(0.75, 5);
  });

  it('multiplies across tokens of a multi-token name', () => {
    const r = readAnswer({
      content: 'Transport',
      completion_probabilities: [
        { token: 'Trans', top_logprobs: [{ token: 'Trans', prob: 0.8 }, { token: 'Travel', prob: 0.2 }] },
        { token: 'port', top_logprobs: [{ token: 'port', prob: 0.5 }, { token: 'fers', prob: 0.5 }] },
      ],
    });
    expect(r).toEqual({ category: 'Transport', confidence: 0.4 });
  });

  it('rejects anything that is not a category', () => {
    expect(readAnswer({ content: 'Snacks' })).toBeNull();
    expect(readAnswer({})).toBeNull();
  });
});
