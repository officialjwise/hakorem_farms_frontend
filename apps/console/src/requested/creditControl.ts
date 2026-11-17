/**
 * CR-046, credit control on an order, as `docs/CONTRACT_REQUESTS.md` asks for it (ADR 0046, ADR 0052,
 * ADR 0053): the server's credit check of an order with the amount over, and an override asked for with a
 * reason. Not in the contract yet: these types are the request's, used only in a build switched on for
 * CR-046, and this file goes when the contract carries `getOrderCreditCheck`. Every figure is the server's.
 */
import type { components, RequestedOperation } from '@hakorem/api-client';
import { createRequestedMutation, createRequestedQuery } from '@hakorem/data';
import { consoleApi } from '../data/api';
import { requestedOn } from './switch';

type Schemas = components['schemas'];

/** `getOrderCreditCheck`: the order's credit check as `confirmOrder` would judge it now. */
export const GET_ORDER_CREDIT_CHECK: RequestedOperation = {
  request: 'CR-046',
  operationId: 'getOrderCreditCheck',
  method: 'get',
  path: '/orders/{id}/credit-check',
  permission: 'ord.order.read',
  idempotent: false,
  csrf: 'none',
  public: false,
  body: 'none',
  device: false,
};

/** `requestCreditOverride`: ask for a credit override, with a reason; 202 `ApprovalPending`. */
export const REQUEST_CREDIT_OVERRIDE: RequestedOperation = {
  request: 'CR-046',
  operationId: 'requestCreditOverride',
  method: 'post',
  path: '/orders/{id}/credit-override',
  permission: 'ord.order.confirm',
  idempotent: true,
  csrf: 'required',
  public: false,
  body: 'json',
  device: false,
};

/** The refusal codes `confirmOrder` answers for a credit order it will not confirm (CR-046). */
export const CREDIT_REFUSALS = [
  'CREDIT_LIMIT_EXCEEDED',
  'CREDIT_TERMS_EXCEEDED',
  'ACCOUNT_ON_HOLD',
] as const;

export interface CreditOverrideState {
  approvalRequestId: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
  reason: string;
  requestedBy: Schemas['PrincipalRef'];
  requestedAt: string;
  decidedBy: Schemas['PrincipalRef'] | null;
  decidedAt: string | null;
}

/** `OrderCreditCheck`, in integer pesewas, never negative: each figure's direction is in its name. */
export interface OrderCreditCheck {
  order: Schemas['DocumentRef'];
  customer: Schemas['CustomerRef'];
  outcome: 'PASSES' | 'OVER_LIMIT' | 'PAST_TERMS' | 'ON_HOLD' | 'NOT_REQUIRED';
  creditLimitPesewas: Schemas['Pesewas'];
  /** Outstanding invoices plus confirmed orders, before this order. */
  exposurePesewas: Schemas['Pesewas'];
  /** This order's estimated total, as the limit counts it. */
  orderPesewas: Schemas['Pesewas'];
  /** By how much the exposure with this order exceeds the limit; 0 when within it. */
  overLimitPesewas: Schemas['Pesewas'];
  overduePesewas: Schemas['Pesewas'];
  oldestOverdueDays: number | null;
  paymentTermsDays: number;
  override: CreditOverrideState | null;
  checkedAt: string;
  currency: Schemas['Currency'];
}

/** `CreditOverride` with the fields CR-046 adds, read only in a build switched on for it. */
export type CreditOverrideWithReason = Schemas['CreditOverride'] & {
  reason?: string;
  requestedBy?: Schemas['PrincipalRef'];
  overLimitPesewas?: Schemas['Pesewas'];
};

/** Built here, in the back office's own module, so the till never carries them (ADR 0052, ADR 0053). */
const useRequestedQuery = createRequestedQuery(consoleApi);
const useRequestedMutation = createRequestedMutation(consoleApi);

/** Whether this build reads the credit check and can ask for an override (CR-046's switch). */
export function creditControlOn(): boolean {
  return requestedOn('CR-046');
}

/** The order's credit check in a build switched on for CR-046; with it off nothing is asked. */
export function useOrderCreditCheck(orderId: string, enabled = true) {
  return useRequestedQuery<OrderCreditCheck>(
    GET_ORDER_CREDIT_CHECK,
    { path: { id: orderId } },
    { enabled: enabled && creditControlOn() },
  );
}

/** Ask for a credit override on the order, with a reason. Refetches the check and the order. */
export function useRequestCreditOverride() {
  return useRequestedMutation<Schemas['ApprovalPending']>(REQUEST_CREDIT_OVERRIDE, {
    invalidates: [GET_ORDER_CREDIT_CHECK.operationId, 'getOrder', 'listCreditOverrides'],
  });
}
