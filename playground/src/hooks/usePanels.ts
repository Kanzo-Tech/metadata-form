import { useCallback, useEffect, useMemo, useState } from "react";

/** One side panel: shown or not, and how to flip it. */
export interface Panel {
  show: boolean;
  toggle: () => void;
}

/** The panels this workspace has. Adding one is adding a member here. */
export type PanelId = "source" | "output";

const IDS: PanelId[] = ["source", "output"];

/**
 * The side panels as one state machine.
 *
 * Visibility only. Width used to live here too, alongside a slide-presence hook
 * that kept an aside mounted through its own close animation — all of it now the
 * splitter's and the aside's, so what is left is the single decision neither of
 * them can make: on a narrow viewport the panels are mutually exclusive (opening
 * one closes the others), and crossing into narrow collapses them all.
 *
 * A set rather than three booleans, because the rail reads them as one value and
 * the third panel would otherwise have been the third copy of the same three
 * lines of mutual exclusion.
 */
export function usePanels(opts: { narrow: boolean }): {
  panels: Record<PanelId, Panel>;
  /** The open ids, as the rail's `ToggleGroup` wants them. */
  open: PanelId[];
  /** Apply the rail's whole next value at once. */
  setOpen: (next: string[]) => void;
} {
  const { narrow } = opts;
  const [open, setOpenState] = useState<PanelId[]>([]);

  // Crossing into a narrow viewport collapses everything to form-only.
  useEffect(() => {
    if (narrow) setOpenState([]);
  }, [narrow]);

  const setOpen = useCallback(
    (next: string[]) => {
      const ids = IDS.filter((id) => next.includes(id));
      setOpenState((prev) => {
        if (!narrow) return ids;
        // Narrow: at most one, and it is the one that just arrived.
        const opened = ids.find((id) => !prev.includes(id));
        return opened ? [opened] : ids.slice(0, 1);
      });
    },
    [narrow],
  );

  const panels = useMemo(
    () =>
      Object.fromEntries(
        IDS.map((id) => [
          id,
          {
            show: open.includes(id),
            toggle: () => setOpen(open.includes(id) ? open.filter((o) => o !== id) : [...open, id]),
          },
        ]),
      ) as Record<PanelId, Panel>,
    [open, setOpen],
  );

  return { panels, open, setOpen };
}
