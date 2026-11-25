import { describe, expect, it } from 'vitest';
import {
  allowedActions,
  blankDraft,
  draftFromOrder,
  draftProblems,
  listWords,
  refusedFields,
  scheduleWords,
  standingLineProblems,
  toCreateBody,
  toUpdateBody,
  wholeNumber,
  type ScheduleWords,
  type StandingOrder,
  type StandingOrderDraft,
} from './standingOrders';

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const words: ScheduleWords = {
  weekday: (day) => DAYS[day] ?? String(day),
  and: 'and',
  weekly: (days) => `Every week on ${days}`,
  fortnightly: (days) => `Every other week on ${days}`,
  monthly: (day) => `Every month on day ${day}`,
  everyNDays: (count) => (count === 1 ? 'Every day' : `Every ${count} days`),
  unknown: (frequency) => `Schedule not complete (${frequency})`,
};

const schedule = (
  frequency: StandingOrder['frequency'],
  more: Partial<Pick<StandingOrder, 'weekdays' | 'dayOfMonth' | 'intervalDays'>> = {},
) => ({ frequency, weekdays: [], dayOfMonth: null, intervalDays: null, ...more });

const PRODUCT = {
  id: '019a7a8d-ec06-79f8-af30-a851f637212f',
  sku: 'MEAT-0001',
  name: 'Full chicken, 15 kg pack',
  baseUom: 'PACK',
};

const ready = (change: Partial<StandingOrderDraft> = {}): StandingOrderDraft => ({
  ...blankDraft(),
  frequency: 'WEEKLY',
  weekdays: [5, 2],
  startsOn: '2026-11-30',
  lines: [{ key: 'a', product: PRODUCT, uom: '', qty: '2' }],
  ...change,
});

describe('a schedule in words', () => {
  it('names the weekly and fortnightly days, Monday first, with "and" before the last', () => {
    expect(scheduleWords(schedule('WEEKLY', { weekdays: [2] }), words)).toBe(
      'Every week on Tuesday',
    );
    expect(scheduleWords(schedule('WEEKLY', { weekdays: [5, 1, 3] }), words)).toBe(
      'Every week on Monday, Wednesday and Friday',
    );
    expect(scheduleWords(schedule('FORTNIGHTLY', { weekdays: [7, 1] }), words)).toBe(
      'Every other week on Monday and Sunday',
    );
  });

  it('says the day of the month and the interval, and every day for an interval of one', () => {
    expect(scheduleWords(schedule('MONTHLY', { dayOfMonth: 1 }), words)).toBe(
      'Every month on day 1',
    );
    expect(scheduleWords(schedule('EVERY_N_DAYS', { intervalDays: 3 }), words)).toBe(
      'Every 3 days',
    );
    expect(scheduleWords(schedule('EVERY_N_DAYS', { intervalDays: 1 }), words)).toBe('Every day');
  });

  it('never reads the deprecated weekday, and says when the record does not complete its schedule', () => {
    expect(
      scheduleWords(
        { ...schedule('WEEKLY'), weekday: 2 } as Parameters<typeof scheduleWords>[0],
        words,
      ),
    ).toBe('Schedule not complete (WEEKLY)');
    expect(scheduleWords(schedule('MONTHLY'), words)).toBe('Schedule not complete (MONTHLY)');
    expect(scheduleWords(schedule('YEARLY' as StandingOrder['frequency']), words)).toBe(
      'Schedule not complete (YEARLY)',
    );
  });

  it('joins a list as a sentence does', () => {
    expect(listWords([], 'and')).toBe('');
    expect(listWords(['Monday'], 'and')).toBe('Monday');
    expect(listWords(['Monday', 'Friday'], 'and')).toBe('Monday and Friday');
  });
});

describe('the draft', () => {
  it('takes whole numbers in range only', () => {
    expect(wholeNumber('28', 1, 28)).toBe(28);
    expect(wholeNumber(' 3 ', 1, 365)).toBe(3);
    expect(wholeNumber('29', 1, 28)).toBeNull();
    expect(wholeNumber('0', 1, 28)).toBeNull();
    expect(wholeNumber('2.5', 1, 28)).toBeNull();
    expect(wholeNumber('', 1, 28)).toBeNull();
    expect(wholeNumber('366', 1, 365)).toBeNull();
  });

  it('asks for the fields the frequency needs, a start and whole lines', () => {
    expect(draftProblems(ready())).toEqual([]);
    expect(draftProblems(blankDraft())).toEqual(['frequency', 'startsOn', 'lines']);
    expect(draftProblems(ready({ weekdays: [] }))).toEqual(['weekdays']);
    expect(draftProblems(ready({ frequency: 'MONTHLY', dayOfMonth: '31' }))).toEqual([
      'dayOfMonth',
    ]);
    expect(draftProblems(ready({ frequency: 'EVERY_N_DAYS', intervalDays: '' }))).toEqual([
      'intervalDays',
    ]);
    expect(draftProblems(ready({ lines: [] }))).toEqual(['lines']);
    expect(
      draftProblems(
        ready({
          lines: Array.from({ length: 51 }, (_, i) => ({
            key: String(i),
            product: PRODUCT,
            uom: '',
            qty: '1',
          })),
        }),
      ),
    ).toEqual(['tooManyLines']);
  });

  it('says an emptied end date, which the contract cannot take away', () => {
    expect(draftProblems(ready(), { removedEnd: true })).toEqual(['endsOn']);
    expect(draftProblems(ready({ endsOn: '2027-01-31' }), { removedEnd: true })).toEqual([]);
  });

  it('checks each line for a product and a quantity above nothing', () => {
    expect(standingLineProblems({ key: 'a', product: null, uom: '', qty: '' })).toEqual([
      'product',
      'qty',
    ]);
    expect(standingLineProblems({ key: 'a', product: PRODUCT, uom: '', qty: '0' })).toEqual([
      'qty',
    ]);
    expect(standingLineProblems({ key: 'a', product: PRODUCT, uom: '', qty: '1.5' })).toEqual([]);
  });
});

describe('the bodies sent', () => {
  it('creates with weekdays (never the deprecated weekday), Monday first, and three-place quantities', () => {
    expect(toCreateBody('cus-1', ready({ endsOn: '2027-03-31' }))).toEqual({
      customerId: 'cus-1',
      frequency: 'WEEKLY',
      weekdays: [2, 5],
      startsOn: '2026-11-30',
      endsOn: '2027-03-31',
      lines: [{ productId: PRODUCT.id, quantity: '2.000' }],
    });
  });

  it('sends only the field the frequency uses, and the unit a line was counted in', () => {
    expect(
      toCreateBody(
        'cus-1',
        ready({
          frequency: 'EVERY_N_DAYS',
          intervalDays: '10',
          dayOfMonth: '4',
          lines: [{ key: 'a', product: PRODUCT, uom: 'CRATE', qty: '20' }],
        }),
      ),
    ).toEqual({
      customerId: 'cus-1',
      frequency: 'EVERY_N_DAYS',
      intervalDays: 10,
      startsOn: '2026-11-30',
      lines: [{ productId: PRODUCT.id, quantity: '20.000', uom: 'CRATE' }],
    });
    expect(toCreateBody('cus-1', ready({ frequency: 'MONTHLY', dayOfMonth: '1' }))).toMatchObject({
      dayOfMonth: 1,
    });
    expect(
      toCreateBody('cus-1', ready({ frequency: 'MONTHLY', dayOfMonth: '1' })),
    ).not.toHaveProperty('weekdays');
  });

  it('changes at the version read, never the frequency or the start, and replaces the lines', () => {
    const order = {
      id: 'so-1',
      customer: { id: 'cus-1', publicId: 'cus_X', name: 'Royal Palm Hotel Ltd' },
      status: 'ACTIVE',
      frequency: 'WEEKLY',
      weekday: 2,
      weekdays: [2],
      dayOfMonth: null,
      intervalDays: null,
      startsOn: '2026-10-06',
      endsOn: null,
      nextRunOn: '2026-11-17',
      deliveryAddress: null,
      lines: [
        {
          id: 'line-1',
          lineNo: 1,
          product: { id: PRODUCT.id, sku: PRODUCT.sku, name: PRODUCT.name },
          quantity: '2.000',
          uom: 'PACK',
        },
      ],
      branchId: 'branch-1',
      version: 3,
    } as StandingOrder;
    const draft = draftFromOrder(order);
    expect(draft.lines[0]).toMatchObject({
      product: { id: PRODUCT.id, baseUom: 'PACK' },
      qty: '2.000',
    });
    expect(toUpdateBody(order, { ...draft, weekdays: [4, 2] })).toEqual({
      version: 3,
      weekdays: [2, 4],
      lines: [{ productId: PRODUCT.id, quantity: '2.000', uom: 'PACK' }],
    });
  });
});

describe("a refusal's rules beside the fields they point at", () => {
  it('says each rule on its field, a line rule under the lines, and leaves the rest to the refusal', () => {
    expect(
      refusedFields([
        { field: '/startsOn', message: 'The first day is before today.' },
        { field: '/lines/0/productId', message: 'The product is not active.' },
        { field: '/lines/1/quantity', message: 'The quantity is not exact.' },
        { field: '/weekday', message: 'Not a day.' },
        { field: '/customerId', message: 'The customer is not active.' },
        { field: '/constructor', message: 'Not a field.' },
        { field: null, message: 'The account is closed.' },
        { field: '/endsOn', message: ' ' },
      ]),
    ).toEqual({
      startsOn: 'The first day is before today.',
      lines: 'The product is not active. The quantity is not exact.',
      weekdays: 'Not a day.',
    });
  });
});

describe('what each state allows', () => {
  it('pauses only an active order, resumes only a paused one, and ends either', () => {
    expect(allowedActions('ACTIVE')).toEqual({ edit: true, pause: true, resume: false, end: true });
    expect(allowedActions('PAUSED')).toEqual({ edit: true, pause: false, resume: true, end: true });
    expect(allowedActions('ENDED')).toEqual({
      edit: false,
      pause: false,
      resume: false,
      end: false,
    });
    expect(allowedActions('CANCELLED')).toEqual({
      edit: false,
      pause: false,
      resume: false,
      end: false,
    });
  });
});
