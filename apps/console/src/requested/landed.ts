/**
 * The owner's condition on ADR 0046 (2026-11-17): every switch is deleted when its request lands. Each line
 * below checks, at type-check time, that the generated client still lacks what its request asks for. When
 * `pnpm sync-contract` brings a contract that carries it, the line stops compiling and names the request:
 * delete its module in `requested/`, its id from `CONTRACT_REQUESTS` (`switch.ts`) and from the builds
 * (`package.json`, `.github/workflows/ci.yml`), and call the generated client.
 *
 * A request is checked by its first item to land: an operation (CR-032, CR-033's public read) or a field on a
 * response (CR-033) or a request (CR-038's sale line). CR-042 is checked by its read and its schema; CR-045 by its read (its other half, a drop with no witness when none is signed in, changes no shape). CR-034 landed in 2.0.0 and its switch was deleted. CR-046 is checked by the line field, CR-047 by its read, its write and the override's reason.
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

const cr032: Lacks<Manifest, 'listTillPinVerifiers', 'CR-032'> = true;
const cr032Events: Lacks<Manifest, 'reportTillPinEvents', 'CR-032'> = true;
const cr033Pack: Lacks<Schemas['OfflinePack'], 'receiptLinkTemplate', 'CR-033'> = true;
const cr033Result: Lacks<Schemas['SyncResultItem'], 'receiptMessage', 'CR-033'> = true;
const cr033Read: Lacks<Manifest, 'getPublicReceipt', 'CR-033'> = true;
const cr038Pack: Lacks<Schemas['OfflineProduct'], 'sellingUnits', 'CR-038'> = true;
const cr038Line: Lacks<Schemas['CounterSaleLine'], 'uom', 'CR-038'> = true;
const cr042Read: Lacks<Manifest, 'getSupplierBalance', 'CR-042'> = true;
const cr042Shape: Lacks<Schemas, 'SupplierBalance', 'CR-042'> = true;
const cr045Read: Lacks<Manifest, 'listShiftWitnesses', 'CR-045'> = true;
const cr046Line: Lacks<Schemas['QuoteLineInput'], 'uom', 'CR-046'> = true;
const cr047Check: Lacks<Manifest, 'getOrderCreditCheck', 'CR-047'> = true;
const cr047Override: Lacks<Manifest, 'requestCreditOverride', 'CR-047'> = true;
const cr047Reason: Lacks<Schemas['CreditOverride'], 'reason', 'CR-047'> = true;

/** One entry per switch, so a new switch without a check fails `switch.test.ts`. */
export const LANDED_CHECKS: Record<ContractRequest, readonly boolean[]> = {
  'CR-032': [cr032, cr032Events],
  'CR-033': [cr033Pack, cr033Result, cr033Read],
  'CR-038': [cr038Pack, cr038Line],
  'CR-042': [cr042Read, cr042Shape],
  'CR-045': [cr045Read],
  'CR-046': [cr046Line],
  'CR-047': [cr047Check, cr047Override, cr047Reason],
};
