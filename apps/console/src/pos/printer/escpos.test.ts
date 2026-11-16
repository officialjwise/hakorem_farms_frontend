import { describe, expect, it } from 'vitest';
import type { ReceiptContent } from '../offline/types';
import {
  COLUMNS,
  ascii,
  encodeReceipt,
  pair,
  qrCommand,
  receiptLines,
  wrap,
  type PrintWords,
} from './escpos';

const WORDS: PrintWords = {
  business: 'HaKorem Farms',
  copy: 'COPY: reprint, not a new sale',
  register: 'Shop till 1 (T1)',
  cashier: 'Cashier: Adwoa Darko',
  saleReference: 'Sale reference',
  receiptNo: 'Receipt no.',
  receiptNoFollows: 'Follows by SMS',
  total: 'Total',
  change: 'Change',
  handed: (name) => `${name} handed`,
  unverified: 'Mobile money, not yet verified',
  reference: 'Ref.',
  scan: 'Scan for your receipt',
  saleId: 'Sale id',
  thanks: 'Thank you',
};

/** The F9 gate's sale: goat G-0142 and 15.250 kg of beef, GH₵1,400.00 cash, GH₵92.50 change. */
const RECEIPT: ReceiptContent = {
  saleId: '019a7b40-0000-7000-8000-000000000001',
  provisionalRef: 'P-T1-312-0001',
  occurredAt: '2026-11-16T11:50:00Z',
  registerCode: 'T1',
  registerName: 'Shop till 1',
  cashierName: 'Adwoa Darko',
  lines: [
    {
      name: 'Goat, live',
      quantity: '1.000',
      saleUom: 'HEAD',
      weightKg: null,
      stockUnitIdentifier: 'G-0142',
      unitPricePesewas: 85000,
      amountPesewas: 85000,
    },
    {
      name: 'Beef',
      quantity: '1.000',
      saleUom: 'KG',
      weightKg: '15.250',
      stockUnitIdentifier: null,
      unitPricePesewas: 3000,
      amountPesewas: 45750,
    },
  ],
  totalPesewas: 130750,
  tenders: [{ name: 'Cash', amountPesewas: 130750, tenderedPesewas: 140000 }],
  changePesewas: 9250,
  customerPhone: null,
};

describe('the 58 mm receipt (ADR 0045)', () => {
  it('prints every line within 32 characters, the sale reference labelled as one, money as GHS', () => {
    const { header, body, footer } = receiptLines({
      receipt: RECEIPT,
      officialNo: null,
      copy: false,
      link: null,
      words: WORDS,
    });
    expect(header).toEqual([
      'HaKorem Farms',
      'Shop till 1 (T1)',
      '2026-11-16 11:50',
      'Cashier: Adwoa Darko',
    ]);
    expect(body).toEqual([
      '--------------------------------',
      'Sale reference     P-T1-312-0001',
      'Receipt no.       Follows by SMS',
      '--------------------------------',
      'Goat, live',
      '  G-0142 1 head @ GHS 850.00',
      '                      GHS 850.00',
      'Beef',
      '  15.250 kg @ GHS 30.00',
      '                      GHS 457.50',
      '--------------------------------',
      'Total               GHS 1,307.50',
      'Cash                GHS 1,307.50',
      'Cash handed         GHS 1,400.00',
      'Change                 GHS 92.50',
      '--------------------------------',
    ]);
    expect(footer).toEqual([
      'Scan for your receipt',
      'Sale id',
      '019a7b40-0000-7000-8000-00000000',
      '0001',
      'Thank you',
    ]);
    for (const line of [...header, ...body, ...footer])
      expect(line.length).toBeLessThanOrEqual(COLUMNS);
  });

  it('puts the official number in once the server has given it, and marks a reprint a copy first', () => {
    const { header, body } = receiptLines({
      receipt: RECEIPT,
      officialNo: 'RCP-2026-DDW-T1-006201',
      copy: true,
      link: null,
      words: WORDS,
    });
    expect(header[0]).toBe('COPY: reprint, not a new sale');
    expect(body.slice(1, 4)).toEqual([
      'Sale reference     P-T1-312-0001',
      'Receipt no.',
      '          RCP-2026-DDW-T1-006201',
    ]);
  });

  it('says an unverified mobile money tender is not yet verified, with its reference', () => {
    const { body } = receiptLines({
      receipt: {
        ...RECEIPT,
        tenders: [
          {
            name: 'Mobile money',
            amountPesewas: 20000,
            tenderedPesewas: null,
            unverified: true,
            reference: 'MP261113.1149.C41872',
          },
        ],
      },
      officialNo: null,
      copy: false,
      link: null,
      words: WORDS,
    });
    expect(body).toContain('Mobile money          GHS 200.00');
    expect(body).toContain('  Mobile money, not yet verified');
    expect(body).toContain('  Ref. MP261113.1149.C41872');
  });

  it('begins with the printer reset and ends with a feed, the QR carrying the link or else the sale id', () => {
    const withLink = encodeReceipt({
      receipt: RECEIPT,
      officialNo: null,
      copy: false,
      link: 'https://hakoremfarms.com/r/x',
      words: WORDS,
    });
    expect([...withLink.slice(0, 2)]).toEqual([0x1b, 0x40]);
    expect([...withLink.slice(-3)]).toEqual([0x1b, 0x64, 4]);
    const qr = qrCommand('https://hakoremfarms.com/r/x');
    const store = [0x1d, 0x28, 0x6b, 31, 0, 0x31, 0x50, 0x30];
    expect(qr.slice(25, 33)).toEqual(store);
    expect(String.fromCharCode(...qr.slice(33, 61))).toBe('https://hakoremfarms.com/r/x');
    expect(qr.slice(-8)).toEqual([0x1d, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30]);
    const joined = String.fromCharCode(...withLink);
    expect(joined).toContain('https://hakoremfarms.com/r/x');
    const withoutLink = String.fromCharCode(
      ...encodeReceipt({
        receipt: RECEIPT,
        officialNo: null,
        copy: false,
        link: null,
        words: WORDS,
      }),
    );
    expect(withoutLink).toContain(`\x31\x50\x30${RECEIPT.saleId}`);
  });

  it('sends nothing outside printable ASCII but the commands', () => {
    expect(ascii('Ɛsi Owusu · GH₵ 5')).toBe('?si Owusu ? GH? 5');
    expect(ascii('Kɔfi Boaténg')).toBe('K?fi Boateng');
    expect(wrap('a'.repeat(40))).toEqual(['a'.repeat(32), 'a'.repeat(8)]);
    expect(pair('Total', 'GHS 1.00')).toEqual(['Total                   GHS 1.00']);
  });
});
