/**
 * A fake of the contract's staff authentication endpoints, at the HTTP boundary (ADR 0026). TEST SUPPORT
 * ONLY: nothing in the app imports it, so it never reaches a build. It replaces the F1 stub (ADR 0012),
 * which sat inside the app; now the app runs its real client (ADR 0024) and this answers the requests.
 *
 * Two users of it, one behaviour:
 * - unit tests (`fakeFetch.ts`) hand the real auth client a fetch that answers from here;
 * - the end to end suite (`e2e/support/fakeApi.ts`) answers the browser's requests from here through
 *   Playwright's routing, and sends everything that is not auth on to the Prism mock.
 *
 * What it mimics (contract 1.1.0, `backend/docs/API.md` 3.1 to 3.4):
 * - loginStaff and verifyTotp set the access cookie `__Host-hk_s_at` (10 minutes) and the refresh cookie
 *   `__Host-hk_s_rt` (the session lifetime). Cookies live in a `CookieJar` per browser, which the caller
 *   owns: an expired cookie is dropped, as a browser would.
 * - refreshSession rotates the refresh token; presenting an already-rotated one revokes the whole session.
 * - Failed logins answer with one message (INVALID_CREDENTIALS) and back off (429 RATE_LIMITED).
 * - A TOTP challenge is single use and short lived.
 * - logout and changePassword need the CSRF token of the session (`X-CSRF-Token`).
 * - The first-login password change authenticates with the pending challenge (A-F1-04, CR-004).
 *
 * The users, the TOTP code (the contract's own example) and the reset code are fixtures, not secrets.
 */
import type { SessionInfo } from '../auth/types';

export const ACCESS_TTL_MS = 10 * 60 * 1000;
export const REFRESH_TTL_MS = 12 * 60 * 60 * 1000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCKOUT_MS = 30 * 1000;
const MAX_TOTP_ATTEMPTS = 5;
const MS_PER_SECOND = 1000;
const MIN_PASSWORD_LENGTH = 12;
/** A step-up counts for five minutes on the session it was made on (API.md 3.4). */
export const STEP_UP_TTL_MS = 5 * 60 * 1000;

/**
 * The operations the contract marks "Requires step-up" that the F3 screens call, and the till's sign-off of a
 * shift's close (2.5.0). The fake answers them with
 * 403 `STEP_UP_REQUIRED` until the session has stepped up in the last five minutes, as API.md 3.4 says the
 * server does. The list is the contract's descriptions, read by hand: the operation table does not carry it.
 */
export const STEP_UP_OPERATIONS: ReadonlySet<string> = new Set([
  'createUser',
  'resetUserPassword',
  'createRole',
  'updateRole',
  'createGrant',
  'revokeGrant',
  'approveShiftClose',
  // 2.6.0: the till's devices and a shift closed without its cashier (x-requires-step-up).
  'enrolDevice',
  'revokeDevice',
  'forceCloseShift',
]);

/** The code the fake accepts for any user with TOTP. It is the contract's own example code. */
export const FAKE_TOTP_CODE = '481205';
/** The reset code the fake accepts. Real codes arrive by SMS or email. */
export const FAKE_RESET_CODE = '738204';

const BRANCH = {
  branchId: '019a7a83-2aef-79e3-9f1b-a708a7ae1fe6',
  branchCode: 'DDW',
  locationId: null,
  locationCode: null,
} as const;

/**
 * The owner's two selling points beside the farm (F5b: Kasoa and KNUST). Not in the contract's
 * `listBranches` example, so the switcher shows their codes, as it does for any branch it cannot name.
 */
const SELLING_POINTS = [
  {
    branchId: '019a7ab0-1c3e-7d21-9a40-6b2f8e0c4a11',
    branchCode: 'KAS',
    locationId: null,
    locationCode: null,
  },
  {
    branchId: '019a7ab0-2d4f-7e32-8b51-7c3a9f1d5b22',
    branchCode: 'KNU',
    locationId: null,
    locationCode: null,
  },
] as const;

export interface FakeUser {
  id: string;
  displayName: string;
  password: string;
  totp: boolean;
  mustChangePassword: boolean;
  roleCode: string;
  roleName: string;
  permissions: readonly string[];
  /**
   * The role must use TOTP and the user has not set it up: sign-in answers TOTP_ENROLMENT_REQUIRED until
   * they enrol with startTotpEnrolment and confirmTotpEnrolment, and asks for a code after that.
   */
  mustEnrolTotp?: boolean;
  /** Branches beyond the farm where the user holds the same role. */
  moreBranches?: readonly (typeof SELLING_POINTS)[number][];
}

/**
 * What the till needs beyond the real seed's Cashier (F9, A-F9-01; CR-023 asks for the role matrix): its own
 * shifts (`listShifts` says "a cashier sees only their own shifts"), the cash drops and pay-outs it records,
 * its X report, the till's reason codes, and returns at the counter (the owner, 2026-11-16: "refunds at the
 * counter are till returns, not credit notes").
 */
const CASHIER_TILL_PERMISSIONS = [
  'pos.shift.read',
  'pos.cash.move',
  'pos.shift.report',
  'mdm.reason_code.read',
  'ord.return.create',
  'ord.return.read',
  // A mobile money tender at the counter: the request to the customer's phone and the check that it cleared.
  'pay.payment.initiate',
  'pay.payment.read',
];

/**
 * What a Manager holds at the till (F9, A-F9-01): setting a till up (the registers and enrolling the device,
 * "a manager" in OFFLINE_SYNC section 3), signing a shift's close off, and force-closing one.
 */
const MANAGER_TILL_PERMISSIONS = [
  'pos.register.read',
  'pos.device.read',
  'pos.device.enrol',
  'pos.shift.close.approve',
  'pos.shift.force_close',
];

/**
 * The real seed's Cashier (backend main at e47ae8f, read by signing in on localhost in F5). It holds its own
 * sessions: `iam.session.read` and `iam.session.revoke` answer only for the caller's own devices.
 */
const CASHIER_PERMISSIONS = [
  'iam.session.read',
  'iam.session.revoke',
  'pos.sale.create',
  'pos.shift.open',
  'pos.shift.close',
  'mdm.product.read',
  // Not `inv.stock.read`: the seeded Cashier does not hold it (2.2.0, CR-023). The till's stock is the pack's.
  'pay.payment.create',
  'ord.order.read',
  // 1.39.0 and 1.40.0: the Cashier reads the branch's billing documents and reprints them.
  'bil.document.read',
  'bil.document.reprint',
  ...CASHIER_TILL_PERMISSIONS,
];

/** What the owner holds for the F3 screens: users, roles, grants, sessions and the audit log. */
const OWNER_PERMISSIONS = [
  ...CASHIER_PERMISSIONS,
  'iam.user.read',
  'iam.user.create',
  'iam.user.update',
  'iam.user.disable',
  'iam.user.unlock',
  'iam.user.reset_password',
  'iam.role.read',
  'iam.role.manage',
  'iam.grant.read',
  'iam.grant.manage',
  'mdm.branch.read',
  'aud.audit.read',
];

/** What the owner holds for the F4 screens: the catalogue, its reference data and price lists. */
const OWNER_CATALOGUE_PERMISSIONS = [
  'mdm.product.create',
  'mdm.product.update',
  'mdm.product.archive',
  'mdm.category.read',
  'mdm.category.create',
  'mdm.category.update',
  'mdm.category.archive',
  'mdm.tax.read',
  'mdm.species.read',
  'mdm.grade.read',
  'mdm.grade.create',
  'mdm.grade.update',
  'mdm.grade.archive',
  'mdm.weight_band.read',
  'mdm.weight_band.create',
  'mdm.weight_band.update',
  'mdm.weight_band.archive',
  'mdm.price_list.read',
  'mdm.price_list.update',
];

/**
 * What a storekeeper holds for the F5 screens (and the owner too): stock, counts and movements. Posting a
 * count's variances (`inv.stock_take.post`) is the Owner's and the Manager's in the seed (CR-023), so the
 * Storekeeper counts and a manager posts.
 */
const STOCK_PERMISSIONS = [
  'inv.stock.read',
  'mdm.product.read',
  'mdm.location.read',
  'mdm.reason_code.read',
  'inv.stock_take.read',
  'inv.stock_take.create',
  'inv.stock_take.count',
  'inv.adjustment.read',
  'inv.adjustment.create',
  'inv.transfer.read',
  'inv.transfer.create',
  'inv.transfer.dispatch',
  'inv.transfer.receive',
  'inv.goods_receipt.read',
  'inv.goods_receipt.create',
  'inv.goods_receipt.post',
  // The egg session (2.3.0): the supplier on a goods receipt, and purchase orders drafted and received.
  'mdm.supplier.read',
  'pur.purchase_order.read',
  'pur.purchase_order.create',
];

/**
 * What the Owner holds beyond the Storekeeper for buying and bulk prices (the egg session), as seeded:
 * submitting past the limit is approved by another person, sending, closing and cancelling an order, and
 * giving a buyer their own price list.
 */
const OWNER_EGG_PERMISSIONS = [
  'pur.purchase_order.approve',
  'pur.purchase_order.send',
  'pur.purchase_order.close',
  'mdm.price_list.assign',
  'mdm.price_list.create',
  'mdm.customer.read',
  // 2.4.0: a claim for goods rejected at the door is raised and read with the supplier invoice permissions.
  'pur.supplier_invoice.read',
  'pur.supplier_invoice.create',
];

/**
 * Supplier invoices and payments (F10g), as seeded for the Owner: entering, matching and approving an
 * invoice, asking for and approving a variance, preparing, approving and paying a payment.
 */
const OWNER_PAYABLE_PERMISSIONS = [
  'pur.supplier_invoice.read',
  'pur.supplier_invoice.create',
  'pur.supplier_invoice.match',
  'pur.supplier_invoice.approve',
  'pur.supplier_invoice.variance_approve',
  'pur.supplier_payment.read',
  'pur.supplier_payment.create',
  'pur.supplier_payment.approve',
  'pur.supplier_payment.pay',
];

/**
 * F10i: quotes, requests for quote, wholesale accounts, the ageing and an order's credit check. The seed
 * grants no quo.* or whl.* permission yet (B10, CR-046 item 5); the Owner and the Manager hold all of
 * them here (A-F10-10). The order, price and proforma permissions are the seed's own.
 */
const WHOLESALE_PERMISSIONS = [
  'quo.rfq.read',
  'quo.rfq.update',
  'quo.quote.read',
  'quo.quote.create',
  'quo.quote.issue',
  'quo.quote.convert',
  'whl.account.read',
  'whl.account.manage',
  'whl.account.hold',
  'whl.ageing.read',
  'mdm.customer.read',
  'mdm.price.resolve',
  'mdm.price_list.read',
  'ord.order.read',
  'ord.order.confirm',
  'bil.proforma.create',
];

/**
 * F10i, the owner (2026-11-18): Sales builds, revises, sends and converts quotes, and never approves a
 * credit override. What the seed gives the role (the customer, price, order and proforma permissions), and
 * the quote permissions not seeded yet (A-F10-10, CR-048). No hold, no terms, no approvals.
 */
const SALES_PERMISSIONS = [
  'mdm.customer.read',
  'mdm.product.read',
  'mdm.price.resolve',
  'mdm.price_list.read',
  'ord.order.read',
  'ord.order.confirm',
  'bil.proforma.create',
  'quo.rfq.read',
  'quo.rfq.update',
  'quo.quote.read',
  'quo.quote.create',
  'quo.quote.issue',
  'quo.quote.convert',
  'whl.account.read',
  'whl.ageing.read',
];

/** What the owner holds for the F5b screens: the dashboard, branches and locations, and the new lists. */
const OWNER_F5B_PERMISSIONS = [
  'rpt.dashboard.owner',
  'rpt.exceptions.read',
  'mdm.branch.create',
  'mdm.branch.update',
  'mdm.location.create',
  'mdm.location.update',
  'mdm.supplier.read',
  'inv.movement.read',
  'pos.register.read',
  'rpt.report.read',
  'rpt.report.export',
  'fin.report.read',
];

/** What the owner holds for the F5c settings section: the business profile and the system settings. */
const OWNER_F5C_PERMISSIONS = ['aud.setting.read'];

/**
 * What the owner holds for the F6b work: the approval inbox, files (a death's photograph), reversing a
 * processing order (1.26.0), and approving a purchase order (the PURCHASE_ORDER policy's `approverPermission`).
 */
const OWNER_F6B_PERMISSIONS = [
  'iam.approval.read',
  'iam.approval.cancel.own',
  'platform.file.upload',
  'platform.file.read',
  'prc.order.reverse',
  'pur.purchase_order.approve',
];

/**
 * What the owner holds for the F8 screens (1.39.0 to 1.41.0): billing documents and their reprints, credit
 * notes (raising and approving), debit notes, the archive, statements, and the reads their forms need.
 */
const OWNER_F8_PERMISSIONS = [
  'bil.document.read',
  'bil.document.reprint',
  'bil.credit_note.create',
  'bil.credit_note.approve',
  'bil.debit_note.create',
  'doc.document.read',
  'whl.statement.read',
  'whl.statement.create',
  'mdm.customer.read',
];

/** What the owner holds for the F6 screens: every livestock and processing permission in the contract. */
const OWNER_F6_PERMISSIONS = [
  'liv.animal.read',
  'liv.animal.update',
  'liv.animal.move',
  'liv.weight.read',
  'liv.weight.record',
  'liv.health.read',
  'liv.health.record',
  'liv.breeding.read',
  'liv.breeding.record',
  'liv.mortality.read',
  'liv.mortality.report',
  'liv.mortality.approve',
  'liv.mortality.post',
  'liv.mortality.confirm',
  'liv.feed.read',
  'liv.feed.record',
  'liv.feed.manage',
  'liv.batch.read',
  'liv.batch.create',
  'liv.batch.update',
  'liv.report.read',
  'prc.order.read',
  'prc.order.create',
  'prc.order.process',
  'prc.yield_standard.read',
  'prc.yield_standard.manage',
];

/**
 * The Farm hand, from what the contract says the role holds (1.28.0; the seed itself is not readable here,
 * CR-023 asks for it):
 * - weights, read and recorded (1.24.0, A-158);
 * - nine writes it "holds ... but not the read", so it uses their care twins (1.26.0, ADR-0052): health
 *   events, feed, reporting and submitting a death, editing and moving an animal, and creating, updating
 *   and closing a batch;
 * - the care register, health events, rations and batches through `liv.care.read` (1.26.0);
 * - breeding and growth (1.25.0: "The Vet or Farm hand now holds the edits, moves, batches, growth and
 *   breeding");
 * - the reason codes, so a death can say why: confirmed by the owner (2026-11-16, A-F6b-02);
 * - the evidence upload a death's photograph needs, and no other purpose (1.31.0:
 *   `platform.file.upload.evidence`, "the Farm hand");
 * - location and product reads, so a pen and a feed or medicine can be named: assumed (A-F6-02, CR-023).
 * It holds neither `liv.mortality.post` nor `liv.mortality.confirm` (1.31.0), so every death it submits
 * waits for a second person.
 */
const FARM_HAND_PERMISSIONS = [
  'liv.weight.read',
  'liv.weight.record',
  'liv.care.read',
  'liv.health.record',
  'liv.feed.record',
  'liv.mortality.report',
  'liv.animal.update',
  'liv.animal.move',
  'liv.batch.create',
  'liv.batch.update',
  'liv.breeding.read',
  'liv.breeding.record',
  'liv.report.read',
  'mdm.location.read',
  'mdm.product.read',
  'mdm.reason_code.read',
  'platform.file.upload.evidence',
];

/**
 * The Manager: the four approving permissions the contract's `listRoles` example gives the role, the
 * approval inbox they are decided in (`iam.approval.read`), the reads a decision's evidence opens (a death
 * and its photograph), and reversing a completed processing order (1.26.0: "the Owner and the Manager").
 * It writes a death off below the threshold and confirms a Farm hand's (1.31.0: `liv.mortality.post`,
 * `liv.mortality.confirm`).
 */
const MANAGER_PERMISSIONS = [
  ...CASHIER_PERMISSIONS,
  'inv.stock.read',
  'iam.user.read',
  'iam.approval.read',
  'iam.approval.cancel.own',
  // The seed's name (`voidSale`'s approver); the `listRoles` example still says `ord.order.void.approve`.
  'ord.void.approve',
  'inv.adjustment.approve',
  'liv.mortality.approve',
  'mdm.price_list.approve',
  'liv.animal.read',
  'liv.mortality.read',
  'liv.mortality.report',
  'liv.mortality.post',
  'liv.mortality.confirm',
  'platform.file.read',
  'platform.file.upload',
  'prc.order.read',
  'prc.order.create',
  'prc.order.reverse',
  // 1.39.0 and 1.40.0: the Manager reads and reprints billing documents, approves credit notes and opens
  // the archive. The owner (2026-11-16): the Accountant, a Manager or the Owner raises a credit note, never
  // a cashier, and an Owner or Manager who did not raise it approves it. The backend is putting it in the
  // role matrix (CR-023).
  'bil.document.read',
  'bil.document.reprint',
  'bil.credit_note.create',
  'bil.credit_note.approve',
  'doc.document.read',
  // F10g, as seeded: the Manager reads supplier invoices, approves a variance and a payment, and prepares
  // one; never records a payment as paid. From 2.9.0 the seed lets the Manager approve supplier invoices
  // and credit notes too (the owner's decision in F10g).
  'mdm.supplier.read',
  'pur.supplier_invoice.read',
  'pur.supplier_invoice.approve',
  'pur.supplier_invoice.variance_approve',
  'pur.supplier_payment.read',
  'pur.supplier_payment.create',
  'pur.supplier_payment.approve',
  ...WHOLESALE_PERMISSIONS,
  ...MANAGER_TILL_PERMISSIONS,
];

/** The Accountant: the four the contract's `listRoles` example gives the role. It must use TOTP. */
const ACCOUNTANT_PERMISSIONS = [
  'iam.session.read',
  'iam.session.revoke',
  'fin.journal.create',
  'fin.period.lock',
  'pur.supplier_payment.create',
  'aud.audit.read',
  // 1.39.0 and 1.40.0: the Accountant reads billing documents, raises debit notes and opens the archive.
  // The owner (2026-11-16): the Accountant raises credit notes too, and never approves them.
  'bil.document.read',
  'bil.debit_note.create',
  'bil.credit_note.create',
  'doc.document.read',
  // 2.4.0: the Accountant raises and reads a claim with a supplier, as the seed gives it.
  'pur.supplier_invoice.read',
  'pur.supplier_invoice.create',
  // F10g, as seeded: the Accountant matches and approves invoices and records payments as paid, and
  // approves no payment.
  'pur.supplier_invoice.match',
  'pur.supplier_invoice.approve',
  'pur.supplier_payment.read',
  'pur.supplier_payment.pay',
  'mdm.supplier.read',
  'iam.approval.read',
  // F10i, the owner (2026-11-18): the Accountant may put a wholesale account on hold, and never releases
  // one or changes a credit limit (A-F10-10, CR-048).
  'whl.account.read',
  'whl.account.hold',
  'whl.ageing.read',
  'mdm.customer.read',
];

/**
 * F11, orders and delivery (B11 seeds none of it yet; CR-056 asks): the Storekeeper picks and reads the
 * order it picks; the Manager and the Owner also take the customer's answer, dispatch, and plan and start
 * the runs; the Driver reads and works their own run, uploads the proof's photograph and reads the
 * failure reasons. A-F11-01.
 */
const PICK_PERMISSIONS = ['ord.fulfilment.read', 'ord.fulfilment.pick', 'ord.order.read'];
const DISPATCH_PERMISSIONS = [
  'ord.fulfilment.read',
  'ord.fulfilment.pick',
  'ord.fulfilment.dispatch',
  'ord.order.update',
  'del.delivery.read',
  'del.delivery.assign',
  'del.route.read',
  'del.route.manage',
  // Seeded for the Manager already: the vans are vehicle locations.
  'mdm.location.read',
];
const DRIVER_PERMISSIONS = [
  // The seed's Driver.
  'iam.session.read',
  'iam.session.revoke',
  'mdm.product.read',
  // Not seeded for the Driver yet (CR-056).
  'del.delivery.read.assigned',
  'del.delivery.update.assigned',
  'del.proof.create',
  'platform.file.upload',
  'mdm.reason_code.read',
];

/** Keyed by lower-case email. Permission codes are the contract's `x-permission` values. */
export const FAKE_USERS: Record<string, FakeUser> = {
  'ama.mensah@hakoremfarms.com': {
    id: '019a7a86-1c4e-7b9a-9e2f-5d3c8a1b7e04',
    displayName: 'Ama Mensah',
    password: 'Mango-Season-2026!',
    totp: true,
    mustChangePassword: false,
    roleCode: 'OWNER',
    roleName: 'Owner',
    permissions: [
      ...OWNER_PERMISSIONS,
      ...OWNER_CATALOGUE_PERMISSIONS,
      ...STOCK_PERMISSIONS,
      'inv.stock_take.post',
      ...OWNER_F5B_PERMISSIONS,
      ...OWNER_F5C_PERMISSIONS,
      ...OWNER_F6_PERMISSIONS,
      ...OWNER_F6B_PERMISSIONS,
      ...OWNER_F8_PERMISSIONS,
      ...OWNER_EGG_PERMISSIONS,
      ...OWNER_PAYABLE_PERMISSIONS,
      ...WHOLESALE_PERMISSIONS,
      ...MANAGER_TILL_PERMISSIONS,
      ...DISPATCH_PERMISSIONS,
    ],
    moreBranches: SELLING_POINTS,
  },
  'kwabena.owusu@hakoremfarms.com': {
    id: '019a7a86-4f35-7afd-b035-b8ab03a83188',
    displayName: 'Kwabena Owusu',
    password: 'Mango-Season-2026!',
    totp: true,
    mustChangePassword: false,
    roleCode: 'MANAGER',
    roleName: 'Manager',
    permissions: [...MANAGER_PERMISSIONS, ...DISPATCH_PERMISSIONS],
  },
  'adwoa.darko@hakoremfarms.com': {
    id: '019a7a86-ac02-78a8-ade0-935170bb0c2f',
    displayName: 'Adwoa Darko',
    password: 'Mango-Season-2026!',
    totp: false,
    mustChangePassword: false,
    roleCode: 'CASHIER',
    roleName: 'Cashier',
    permissions: CASHIER_PERMISSIONS,
  },
  'yaw.boateng@hakoremfarms.com': {
    id: '019a7a86-5b10-7c21-8d44-0b2f0e5c7a11',
    displayName: 'Yaw Boateng',
    password: 'Mango-Season-2026!',
    totp: false,
    mustChangePassword: false,
    roleCode: 'STOREKEEPER',
    roleName: 'Storekeeper',
    permissions: [...STOCK_PERMISSIONS, ...PICK_PERMISSIONS],
  },
  // F11: the driver the contract's delivery examples name, so a run's `driver` is the signed-in driver.
  'kwesi.appiah@hakoremfarms.com': {
    id: '019a7a87-46ad-7a19-bf51-aa66d1302344',
    displayName: 'Kwesi Appiah',
    password: 'Mango-Season-2026!',
    totp: false,
    mustChangePassword: false,
    roleCode: 'DRIVER',
    roleName: 'Driver',
    permissions: DRIVER_PERMISSIONS,
  },
  'kofi.adjei@hakoremfarms.com': {
    id: '019a7a86-7e21-7c3d-9a5b-1f4e6d8c2a35',
    displayName: 'Kofi Adjei',
    password: 'Mango-Season-2026!',
    totp: false,
    mustChangePassword: false,
    roleCode: 'FARM_HAND',
    roleName: 'Farm hand',
    permissions: FARM_HAND_PERMISSIONS,
  },
  'akua.sarpong@hakoremfarms.com': {
    id: '019a7a86-b3c8-7f14-8e62-2d9a5c1f0e47',
    displayName: 'Akua Sarpong',
    password: 'Mango-Season-2026!',
    totp: false,
    mustEnrolTotp: true,
    mustChangePassword: false,
    roleCode: 'ACCOUNTANT',
    roleName: 'Accountant',
    permissions: ACCOUNTANT_PERMISSIONS,
  },
  // F10i: the salesperson the contract's quote examples name.
  'kojo.antwi@hakoremfarms.com': {
    id: '019a7a86-e9e0-7c6e-81a7-cfc0641d489e',
    displayName: 'Kojo Antwi',
    password: 'Mango-Season-2026!',
    totp: false,
    mustChangePassword: false,
    roleCode: 'SALES',
    roleName: 'Sales',
    permissions: SALES_PERMISSIONS,
  },
  // F10i: an Accountant who has set up TOTP, so a spec can act as one past sign-in.
  'esi.boateng@hakoremfarms.com': {
    id: '019a7a86-c4d9-7e25-9f73-3e0b6d2a1f58',
    displayName: 'Esi Boateng',
    password: 'Mango-Season-2026!',
    totp: true,
    mustChangePassword: false,
    roleCode: 'ACCOUNTANT',
    roleName: 'Accountant',
    permissions: ACCOUNTANT_PERMISSIONS,
  },
  'new.staff@hakoremfarms.com': {
    id: '019a7a86-9d07-7e52-a1c3-6a4f1d0c2b90',
    displayName: 'Efua Asante',
    password: 'Temp-8841-Farm',
    totp: false,
    mustChangePassword: true,
    roleCode: 'CASHIER',
    roleName: 'Cashier',
    permissions: CASHIER_PERMISSIONS,
  },
};

interface Cookie {
  value: string;
  expires: number;
}
/** One browser's cookies for the API. The caller owns it: one per browser context, kept across reloads. */
export interface CookieJar {
  at?: Cookie;
  rt?: Cookie;
}

export interface FakeRequest {
  method: string;
  /** The operation path, without the base URL, for example `/auth/staff/login`. */
  path: string;
  /** Request headers; looked up without regard to case. */
  headers: Record<string, string>;
  /** The parsed JSON body, or undefined. */
  body: unknown;
}

export interface FakeResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

interface ServerSession {
  email: string;
  access: string;
  refresh: string;
  rotated: string[];
  csrf: string;
  revoked: boolean;
  refreshExpires: number;
  accessExpires: number;
  /** When the session last stepped up, by the fake's clock, or null. */
  steppedUpAt: number | null;
}
interface Challenge {
  email: string;
  kind: 'totp' | 'password' | 'enrol';
  expires: number;
  attempts: number;
  /** For an enrolment: startTotpEnrolment has shown the secret, so a code can confirm it. */
  started?: boolean;
}

/** The eleven operations this fake answers, by method and path. Everything else is not its business. */
export const FAKE_AUTH_ROUTES = {
  'POST /auth/staff/login': 'loginStaff',
  'POST /auth/totp/verify': 'verifyTotp',
  'GET /auth/session': 'getCurrentSession',
  'POST /auth/refresh': 'refreshSession',
  'POST /auth/logout': 'logout',
  'POST /auth/password/change': 'changePassword',
  'POST /auth/password/reset-request': 'requestPasswordReset',
  'POST /auth/password/reset': 'resetPassword',
  'POST /auth/step-up': 'stepUp',
  'POST /auth/totp/enrol': 'startTotpEnrolment',
  'POST /auth/totp/confirm': 'confirmTotpEnrolment',
} as const;

/** What the fake's enrolment shows: the contract's example secret, and a small stand-in QR image. */
export const FAKE_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
const FAKE_QR_DATA_URI =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0IDQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTAgMGgydjJIMHptMiAyaDJ2MkgyeiIvPjwvc3ZnPg==';
/** The contract's example recovery codes (confirmTotpEnrolment). */
export const FAKE_RECOVERY_CODES = [
  '7KQ2-M9XD',
  'P4TR-2W8N',
  'H6CJ-QF3L',
  'Z8VB-1KMS',
  'R3YN-T7EP',
  'D5LG-9HWA',
  'N2FU-X4QC',
  'B9SE-6JRK',
];

/** Whole seconds, rounded up, with integer arithmetic only (money.test.ts forbids Math rounding in sources). */
function secondsUntil(ms: number): number {
  const remainder = ms % MS_PER_SECOND;
  return (ms - remainder) / MS_PER_SECOND + (remainder > 0 ? 1 : 0);
}

function uuid(): string {
  return crypto.randomUUID();
}

function error(
  status: number,
  code: string,
  message: string,
  extra: { details?: unknown[]; retryAfter?: number } = {},
): FakeResponse {
  return {
    status,
    body: { error: { code, message, correlationId: uuid(), details: extra.details ?? [] } },
    headers: {
      'Content-Type': 'application/json',
      ...(extra.retryAfter === undefined ? {} : { 'Retry-After': String(extra.retryAfter) }),
    },
  };
}
const ok = (body: unknown): FakeResponse => ({
  status: 200,
  body,
  headers: { 'Content-Type': 'application/json' },
});
const NO_CONTENT: FakeResponse = { status: 204 };
const UNAUTHENTICATED = () => error(401, 'UNAUTHENTICATED', 'Please log in again.');
const CSRF_INVALID = () => error(403, 'CSRF_TOKEN_INVALID', 'The request could not be verified.');
const INVALID_CREDENTIALS = () =>
  error(401, 'INVALID_CREDENTIALS', 'The email, phone number or password is not right.');
const CHALLENGE_EXPIRED = () =>
  error(401, 'CHALLENGE_EXPIRED', 'That sign-in took too long. Start again.');
const TOO_SHORT = () =>
  error(400, 'VALIDATION_FAILED', 'Some fields are not valid.', {
    details: [
      {
        field: '/newPassword',
        code: 'MIN_LENGTH',
        message: 'The password needs at least 12 characters.',
      },
    ],
  });

function header(request: FakeRequest, name: string): string | undefined {
  const wanted = name.toLowerCase();
  return Object.entries(request.headers).find(([key]) => key.toLowerCase() === wanted)?.[1];
}

export interface FakeAuthServer {
  /** Answers one of the nine auth operations, or returns null for any other request. */
  handle(request: FakeRequest, jar: CookieJar): FakeResponse | null;
  /** The signed-in user behind the jar's access cookie, or null (no cookie, expired, or revoked). */
  sessionFor(jar: CookieJar): { email: string; permissions: readonly string[] } | null;
  /** A manager revokes every session (the next refresh answers 401). */
  revokeAllSessions(): void;
  /**
   * The 403 `STEP_UP_REQUIRED` answer for an operation the contract marks "Requires step-up", when the
   * session behind the jar has not stepped up in the last five minutes; otherwise null.
   */
  stepUpRefusal(jar: CookieJar, operationId: string): FakeResponse | null;
  /** The fake's clock. `set` and `advance` keep it beside Playwright's or Vitest's. */
  clock: { now(): number; set(ms: number): void; advance(ms: number): void };
}

export function createFakeAuthServer(): FakeAuthServer {
  let offset = 0;
  const now = () => Date.now() + offset;
  const sessions: Record<string, ServerSession> = {};
  const challenges = new Map<string, Challenge>();
  const failures = new Map<string, { count: number; until: number }>();
  const passwords: Record<string, string> = {};
  /** The password-change challenge a loginStaff answered with, per CR-004 and A-F1-04. */
  let pendingPasswordChange: string | null = null;
  /** Users who confirmed an enrolment with this fake: they are asked for a code from then on. */
  const enrolled = new Set<string>();
  const usesTotp = (email: string) => FAKE_USERS[email]?.totp === true || enrolled.has(email);

  const passwordOf = (email: string): string | undefined =>
    passwords[email] ?? FAKE_USERS[email]?.password;

  /** Drops expired cookies, as a browser would. */
  function tidy(jar: CookieJar): CookieJar {
    if (jar.at && jar.at.expires <= now()) delete jar.at;
    if (jar.rt && jar.rt.expires <= now()) delete jar.rt;
    return jar;
  }

  function sessionInfo(sessionId: string, session: ServerSession): SessionInfo {
    const user = FAKE_USERS[session.email] as FakeUser;
    return {
      sessionId,
      realm: 'STAFF',
      principal: { id: user.id, displayName: user.displayName },
      csrfToken: session.csrf,
      accessExpiresAt: new Date(session.accessExpires).toISOString(),
      refreshExpiresAt: new Date(session.refreshExpires).toISOString(),
      steppedUpAt:
        session.steppedUpAt === null ? null : new Date(session.steppedUpAt).toISOString(),
      mustChangePassword: false,
      totpEnrolled: user.totp,
      grants: [BRANCH, ...(user.moreBranches ?? [])].map((branch) => ({
        roleCode: user.roleCode,
        roleName: user.roleName,
        ...branch,
      })),
      permissions: [...user.permissions],
    };
  }

  /** Sets both cookies and returns the SessionInfo body, as every session-issuing response does. */
  function issue(jar: CookieJar, sessionId: string, session: ServerSession): SessionInfo {
    session.accessExpires = now() + ACCESS_TTL_MS;
    jar.at = { value: session.access, expires: session.accessExpires };
    jar.rt = { value: session.refresh, expires: session.refreshExpires };
    return sessionInfo(sessionId, session);
  }

  function startSession(jar: CookieJar, email: string): SessionInfo {
    const sessionId = uuid();
    const session: ServerSession = {
      email,
      access: `at.${uuid()}`,
      refresh: `rt.${uuid()}`,
      rotated: [],
      csrf: uuid().replaceAll('-', ''),
      revoked: false,
      refreshExpires: now() + REFRESH_TTL_MS,
      accessExpires: 0,
      steppedUpAt: null,
    };
    sessions[sessionId] = session;
    return issue(jar, sessionId, session);
  }

  /** The session the access cookie belongs to, if it is live. */
  function authenticate(jar: CookieJar): [string, ServerSession] | null {
    const at = tidy(jar).at;
    if (!at) return null;
    const entry = Object.entries(sessions).find(([, s]) => s.access === at.value);
    if (!entry || entry[1].revoked) return null;
    return entry;
  }

  function loginStaff(body: { identifier: string; password: string }, jar: CookieJar) {
    const email = body.identifier.trim().toLowerCase();
    const failure = failures.get(email) ?? { count: 0, until: 0 };
    if (failure.until > now()) {
      return error(429, 'RATE_LIMITED', 'Too many attempts. Try again shortly.', {
        retryAfter: secondsUntil(failure.until - now()),
      });
    }
    const user = FAKE_USERS[email];
    if (!user || passwordOf(email) !== body.password) {
      failure.count += 1;
      if (failure.count >= MAX_FAILURES) {
        failure.until = now() + LOCKOUT_MS;
        failure.count = 0;
      }
      failures.set(email, failure);
      return INVALID_CREDENTIALS();
    }
    failures.delete(email);
    if (user.mustChangePassword && passwords[email] === undefined) {
      const token = `hk1.ch.${uuid()}`;
      challenges.set(token, {
        email,
        kind: 'password',
        expires: now() + CHALLENGE_TTL_MS,
        attempts: 0,
      });
      pendingPasswordChange = token;
      return ok({ status: 'PASSWORD_CHANGE_REQUIRED', challengeToken: token, session: null });
    }
    if (user.mustEnrolTotp && !enrolled.has(email)) {
      const token = `hk1.ch.${uuid()}`;
      challenges.set(token, {
        email,
        kind: 'enrol',
        expires: now() + CHALLENGE_TTL_MS,
        attempts: 0,
      });
      return ok({ status: 'TOTP_ENROLMENT_REQUIRED', challengeToken: token, session: null });
    }
    if (usesTotp(email)) {
      const token = `hk1.ch.${uuid()}`;
      challenges.set(token, {
        email,
        kind: 'totp',
        expires: now() + CHALLENGE_TTL_MS,
        attempts: 0,
      });
      return ok({ status: 'TOTP_REQUIRED', challengeToken: token, session: null });
    }
    return ok({ status: 'AUTHENTICATED', challengeToken: null, session: startSession(jar, email) });
  }

  function verifyTotp(body: { challengeToken: string; code: string }, jar: CookieJar) {
    const challenge = challenges.get(body.challengeToken);
    if (!challenge || challenge.kind !== 'totp' || challenge.expires <= now()) {
      return CHALLENGE_EXPIRED();
    }
    if (body.code.trim() !== FAKE_TOTP_CODE) {
      challenge.attempts += 1;
      if (challenge.attempts >= MAX_TOTP_ATTEMPTS) challenges.delete(body.challengeToken);
      return error(401, 'TOTP_INVALID', 'The code is wrong or already used.');
    }
    challenges.delete(body.challengeToken);
    return ok({
      status: 'AUTHENTICATED',
      challengeToken: null,
      session: startSession(jar, challenge.email),
    });
  }

  /** During sign-in only (no cookie, the challenge in the body), as the contract describes the first login. */
  function startTotpEnrolment(body: { challengeToken?: string }) {
    const challenge = body.challengeToken ? challenges.get(body.challengeToken) : undefined;
    if (!challenge || challenge.kind !== 'enrol' || challenge.expires <= now()) {
      return CHALLENGE_EXPIRED();
    }
    challenge.started = true;
    const name = challenge.email.split('@')[0] ?? challenge.email;
    return ok({
      otpauthUri: `otpauth://totp/HaKorem%20Farms:${name}?secret=${FAKE_TOTP_SECRET}&issuer=HaKorem%20Farms`,
      secretBase32: FAKE_TOTP_SECRET,
      qrCodeDataUri: FAKE_QR_DATA_URI,
    });
  }

  /** Confirms with a first code and, during sign-in, completes it: the session cookies are set here. */
  function confirmTotpEnrolment(body: { challengeToken?: string; code?: string }, jar: CookieJar) {
    const token = body.challengeToken ?? '';
    const challenge = challenges.get(token);
    if (!challenge || challenge.kind !== 'enrol' || challenge.expires <= now()) {
      return CHALLENGE_EXPIRED();
    }
    if (!challenge.started) {
      return error(422, 'TOTP_ENROLMENT_REQUIRED', 'Start setting up two-step sign-in first.');
    }
    if ((body.code ?? '').trim() !== FAKE_TOTP_CODE) {
      challenge.attempts += 1;
      if (challenge.attempts >= MAX_TOTP_ATTEMPTS) challenges.delete(token);
      return error(401, 'TOTP_INVALID', 'The code is wrong or already used.');
    }
    challenges.delete(token);
    enrolled.add(challenge.email);
    startSession(jar, challenge.email);
    return ok({ recoveryCodes: [...FAKE_RECOVERY_CODES] });
  }

  function refreshSession(jar: CookieJar) {
    const rt = tidy(jar).rt;
    if (!rt) return UNAUTHENTICATED();
    const entry = Object.entries(sessions).find(
      ([, s]) => s.refresh === rt.value || s.rotated.includes(rt.value),
    );
    if (!entry) return UNAUTHENTICATED();
    const [sessionId, session] = entry;
    if (session.revoked || session.refreshExpires <= now()) return UNAUTHENTICATED();
    if (session.rotated.includes(rt.value)) {
      // A refresh token that was already used: the whole session is revoked (contract, refreshSession).
      session.revoked = true;
      return UNAUTHENTICATED();
    }
    session.rotated.push(session.refresh);
    session.refresh = `rt.${uuid()}`;
    session.access = `at.${uuid()}`;
    session.csrf = uuid().replaceAll('-', '');
    return ok(issue(jar, sessionId, session));
  }

  function changePassword(
    request: FakeRequest,
    body: { currentPassword: string; newPassword: string },
    jar: CookieJar,
  ) {
    let email: string;
    if (tidy(jar).at) {
      const entry = authenticate(jar);
      if (!entry) return UNAUTHENTICATED();
      if (header(request, 'X-CSRF-Token') !== entry[1].csrf) return CSRF_INVALID();
      email = entry[1].email;
    } else {
      // CR-004: the contract does not say how the first-login change authenticates. The fake accepts the
      // challenge its own loginStaff answered with (A-F1-04).
      const challenge = pendingPasswordChange ? challenges.get(pendingPasswordChange) : undefined;
      if (!challenge || challenge.expires <= now()) return CHALLENGE_EXPIRED();
      email = challenge.email;
    }
    if (passwordOf(email) !== body.currentPassword) return INVALID_CREDENTIALS();
    if (body.newPassword.length < MIN_PASSWORD_LENGTH) return TOO_SHORT();
    if (/^(password|123456789012|qwertyuiop12)/i.test(body.newPassword)) {
      return error(
        422,
        'PASSWORD_BREACHED',
        'That password appears in a list of breached passwords.',
      );
    }
    passwords[email] = body.newPassword;
    if (pendingPasswordChange) challenges.delete(pendingPasswordChange);
    pendingPasswordChange = null;
    return NO_CONTENT;
  }

  return {
    handle(request, jar) {
      const route = `${request.method.toUpperCase()} ${request.path}`;
      const operation = FAKE_AUTH_ROUTES[route as keyof typeof FAKE_AUTH_ROUTES];
      if (operation === undefined) return null;
      const body = (request.body ?? {}) as Record<string, string>;
      switch (operation) {
        case 'loginStaff':
          return loginStaff(body as { identifier: string; password: string }, jar);
        case 'verifyTotp':
          return verifyTotp(body as { challengeToken: string; code: string }, jar);
        case 'getCurrentSession': {
          const entry = authenticate(jar);
          return entry ? ok(sessionInfo(entry[0], entry[1])) : UNAUTHENTICATED();
        }
        case 'refreshSession':
          return refreshSession(jar);
        case 'logout': {
          const entry = authenticate(jar);
          if (!entry) return UNAUTHENTICATED();
          if (header(request, 'X-CSRF-Token') !== entry[1].csrf) return CSRF_INVALID();
          entry[1].revoked = true;
          delete jar.at;
          delete jar.rt;
          return NO_CONTENT;
        }
        case 'changePassword':
          return changePassword(
            request,
            body as { currentPassword: string; newPassword: string },
            jar,
          );
        case 'requestPasswordReset':
          // Always the same answer, whether or not the account exists (contract, requestPasswordReset).
          return { status: 202 };
        case 'resetPassword':
          if ((body.newPassword ?? '').length < MIN_PASSWORD_LENGTH) return TOO_SHORT();
          // The contract names no code for an invalid reset code (CR-004); this one is the fake's own.
          if ((body.token ?? '').trim() !== FAKE_RESET_CODE) {
            return error(422, 'RESET_CODE_INVALID', 'That reset code is not valid or has expired.');
          }
          return NO_CONTENT;
        case 'startTotpEnrolment':
          return startTotpEnrolment(body);
        case 'confirmTotpEnrolment':
          return confirmTotpEnrolment(body, jar);
        case 'stepUp': {
          const entry = authenticate(jar);
          if (!entry) return UNAUTHENTICATED();
          if (header(request, 'X-CSRF-Token') !== entry[1].csrf) return CSRF_INVALID();
          if (!usesTotp(entry[1].email)) {
            return error(403, 'TOTP_ENROLMENT_REQUIRED', 'Set up two-step sign-in first.');
          }
          if ((body.code ?? '').trim() !== FAKE_TOTP_CODE) {
            return error(401, 'TOTP_INVALID', 'The code is wrong or already used.');
          }
          entry[1].steppedUpAt = now();
          return ok(sessionInfo(entry[0], entry[1]));
        }
      }
    },
    stepUpRefusal(jar, operationId) {
      if (!STEP_UP_OPERATIONS.has(operationId)) return null;
      const entry = authenticate(jar);
      if (!entry) return null;
      const at = entry[1].steppedUpAt;
      if (at !== null && now() - at < STEP_UP_TTL_MS) return null;
      return error(
        403,
        'STEP_UP_REQUIRED',
        'Enter a code from your authenticator app to confirm this change.',
      );
    },
    sessionFor(jar) {
      const entry = authenticate(jar);
      if (!entry) return null;
      const user = FAKE_USERS[entry[1].email] as FakeUser;
      return { email: entry[1].email, permissions: user.permissions };
    },
    revokeAllSessions() {
      for (const session of Object.values(sessions)) session.revoked = true;
    },
    clock: {
      now,
      set: (ms) => {
        offset = ms - Date.now();
      },
      advance: (ms) => {
        offset += ms;
      },
    },
  };
}
