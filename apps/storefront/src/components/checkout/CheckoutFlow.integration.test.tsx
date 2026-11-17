import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { getWords } from '../../i18n/server';
import { rememberCart } from '../../lib/cartId';
import { mock } from '../../test-integration-setup';
import { Root } from '../../test-wrapper';
import { CheckoutFlow } from './CheckoutFlow';

/** The cart in the contract's examples: a weighed pack of chicken and two crates of eggs. */
const CART = '019a7aa9-1c15-7ae4-b01c-b713eac82ff1';

async function renderCheckout() {
  const words = await getWords('checkout', 'cart', 'price', 'refusals');
  return render(<CheckoutFlow words={words} />, { wrapper: Root });
}

beforeEach(() => {
  rememberCart(CART);
});

describe('checkout, against the real Prism', () => {
  it('from the basket to a placed order: details, delivery checked, a slot, the hold, the estimate, pay', async () => {
    const user = userEvent.setup();
    await renderCheckout();

    // 1. The basket, with the API's estimate and the weighed line said as weighed.
    const basket = await screen.findByRole('list', { name: 'Your basket' });
    expect(
      within(basket).getByRole('article', { name: 'Full chicken, 15 kg pack' }),
    ).toHaveTextContent('Weighed before it is sent');
    expect(screen.getByText('GH₵420.00')).toBeInTheDocument();

    // 2. Details. Nothing is sent until what is required is there.
    await user.click(screen.getByRole('button', { name: 'Hold my items and show the total' }));
    expect(
      screen.getByText('Some details need correcting. They are marked below.'),
    ).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /Your name/ }), 'Ama Serwaa Ofori');
    await user.type(screen.getByRole('textbox', { name: /Phone number/ }), '024 451 2876');
    await user.type(
      screen.getByRole('textbox', { name: /House number and street/ }),
      'House 14, Ashaley Botwe Road',
    );
    await user.type(screen.getByRole('textbox', { name: /Area or suburb/ }), 'Madina');
    await user.type(screen.getByRole('textbox', { name: /Town or city/ }), 'Accra');

    // 3. Delivery checked against the zones, then a time from the zone's open slots.
    await user.click(screen.getByRole('button', { name: 'Check delivery to this address' }));
    expect(await screen.findByText(/We deliver to Accra East/)).toBeInTheDocument();
    const slots = await screen.findByRole('radiogroup', { name: /When should we come/ });
    expect(
      within(slots).getByRole('radio', { name: 'Saturday 14 November, 14:00 to 16:00' }),
    ).toBeDisabled();
    await user.click(
      within(slots).getByRole('radio', { name: 'Saturday 14 November, 10:00 to 12:00' }),
    );

    // 4. The hold: the API's total, said to be an estimate beside it, with the most it can be.
    await user.click(screen.getByRole('button', { name: 'Hold my items and show the total' }));
    const estimate = await screen.findByRole('region', { name: 'Your total is an estimate' });
    expect(estimate).toHaveTextContent('GH₵450.00');
    expect(estimate).toHaveTextContent('The most you can be charged');
    expect(estimate).toHaveTextContent('GH₵480.00');
    expect(estimate).toHaveTextContent(/never more than GHS 480.00/);
    expect(screen.getByText(/Your items are held for you until 07:56/)).toBeInTheDocument();

    // 5. Pay: the button names the exact amount.
    await user.click(screen.getByRole('button', { name: 'Pay GH₵450.00' }));
    expect(
      await screen.findByRole('heading', { name: /Your order SO-2026-DDW-004216 is placed/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Approve GHS 450.00 to HaKorem Farms on your MTN phone/),
    ).toBeInTheDocument();
  });

  it('a refused hold stays on screen in words, with the reference', async () => {
    const user = userEvent.setup();
    await renderCheckout();
    await screen.findByRole('list', { name: 'Your basket' });
    await user.click(screen.getByRole('radio', { name: /I will collect from the farm/ }));
    await user.type(screen.getByRole('textbox', { name: /Your name/ }), 'Kofi Mensah');
    await user.type(screen.getByRole('textbox', { name: /Phone number/ }), '0201234567');
    mock.prefer = 'code=422';
    mock.preferPath = `/shop/carts/${CART}/checkout`;
    await user.click(screen.getByRole('button', { name: 'Hold my items and show the total' }));
    const title = await screen.findByText('Your items could not be held');
    const alert = title.closest<HTMLElement>('[role="alert"]');
    if (alert === null) throw new Error('The failure is not inside an alert.');
    // The contract's shared 422 example has a code the shop has no words for: the server's sentence shows.
    expect(alert).toHaveTextContent(/veterinary withdrawal period/);
    // The last eight characters, grouped, and a button that copies all of it (ADR 0051).
    expect(alert).toHaveTextContent('quote this reference: 965f d37e');
    expect(alert).not.toHaveTextContent('019a7b1d-f4de-751c-aa55-5aa0965fd37e');
    expect(within(alert).getByRole('button', { name: 'Copy the full reference' })).toBeVisible();
  });

  it('with no basket, says so and leads back to the shop', async () => {
    rememberCart(null);
    await renderCheckout();
    expect(screen.getByText('Nothing to check out')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the shop' })).toHaveAttribute('href', '/');
  });
});
