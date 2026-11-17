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
export const CONTRACT_REQUESTS = ['CR-032', 'CR-033', 'CR-034'] as const;
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

/** Whether this build was built against the request. */
export function requestedOn(request: ContractRequest): boolean {
  // Written out in full: Vite replaces the literal at build time (vite.config.ts).
  return parseRequestedContract(process.env.HK_REQUESTED_CONTRACT).has(request);
}
