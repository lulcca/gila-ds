import type { ComputedRef, ShallowRef } from 'vue';
import type {
  ICalendarCell,
  ICalendarDate,
  ICalendarEngineOptions,
  ICalendarState,
} from './engine';
import { computed, onScopeDispose, shallowRef } from 'vue';
import { CalendarEngine } from './engine';

export interface IUseCalendarReturn {
  clearSelection: () => void;
  /** Direct reference to the underlying engine — escape hatch for advanced use. */
  engine: CalendarEngine;
  focusFirstOfMonth: () => void;
  focusLastOfMonth: () => void;
  goToToday: () => void;
  /** Reactive 6×7 grid for the current view. */
  grid: ComputedRef<ICalendarCell[]>;
  /** Localised month/year header (e.g. "May 2026"). */
  monthLabel: ComputedRef<string>;
  moveFocus: (days: number) => void;
  moveFocusByMonths: (months: number) => void;
  nextMonth: () => void;
  nextYear: () => void;
  previousMonth: () => void;
  previousYear: () => void;
  selectDate: (date: ICalendarDate) => void;
  /** Live snapshot of the engine state. */
  state: ShallowRef<ICalendarState>;
  /** Localised weekday headers (length 7). */
  weekdayLabels: ComputedRef<string[]>;
}

/**
 * Bridges the vanilla {@link CalendarEngine} to Vue's reactivity system.
 *
 * The engine emits a fresh snapshot on every mutation, so a single `shallowRef` is enough — assigning a new reference into it triggers reactivity without needing per-field refs or `triggerRef`.
 * This keeps Vue out of the engine entirely (no proxy traps inside the domain layer) and keeps the reactive graph dead-simple.
 */
export function useCalendar(
  optionsOrEngine: ICalendarEngineOptions | CalendarEngine = {},
): IUseCalendarReturn {
  const engine = optionsOrEngine instanceof CalendarEngine ? optionsOrEngine : new CalendarEngine(optionsOrEngine);

  const state = shallowRef<ICalendarState>(engine.getState());

  const unsubscribe = engine.subscribe((next) => {
    state.value = next;
  });

  onScopeDispose(unsubscribe);

  return {
    clearSelection: () => engine.clearSelection(),
    engine,
    focusFirstOfMonth: () => engine.focusFirstOfMonth(),
    focusLastOfMonth: () => engine.focusLastOfMonth(),
    goToToday: () => engine.goToToday(),
    grid: computed(() => {
      // Touch state so Vue tracks dependency even though `getGrid` reads directly from the engine.
      void state.value;
      return engine.getGrid();
    }),
    monthLabel: computed(() => {
      void state.value;
      return `${engine.getMonthLabel()} ${state.value.viewYear}`;
    }),
    moveFocus: (days) => engine.moveFocus(days),
    moveFocusByMonths: (months) => engine.moveFocusByMonths(months),
    nextMonth: () => engine.nextMonth(),
    nextYear: () => engine.nextYear(),
    previousMonth: () => engine.previousMonth(),
    previousYear: () => engine.previousYear(),
    selectDate: (date) => engine.selectDate(date),
    state,
    weekdayLabels: computed(() => engine.getWeekdayLabels()),
  };
}
