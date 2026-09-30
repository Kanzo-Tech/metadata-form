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
  Input,
  parseDate,
  useField,
  type DateValue,
} from "@kanzo-tech/ui";
import type { WidgetProps } from "./widgets.js";
import { grow, row } from "../styles.js";

/**
 * `xsd:date` / `xsd:dateTime` over the design system's date picker.
 *
 * The picker speaks Ark's `DateValue`; RDF, like every JSON body and database
 * column, speaks a plain ISO string. That adapter is these two directions and
 * belongs here, at the seam — reading one out is free (`onValueChange` hands over
 * both representations), and putting a *stored* one back is the half that costs
 * anything.
 *
 * The picker is date-only, so `xsd:dateTime` is a date plus a time input rather
 * than a second machine. `null` for either half means the value is not a dateTime
 * yet, and midnight is the only defensible completion of a date the user did pick.
 *
 * **The one widget here that threads `disabled`/`invalid` by hand.** Ark's date
 * picker reads no `Field` context (`use-date-picker.js` takes only environment and
 * locale), so a `Field disabled` left the calendar fully interactive: the input
 * greyed, the popover still opened, and a click still wrote a value. Its machine
 * has the props; nothing was handing them over. Read them from the same context
 * `Field` publishes so the accessible state and the painted one still cannot drift.
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
    const field = useField();

    const commit = (nextDate: string, nextTime: string) => {
      if (!nextDate) return p.onChange(null);
      p.onChange(withTime ? `${nextDate}T${nextTime || "00:00"}` : nextDate);
    };

    return (
      <div style={{ ...row, ...grow }}>
        <DatePicker
          style={{ flex: 1 }}
          value={toDateValues(date)}
          onValueChange={(d) => commit(d.valueAsString[0] ?? "", time)}
          positioning={{ placement: "bottom-end" }}
          disabled={field?.disabled}
          readOnly={field?.readOnly}
          invalid={field?.invalid}
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
        {withTime && (
          <Input
            style={{ width: "8rem" }}
            type="time"
            value={time}
            onChange={(e) => commit(date, e.target.value)}
          />
        )}
      </div>
    );
  };
}
