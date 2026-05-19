import type { ICalendarDate, TWeekDay } from '../types';

/**
 * Pure, side-effect-free date helpers.
 *
 * The legacy `Date` object is notorious for two pitfalls we work around here:
 *   1. Months are zero-indexed (Jan = 0). We always expose 1-12.
 *   2. Local-timezone constructors can shift days near DST boundaries. We exclusively use `Date.UTC` + `getUTC*` to keep arithmetic safe.
 *
 * This module is written so it can be swapped for `Temporal.PlainDate` with minimal churn — see README for migration notes.
 */

const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Convert a UTC `Date` back to a `ICalendarDate`. */
function fromUtcDate(date: Date): ICalendarDate {
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Build a UTC `Date` for the given y/m/d (month is 1-12). */
function toUtcDate(date: ICalendarDate): Date {
  const d = new Date(0);
  d.setUTCFullYear(date.year, date.month - 1, date.day);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Returns `date` shifted by `days`. */
export function addDays(date: ICalendarDate, days: number): ICalendarDate {
  const utc = toUtcDate(date);
  utc.setUTCDate(utc.getUTCDate() + days);
  return fromUtcDate(utc);
}

/** Returns `date` shifted by `months`, clamping the day to the new month length. */
export function addMonths(date: ICalendarDate, months: number): ICalendarDate {
  const totalMonths = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  const day = Math.min(date.day, getDaysInMonth(year, month));
  return { day, month, year };
}

/** Strict ordering: -1 / 0 / 1. */
export function compareDates(a: ICalendarDate, b: ICalendarDate): -1 | 0 | 1 {
  if (a.year !== b.year) return a.year < b.year ? -1 : 1;
  if (a.month !== b.month) return a.month < b.month ? -1 : 1;
  if (a.day !== b.day) return a.day < b.day ? -1 : 1;
  return 0;
}

/** Localised, human-readable label — uses `Intl.DateTimeFormat`, a native Web API, so we still honour the "no third-party date libraries" rule. */
export function formatDisplayDate(
  date: ICalendarDate,
  locale: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(toUtcDate(date));
}

/** Number of days in `month` of `year` (handles leap years). */
export function getDaysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_PER_MONTH[month - 1] ?? 0;
}

/** Localised month name (e.g. "January"). */
export function getMonthName(
  year: number,
  month: number,
  locale: string,
  style: 'long' | 'short' = 'long',
): string {
  return new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' }).format(
    toUtcDate({ day: 1, month, year }),
  );
}

/** ISO TWeekDay for `date` (1 = Monday … 7 = Sunday). */
export function getWeekDay(date: ICalendarDate): TWeekDay {
  const dow = toUtcDate(date).getUTCDay();
  return (dow === 0 ? 7 : dow) as TWeekDay;
}

/** Returns the seven TWeekDay labels for the given locale, Sunday-first. E.g. for 'en-US': ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']. */
export function getWeekDayNames(
  locale: string,
  style: 'narrow' | 'short' | 'long' = 'short',
): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: style });
  const names: string[] = [];
  for (let i = 0; i < 7; i++) names.push(fmt.format(new Date(Date.UTC(2023, 11, 31 + i))));
  return names;
}

/** Strict equality of year/month/day. */
export function isSameDay(a: ICalendarDate | null, b: ICalendarDate | null): boolean {
  if (!a || !b) return false;
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Validate that a {y,m,d} triple represents a real calendar day. */
export function isValidDate(date: ICalendarDate): boolean {
  if (!Number.isInteger(date.year)) return false;
  if (!Number.isInteger(date.month) || date.month < 1 || date.month > 12) return false;
  if (!Number.isInteger(date.day) || date.day < 1) return false;
  const utc = toUtcDate(date);
  return (
    utc.getUTCFullYear() === date.year &&
    utc.getUTCMonth() === date.month - 1 &&
    utc.getUTCDate() === date.day
  );
}

/** Whether `date` falls within `[min, max]` (inclusive, either side optional). */
export function isWithinRange(
  date: ICalendarDate,
  min: ICalendarDate | undefined,
  max: ICalendarDate | undefined,
): boolean {
  if (min && compareDates(date, min) < 0) return false;
  if (max && compareDates(date, max) > 0) return false;
  return true;
}

/** Parses an ISO 8601 date string (`YYYY-MM-DD`) into a `ICalendarDate`. Returns `null` for any malformed or impossible input. */
export function parseISODate(input: string): ICalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!match) return null;
  const date: ICalendarDate = {
    day: Number(match[3]),
    month: Number(match[2]),
    year: Number(match[1]),
  };
  return isValidDate(date) ? date : null;
}

/** Today as a `ICalendarDate`, evaluated in the user's local timezone. */
export function today(): ICalendarDate {
  const now = new Date();
  return {
    day: now.getDate(),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}
