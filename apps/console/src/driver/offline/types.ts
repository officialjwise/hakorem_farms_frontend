/**
 * What the driver's phone keeps (ADR 0055): the run as last read, each stop's delivery, the reasons and unit
 * names the screens need without signal, the cash the server says the driver carries, and the queue of what
 * the driver recorded. Every queued record carries the client id the contract asks for (UUIDv7), made once
 * when the driver confirmed it and never again, so a resend is the same record and the server applies it
 * once.
 */
import type { components } from '@hakorem/api-client';

type S = components['schemas'];

export type Route = S['Route'];
export type Delivery = S['Delivery'];
export type CashSummary = S['DriverCashSummary'];
export type ProofOfDeliveryCreate = S['ProofOfDeliveryCreate'];
export type DeliveryFailure = S['DeliveryFailure'];
export type OnTheWay = S['OnTheWay'];

/** A `DELIVERY_FAILURE` reason, as the failure form offers it. */
export interface FailureReason {
  code: string;
  description: string;
  requiresNote: boolean;
}

/** A unit's words, for "4 crates" and "1 egg" with no signal. */
export interface UnitName {
  code: string;
  singularName: string;
  pluralName: string;
  displayDecimals: number;
}

/** What the server last said, and when it was read. */
export interface DriverRecords {
  route: Route | null;
  /** Each stop's full delivery (address, phone, contents, cash due), by delivery id. */
  deliveries: Record<string, Delivery>;
  cash: CashSummary | null;
  reasons: FailureReason[];
  units: UnitName[];
  /** When the run was last read from the server, or null if never. */
  readAt: string | null;
  /** The date the run is for (the server's `routeDate`), so tomorrow's run does not show today's stops. */
  runDate: string | null;
}

export const EMPTY_RECORDS: DriverRecords = {
  route: null,
  deliveries: {},
  cash: null,
  reasons: [],
  units: [],
  readAt: null,
  runDate: null,
};

/**
 * Where a record is. It moves only on an answer from the server: `QUEUED` until sent, `SENDING` during a
 * pass (back to `QUEUED` after a crash), then `APPLIED` (the server took it, or already had it) or
 * `REJECTED` (the server refused it, in its words, for a person to see). A rejected record is never deleted.
 */
export type LocalStatus = 'QUEUED' | 'SENDING' | 'APPLIED' | 'REJECTED';

export interface EntryFailure {
  code: string;
  message: string;
  correlationId: string;
}

interface EntryBase {
  /** The client id: the record's own id, and the idempotency key it is sent with. */
  id: string;
  deliveryId: string;
  createdLocalAt: string;
  localStatus: LocalStatus;
  attempts: number;
  lastAttemptAt: string | null;
  confirmedAt: string | null;
  /**
   * The server's outcome: `APPLIED` or `APPLIED_WITH_EXCEPTION`, the first answer's for a resend it had
   * already (`firstOutcome`, 2.35.0); `DUPLICATE` only where the server named no first answer.
   */
  serverOutcome: string | null;
  /** The server's words with the outcome: why it was rejected, or the exception it raised. */
  serverReason: string | null;
  failure: EntryFailure | null;
}

export interface OnTheWayEntry extends EntryBase {
  kind: 'ON_THE_WAY';
  payload: OnTheWay;
}

export interface ProofEntry extends EntryBase {
  kind: 'PROOF';
  /** Sent with `photoFileId` once the photograph is uploaded. */
  payload: ProofOfDeliveryCreate;
  /** The photograph kept on the phone until it is uploaded (`photos` store), or null. */
  photoLocalId: string | null;
}

export interface FailureEntry extends EntryBase {
  kind: 'FAILURE';
  payload: DeliveryFailure;
}

export type DriverEntry = OnTheWayEntry | ProofEntry | FailureEntry;

/** A photograph taken for a proof, kept until the server has it. */
export interface StoredPhoto {
  /** The client's id for it, also the idempotency key of its upload. */
  id: string;
  blob: Blob;
  /** The server's file id once uploaded. */
  fileId: string | null;
}

export interface DriverSnapshot {
  records: DriverRecords;
  entries: DriverEntry[];
  /** Photographs waiting, by id (no blobs: those are read when sent or shown). */
  photoIds: string[];
}

export const PENDING: readonly LocalStatus[] = ['QUEUED', 'SENDING'];
