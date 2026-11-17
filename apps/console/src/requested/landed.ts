/**
 * The owner's condition on ADR 0046 (2026-11-17): every switch is deleted when its request lands. Each line
 * below checks, at type-check time, that the generated client still lacks what its request asks for. When
 * `pnpm sync-contract` brings a contract that carries it, the line stops compiling and names the request:
 * delete its module in `requested/`, its id from `CONTRACT_REQUESTS` (`switch.ts`) and from the builds
 * (`package.json`, `.github/workflows/ci.yml`), and call the generated client.
 *
 * A request is checked by its first item to land: an operation (CR-032, CR-033's public read), a field on a
 * response (CR-033), or a field the request removes (CR-034).
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

/** True while `Key` is a required key of `Shape` (a request that makes it optional or removes it lands). */
type StillRequires<Shape, Key extends PropertyKey, Request extends string> = Key extends keyof Shape
  ? Record<never, never> extends Pick<Shape, Key>
    ? Landed<Request>
    : true
  : Landed<Request>;

type Manifest = typeof operationManifest;

const cr032: Lacks<Manifest, 'listTillPinVerifiers', 'CR-032'> = true;
const cr033Pack: Lacks<Schemas['OfflinePack'], 'receiptLinkTemplate', 'CR-033'> = true;
const cr033Result: Lacks<Schemas['SyncResultItem'], 'receiptMessage', 'CR-033'> = true;
const cr033Read: Lacks<Manifest, 'getPublicReceipt', 'CR-033'> = true;
const cr034: StillRequires<Schemas['ProductCreate'], 'sku', 'CR-034'> = true;

/** One entry per switch, so a new switch without a check fails `switch.test.ts`. */
export const LANDED_CHECKS: Record<ContractRequest, readonly boolean[]> = {
  'CR-032': [cr032],
  'CR-033': [cr033Pack, cr033Result, cr033Read],
  'CR-034': [cr034],
};
