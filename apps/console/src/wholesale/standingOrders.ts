import type { components } from '@hakorem/api-client';
import { newRecordId } from '../lib/clientId';
import type { ProductRef } from '../stock/LinesEditor';
import { toQuantity } from '../stock/units';

type S = components['schemas'];
export type StandingOrder = S['StandingOrder'];
export type Frequency = StandingOrder['frequency'];
export type StandingOrderStatus = StandingOrder['status'];
export type RunOutcome = S['StandingOrderRun']['outcome'];

/** Every frequency a standing order can have, in the order the form offers them. */
export const FREQUENCIES = [
  'WEEKLY',
  'FORTNIGHTLY',
  'MONTHLY',
  'EVERY_N_DAYS',
] as const satisfies readonly Frequency[];

/** Every state a standing order can be in. */
export const STANDING_ORDER_STATUSES = [
  'ACTIVE',
  'PAUSED',
  'ENDED',
  'CANCELLED',
] as const satisfies readonly StandingOrderStatus[];

/** Every outcome a run can have (`StandingOrderRun.outcome`). */
export const RUN_OUTCOMES = [
  'CREATED',
  'HELD_FOR_CREDIT',
  'SKIPPED_ON_HOLD',
  'SKIPPED_NO_PRICE',
  'MISSED',
  'FAILED',
] as const satisfies readonly RunOutcome[];

/** The named days, 1 (Monday) to 7 (Sunday), as `weekdays` carries them. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** `MONTHLY` runs on day 1 to 28; `EVERY_N_DAYS` every 1 to 365 days (2.18.0). */
export const DAY_OF_MONTH_MAX = 28;
export const INTERVAL_DAYS_MAX = 365;
/** `StandingOrderCreate.lines` holds at most 50. */
export const LINES_MAX = 50;

/** The words a schedule is said in, already translated. */
export interface ScheduleWords {
  /** "Monday" for 1, "Sunday" for 7. */
  weekday: (day: number) => string;
  /** The word before the last of a list: "and". */
  and: string;
  weekly: (days: string) => string;
  fortnightly: (days: string) => string;
  monthly: (day: number) => string;
  everyNDays: (count: number) => string;
  /** A schedule the record does not complete, for example a weekly order with no day. */
  unknown: (frequency: string) => string;
}

/** "Monday", "Monday and Friday", "Monday, Wednesday and Friday". */
export function listWords(items: readonly string[], and: string): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${and} ${items.at(-1) ?? ''}`;
}

/**
 * A standing order's schedule in words, from `frequency` and the fields it uses: `weekdays` for weekly and
 * fortnightly (Monday first, whatever order the record holds them in), `dayOfMonth` for monthly and
 * `intervalDays` for every N days. The deprecated `weekday` is never read.
 */
export function scheduleWords(
  order: Pick<StandingOrder, 'frequency' | 'weekdays' | 'dayOfMonth' | 'intervalDays'>,
  words: ScheduleWords,
): string {
  switch (order.frequency) {
    case 'WEEKLY':
    case 'FORTNIGHTLY': {
      const days = WEEKDAYS.filter((day) => order.weekdays.includes(day));
      if (days.length === 0) return words.unknown(order.frequency);
      const named = listWords(days.map(words.weekday), words.and);
      return order.frequency === 'WEEKLY' ? words.weekly(named) : words.fortnightly(named);
    }
    case 'MONTHLY':
      return order.dayOfMonth === null
        ? words.unknown(order.frequency)
        : words.monthly(order.dayOfMonth);
    case 'EVERY_N_DAYS':
      return order.intervalDays === null
        ? words.unknown(order.frequency)
        : words.everyNDays(order.intervalDays);
    default:
      return words.unknown(String(order.frequency));
  }
}

/** One line of a standing order being entered: a product, the unit it is counted in, and how many. */
export interface DraftStandingLine {
  key: string;
  product: ProductRef | null;
  /** Empty for the product's base unit. */
  uom: string;
  qty: string;
}

export function blankStandingLine(): DraftStandingLine {
  return { key: newRecordId(), product: null, uom: '', qty: '' };
}

/** A standing order's schedule, end and lines as typed. Frequency and start are kept for a change too. */
export interface StandingOrderDraft {
  frequency: Frequency | '';
  weekdays: number[];
  dayOfMonth: string;
  intervalDays: string;
  startsOn: string;
  endsOn: string;
  lines: DraftStandingLine[];
}

export function blankDraft(): StandingOrderDraft {
  return {
    frequency: '',
    weekdays: [],
    dayOfMonth: '',
    intervalDays: '',
    startsOn: '',
    endsOn: '',
    lines: [blankStandingLine()],
  };
}

/** The order as it stands, to change it: its lines become draft lines in their own unit. */
export function draftFromOrder(order: StandingOrder): StandingOrderDraft {
  return {
    frequency: order.frequency,
    weekdays: [...order.weekdays],
    dayOfMonth: order.dayOfMonth === null ? '' : String(order.dayOfMonth),
    intervalDays: order.intervalDays === null ? '' : String(order.intervalDays),
    startsOn: order.startsOn,
    endsOn: order.endsOn ?? '',
    lines: order.lines.map((line) => ({
      key: line.id,
      product: { ...line.product, baseUom: line.uom },
      uom: line.uom,
      qty: line.quantity,
    })),
  };
}

/** A whole number from `min` to `max`, as typed, or null. */
export function wholeNumber(typed: string, min: number, max: number): number | null {
  const text = typed.trim();
  if (!/^[1-9]\d{0,2}$/.test(text)) return null;
  const value = Number(text);
  return value >= min && value <= max ? value : null;
}

export type DraftProblem =
  | 'frequency'
  | 'weekdays'
  | 'dayOfMonth'
  | 'intervalDays'
  | 'startsOn'
  | 'endsOn'
  | 'lines'
  | 'tooManyLines';

export type LineProblem = 'product' | 'qty';

/** What is wrong with one line, in the order the person reads it; empty when it can be sent. */
export function standingLineProblems(line: DraftStandingLine): LineProblem[] {
  const problems: LineProblem[] = [];
  if (line.product === null) problems.push('product');
  const quantity = toQuantity(line.qty);
  if (quantity === null || quantity === '0.000') problems.push('qty');
  return problems;
}

/**
 * What stops the draft being sent, as the form checks it before the server does: the fields the frequency
 * needs, a start day, and at least one whole line. The server judges the rest (a day in the past, an end
 * before the start, a product it cannot stock) and its refusal stays on screen in its words.
 *
 * `removedEnd` is a change that empties an end date the order has: the contract takes a new end, never
 * none (`StandingOrderUpdate.endsOn` is a date, not nullable), so it is said rather than silently kept.
 */
export function draftProblems(
  draft: StandingOrderDraft,
  { removedEnd = false }: { removedEnd?: boolean } = {},
): DraftProblem[] {
  const problems: DraftProblem[] = [];
  if (draft.frequency === '') problems.push('frequency');
  if (
    (draft.frequency === 'WEEKLY' || draft.frequency === 'FORTNIGHTLY') &&
    draft.weekdays.length === 0
  )
    problems.push('weekdays');
  if (draft.frequency === 'MONTHLY' && wholeNumber(draft.dayOfMonth, 1, DAY_OF_MONTH_MAX) === null)
    problems.push('dayOfMonth');
  if (
    draft.frequency === 'EVERY_N_DAYS' &&
    wholeNumber(draft.intervalDays, 1, INTERVAL_DAYS_MAX) === null
  )
    problems.push('intervalDays');
  if (draft.startsOn === '') problems.push('startsOn');
  if (removedEnd && draft.endsOn === '') problems.push('endsOn');
  if (draft.lines.length === 0 || draft.lines.some((l) => standingLineProblems(l).length > 0))
    problems.push('lines');
  if (draft.lines.length > LINES_MAX) problems.push('tooManyLines');
  return problems;
}

/** The fields the frequency uses, as the contract takes them; nothing for the others (`NOT_FOR_FREQUENCY`). */
function scheduleBody(
  draft: StandingOrderDraft,
): Pick<S['StandingOrderCreate'], 'weekdays' | 'dayOfMonth' | 'intervalDays'> {
  switch (draft.frequency) {
    case 'WEEKLY':
    case 'FORTNIGHTLY':
      return { weekdays: WEEKDAYS.filter((day) => draft.weekdays.includes(day)) };
    case 'MONTHLY':
      return { dayOfMonth: wholeNumber(draft.dayOfMonth, 1, DAY_OF_MONTH_MAX) ?? 0 };
    case 'EVERY_N_DAYS':
      return { intervalDays: wholeNumber(draft.intervalDays, 1, INTERVAL_DAYS_MAX) ?? 0 };
    default:
      return {};
  }
}

/** The lines as `StandingOrderLineInput`, each in its own unit when one was chosen. */
function linesBody(draft: StandingOrderDraft): S['StandingOrderLineInput'][] {
  return draft.lines.map((line) => ({
    productId: line.product?.id ?? '',
    quantity: toQuantity(line.qty) ?? '',
    ...(line.uom === '' ? {} : { uom: line.uom }),
  }));
}

/** `createStandingOrder`'s body. Only call it once `draftProblems` is empty. */
export function toCreateBody(
  customerId: string,
  draft: StandingOrderDraft,
): S['StandingOrderCreate'] {
  return {
    customerId,
    frequency: draft.frequency === '' ? 'WEEKLY' : draft.frequency,
    ...scheduleBody(draft),
    startsOn: draft.startsOn,
    ...(draft.endsOn === '' ? {} : { endsOn: draft.endsOn }),
    lines: linesBody(draft),
  };
}

/**
 * `updateStandingOrder`'s body at the version read: the days the frequency uses, the end, and the lines,
 * which replace the lines in force. The frequency and the start never change (2.18.0), so neither is sent.
 */
export function toUpdateBody(
  order: Pick<StandingOrder, 'version'>,
  draft: StandingOrderDraft,
): S['StandingOrderUpdate'] {
  return {
    version: order.version,
    ...scheduleBody(draft),
    ...(draft.endsOn === '' ? {} : { endsOn: draft.endsOn }),
    lines: linesBody(draft),
  };
}

/** The fields of the form a refusal's `details[].field` can point at. */
export type RefusedField =
  'frequency' | 'weekdays' | 'dayOfMonth' | 'intervalDays' | 'startsOn' | 'endsOn' | 'lines';

const POINTED: Record<string, RefusedField> = {
  frequency: 'frequency',
  weekdays: 'weekdays',
  // The deprecated single day, should the server still name it.
  weekday: 'weekdays',
  dayOfMonth: 'dayOfMonth',
  intervalDays: 'intervalDays',
  startsOn: 'startsOn',
  endsOn: 'endsOn',
  lines: 'lines',
};

/**
 * The server's words for each field a refusal points at (`details[].field`, a JSON pointer such as
 * `/startsOn` or `/lines/2/quantity`), so a rule broken on one field is said beside it. A line's rule is
 * said under the lines. Details with no field, or one this form does not have, are left to the refusal's
 * own words above the form.
 */
export function refusedFields(
  details: readonly { field: string | null; message: string }[],
): Partial<Record<RefusedField, string>> {
  const said: Partial<Record<RefusedField, string>> = {};
  for (const detail of details) {
    const name = detail.field?.split('/')[1];
    const field = name !== undefined && Object.hasOwn(POINTED, name) ? POINTED[name] : undefined;
    if (field === undefined || detail.message.trim() === '') continue;
    const before = said[field];
    said[field] = before === undefined ? detail.message : `${before} ${detail.message}`;
  }
  return said;
}

/** Which of pause, resume and end an order in this state allows, as the contract describes them. */
export function allowedActions(status: StandingOrderStatus): {
  edit: boolean;
  pause: boolean;
  resume: boolean;
  end: boolean;
} {
  return {
    edit: status === 'ACTIVE' || status === 'PAUSED',
    pause: status === 'ACTIVE',
    resume: status === 'PAUSED',
    end: status === 'ACTIVE' || status === 'PAUSED',
  };
}
