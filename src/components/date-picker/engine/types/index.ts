export interface ICalendarCell {
  readonly date: ICalendarDate;
  readonly isCurrentMonth: boolean;
  readonly isDisabled: boolean;
  readonly isFocused: boolean;
  readonly isSelected: boolean;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
}

export interface ICalendarDate {
  readonly day: number;
  readonly month: number;
  readonly year: number;
}

export interface ICalendarEngineOptions {
  initialSelected?: ICalendarDate | null;
  locale?: string;
  maxDate?: ICalendarDate;
  minDate?: ICalendarDate;
  now?: () => ICalendarDate;
}

export interface ICalendarState {
  readonly focused: ICalendarDate;
  readonly selected: ICalendarDate | null;
  readonly today: ICalendarDate;
  readonly viewMonth: number;
  readonly viewYear: number;
}

export type TListener = (state: ICalendarState) => void;

export type TUnsubscribe = () => void;

export type TWeekDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;
