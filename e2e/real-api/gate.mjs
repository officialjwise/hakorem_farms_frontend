// F3's real-API gate: the production console build against a running backend (see docs/sessions/F05-stock.md).
// Usage, from the backend checkout (it reads the seeded password there; nothing secret is stored here):
//   node ../hakorem_farms_frontend/e2e/real-api/gate.mjs "$(grep '^SEED_STAFF_PASSWORD=' .env | cut -d= -f2-)" <owner-totp-secret-file> http://localhost:4173
// The Owner must have enrolled TOTP first; the secret file holds their base32 secret, kept outside the repo.
// Mind the login limit (20 per address per 15 minutes): run it once, not in a loop.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
const [pw, secretFile, base] = process.argv.slice(2);
const code = () =>
  execFileSync('node', [
    new URL('./totp.mjs', import.meta.url).pathname,
    execFileSync('cat', [secretFile]).toString().trim(),
  ])
    .toString()
    .trim();
const browser = await chromium.launch();
const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', name, String(e.message).split('\n')[0]]);
  }
};
const login = async (page, email) => {
  await page.goto(base + '/login');
  await page.getByLabel(/email or phone number/i).fill(email);
  await page.getByLabel(/^password/i).fill(pw);
  await page.getByRole('button', { name: 'Sign in' }).click();
};
// Owner
const ownerCtx = await browser.newContext({ viewport: { width: 360, height: 800 } });
const owner = await ownerCtx.newPage();
const errors = [];
owner.on('pageerror', (e) => errors.push(e.message));
await check('owner signs in with password then TOTP code', async () => {
  await login(owner, 'kwabena.owusu@seed.hakoremfarms.invalid');
  await owner.getByLabel(/^code/i).waitFor({ timeout: 10000 });
  await owner.getByLabel(/^code/i).fill(code());
  await owner.getByRole('button', { name: 'Verify' }).click();
  await owner.waitForURL(base + '/', { timeout: 10000 });
  await owner.getByRole('heading', { name: 'Dashboard', level: 1 }).waitFor();
  if (!(await owner.getByText('Signed in as Kwabena Owusu').count()))
    throw new Error('no signed-in name');
});
await check('owner reads the real session list (listSessions)', async () => {
  await owner.goto(base + '/sessions');
  await owner.getByRole('heading', { name: 'Sessions', level: 1 }).waitFor();
  await owner.getByText('This device').first().waitFor({ timeout: 10000 });
});
await check(
  'owner revokes another of their sessions with a reason (CSRF + Idempotency-Key write)',
  async () => {
    const other = owner
      .getByRole('row')
      .filter({ hasNotText: 'This device' })
      .filter({ has: owner.getByRole('button', { name: /^Revoke the session on/ }) })
      .first();
    await other.getByRole('button', { name: /^Revoke the session on/ }).click();
    const dialog = owner.getByRole('dialog');
    await dialog.getByLabel(/^reason/i).fill('Real-API gate check');
    await dialog.getByRole('button', { name: /sign the device out/i }).click();
    await owner
      .getByRole('status')
      .filter({ hasText: 'Session revoked' })
      .waitFor({ timeout: 10000 });
  },
);
await check('owner reads products from the real API (listProducts)', async () => {
  await owner.goto(base + '/products');
  await owner.getByRole('heading', { name: 'Products', level: 1 }).waitFor();
  await owner.getByText('LIV-SHEEP').first().waitFor({ timeout: 10000 });
});
await check('no page error in the owner session', async () => {
  if (errors.length) throw new Error(errors.join('; '));
});
// Cashier
const cashierCtx = await browser.newContext({ viewport: { width: 360, height: 800 } });
const cashier = await cashierCtx.newPage();
const sent = [];
cashier.on('request', (r) => {
  if (r.url().startsWith('http://localhost:3000')) sent.push(new URL(r.url()).pathname);
});
await check('cashier signs in with password only', async () => {
  await login(cashier, 'adwoa.darko@seed.hakoremfarms.invalid');
  await cashier.waitForURL(base + '/', { timeout: 10000 });
  await cashier.getByRole('heading', { name: 'Dashboard', level: 1 }).waitFor();
  if (!(await cashier.getByText('Signed in as Adwoa Darko').count()))
    throw new Error('no signed-in name');
});
for (const path of ['/users', '/roles', '/audit']) {
  await check(
    `cashier on ${path}: denied in words, same URL, nothing asked of the server`,
    async () => {
      const before = sent.length;
      await cashier.goto(base + path);
      await cashier
        .getByRole('alert')
        .filter({ hasText: 'You do not have access to this page' })
        .waitFor({ timeout: 10000 });
      if (new URL(cashier.url()).pathname !== path) throw new Error('moved to ' + cashier.url());
      const asked = sent
        .slice(before)
        .filter((p) => /\/v1\/(iam\/(users|roles|sessions)|audit)/.test(p));
      if (asked.length) throw new Error('asked the server: ' + asked.join(', '));
    },
  );
}
await check(
  'cashier on /sessions: the real role holds iam.session.read, so the page opens with their own sessions only',
  async () => {
    await cashier.goto(base + '/sessions');
    await cashier.getByRole('heading', { name: 'Sessions', level: 1 }).waitFor();
    await cashier.getByText('This device').first().waitFor({ timeout: 10000 });
    const people = await cashier.getByRole('rowheader').allInnerTexts();
    if (!people.every((x) => x.includes('Adwoa Darko')))
      throw new Error('others visible: ' + people.join(' | '));
  },
);
await browser.close();
for (const r of results) console.log(r.join(' | '));
process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0);
