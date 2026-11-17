/**
 * Receiving a transfer with a shortfall (FR-INV-011, the owner's control gap A-F5-06), against the REAL
 * Prism mock: Prism validates the request body against the contract, so a shortfall the screen sends is
 * proved to be the shape `receiveStockTransfer` takes. The fixture is a dispatched transfer typed from the
 * generated schema, because the contract's example is already received.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { components } from '@hakorem/api-client';
import { appRoutes } from '../app/appRoutes';
import { queryClient } from '../data/api';
import { renderApp, signedIn } from '../test/harness';
import { ReceiveTransfer } from './ReceiveTransfer';

const TRANSFER: components['schemas']['StockTransfer'] = {
  id: '019a7ab6-66c7-7aa1-9fd9-b2ea34d62bc8',
  transferNo: 'TRF-2026-DDW-00012',
  status: 'DISPATCHED',
  from: {
    id: '019a7a84-5c55-7000-8000-000000000001',
    code: 'SITE',
    name: 'Dodowa farm',
    kind: 'SITE',
  },
  to: {
    id: '019a7a84-7f34-76a9-8be1-736ae249ec48',
    code: 'SHOP',
    name: 'Shop floor',
    kind: 'SHOP_FLOOR',
  },
  toBranch: {
    id: '019a7a83-2aef-79e3-9f1b-a708a7ae1fe6',
    code: 'DDW',
    name: 'HaKorem Farms, Dodowa',
  },
  lines: [
    {
      id: '019a7ab6-85b6-7485-a9bd-5121ae87c9ff',
      lineNo: 1,
      product: {
        id: '019a7a8e-0001-7000-8000-000000000001',
        sku: 'EGG-BIG',
        name: 'Eggs, big, crate of 30',
      },
      stockUnit: null,
      uom: 'CRATE',
      qtyDispatched: '20.000',
      baseUom: 'CRATE',
      qtyDispatchedBase: '20.000',
      qtyReceived: null,
      varianceQty: null,
      varianceReasonCode: null,
    },
  ],
  dispatchedAt: '2026-11-15T06:00:00Z',
  dispatchedBy: { id: '019a7a86-8d13-7ec4-93fc-f519f70a6df7', displayName: 'Yaw Boateng' },
  receivedAt: null,
  receivedBy: null,
  branchId: '019a7a83-2aef-79e3-9f1b-a708a7ae1fe6',
  version: 1,
  createdAt: '2026-11-15T05:30:00Z',
};

const routes = appRoutes({
  publicRoutes: [],
  protectedRoutes: [
    {
      path: 'receive',
      element: <ReceiveTransfer transfer={TRANSFER} />,
      handle: { permission: 'inv.transfer.receive', shell: 'back-office', crumb: 'transfer' },
    },
  ],
  rest: [],
});

afterEach(() => {
  queryClient.clear();
});

describe('receiving a transfer: what arrived, line by line', () => {
  it('twenty sent and eighteen arrived: short, a reason is required, and the shortfall is sent to the API', async () => {
    const user = userEvent.setup();
    await renderApp('/receive', await signedIn('storekeeper'), routes);
    const form = await screen.findByRole('form', { name: 'What arrived, line by line' });
    const field = within(form).getByLabelText(/^Eggs, big, crate of 30: quantity that arrived/);
    // Empty: what arrived is counted, never assumed from what was sent.
    expect(field).toHaveValue('');
    await user.click(within(form).getByRole('button', { name: 'Check and receive' }));
    expect(await within(form).findByText(/^Enter a quantity/)).toBeInTheDocument();
    await user.type(field, '20');
    expect(within(form).getByText('All arrived')).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, '18');
    expect(within(form).getByText('Short')).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Check and receive' }));
    expect(await within(form).findByText('Choose a reason for the shortfall.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(
      within(form).getByRole('combobox', { name: /^Why Eggs, big, crate of 30 is short/ }),
    );
    await user.click(await screen.findByRole('option', { name: 'Earlier count was wrong' }));
    await user.click(within(form).getByRole('button', { name: 'Check and receive' }));
    const dialog = await screen.findByRole('dialog', { name: 'Receive this transfer?' });
    expect(dialog).toHaveTextContent('1 line is short');
    expect(dialog).toHaveTextContent('Sent 20 Crate, arrived 18 Crate');
    await user.click(within(dialog).getByRole('button', { name: 'Receive' }));
    expect(await screen.findByRole('status')).toHaveTextContent('1 line was short');
  });

  it('more than was sent is refused in words, and nothing is sent', async () => {
    const user = userEvent.setup();
    await renderApp('/receive', await signedIn('storekeeper'), routes);
    const form = await screen.findByRole('form', { name: 'What arrived, line by line' });
    const field = within(form).getByLabelText(/^Eggs, big, crate of 30: quantity that arrived/);
    await user.clear(field);
    await user.type(field, '21');
    await user.click(within(form).getByRole('button', { name: 'Check and receive' }));
    expect(await within(form).findByText(/More than was sent/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
