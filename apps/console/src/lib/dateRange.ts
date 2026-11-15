import { useTranslation } from 'react-i18next';

/**
 * A day picked in a filter as the instant range the contract's date-time `from` and `to` take. Accra is
 * UTC+0 all year (ADR 0027), so an Accra day is the UTC day: from its first millisecond to its last.
 */
export function dayStart(day: string): string {
  return `${day}T00:00:00.000Z`;
}
export function dayEnd(day: string): string {
  return `${day}T23:59:59.999Z`;
}

export interface DateRange {
  from: string | undefined;
  to: string | undefined;
}

/** The date range pill's words: "2026-11-01 to 2026-11-15", "From 2026-11-01", or "Any date". */
export function useDateRangeWords(): (range: DateRange) => string {
  const { t } = useTranslation('common');
  return ({ from, to }) =>
    from !== undefined && to !== undefined
      ? t('dates.range', { from, to })
      : from !== undefined
        ? t('dates.since', { from })
        : to !== undefined
          ? t('dates.until', { to })
          : t('dates.any');
}
