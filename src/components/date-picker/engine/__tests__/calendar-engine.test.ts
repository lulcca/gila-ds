import type { ICalendarDate, TListener } from '../types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarEngine } from '../calendar-engine';

/**
 * Pinning "today" to 2024-05-18 (a Saturday) makes every grid assertion
 * deterministic regardless of the host clock.
 */
const FIXED_TODAY: ICalendarDate = { day: 18, month: 5, year: 2024 };
const now = () => FIXED_TODAY;

let engine: CalendarEngine;

beforeEach(() => {
  engine = new CalendarEngine({ initialSelected: FIXED_TODAY, now });
});

describe('CalendarEngine — construction', () => {
  it('defaults the view to the initial selection', () => {
    const state = engine.getState();
    expect(state.viewYear).toBe(2024);
    expect(state.viewMonth).toBe(5);
    expect(state.selected).toEqual(FIXED_TODAY);
    expect(state.focused).toEqual(FIXED_TODAY);
    expect(state.today).toEqual(FIXED_TODAY);
  });

  it('defaults the view to today when no initial selection is given', () => {
    const fresh = new CalendarEngine({ now });
    expect(fresh.getState().viewYear).toBe(FIXED_TODAY.year);
    expect(fresh.getState().viewMonth).toBe(FIXED_TODAY.month);
    expect(fresh.getState().selected).toBeNull();
  });

  it('throws on invalid initial selection', () => {
    expect(
      () => new CalendarEngine({ initialSelected: { day: 1, month: 13, year: 2024 }, now }),
    ).toThrow(RangeError);
  });

  it('honours a custom locale', () => {
    const e = new CalendarEngine({ locale: 'pt-BR', now });
    expect(e.locale).toBe('pt-BR');
    expect(e.getWeekdayLabels().length).toBe(7);
  });
});

describe('CalendarEngine — grid generation', () => {
  it('always returns 42 cells (6 weeks × 7 days)', () => {
    expect(engine.getGrid().length).toBe(42);
  });

  it('starts on a Sunday with leading days from the previous month', () => {
    // May 1 2024 is a Wednesday. With Sunday-first weeks the grid leads
    // with the last Sun/Mon/Tue of April (28, 29, 30).
    const grid = engine.getGrid();
    expect(grid[0]?.date).toEqual({ day: 28, month: 4, year: 2024 });
    expect(grid[0]?.isCurrentMonth).toBe(false);
    expect(grid[1]?.date.day).toBe(29);
    expect(grid[2]?.date.day).toBe(30);
    expect(grid[3]?.date).toEqual({ day: 1, month: 5, year: 2024 });
    expect(grid[3]?.isCurrentMonth).toBe(true);
  });

  it('marks today, the selected date, and the focused date', () => {
    const grid = engine.getGrid();
    const todayCell = grid.find((c) => c.date.day === 18 && c.isCurrentMonth);
    expect(todayCell?.isToday).toBe(true);
    expect(todayCell?.isSelected).toBe(true);
    expect(todayCell?.isFocused).toBe(true);
  });

  it('flags weekend cells', () => {
    const grid = engine.getGrid();
    const saturday = grid.find((c) => c.date.day === 18 && c.isCurrentMonth);
    const monday = grid.find((c) => c.date.day === 20 && c.isCurrentMonth);
    expect(saturday?.isWeekend).toBe(true);
    expect(monday?.isWeekend).toBe(false);
  });

  it('disables cells outside [minDate, maxDate]', () => {
    const e = new CalendarEngine({
      initialSelected: FIXED_TODAY,
      maxDate: { day: 25, month: 5, year: 2024 },
      minDate: { day: 10, month: 5, year: 2024 },
      now,
    });
    const grid = e.getGrid();
    const before = grid.find((c) => c.date.day === 9 && c.isCurrentMonth);
    const inside = grid.find((c) => c.date.day === 15 && c.isCurrentMonth);
    const after = grid.find((c) => c.date.day === 26 && c.isCurrentMonth);
    expect(before?.isDisabled).toBe(true);
    expect(inside?.isDisabled).toBe(false);
    expect(after?.isDisabled).toBe(true);
  });
});

describe('CalendarEngine — navigation', () => {
  it('moves to the next and previous month', () => {
    engine.nextMonth();
    expect(engine.getState().viewMonth).toBe(6);
    engine.previousMonth();
    expect(engine.getState().viewMonth).toBe(5);
  });

  it('wraps year boundaries', () => {
    const e = new CalendarEngine({ initialSelected: { day: 1, month: 12, year: 2024 }, now });
    e.nextMonth();
    expect(e.getState()).toMatchObject({ viewMonth: 1, viewYear: 2025 });
    e.previousMonth();
    expect(e.getState()).toMatchObject({ viewMonth: 12, viewYear: 2024 });
  });

  it('jumps by years', () => {
    engine.nextYear();
    expect(engine.getState().viewYear).toBe(2025);
    engine.previousYear();
    expect(engine.getState().viewYear).toBe(2024);
  });

  it('returns to today on goToToday', () => {
    const e = new CalendarEngine({ initialSelected: { day: 1, month: 1, year: 2020 }, now });
    e.goToToday();
    expect(e.getState()).toMatchObject({
      focused: FIXED_TODAY,
      viewMonth: FIXED_TODAY.month,
      viewYear: FIXED_TODAY.year,
    });
  });
});

describe('CalendarEngine — selection & focus', () => {
  it('selectDate updates selection, focus, and view', () => {
    engine.selectDate({ day: 14, month: 3, year: 2025 });
    expect(engine.getState()).toMatchObject({
      focused: { day: 14, month: 3, year: 2025 },
      selected: { day: 14, month: 3, year: 2025 },
      viewMonth: 3,
      viewYear: 2025,
    });
  });

  it('selectDate throws on invalid input', () => {
    expect(() => engine.selectDate({ day: 30, month: 2, year: 2024 })).toThrow(RangeError);
  });

  it('selectDate silently no-ops on out-of-range dates', () => {
    const e = new CalendarEngine({
      maxDate: { day: 20, month: 5, year: 2024 },
      minDate: { day: 10, month: 5, year: 2024 },
      now,
    });
    e.selectDate({ day: 5, month: 5, year: 2024 });
    expect(e.getState().selected).toBeNull();
  });

  it('clearSelection removes the selected date', () => {
    expect(engine.getState().selected).not.toBeNull();
    engine.clearSelection();
    expect(engine.getState().selected).toBeNull();
  });

  it('moveFocus crosses month boundaries and updates the view', () => {
    engine.moveFocus(-18); // 2024-05-18 minus 18 days → 2024-04-30
    expect(engine.getState().focused).toEqual({ day: 30, month: 4, year: 2024 });
    expect(engine.getState().viewMonth).toBe(4);
  });

  it('moveFocusByMonths shifts month while clamping day', () => {
    engine.setFocus({ day: 31, month: 1, year: 2024 });
    engine.moveFocusByMonths(1);
    expect(engine.getState().focused).toEqual({ day: 29, month: 2, year: 2024 });
  });

  it('setFocus throws on invalid input', () => {
    expect(() => engine.setFocus({ day: 30, month: 2, year: 2024 })).toThrow(RangeError);
  });

  it('focusFirstOfMonth and focusLastOfMonth snap to the month edges', () => {
    engine.focusFirstOfMonth();
    expect(engine.getState().focused).toEqual({ day: 1, month: 5, year: 2024 });
    engine.focusLastOfMonth();
    expect(engine.getState().focused).toEqual({ day: 31, month: 5, year: 2024 });
  });
});

describe('CalendarEngine — focus respects [minDate, maxDate]', () => {
  const minDate: ICalendarDate = { day: 10, month: 5, year: 2024 };
  const maxDate: ICalendarDate = { day: 25, month: 5, year: 2024 };

  function bounded(initial: ICalendarDate = { day: 15, month: 5, year: 2024 }) {
    return new CalendarEngine({ initialSelected: initial, maxDate, minDate, now });
  }

  it('moveFocus is a no-op when the destination would be disabled', () => {
    const e = bounded({ day: 25, month: 5, year: 2024 }); // at the max
    e.moveFocus(1);
    expect(e.getState().focused).toEqual({ day: 25, month: 5, year: 2024 });
  });

  it('moveFocus by a week stops at the upper bound', () => {
    const e = bounded({ day: 20, month: 5, year: 2024 });
    e.moveFocus(7); // would land on 27 — outside bounds
    expect(e.getState().focused).toEqual({ day: 20, month: 5, year: 2024 });
  });

  it('moveFocus backwards stops at the lower bound', () => {
    const e = bounded({ day: 10, month: 5, year: 2024 }); // at the min
    e.moveFocus(-1);
    expect(e.getState().focused).toEqual({ day: 10, month: 5, year: 2024 });
  });

  it('moveFocusByMonths refuses to cross bounds', () => {
    const e = bounded();
    e.moveFocusByMonths(1); // June 15 — outside max=May 25
    expect(e.getState().focused).toEqual({ day: 15, month: 5, year: 2024 });
    e.moveFocusByMonths(-1); // April 15 — outside min=May 10
    expect(e.getState().focused).toEqual({ day: 15, month: 5, year: 2024 });
  });

  it('focusFirstOfMonth clamps to minDate when the month start is disabled', () => {
    const e = bounded();
    e.focusFirstOfMonth(); // May 1 is before min=May 10 → snap to May 10
    expect(e.getState().focused).toEqual(minDate);
  });

  it('focusLastOfMonth clamps to maxDate when the month end is disabled', () => {
    const e = bounded();
    e.focusLastOfMonth(); // May 31 is after max=May 25 → snap to May 25
    expect(e.getState().focused).toEqual(maxDate);
  });

  it('setFocus refuses to land on a disabled date', () => {
    const e = bounded();
    e.setFocus({ day: 30, month: 5, year: 2024 });
    expect(e.getState().focused).toEqual({ day: 15, month: 5, year: 2024 });
  });

  it('view-only navigation (nextMonth) is unaffected by bounds', () => {
    // We still want users to be able to *see* months outside the range.
    const e = bounded();
    e.nextMonth();
    expect(e.getState().viewMonth).toBe(6);
  });
});

describe('CalendarEngine — reactivity', () => {
  it('notifies subscribers when state changes', () => {
    const listener = vi.fn<TListener>();
    engine.subscribe(listener);
    // subscribe fires once with the current snapshot
    expect(listener).toHaveBeenCalledTimes(1);

    engine.nextMonth();
    expect(listener).toHaveBeenCalledTimes(2);

    engine.selectDate({ day: 1, month: 6, year: 2024 });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('skips notification when the state did not change', () => {
    const listener = vi.fn<TListener>();
    engine.subscribe(listener);
    listener.mockClear();

    engine.selectDate(FIXED_TODAY); // same date as initial selection
    expect(listener).not.toHaveBeenCalled();
  });

  it('returns a working unsubscribe function', () => {
    const listener = vi.fn<TListener>();
    const off = engine.subscribe(listener);
    listener.mockClear();
    off();
    engine.nextMonth();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('CalendarEngine — labels', () => {
  it('returns a localised month label', () => {
    expect(engine.getMonthLabel()).toMatch(/May/i);
  });

  it('returns 7 weekday labels', () => {
    expect(engine.getWeekdayLabels().length).toBe(7);
    expect(engine.getWeekdayLabels('narrow').length).toBe(7);
  });
});
