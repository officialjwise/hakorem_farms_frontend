import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { posRoutes } from '../pos/routes';
import { newClient, renderApp, signedIn } from '../test/harness';
import { documentNavigation } from './OtherDocument';
import { routes } from './routes';

const original = { ...documentNavigation };
afterEach(() => Object.assign(documentNavigation, original));

describe('a path the other document owns (ADR 0030)', () => {
  it('the back office hands /pos to the browser, keeping the query, without rendering the till', async () => {
    const replace = vi.fn();
    Object.assign(documentNavigation, { loadedAt: '/', replace });
    await renderApp('/pos?from=sidebar', await signedIn('cashier'), routes);
    expect(await screen.findByText('Opening the page')).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/pos?from=sidebar');
    expect(screen.queryByLabelText(/barcode/i)).not.toBeInTheDocument();
  });

  it('the till hands any back office address to the browser', async () => {
    const replace = vi.fn();
    Object.assign(documentNavigation, { loadedAt: '/pos', replace });
    await renderApp('/users', await signedIn('cashier'), posRoutes);
    await screen.findByText('Opening the page');
    expect(replace).toHaveBeenCalledWith('/users');
  });

  it('served the wrong document for this address, it says so instead of reloading in a loop', async () => {
    const replace = vi.fn();
    Object.assign(documentNavigation, { loadedAt: '/pos', replace });
    await renderApp('/pos', await signedIn('cashier'), routes);
    expect(await screen.findByRole('alert')).toHaveTextContent('This page could not be opened');
    expect(screen.getByRole('link', { name: 'Go to the start page' })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('the till renders the sign-in screens itself, so signing in again stays on its code', async () => {
    const replace = vi.fn();
    Object.assign(documentNavigation, { loadedAt: '/pos', replace });
    await renderApp('/login', newClient(), posRoutes);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
