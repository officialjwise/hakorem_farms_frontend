/**
 * What the till keeps on the device (OFFLINE_SYNC.md section 3): the device, the offline pack, the open
 * shift, the queue (section 6) with each sale's provisional receipt, held sales, and the sync log. Every
 * API shape here is the contract's; the rest is the till's own bookkeeping.
 */
import type { components } from '@hakorem/api-client';
import type {
  PinApproval,
  PinAttempts,
  PinVerifier,
  TillPinEvent,
  TillPinPolicy,
  TillSignOut,
} from '../pin/pin';
import type { CartLine } from './cart';

type Schemas = components['schemas'];
export type OfflinePack = Schemas['OfflinePack'];
export type OfflineSale = Schemas['OfflineSale'];
export type CashMovementCreate = Schemas['CashMovementCreate'];
export type CashMovement = Schemas['CashMovement'];
export type ShiftOpen = Schemas['ShiftOpen'];
export type Shift = Schemas['Shift'];
export type SyncResultItem = Schemas['SyncResultItem'];
export type CashMovementSyncItem = Schemas['CashMovementSyncItem'];

/** This browser as an enrolled till (`enrolDevice`). The credential is never shown or logged (ADR 0044). */
export interface DeviceRecord {
  deviceId: string;
  deviceLabel: string;
  registerId: string;
  registerCode: string;
  registerName: string;
  branchId: string;
  credential: string;
  enrolledAt: string;
}

/** The shift open on this till. One device runs one shift (OFFLINE_SYNC 4.2). */
export interface ShiftRecord {
  id: string;
  registerId: string;
  cashierId: string;
  cashierName: string;
  openingFloatPesewas: number;
  openedAt: string;
  /** The server's, once the shift has reached it; until then the provisional one below. */
  shiftSeq: number | null;
  shiftNo: string | null;
  /** The sequence the provisional references use: the server's when known, else the next after the last. */
  referenceSeq: number;
  /** The last device counter issued. Never reused, never decremented. */
  lastCounter: number;
  /** The discounts given on this shift so far, against the per-shift limit. */
  discountGivenPesewas: number;
  /** The server has the shift (its open was applied). */
  confirmed: boolean;
}

/** OFFLINE_SYNC 6.1. */
export type LocalStatus =
  | 'QUEUED'
  | 'SENDING'
  | 'APPLIED'
  | 'APPLIED_WITH_EXCEPTION'
  | 'DUPLICATE'
  | 'REJECTED_INTEGRITY'
  | 'FAILED_PERMANENT';

/** The refusal that made a record FAILED_PERMANENT, in the console's words, with its reference. */
export interface EntryFailure {
  code: string;
  message: string;
  correlationId: string;
}

interface EntryBase {
  id: string;
  shiftId: string;
  localStatus: LocalStatus;
  attempts: number;
  createdLocalAt: string;
  lastAttemptAt: string | null;
  /** When the server confirmed it: the 24-hour removal timer starts here. */
  confirmedAt: string | null;
  failure: EntryFailure | null;
}

/** What the customer's provisional receipt says, kept with the sale for a reprint (the `receipts` store). */
export interface ReceiptContent {
  saleId: string;
  provisionalRef: string;
  occurredAt: string;
  registerCode: string;
  registerName: string;
  cashierName: string;
  lines: {
    name: string;
    quantity: string;
    saleUom: string;
    weightKg: string | null;
    stockUnitIdentifier: string | null;
    unitPricePesewas: number;
    amountPesewas: number;
  }[];
  totalPesewas: number;
  tenders: {
    name: string;
    amountPesewas: number;
    tenderedPesewas: number | null;
    /** Mobile money taken offline on a supervisor's PIN (OFFLINE_SYNC 5.3): not yet verified. */
    unverified?: boolean;
    /** The reference the customer showed for it, if any. */
    reference?: string | null;
  }[];
  changePesewas: number;
  customerPhone: string | null;
}

/**
 * A PIN that approved something on this till (CR-032): who, and which of their PIN versions it was checked
 * against. The payload carries both since 2.17.0 (`approvedById` and `approvedByPinVersion`, `witnessId`
 * and `witnessPinVersion`); this copy is the queue screen's, with the name and the time.
 */
export interface PinApprovalRecord {
  approval: PinApproval;
  principalId: string;
  displayName: string;
  verifierVersion: number;
  at: string;
}

export interface SaleEntry extends EntryBase {
  kind: 'SALE';
  payload: OfflineSale;
  receipt: ReceiptContent;
  /** The till's own total, to compare with the server's once it has the sale. */
  localTotalPesewas: number;
  serverResult: SyncResultItem | null;
  /** The server's total for the order, read back after sync. Null until read. */
  serverTotalPesewas: number | null;
  /** The PINs that approved part of this sale (an unverified mobile money tender). */
  approvals?: PinApprovalRecord[];
}

export interface CashMovementEntry extends EntryBase {
  kind: 'CASH_MOVEMENT';
  payload: CashMovementCreate;
  /** `recordCashMovement`'s answer when sent alone (2.5.0), or the offline batch's item for it. */
  serverResult: CashMovement | CashMovementSyncItem | null;
  /** The witness's PIN, for a cash drop. */
  approvals?: PinApprovalRecord[];
}

export interface ShiftOpenEntry extends EntryBase {
  kind: 'SHIFT_OPEN';
  payload: ShiftOpen;
  serverResult: Shift | null;
}

export type QueueEntry = SaleEntry | CashMovementEntry | ShiftOpenEntry;

/** A sale put aside on this till (OFFLINE_SYNC section 2: offline, a held sale lives on the device only). */
export interface HeldLocal {
  id: string;
  label: string | null;
  lines: CartLine[];
  heldAt: string;
}

export interface SyncLogEntry {
  at: string;
  batchSize: number;
  /** The HTTP status, or 0 when nothing answered. */
  status: number;
  outcomes: Record<string, number>;
}

export interface TillMeta {
  /** Device counters the server says are missing from the shift (`counterGaps`). */
  counterGaps: number[];
  /** The last time a request reached the server: offline sales stop `maxOfflineHours` after it. */
  lastReachedServerAt: string | null;
  packFetchedAt: string | null;
  /** The last shift's sequence on this register, for the next shift's provisional references. */
  lastShiftSeq: number | null;
  /**
   * Wrong PINs and lockouts on this till, by person (CR-032). Kept through sign-out and shift close: a
   * lockout ends only when its owner sets a new PIN (2.17.0, `NEW_PIN_SET`).
   */
  pinAttempts: Record<string, PinAttempts>;
  /** Every PIN try the server has not been told of yet, oldest first (`reportTillPinEvents`). Kept likewise. */
  pinEvents: TillPinEvent[];
  /** Locked cashiers signed out by a supervisor's PIN, not yet told to the server. Kept likewise. */
  pinSignOuts: TillSignOut[];
  /** The till is locked until its cashier's PIN opens it. Kept, so a reload stays locked. */
  locked: boolean;
}

export interface TillSnapshot {
  device: DeviceRecord | null;
  pack: OfflinePack | null;
  shift: ShiftRecord | null;
  meta: TillMeta;
  /** The PIN verifiers the server issued for this till (`local_auth`, CR-032). Null where there are none. */
  localAuth: LocalAuth | null;
  /** In the order they were made. */
  entries: QueueEntry[];
  held: HeldLocal[];
  syncLog: SyncLogEntry[];
}

export const EMPTY_META: TillMeta = {
  counterGaps: [],
  lastReachedServerAt: null,
  packFetchedAt: null,
  lastShiftSeq: null,
  pinAttempts: {},
  pinEvents: [],
  pinSignOuts: [],
  locked: false,
};

/** Someone whose verifier the server sent below the owner's floor: named, never stored or checked. */
export interface RefusedVerifier {
  principalId: string;
  displayName: string;
}

/**
 * What the till keeps of `listTillPinVerifiers`: only verifiers at or above the floor (and locked ones, which
 * carry no material), the policy with at most five tries, and who was refused (owner, 2026-11-17).
 */
export interface LocalAuth {
  registerId: string;
  asOf: string;
  policy: TillPinPolicy;
  verifiers: PinVerifier[];
  refused: RefusedVerifier[];
}

/** The statuses a record waits in. The rest are final, or need a person. */
export const PENDING_STATUSES: readonly LocalStatus[] = ['QUEUED', 'SENDING'];
export const CONFIRMED_STATUSES: readonly LocalStatus[] = [
  'APPLIED',
  'APPLIED_WITH_EXCEPTION',
  'DUPLICATE',
];
