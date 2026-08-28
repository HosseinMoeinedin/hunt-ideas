export type Period = {
  /** Stable key, e.g. "monthly:0" */
  key: string;
  /** 0 = current month, -1 = previous month, etc. */
  offset: number;
  /** e.g. "August 2026" */
  label: string;
  /** e.g. "August" */
  shortLabel: string;
  year: number;
  /** 1-12 */
  month: number;
  /** First day of the month, 00:00 UTC (inclusive) */
  start: Date;
  /** First day of the following month, 00:00 UTC — or "now" for the current month (exclusive) */
  end: Date;
};

function monthName(date: Date): string {
  return date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
}

/**
 * Rounds a timestamp down to the start of its UTC hour. Used as the "now"
 * boundary for the current month's query: an unrounded, millisecond-precise
 * "now" would be different on every single request, so it could never be
 * served from Next's fetch cache — every page view would hit Product Hunt
 * directly. Rounding to the hour means every request within the same clock
 * hour shares an identical query (and therefore an identical cache entry),
 * which is also exactly the cache window the app already uses elsewhere.
 */
function roundDownToHour(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), 0, 0, 0));
}

/** The most negative offset allowed: January of the current year. */
export function getMinOffset(now: Date = new Date()): number {
  return -now.getUTCMonth();
}

/** Clamp an arbitrary offset so it can never select a future month or a month before January of the current year. */
export function clampOffset(offsetRaw: number, now: Date = new Date()): number {
  const min = getMinOffset(now);
  const max = 0;
  const offset = Number.isFinite(offsetRaw) ? Math.trunc(offsetRaw) : 0;
  return Math.min(max, Math.max(min, offset));
}

export function getPeriod(offsetRaw: number, now: Date = new Date()): Period {
  const offset = clampOffset(offsetRaw, now);
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth() + offset; // 0-based, always within [0, currentMonthIndex]

  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = offset === 0 ? roundDownToHour(now) : new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));

  return {
    key: `monthly:${offset}`,
    offset,
    label: `${monthName(start)} ${year}`,
    shortLabel: monthName(start),
    year,
    month: monthIndex + 1,
    start,
    end,
  };
}

/** Every month from the current month back through January of the current year, most recent first. */
export function getAllPeriods(now: Date = new Date()): Period[] {
  const min = getMinOffset(now);
  const periods: Period[] = [];
  for (let offset = 0; offset >= min; offset--) {
    periods.push(getPeriod(offset, now));
  }
  return periods;
}

export function toPeriodSummary(period: Period) {
  return {
    key: period.key,
    offset: period.offset,
    label: period.label,
    shortLabel: period.shortLabel,
  };
}
