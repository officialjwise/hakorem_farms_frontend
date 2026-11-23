/**
 * The driver's run for the F11 gate (ADR 0055): three stops from Kasoa and KNUST, eggs by the crate and by
 * the egg, and a server that applies each proof and failure once by its client id and answers a resend
 * `DUPLICATE`, as `syncDriverEvents` says. Prism keeps no state, so these answers are the fake's, in the
 * contract's shapes; every amount is the server's figure, fixed here as it would be at dispatch.
 */
import type { BrowserContext, Page, Route as PlaywrightRoute } from '@playwright/test';
import type { components } from '@hakorem/api-client';
import type { FakeApi } from './fakeApi';
import { signIn, USERS } from './helpers';

type S = components['schemas'];

export const DRIVER = { id: '019a7a87-46ad-7a19-bf51-aa66d1302344', displayName: 'Kwesi Appiah' };
const BRANCH = '019a7a83-2aef-79e3-9f1b-a708a7ae1fe6';
const VAN = {
  id: '019a7a84-9e23-708d-95c5-11a25bfa8a80',
  code: 'VAN-GT4521',
  name: 'Delivery van GT-4521-24',
  kind: 'VEHICLE',
} as const;
const ZONE = {
  id: '019a7a93-5c09-76f4-bc2c-78125a54f0f0',
  code: 'KSA',
  name: 'Kasoa and KNUST',
};

interface Stop {
  id: string;
  deliveryNo: string;
  orderId: string;
  orderNo: string;
  recipientName: string;
  recipientPhone: string;
  line1: string;
  area: string;
  city: string;
  from: string;
  to: string;
  contents: S['DeliveryContentsLine'][];
  codDuePesewas: number;
}

export const STOPS: readonly Stop[] = [
  {
    id: '019b1000-0000-7000-8000-000000000001',
    deliveryNo: 'DLN-2026-KSA-000201',
    orderId: '019b1000-0000-7000-8000-0000000000a1',
    orderNo: 'SO-2026-KSA-004301',
    recipientName: 'Asantewaa Boateng',
    recipientPhone: '+233557018924',
    line1: 'House 14, behind the Millennium City market',
    area: 'Millennium City',
    city: 'Kasoa',
    from: '09:00',
    to: '11:00',
    contents: [
      {
        orderLineId: '019b1000-0000-7000-8000-000000000901',
        name: 'Eggs, big',
        quantity: '12.000',
        uom: 'CRATE',
        weightKg: null,
      },
      {
        orderLineId: '019b1000-0000-7000-8000-000000000902',
        name: 'Eggs, big',
        quantity: '30.000',
        uom: 'EGG',
        weightKg: null,
      },
    ],
    // The server's figure for 12 crates and 30 eggs, fixed at dispatch.
    codDuePesewas: 78600,
  },
  {
    id: '019b1000-0000-7000-8000-000000000002',
    deliveryNo: 'DLN-2026-KSA-000202',
    orderId: '019b1000-0000-7000-8000-0000000000a2',
    orderNo: 'SO-2026-KSA-004302',
    recipientName: 'Kofi Mensah',
    recipientPhone: '+233244118302',
    line1: 'Ayeduase, opposite the KNUST hostel gate',
    area: 'Ayeduase',
    city: 'Kumasi',
    from: '11:00',
    to: '13:00',
    contents: [
      {
        orderLineId: '019b1000-0000-7000-8000-000000000903',
        name: 'Eggs, big',
        quantity: '2.000',
        uom: 'CRATE',
        weightKg: null,
      },
    ],
    codDuePesewas: 12000,
  },
  {
    id: '019b1000-0000-7000-8000-000000000003',
    deliveryNo: 'DLN-2026-KSA-000203',
    orderId: '019b1000-0000-7000-8000-0000000000a3',
    orderNo: 'SO-2026-KSA-004303',
    recipientName: 'Grace Nyarko',
    recipientPhone: '+233249903118',
    line1: 'Old Town, the blue gate by the clinic',
    area: 'Old Town',
    city: 'Kasoa',
    from: '13:00',
    to: '15:00',
    contents: [
      {
        orderLineId: '019b1000-0000-7000-8000-000000000904',
        name: 'Eggs, big',
        quantity: '1.000',
        uom: 'CRATE',
        weightKg: null,
      },
    ],
    codDuePesewas: 6000,
  },
];

/** The run's cash to collect, as the server states it on the route. */
export const RUN_COD_PESEWAS = 96600;

function delivery(stop: Stop, status: S['Delivery']['status']): S['Delivery'] {
  return {
    id: stop.id,
    deliveryNo: stop.deliveryNo,
    status,
    order: { id: stop.orderId, docType: 'SALES_ORDER', number: stop.orderNo },
    slot: {
      id: '019a7afd-16ee-736d-a8a6-3faf4a4fb88d',
      date: '2026-11-18',
      startsAt: stop.from,
      endsAt: stop.to,
      available: true,
      remaining: 4,
    },
    deliveryZone: ZONE,
    recipientName: stop.recipientName,
    recipientPhone: stop.recipientPhone,
    address: {
      recipientName: stop.recipientName,
      recipientPhone: stop.recipientPhone,
      line1: stop.line1,
      area: stop.area,
      city: stop.city,
      region: 'Central',
      digitalAddress: null,
      directions: null,
    },
    latitude: '5.534100',
    longitude: '-0.424500',
    contents: stop.contents,
    driver: DRIVER,
    vehicle: VAN,
    codDuePesewas: stop.codDuePesewas,
    codCollectedPesewas: null,
    attemptCount: 0,
    dispatchedAt: '2026-11-18T07:30:00Z',
    deliveredAt: null,
    proof: null,
    deliveryNoteDocumentId: null,
    currency: 'GHS',
    branchId: BRANCH,
    version: 2,
  };
}

/** What the fake server holds: each client id it applied, and how many times each was sent. */
export interface DriverServer {
  /** clientId → the delivery it closed, applied once. */
  applied: Map<string, string>;
  /** Every clientId sent in a `syncDriverEvents` body, in order, resends included. */
  sent: string[];
  /** The idempotency key of every `uploadFile` request that reached the server. */
  uploads: string[];
  /** Answers lost after the server acted. */
  lostAnswers: number;
}

const FILE_ID = '019b1000-0000-7000-8000-0000000000f1';

/**
 * Installs the run and a server with memory. `loseFirstSync` loses the first sync's answer after the
 * server applied it, so the phone must resend the same ids.
 */
export function installDriverServer(api: FakeApi, { loseFirstSync = false } = {}): DriverServer {
  const server: DriverServer = { applied: new Map(), sent: [], uploads: [], lostAnswers: 0 };
  const statusOf = (stop: Stop): S['Delivery']['status'] => {
    for (const [, deliveryId] of server.applied) if (deliveryId === stop.id) return 'DELIVERED';
    return 'ASSIGNED';
  };
  api.respond('getMyRoute', (): S['Route'] => ({
    id: '019b1000-0000-7000-8000-0000000000r1',
    driver: DRIVER,
    routeDate: '2026-11-18',
    vehicle: VAN,
    status: 'IN_PROGRESS',
    stops: STOPS.map((stop, index) => ({
      stopNo: index + 1,
      delivery: {
        id: stop.id,
        deliveryNo: stop.deliveryNo,
        recipientName: stop.recipientName,
        area: stop.area,
        status: statusOf(stop),
        codDuePesewas: stop.codDuePesewas,
        slotStartsAt: stop.from,
        slotEndsAt: stop.to,
      },
    })),
    codDueTotalPesewas: RUN_COD_PESEWAS,
    currency: 'GHS',
    branchId: BRANCH,
    version: 3,
  }));
  api.respond('getMyDelivery', (_request, path) => {
    const stop = STOPS.find((s) => path.endsWith(s.id));
    if (stop === undefined) throw new Error(`no stop for ${path}`);
    return delivery(stop, statusOf(stop));
  });
  api.respond('getMyCashSummary', (): S['DriverCashSummary'] => ({
    driver: DRIVER,
    date: '2026-11-18',
    expectedPesewas: 0,
    collections: [],
    reconciled: false,
    currency: 'GHS',
  }));
  api.respond('listReasonCodes', (): S['ReasonCodePage'] => ({
    data: [
      {
        code: 'CUSTOMER_REFUSED',
        domain: 'DELIVERY_FAILURE',
        description: 'The customer refused it',
        requiresNote: false,
        lossAccountGroup: null,
      },
      {
        code: 'CUSTOMER_NOT_AVAILABLE',
        domain: 'DELIVERY_FAILURE',
        description: 'Nobody was there',
        requiresNote: false,
        lossAccountGroup: null,
      },
    ],
    page: { nextCursor: null, limit: 100, hasMore: false },
  }));
  api.respond('markOnTheWay', (_request, path) => {
    const stop = STOPS.find((s) => path.includes(s.id)) ?? STOPS[0];
    return delivery(stop as Stop, 'OUT_FOR_DELIVERY');
  });
  api.respond('uploadFile', (): S['StoredFile'] => ({
    id: FILE_ID,
    originalName: 'proof.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 1024,
    purpose: 'PROOF_OF_DELIVERY',
    classification: 'CONFIDENTIAL',
    scanStatus: 'PENDING',
    createdAt: '2026-11-18T10:00:00Z',
  }));
  let syncs = 0;
  api.respond('syncDriverEvents', (request): S['DriverSyncResult'] => {
    const body = request as S['DriverSyncBatch'];
    syncs += 1;
    const items = [
      ...body.proofs.map((p) => ({ clientId: p.proof.id, deliveryId: p.deliveryId })),
      ...body.failures.map((f) => ({ clientId: f.failure.id, deliveryId: f.deliveryId })),
    ];
    const results = items.map((item) => {
      server.sent.push(item.clientId);
      const seen = server.applied.has(item.clientId);
      if (!seen) server.applied.set(item.clientId, item.deliveryId);
      const proof = body.proofs.find((p) => p.proof.id === item.clientId)?.proof;
      const due = STOPS.find((s) => s.id === item.deliveryId)?.codDuePesewas;
      const differs = proof !== undefined && due !== undefined && proof.codCollectedPesewas !== due;
      return {
        ...item,
        outcome: seen
          ? ('DUPLICATE' as const)
          : differs
            ? ('APPLIED_WITH_EXCEPTION' as const)
            : ('APPLIED' as const),
        reason: differs && !seen ? 'Cash collected differs from the amount due.' : null,
      };
    });
    if (loseFirstSync && syncs === 1) {
      server.lostAnswers += 1;
      api.loseNextAnswer('syncDriverEvents');
    }
    return { results, serverTime: '2026-11-18T12:00:00Z' };
  });
  return server;
}

/**
 * One bar of signal: every request to the driver's operations waits, and every third one is dropped on
 * the way out, before the server sees it. Chromium's own throttle slows the page's requests too.
 */
export async function oneBarOfSignal(page: Page, context: BrowserContext, server: DriverServer) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 800,
    downloadThroughput: (50 * 1024) / 8,
    uploadThroughput: (20 * 1024) / 8,
  });
  let count = 0;
  await context.route(/\/mock\/(driver|files)(\/|$|\?)/, async (route: PlaywrightRoute) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    count += 1;
    if (route.request().url().includes('/mock/files')) {
      // Only an upload that reaches the server counts; a dropped one never arrived.
      if (count % 3 !== 0) {
        server.uploads.push((await route.request().allHeaders())['idempotency-key'] ?? '');
      }
    }
    if (count % 3 === 0) return route.abort('connectionreset');
    return route.fallback();
  });
  return cdp;
}

/** Signs the driver in on their phone, onto today's run. */
export async function openRun(page: Page) {
  await signIn(page, USERS.driver, '/driver');
  await page.getByRole('heading', { level: 1, name: "Today's run" }).waitFor();
}

/** A small JPEG: the photograph of the delivery. */
export const PHOTO = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);
