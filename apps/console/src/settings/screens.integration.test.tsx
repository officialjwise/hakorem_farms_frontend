/**
 * The F5c settings section against the REAL Prism mock (ADR 0019), through the app's own routes and shell:
 * display preferences for anyone, the business profile and the system settings in their states.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { queryClient } from '../data/api';
import { themePreference } from '../lib/preferences';
import { renderApp, signedIn } from '../test/harness';
import { holdResponses, mock } from '../test/integration-setup';

/** Prism's 500 reference (`019a7b1e-…-970f89c10fed`) as a screen shows it: the last eight, grouped (ADR 0051). */
const PRISM_500_REFERENCE = '89c1 0fed';

afterEach(() => {
  queryClient.clear();
  themePreference.set('system');
});

function alertWith(text: string) {
  return screen.getAllByRole('alert').find((alert) => alert.textContent?.includes(text));
}

describe('settings against the Prism mock', () => {
  it('display: anyone chooses the theme, kept on this device, without asking the server', async () => {
    await renderApp('/settings', await signedIn('cashier'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Display' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(themePreference.get()).toBe('dark');
    // A cashier is not offered the business settings.
    const menu = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(within(menu).queryByRole('link', { name: /Business profile/ })).toBeNull();
  });

  it('business profile: loading, then the profile as the server holds it', async () => {
    const release = holdResponses();
    await renderApp('/settings/business', await signedIn('owner'));
    expect((await screen.findAllByText('Loading the business profile')).length).toBeGreaterThan(0);
    release();
    expect(await screen.findByText('HaKorem Farms Limited')).toBeInTheDocument();
    expect(screen.getByText('Taxpayer identification number')).toBeInTheDocument();
  });

  it('business profile: an error in words with its reference and a retry', async () => {
    mock.prefer = 'code=500';
    mock.preferPath = '/admin/business-profile';
    await renderApp('/settings/business', await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('The business profile could not be loaded')).toBeDefined(),
    );
    const alert = alertWith('The business profile could not be loaded') as HTMLElement;
    expect(alert).toHaveTextContent(PRISM_500_REFERENCE);
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('system settings: each value in words by its type, and a search by key sent as the prefix', async () => {
    await renderApp('/settings/system', await signedIn('owner'));
    // The loading placeholder's table is replaced when the data lands: find the rows, then their table.
    expect(
      await screen.findByText('tax.registered', undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    const table = screen.getByRole('region', { name: 'Settings and switches' });
    expect(within(table).getAllByText('On').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('40.00%').length).toBeGreaterThan(0);
    const search = screen.getByRole('searchbox', { name: 'Settings whose key starts with' });
    await userEvent.type(search, 'tax{Enter}');
    await waitFor(() =>
      expect(
        mock.requests.some(
          (url) =>
            url.pathname.endsWith('/admin/settings') && url.searchParams.get('prefix') === 'tax',
        ),
      ).toBe(true),
    );
  });

  it('system settings: permission denied in words, with no retry', async () => {
    mock.prefer = 'code=403';
    mock.preferPath = '/admin/settings';
    await renderApp('/settings/system', await signedIn('owner'));
    await waitFor(() =>
      expect(alertWith('You do not have access to the system settings')).toBeDefined(),
    );
    const alert = alertWith('You do not have access to the system settings') as HTMLElement;
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('system settings: empty, in words', async () => {
    mock.noRows = true;
    await renderApp('/settings/system', await signedIn('owner'));
    expect(await screen.findByText('No settings match')).toBeInTheDocument();
  });
});
