import { expect, test, type Page } from '../../support/test';
import { signIn, submitLogin, TOTP_CODE, USERS } from '../../support/helpers';

/**
 * The fake API itself (ADR 0026), seen from a real page in the production build: what answers a request
 * that is not auth. The page's own fetch is used here only to probe the boundary; the app never calls fetch.
 */
async function probe(page: Page, path: string) {
  return page.evaluate(async (url) => {
    const response = await fetch(url, { credentials: 'include' });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }, `/mock${path}`);
}

test.describe('the API the end-to-end suite runs against', () => {
  test('without a session, a staff operation gets the contract’s own 401', async ({
    page,
    api,
  }) => {
    await page.goto('/login');
    const answer = await probe(page, '/iam/users');
    expect(answer.status).toBe(401);
    expect(answer.body).toHaveProperty('error.correlationId');
    expect(api.log.find((entry) => entry.operationId === 'listUsers')).toMatchObject({
      operationId: 'listUsers',
      outcome: 'prism-401',
    });
  });

  test('a cashier asking for users gets the contract’s own 403: the server refuses, not only the screen', async ({
    page,
    api,
  }) => {
    await signIn(page, USERS.cashier);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const answer = await probe(page, '/iam/users');
    expect(answer.status).toBe(403);
    expect(answer.body).toHaveProperty('error.code');
    expect(api.log.find((entry) => entry.operationId === 'listUsers')).toMatchObject({
      operationId: 'listUsers',
      outcome: 'prism-403',
    });
  });

  test('a manager who holds iam.user.read gets Prism’s example users', async ({ page, api }) => {
    await page.goto('/login');
    await submitLogin(page, USERS.manager);
    await page.getByLabel(/^code/i).fill(TOTP_CODE);
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const answer = await probe(page, '/iam/users');
    expect(answer.status).toBe(200);
    expect(Array.isArray(answer.body.data)).toBe(true);
    expect(api.log.find((entry) => entry.operationId === 'listUsers')).toMatchObject({
      operationId: 'listUsers',
      outcome: 'prism',
    });
  });

  test('sign-in never reaches Prism: the fake answers all of it', async ({ page, api }) => {
    await signIn(page, USERS.cashier);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    expect(api.log.length).toBeGreaterThan(0);
    expect(api.log.every((entry) => entry.path.startsWith('/auth/'))).toBe(true);
    expect(api.log.every((entry) => entry.outcome === 'fake')).toBe(true);
  });
});
