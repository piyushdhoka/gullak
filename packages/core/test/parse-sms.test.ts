import { describe, expect, it } from 'vitest';

import { parseSms } from '../src/parse-sms.ts';

// Realistic, anonymised bank SMS formats. Names, numbers and refs are made up.
function txn(text: string) {
  const r = parseSms(text);
  if (r.kind !== 'transaction') throw new Error(`expected transaction, got ${r.kind}: ${r.reason}`);
  return r.txn;
}

describe('parseSms — debits', () => {
  it('HDFC UPI sent (multi-line)', () => {
    const t = txn(
      'Sent Rs.250.00\nFrom HDFC Bank A/C *1234\nTo SWIGGY\nOn 11/10/26\nRef 528461234567\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808',
    );
    expect(t).toMatchObject({
      amount: 250,
      direction: 'debit',
      payee: 'SWIGGY',
      bank: 'HDFC Bank',
      account: '1234',
      upiRef: '528461234567',
      channel: 'upi',
    });
  });

  it('SBI UPI debit without currency symbol', () => {
    const t = txn(
      'Dear UPI user A/C X1234 debited by 250.0 on date 11Oct26 trf to SWIGGY Refno 528461234567. If not u? call 1800111109. -SBI',
    );
    expect(t).toMatchObject({
      amount: 250,
      direction: 'debit',
      payee: 'SWIGGY',
      bank: 'SBI',
      account: '1234',
      upiRef: '528461234567',
    });
  });

  it('ICICI debit where the payee is "credited"', () => {
    const t = txn(
      'ICICI Bank Acct XX234 debited for Rs 1,250.50 on 11-Oct-26; ZOMATO LTD credited. UPI:528461234567. Call 18002662 for dispute. SMS BLOCK 234 to 9215676766.',
    );
    expect(t).toMatchObject({
      amount: 1250.5,
      direction: 'debit',
      payee: 'ZOMATO LTD',
      bank: 'ICICI Bank',
      account: '234',
      upiRef: '528461234567',
    });
  });

  it('Axis UPI/P2M narration', () => {
    const t = txn(
      'INR 499.00 debited\nA/c no. XX1234\n11-10-26, 14:22:10\nUPI/P2M/528461234567/NETFLIX COM\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank',
    );
    expect(t).toMatchObject({
      amount: 499,
      direction: 'debit',
      payee: 'NETFLIX COM',
      bank: 'Axis Bank',
      account: '1234',
      upiRef: '528461234567',
      channel: 'upi',
    });
  });

  it('Kotak sent to a VPA keeps the VPA', () => {
    const t = txn(
      'Sent Rs.80.00 from Kotak Bank AC X1234 to chai.point@ybl on 11-10-26.UPI Ref 528461234567. Not you, https://kotak.com/KBANKT/Fraud',
    );
    expect(t).toMatchObject({
      amount: 80,
      direction: 'debit',
      vpa: 'chai.point@ybl',
      payee: 'chai.point',
      bank: 'Kotak',
      account: '1234',
      upiRef: '528461234567',
    });
  });

  it('HDFC credit card spend is a debit on a card', () => {
    const t = txn(
      'Spent Rs.1,299.00 On HDFC Bank Credit Card 5678 At AMAZON PAY INDIA On 2026-10-11:14:22:10.Not You? To Block+Reissue Call 18002586161/SMS BLOCK CC 5678 to 7308080808',
    );
    expect(t).toMatchObject({
      amount: 1299,
      direction: 'debit',
      payee: 'AMAZON PAY INDIA',
      bank: 'HDFC Bank',
      account: '5678',
      channel: 'card',
    });
  });

  it('ignores the available balance amount', () => {
    const t = txn(
      'A/c XX1234 debited Rs 300.00 on 11-10-26 to VPA rapido.bike@axl. Avl Bal Rs 12,450.75. UPI Ref 528461234567 -Yes Bank',
    );
    expect(t.amount).toBe(300);
    expect(t.bank).toBe('Yes Bank');
    expect(t.vpa).toBe('rapido.bike@axl');
  });

  it('ATM withdrawal', () => {
    const t = txn(
      'Rs.2000.00 withdrawn at ATM from A/c XX1234 on 11-10-26. Avl Bal Rs.5,000.00 -SBI',
    );
    expect(t).toMatchObject({ amount: 2000, direction: 'debit', channel: 'atm' });
  });
});

describe('parseSms — credits', () => {
  it('HDFC credit alert from a VPA', () => {
    const t = txn(
      'Credit Alert!\nRs.500.00 credited to HDFC Bank A/c XX1234 on 11-10-26 from VPA rahul.k@okicici (UPI 528412345678)',
    );
    expect(t).toMatchObject({
      amount: 500,
      direction: 'credit',
      vpa: 'rahul.k@okicici',
      payee: 'rahul.k',
      account: '1234',
      upiRef: '528412345678',
    });
  });

  it('ICICI credit from a named person', () => {
    const t = txn(
      'Dear Customer, Acct XX234 is credited with Rs 500.00 on 11-Oct-26 from RAHUL KUMAR. UPI:528412345678-ICICI Bank.',
    );
    expect(t).toMatchObject({ amount: 500, direction: 'credit', payee: 'RAHUL KUMAR' });
  });

  it('Kotak received', () => {
    const t = txn(
      'Received Rs.1500.00 in your Kotak Bank AC X1234 from priya@oksbi on 11-10-26.UPI Ref:528412345678.',
    );
    expect(t).toMatchObject({ amount: 1500, direction: 'credit', vpa: 'priya@oksbi', upiRef: '528412345678' });
  });

  it('salary NEFT credit', () => {
    const t = txn(
      'Your A/c XX1234 is credited by Rs.65,000.00 on 01-11-26 by NEFT from ACME TECHNOLOGIES PVT LTD. Avl Bal Rs.70,120.00 -HDFC Bank',
    );
    expect(t).toMatchObject({ amount: 65000, direction: 'credit', channel: 'netbanking' });
    expect(t.payee).toBe('ACME TECHNOLOGIES PVT LTD');
  });

  it('refund', () => {
    const t = txn('Refund of Rs 299.00 from AMAZON has been credited to your A/c XX1234 on 11-10-26 -Axis Bank');
    expect(t).toMatchObject({ amount: 299, direction: 'credit' });
  });
});

describe('parseSms — ignored', () => {
  const cases: [string, string][] = [
    ['otp', '123456 is your OTP for txn of Rs 250.00 at SWIGGY on HDFC Bank card 5678. Valid for 3 mins. Do not share.'],
    ['collect request', 'rahul@okicici has requested money from you on Google Pay. On approving, Rs 500 will be debited from your A/c'],
    ['failed', 'Your UPI transaction of Rs 250.00 to SWIGGY has failed. Amount if debited will be refunded. -SBI'],
    ['future debit', 'Rs 199.00 will be debited from your A/c XX1234 on 15-11-26 towards NETFLIX mandate.'],
    ['bill due', 'Your HDFC Bank Credit Card 5678 statement is generated. Total amount due Rs 12,345.00, due on 25-11-26.'],
    ['card bill payment', 'Payment of Rs 12,345.00 received towards your HDFC Bank Credit Card 5678. Thank you.'],
    ['promotion', 'Get flat Rs 500 cashback on your next recharge! Use code SAVE500. T&C apply.'],
  ];
  for (const [name, text] of cases) {
    it(name, () => {
      expect(parseSms(text).kind).toBe('ignored');
    });
  }
});

describe('parseSms — unrecognised', () => {
  it('a bank-looking message with no amount', () => {
    expect(parseSms('Your A/c XX1234 has been debited. Call us if not you. -HDFC Bank').kind).toBe(
      'unrecognised',
    );
  });
  it('empty text', () => {
    expect(parseSms('   ').kind).toBe('unrecognised');
  });
});

describe('available balance', () => {
  const bal = (text: string) => {
    const r = parseSms(text);
    return r.kind === 'transaction' ? r.txn.balance : 'not a transaction';
  };

  it('reads the balance after the payment', () => {
    expect(bal('A/c XX1234 debited Rs 300.00 on 11-10-26 to VPA rapido.bike@axl. Avl Bal Rs 12,450.75. UPI Ref 528461234567 -Yes Bank')).toBe(12450.75);
    expect(bal('Your A/c XX1234 is credited by Rs.65,000.00 on 01-11-26 by NEFT from ACME TECHNOLOGIES PVT LTD. Avl Bal Rs.70,120.00 -HDFC Bank')).toBe(70120);
    expect(bal('Rs.500 debited from A/c XX4321 on 02-11-26. Available Balance: INR 9,876.50 -Kotak')).toBe(9876.5);
  });

  it('is empty when the SMS has no balance, and ignores card limits', () => {
    expect(bal('Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY On 21/11/26 Ref 532175523881')).toBeNull();
    expect(bal('Rs.799 spent on ICICI Bank Card XX4402 at AMAZON on 12-Nov-26. Avl Limit: INR 1,20,000.00')).toBeNull();
  });
});
