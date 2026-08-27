import type { ComponentType } from "react";
import { ShellAside, ToggleGroup, ToggleGroupItem } from "@kanzo-tech/ui";

/** One switch on the rail: which panel it opens, and how it is drawn and named. */
export interface RailPanel {
  icon: ComponentType<{ "aria-hidden"?: boolean; size?: number }>;
  /** The accessible name, and the tooltip — the keyboard hint rides in it. */
  label: string;
  value: string;
}

/**
 * The activity rail — which panels are open, drawn as icons on the edge they open on.
 *
 * Taken from the design system's own showcases, **including the trap its docblock
 * records**: a `ToggleGroup` is a CONTROL, so its recipe carries `w-fit` and
 * `rounded-lg`, and used as a region it brings that 8px radius with it — the rail's
 * top corner curls away from the header's border and leaves a step that reads as a
 * second border. The region is `ShellAside`'s job, which is what its own docblock
 * names a dock as; the group goes inside and is told to stop rounding.
 *
 * `multiple`, because the panels are independent — on a narrow viewport they are
 * not, and that rule lives in `usePanels`, which is the only place that knows the
 * width.
 *
 * The padding is inline: `px-1.5` is not in the compiled sheet. `py-2` is, but a
 * strip whose two paddings are written in two vocabularies is a strip nobody can
 * adjust without checking both.
 */
export function PanelRail({
  label,
  onValueChange,
  panels,
  side = "start",
  value,
}: {
  label: string;
  onValueChange: (value: string[]) => void;
  panels: RailPanel[];
  side?: "start" | "end";
  value: string[];
}) {
  return (
    <ShellAside aria-label={label} className="shrink-0 bg-card" side={side}>
      <ToggleGroup
        className="rounded-none"
        multiple
        onValueChange={(d) => onValueChange(d.value)}
        orientation="vertical"
        size="sm"
        spacing={2}
        style={{ paddingInline: "0.375rem", paddingBlock: "0.5rem" }}
        value={value}
      >
        {panels.map((panel) => (
          <ToggleGroupItem aria-label={panel.label} key={panel.value} title={panel.label} value={panel.value}>
            <panel.icon aria-hidden size={16} />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </ShellAside>
  );
}
