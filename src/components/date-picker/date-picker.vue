<script setup lang="ts">
import type { ICalendarCell, ICalendarDate } from './engine';
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import { formatDisplayDate, isSameDay, parseISODate } from './engine';
import { useCalendar } from './use-calendar';

const emit = defineEmits<{
  close: [];
  open: [];
}>();

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    /** Display format passed straight to `Intl.DateTimeFormat`. */
    displayFormat?: Intl.DateTimeFormatOptions;
    label?: string;
    locale?: string;
    maxDate?: ICalendarDate;
    minDate?: ICalendarDate;
    placeholder?: string;
  }>(),
  {
    disabled: false,
    displayFormat: () => ({ day: 'numeric', month: 'short', year: 'numeric' }),
    label: 'Date',
    locale: 'en-US',
    placeholder: 'Select a date',
  },
);

const modelValue = defineModel<ICalendarDate | null>({ default: null });

const {
  clearSelection,
  engine,
  focusFirstOfMonth,
  focusLastOfMonth,
  grid,
  monthLabel,
  moveFocus,
  moveFocusByMonths,
  nextMonth,
  previousMonth,
  selectDate,
  state,
  weekdayLabels,
} = useCalendar({
  initialSelected: modelValue.value,
  locale: props.locale,
  maxDate: props.maxDate,
  minDate: props.minDate,
});

const focusedCellEl = ref<HTMLButtonElement | null>(null);
const isOpen = ref(false);
const inputEl = ref<HTMLInputElement | null>(null);
const rootEl = ref<HTMLElement | null>(null);

const popoverId = useId() ?? `dp-${Math.random().toString(36).slice(2)}`;
const gridLabelId = `${popoverId}-grid-label`;

const displayValue = computed(() => {
  if (!modelValue.value) return '';
  return formatDisplayDate(modelValue.value, props.locale, props.displayFormat);
});

const inputValue = ref(displayValue.value);

watch(displayValue, (next) => {
  inputValue.value = next;
});

// Keep engine in sync with externally-mutated v-model.
watch(
  () => modelValue.value,
  (next) => {
    if (next && !isSameDay(next, state.value.selected)) {
      selectDate(next);
    } else if (!next && state.value.selected) {
      clearSelection();
    }
  },
);

// Emit selections from the engine back to v-model.
watch(
  () => state.value.selected,
  (next) => {
    if (!isSameDay(next, modelValue.value)) modelValue.value = next;
  },
);

function ariaLabelForCell(cell: ICalendarCell): string {
  return formatDisplayDate(cell.date, props.locale, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  });
}

function closePopover(returnFocus = true) {
  if (!isOpen.value) return;
  isOpen.value = false;
  emit('close');
  if (returnFocus) nextTick(() => inputEl.value?.focus());
}

function onCellClick(cell: ICalendarCell) {
  if (cell.isDisabled) return;
  selectDate(cell.date);
  closePopover();
}

function onCellRef(el: Element | null, cell: ICalendarCell) {
  if (cell.isFocused && el instanceof HTMLButtonElement) focusedCellEl.value = el;
}

function onDocumentMouseDown(event: MouseEvent) {
  if (!isOpen.value) return;
  const target = event.target as Node | null;
  if (!target) return;
  if (rootEl.value?.contains(target)) return;
  closePopover(false);
}

function onGridKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      moveFocus(-1);
      refocusCell();
      break;
    case 'ArrowRight':
      event.preventDefault();
      moveFocus(1);
      refocusCell();
      break;
    case 'ArrowUp':
      event.preventDefault();
      moveFocus(-7);
      refocusCell();
      break;
    case 'ArrowDown':
      event.preventDefault();
      moveFocus(7);
      refocusCell();
      break;
    case 'PageUp':
      event.preventDefault();
      moveFocusByMonths(event.shiftKey ? -12 : -1);
      refocusCell();
      break;
    case 'PageDown':
      event.preventDefault();
      moveFocusByMonths(event.shiftKey ? 12 : 1);
      refocusCell();
      break;
    case 'Home':
      event.preventDefault();
      focusFirstOfMonth();
      refocusCell();
      break;
    case 'End':
      event.preventDefault();
      focusLastOfMonth();
      refocusCell();
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      selectDate(state.value.focused);
      closePopover();
      break;
    case 'Escape':
      event.preventDefault();
      closePopover();
      break;
    case 'Tab':
      // Allow Tab to escape the calendar trap naturally.
      closePopover(false);
      break;
  }
}

function onInputChange(event: Event) {
  const value = (event.target as HTMLInputElement).value.trim();
  if (value === '') {
    modelValue.value = null;
    return;
  }
  // Accept ISO 8601 input as a power-user escape hatch.
  const parsed = parseISODate(value);
  if (parsed) {
    selectDate(parsed);
  } else {
    inputValue.value = displayValue.value;
  }
}

function onInputKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
    case 'Enter':
    case ' ':
      event.preventDefault();
      openPopover();
      break;
    case 'Escape':
      if (isOpen.value) closePopover();
      break;
  }
}

function openPopover() {
  if (props.disabled || isOpen.value) return;
  // Anchor focus to current selection or today before opening.
  engine.setFocus(state.value.selected ?? state.value.today);
  isOpen.value = true;
  emit('open');
  nextTick(() => focusedCellEl.value?.focus());
}

function refocusCell() {
  nextTick(() => focusedCellEl.value?.focus());
}

function selectToday() {
  selectDate(state.value.today);
  closePopover();
}

if (typeof document !== 'undefined') {
  document.addEventListener('mousedown', onDocumentMouseDown);
  onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentMouseDown));
}

defineExpose({ close: closePopover, engine, open: openPopover });
</script>

<template>
  <div
    ref="rootEl"
    class="date-picker"
    :class="{ 'date-picker--disabled': disabled }"
  >
    <label
      :for="popoverId"
      class="date-picker__label"
    >
      {{ label }}
    </label>

    <div class="date-picker__field">
      <input
        :id="popoverId"
        ref="inputEl"
        v-model="inputValue"
        :aria-controls="`${popoverId}-popover`"
        :aria-expanded="isOpen"
        :aria-haspopup="'dialog'"
        :disabled="disabled"
        :placeholder="placeholder"
        autocomplete="off"
        class="date-picker__input"
        type="text"
        @click="openPopover"
        @keydown="onInputKeydown"
        @change="onInputChange"
      />

      <template v-if="modelValue && !disabled">
        <button
          aria-label="Clear date"
          class="date-picker__clear"
          tabindex="-1"
          type="button"
          @click="clearSelection"
          @mousedown.prevent
        >
          {{ '×' }}
        </button>
      </template>
    </div>

    <div
      v-show="isOpen"
      :id="`${popoverId}-popover`"
      :aria-labelledby="gridLabelId"
      class="date-picker__popover"
      role="dialog"
      @keydown="onGridKeydown"
    >
      <header class="date-picker__header">
        <button
          type="button"
          class="date-picker__nav date-picker__nav--prev"
          aria-label="Previous month"
          @click="previousMonth"
        >
          {{ '‹' }}
        </button>

        <span
          :id="gridLabelId"
          aria-live="polite"
          class="date-picker__title"
        >
          {{ monthLabel }}
        </span>

        <button
          aria-label="Next month"
          class="date-picker__nav date-picker__nav--next"
          type="button"
          @click="nextMonth"
        >
          {{ '›' }}
        </button>
      </header>

      <div
        class="date-picker__weekdays"
        role="row"
      >
        <template v-for="day in weekdayLabels" :key="day">
          <span
            class="date-picker__weekday"
            role="columnheader"
          >
            {{ day }}
          </span>
        </template>
      </div>

      <div
        :aria-labelledby="gridLabelId"
        class="date-picker__grid"
        role="grid"
      >
        <template v-for="cell in grid" :key="`${cell.date.year}-${cell.date.month}-${cell.date.day}`">
          <button
            :ref="(el) => onCellRef(el as Element | null, cell)"
            :class="{
              'date-picker__day--outside': !cell.isCurrentMonth,
              'date-picker__day--today': cell.isToday,
              'date-picker__day--selected': cell.isSelected,
              'date-picker__day--weekend': cell.isWeekend,
              'date-picker__day--disabled': cell.isDisabled,
            }"
            :aria-selected="cell.isSelected"
            :aria-disabled="cell.isDisabled"
            :aria-label="ariaLabelForCell(cell)"
            :tabindex="cell.isFocused ? 0 : -1"
            :disabled="cell.isDisabled"
            class="date-picker__day"
            role="gridcell"
            type="button"
            @click="onCellClick(cell)"
          >
            {{ cell.date.day }}
          </button>
        </template>
      </div>

      <footer class="date-picker__footer">
        <button
          class="date-picker__action"
          type="button"
          @click="selectToday"
        >
          Today
        </button>

        <button
          class="date-picker__action"
          type="button"
          @click="closePopover()"
        >
          Close
        </button>
      </footer>
    </div>
  </div>
</template>

<style>
.date-picker {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--ds-spacing-sm);
  width: 100%;
  font-family: var(--ds-font-family);
  color: var(--ds-color-text);
  font-size: var(--ds-font-size-md);
}

.date-picker--disabled {
  opacity: 0.6;
  pointer-events: none;
}

.date-picker__label {
  font-size: var(--ds-font-size-sm);
  color: var(--ds-color-text-muted);
  font-weight: 500;
}

.date-picker__field {
  position: relative;
  display: flex;
  align-items: center;
}

.date-picker__input {
  width: 100%;
  height: var(--ds-input-height);
  padding: 0 36px 0 12px;
  background: var(--ds-color-surface);
  color: var(--ds-color-text);
  font-family: inherit;
  font-size: inherit;
  border: 1px solid var(--ds-color-border);
  border-radius: var(--ds-radius-md);
  outline: none;
  transition:
    border-color var(--ds-transition),
    box-shadow var(--ds-transition);
}

.date-picker__input:hover {
  border-color: color-mix(in srgb, var(--ds-color-primary) 40%, var(--ds-color-border));
}

.date-picker__input:focus-visible {
  border-color: var(--ds-color-primary);
  box-shadow: 0 0 0 3px var(--ds-color-focus-ring);
}

.date-picker__clear {
  position: absolute;
  right: 8px;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--ds-color-text-muted);
  font-size: 1.25rem;
  line-height: 1;
  border-radius: 999px;
  cursor: pointer;
  transition:
    background-color var(--ds-transition),
    color var(--ds-transition);
}

.date-picker__clear:hover {
  background: var(--ds-color-hover);
  color: var(--ds-color-text);
}

.date-picker__popover {
  position: absolute;
  z-index: 50;
  top: calc(100% + 6px);
  left: 0;
  width: max-content;
  padding: var(--ds-spacing-md);
  background: var(--ds-color-surface);
  border: 1px solid var(--ds-color-border);
  border-radius: var(--ds-radius-md);
  box-shadow: var(--ds-shadow-md);
  display: flex;
  flex-direction: column;
  gap: var(--ds-spacing-sm);
}

.date-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ds-spacing-sm);
}

.date-picker__title {
  font-weight: 600;
  font-size: var(--ds-font-size-md);
  text-align: center;
  flex: 1;
}

.date-picker__nav {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--ds-radius-sm);
  color: var(--ds-color-text);
  font-size: 1.1rem;
  cursor: pointer;
  transition: background-color var(--ds-transition);
}

.date-picker__nav:hover {
  background: var(--ds-color-hover);
}

.date-picker__nav:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--ds-color-focus-ring);
}

.date-picker__weekdays,
.date-picker__grid {
  display: grid;
  grid-template-columns: repeat(7, var(--date-picker-cell-size));
  gap: 2px;
}

.date-picker__weekday {
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--ds-font-size-sm);
  color: var(--ds-color-text-muted);
  font-weight: 500;
}

.date-picker__day {
  width: var(--date-picker-cell-size);
  height: var(--date-picker-cell-size);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--ds-radius-sm);
  color: var(--ds-color-text);
  font-family: inherit;
  font-size: var(--ds-font-size-sm);
  cursor: pointer;
  transition:
    background-color var(--ds-transition),
    color var(--ds-transition),
    border-color var(--ds-transition);
}

.date-picker__day:hover:not(:disabled) {
  background: var(--ds-color-hover);
}

.date-picker__day:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--ds-color-focus-ring);
}

.date-picker__day--outside {
  color: var(--ds-color-text-muted);
}

.date-picker__day--weekend {
  color: color-mix(in srgb, var(--ds-color-text-muted) 80%, var(--ds-color-text));
}

.date-picker__day--today {
  border-color: var(--date-picker-color-today);
  font-weight: 600;
}

.date-picker__day--selected {
  background: var(--ds-color-primary);
  color: var(--ds-color-primary-contrast);
  border-color: var(--ds-color-primary);
}

.date-picker__day--selected:hover {
  background: var(--ds-color-primary);
}

.date-picker__day--disabled {
  color: var(--ds-color-disabled);
  cursor: not-allowed;
}

.date-picker__footer {
  display: flex;
  justify-content: space-between;
  gap: var(--ds-spacing-sm);
  margin-top: var(--ds-spacing-sm);
}

.date-picker__action {
  flex: 1;
  height: 32px;
  padding: 0 10px;
  background: var(--ds-color-primary-soft);
  color: var(--ds-color-primary);
  border: none;
  border-radius: var(--ds-radius-sm);
  font-family: inherit;
  font-size: var(--ds-font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--ds-transition);
}

.date-picker__action:hover {
  background: color-mix(in srgb, var(--ds-color-primary-soft) 70%, var(--ds-color-primary));
  color: var(--ds-color-primary-contrast);
}

.date-picker__action:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--ds-color-focus-ring);
}
</style>
