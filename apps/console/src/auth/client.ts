/**
 * THE SEAM (ADR 0012, ADR 0024). This is the only file that knows which AuthClient the console runs on: the
 * real one, on the generated API client, against whatever `HK_API_BASE_URL` names (ADR 0019).
 *
 * It is created on first use, so a build that has not been told where the API is fails with that message
 * at the first sign-in or boot check, not at startup (the same rule as `data/api.ts`). Screens call
 * `useAuth()`; `AuthProvider` receives this export in `main.tsx`, and a unit test fails if anything else
 * imports it.
 */
import { apiBaseUrl } from '@hakorem/api-client';
import { createApiAuthClient } from './apiAuthClient';
import type { AuthClient } from './types';

let real: AuthClient | undefined;
const client = (): AuthClient => (real ??= createApiAuthClient({ baseUrl: apiBaseUrl() }));

// Each method is async so a missing HK_API_BASE_URL arrives as a rejected promise, like any other failure.
export const authClient: AuthClient = {
  loginStaff: async (input) => client().loginStaff(input),
  loginInvestor: async (input) => client().loginInvestor(input),
  verifyTotp: async (input) => client().verifyTotp(input),
  getCurrentSession: async () => client().getCurrentSession(),
  refreshSession: async () => client().refreshSession(),
  logout: async () => client().logout(),
  changePassword: async (input) => client().changePassword(input),
  requestPasswordReset: async (input) => client().requestPasswordReset(input),
  resetPassword: async (input) => client().resetPassword(input),
  stepUp: async (input) => client().stepUp(input),
  startTotpEnrolment: async (input) => client().startTotpEnrolment(input),
  confirmTotpEnrolment: async (input) => client().confirmTotpEnrolment(input),
};
