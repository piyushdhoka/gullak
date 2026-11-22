import { describe, expect, it } from 'vitest';

import { guessFromSms } from './sms-guess';

describe('guessFromSms', () => {
  it('reads a UPI credit', () => {
    expect(guessFromSms('Rs.10.00 credited to a/c XX1234 on 22-11-26 by a/c linked to VPA rahul.k@okaxis (UPI Ref No 512345678901)')).toEqual({
      direction: 'credit',
      amount: '10',
      payee: 'rahul.k@okaxis',
    });
  });

  it('reads a debit with the payee after "To"', () => {
    expect(guessFromSms('Sent Rs.250.50 From HDFC Bank A/C *1234 To SWIGGY On 21/11/26 Ref 528461234599')).toEqual({
      direction: 'debit',
      amount: '250.5',
      payee: 'SWIGGY',
    });
  });

  it('copes with a typed "$" and keeps an unreadable amount empty', () => {
    expect(guessFromSms('Sent $100000 From HDFC Bank A/C *1234 To SWIGGY On 21/11/26').amount).toBe('100000');
    expect(guessFromSms('Your account was credited. Check the app.')).toEqual({ direction: 'credit', amount: '', payee: '' });
  });

  it('reads an HDFC "Credit Alert!" with a masked VPA', () => {
    expect(guessFromSms('Credit Alert!\nRs.10.00 credited to HDFC Bank A/c XX3062 on 22-11-26 from VPA *ar03@okhdfcbank (UPI 133203299429)')).toEqual({
      direction: 'credit',
      amount: '10',
      payee: 'ar03@okhdfcbank',
    });
  });

  it('ignores "Credit Card" when deciding the direction', () => {
    expect(guessFromSms('INR 499 spent on HDFC Credit Card XX12 at NETFLIX').direction).toBe('debit');
  });
});
