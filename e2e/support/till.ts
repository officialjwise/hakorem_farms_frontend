/**
 * The till's server side for the end-to-end suite (F9). Prism keeps no state and answers every sync with
 * the contract's example, which names other sales; these responders answer as OFFLINE_SYNC.md says the
 * server does: each sale applied once by its client id, a resend answered DUPLICATE with the first result,
 * and the order read back carrying the total the till sent. Everything else is Prism's.
 */
import { createHash } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import type { FakeApi } from './fakeApi';
import { signIn, signInWithTotp, USERS } from './helpers';

export interface SentSale {
  id: string;
  deviceCounter: number;
  provisionalRef: string;
  occurredAt: string;
  lines: Record<string, unknown>[];
  tenders: { paymentMethodId: string; amountPesewas: number; tenderedPesewas?: number }[];
  payloadHash: string;
}

export interface TillServer {
  /** Every sync batch that reached the server, in order. */
  batches: { deviceId: string; shiftId: string; sales: SentSale[] }[];
  /** Sale id to its receipt number: what the server holds, once per sale. */
  applied: Map<string, string>;
  /** Sale id to the total the server recorded. */
  totals: Map<string, number>;
}

/** RFC 8785, for the integers and strings a sale carries. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .filter((key) => object[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(',')}}`;
}

/** What the server recomputes: SHA-256 of the canonical sale without its hash (OFFLINE_SYNC 4.4). */
export function expectedHash(sale: SentSale): string {
  return createHash('sha256')
    .update(canonicalJson({ ...sale, payloadHash: undefined }), 'utf8')
    .digest('hex');
}

export function installTillServer(api: FakeApi, lineTotal: (sale: SentSale) => number): TillServer {
  const server: TillServer = { batches: [], applied: new Map(), totals: new Map() };
  let receipt = 6200;
  api.rewrite('getOfflinePack', (body) => ({
    ...(body as object),
    generatedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 24 * 3_600_000).toISOString(),
  }));
  api.respond('openShift', (request) => {
    const body = request as {
      id: string;
      registerId: string;
      openingFloatPesewas: number;
      openedAt: string;
    };
    return {
      id: body.id,
      shiftNo: 'SH-2026-DDW-T1-0312',
      status: 'OPEN',
      register: { id: body.registerId, code: 'T1', name: 'Shop till 1' },
      cashier: { id: '019a7a86-ac02-78a8-ade0-935170bb0c2f', displayName: 'Adwoa Darko' },
      shiftSeq: 312,
      openedAt: body.openedAt,
      openingFloatPesewas: body.openingFloatPesewas,
      closedAt: null,
      declaredCashPesewas: null,
      expectedCashPesewas: null,
      overShortPesewas: null,
      overShortDirection: null,
      closeApprovedBy: null,
      forceClosed: false,
      lastDeviceCounter: 0,
      salesCount: 0,
      tenders: [],
      currency: 'GHS',
      branchId: '019a7a83-2aef-79e3-9f1b-a708a7ae1fe6',
      version: 1,
    };
  });
  api.respond('syncOfflineSales', (request) => {
    const batch = request as TillServer['batches'][number];
    server.batches.push(batch);
    return {
      shiftId: batch.shiftId,
      results: batch.sales.map((sale) => {
        const first = server.applied.get(sale.id);
        const receiptNo = first ?? `RCP-2026-DDW-T1-00${String((receipt += 1))}`;
        if (first === undefined) {
          server.applied.set(sale.id, receiptNo);
          server.totals.set(sale.id, lineTotal(sale));
        }
        return {
          clientSaleId: sale.id,
          deviceCounter: sale.deviceCounter,
          outcome: first === undefined ? 'APPLIED' : 'DUPLICATE',
          orderId: sale.id,
          orderNo: `SO-2026-DDW-00${String(4300 + sale.deviceCounter)}`,
          receiptNo,
          exceptions: [],
        };
      }),
      cashMovementResults: [],
      counterGaps: [],
      serverTime: new Date().toISOString(),
    };
  });
  // The order the sale became (its id is the sale's), with the total the server recorded.
  api.rewrite('getOrder', (body, path) => {
    const id = path.split('/').pop() ?? '';
    const total = server.totals.get(id);
    return total === undefined
      ? body
      : { ...(body as object), id, finalTotalPesewas: total, estimatedTotalPesewas: total };
  });
  return server;
}

/**
 * A manager sets this browser up as till T1 (`enrolDevice`), signs out, and the cashier signs in on the till
 * and opens a shift with a GH₵200.00 float. The till then holds its offline pack.
 */
export async function openTillShift(page: Page): Promise<void> {
  await signInWithTotp(page, USERS.manager, '/pos');
  await expect(page.getByText('This till is not set up')).toBeVisible();
  await page.getByRole('link', { name: 'Set up this till' }).first().click();
  await page.getByRole('combobox', { name: /^Register/ }).click();
  await page.getByRole('option', { name: /^Shop till 1 \(T1\)/ }).click();
  await page.getByRole('textbox', { name: /^Name for this device/ }).fill('Counter tablet');
  await page.getByRole('button', { name: 'Set up this device' }).click();
  const confirm = page.getByRole('dialog', { name: 'Make this device a till?' });
  await confirm.getByRole('button', { name: 'Make this device a till' }).click();
  await expect(page.getByRole('heading', { name: 'This device is a till' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page
    .getByRole('dialog', { name: 'Sign out of the point of sale?' })
    .getByRole('button', { name: 'Sign out' })
    .click();

  await signIn(page, USERS.cashier, '/pos');
  await expect(page.getByText('No shift is open')).toBeVisible();
  await page.getByRole('link', { name: 'Open a shift' }).click();
  await page.getByRole('textbox', { name: /^Opening float/ }).fill('200');
  await page.getByRole('button', { name: 'Open the shift' }).click();
  await page
    .getByRole('dialog', { name: 'Open the shift with this float?' })
    .getByRole('button', { name: 'Open the shift' })
    .click();
  await expect(page.getByRole('heading', { name: 'Find an item' })).toBeVisible();
}

/** Types a code into the barcode bar and presses Enter, as a scanner does. */
export async function scan(page: Page, code: string): Promise<void> {
  const bar = page.getByRole('textbox', { name: /^Barcode/ });
  await bar.fill(code);
  await bar.press('Enter');
}
