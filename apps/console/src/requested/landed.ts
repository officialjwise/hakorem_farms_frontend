/**
 * The owner's condition on ADR 0046 (2026-11-17): every switch is deleted when its request lands. Each line
 * below checks, at type-check time, that the generated client still lacks what its request asks for. When
 * `pnpm sync-contract` brings a contract that carries it, the line stops compiling and names the request:
 * delete its module in `requested/`, its id from `CONTRACT_REQUESTS` (`switch.ts`) and from the builds
 * (`package.json`, `.github/workflows/ci.yml`), and call the generated client.
 *
 * A request is checked by its first item to land: an operation or a field on a response. CR-034 landed in
 * 2.0.0, CR-042 in 2.9.0, CR-038 in 2.11.0, CR-045 in 2.12.0, CR-046 in 2.14.0, CR-032 and CR-050 in
 * 2.17.0, and CR-033 in 2.24.0, and their switches were deleted. CR-059 is checked by its write and the
 * item's field, CR-063 by its read.
 */
import type { components, operationManifest } from '@hakorem/api-client';
import type { ContractRequest } from './switch';

type Schemas = components['schemas'];
type Landed<Request extends string> =
  `${Request} is in the contract now: delete its switch (ADR 0046)`;

/** True while `Key` is not a key of `Shape`. */
type Lacks<Shape, Key extends PropertyKey, Request extends string> = Key extends keyof Shape
  ? Landed<Request>
  : true;

type Manifest = typeof operationManifest;

const cr059Review: Lacks<Manifest, 'reviewException', 'CR-059'> = true;
const cr059Field: Lacks<Schemas['ExceptionItem'], 'review', 'CR-059'> = true;
const cr063Read: Lacks<Manifest, 'listShiftDriverCashHolders', 'CR-063'> = true;

/** One entry per switch, so a new switch without a check fails `switch.test.ts`. */
export const LANDED_CHECKS: Record<ContractRequest, readonly boolean[]> = {
  'CR-059': [cr059Review, cr059Field],
  'CR-063': [cr063Read],
};
