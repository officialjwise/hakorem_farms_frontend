import type { components } from '@hakorem/api-client';

export type CounterSaleBuyer = components['schemas']['CounterSaleBuyer'];

/** The contract's name: 1 to 160 characters, no control characters (2.26.0). */
const NAME_MAX = 160;
// eslint-disable-next-line no-control-regex -- the contract forbids control characters in the name.
const CONTROL = /[\u0000-\u001f\u007f]/;
/** A GRA TIN (P, C, G, Q or V and ten digits) or a Ghana Card PIN (`GHA-`, nine digits, `-`, a check digit). */
const TIN = /^(?:[PCGQV]\d{10}|GHA-\d{9}-\d)$/;

export type BuyerProblem = 'NAME_WITHOUT_TIN' | 'TIN_WITHOUT_NAME' | 'NAME_INVALID' | 'TIN_INVALID';

/**
 * A business buyer named on a counter sale's receipt (2.26.0, `OfflineSale.buyer`): both a name and a TIN, or
 * neither. Trimmed, the TIN upper-cased, as the contract prints them. The server checks them again at sync,
 * and records the sale without them if it refuses them (`BUYER_DETAILS_REFUSED`); it creates no customer.
 */
export function readBuyer(
  name: string,
  tin: string,
): { buyer: CounterSaleBuyer | null; problem: BuyerProblem | null } {
  const trimmedName = name.trim();
  const trimmedTin = tin.trim().toUpperCase();
  if (trimmedName === '' && trimmedTin === '') return { buyer: null, problem: null };
  if (trimmedTin === '') return { buyer: null, problem: 'NAME_WITHOUT_TIN' };
  if (trimmedName === '') return { buyer: null, problem: 'TIN_WITHOUT_NAME' };
  if (trimmedName.length > NAME_MAX || CONTROL.test(trimmedName)) {
    return { buyer: null, problem: 'NAME_INVALID' };
  }
  if (!TIN.test(trimmedTin)) return { buyer: null, problem: 'TIN_INVALID' };
  return { buyer: { name: trimmedName, tin: trimmedTin }, problem: null };
}
