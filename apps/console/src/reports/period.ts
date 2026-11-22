import type { DateString } from '@hakorem/ui';

/** Today in Accra, as a calendar date: the default end of a range and the default day of a daily report. */
export function accraToday(): DateString {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Accra' }).format(
    new Date(),
  ) as DateString;
}

/** The first day of the month a date falls in. */
export function monthStart(day: DateString): DateString {
  return `${day.slice(0, 8)}01` as DateString;
}
