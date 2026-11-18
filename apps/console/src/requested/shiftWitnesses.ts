/**
 * CR-050, who can witness a cash drop now, as `docs/CONTRACT_REQUESTS.md` asks for it (ADR 0046, ADR 0052).
 * Not in the contract yet: the types are the request's, read only in a build switched on for CR-050, and this
 * file goes when the contract carries `listShiftWitnesses`.
 *
 * The owner's rule (2026-11-18, the backend's A-273 (d)): while a supervisor is signed in at the branch, a
 * drop needs a witness, and the witness is that supervisor's PIN on the till (`pos/shift/witness.ts`); with
 * none signed in, the drop goes ahead marked unwitnessed. 2.6.0 takes the unwitnessed drop; the till still
 * has no way to see who is signed in, which this read asks for. The till uses it only to know whether a
 * witness is needed: naming one of these people is not a witness. Only the shift screen imports this
 * module, and it loads on demand, so the till's first load never carries it.
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
  request: 'CR-050',
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

/** Whether this build asks who is signed in to witness a drop (CR-050's switch). */
export function shiftWitnessesOn(): boolean {
  return requestedOn('CR-050');
}

/**
 * The supervisors signed in at the shift's branch now, in a build switched on for CR-050. With the switch off
 * nothing is asked: a supervisor's PIN is taken if one is there, and otherwise the drop is sent unwitnessed
 * and the server decides (2.6.0: it takes it while nobody is signed in, and refuses it in words otherwise).
 */
export function useShiftWitnesses(shiftId: string, enabled: boolean) {
  return useRequestedQuery<ShiftWitnessList>(
    LIST_SHIFT_WITNESSES,
    { path: { id: shiftId } },
    { enabled: enabled && shiftWitnessesOn() },
  );
}
