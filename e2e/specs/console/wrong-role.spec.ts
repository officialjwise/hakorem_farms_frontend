import type { Page } from '@playwright/test';
import { expect, test } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
  USERS,
} from '../../support/helpers';

/**
 * F3's gate: a wrong-role user sees the permission-denied state, not a broken page. Two levels.
 *
 * (a) The route: the session says the user lacks the permission the route declares. The page answers in
 *     words on the same URL, names the permission, keeps the shell so the user can get out, and asks the
 *     server for nothing it would refuse.
 * (b) The server: the user may open the page, but the server refuses one of its reads (here `listGrants`,
 *     which the fake sends to Prism with `Prefer: code=403`, so the contract's own 403 comes back). That
 *     section says so in words; the rest of the page works.
 *
 * Neither level may leave a blank page, a redirect, an uncaught error or an axe finding.
 */

const AKUA = '019a7a86-3046-711a-a652-1a7389f79351';
const EVENT = '019a7a9b-7496-7d7c-a2b4-e09733a75975';

/** Errors the page itself raised. A refused request also makes Chromium log "Failed to load resource",
 * which is the browser reporting the 403 it was sent, not the page breaking. */
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      errors.push(`console: ${message.text()}`);
    }
  });
  return errors;
}

const CASHIER_DENIED: { path: string; permission: string }[] = [
  { path: '/users', permission: 'iam.user.read' },
  { path: '/users/new', permission: 'iam.user.create' },
  { path: `/users/${AKUA}`, permission: 'iam.user.read' },
  { path: '/roles', permission: 'iam.role.read' },
  { path: '/roles/new', permission: 'iam.role.manage' },
  { path: `/roles/${AKUA}`, permission: 'iam.role.read' },
  { path: '/sessions', permission: 'iam.session.read' },
  { path: '/audit', permission: 'aud.audit.read' },
  { path: `/audit/${EVENT}`, permission: 'aud.audit.read' },
];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`a wrong role meets words, not a broken page (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    // One test per address, so each has its own time budget (nine in one test ran out of time under load).
    for (const { path, permission } of CASHIER_DENIED) {
      test(`(a) a cashier opening ${path} directly is denied by the route, in words, on the same URL`, async ({
        page,
        api,
      }) => {
        const errors = watchForErrors(page);
        await signIn(page, USERS.cashier);
        await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
        await page.goto(path);
        const alert = page.getByRole('alert');
        await expect(alert).toContainText('You do not have access to this page');
        await expect(alert).toContainText(permission);
        await expect(page).toHaveURL(path);
        // Not blank, not stranded: the shell is there, and a way out.
        await expect(page.getByRole('link', { name: 'Go to the start page' })).toBeVisible();
        await expect(page.getByRole('banner')).toBeVisible();
        await expectNoAxeViolations(page);
        await expectNoHorizontalScroll(page);
        // The route answered without asking the server for anything it would refuse.
        const asked = api.log.filter((entry) => entry.operationId !== null);
        expect(asked.map((entry) => entry.operationId)).toEqual([]);
        expect(errors).toEqual([]);
      });
    }

    test('(b) a manager may read a user but not their grants: that section is denied by the server, the rest works', async ({
      page,
      api,
    }) => {
      const errors = watchForErrors(page);
      await signInWithTotp(page, USERS.manager, `/users/${AKUA}`);

      // The page works: the account and its facts.
      await expect(page.getByRole('heading', { name: 'Akua Mensah', level: 1 })).toBeVisible();
      await expect(page.getByText('akua.mensah@hakoremfarms.com')).toBeVisible();

      // The grants section: the server's 403, in words, with no retry and no add button.
      const grants = page.getByRole('region', { name: 'Roles at branches' });
      await expect(grants.getByRole('alert')).toContainText(
        'You do not have access to role grants',
      );
      await expect(grants.getByRole('button', { name: 'Try again' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Add a role' })).toHaveCount(0);
      // Nothing the manager may not do is offered.
      await expect(page.getByRole('button', { name: 'Disable account' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Profile' })).toHaveCount(0);

      // The server decided: getUser went through, listGrants was refused with the contract's 403.
      const outcome = (id: string) =>
        api.log.filter((entry) => entry.operationId === id).map((entry) => entry.outcome);
      expect(outcome('getUser')).toContain('prism');
      expect(outcome('listGrants')).toEqual(['prism-403']);

      await expectNoAxeViolations(page);
      await expectNoHorizontalScroll(page);

      // And the manager's other routes behave the same way: the list works, the audit log is denied.
      await page.goto('/users');
      await expect(page.getByRole('link', { name: 'Akua Mensah' })).toBeVisible();
      await page.goto('/audit');
      await expect(page.getByRole('alert')).toContainText('aud.audit.read');
      await expect(page).toHaveURL('/audit');
      expect(errors).toEqual([]);
    });
  });
}
