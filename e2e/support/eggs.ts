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
  kind: 'STORE',
};
export const ORDER_ID = '019a7ab4-96c6-764d-ab85-6daa1377e687';
export const ORDER_LINE_ID = '019a7ab5-0c1e-7d3a-9b2f-4e6a8c1d2f30';

/** The big eggs as the seed holds them: counted per egg, sold by the crate (2.1.0). */
export function asSeededEggs<T extends { id: string; baseUom: string; name: string }>(
  product: T,
): T {
  return product.id === EGGS_ID
    ? { ...product, name: EGGS_REF.name, baseUom: 'UNIT', saleUom: 'CRATE' }
    : product;
}

/** `listProducts` with the eggs in the seed's shape. */
export function seedEggs(api: FakeApi): void {
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
          toUom: 'UNIT',
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
        baseUom: 'UNIT',
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
