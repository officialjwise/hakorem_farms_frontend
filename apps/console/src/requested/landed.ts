/**
 * The owner's condition on ADR 0046 (2026-11-17): every switch is deleted when its request lands. Each line
 * below checks, at type-check time, that the generated client still lacks what its request asks for. When
 * `pnpm sync-contract` brings a contract that carries it, the line stops compiling and names the request:
 * delete its module in `requested/`, its id from `CONTRACT_REQUESTS` (`switch.ts`) and from the builds
 * (`package.json`, `.github/workflows/ci.yml`), and call the generated client.
 *
 * A request is checked by its first item to land: an operation or a field on a response. CR-034 landed in
 * 2.0.0, CR-042 in 2.9.0, CR-038 in 2.11.0, CR-045 in 2.12.0, CR-046 in 2.14.0, CR-032 and CR-050 in
 * 2.17.0, CR-033 in 2.24.0, CR-063 in 2.35.0 and CR-059 in 2.48.0, and their switches were deleted. No
 * switch is left; the next one adds its line here, in the shape below.
 */
import type { ContractRequest } from './switch';

/**
 * The shape of a check, for the next switch:
 *
 *   type Landed<Request extends string> = `${Request} is in the contract now: delete its switch (ADR 0046)`;
 *   type Lacks<Shape, Key extends PropertyKey, Request extends string> =
 *     Key extends keyof Shape ? Landed<Request> : true;
 *   const cr066: Lacks<typeof operationManifest, 'theOperation', 'CR-066'> = true;
 */

/** One entry per switch, so a new switch without a check fails `switch.test.ts`. */
export const LANDED_CHECKS: Record<ContractRequest, readonly boolean[]> = {};
