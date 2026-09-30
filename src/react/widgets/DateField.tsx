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
 * than a second machine. `null` for either half means the value is not a dateTime
 * yet, and midnight is the only defensible completion of a date the user did pick.
 */

const splitIso = (iso: string | null) => {
  const [date = "", time = ""] = (iso ?? "").split("T");
  return { date, time: time.slice(0, 5) };
};

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
    const { date, time } = splitIso(p.value);
    const { chrome } = useStrings();
    const timeId = useId();

    const commit = (nextDate: string, nextTime: string) => {
      if (!nextDate) return p.onChange(null);
      p.onChange(withTime ? `${nextDate}T${nextTime || "00:00"}` : nextDate);
    };

    const picker = (
      <DatePicker
        className="flex-1"
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
      <div className="flex gap-2">
        {picker}
        <label className="sr-only" htmlFor={timeId}>
          {chrome.time}
        </label>
        <DatePickerTimer
          className="w-32"
          id={timeId}
          value={time}
          onChange={(e) => commit(date, e.target.value)}
        />
      </div>
    );
  };
}
