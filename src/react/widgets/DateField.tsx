import {
  CalendarMonthSelect,
  CalendarNextTrigger,
  CalendarPrevTrigger,
  CalendarTable,
  CalendarTableDays,
  CalendarView,
  CalendarViewControl,
  CalendarWeekDays,
  CalendarYearSelect,
  DatePicker,
  DatePickerContent,
  DatePickerInput,
  DatePickerTimer,
  parseDate,
  type DateValue,
} from "@kanzo-tech/ui";
import { useId } from "react";
import { formatDate, formatDateTime, parseDateTime } from "../../form/dateTime.js";
import { useStrings } from "../form/context.js";
import type { WidgetProps } from "./widgets.js";

/**
 * `xsd:date` / `xsd:dateTime` over the design system's date picker.
 *
 * The picker speaks Ark's `DateValue`; RDF, like every JSON body and database
 * column, speaks a plain ISO string. That adapter is these two directions and
 * belongs here, at the seam — reading one out is free (`onValueChange` hands over
 * both representations), and putting a *stored* one back is the half that costs
 * anything.
 *
 * The picker is date-only, so `xsd:dateTime` is a date plus `DatePickerTimer` rather
 * than a second machine. What is committed is always a valid lexical form of the
 * datatype (`form/dateTime`): seconds are there, a date picked with no time is
 * midnight, and the zone of a stored value is kept.
 */

/** A stored value the picker cannot parse must leave the calendar empty, never
 *  throw: one bad row would otherwise take down the whole form. */
function toDateValues(iso: string): DateValue[] {
  if (!iso) return [];
  try {
    return [parseDate(iso)];
  } catch {
    return [];
  }
}

export function makeDateField(withTime: boolean) {
  return function DateField(p: WidgetProps) {
    const parts = parseDateTime(p.value ?? "") ?? { date: "", time: "", zone: "" };
    const { date, time } = parts;
    const { chrome } = useStrings();
    const timeId = useId();

    const commit = (nextDate: string, nextTime: string) => {
      if (!nextDate) return p.onChange(null);
      const next = { ...parts, date: nextDate, time: nextTime };
      p.onChange(withTime ? formatDateTime(next) : formatDate(next));
    };

    const picker = (
      <DatePicker
        className="min-w-0 flex-1"
        value={toDateValues(date)}
        onValueChange={(d) => commit(d.valueAsString[0] ?? "", time)}
        positioning={{ placement: "bottom-end" }}
      >
        <DatePickerInput />
        <DatePickerContent>
          <CalendarView view="day">
            <CalendarViewControl>
              <CalendarPrevTrigger />
              <CalendarMonthSelect />
              <CalendarYearSelect />
              <CalendarNextTrigger />
            </CalendarViewControl>
            <CalendarTable>
              <CalendarWeekDays />
              <CalendarTableDays />
            </CalendarTable>
          </CalendarView>
        </DatePickerContent>
      </DatePicker>
    );
    if (!withTime) return picker;

    return (
      <div className="flex items-center gap-2">
        {picker}
        <label className="sr-only" htmlFor={timeId}>
          {chrome.time}
        </label>
        <DatePickerTimer
          className="w-auto shrink-0"
          id={timeId}
          value={time}
          onChange={(e) => commit(date, e.target.value)}
        />
      </div>
    );
  };
}
