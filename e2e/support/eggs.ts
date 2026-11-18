/**
 * The egg screens' fixtures (ADR 0049, contract 2.1.0 to 2.3.0). The contract's examples still show the
 * big eggs as a product counted by the crate (`baseUom: CRATE`); 2.1.0 says the seed counts them per egg
 * with a crate of 30 ("Examples that still show eggs in crates are examples, not the seed"). These
 * rewrite the examples into the seed's shape, keeping every other field the contract's. Prices and totals
 * here are the API's answers, stated as the server would give them; the screens never work one out.
 */
import type { components } from '@hakorem/api-client';
import type { FakeApi } from './fakeApi';

type S = components['schemas'];

export const EGGS_ID = '019a7a8d-ae28-7631-8b69-6be302d5e4c0';
export const EGGS_REF = { id: EGGS_ID, sku: 'EGG-0003', name: 'Eggs, big' };
export const SUPPLIER = {
  id: '019a7a89-16ae-7e6d-a3a5-efa6f28f6884',
  publicId: 'sup_TGKEXYTAZ99G0NNC',
  name: 'Awutu Poultry Farm',
};
export const STORE = {
  id: '019a7a84-6045-7cc6-b1fe-d53368984e11',
  code: 'STORE-1',
  name: 'Feed and produce store',
  kind: 'STORE' as const,
};
export const ORDER_ID = '019a7ab4-96c6-764d-ab85-6daa1377e687';
export const ORDER_LINE_ID = '019a7ab5-0c1e-7d3a-9b2f-4e6a8c1d2f30';

/** The big eggs as the seed holds them: counted per egg, sold by the crate (2.1.0). */
export function asSeededEggs<T extends { id: string; baseUom: string; name: string }>(
  product: T,
): T {
  return product.id === EGGS_ID
    ? { ...product, name: EGGS_REF.name, baseUom: 'EGG', saleUom: 'CRATE' }
    : product;
}

/** `listProducts` with the eggs in the seed's shape, and the store they are delivered to. */
export function seedEggs(api: FakeApi): void {
  // The contract's location example lists the farm and its pens; the eggs come into the store.
  api.rewrite('listLocations', (body) => {
    const page = body as { data: Record<string, unknown>[] };
    const first = page.data[0];
    if (first === undefined || page.data.some((l) => l.id === STORE.id)) return page;
    return { ...page, data: [...page.data, { ...first, ...STORE }] };
  });
  api.rewrite('listProducts', (body) => {
    const page = body as { data: S['Product'][] };
    return { ...page, data: page.data.map(asSeededEggs) };
  });
  api.rewrite('getProduct', (body) => asSeededEggs(body as S['Product']));
  // A crate of 30 eggs, the conversion the seed holds (2.1.0: "a conversion of 30").
  api.rewrite('listUomConversions', (body) => {
    const page = body as { data: S['UomConversion'][] };
    const first = page.data[0];
    if (first === undefined) return page;
    return {
      ...page,
      data: [
        ...page.data,
        {
          ...first,
          id: '019a7f10-4c55-7a10-9e21-3b4c5d6e7f80',
          product: EGGS_REF,
          fromUom: 'CRATE',
          toUom: 'EGG',
          numerator: 30,
          denominator: 1,
          factor: '30.000',
        },
      ],
    };
  });
}

/** A purchase order for 20 crates of big eggs at the last price paid, as the API answers it. */
export function eggOrder(base: S['PurchaseOrder'], status: S['PurchaseOrder']['status']) {
  const line = base.lines[0];
  if (line === undefined) throw new Error('The purchase order example has no line.');
  return {
    ...base,
    id: ORDER_ID,
    orderNo: 'PO-2026-DDW-000052',
    status,
    supplier: SUPPLIER,
    deliverToLocation: STORE,
    orderDate: '2026-11-17',
    expectedOn: '2026-11-18',
    // 20 crates at GHS 47.50, no levy on eggs: the server's sums.
    netPesewas: 95000,
    taxPesewas: 0,
    grossPesewas: 95000,
    approvalRequestId: null,
    sentAt: status === 'SENT' ? '2026-11-17T09:30:00Z' : null,
    lines: [
      {
        ...line,
        id: ORDER_LINE_ID,
        product: EGGS_REF,
        qtyOrdered: '20.000',
        uom: 'CRATE',
        baseUom: 'EGG',
        qtyOrderedBase: '600.000',
        qtyReceived: '0.000',
        qtyInvoiced: '0.000',
        qtyOutstanding: '600.000',
        unitPricePesewas: 4750,
        lineNetPesewas: 95000,
      },
    ],
  };
}

/**
 * The big eggs' prices in a list, as the API answers them (2.1.0): a crate, a crate from 10 crates for a
 * bulk buyer (stored as 300 eggs), and a single egg, each its own entry and its own price.
 */
export function eggEntries(base: S['PriceListEntry']): S['PriceListEntry'][] {
  const egg = {
    ...base,
    product: EGGS_REF,
    grade: null,
    weightBand: null,
    basis: 'PER_UNIT' as const,
    quoteOnly: false,
  };
  return [
    {
      ...egg,
      id: '019a7aa6-0e11-7c20-8a31-0b2c3d4e5f61',
      uom: 'CRATE',
      minQty: '0.000',
      minQtyBase: '0.000',
      listPricePesewas: 6000,
      floorPricePesewas: 5500,
      ceilingPricePesewas: 6500,
    },
    {
      ...egg,
      id: '019a7aa6-2d33-7c20-8a31-0b2c3d4e5f62',
      uom: 'CRATE',
      minQty: '10.000',
      minQtyBase: '300.000',
      listPricePesewas: 5500,
      floorPricePesewas: 5200,
      ceilingPricePesewas: 6000,
    },
    {
      ...egg,
      id: '019a7aa6-4c55-7c20-8a31-0b2c3d4e5f63',
      uom: 'EGG',
      minQty: '0.000',
      minQtyBase: '0.000',
      listPricePesewas: 220,
      floorPricePesewas: 200,
      ceilingPricePesewas: 250,
    },
  ];
}

/**
 * CR-038, requested (ADR 0046): the till's pack with the big eggs sold by the crate and by the egg, each
 * with its own band. The crate's band is the pack example's own; the single egg's is the seed's egg price
 * (2.1.0: "their prices are a crate's and a single egg's").
 */
export function eggsByTheEgg(products: Record<string, unknown>[]): Record<string, unknown>[] {
  return products.map((entry) => {
    const product = entry.product as { id: string };
    if (product.id !== EGGS_ID) return entry;
    return {
      ...entry,
      product: EGGS_REF,
      sellingUnits: [
        {
          uom: 'CRATE',
          priceListEntryId: entry.priceListEntryId,
          priceBand: entry.priceBand,
          quoteOnly: false,
        },
        {
          uom: 'EGG',
          priceListEntryId: '019a7aa6-4c55-7c20-8a31-0b2c3d4e5f63',
          priceBand: {
            listPricePesewas: 220,
            floorPricePesewas: 200,
            ceilingPricePesewas: 250,
            basis: 'PER_UNIT',
          },
          quoteOnly: false,
        },
      ],
    };
  });
}

/** The receipt against that order as the server answers it: 18 crates in (540 eggs), 2 cracked turned away. */
export function eggReceipt(receipt: S['GoodsReceipt']): S['GoodsReceipt'] {
  const line = receipt.lines[0];
  if (line === undefined) return receipt;
  return {
    ...receipt,
    status: 'DRAFT',
    receiptNo: null,
    supplier: SUPPLIER,
    location: STORE,
    purchaseOrder: { id: ORDER_ID, docType: 'PURCHASE_ORDER', number: 'PO-2026-DDW-000052' },
    lines: [
      {
        ...line,
        product: EGGS_REF,
        purchaseOrderLineId: ORDER_LINE_ID,
        uom: 'CRATE',
        baseUom: 'EGG',
        qtyReceived: '18.000',
        qtyRejected: '2.000',
        qtyReceivedBase: '540.000',
        qtyRejectedBase: '60.000',
        rejectionReasonCode: 'CRACKED',
        rejectionNote: null,
        weightKg: null,
        weightSource: null,
        valuePesewas: 85500,
        animals: [],
      },
    ],
    totalValuePesewas: 85500,
    postedAt: null,
    postedBy: null,
  };
}
