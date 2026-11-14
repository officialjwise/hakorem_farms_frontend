/**
 * THE SEAM (ADR 0012). This is the only file that knows which AuthClient the console runs on.
 *
 * Today it is the stub. In F3, replace the two lines below with the real client built on the generated API
 * client, and nothing else changes: screens call `useAuth()`, `AuthProvider` receives this export in
 * `main.tsx`, and a unit test fails if any other file imports `./stub`.
 */
import { createStubAuthClient } from './stub';
import type { AuthClient } from './types';

export const authClient: AuthClient = createStubAuthClient({ latencyMs: 150 });
