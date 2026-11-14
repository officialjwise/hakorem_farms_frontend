import { expect, test } from '../../support/test';
import { signIn, submitLogin, TOTP_CODE, USERS } from '../../support/helpers';

test.describe('sign in', () => {
  test('a cashier signs in and lands on the dashboard inside the back office shell', async ({
    page,
  }) => {
    await signIn(page, USERS.cashier);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('a signed-out visit to a deep link goes to sign-in and returns there afterwards', async ({
    page,
  }) => {
    await page.goto('/stock');
    await expect(page).toHaveURL(/\/login\?next=%2Fstock$/);
    await submitLogin(page, USERS.cashier);
    await expect(page.getByRole('heading', { name: 'Stock' })).toBeVisible();
    await expect(page).toHaveURL('/stock');
  });

  test('a wrong password leaves words on screen and no session', async ({ page }) => {
    await page.goto('/login');
    await submitLogin(page, { identifier: USERS.cashier.identifier, password: 'wrong-password' });
    await expect(page.getByRole('alert')).toContainText('not right');
    await expect(page).toHaveURL('/login');
    await page.goto('/stock');
    await expect(page).toHaveURL(/\/login/);
  });

  test('keyboard only: tab through the form and submit with Enter', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email or phone number/i).focus();
    await page.keyboard.type(USERS.cashier.identifier);
    await page.keyboard.press('Tab');
    await page.keyboard.type(USERS.cashier.password);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});

test.describe('TOTP challenge', () => {
  test('an owner needs the code: a wrong code is refused, the right one signs in', async ({
    page,
  }) => {
    await page.goto('/login');
    await submitLogin(page, USERS.manager);
    await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible();
    await expect(page.getByLabel(/^code/i)).toBeFocused();
    await page.getByLabel(/^code/i).fill('000000');
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByRole('alert')).toContainText('wrong or has already been used');
    await page.getByLabel(/^code/i).fill(TOTP_CODE);
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    // The owner's role reaches users and roles.
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'Users and roles' })).toBeVisible();
  });

  test('a reload in the middle loses the challenge on purpose and starts again', async ({
    page,
  }) => {
    await page.goto('/login');
    await submitLogin(page, USERS.manager);
    await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});

test.describe('forced password change', () => {
  test('a temporary password must be replaced before anything else', async ({ page }) => {
    await page.goto('/login');
    await submitLogin(page, USERS.temp);
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    await page.getByLabel(/current password/i).fill(USERS.temp.password);
    await page.getByLabel(/^new password/i).fill('A-much-longer-passphrase-9');
    await page.getByLabel(/confirm the new password/i).fill('A-much-longer-passphrase-9');
    await page.getByRole('button', { name: 'Save the new password' }).click();
    await expect(page.getByText('Your password was changed')).toBeVisible();
    await submitLogin(page, {
      identifier: USERS.temp.identifier,
      password: 'A-much-longer-passphrase-9',
    });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('the change screen is not reachable without a pending change', async ({ page }) => {
    await page.goto('/change-password');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});

test.describe('forgot and reset password', () => {
  test('request a code, then reset with it', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    await page.getByLabel(/email or phone number/i).fill('anyone@example.com');
    await page.getByRole('button', { name: 'Send a reset code' }).click();
    await expect(
      page.getByText('If the account exists, a reset code has been sent.'),
    ).toBeVisible();
    await page.getByRole('link', { name: 'I have a code' }).click();
    await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
    await page.getByLabel(/reset code/i).fill('738204');
    await page.getByLabel(/^new password/i).fill('A-much-longer-passphrase-9');
    await page.getByRole('button', { name: 'Set the password' }).click();
    await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible();
    await page.getByRole('link', { name: 'Go to sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});

test('sign out ends the session', async ({ page }) => {
  await signIn(page, USERS.cashier);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});
