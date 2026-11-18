import { describe, expect, it } from 'vitest';
import { emptyLine, lineProblems, receiptLineInput } from './LinesEditor';

const EGGS = {
  id: '019a7a8d-ae28-7631-8b69-6be302d5e4c0',
  sku: 'EGG-0003',
  name: 'Eggs, big',
  baseUom: 'EGG',
};
const REASONS = [
  { code: 'CRACKED', requiresNote: false },
  { code: 'QUALITY_REJECTED', requiresNote: true },
];

describe('a goods receipt line in crates (2.2.0) with goods rejected at the door (2.3.0)', () => {
  it('sends the crate and the rejection as typed, and never converts to eggs', () => {
    const line = emptyLine({
      product: EGGS,
      uom: 'CRATE',
      qty: '18',
      rejected: '2',
      rejectionReasonCode: 'CRACKED',
      valuePesewas: 85500,
      purchaseOrderLineId: '019a7ab5-0c1e-7d3a-9b2f-4e6a8c1d2f30',
    });
    expect(receiptLineInput(line)).toEqual({
      productId: EGGS.id,
      purchaseOrderLineId: '019a7ab5-0c1e-7d3a-9b2f-4e6a8c1d2f30',
      uom: 'CRATE',
      qtyReceived: '18.000',
      qtyRejected: '2.000',
      rejectionReasonCode: 'CRACKED',
      valuePesewas: 85500,
    });
  });

  it('sends no unit for the base unit and no rejection when nothing was turned away', () => {
    const line = emptyLine({
      product: EGGS,
      qty: '300',
      rejected: '0',
      rejectionReasonCode: 'CRACKED',
      valuePesewas: 1,
    });
    expect(receiptLineInput(line)).toEqual({
      productId: EGGS.id,
      qtyReceived: '300.000',
      valuePesewas: 1,
    });
  });

  it('leaves the value of a line against an order line to the server, and asks for it otherwise (CR-040)', () => {
    const fromOrder = emptyLine({
      product: EGGS,
      uom: 'CRATE',
      qty: '18',
      purchaseOrderLineId: '019a7ab5-0c1e-7d3a-9b2f-4e6a8c1d2f30',
    });
    const byHand = emptyLine({ product: EGGS, qty: '300' });
    expect(lineProblems([fromOrder, byHand], 'receipt')).toEqual({ [byHand.key]: ['value'] });
    expect(receiptLineInput(fromOrder)).not.toHaveProperty('valuePesewas');
    expect(receiptLineInput({ ...fromOrder, valuePesewas: 0 })).toMatchObject({ valuePesewas: 0 });
  });

  it('asks for the reason, and for a note when the reason needs one', () => {
    const noReason = emptyLine({ product: EGGS, qty: '18', rejected: '2', valuePesewas: 1 });
    const noNote = emptyLine({
      product: EGGS,
      qty: '18',
      rejected: '2',
      rejectionReasonCode: 'QUALITY_REJECTED',
      valuePesewas: 1,
    });
    const fine = emptyLine({
      product: EGGS,
      qty: '18',
      rejected: '2',
      rejectionReasonCode: 'CRACKED',
      valuePesewas: 1,
    });
    expect(lineProblems([noReason, noNote, fine], 'receipt', REASONS)).toEqual({
      [noReason.key]: ['reason'],
      [noNote.key]: ['note'],
    });
  });

  it('lets an order line leave its price out for the last price paid', () => {
    const line = emptyLine({ product: EGGS, uom: 'CRATE', qty: '20' });
    expect(lineProblems([line], 'order')).toEqual({});
  });
});
