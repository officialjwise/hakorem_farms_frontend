/**
 * CR-045, who can witness a cash drop now, as `docs/CONTRACT_REQUESTS.md` asks for it (ADR 0046, ADR 0052).
 * Not in the contract yet: the types are the request's, read only in a build switched on for CR-045, and this
 * file goes when the contract carries `listShiftWitnesses`.
 *
 * The owner's rule (2026-11-17, the backend's A-273 (d)): a supervisor witnesses a drop when one is signed in
 * at the branch; with none, the drop goes ahead marked unwitnessed. 2.5.0 refuses a drop without a
 * `witnessId` (`WITNESS_REQUIRED`) and gives the till no way to see who is signed in, so both halves are
 * asked for. Only the shift screen imports this module, and it loads on demand, so the till's first load
 * never carries it.
 */
import type { components, RequestedOperation } from '@hakorem/api-client';
import { createRequestedQuery } from '@hakorem/data';
import { consoleApi } from '../data/api';
import { requestedOn } from './switch';

type Schemas = components['schemas'];

/**
 * `listShiftWitnesses`: the holders of `pos.shift.close.approve` at the shift's branch who are signed in now
 * (a live staff session), never the shift's cashier, so every one of them is a `witnessId` the server takes.
 * An empty list means no supervisor is signed in: the drop is recorded unwitnessed.
 */
export const LIST_SHIFT_WITNESSES: RequestedOperation = {
  request: 'CR-045',
  operationId: 'listShiftWitnesses',
  method: 'get',
  path: '/shifts/{id}/witnesses',
  permission: 'pos.cash.move',
  idempotent: false,
  csrf: 'none',
  public: false,
  body: 'none',
  device: true,
};

/** `ShiftWitnessList`. */
export interface ShiftWitnessList {
  data: Schemas['PrincipalRef'][];
  /** When the server looked. */
  asOf: string;
}

/** Built in the shift screen's own module, which loads on demand (ADR 0052). */
const useRequestedQuery = createRequestedQuery(consoleApi);

/** Whether this build asks who is signed in to witness a drop (CR-045's switch). */
export function shiftWitnessesOn(): boolean {
  return requestedOn('CR-045');
}

/**
 * The supervisors who can witness a drop on this shift now, in a build switched on for CR-045. With the
 * switch off nothing is asked: the drop is sent without a witness and the server decides (2.5.0 refuses it in
 * words; the backend's next part takes it, marked unwitnessed).
 */
export function useShiftWitnesses(shiftId: string, enabled: boolean) {
  return useRequestedQuery<ShiftWitnessList>(
    LIST_SHIFT_WITNESSES,
    { path: { id: shiftId } },
    { enabled: enabled && shiftWitnessesOn() },
  );
}
