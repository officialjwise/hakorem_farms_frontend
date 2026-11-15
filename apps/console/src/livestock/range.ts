import { dayEnd, dayStart, type DateRange } from '../lib/dateRange';

/**
 * A picked date range as the API's `from` and `to`: whole days in Accra (UTC+0) as instants for the lists
 * that filter by `format: date-time` (weights, health events, deaths and culls), or the days as they are for
 * those that filter by `format: date` (feed).
 */
export function rangeQuery(
  range: DateRange,
  format: 'instant' | 'date',
): { from?: string; to?: string } {
  const from =
    range.from === undefined
      ? {}
      : { from: format === 'instant' ? dayStart(range.from) : range.from };
  const to =
    range.to === undefined ? {} : { to: format === 'instant' ? dayEnd(range.to) : range.to };
  return { ...from, ...to };
}
