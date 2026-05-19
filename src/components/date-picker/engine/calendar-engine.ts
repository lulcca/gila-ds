import type {
  ICalendarCell,
  ICalendarDate,
  ICalendarEngineOptions,
  ICalendarState,
  TListener,
  TUnsubscribe,
} from './types';
import {
  addDays,
  addMonths,
  getDaysInMonth,
  getMonthName,
  getWeekDay,
  getWeekDayNames,
  isSameDay,
  isValidDate,
  isWithinRange,
  today as todayFn,
} from './utils/date';

/** ISO weekday for Sunday — the engine always builds Sunday-first grids. */
const SUNDAY = 7;

/**
 * Framework-agnostic calendar state machine.
 *
 * The engine intentionally knows nothing about Vue, React or the DOM —
 * any UI layer just subscribes to state changes and renders `getGrid()`.
 *
 * Design notes:
 *   • Every mutating method returns the new {@link ICalendarState} so callers
 *     can drive themselves without re-reading state.
 *   • Listeners are only invoked when the state has actually changed,
 *     preventing redundant re-renders in reactive frameworks.
 *   • The grid is always 42 cells (6 weeks × 7 days) — fixed-size grids
 *     give the UI a stable layout and avoid Cumulative Layout Shift.
 *   • `minDate`/`maxDate` aren't just visual: every focus-moving method
 *     also refuses to cross them (the WAI-ARIA expectation for grids).
 */
export class CalendarEngine {
  readonly locale: string;
  readonly maxDate?: ICalendarDate;
  readonly minDate?: ICalendarDate;

  private readonly listeners = new Set<TListener>();
  private readonly nowProvider: () => ICalendarDate;

  private focused: ICalendarDate;
  private selected: ICalendarDate | null;
  private viewMonth: number;
  private viewYear: number;

  constructor(options: ICalendarEngineOptions = {}) {
    this.locale = options.locale ?? 'en-US';
    this.minDate = options.minDate;
    this.maxDate = options.maxDate;
    this.nowProvider = options.now ?? todayFn;

    const seed = options.initialSelected ?? this.nowProvider();
    if (options.initialSelected && !isValidDate(options.initialSelected)) {
      throw new RangeError('CalendarEngine: initialSelected is not a valid date');
    }

    this.viewYear = seed.year;
    this.viewMonth = seed.month;
    this.selected = options.initialSelected ?? null;
    this.focused = seed;
  }

  clearSelection(): ICalendarState {
    return this.update(() => {
      this.selected = null;
    });
  }

  /** Snaps focus to the first selectable day of the current view. If the whole visible month is disabled, no-op (and the caller can show a "no selectable days" hint). */
  focusFirstOfMonth(): ICalendarState {
    const target = this.firstSelectableInView();
    return target ? this.applyFocus(target) : this.getState();
  }

  /** Snaps focus to the last selectable day of the current view. */
  focusLastOfMonth(): ICalendarState {
    const target = this.lastSelectableInView();
    return target ? this.applyFocus(target) : this.getState();
  }

  /** Builds the 6×7 month grid, including leading days from the previous month and trailing days from the next month. */
  getGrid(): ICalendarCell[] {
    const today = this.nowProvider();
    const firstOfMonth: ICalendarDate = { day: 1, month: this.viewMonth, year: this.viewYear };
    const firstWeekday = getWeekDay(firstOfMonth);
    const leading = (firstWeekday - SUNDAY + 7) % 7;
    const gridStart = addDays(firstOfMonth, -leading);

    const cells: ICalendarCell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = addDays(gridStart, i);
      const isoWeekday = getWeekDay(date);
      cells.push({
        date,
        isCurrentMonth: date.month === this.viewMonth && date.year === this.viewYear,
        isDisabled: !isWithinRange(date, this.minDate, this.maxDate),
        isFocused: isSameDay(date, this.focused),
        isSelected: isSameDay(date, this.selected),
        isToday: isSameDay(date, today),
        isWeekend: isoWeekday === 6 || isoWeekday === 7,
      });
    }
    return cells;
  }

  getMonthLabel(style: 'long' | 'short' = 'long'): string {
    return getMonthName(this.viewYear, this.viewMonth, this.locale, style);
  }

  getState(): ICalendarState {
    return {
      focused: this.focused,
      selected: this.selected,
      today: this.nowProvider(),
      viewMonth: this.viewMonth,
      viewYear: this.viewYear,
    };
  }

  getWeekdayLabels(style: 'narrow' | 'short' | 'long' = 'short'): string[] {
    return getWeekDayNames(this.locale, style);
  }

  goToToday(): ICalendarState {
    const today = this.nowProvider();
    return this.setView(today.year, today.month, today);
  }

  /** Moves keyboard focus by `days` (negative goes backwards). No-op if the destination is disabled — matches the WAI-ARIA grid expectation that you can't focus a disabled cell. */
  moveFocus(days: number): ICalendarState {
    const next = addDays(this.focused, days);
    if (!this.isSelectable(next)) return this.getState();
    return this.applyFocus(next);
  }

  /** Moves focus by `months` (negative goes backwards). Skips disabled. */
  moveFocusByMonths(months: number): ICalendarState {
    const next = addMonths(this.focused, months);
    if (!this.isSelectable(next)) return this.getState();
    return this.applyFocus(next);
  }

  nextMonth(): ICalendarState {
    const next = addMonths({ day: 1, month: this.viewMonth, year: this.viewYear }, 1);
    return this.setView(next.year, next.month);
  }

  nextYear(): ICalendarState {
    return this.setView(this.viewYear + 1, this.viewMonth);
  }

  previousMonth(): ICalendarState {
    const prev = addMonths({ day: 1, month: this.viewMonth, year: this.viewYear }, -1);
    return this.setView(prev.year, prev.month);
  }

  previousYear(): ICalendarState {
    return this.setView(this.viewYear - 1, this.viewMonth);
  }

  selectDate(date: ICalendarDate): ICalendarState {
    if (!isValidDate(date)) throw new RangeError('CalendarEngine.selectDate: invalid date');
    if (!this.isSelectable(date)) return this.getState();
    return this.update(() => {
      this.selected = date;
      this.focused = date;
      this.viewYear = date.year;
      this.viewMonth = date.month;
    });
  }

  setFocus(date: ICalendarDate): ICalendarState {
    if (!isValidDate(date)) {
      throw new RangeError('CalendarEngine.setFocus: invalid date');
    }
    if (!this.isSelectable(date)) return this.getState();
    return this.applyFocus(date);
  }

  subscribe(listener: TListener): TUnsubscribe {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private applyFocus(date: ICalendarDate): ICalendarState {
    return this.update(() => {
      this.focused = date;
      this.viewYear = date.year;
      this.viewMonth = date.month;
    });
  }

  private firstSelectableInView(): ICalendarDate | null {
    const days = getDaysInMonth(this.viewYear, this.viewMonth);
    for (let day = 1; day <= days; day++) {
      const date: ICalendarDate = { day, month: this.viewMonth, year: this.viewYear };
      if (this.isSelectable(date)) return date;
    }
    return null;
  }

  private isSelectable(date: ICalendarDate): boolean {
    return isWithinRange(date, this.minDate, this.maxDate);
  }

  private lastSelectableInView(): ICalendarDate | null {
    const days = getDaysInMonth(this.viewYear, this.viewMonth);
    for (let day = days; day >= 1; day--) {
      const date: ICalendarDate = { day, month: this.viewMonth, year: this.viewYear };
      if (this.isSelectable(date)) return date;
    }
    return null;
  }

  private setView(year: number, month: number, focus?: ICalendarDate): ICalendarState {
    return this.update(() => {
      this.viewYear = year;
      this.viewMonth = month;
      if (focus) this.focused = focus;
    });
  }

  private snapshot(): TSnapshot {
    return {
      focused: this.focused,
      selected: this.selected,
      viewMonth: this.viewMonth,
      viewYear: this.viewYear,
    };
  }

  private update(mutator: () => void): ICalendarState {
    const prev = this.snapshot();
    mutator();
    const next = this.snapshot();
    if (!equalSnapshots(prev, next)) {
      this.listeners.forEach((listener) => listener(this.getState()));
    }
    return this.getState();
  }
}

function equalSnapshots(a: TSnapshot, b: TSnapshot): boolean {
  return (
    a.viewYear === b.viewYear &&
    a.viewMonth === b.viewMonth &&
    isSameDay(a.focused, b.focused) &&
    (a.selected === null
      ? b.selected === null
      : isSameDay(a.selected, b.selected))
  );
}

type TSnapshot = Omit<ICalendarState, 'today'>;
