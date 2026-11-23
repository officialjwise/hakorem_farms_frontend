/**
 * CR-063, the drivers who hold cash at the till's branch, as `docs/CONTRACT_REQUESTS.md` asks for it (ADR 0046,
 * ADR 0052). `handInDriverCash` (2.31.0, CR-057) takes the driver's id, but nothing the Cashier holds lists
 * the drivers: `listUsers` needs `iam.user.read`, and an order's delivery names no driver. Not in the contract
 * yet: the types are the request's, read only in a build switched on for CR-063, and this file goes when the
 * contract carries the operation.
 *
 * Names only, never an amount: the cashier counts the driver's cash blind, as the shift's close is counted,
 * and the hand-in's answer then shows what was expected.
 */
import type { components, RequestedOperation } from '@hakorem/api-client';
import { createRequestedQuery } from '@hakorem/data';
import { consoleApi } from '../data/api';
import { requestedOn } from './switch';

type Schemas = components['schemas'];

/** `listShiftDriverCashHolders`: GET /shifts/{id}/driver-cash-holders, on the cashier's own open shift. */
export const LIST_DRIVER_CASH_HOLDERS: RequestedOperation = {
  request: 'CR-063',
  operationId: 'listShiftDriverCashHolders',
  method: 'get',
  path: '/shifts/{id}/driver-cash-holders',
  permission: 'pos.sale.create',
  idempotent: false,
  csrf: 'none',
  public: false,
  body: 'none',
  device: true,
};

/** A driver who holds cash from deliveries at the shift's branch, not yet handed in. */
export interface DriverCashHolder {
  driver: Schemas['PrincipalRef'];
  /** How many collections they hold; never what they come to. */
  collections: number;
}

export interface DriverCashHolderList {
  data: DriverCashHolder[];
}

/** Whether this build can list the drivers (CR-063's switch). */
export function driverCashHoldersOn(): boolean {
  return requestedOn('CR-063');
}

/** Built in the shift screen's own module, which loads on demand (ADR 0031). */
const useRequestedQuery = createRequestedQuery(consoleApi);

export function useDriverCashHolders(shiftId: string, enabled: boolean) {
  return useRequestedQuery<DriverCashHolderList>(
    LIST_DRIVER_CASH_HOLDERS,
    { path: { id: shiftId } },
    { enabled: enabled && driverCashHoldersOn(), staleClass: 'live' },
  );
}
