import { defineComponent, h, nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import { CalendarEngine } from '../engine';
import type { ICalendarDate } from '../engine';
import { mount } from '@vue/test-utils';
import { useCalendar } from '../use-calendar';

const FIXED_TODAY: ICalendarDate = { day: 18, month: 5, year: 2024 };
const now = () => FIXED_TODAY;

/**
 * Hosts the composable inside a real component so Vue's reactivity (and
 * lifecycle hooks like `onScopeDispose`) behave exactly as in production.
 */
function harness<T>(setup: () => T) {
  let api!: T;
  const Host = defineComponent({
    setup() {
      api = setup();
      return () => h('div');
    },
  });
  const wrapper = mount(Host);
  return { api, wrapper };
}

describe('useCalendar', () => {
  it('exposes reactive state, grid, and labels', () => {
    const { api } = harness(() => useCalendar({ initialSelected: FIXED_TODAY, now }));

    expect(api.state.value.viewMonth).toBe(5);
    expect(api.grid.value.length).toBe(42);
    expect(api.monthLabel.value).toMatch(/May/);
    expect(api.weekdayLabels.value.length).toBe(7);
  });

  it('reacts to engine mutations via the exposed methods', async () => {
    const { api } = harness(() => useCalendar({ now }));

    api.nextMonth();
    await nextTick();
    expect(api.state.value.viewMonth).toBe(6);
    expect(api.monthLabel.value).toMatch(/June/);

    api.previousMonth();
    api.previousMonth();
    await nextTick();
    expect(api.state.value.viewMonth).toBe(4);

    api.nextYear();
    await nextTick();
    expect(api.state.value.viewYear).toBe(2025);

    api.previousYear();
    api.goToToday();
    await nextTick();
    expect(api.state.value).toMatchObject({ viewMonth: 5, viewYear: 2024 });

    api.selectDate({ day: 1, month: 8, year: 2024 });
    await nextTick();
    expect(api.state.value.selected).toEqual({ day: 1, month: 8, year: 2024 });

    api.clearSelection();
    await nextTick();
    expect(api.state.value.selected).toBeNull();
  });

  it('drives focus movement reactively', async () => {
    const { api } = harness(() => useCalendar({ initialSelected: FIXED_TODAY, now }));

    api.moveFocus(1);
    await nextTick();
    expect(api.state.value.focused).toEqual({ day: 19, month: 5, year: 2024 });

    api.moveFocusByMonths(1);
    await nextTick();
    expect(api.state.value.focused.month).toBe(6);

    api.focusFirstOfMonth();
    await nextTick();
    expect(api.state.value.focused.day).toBe(1);

    api.focusLastOfMonth();
    await nextTick();
    expect(api.state.value.focused.day).toBe(30);
  });

  it('accepts an existing engine instance', () => {
    const engine = new CalendarEngine({ now });
    const { api } = harness(() => useCalendar(engine));
    expect(api.engine).toBe(engine);
  });

  it('unsubscribes when the component unmounts', () => {
    const engine = new CalendarEngine({ now });
    const { wrapper } = harness(() => useCalendar(engine));
    // After unmount, mutating the engine should not throw or leak.
    wrapper.unmount();
    expect(() => engine.nextMonth()).not.toThrow();
  });
});
