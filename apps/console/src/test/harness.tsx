import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { createI18n } from '@hakorem/i18n';
import { routes as appRoutes } from '../app/routes';
import { AuthProvider } from '../auth/AuthProvider';
import type { AuthClient } from '../auth/types';
import { FAKE_TOTP_CODE } from './fakeAuthServer';
import { fakeBrowser } from './fakeFetch';

export const USERS = {
  /** Owner: every F3 permission, TOTP on. */
  owner: { identifier: 'ama.mensah@hakoremfarms.com', password: 'Mango-Season-2026!' },
  /** Manager: reads users but holds no grant, role, session or audit permission. TOTP on. */
  manager: { identifier: 'kwabena.owusu@hakoremfarms.com', password: 'Mango-Season-2026!' },
  cashier: { identifier: 'adwoa.darko@hakoremfarms.com', password: 'Mango-Season-2026!' },
  storekeeper: { identifier: 'yaw.boateng@hakoremfarms.com', password: 'Mango-Season-2026!' },
  /** Farm hand (F6, A-158): records weights, health, feed and deaths; reads only weights. */
  farmHand: { identifier: 'kofi.adjei@hakoremfarms.com', password: 'Mango-Season-2026!' },
  temp: { identifier: 'new.staff@hakoremfarms.com', password: 'Temp-8841-Farm' },
  /** Accountant: the role must use TOTP and this user has not set it up, so sign-in asks them to enrol. */
  accountant: { identifier: 'akua.sarpong@hakoremfarms.com', password: 'Mango-Season-2026!' },
} as const;

/** The real auth client in a fresh browser, on a fresh fake auth server (ADR 0026). */
export function newClient(): AuthClient {
  return fakeBrowser().client;
}

/** A client that already holds a signed-in user (their cookies are in its jar). TOTP users give the code. */
export async function signedIn(
  user: keyof typeof USERS,
  client: AuthClient = newClient(),
): Promise<AuthClient> {
  const result = await client.loginStaff(USERS[user]);
  if (result.status === 'TOTP_REQUIRED') {
    await client.verifyTotp({ challengeToken: result.challengeToken ?? '', code: FAKE_TOTP_CODE });
  }
  return client;
}

export async function renderApp(
  path: string,
  client: AuthClient,
  routes: RouteObject[] = appRoutes,
  state?: unknown,
) {
  const i18n = await createI18n({
    namespaces: [
      'common',
      'shell',
      'auth',
      'iam',
      'audit',
      'catalogue',
      'stock',
      'dashboard',
      'branches',
      'labels',
      'lists',
      'reports',
      'settings',
      'livestock',
      'processing',
      'approvals',
      'billing',
      'buying',
      'payables',
    ],
  });
  const router = createMemoryRouter(routes, {
    initialEntries: [state === undefined ? path : { pathname: path, state }],
  });
  const view = render(
    <I18nextProvider i18n={i18n}>
      <AuthProvider client={client}>
        <RouterProvider router={router} />
      </AuthProvider>
    </I18nextProvider>,
  );
  return { router, ...view };
}
