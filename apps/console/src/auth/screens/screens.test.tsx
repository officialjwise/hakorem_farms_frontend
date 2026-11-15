import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { newClient, renderApp, USERS } from '../../test/harness';
import {
  FAKE_RECOVERY_CODES,
  FAKE_RESET_CODE,
  FAKE_TOTP_CODE,
  FAKE_TOTP_SECRET,
} from '../../test/fakeAuthServer';
import { ApiError, NetworkError, type AuthClient } from '../types';

/** The words a field's error gives, read the way a screen reader does: through aria-describedby. */
function describedBy(control: HTMLElement): string {
  return (control.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
}

async function fill(label: RegExp, value: string) {
  await userEvent.type(screen.getByLabelText(label), value);
}

describe('login screen', () => {
  it('default: labelled fields, a primary action, and links to reset', async () => {
    await renderApp('/login', newClient());
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText(/email or phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /forgot your password/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('empty submit: says what is required, in words, on each field, and calls nothing', async () => {
    const client = newClient();
    let calls = 0;
    const counting: AuthClient = { ...client, loginStaff: (i) => (calls++, client.loginStaff(i)) };
    await renderApp('/login', counting);
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findAllByText('Required', {
        selector: '[role="alert"], [id*="error"], p, span',
      }),
    ).not.toHaveLength(0);
    expect(screen.getByLabelText(/email or phone number/i)).toBeInvalid();
    expect(calls).toBe(0);
  });

  it('wrong password: a persistent alert with a reference, and the same message for any account', async () => {
    await renderApp('/login', newClient());
    await fill(/email or phone number/i, USERS.cashier.identifier);
    await fill(/^password/i, 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/email, phone number or password is not right/i);
    expect(alert).toHaveTextContent(/reference/i);
  });

  it('rate limited: says to wait', async () => {
    await renderApp('/login', newClient());
    await fill(/email or phone number/i, USERS.cashier.identifier);
    await fill(/^password/i, 'wrong');
    for (let i = 0; i < 6; i++)
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/too many attempts/i));
  });

  it('network down: says the server could not be reached, with no invented reference', async () => {
    const client = { ...newClient(), loginStaff: () => Promise.reject(new NetworkError()) };
    await renderApp('/login', client);
    await fill(/email or phone number/i, USERS.cashier.identifier);
    await fill(/^password/i, 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not reach the server/i);
    expect(alert).not.toHaveTextContent(/reference/i);
  });

  it('success without TOTP: lands on the dashboard, or where the user was going', async () => {
    const { router } = await renderApp('/login?next=%2Fstock', newClient());
    await fill(/email or phone number/i, USERS.cashier.identifier);
    await fill(/^password/i, USERS.cashier.password);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: 'Stock on hand' }, { timeout: 5000 });
    expect(router.state.location.pathname).toBe('/stock');
  });

  it('ignores a next that points outside the app', async () => {
    const { router } = await renderApp('/login?next=https%3A%2F%2Fevil.example', newClient());
    await fill(/email or phone number/i, USERS.cashier.identifier);
    await fill(/^password/i, USERS.cashier.password);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(router.state.location.pathname).toBe('/');
  });

  it('goes to the code step for a TOTP user, and to the password step for a temporary password', async () => {
    const first = await renderApp('/login', newClient());
    await fill(/email or phone number/i, USERS.manager.identifier);
    await fill(/^password/i, USERS.manager.password);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(first.router.state.location.pathname).toBe('/login/totp'));
    first.unmount();

    const second = await renderApp('/login', newClient());
    await fill(/email or phone number/i, USERS.temp.identifier);
    await fill(/^password/i, USERS.temp.password);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(second.router.state.location.pathname).toBe('/change-password'));
  });
});

describe('TOTP enrolment, on a first sign-in', () => {
  async function toEnrolment() {
    const view = await renderApp('/login?next=%2Fsettings', newClient());
    await fill(/email or phone number/i, USERS.accountant.identifier);
    await fill(/^password/i, USERS.accountant.password);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { level: 1, name: 'Set up two-step sign-in' });
    return view;
  }

  it('shows the server’s QR image with words, and the key in text for a phone that cannot scan', async () => {
    const { router } = await toEnrolment();
    expect(router.state.location.pathname).toBe('/login/enrol');
    const qr = await screen.findByRole('img', { name: /QR code that adds HaKorem Farms/ });
    expect(qr.getAttribute('src')).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(screen.getByLabelText(`Key ${FAKE_TOTP_SECRET}`)).toHaveTextContent(
      'JBSW Y3DP EHPK 3PXP',
    );
    expect(screen.getByLabelText(/^code/i)).toHaveAttribute('autocomplete', 'one-time-code');
  });

  it('a wrong first code: persistent words, and the key stays on screen', async () => {
    await toEnrolment();
    await screen.findByRole('img', { name: /QR code/ });
    await fill(/^code/i, '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Turn on two-step sign-in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/wrong or has already been used/i);
    expect(screen.getByLabelText(`Key ${FAKE_TOTP_SECRET}`)).toBeInTheDocument();
  });

  it('the recovery codes stay until the person says they kept them, then sign-in carries on', async () => {
    const { router } = await toEnrolment();
    await screen.findByRole('img', { name: /QR code/ });
    await fill(/^code/i, FAKE_TOTP_CODE);
    await userEvent.click(screen.getByRole('button', { name: 'Turn on two-step sign-in' }));
    const list = await screen.findByRole('list', { name: 'Recovery codes' });
    expect(list.querySelectorAll('li')).toHaveLength(FAKE_RECOVERY_CODES.length);
    expect(list).toHaveTextContent(FAKE_RECOVERY_CODES[0] ?? '');
    const go = screen.getByRole('button', { name: 'Continue to HaKorem Farms' });
    expect(go).toBeDisabled();
    expect(router.state.location.pathname).toBe('/login/enrol');
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'I have kept these codes somewhere safe' }),
    );
    await userEvent.click(go);
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'));
  });

  it('after enrolling, the next sign-in asks for a code', async () => {
    const client = newClient();
    const first = await client.loginStaff(USERS.accountant);
    expect(first.status).toBe('TOTP_ENROLMENT_REQUIRED');
    await client.startTotpEnrolment({ challengeToken: first.challengeToken ?? '' });
    await client.confirmTotpEnrolment({
      challengeToken: first.challengeToken ?? '',
      code: FAKE_TOTP_CODE,
    });
    expect((await client.getCurrentSession()).principal.displayName).toBe('Akua Sarpong');
    expect((await client.loginStaff(USERS.accountant)).status).toBe('TOTP_REQUIRED');
  });

  it('a reload loses the challenge: back to sign in', async () => {
    const { router } = await renderApp('/login/enrol', newClient());
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});

describe('TOTP screen', () => {
  async function toCodeStep() {
    const view = await renderApp('/login', newClient());
    await fill(/email or phone number/i, USERS.manager.identifier);
    await fill(/^password/i, USERS.manager.password);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: /enter your code/i });
    return view;
  }

  it('default: a labelled code field that takes focus', async () => {
    await toCodeStep();
    const code = screen.getByLabelText(/^code/i);
    expect(code).toHaveAttribute('autocomplete', 'one-time-code');
    await waitFor(() => expect(code).toHaveFocus());
  });

  it('wrong code: a persistent alert, and the field is kept for another try', async () => {
    await toCodeStep();
    await fill(/^code/i, '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/wrong or has already been used/i);
    expect(screen.getByRole('heading', { name: /enter your code/i })).toBeInTheDocument();
  });

  it('right code: signs in and goes on', async () => {
    const { router } = await toCodeStep();
    await fill(/^code/i, FAKE_TOTP_CODE);
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(router.state.location.pathname).toBe('/');
  });

  it('start again: drops the challenge and goes back to sign-in', async () => {
    const { router } = await toCodeStep();
    await userEvent.click(screen.getByRole('button', { name: /start again/i }));
    expect(router.state.location.pathname).toBe('/login');
  });

  it('with no challenge (a reload loses it on purpose) it goes back to sign-in', async () => {
    const { router } = await renderApp('/login/totp', newClient());
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});

describe('forced password change screen', () => {
  async function toChangeStep() {
    const view = await renderApp('/login', newClient());
    await fill(/email or phone number/i, USERS.temp.identifier);
    await fill(/^password/i, USERS.temp.password);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: /choose a new password/i });
    return view;
  }

  it('says why, and asks for the current, new and repeated password', async () => {
    await toChangeStep();
    expect(screen.getByText(/signed in with a temporary password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm the new password/i)).toBeInTheDocument();
  });

  it('too short or mismatched: field errors in words', async () => {
    await toChangeStep();
    await fill(/current password/i, USERS.temp.password);
    await fill(/^new password/i, 'short');
    await fill(/confirm/i, 'different');
    await userEvent.click(screen.getByRole('button', { name: /save the new password/i }));
    expect(await screen.findAllByText(/at least 12 characters/i)).not.toHaveLength(0);
    expect(screen.getByText(/two passwords do not match/i)).toBeInTheDocument();
  });

  it('a breached password: the server refuses it and the screen says so', async () => {
    await toChangeStep();
    await fill(/current password/i, USERS.temp.password);
    await fill(/^new password/i, 'password-password');
    await fill(/confirm/i, 'password-password');
    await userEvent.click(screen.getByRole('button', { name: /save the new password/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/breached passwords/i);
  });

  it('success: back to sign-in with a notice, then the new password works', async () => {
    const { router } = await toChangeStep();
    await fill(/current password/i, USERS.temp.password);
    await fill(/^new password/i, 'A-much-longer-passphrase-9');
    await fill(/confirm/i, 'A-much-longer-passphrase-9');
    await userEvent.click(screen.getByRole('button', { name: /save the new password/i }));
    expect(await screen.findByText(/your password was changed/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    await fill(/email or phone number/i, USERS.temp.identifier);
    await fill(/^password/i, 'A-much-longer-passphrase-9');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: 'Dashboard' });
  });

  it('without a pending change it goes back to sign-in', async () => {
    const { router } = await renderApp('/change-password', newClient());
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});

describe('forgot and reset password', () => {
  it('forgot: sends the request and answers the same whatever the account', async () => {
    await renderApp('/forgot-password', newClient());
    await fill(/email or phone number/i, 'nobody@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send a reset code/i }));
    expect(
      await screen.findByRole('heading', { name: /check your messages/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/if the account exists, a reset code has been sent/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /i have a code/i })).toHaveAttribute(
      'href',
      '/reset-password',
    );
  });

  it('forgot: an empty submit says what is required', async () => {
    await renderApp('/forgot-password', newClient());
    await userEvent.click(await screen.findByRole('button', { name: /send a reset code/i }));
    const field = screen.getByLabelText(/email or phone number/i);
    await waitFor(() => expect(field).toBeInvalid());
    expect(describedBy(field)).toContain('Required');
  });

  it('reset: a wrong code is refused with words', async () => {
    await renderApp('/reset-password', newClient());
    await fill(/reset code/i, '000000');
    await fill(/^new password/i, 'A-much-longer-passphrase-9');
    await userEvent.click(screen.getByRole('button', { name: /set the password/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/reset code is not valid/i);
  });

  it('reset: the right code changes the password and offers sign-in', async () => {
    await renderApp('/reset-password', newClient());
    await fill(/reset code/i, FAKE_RESET_CODE);
    await fill(/^new password/i, 'A-much-longer-passphrase-9');
    await userEvent.click(screen.getByRole('button', { name: /set the password/i }));
    expect(await screen.findByRole('heading', { name: /password changed/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to sign in/i })).toHaveAttribute('href', '/login');
  });
});

describe('session expired screen', () => {
  it('says the session ended, in words, and offers to sign in again, remembering the page', async () => {
    const real = newClient();
    await real.loginStaff(USERS.cashier);
    const client: AuthClient = {
      ...real,
      // The access token is already due for renewal, and the server refuses the renewal.
      getCurrentSession: async () => ({
        ...(await real.getCurrentSession()),
        accessExpiresAt: new Date(Date.now() + 1000).toISOString(),
      }),
      refreshSession: () =>
        Promise.reject(
          new ApiError({
            status: 401,
            code: 'UNAUTHENTICATED',
            message: 'Please log in again.',
            correlationId: 'x',
          }),
        ),
    };
    const { router } = await renderApp('/stock', client);
    expect(await screen.findByRole('alert')).toHaveTextContent(/your session ended/i);
    const link = screen.getByRole('link', { name: /sign in again/i });
    expect(link).toHaveAttribute('href', '/login?next=%2Fstock');
    // Words, not a redirect: the address is still the page the user was on.
    expect(router.state.location.pathname).toBe('/stock');
  });
});
