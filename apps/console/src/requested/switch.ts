/**
 * Which contract requests this build is built against (ADR 0046). A request in `docs/CONTRACT_REQUESTS.md`
 * that the contract does not carry yet is switched on only by `HK_REQUESTED_CONTRACT`, a comma-separated
 * list of request ids (`CR-032,CR-033`), read at build time like `HK_API_BASE_URL`. The end-to-end build
 * switches them on and its fake server answers them in the requested shape; a build for a real API leaves
 * it unset, so the console never calls an operation the contract does not list, and each screen says in
 * words what waits for the backend.
 *
 * When the contract carries a request, its id is removed from this list, its module from `requested/`, and
 * its screens call the generated client.
 */
export const REQUESTED_CONTRACT_VARIABLE = 'HK_REQUESTED_CONTRACT';

/** The requests the console can be built against. */
export const CONTRACT_REQUESTS = ['CR-032', 'CR-033', 'CR-050', 'CR-058'] as const;
export type ContractRequest = (typeof CONTRACT_REQUESTS)[number];

export function parseRequestedContract(raw: string | undefined): ReadonlySet<ContractRequest> {
  const ids = (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '');
  const unknown = ids.filter((id) => !(CONTRACT_REQUESTS as readonly string[]).includes(id));
  if (unknown.length > 0) {
    throw new Error(
      `${REQUESTED_CONTRACT_VARIABLE} names ${unknown.join(', ')}, which the console has no requested module for. It knows ${CONTRACT_REQUESTS.join(', ')}.`,
    );
  }
  return new Set(ids as ContractRequest[]);
}

/** The one API a switched-on build may talk to: the e2e fake and Prism, behind the `/mock` path (ADR 0025). */
export const MOCK_API_BASE_URL = '/mock';

/**
 * The owner's condition on ADR 0046 (2026-11-17): a build for a real API fails if any switch is on. Every
 * switch is for a shape the contract does not carry (`landed.ts` fails the type check once it
 * does), so a build that talks to anything but the mock with a switch on would call what the API lacks.
 * `vite.config.ts` calls this for every build and dev server; unit tests (mode `test`) do not.
 */
export function assertSwitchesAllowed(
  rawRequested: string | undefined,
  apiBaseUrl: string | undefined,
): void {
  const on = parseRequestedContract(rawRequested);
  if (on.size === 0 || (apiBaseUrl ?? '').trim() === MOCK_API_BASE_URL) return;
  throw new Error(
    `${REQUESTED_CONTRACT_VARIABLE} switches on ${[...on].join(', ')}, which the contract does not carry, in a build for ${apiBaseUrl?.trim() || 'no API'}. A switch may be on only in a build against ${MOCK_API_BASE_URL} (ADR 0046): unset ${REQUESTED_CONTRACT_VARIABLE} for any other API.`,
  );
}

/** Whether this build was built against the request. */
export function requestedOn(request: ContractRequest): boolean {
  // Written out in full: Vite replaces the literal at build time (vite.config.ts).
  return parseRequestedContract(process.env.HK_REQUESTED_CONTRACT).has(request);
}
