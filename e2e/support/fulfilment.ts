/**
 * An online order of eggs for the F11 back office specs: 12 crates and 30 single eggs, cash on delivery,
 * to Kasoa, and its pick list at the egg store. Every amount is the server's figure. Prism's examples
 * are of a chicken pack, so these are the fake's answers, in the contract's shapes.
 */
import type { components } from '@hakorem/api-client';
import type { FakeApi } from './fakeApi';
import { DRIVER, STOPS } from './driver';

type S = components['schemas'];

export const EGGS = {
  id: '019a7a8d-ae28-7631-8b69-6be302d5e4c0',
  sku: 'EGG-0001',
  name: 'Eggs, big',
};
const BRANCH = '019a7a83-2aef-79e3-9f1b-a708a7ae1fe6';
export const ORDER_ID = '019b2000-0000-7000-8000-0000000000a1';
export const FULFILMENT_ID = '019b2000-0000-7000-8000-0000000000f1';
export const CRATE_LINE = '019b2000-0000-7000-8000-0000000000c1';
export const EGG_LINE = '019b2000-0000-7000-8000-0000000000e1';
export const EGG_STORE = {
  id: '019b2000-0000-7000-8000-0000000000b1',
  code: 'EGG-STORE',
  name: 'Egg store',
  kind: 'STORE',
} as const;
export const VAN = {
  id: '019a7a84-9e23-708d-95c5-11a25bfa8a80',
  code: 'VAN-GT4521',
  name: 'Delivery van GT-4521-24',
  kind: 'VEHICLE',
} as const;

function line(
  id: string,
  lineNo: number,
  qty: string,
  uom: string,
  unitPrice: number,
  total: number,
): S['OrderLine'] {
  return {
    id,
    lineNo,
    product: EGGS,
    stockUnit: null,
    qtyOrdered: qty,
    uom,
    estimatedWeightKg: null,
    tolerancePercent: null,
    qtyFulfilled: '0.000',
    fulfilledWeightKg: null,
    weightSource: null,
    qtyBackordered: '0.000',
    priceSource: 'ENGINE',
    priceBasis: 'PER_UNIT',
    priceListEntryId: null,
    quoteLineId: null,
    resolvedUnitPricePesewas: unitPrice,
    floorUnitPricePesewas: unitPrice,
    ceilingUnitPricePesewas: unitPrice,
    agreedUnitPricePesewas: unitPrice,
    variancePesewas: 0,
    varianceDirection: null,
    varianceReasonCode: null,
    varianceApprovalRequestId: null,
    discountPesewas: 0,
    estimatedLineTotalPesewas: total,
    finalLineTotalPesewas: null,
    lineStatus: 'OPEN',
    stockException: null,
  };
}

export function eggOrder(status: S['SalesOrder']['status']): S['SalesOrder'] {
  return {
    id: ORDER_ID,
    orderNo: 'SO-2026-KSA-004310',
    channel: 'ONLINE',
    status,
    paymentStatus: 'UNPAID',
    customer: null,
    contactName: 'Asantewaa Boateng',
    contactPhone: '+233557018924',
    paymentTerms: 'COD',
    fulfilmentMode: 'DELIVERY',
    source: null,
    parentOrderId: null,
    shiftId: null,
    salesperson: null,
    deliveryAddress: {
      recipientName: 'Asantewaa Boateng',
      recipientPhone: '+233557018924',
      line1: 'House 14, behind the Millennium City market',
      area: 'Millennium City',
      city: 'Kasoa',
      region: 'Central',
      digitalAddress: null,
      directions: null,
    },
    deliveryZone: { id: '019a7a93-5c09-76f4-bc2c-78125a54f0f0', code: 'KSA', name: 'Kasoa' },
    deliveryFeePesewas: 1500,
    delivery: null,
    taxInclusive: true,
    estimatedTotalPesewas: 80100,
    maximumTotalPesewas: 80100,
    finalTotalPesewas: null,
    paidPesewas: 0,
    outstandingPesewas: 80100,
    currency: 'GHS',
    billingDocument: null,
    creditCheck: 'NOT_REQUIRED',
    isOffline: false,
    placedAt: '2026-11-18T06:40:00Z',
    completedAt: null,
    recordedAt: '2026-11-18T06:40:00Z',
    lines: [
      line(CRATE_LINE, 1, '12.000', 'CRATE', 6000, 72000),
      line(EGG_LINE, 2, '30.000', 'EGG', 220, 6600),
    ],
    adjustments: [],
    notes: null,
    branchId: BRANCH,
    version: 4,
  };
}

export function eggPickList(status: S['Fulfilment']['status']): S['Fulfilment'] {
  return {
    id: FULFILMENT_ID,
    fulfilmentNo: 'PCK-2026-KSA-000412',
    order: { id: ORDER_ID, docType: 'SALES_ORDER', number: 'SO-2026-KSA-004310' },
    status,
    pickLocation: EGG_STORE,
    picker: { id: '019a7a86-5b10-7c21-8d44-0b2f0e5c7a11', displayName: 'Yaw Boateng' },
    pickList: [
      {
        orderLineId: CRATE_LINE,
        product: EGGS,
        qtyToPick: '12.000',
        uom: 'CRATE',
        estimatedWeightKg: null,
        suggestedStockUnits: [],
      },
      {
        orderLineId: EGG_LINE,
        product: EGGS,
        qtyToPick: '30.000',
        uom: 'EGG',
        estimatedWeightKg: null,
        suggestedStockUnits: [],
      },
    ],
    lines: [],
    weighedTotalPesewas: null,
    withinTolerance: null,
    pickedAt: null,
    packedAt: null,
    dispatchedAt: null,
    packageCount: null,
    currency: 'GHS',
    branchId: BRANCH,
    version: 1,
  };
}

/** What the back office sent, by operation, for the spec to check. */
export type Sent = Record<string, unknown[]>;

/** The order, its pick list, the eggs, the stores and the drivers, answered from fixtures. */
export function installOrderServer(
  api: FakeApi,
  status: S['SalesOrder']['status'] = 'CONFIRMED',
): Sent {
  const sent: Sent = {};
  const keep = (op: string) => (request: unknown) => {
    (sent[op] ??= []).push(request);
  };
  let orderStatus = status;
  api.respond('getOrder', () => eggOrder(orderStatus));
  api.rewrite('listOrders', (body) => ({
    ...(body as S['SalesOrderPage']),
    data: [eggOrder(orderStatus)],
  }));
  api.respond('listOrderHistory', (): S['OrderStatusChangePage'] => ({
    data: [
      {
        fromStatus: null,
        toStatus: 'PLACED',
        reason: null,
        actor: { id: '019a7a86-0000-7000-8000-000000000099', displayName: 'Online shop' },
        occurredAt: '2026-11-18T06:40:00Z',
      },
    ],
    page: { nextCursor: null, limit: 100, hasMore: false },
  }));
  let fulfilments: S['Fulfilment'][] = [];
  api.respond('listFulfilments', (): S['FulfilmentPage'] => ({
    data: fulfilments,
    page: { nextCursor: null, limit: 100, hasMore: false },
  }));
  api.respond('createFulfilment', (request) => {
    keep('createFulfilment')(request);
    fulfilments = [eggPickList('PICK_LIST')];
    return eggPickList('PICK_LIST');
  });
  api.respond('getFulfilment', () => eggPickList('PICKING'));
  api.respond('recordPicks', (request) => {
    keep('recordPicks')(request);
    return eggPickList('PICKING');
  });
  api.respond('proposeSubstitution', (request) => {
    keep('proposeSubstitution')(request);
    orderStatus = 'AWAITING_CUSTOMER';
    return eggOrder(orderStatus);
  });
  api.respond('recordCustomerConsent', (request) => {
    keep('recordCustomerConsent')(request);
    orderStatus = 'PICKING';
    return eggOrder(orderStatus);
  });
  api.rewrite('listLocations', (body) => ({
    ...(body as S['LocationPage']),
    data: [
      { ...(body as S['LocationPage']).data[0], ...EGG_STORE },
      { ...(body as S['LocationPage']).data[0], ...VAN },
    ],
  }));
  api.rewrite('getProduct', (body) => ({
    ...(body as S['Product']),
    id: EGGS.id,
    sku: EGGS.sku,
    name: EGGS.name,
    baseUom: 'EGG',
    saleUom: 'CRATE',
  }));
  api.respond('createStockAdjustment', (request) => {
    keep('createStockAdjustment')(request);
    return {
      id: '019b2000-0000-7000-8000-0000000000d1',
      adjustmentNo: null,
      status: 'DRAFT',
      location: EGG_STORE,
      reasonCode: 'BREAKAGE',
      note: null,
      totalValuePesewas: 0,
      currency: 'GHS',
      approvalRequestId: null,
      exceptionId: null,
      lines: [],
      branchId: BRANCH,
      version: 1,
      createdAt: '2026-11-18T08:00:00Z',
      createdBy: { id: '019a7a86-5b10-7c21-8d44-0b2f0e5c7a11', displayName: 'Yaw Boateng' },
      postedAt: null,
      postedBy: null,
    } satisfies S['StockAdjustment'];
  });
  api.respond('submitStockAdjustment', (request, path) => {
    keep('submitStockAdjustment')(path);
    return {
      id: '019b2000-0000-7000-8000-0000000000d1',
      adjustmentNo: 'ADJ-2026-KSA-000088',
      status: 'POSTED',
      location: EGG_STORE,
      reasonCode: 'BREAKAGE',
      note: null,
      totalValuePesewas: 510,
      currency: 'GHS',
      approvalRequestId: null,
      exceptionId: null,
      lines: [],
      branchId: BRANCH,
      version: 2,
      createdAt: '2026-11-18T08:00:00Z',
      createdBy: { id: '019a7a86-5b10-7c21-8d44-0b2f0e5c7a11', displayName: 'Yaw Boateng' },
      postedAt: '2026-11-18T08:00:05Z',
      postedBy: { id: '019a7a86-5b10-7c21-8d44-0b2f0e5c7a11', displayName: 'Yaw Boateng' },
    } satisfies S['StockAdjustment'];
  });
  return sent;
}

/** The day's deliveries and a driver to put them on a run with. */
export function installDispatchServer(api: FakeApi): Sent {
  const sent: Sent = {};
  api.respond('listDeliveries', (): S['DeliveryPage'] => ({
    data: STOPS.map((stop) => ({
      id: stop.id,
      deliveryNo: stop.deliveryNo,
      status: 'SCHEDULED',
      order: { id: stop.orderId, docType: 'SALES_ORDER', number: stop.orderNo },
      slot: {
        id: '019a7afd-16ee-736d-a8a6-3faf4a4fb88d',
        date: '2026-11-18',
        startsAt: stop.from,
        endsAt: stop.to,
        available: true,
        remaining: 4,
      },
      deliveryZone: { id: '019a7a93-5c09-76f4-bc2c-78125a54f0f0', code: 'KSA', name: 'Kasoa' },
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
      latitude: null,
      longitude: null,
      contents: stop.contents,
      driver: null,
      vehicle: null,
      codDuePesewas: stop.codDuePesewas,
      codCollectedPesewas: null,
      attemptCount: 0,
      dispatchedAt: null,
      deliveredAt: null,
      proof: null,
      deliveryNoteDocumentId: null,
      currency: 'GHS',
      branchId: BRANCH,
      version: 1,
    })),
    page: { nextCursor: null, limit: 50, hasMore: false },
  }));
  api.rewrite('listUsers', (body) => {
    const page = body as S['UserAccountPage'];
    const someone = page.data[0] as S['UserAccount'];
    return {
      ...page,
      data: [
        ...page.data,
        {
          ...someone,
          id: DRIVER.id,
          displayName: DRIVER.displayName,
          status: 'ACTIVE',
          grants: [
            {
              roleCode: 'DRIVER',
              roleName: 'Driver',
              branchId: BRANCH,
              branchCode: 'KSA',
              locationId: null,
              locationCode: null,
            },
          ],
        },
      ],
    };
  });
  api.rewrite('listLocations', (body) => ({
    ...(body as S['LocationPage']),
    data: [{ ...(body as S['LocationPage']).data[0], ...VAN }],
  }));
  const route = (order: string[], status: S['Route']['status']): S['Route'] => ({
    id: '019b3000-0000-7000-8000-0000000000r1',
    driver: DRIVER,
    routeDate: '2026-11-18',
    vehicle: VAN,
    status,
    stops: order.map((id, index) => {
      const stop = STOPS.find((s) => s.id === id) ?? STOPS[0];
      return {
        stopNo: index + 1,
        delivery: {
          id,
          deliveryNo: stop?.deliveryNo ?? null,
          recipientName: stop?.recipientName ?? '',
          area: stop?.area ?? '',
          status: 'ASSIGNED',
          codDuePesewas: stop?.codDuePesewas ?? 0,
          slotStartsAt: stop?.from ?? '09:00',
          slotEndsAt: stop?.to ?? '11:00',
        },
      };
    }),
    codDueTotalPesewas: 84600,
    currency: 'GHS',
    branchId: BRANCH,
    version: 1,
  });
  let order: string[] = [];
  let status: S['Route']['status'] = 'PLANNED';
  api.respond('createRoute', (request) => {
    (sent['createRoute'] ??= []).push(request);
    order = (request as S['RouteCreate']).deliveryIds;
    return route(order, status);
  });
  api.respond('getRoute', () => route(order, status));
  api.respond('reorderRouteStops', (request) => {
    (sent['reorderRouteStops'] ??= []).push(request);
    order = (request as S['RouteStopsReplace']).deliveryIds;
    return route(order, status);
  });
  api.respond('startRoute', (request) => {
    (sent['startRoute'] ??= []).push(request);
    status = 'IN_PROGRESS';
    return route(order, status);
  });
  return sent;
}
