/**
 * Reporting a death from the pen against the REAL Prism mock (ADR 0019): the Farm hand reports and submits
 * through the care operations, with the photograph uploaded as multipart (ADR 0037), and the report never
 * dead-ends: a submit that did not get through stays on the page, remembered on the device, with "Send it
 * again" (ADR 0039).
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '../data/api';
import { renderApp, signedIn } from '../test/harness';
import { mock } from '../test/integration-setup';

const photo = () =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'pen.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  // jsdom draws no pictures: the preview's object URL is a stand-in.
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:preview', revokeObjectURL: () => undefined }),
  );
  window.localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  queryClient.clear();
});

async function fillReport(user: UserEvent) {
  await user.type(await screen.findByRole('combobox', { name: /Animal/ }), 'G-01');
  await user.click(await screen.findByRole('option', { name: 'G-0142, Goat' }));
  const reason = await screen.findByRole('combobox', { name: /Reason/ });
  await user.click(reason);
  await user.click((await screen.findAllByRole('option'))[0] as HTMLElement);
  await user.upload(screen.getByLabelText(/^Photograph/), photo());
  expect(await screen.findByRole('img', { name: 'The photograph you took' })).toBeInTheDocument();
}

describe('reporting a death from the pen', () => {
  it('asks for the photograph before anything is sent, in words on the field', async () => {
    const user = userEvent.setup();
    await renderApp('/report-death', await signedIn('farmHand'));
    await user.click(await screen.findByRole('button', { name: 'Check and send' }));
    expect(screen.getByLabelText(/^Photograph/)).toHaveAccessibleDescription(
      /Take the photograph first/,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the Farm hand reports and sends it in one step, and is told a manager decides it', async () => {
    const user = userEvent.setup();
    mock.prefer = 'code=202';
    mock.preferPath = '/care/mortality-records/';
    await renderApp('/report-death', await signedIn('farmHand'));
    await fillReport(user);
    await user.click(screen.getByRole('button', { name: 'Check and send' }));
    const dialog = await screen.findByRole('dialog', { name: /Send this Death of G-0142, Goat\?/ });
    expect(dialog).toHaveTextContent('Attached');
    await user.click(within(dialog).getByRole('button', { name: 'Send the report' }));
    expect(await screen.findByText('Death of G-0142 sent for approval')).toBeInTheDocument();
    expect(screen.getByText(/A manager decides it in the approvals inbox/)).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
  });

  it('a submit that does not get through stays on the page, and "Send it again" sends the same report', async () => {
    const user = userEvent.setup();
    mock.prefer = 'code=500';
    mock.preferPath = '/care/mortality-records/';
    await renderApp('/report-death', await signedIn('farmHand'));
    await fillReport(user);
    await user.click(screen.getByRole('button', { name: 'Check and send' }));
    const dialog = await screen.findByRole('dialog', { name: /Send this Death/ });
    await user.click(within(dialog).getByRole('button', { name: 'Send the report' }));
    const stuck = await screen.findByText(/is reported, but not yet sent for approval/);
    const alert = stuck.closest('[role="alert"]') ?? stuck.parentElement?.parentElement;
    expect(alert).toHaveTextContent(/Quote this reference/);
    // Remembered on this device, so leaving the page loses nothing.
    expect(window.localStorage.length).toBe(1);

    mock.prefer = null;
    mock.preferPath = null;
    await user.click(screen.getByRole('button', { name: 'Send it again' }));
    expect(await screen.findByText('Death of G-0142 written off')).toBeInTheDocument();
    await waitFor(() => expect(window.localStorage.length).toBe(0));
  });
});
