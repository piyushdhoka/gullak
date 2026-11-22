import { describe, expect, it } from 'vitest';

import { categorize, explainCategory, type CategorizeInput } from '../src/categorize.ts';

const base: CategorizeInput = { direction: 'debit', channel: 'upi', payee: null, vpa: null, text: '' };
const why = (input: Partial<CategorizeInput>, current?: { category: string; source: string }) => {
  const i = { ...base, ...input };
  const c = current ?? categorize(i);
  return explainCategory(i, { category: c.category, source: c.source });
};

describe('explainCategory', () => {
  it('known merchants', () => {
    expect(why({ payee: 'SWIGGY' }).reason).toBe('Swiggy is a known food merchant.');
  });

  it('shop words in the name', () => {
    expect(why({ payee: 'SHREE GANESH MEDICAL' }).reason).toMatch(/“MEDIC” in it, which usually means health/i);
  });

  it('people and phone numbers', () => {
    expect(why({ payee: '9876543210', vpa: '9876543210@ybl' }).reason).toMatch(/phone-number UPI ID/);
    expect(why({ payee: 'rahul.k', vpa: 'rahul.k@okicici' }).reason).toMatch(/looks like a person/);
  });

  it('QR codes and unknown names ask for one tap', () => {
    expect(why({ payee: 'paytmqr2810050501', vpa: 'paytmqr2810050501@paytm' }).reason).toMatch(/QR code or payment ID/);
    expect(why({ payee: 'SHREE GANESH ENTERPRISES' }).reason).toMatch(/doesn’t know SHREE GANESH ENTERPRISES yet/);
  });

  it('money in, refunds and ATM', () => {
    expect(why({ direction: 'credit', payee: 'ACME' }).reason).toMatch(/income/);
    expect(why({ direction: 'credit', payee: 'AMAZON', text: 'Refund of Rs 299' }).reason).toMatch(/refund or reversal/);
    expect(why({ channel: 'atm', payee: 'ATM' }).reason).toMatch(/ATM/);
  });

  it("the owner's own choice is explained as theirs", () => {
    expect(why({ payee: 'SWIGGY' }, { category: 'Groceries', source: 'user' }).reason).toMatch(/^You put SWIGGY in Groceries/);
  });

  it('offers three other categories as quick fixes, never the current one', () => {
    const e = why({ payee: 'SWIGGY' });
    expect(e.alternatives).toHaveLength(3);
    expect(e.alternatives).not.toContain('Food');
  });
});
