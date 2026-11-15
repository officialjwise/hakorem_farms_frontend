import { expect, test } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  signInWithTotp,
  USERS,
} from '../../support/helpers';

/**
 * F6's livestock flows (FR-LIV), on a phone: the suite runs at 360 px. The gate is the first test: one
 * animal's full history reads on one screen without scrolling to find it.
 */

const ANY = '019a7a86-3046-711a-a652-1a7389f79351';

for (const scheme of ['light', 'dark'] as const) {
  test(`the F6 gate (${scheme}): one animal's full history on one screen, found without scrolling`, async ({
    page,
    api,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await signInWithTotp(page, USERS.owner, `/animals/${ANY}`);
    await expect(page.getByRole('heading', { level: 1, name: 'G-0142, Goat' })).toBeVisible();
    // The history starts on the first screenful, before anything else to read.
    await expect(page.getByRole('heading', { name: 'History' })).toBeInViewport();
    const events = page.getByRole('list', { name: 'Events, newest first' }).getByRole('listitem');
    await expect(events).toHaveCount(6);
    await expect(events.first()).toContainText('Weighed');
    await expect(events.last()).toContainText('Bought from Kpone Livestock Traders');
    // All of it, from one read of every page: nothing to page through.
    expect(api.log.filter((e) => e.operationId === 'listAnimalTimeline').length).toBeGreaterThan(0);
    await expect(page.getByRole('navigation', { name: /pages/i })).toHaveCount(0);
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
  });
}

test('a death at or above the threshold is sent for approval and nothing is written off', async ({
  page,
  api,
}) => {
  api.rewrite('getMortalityRecord', (body) => ({
    ...(body as object),
    status: 'REPORTED',
    approvalRequestId: null,
  }));
  api.prefer('submitMortalityRecord', 'code=202');
  await signInWithTotp(page, USERS.owner, `/mortality/${ANY}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Death of G-0171' })).toBeVisible();
  await page.getByRole('button', { name: 'Submit and write off' }).click();
  const confirm = page.getByRole('dialog', { name: 'Write off G-0171?' });
  await expect(confirm).toContainText('GH₵589.00');
  await expectNoAxeViolations(page);
  await confirm.getByRole('button', { name: 'Submit and write off' }).click();
  await expect(
    page.getByText('Sent for approval. Nothing has been written off yet.'),
  ).toBeVisible();
  expect(api.log.filter((e) => e.operationId === 'submitMortalityRecord')).toHaveLength(1);
});

test('a pen is weighed from a phone: each weight typed down the list, sent together', async ({
  page,
  api,
}) => {
  await signInWithTotp(page, USERS.owner, '/weights');
  await page.getByRole('button', { name: 'Weigh a pen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Weigh a pen' });
  // By the keyboard, as the stock specs choose from a list in a dialog.
  const pen = dialog.getByRole('combobox', { name: /^Pen/ });
  await pen.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('option', { name: 'Goat pen 1' }).press('Enter');
  await expect(pen).toHaveText('Goat pen 1');
  const first = dialog.getByLabel(/^Weight of G-0142, Goat/);
  await first.fill('27.1');
  await dialog.getByLabel(/^Weight of G-0157, Goat/).fill('32');
  await expectNoAxeViolations(page);
  await dialog.getByRole('button', { name: 'Send the weights' }).click();
  await expect(
    page
      .getByRole('alert')
      .or(page.getByRole('status'))
      .filter({ hasText: /recorded/ })
      .first(),
  ).toBeVisible();
  const sent = api.log.filter((e) => e.operationId === 'recordWeights');
  expect(sent).toHaveLength(1);
});

test('the Farm hand records at the pen from the weights page and never meets an empty list', async ({
  page,
}) => {
  await signIn(page, USERS.farmHand, '/weights');
  await expect(page.getByRole('heading', { level: 1, name: 'Weights' })).toBeVisible();
  const work = page.getByRole('region', { name: 'Other pen work' });
  await expect(work.getByRole('button', { name: 'Record feed given' })).toBeVisible();
  await page.getByRole('button', { name: 'Weigh one animal' }).click();
  await expect(page.getByRole('dialog', { name: 'Which animal?' })).toContainText(
    'Your role cannot look animals up by tag yet',
  );
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
});

for (const [path, ready] of [
  ['/animals', 'G-0157'],
  ['/weights', 'BRL-2610-01'],
  ['/health-events', 'Every animal in Broiler house 1'],
  [`/health-events/${ANY}`, 'Withdrawal period'],
  ['/breeding', 'Dam G-0122'],
  [`/breeding/${ANY}`, 'Breeding of G-0118'],
  ['/mortality', 'G-0171'],
  ['/feed', 'Layer house'],
] as const) {
  test(`${path} at 360 px: axe clean, no sideways scroll`, async ({ page }) => {
    await signInWithTotp(page, USERS.owner, path);
    await expect(page.getByText(ready).first()).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
  });
}
