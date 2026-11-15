import { expect, test } from '../../support/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  signIn,
  USERS,
} from '../../support/helpers';

/** A tiny JPEG's bytes: enough for the upload, which Prism checks against the contract's FileUpload. */
const PHOTO = {
  name: 'G-0142.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]),
};

test('the Farm hand reports a death with its photograph from the pen and sends it for approval', async ({
  page,
  api,
}) => {
  api.prefer('submitCareMortalityRecord', 'code=202');
  await signIn(page, USERS.farmHand, '/report-death');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Report a death or cull' }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);

  await page.getByRole('combobox', { name: /Animal/ }).fill('G-01');
  await page.getByRole('option', { name: 'G-0142, Goat' }).click();
  await page.getByRole('combobox', { name: /Reason/ }).click();
  await page.getByRole('option').first().click();
  await page.getByLabel(/^Photograph/).setInputFiles(PHOTO);
  await expect(page.getByRole('img', { name: 'The photograph you took' })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Check and send' }).click();
  const dialog = page.getByRole('dialog', { name: /Send this Death of G-0142, Goat\?/ });
  await expect(dialog).toContainText('Attached');
  await dialog.getByRole('button', { name: 'Send the report' }).click();
  await expect(page.getByText('Death of G-0142 sent for approval')).toBeVisible();
  await expectNoAxeViolations(page);

  const sent = api.log.map((e) => e.operationId);
  // The photograph went up as multipart, then the cost-free report and its submit: never the full writes.
  expect(sent).toContain('uploadFile');
  expect(sent.indexOf('uploadFile')).toBeLessThan(sent.indexOf('reportCareMortality'));
  expect(sent.indexOf('reportCareMortality')).toBeLessThan(
    sent.indexOf('submitCareMortalityRecord'),
  );
  expect(sent).not.toContain('reportMortality');
});

test('a role that cannot report a death meets the page as permission denied, in words', async ({
  page,
}) => {
  await signIn(page, USERS.cashier, '/report-death');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('You do not have access to this page');
  await expect(alert).toContainText('liv.mortality.report');
  await expect(page).toHaveURL('/report-death');
  await expectNoAxeViolations(page);
});
