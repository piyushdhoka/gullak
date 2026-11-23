import { describe, expect, it } from 'vitest';

import { parseReceipt } from '../src/receipt.ts';

const NOW = new Date('2026-11-23T18:00:00+05:30');

const RESTAURANT = `
TAX INVOICE
SHREE KRISHNA PURE VEG
Shop No 4, FC Road, Shivajinagar
Pune - 411005
Ph: 9822012345
GSTIN: 27AAAPK1234F1Z5
Bill No: 1842        Table: 6
Date: 21/11/2026     Time: 08:42 PM
Item              Qty   Rate    Amt
Paneer Butter Masala 1  260.00  260.00
Butter Naan       3    45.00   135.00
Sweet Lassi       2    80.00   160.00
Sub Total                      555.00
CGST @2.5%                      13.88
SGST @2.5%                      13.88
Round Off                        0.24
Grand Total                Rs. 583.00
Paid by UPI
Thank you! Visit again
`;

const KIRANA_NO_LABEL_STRONG = `
SAI KIRANA & GENERAL STORES
Near Metro Station, Kothrud
Mob 9876543210
CASH MEMO
Dt 22-11-26
Atta 5kg 1 245.00
Toor Dal 1kg 1 160.00
Sugar 1kg 1 48.00
Total Items: 3
TOTAL 453.00
Cash Received 500.00
Change 47.00
`;

const PETROL = `
INDIAN OIL
M/S SAI AUTO SERVICE STATION
Bhosari, Pune 411026
Pump No: 2  Nozzle No: 1
Product: PETROL
Rate: Rs.106.31/L
Volume: 4.70 L
Amount: Rs. 500.00
Vehicle No: MH12AB1234
Date: 20.11.2026 Time: 09:15:22
Mode: CARD  XXXX1234
`;

const PHARMACY = `
CITY MEDICAL & GENERAL STORES
DL No: 20B/PN/1234
GSTIN 27ABCDE1234F1Z9
Invoice No: CM/2026/558   Date: 18-Nov-2026
Dolo 650 Tab   1 strip  Batch D123 Exp 08/28   30.91
Cough Syrup 100ml       Batch S77  Exp 05/27  112.00
Taxable Value                                  127.57
GST                                             15.34
Net Amount                                     142.91
`;

const SUPERMARKET_KNOWN = `
DMART
Avenue Supermarts Ltd
Hinjewadi Phase 1, Pune
TAX INVOICE
Bill Dt: 19/11/26 18:05
Total Qty: 7
Total Savings: 64.00
Net Payable: 1,248.50
Payment Mode: Paytm UPI
`;

const OCR_NOISY = `
|THE CHAI POINT |
Kalyani Nagar, Pune
Date : 23/11/2026 05:10 PM
Masala Chai  2 x 20.00   40.00
Bun Maska    1 x 35.00   35.00
T0TAL
75 . 00
`;

describe('parseReceipt', () => {
  it('reads a restaurant bill: grand total, date, time, shop, food, UPI', () => {
    expect(parseReceipt(RESTAURANT, NOW)).toEqual({
      amount: 583,
      amountSure: true,
      date: '2026-11-21',
      time: '20:42',
      merchant: 'Shree Krishna Pure Veg',
      category: 'Food',
      paidBy: 'upi',
    });
  });

  it('takes TOTAL, not cash received or change, and skips the address line', () => {
    const r = parseReceipt(KIRANA_NO_LABEL_STRONG, NOW);
    expect(r.amount).toBe(453);
    expect(r.date).toBe('2026-11-22');
    expect(r.merchant).toBe('Sai Kirana & General Stores');
    expect(r.category).toBe('Groceries');
    expect(r.paidBy).toBe('cash');
  });

  it('reads a petrol pump slip: amount, dotted date, card, Transport', () => {
    const r = parseReceipt(PETROL, NOW);
    expect(r).toMatchObject({ amount: 500, date: '2026-11-20', time: '09:15', merchant: 'Indian Oil', category: 'Transport', paidBy: 'card' });
  });

  it('reads a pharmacy bill: net amount (not taxable value), month-name date, Health', () => {
    const r = parseReceipt(PHARMACY, NOW);
    expect(r).toMatchObject({ amount: 142.91, amountSure: true, date: '2026-11-18', merchant: 'City Medical & General Stores', category: 'Health' });
  });

  it('knows chains by name and reads Indian digit grouping', () => {
    const r = parseReceipt(SUPERMARKET_KNOWN, NOW);
    expect(r).toMatchObject({ amount: 1248.5, date: '2026-11-19', time: '18:05', merchant: 'DMart', category: 'Groceries', paidBy: 'upi' });
  });

  it('copes with OCR noise: pipes, T0TAL, the number on the next line, split decimals', () => {
    const r = parseReceipt(OCR_NOISY, NOW);
    expect(r.merchant).toBe('Chai Point'); // a known chain: its proper name
    expect(r.date).toBe('2026-11-23');
    expect(r.time).toBe('17:10');
    expect(r.category).toBe('Food');
    expect(r.amount).toBe(75);
    expect(r.amountSure).toBe(true);
  });

  it('ignores impossible, future and very old dates', () => {
    expect(parseReceipt('Shop\nDate: 31/02/2026\nTotal 10.00', NOW).date).toBeNull();
    expect(parseReceipt('Shop\nDate: 30/12/2026\nTotal 10.00', NOW).date).toBeNull();
    expect(parseReceipt('Shop\nDate: 01/01/2020\nTotal 10.00', NOW).date).toBeNull();
  });

  it('never takes a phone number, GSTIN or bill number as the amount', () => {
    const r = parseReceipt('Some Shop\nPh 9822012345\nBill No 556677\nGSTIN 27AAAPK1234F1Z5\nItems 2', NOW);
    expect(r.amount).toBeNull();
  });

  it('falls back to the biggest amount with paise when nothing is labelled, marked unsure', () => {
    const r = parseReceipt('Corner Bakery\nBread 40.00\nCake 350.00\n', NOW);
    expect(r).toMatchObject({ amount: 350, amountSure: false, category: 'Food' });
  });

  it('returns empty guesses for empty or junk text', () => {
    expect(parseReceipt('', NOW)).toEqual({ amount: null, amountSure: false, date: null, time: null, merchant: null, category: null, paidBy: null });
    expect(parseReceipt('~~ ;; ..', NOW).amount).toBeNull();
  });

  it('guesses the year when OCR cut it off ("17 Nov 20:"), never into the future', () => {
    expect(parseReceipt('Noble Chemist\nDate: 17 Nov 20:\nNet Amt 286.40', NOW).date).toBe('2026-11-17');
    expect(parseReceipt('Noble Chemist\nDate: 28 Dec\nNet Amt 286.40', NOW).date).toBe('2025-12-28');
  });

  it('repairs thousands separators OCR misread as dots or split with a space', () => {
    expect(parseReceipt('Star Bazaar\nNet Payable 1.876.25', NOW).amount).toBe(1876.25);
    expect(parseReceipt('Star Bazaar\nNet Payable 1, 876.25', NOW).amount).toBe(1876.25);
    expect(parseReceipt('Car Showroom\nGrand Total 1.23.456.00', NOW).amount).toBe(123456);
    expect(parseReceipt('Shop\nDate 15.11.2026\nTotal 99.00', NOW)).toMatchObject({ amount: 99, date: '2026-11-15' });
  });

  it('reads whole-rupee amounts written as 260/-', () => {
    expect(parseReceipt('German Bakery\nBrownie 1 120/-\nTOTAL Rs. 260/-', NOW)).toMatchObject({ amount: 260, amountSure: true });
  });

  it('files hypermarket bills under Groceries', () => {
    expect(parseReceipt('STAR BAZAAR\nTrent Hypermarket Pvt Ltd\nNet Payable 1,876.25', NOW).category).toBe('Groceries');
  });

  it('does not treat "Cash Memo" as paid by cash', () => {
    expect(parseReceipt('Ram Stores\nCASH MEMO\nTotal 120.00', NOW).paidBy).toBeNull();
  });
});
