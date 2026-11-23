/**
 * The till's server side for the end-to-end suite (F9). Prism keeps no state and answers every sync with
 * the contract's example, which names other sales; these responders answer as OFFLINE_SYNC.md says the
 * server does: each sale applied once by its client id, a resend answered DUPLICATE with the first result,
 * and the order read back carrying the total the till sent. Everything else is Prism's.
 */
import { createHash } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import type { FakeApi } from './fakeApi';
import { confirmStepUp, signIn, signInWithTotp, USERS } from './helpers';
import { MOMO_METHOD_ID, PEOPLE } from './tillPins';

/** 2.24.0 (CR-033): the receipt page the till fills with each sale's own token. */
export const RECEIPT_LINK_TEMPLATE = 'https://hakoremfarms.com/r/{token}';

export interface SentSale {
  id: string;
  deviceCounter: number;
  provisionalRef: string;
  occurredAt: string;
  customerPhone?: string;
  receiptToken?: string;
  lines: Record<string, unknown>[];
  tenders: {
    paymentMethodId: string;
    amountPesewas: number;
    tenderedPesewas?: number;
    unverifiedMobileMoney?: {
      payerPhone: string;
      network: string;
      providerReference?: string;
      approvedById: string;
    };
  }[];
  payloadHash: string;
}

/** A cash movement as `recordCashMovement` received it. */
export interface SentMovement {
  id: string;
  kind: 'CASH_DROP' | 'PAY_OUT' | 'PAY_IN';
  amountPesewas: number;
  reasonCode?: string;
  note?: string;
  witnessId?: string;
  occurredAt: string;
}

export interface TillServer {
  /** Every sync batch that reached the server, in order. */
  batches: { deviceId: string; shiftId: string; sales: SentSale[] }[];
  /** Every cash movement `recordCashMovement` took, once each by id. */
  movements: SentMovement[];
  /** Every sign-off `approveShiftClose` took, with its reason. */
  signOffs: { shiftId: string; reason: string }[];
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

export interface TillServerOptions {
  /** The branch allows unverified mobile money offline: the pack lists the method (OFFLINE_SYNC 5.2). */
  offlineMobileMoney?: boolean;
  /** Changes the pack's products, for a state its example cannot show (the egg session: two units). */
  products?: (products: Record<string, unknown>[]) => Record<string, unknown>[];
  /** The pack exactly as 2.11.0 answers it: the goat with no band (CR-052), not `goatPricedPerHead`. */
  contractPack?: boolean;
  /** CR-050, requested: the supervisors signed in at the branch. The manager, unless a test says none. */
  witnesses?: { id: string; displayName: string }[];
}

/** The reasons 2.5.0 fits to each kind (A-273 (c)), which the pack's example does not all carry. */
const CASH_REASONS = [
  { code: 'SAFE_DROP', description: 'Cash dropped to the safe', requiresNote: false },
  { code: 'FUEL_PAYOUT', description: 'Fuel paid from the till', requiresNote: true },
  { code: 'SUPPLIER_PAYOUT', description: 'A supplier paid from the till', requiresNote: true },
  { code: 'OTHER_PAYOUT', description: 'Another expense paid from the till', requiresNote: true },
  { code: 'FLOAT_TOP_UP', description: 'Float topped up', requiresNote: false },
].map((reason) => ({ ...reason, domain: 'CASH_MOVEMENT', lossAccountGroup: null }));

/**
 * 2.11.0's pack gives the goat no band: "a product priced by grade or weight (a live animal) has no single
 * band", so as built a till cannot sell one (CR-052). These specs test the till, not the goat's price, so
 * the goat keeps the per-head band 2.10.0's example gave it, its first unit's as the pack says.
 */
const GOAT_ID = '019a7a8d-137d-74bf-b9f8-54cda260cdab';
const GOAT_BAND = {
  listPricePesewas: 85000,
  floorPricePesewas: 12000,
  ceilingPricePesewas: 195000,
  basis: 'PER_HEAD',
};
const GOAT_ENTRY = '019a7afb-e198-708b-85c3-118489658a62';

export function goatPricedPerHead(products: Record<string, unknown>[]): Record<string, unknown>[] {
  return products.map((entry) =>
    (entry.product as { id: string }).id !== GOAT_ID || entry.priceBand !== null
      ? entry
      : {
          ...entry,
          priceBand: GOAT_BAND,
          priceListEntryId: GOAT_ENTRY,
          sellingUnits: [
            { uom: 'HEAD', priceListEntryId: GOAT_ENTRY, priceBand: GOAT_BAND, quoteOnly: false },
          ],
        },
  );
}

const CASHIER = { id: PEOPLE.cashier.id, displayName: PEOPLE.cashier.name };
const MANAGER = { id: PEOPLE.manager.id, displayName: PEOPLE.manager.name };

/** What the fake's till expects in cash beyond what is counted, so a close is GH₵120.00 short, as Prism's example is. */
const SHORT_PESEWAS = 12000;

export function installTillServer(
  api: FakeApi,
  lineTotal: (sale: SentSale) => number,
  options: TillServerOptions = {},
): TillServer {
  const server: TillServer = {
    batches: [],
    movements: [],
    signOffs: [],
    applied: new Map(),
    totals: new Map(),
  };
  const shifts = new Map<string, Record<string, unknown>>();
  // No till PINs unless a test installs them (`installTillPins`, which answers these after this does):
  // Prism's example would give the till a supervisor's PIN every test would then hold.
  api.respond('listTillPinVerifiers', (_request, path) => ({
    registerId: path.split('/')[2] ?? '',
    data: [],
    policy: { maxWrongTries: 5, lockedUntil: 'NEW_PIN_SET' },
    asOf: new Date().toISOString(),
  }));
  api.respond('reportTillPinEvents', () => ({
    eventResults: [],
    signOutResults: [],
    locked: [],
    serverTime: new Date().toISOString(),
  }));
  let receipt = 6200;
  api.rewrite('getOfflinePack', (body) => {
    const pack = body as {
      policy: { offlineTenderMethodIds: string[] };
      products: Record<string, unknown>[];
      reasonCodes: { code: string; domain: string }[];
    };
    return {
      ...pack,
      reasonCodes: [
        ...pack.reasonCodes.filter((reason) => reason.domain !== 'CASH_MOVEMENT'),
        ...CASH_REASONS,
      ],
      products: options.contractPack
        ? pack.products
        : options.products === undefined
          ? goatPricedPerHead(pack.products)
          : options.products(goatPricedPerHead(pack.products)),
      generatedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 24 * 3_600_000).toISOString(),
      policy: {
        ...pack.policy,
        offlineTenderMethodIds: options.offlineMobileMoney
          ? [...pack.policy.offlineTenderMethodIds, MOMO_METHOD_ID]
          : pack.policy.offlineTenderMethodIds,
      },
      // 2.24.0 (CR-033): the customer's receipt page.
      receiptLinkTemplate: RECEIPT_LINK_TEMPLATE,
    };
  });
  api.respond('openShift', (request) => {
    const body = request as {
      id: string;
      registerId: string;
      openingFloatPesewas: number;
      openedAt: string;
    };
    const shift = {
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
    shifts.set(body.id, shift);
    return shift;
  });
  const shiftOf = (path: string) => shifts.get(path.split('/')[2] ?? '');
  api.rewrite('getShift', (body, path) => shiftOf(path) ?? body);
  // 2.5.0: a drop, pay-out or pay-in on the open shift, once by id; the witness is named, not signed in.
  api.respond('recordCashMovement', (request) => {
    const body = request as SentMovement;
    const first = server.movements.find((movement) => movement.id === body.id);
    if (first === undefined) server.movements.push(body);
    const witness = [MANAGER].find((person) => person.id === body.witnessId) ?? null;
    return {
      id: body.id,
      kind: body.kind,
      amountPesewas: body.amountPesewas,
      reasonCode: body.reasonCode ?? null,
      note: body.note ?? null,
      witness,
      actor: CASHIER,
      occurredAt: body.occurredAt,
    };
  });
  api.respond('listShiftCashMovements', (_request, path) => {
    const float = Number(shiftOf(path)?.openingFloatPesewas ?? 0);
    const rows = server.movements.map((movement) => ({
      id: movement.id,
      kind: movement.kind,
      amountPesewas: movement.amountPesewas,
      reasonCode: movement.reasonCode ?? null,
      note: movement.note ?? null,
      witness: [MANAGER].find((person) => person.id === movement.witnessId) ?? null,
      actor: CASHIER,
      occurredAt: movement.occurredAt,
    }));
    const opening = {
      id: '019a7a96-0000-7000-8000-00000000f10a',
      kind: 'FLOAT_IN',
      amountPesewas: float,
      reasonCode: null,
      note: null,
      witness: null,
      actor: CASHIER,
      occurredAt: '2026-11-18T07:00:00Z',
    };
    return {
      data: [...rows.reverse(), opening],
      page: { nextCursor: null, limit: 25, hasMore: false },
    };
  });
  // Who can witness a drop now (CR-050, 2.17.0).
  api.respond('listShiftWitnesses', () => ({
    data: options.witnesses ?? [MANAGER],
    asOf: new Date().toISOString(),
  }));
  // The blind close: the answer, and only the answer, shows what was expected (a fixed short on cash).
  api.respond('closeShift', (request, path) => {
    const body = request as { declared: { paymentMethodId: string; declaredPesewas: number }[] };
    const open = shiftOf(path) ?? {};
    const tenders = body.declared.map((tender, index) => {
      const short = index === 0 ? SHORT_PESEWAS : 0;
      return {
        paymentMethod:
          index === 0
            ? { id: tender.paymentMethodId, code: 'CASH', name: 'Cash', kind: 'CASH' }
            : {
                id: tender.paymentMethodId,
                code: 'MOMO',
                name: 'Mobile money',
                kind: 'MOBILE_MONEY',
              },
        declaredPesewas: tender.declaredPesewas,
        expectedPesewas: tender.declaredPesewas + short,
        variancePesewas: short,
        varianceDirection: short === 0 ? 'EXACT' : 'SHORT',
      };
    });
    const cash = body.declared[0]?.declaredPesewas ?? 0;
    const closing = {
      ...open,
      status: 'CLOSING',
      declaredCashPesewas: cash,
      expectedCashPesewas: cash + SHORT_PESEWAS,
      overShortPesewas: SHORT_PESEWAS,
      overShortDirection: 'SHORT',
      tenders,
      version: 2,
    };
    shifts.set(String(open.id ?? ''), closing);
    return closing;
  });
  api.respond('approveShiftClose', (request, path) => {
    const closing = shiftOf(path) ?? {};
    server.signOffs.push({
      shiftId: String(closing.id ?? ''),
      reason: (request as { reason: string }).reason,
    });
    const closed = {
      ...closing,
      status: 'CLOSED',
      closedAt: new Date().toISOString(),
      closeApprovedBy: MANAGER,
      version: 3,
    };
    shifts.set(String(closing.id ?? ''), closed);
    return closed;
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
  await enrolTill(page);
  await page.getByRole('button', { name: 'Open the shift' }).click();
  await page
    .getByRole('dialog', { name: 'Open the shift with this float?' })
    .getByRole('button', { name: 'Open the shift' })
    .click();
  await expect(page.getByRole('heading', { name: 'Find an item' })).toBeVisible();
}

/**
 * The first half of `openTillShift`: the manager sets the till up, and the cashier signs in and enters a
 * GH₵200.00 float on the open screen, not yet confirmed.
 */
export async function enrolTill(page: Page): Promise<void> {
  await signInWithTotp(page, USERS.manager, '/pos');
  await expect(page.getByText('This till is not set up')).toBeVisible();
  await page.getByRole('link', { name: 'Set up this till' }).first().click();
  await page.getByRole('combobox', { name: /^Register/ }).click();
  await page.getByRole('option', { name: /^Shop till 1 \(T1\)/ }).click();
  await page.getByRole('textbox', { name: /^Name for this device/ }).fill('Counter tablet');
  await page.getByRole('button', { name: 'Set up this device' }).click();
  const confirm = page.getByRole('dialog', { name: 'Make this device a till?' });
  await confirm.getByRole('button', { name: 'Make this device a till' }).click();
  // 2.6.0: enrolling a device asks for a fresh step-up, then sends the same write again.
  await confirmStepUp(page);
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
}

/**
 * Finds an item the way a cashier does with no scanner (owner, 2026-11-17, ADR 0048): types into the sale
 * screen's search and taps the result. An animal or lot is found by its tag.
 */
export async function find(page: Page, query: string, result: string | RegExp): Promise<void> {
  await page.getByRole('searchbox', { name: /^Search by name, SKU or tag/ }).fill(query);
  await page
    .getByRole('list', { name: 'Items found' })
    .getByRole('button', { name: result })
    .click();
}
