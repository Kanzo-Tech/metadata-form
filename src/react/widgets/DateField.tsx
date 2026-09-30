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
  parseDateTime as toCalendarDateTime,
  type DateValue,
} from "@kanzo-tech/ui";
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
 * `xsd:dateTime` is the picker's own date-and-time field (`granularity="minute"`):
 * one segmented input you can type into, and a `DatePickerTimer` under the calendar.
 * The picker holds minutes; what is committed is always a valid lexical form of the
 * datatype (`form/dateTime`): seconds are there, a date picked with no time is
 * midnight, and the zone and the seconds of a stored value are kept until the
 * minute they belong to is changed.
 */

/** A stored value the picker cannot parse must leave the calendar empty, never
 *  throw: one bad row would otherwise take down the whole form. */
function toDateValues(iso: string, time?: string): DateValue[] {
  if (!iso) return [];
  try {
    return [time === undefined ? parseDate(iso) : toCalendarDateTime(`${iso}T${time.slice(0, 5) || "00:00"}`)];
  } catch {
    return [];
  }
}

export function makeDateField(withTime: boolean) {
  return function DateField(p: WidgetProps) {
    const parts = parseDateTime(p.value ?? "") ?? { date: "", time: "", zone: "" };
    const { chrome } = useStrings();

    // The picker's value is `YYYY-MM-DD` or `YYYY-MM-DDThh:mm[:ss]`. Only the
    // minute comes back from the time field, so the stored seconds (and fraction)
    // are kept while the minute they follow is unchanged.
    const commit = (picked: string) => {
      if (!picked) return p.onChange(null);
      const date = picked.slice(0, 10);
      const time = picked.slice(11, 16);
      const next = { ...parts, date, time: time === parts.time.slice(0, 5) ? parts.time : time };
      p.onChange(withTime ? formatDateTime(next) : formatDate(next));
    };

    return (
      <DatePicker
        granularity={withTime ? "minute" : undefined}
        value={toDateValues(parts.date, withTime ? parts.time : undefined)}
        onValueChange={(d) => commit(d.value[0]?.toString() ?? "")}
        positioning={{ placement: "bottom-end" }}
      >
        <DatePickerInput aria-label={p.label} />
        {/* A column with a gap: the content gives its children no spacing of its own,
            and the timer under the calendar sat flush against its last week. */}
        <DatePickerContent className="flex flex-col gap-3">
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
          {withTime && <DatePickerTimer aria-label={chrome.time} />}
        </DatePickerContent>
      </DatePicker>
    );
  };
}
