import { type VueWrapper, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DatePicker from '../date-picker.vue';
import type { ICalendarDate } from '../engine';
import { nextTick } from 'vue';

const FIXED_TODAY = new Date('2024-05-18T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

function mountPicker(props: Record<string, unknown> = {}) {
  return mount(DatePicker, {
    attachTo: document.body,
    props: {
      label: 'Date',
      ...props,
    },
  });
}

async function openPopover(wrapper: VueWrapper) {
  await wrapper.find('input').trigger('click');
  await nextTick();
}

function isPopoverOpen(wrapper: VueWrapper): boolean {
  const popover = wrapper.find('.date-picker__popover').element as HTMLElement;
  return popover.style.display !== 'none';
}

function lastModelValue(wrapper: VueWrapper): ICalendarDate | null | undefined {
  const emitted = wrapper.emitted('update:modelValue');
  return emitted?.[emitted.length - 1]?.[0] as ICalendarDate | null | undefined;
}

describe('DatePicker — rendering', () => {
  it('renders an input with the provided label and placeholder', () => {
    const wrapper = mountPicker({ label: 'Birthday', placeholder: 'pick one' });
    expect(wrapper.find('.date-picker__label').text()).toBe('Birthday');
    expect(wrapper.find('input').attributes('placeholder')).toBe('pick one');
  });

  it('keeps the popover hidden by default', () => {
    const wrapper = mountPicker();
    expect(wrapper.find('.date-picker__popover').exists()).toBe(true);
    expect(isPopoverOpen(wrapper)).toBe(false);
  });

  it('opens the popover on focus and renders 42 day cells', async () => {
    const wrapper = mountPicker();
    await openPopover(wrapper);
    expect(isPopoverOpen(wrapper)).toBe(true);
    expect(wrapper.findAll('.date-picker__day')).toHaveLength(42);
  });

  it('renders the localised month/year header', async () => {
    const wrapper = mountPicker({ locale: 'en-US' });
    await openPopover(wrapper);
    expect(wrapper.find('.date-picker__title').text()).toMatch(/May 2024/);
  });

  it('marks today and renders 7 weekday headers', async () => {
    const wrapper = mountPicker();
    await openPopover(wrapper);
    expect(wrapper.findAll('.date-picker__weekday')).toHaveLength(7);
    expect(wrapper.findAll('.date-picker__day--today').length).toBeGreaterThan(0);
  });
});

describe('DatePicker — selection', () => {
  it('selects a day on click and closes the popover', async () => {
    const wrapper = mountPicker();
    await openPopover(wrapper);

    const cells = wrapper.findAll('.date-picker__day');
    // Find a cell labelled "20" inside the current month.
    const target = cells.find(
      (c) =>
        c.text() === '20' && !c.classes().includes('date-picker__day--outside'),
    );
    expect(target).toBeDefined();
    await target!.trigger('click');
    await nextTick();

    expect(lastModelValue(wrapper)).toEqual({ day: 20, month: 5, year: 2024 });
    expect(isPopoverOpen(wrapper)).toBe(false);
  });

  it('reflects an externally-updated v-model in the input', async () => {
    const wrapper = mountPicker({ modelValue: { day: 18, month: 5, year: 2024 } });
    expect((wrapper.find('input').element as HTMLInputElement).value).toMatch(/May/);

    await wrapper.setProps({ modelValue: { day: 1, month: 1, year: 2025 } });
    expect((wrapper.find('input').element as HTMLInputElement).value).toMatch(/Jan/);
  });

  it('clears the selection via the clear button', async () => {
    const wrapper = mountPicker({ modelValue: { day: 18, month: 5, year: 2024 } });
    const clear = wrapper.find('.date-picker__clear');
    expect(clear.exists()).toBe(true);
    await clear.trigger('click');
    await nextTick();
    expect(lastModelValue(wrapper)).toBeNull();
  });

  it('accepts ISO input typed directly into the field', async () => {
    const wrapper = mountPicker();
    const input = wrapper.find('input');
    await input.setValue('2024-07-04');
    await input.trigger('change');
    await nextTick();
    expect(lastModelValue(wrapper)).toEqual({ day: 4, month: 7, year: 2024 });
  });

  it('rejects invalid free-form input by reverting the field', async () => {
    const wrapper = mountPicker({ modelValue: { day: 18, month: 5, year: 2024 } });
    const input = wrapper.find('input');
    await input.setValue('garbage');
    await input.trigger('change');
    await nextTick();
    expect((input.element as HTMLInputElement).value).toMatch(/May/);
  });
});

describe('DatePicker — navigation buttons', () => {
  it('navigates to the next and previous months', async () => {
    const wrapper = mountPicker();
    await openPopover(wrapper);

    await wrapper.find('.date-picker__nav--next').trigger('click');
    expect(wrapper.find('.date-picker__title').text()).toMatch(/June/);

    await wrapper.find('.date-picker__nav--prev').trigger('click');
    await wrapper.find('.date-picker__nav--prev').trigger('click');
    expect(wrapper.find('.date-picker__title').text()).toMatch(/April/);
  });
});

describe('DatePicker — keyboard navigation', () => {
  it('opens with ArrowDown and selects the focused cell with Enter', async () => {
    const wrapper = mountPicker();
    const input = wrapper.find('input');
    await input.trigger('keydown', { key: 'ArrowDown' });
    await nextTick();
    expect(isPopoverOpen(wrapper)).toBe(true);

    // The popover initial focus is on today (the 18th).
    const popover = wrapper.find('.date-picker__popover');
    await popover.trigger('keydown', { key: 'ArrowRight' });
    await nextTick();
    await popover.trigger('keydown', { key: 'Enter' });
    await nextTick();

    expect(lastModelValue(wrapper)).toEqual({ day: 19, month: 5, year: 2024 });
  });

  it('closes the popover on Escape', async () => {
    const wrapper = mountPicker();
    await openPopover(wrapper);
    await wrapper.find('.date-picker__popover').trigger('keydown', { key: 'Escape' });
    await nextTick();
    expect(isPopoverOpen(wrapper)).toBe(false);
  });

  it('PageUp/PageDown advance by month, Shift extends to year', async () => {
    const wrapper = mountPicker();
    await openPopover(wrapper);
    const popover = wrapper.find('.date-picker__popover');

    await popover.trigger('keydown', { key: 'PageDown' });
    expect(wrapper.find('.date-picker__title').text()).toMatch(/June/);

    await popover.trigger('keydown', { key: 'PageDown', shiftKey: true });
    expect(wrapper.find('.date-picker__title').text()).toMatch(/2025/);

    await popover.trigger('keydown', { key: 'PageUp', shiftKey: true });
    expect(wrapper.find('.date-picker__title').text()).toMatch(/2024/);
  });

  it('Home and End jump to first/last day of month', async () => {
    const wrapper = mountPicker();
    await openPopover(wrapper);
    const popover = wrapper.find('.date-picker__popover');

    await popover.trigger('keydown', { key: 'Home' });
    await popover.trigger('keydown', { key: 'Enter' });
    expect(lastModelValue(wrapper)).toEqual({ day: 1, month: 5, year: 2024 });

    await openPopover(wrapper);
    await popover.trigger('keydown', { key: 'End' });
    await popover.trigger('keydown', { key: 'Enter' });
    expect(lastModelValue(wrapper)).toEqual({ day: 31, month: 5, year: 2024 });
  });

  it('Tab closes the popover without trapping focus', async () => {
    const wrapper = mountPicker();
    await openPopover(wrapper);
    await wrapper.find('.date-picker__popover').trigger('keydown', { key: 'Tab' });
    await nextTick();
    expect(isPopoverOpen(wrapper)).toBe(false);
  });
});

describe('DatePicker — outside click', () => {
  it('closes the popover when the user clicks outside', async () => {
    const wrapper = mountPicker();
    await openPopover(wrapper);

    const outside = document.createElement('div');
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await nextTick();

    expect(isPopoverOpen(wrapper)).toBe(false);
    document.body.removeChild(outside);
  });
});

describe('DatePicker — bounds & accessibility', () => {
  it('disables cells outside [minDate, maxDate]', async () => {
    const wrapper = mountPicker({
      maxDate: { day: 25, month: 5, year: 2024 },
      minDate: { day: 10, month: 5, year: 2024 },
    });
    await openPopover(wrapper);
    const disabled = wrapper.findAll('.date-picker__day--disabled');
    expect(disabled.length).toBeGreaterThan(0);
    // Confirms day 5 (before min) is disabled.
    const fifth = wrapper
      .findAll('.date-picker__day')
      .find((c) => c.text() === '5' && !c.classes().includes('date-picker__day--outside'));
    expect(fifth?.classes()).toContain('date-picker__day--disabled');
  });

  it('arrow keys cannot cross the maxDate boundary', async () => {
    const wrapper = mountPicker({
      maxDate: { day: 25, month: 5, year: 2024 },
      minDate: { day: 10, month: 5, year: 2024 },
      modelValue: { day: 24, month: 5, year: 2024 },
    });
    await openPopover(wrapper);
    const popover = wrapper.find('.date-picker__popover');

    // 24 → 25 is allowed.
    await popover.trigger('keydown', { key: 'ArrowRight' });
    await nextTick();
    let focused = wrapper.find('.date-picker__day[tabindex="0"]');
    expect(focused.attributes('aria-label')).toMatch(/25/);

    // Try to push past the max — every subsequent ArrowRight must be a no-op.
    for (let i = 0; i < 10; i++) {
      await popover.trigger('keydown', { key: 'ArrowRight' });
    }
    await nextTick();
    focused = wrapper.find('.date-picker__day[tabindex="0"]');
    expect(focused.attributes('aria-label')).toMatch(/25/);

    // PageDown would jump to June — also blocked.
    await popover.trigger('keydown', { key: 'PageDown' });
    await nextTick();
    expect(wrapper.find('.date-picker__title').text()).toMatch(/May 2024/);
  });

  it('arrow keys cannot cross the minDate boundary', async () => {
    const wrapper = mountPicker({
      maxDate: { day: 25, month: 5, year: 2024 },
      minDate: { day: 10, month: 5, year: 2024 },
      modelValue: { day: 11, month: 5, year: 2024 },
    });
    await openPopover(wrapper);
    const popover = wrapper.find('.date-picker__popover');

    await popover.trigger('keydown', { key: 'ArrowLeft' });
    await nextTick();
    let focused = wrapper.find('.date-picker__day[tabindex="0"]');
    expect(focused.attributes('aria-label')).toMatch(/10/);

    await popover.trigger('keydown', { key: 'ArrowLeft' });
    await popover.trigger('keydown', { key: 'ArrowUp' });
    await nextTick();
    focused = wrapper.find('.date-picker__day[tabindex="0"]');
    expect(focused.attributes('aria-label')).toMatch(/10/);
  });

  it('exposes ARIA wiring on the popover', async () => {
    const wrapper = mountPicker();
    await openPopover(wrapper);
    const popover = wrapper.find('.date-picker__popover');
    expect(popover.attributes('role')).toBe('dialog');
    expect(wrapper.find('input').attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('input').attributes('aria-haspopup')).toBe('dialog');

    const focused = wrapper.find('.date-picker__day[tabindex="0"]');
    expect(focused.exists()).toBe(true);
    expect(focused.attributes('aria-label')).toMatch(/Saturday/);
  });

  it('respects the disabled prop', async () => {
    const wrapper = mountPicker({ disabled: true });
    await openPopover(wrapper);
    expect(isPopoverOpen(wrapper)).toBe(false);
    expect(wrapper.find('input').attributes('disabled')).toBeDefined();
  });
});
