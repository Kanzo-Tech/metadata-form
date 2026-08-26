import { useState } from "react";
import { useField as useArkField } from "@kanzo-tech/ui";
import { Box, Button, Flex, Grid, IconButton, Popover, Text, TextField } from "@radix-ui/themes";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import type { WidgetProps } from "./widgets.js";

/**
 * A canonical date / datetime widget: a Radix TextField with a trailing
 * calendar button (always flush at the end) that opens a month calendar in a
 * Popover. No native `<input type=date>` quirks. Value is the ISO string
 * (`YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` with time).
 */

interface Ymd {
  y: number;
  m: number; // 0-based
  d: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (p: Ymd) => `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;

function parseValue(value: string | null): { date: Ymd | null; time: string } {
  if (!value) return { date: null, time: "" };
  const [datePart, timePart = ""] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  return { date: y ? { y, m: (m || 1) - 1, d: d || 1 } : null, time: timePart.slice(0, 5) };
}

function todayYmd(): Ymd {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
}

function shiftMonth(v: { y: number; m: number }, delta: number) {
  const total = v.y * 12 + v.m + delta;
  return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function Calendar({ selected, onPick }: { selected: Ymd | null; onPick: (p: Ymd) => void }) {
  const base = selected ?? todayYmd();
  const [view, setView] = useState({ y: base.y, m: base.m });

  const firstDow = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const monthLabel = new Date(view.y, view.m, 1).toLocaleString(undefined, { month: "long", year: "numeric" });

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isSelected = (d: number) =>
    !!selected && selected.y === view.y && selected.m === view.m && selected.d === d;

  return (
    <Flex direction="column" gap="2" style={{ width: 232 }}>
      <Flex justify="between" align="center">
        <IconButton variant="ghost" color="gray" size="1" aria-label="Previous month" onClick={() => setView((v) => shiftMonth(v, -1))}>
          <ChevronLeftIcon />
        </IconButton>
        <Text size="2" weight="medium">
          {monthLabel}
        </Text>
        <IconButton variant="ghost" color="gray" size="1" aria-label="Next month" onClick={() => setView((v) => shiftMonth(v, 1))}>
          <ChevronRightIcon />
        </IconButton>
      </Flex>
      <Grid columns="7" gap="1" align="center">
        {WEEKDAYS.map((w, i) => (
          <Text key={i} size="1" align="center" color="gray">
            {w}
          </Text>
        ))}
        {cells.map((d, i) =>
          d === null ? (
            <Box key={i} />
          ) : (
            <Button
              key={i}
              size="1"
              variant={isSelected(d) ? "solid" : "ghost"}
              color={isSelected(d) ? undefined : "gray"}
              onClick={() => onPick({ y: view.y, m: view.m, d })}
              style={{ minWidth: 0 }}
            >
              {d}
            </Button>
          ),
        )}
      </Grid>
    </Flex>
  );
}

export function makeDateField(withTime: boolean) {
  return function DateField(p: WidgetProps) {
    // Ark's Field owns these; outside a Field the context is absent and the
    // widget is simply enabled and valid. Temporary — this file is being
    // replaced by the design system's own control.
    const arkField = useArkField();
    const disabled = arkField?.disabled ?? false;
    const invalid = arkField?.invalid ?? false;
    const [open, setOpen] = useState(false);
    const { date, time } = parseValue(p.value);

    const commit = (nextDate: Ymd | null, nextTime: string) => {
      if (!nextDate) {
        p.onChange(null);
        return;
      }
      p.onChange(withTime ? `${fmtDate(nextDate)}T${nextTime || "00:00"}` : fmtDate(nextDate));
    };

    return (
      <TextField.Root
        style={{ flex: 1, width: "100%" }}
        value={p.value ?? ""}
        placeholder={withTime ? "YYYY-MM-DDTHH:mm" : "YYYY-MM-DD"}
        readOnly
        disabled={disabled}
        color={invalid ? "red" : undefined}
      >
        <TextField.Slot side="right">
          <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger>
              <IconButton variant="ghost" color="gray" size="1" disabled={disabled} aria-label="Open calendar">
                <CalendarIcon />
              </IconButton>
            </Popover.Trigger>
            <Popover.Content size="1">
              <Flex direction="column" gap="3">
                <Calendar
                  selected={date}
                  onPick={(d) => {
                    commit(d, time);
                    if (!withTime) setOpen(false);
                  }}
                />
                {withTime && (
                  <Flex align="center" gap="2">
                    <Text size="1" color="gray">
                      Time
                    </Text>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => commit(date ?? todayYmd(), e.target.value)}
                      style={{ flex: 1 }}
                    />
                  </Flex>
                )}
                <Flex justify="between">
                  <Button variant="soft" color="gray" size="1" onClick={() => commit(null, "")}>
                    Clear
                  </Button>
                  <Button
                    variant="soft"
                    size="1"
                    onClick={() => {
                      commit(todayYmd(), time);
                      if (!withTime) setOpen(false);
                    }}
                  >
                    Today
                  </Button>
                </Flex>
              </Flex>
            </Popover.Content>
          </Popover.Root>
        </TextField.Slot>
      </TextField.Root>
    );
  };
}
