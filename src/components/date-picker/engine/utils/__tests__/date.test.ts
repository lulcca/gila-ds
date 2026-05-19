import {
  addDays,
  addMonths,
  compareDates,
  formatDisplayDate,
  getDaysInMonth,
  getMonthName,
  getWeekDay,
  getWeekDayNames,
  isSameDay,
  isValidDate,
  isWithinRange,
  parseISODate,
  today,
} from '../date';
import { describe, expect, it } from 'vitest';

describe('date utils', () => {
  describe('isValidDate', () => {
    it('accepts canonical dates', () => {
      expect(isValidDate({ day: 29, month: 2, year: 2024 })).toBe(true);
      expect(isValidDate({ day: 1, month: 1, year: 1 })).toBe(true);
    });

    it('rejects impossible days', () => {
      expect(isValidDate({ day: 29, month: 2, year: 2023 })).toBe(false);
      expect(isValidDate({ day: 31, month: 4, year: 2024 })).toBe(false);
      expect(isValidDate({ day: 1, month: 0, year: 2024 })).toBe(false);
      expect(isValidDate({ day: 1, month: 13, year: 2024 })).toBe(false);
      expect(isValidDate({ day: 0, month: 1, year: 2024 })).toBe(false);
    });

    it('rejects non-integer fields', () => {
      expect(isValidDate({ day: 1, month: 1, year: 2024.5 })).toBe(false);
      expect(isValidDate({ day: 1, month: 1.5, year: 2024 })).toBe(false);
      expect(isValidDate({ day: 1.5, month: 1, year: 2024 })).toBe(false);
    });
  });

  describe('today', () => {
    it('returns a valid date matching the host clock', () => {
      const t = today();
      const now = new Date();
      expect(t.year).toBe(now.getFullYear());
      expect(t.month).toBe(now.getMonth() + 1);
      expect(t.day).toBe(now.getDate());
      expect(isValidDate(t)).toBe(true);
    });
  });

  describe('getDaysInMonth', () => {
    it('handles leap years', () => {
      expect(getDaysInMonth(2024, 2)).toBe(29);
      expect(getDaysInMonth(2023, 2)).toBe(28);
      expect(getDaysInMonth(2000, 2)).toBe(29); // century leap
      expect(getDaysInMonth(1900, 2)).toBe(28); // century non-leap
    });

    it('returns the correct day count for all months', () => {
      const expected = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      for (let m = 1; m <= 12; m++) {
        expect(getDaysInMonth(2023, m)).toBe(expected[m - 1]);
      }
    });
  });

  describe('getWeekDay', () => {
    it('uses ISO weekday numbering', () => {
      // 2024-01-01 is a Monday.
      expect(getWeekDay({ day: 1, month: 1, year: 2024 })).toBe(1);
      // 2024-01-07 is a Sunday.
      expect(getWeekDay({ day: 7, month: 1, year: 2024 })).toBe(7);
      // 2024-05-18 is a Saturday.
      expect(getWeekDay({ day: 18, month: 5, year: 2024 })).toBe(6);
    });
  });

  describe('addMonths', () => {
    it('crosses year boundaries forward and backward', () => {
      expect(addMonths({ day: 15, month: 12, year: 2024 }, 1)).toEqual({
        day: 15,
        month: 1,
        year: 2025,
      });
      expect(addMonths({ day: 15, month: 1, year: 2024 }, -1)).toEqual({
        day: 15,
        month: 12,
        year: 2023,
      });
    });

    it('clamps the day to the destination month length', () => {
      expect(addMonths({ day: 31, month: 1, year: 2024 }, 1)).toEqual({
        day: 29,
        month: 2,
        year: 2024,
      });
      expect(addMonths({ day: 31, month: 1, year: 2023 }, 1)).toEqual({
        day: 28,
        month: 2,
        year: 2023,
      });
    });

    it('handles large jumps in either direction', () => {
      expect(addMonths({ day: 15, month: 6, year: 2020 }, 30)).toEqual({
        day: 15,
        month: 12,
        year: 2022,
      });
      expect(addMonths({ day: 15, month: 6, year: 2020 }, -30)).toEqual({
        day: 15,
        month: 12,
        year: 2017,
      });
    });
  });

  describe('addDays', () => {
    it('handles month and year crossings', () => {
      expect(addDays({ day: 28, month: 2, year: 2024 }, 1)).toEqual({
        day: 29,
        month: 2,
        year: 2024,
      });
      expect(addDays({ day: 29, month: 2, year: 2024 }, 1)).toEqual({
        day: 1,
        month: 3,
        year: 2024,
      });
      expect(addDays({ day: 1, month: 1, year: 2024 }, -1)).toEqual({
        day: 31,
        month: 12,
        year: 2023,
      });
    });
  });

  describe('comparison helpers', () => {
    it('isSameDay handles null operands', () => {
      const a = { day: 1, month: 5, year: 2024 };
      expect(isSameDay(a, a)).toBe(true);
      expect(isSameDay(a, { day: 2, month: 5, year: 2024 })).toBe(false);
      expect(isSameDay(null, a)).toBe(false);
      expect(isSameDay(a, null)).toBe(false);
      expect(isSameDay(null, null)).toBe(false);
    });

    it('compareDates returns -1 / 0 / 1', () => {
      expect(
        compareDates({ day: 1, month: 1, year: 2024 }, { day: 2, month: 1, year: 2024 }),
      ).toBe(-1);
      expect(
        compareDates({ day: 2, month: 1, year: 2024 }, { day: 2, month: 1, year: 2024 }),
      ).toBe(0);
      expect(
        compareDates({ day: 1, month: 2, year: 2024 }, { day: 1, month: 1, year: 2024 }),
      ).toBe(1);
      expect(
        compareDates({ day: 1, month: 1, year: 2025 }, { day: 1, month: 1, year: 2024 }),
      ).toBe(1);
    });

    it('isWithinRange handles open and closed bounds', () => {
      const min = { day: 1, month: 1, year: 2024 };
      const max = { day: 31, month: 12, year: 2024 };
      expect(isWithinRange({ day: 15, month: 6, year: 2024 }, min, max)).toBe(true);
      expect(isWithinRange({ day: 31, month: 12, year: 2023 }, min, max)).toBe(false);
      expect(isWithinRange({ day: 1, month: 1, year: 2025 }, min, max)).toBe(false);
      expect(isWithinRange({ day: 31, month: 12, year: 2023 }, undefined, max)).toBe(true);
      expect(isWithinRange({ day: 1, month: 1, year: 2025 }, min, undefined)).toBe(true);
    });
  });

  describe('parseISODate', () => {
    it('parses canonical ISO strings', () => {
      expect(parseISODate('2024-05-18')).toEqual({ day: 18, month: 5, year: 2024 });
    });

    it('rejects malformed and impossible ISO strings', () => {
      expect(parseISODate('not a date')).toBeNull();
      expect(parseISODate('2024-13-01')).toBeNull();
      expect(parseISODate('2024-02-30')).toBeNull();
      expect(parseISODate('2024/05/18')).toBeNull();
      expect(parseISODate('')).toBeNull();
    });
  });

  describe('Intl helpers', () => {
    it('produces a localised display string', () => {
      const out = formatDisplayDate({ day: 18, month: 5, year: 2024 }, 'en-US');
      expect(out).toMatch(/May/);
      expect(out).toMatch(/18/);
      expect(out).toMatch(/2024/);
    });

    it('returns 12 distinct month names', () => {
      const names = new Set<string>();
      for (let m = 1; m <= 12; m++) names.add(getMonthName(2024, m, 'en-US'));
      expect(names.size).toBe(12);
    });

    it('builds seven Sunday-first weekday labels', () => {
      const names = getWeekDayNames('en-US');
      expect(names.length).toBe(7);
      expect(names[0]).toMatch(/^Sun/);
      expect(names[6]).toMatch(/^Sat/);
    });
  });
});
