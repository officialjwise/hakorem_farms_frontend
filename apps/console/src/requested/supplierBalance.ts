/**
 * CR-042, a supplier's balance, as `docs/CONTRACT_REQUESTS.md` asks for it (ADR 0046, ADR 0052). Not in the
 * contract yet: these types are the request's, read only in a build switched on for CR-042, and this file
 * goes when the contract carries `getSupplierBalance`. Every figure is the server's; nothing here adds one.
 */
import type { components, RequestedOperation } from '@hakorem/api-client';
import { createRequestedQuery } from '@hakorem/data';
import { consoleApi } from '../data/api';
import { requestedOn } from './switch';

type Schemas = components['schemas'];

/** `getSupplierBalance`: what the farm owes a supplier, has claimed from it, has in payment and has paid. */
export const GET_SUPPLIER_BALANCE: RequestedOperation = {
  request: 'CR-042',
  operationId: 'getSupplierBalance',
  method: 'get',
  path: '/suppliers/{id}/balance',
  permission: 'pur.supplier_invoice.read',
  idempotent: false,
  csrf: 'none',
  public: false,
  body: 'none',
  device: false,
};

/** `SupplierBalance`, in integer pesewas, never negative: each figure's direction is in its name. */
export interface SupplierBalance {
  supplier: Schemas['SupplierRef'];
  /** When the server worked it out. */
  asOf: string;
  /** What is still owed on the supplier's approved invoices, after credits and payments. */
  owedPesewas: Schemas['Pesewas'];
  /** The gross of invoices entered and not yet approved for payment. */
  awaitingApprovalPesewas: Schemas['Pesewas'];
  /** What the supplier's open claims ask it to credit. */
  claimedPesewas: Schemas['Pesewas'];
  /** Payments waiting for approval or approved, not yet paid. */
  inPaymentPesewas: Schemas['Pesewas'];
  /** What has been paid to the supplier. */
  paidPesewas: Schemas['Pesewas'];
  currency: Schemas['Currency'];
}

/** Built here, in the back office's own module, so the till never carries it (ADR 0052). */
const useRequestedQuery = createRequestedQuery(consoleApi);

/** Whether this build reads the balance (CR-042's switch). */
export function supplierBalanceOn(): boolean {
  return requestedOn('CR-042');
}

/**
 * The supplier's balance in a build switched on for CR-042. With the switch off nothing is asked, and the
 * screen says in words that the balance waits for the server.
 */
export function useSupplierBalance(supplierId: string, enabled = true) {
  return useRequestedQuery<SupplierBalance>(
    GET_SUPPLIER_BALANCE,
    { path: { id: supplierId } },
    { enabled: enabled && supplierBalanceOn() },
  );
}
