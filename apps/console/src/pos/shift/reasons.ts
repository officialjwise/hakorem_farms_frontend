import type { components } from '@hakorem/api-client';

type ReasonCode = components['schemas']['ReasonCode'];
export type MovementKind = components['schemas']['CashMovementCreate']['kind'];

/**
 * Which `CASH_MOVEMENT` reasons fit which kind, as `CashMovementCreate.reasonCode`'s description says in 2.5.0
 * (the backend's A-273 (c)): a drop is `SAFE_DROP`; a pay-out is fuel, a supplier or another expense; a
 * pay-in is only float from the safe. A reason fits no other kind (`REASON_NOT_FOR_KIND`), and one on the
 * list that fits none (`BANK_DEPOSIT`, `CHANGE_PURCHASE`) is never offered.
 */
export const REASONS_FOR_KIND: Record<MovementKind, readonly string[]> = {
  CASH_DROP: ['SAFE_DROP'],
  PAY_OUT: ['FUEL_PAYOUT', 'SUPPLIER_PAYOUT', 'OTHER_PAYOUT'],
  PAY_IN: ['FLOAT_TOP_UP'],
};

export const MOVEMENT_KINDS: readonly MovementKind[] = ['CASH_DROP', 'PAY_OUT', 'PAY_IN'];

/** The reasons a kind may take, from those the till holds or read, once each, in the contract's order. */
export function reasonsFor(kind: MovementKind, held: readonly ReasonCode[]): ReasonCode[] {
  return REASONS_FOR_KIND[kind].flatMap((code) => {
    const found = held.find((reason) => reason.code === code && reason.domain === 'CASH_MOVEMENT');
    return found === undefined ? [] : [found];
  });
}
