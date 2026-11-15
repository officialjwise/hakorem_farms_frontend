import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { I18nextProvider } from 'react-i18next';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@hakorem/api-client';
import { createI18n } from '@hakorem/i18n';
import { Input, UIProvider } from '@hakorem/ui';
import { AuthProvider } from '../auth/AuthProvider';
import { useStepUp } from '../auth/StepUp';
import { FAKE_TOTP_CODE } from '../test/fakeAuthServer';
import { fakeBrowser } from '../test/fakeFetch';
import { signedIn } from '../test/harness';
import { LeaveGuardDialog, useLeaveGuard } from './LeaveGuard';
import { useIntentKey } from './queries';
import { useCursorPages } from './useCursorPages';

const toastLabels = { region: 'Notifications', announcement: 'Notification', close: 'Close' };

describe('useCursorPages', () => {
  it('keeps the cursors visited, so Previous returns to the exact page, and resets to the first', () => {
    const { result } = renderHook(() => useCursorPages());
    expect(result.current).toMatchObject({ cursor: undefined, page: 1, hasPrevious: false });
    act(() => result.current.next('c2'));
    act(() => result.current.next('c3'));
    expect(result.current).toMatchObject({ cursor: 'c3', page: 3, hasPrevious: true });
    act(() => result.current.previous());
    expect(result.current).toMatchObject({ cursor: 'c2', page: 2 });
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ cursor: undefined, page: 1, hasPrevious: false });
  });

  it('goes to any page reached, keeps the pages beyond, and drops them for a different cursor', () => {
    const { result } = renderHook(() => useCursorPages());
    act(() => result.current.next('c2'));
    act(() => result.current.next('c3'));
    act(() => result.current.goTo(1));
    expect(result.current).toMatchObject({ cursor: undefined, page: 1, reached: 3 });
    act(() => result.current.goTo(3));
    expect(result.current).toMatchObject({ cursor: 'c3', page: 3, reached: 3 });
    // A page not reached yet is not offered.
    act(() => result.current.goTo(4));
    expect(result.current.page).toBe(3);
    act(() => result.current.goTo(1));
    act(() => result.current.next('c2'));
    expect(result.current).toMatchObject({ cursor: 'c2', page: 2, reached: 3 });
    // The list changed under us: a new cursor after page 1 forgets the old pages 2 and 3.
    act(() => result.current.goTo(1));
    act(() => result.current.next('other'));
    expect(result.current).toMatchObject({ cursor: 'other', page: 2, reached: 2 });
  });
});

describe('useIntentKey', () => {
  it('gives the same body the same key (a retry is the same intent) and a changed body a new one', () => {
    const { result } = renderHook(() => useIntentKey());
    const first = result.current({ reason: 'Left' });
    expect(result.current({ reason: 'Left' })).toBe(first);
    const second = result.current({ reason: 'Left the business' });
    expect(second).not.toBe(first);
    expect(second).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('useLeaveGuard, wired to the router', () => {
  async function mount() {
    const i18n = await createI18n({ namespaces: ['common'] });
    function EditPage() {
      const form = useForm({ defaultValues: { name: '' } });
      const guard = useLeaveGuard(form.formState.isDirty);
      return (
        <>
          <label htmlFor="name">Name</label>
          <Input id="name" {...form.register('name')} />
          <Link to="/elsewhere">Elsewhere</Link>
          <LeaveGuardDialog guard={guard} />
        </>
      );
    }
    const router = createMemoryRouter(
      [
        { path: '/edit', element: <EditPage /> },
        { path: '/elsewhere', element: <h1>Elsewhere page</h1> },
      ],
      { initialEntries: ['/edit'] },
    );
    render(
      <I18nextProvider i18n={i18n}>
        <UIProvider theme="light" density="compact" toastLabels={toastLabels}>
          <RouterProvider router={router} />
        </UIProvider>
      </I18nextProvider>,
    );
    return router;
  }

  it('lets a clean form go at once', async () => {
    const router = await mount();
    await userEvent.click(screen.getByRole('link', { name: 'Elsewhere' }));
    expect(await screen.findByRole('heading', { name: 'Elsewhere page' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/elsewhere');
  });

  it('holds a dirty form: Stay keeps the page and the typing, Leave goes', async () => {
    const router = await mount();
    await userEvent.type(screen.getByLabelText('Name'), 'Esi');
    await userEvent.click(screen.getByRole('link', { name: 'Elsewhere' }));
    expect(
      await screen.findByRole('dialog', { name: 'Leave without saving?' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Stay on this page' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(router.state.location.pathname).toBe('/edit');
    expect(screen.getByLabelText('Name')).toHaveValue('Esi');

    await userEvent.click(screen.getByRole('link', { name: 'Elsewhere' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Leave without saving' }));
    expect(await screen.findByRole('heading', { name: 'Elsewhere page' })).toBeInTheDocument();
  });
});

describe('useStepUp', () => {
  const stepUpRequired = () =>
    new ApiError({
      status: 403,
      code: 'STEP_UP_REQUIRED',
      message: 'Enter a code.',
      correlationId: 'c-1',
    });

  async function mount(attempt: () => Promise<string>, onResult: (r: string | null) => void) {
    const i18n = await createI18n({ namespaces: ['common'] });
    const client = await signedIn('manager', fakeBrowser().client);
    function Writer() {
      const stepUp = useStepUp();
      return (
        <>
          <button type="button" onClick={() => void stepUp.run(attempt).then(onResult)}>
            Save
          </button>
          {stepUp.dialog}
        </>
      );
    }
    render(
      <I18nextProvider i18n={i18n}>
        <AuthProvider client={client}>
          <UIProvider theme="light" density="compact" toastLabels={toastLabels}>
            <Writer />
          </UIProvider>
        </AuthProvider>
      </I18nextProvider>,
    );
  }

  it('asks for a code on STEP_UP_REQUIRED, steps up, and repeats the same write once', async () => {
    let calls = 0;
    const results: (string | null)[] = [];
    await mount(
      async () => {
        calls += 1;
        if (calls === 1) throw stepUpRequired();
        return 'saved';
      },
      (r) => results.push(r),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirm with your authenticator' });
    await userEvent.type(
      screen.getByLabelText(/^code from your authenticator app/i),
      FAKE_TOTP_CODE,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(results).toEqual(['saved']));
    expect(calls).toBe(2);
    expect(dialog).not.toBeInTheDocument();
  });

  it('keeps the dialog with the server’s words for a wrong code, and resolves null on cancel', async () => {
    let calls = 0;
    const results: (string | null)[] = [];
    await mount(
      async () => {
        calls += 1;
        throw stepUpRequired();
      },
      (r) => results.push(r),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await screen.findByRole('dialog');
    await userEvent.type(screen.getByLabelText(/^code from your authenticator app/i), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The code is wrong or already used.',
    );
    // The action row's Cancel (its words on screen), not the header's close button, also named Cancel.
    await userEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(results).toEqual([null]));
    expect(calls).toBe(1);
  });

  it('passes any other failure straight back', async () => {
    const failure = new ApiError({
      status: 500,
      code: 'INTERNAL',
      message: 'x',
      correlationId: 'c',
    });
    let caught: unknown = null;
    const i18n = await createI18n({ namespaces: ['common'] });
    const client = await signedIn('manager', fakeBrowser().client);
    function Writer() {
      const stepUp = useStepUp();
      return (
        <button
          type="button"
          onClick={() =>
            void stepUp
              .run(() => Promise.reject(failure))
              .catch((e: unknown) => {
                caught = e;
              })
          }
        >
          Save
        </button>
      );
    }
    render(
      <I18nextProvider i18n={i18n}>
        <AuthProvider client={client}>
          <UIProvider theme="light" density="compact" toastLabels={toastLabels}>
            <Writer />
          </UIProvider>
        </AuthProvider>
      </I18nextProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(caught).toBe(failure));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
