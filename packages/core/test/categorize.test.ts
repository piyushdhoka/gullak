import { describe, expect, it } from 'vitest';

import { categorize, isOpaquePayee } from '../src/categorize.ts';

const base = { direction: 'debit' as const, channel: 'upi' as const, payee: null, vpa: null, text: '' };

describe('categorize', () => {
  it('known merchant by payee name', () => {
    expect(categorize({ ...base, payee: 'SWIGGY' })).toEqual({ category: 'Food', merchant: 'Swiggy', source: 'merchant' });
  });

  it('known merchant by VPA', () => {
    expect(categorize({ ...base, payee: 'zepto.payu', vpa: 'zepto.payu@hdfcbank' })).toMatchObject({
      category: 'Groceries',
      merchant: 'Zepto',
    });
  });

  it("owner's rule beats everything and is marked as the user's choice", () => {
    expect(categorize({ ...base, payee: 'SWIGGY' }, 'Groceries')).toMatchObject({ category: 'Groceries', source: 'user' });
  });

it("uses the owner's own custom category (rules are validated when saved)", () => {    expect(categorize({ ...base, payee: 'SWIGGY' }, 'Office lunch')).toMatchObject({ category: 'Office lunch', source: 'user' });  });  it('ignores an empty owner rule', () => {    expect(categorize({ ...base, payee: 'SWIGGY' }, '  ').category).toBe('Food');  });

  it('name-like personal VPA is a transfer, with a readable name', () => {
    expect(categorize({ ...base, payee: 'rahul.k', vpa: 'rahul.k@okicici' })).toEqual({
      category: 'Transfers',
      merchant: 'Rahul K',
      source: 'heuristic',
    });
  });

  it('mobile-number VPA is a person', () => {
    expect(categorize({ ...base, payee: '9876543210', vpa: '9876543210@ybl' })).toMatchObject({
      category: 'Transfers',
      source: 'heuristic',
    });
  });

  it('Axis P2A narration is a person, P2M is not', () => {
    expect(categorize({ ...base, payee: 'RAHUL', text: 'UPI/P2A/528461234567/RAHUL' }).category).toBe('Transfers');
    expect(categorize({ ...base, payee: 'SHARMA STORE', text: 'UPI/P2M/528461234567/SHARMA STORE' }).source).toBe('unknown');
  });

  it('a readable shop name is categorised from its words, not mistaken for a person', () => {
    expect(categorize({ ...base, payee: 'sharma.medicals', vpa: 'sharma.medicals@ybl' })).toMatchObject({
      category: 'Health',
      source: 'heuristic',
    });
    expect(categorize({ ...base, payee: 'SHREE GANESH MEDICAL' }).category).toBe('Health');
    expect(categorize({ ...base, payee: 'BALAJI KIRANA STORE' }).category).toBe('Groceries');
    expect(categorize({ ...base, payee: 'PUNJABI DHABA' }).category).toBe('Food');
    expect(categorize({ ...base, payee: 'HP PETROL PUMP' }).category).toBe('Transport');
  });

  it('a readable name with no clue stays unknown (for the model or review)', () => {
    expect(categorize({ ...base, payee: 'SHREE GANESH ENTERPRISES' })).toMatchObject({ category: 'Other', source: 'unknown' });
  });

  it('QR codes and IDs are unknown (left for one-tap review), not guessed', () => {
    for (const [payee, vpa] of [
      ['paytmqr2810050501', 'paytmqr2810050501@paytm'],
      ['Q482915273', 'Q482915273@ybl'],
      ['BHARATPE09812345678', 'bharatpe09812345678@yesbankltd'],
    ]) {
      expect(categorize({ ...base, payee, vpa })).toMatchObject({ category: 'Other', source: 'unknown' });
    }
  });

  it('ATM is Cash', () => {
    expect(categorize({ ...base, channel: 'atm', payee: 'ATM' })).toMatchObject({ category: 'Cash', source: 'heuristic' });
  });

  it('credits are Income, refunds are Refund', () => {
    expect(categorize({ ...base, direction: 'credit', payee: 'ACME' }).category).toBe('Income');
    expect(categorize({ ...base, direction: 'credit', payee: 'AMAZON', text: 'Refund of Rs 299' }).category).toBe('Refund');
  });
});

describe('isOpaquePayee', () => {
  it.each([
    ['paytmqr2810050501', 'paytmqr2810050501@paytm', true],
    ['Q482915273', 'Q482915273@ybl', true],
    ['BHARATPE09812345678', null, true],
    ['9876543210', '9876543210@ybl', true],
    ['ab12345', null, true],
    [null, null, true],
    ['SHREE GANESH MEDICAL', null, false],
    ['sharma.medicals', 'sharma.medicals@ybl', false],
    ['ZOMATO LTD', null, false],
  ])('%s / %s → %s', (payee, vpa, expected) => {
    expect(isOpaquePayee(payee, vpa)).toBe(expected);
  });
});
