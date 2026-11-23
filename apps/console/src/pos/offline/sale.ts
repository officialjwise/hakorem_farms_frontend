/**
 * A completed sale, as the till queues it (OFFLINE_SYNC.md 4 and 6.1): the contract's `OfflineSale` with
 * its client UUIDv7, device counter, provisional reference and payload hash, and the provisional receipt
 * the customer is handed.
 */
import type { components } from '@hakorem/api-client';
import { newRecordId } from '../../lib/clientId';
import {
  cartDiscount,
  cartTotal,
  lineAmount,
  splitTender,
  type CartLine,
  type OtherTender,
} from './cart';
import { payloadHash, type Json } from './payloadHash';
import { newReceiptToken, receiptLink, templateUsable } from './receiptToken';
import type { DeviceRecord, OfflineSale, ReceiptContent, SaleEntry, ShiftRecord } from './types';

type Schemas = components['schemas'];
type PaymentMethodRef = Schemas['PaymentMethodRef'];
type TenderInput = Schemas['TenderInput'];
type CounterSaleLine = Schemas['CounterSaleLine'];

/** `P-<REGISTER>-<SHIFT SEQ>-<COUNTER>`, the counter padded to four digits (section 4.3). */
export function provisionalRef(registerCode: string, shiftSeq: number, counter: number): string {
  return `P-${registerCode}-${String(shiftSeq)}-${String(counter).padStart(4, '0')}`;
}

/** The contract's line: optional fields left out, never sent as null. */
export function toCounterSaleLine(line: CartLine): CounterSaleLine {
  const sale = lineWithoutUnit(line);
  // CR-038 (2.11.0): the unit chosen at the till. Left out, the server sells the product's first unit,
  // which is the one its `priceBand` is.
  return line.soldInUom === null || line.soldInUom === undefined
    ? sale
    : { ...sale, uom: line.soldInUom };
}

function lineWithoutUnit(line: CartLine): CounterSaleLine {
  return {
    productId: line.productId,
    ...(line.stockUnitId !== null ? { stockUnitId: line.stockUnitId } : {}),
    quantity: line.quantity,
    ...(line.weightKg !== null ? { weightKg: line.weightKg } : {}),
    ...(line.weightKg !== null && line.weightSource !== null
      ? { weightSource: line.weightSource }
      : {}),
    ...(line.gradeId !== null ? { gradeId: line.gradeId } : {}),
    agreedUnitPricePesewas: line.agreedUnitPricePesewas,
    ...(line.varianceReasonCode !== null ? { varianceReasonCode: line.varianceReasonCode } : {}),
  };
}

export interface SaleInput {
  device: DeviceRecord;
  shift: ShiftRecord;
  lines: CartLine[];
  cashMethod: PaymentMethodRef;
  /** Other tenders the till may take, each with its method. */
  others: (OtherTender & { method: PaymentMethodRef })[];
  cashHandedPesewas: number;
  customerPhone: string | null;
  /** The pack's `receiptLinkTemplate` (2.24.0): with one, the sale gets its own token and link. */
  receiptLinkTemplate?: string | null;
  now: Date;
}

/** Builds the queue record for the shift's next counter. The caller commits it (store.commitSale). */
export async function buildSale(
  input: SaleInput,
): Promise<{ entry: SaleEntry; discountGivenPesewas: number }> {
  const { device, shift, lines, cashMethod, others, now } = input;
  if (lines.length === 0) throw new Error('A sale needs a line.');
  const total = cartTotal(lines);
  const split = splitTender(total, others, input.cashHandedPesewas);
  if (split.otherExceedsTotal || split.shortPesewas > 0)
    throw new Error('The tenders do not cover the sale.');

  const counter = shift.lastCounter + 1;
  const ref = provisionalRef(device.registerCode, shift.referenceSeq, counter);
  const occurredAt = now.toISOString();
  const token = templateUsable(input.receiptLinkTemplate) ? newReceiptToken() : null;
  const tenders: TenderInput[] = [
    ...others.map((tender) => ({
      paymentMethodId: tender.paymentMethodId,
      amountPesewas: tender.amountPesewas,
      ...(tender.paymentId !== undefined ? { paymentId: tender.paymentId } : {}),
      ...(tender.unverifiedMobileMoney !== undefined
        ? { unverifiedMobileMoney: tender.unverifiedMobileMoney }
        : {}),
    })),
    ...(split.cashAppliedPesewas > 0 || others.length === 0
      ? [
          {
            paymentMethodId: cashMethod.id,
            amountPesewas: split.cashAppliedPesewas,
            tenderedPesewas: input.cashHandedPesewas,
          },
        ]
      : []),
  ];
  const sale: Omit<OfflineSale, 'payloadHash'> = {
    id: newRecordId(now.getTime()),
    deviceCounter: counter,
    provisionalRef: ref,
    occurredAt,
    ...(input.customerPhone !== null ? { customerPhone: input.customerPhone } : {}),
    lines: lines.map(toCounterSaleLine),
    tenders,
    ...(token !== null ? { receiptToken: token } : {}),
  };
  const hash = await payloadHash(sale as unknown as { [key: string]: Json });
  const receipt: ReceiptContent = {
    saleId: sale.id,
    provisionalRef: ref,
    occurredAt,
    registerCode: device.registerCode,
    registerName: device.registerName,
    cashierName: shift.cashierName,
    lines: lines.map((line) => ({
      name: line.productName,
      quantity: line.quantity,
      saleUom: line.saleUom,
      weightKg: line.weightKg,
      stockUnitIdentifier: line.stockUnitIdentifier,
      unitPricePesewas: line.agreedUnitPricePesewas,
      amountPesewas: lineAmount(line),
    })),
    totalPesewas: total,
    tenders: [
      ...others.map((tender) => ({
        name: tender.method.name,
        amountPesewas: tender.amountPesewas,
        tenderedPesewas: null,
        ...(tender.unverifiedMobileMoney !== undefined
          ? {
              unverified: true,
              reference: tender.unverifiedMobileMoney.providerReference ?? null,
            }
          : {}),
      })),
      ...(split.cashAppliedPesewas > 0 || others.length === 0
        ? [
            {
              name: cashMethod.name,
              amountPesewas: split.cashAppliedPesewas,
              tenderedPesewas: input.cashHandedPesewas,
            },
          ]
        : []),
    ],
    changePesewas: split.changePesewas,
    customerPhone: input.customerPhone,
    // Kept with the sale, so a reprint carries the link the customer was first given.
    link: token !== null ? receiptLink(input.receiptLinkTemplate, token) : null,
  };
  return {
    entry: {
      kind: 'SALE',
      id: sale.id,
      shiftId: shift.id,
      localStatus: 'QUEUED',
      attempts: 0,
      createdLocalAt: occurredAt,
      lastAttemptAt: null,
      confirmedAt: null,
      failure: null,
      payload: { ...sale, payloadHash: hash },
      receipt,
      localTotalPesewas: total,
      serverResult: null,
      serverTotalPesewas: null,
    },
    discountGivenPesewas: shift.discountGivenPesewas + cartDiscount(lines),
  };
}
