import type { ComponentType, ReactNode } from "react";
import { Button } from "@kanzo-tech/ui";
import { XIcon } from "lucide-react";

/**
 * A panel's own header: what the panel is, a control that governs its document,
 * and a way to close it. `h-9` — the same height as the page header's row.
 *
 * Adapted from the design system's showcases, and it carries their rule about
 * where a control belongs: `actions` is for something that acts on **this
 * panel's document** — the shape and data pickers replace what Source is
 * showing, so they sit here against it. A control that acts on the whole page
 * (Share, the validation tally, the panel toggles) stays in the page header.
 */
export function PaneHeader({
  actions,
  detail,
  icon: Icon,
  onClose,
  title,
}: {
  actions?: ReactNode;
  detail?: string;
  icon: ComponentType<{ "aria-hidden"?: boolean; className?: string }>;
  onClose?: () => void;
  title: string;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
      <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="shrink-0 font-medium text-xs">{title}</span>
      {actions}
      <span className="ms-auto flex min-w-0 items-center gap-1.5">
        {detail ? (
          <span className="truncate text-muted-foreground text-xs" title={detail}>
            {detail}
          </span>
        ) : null}
        {onClose ? (
          <Button
            aria-label={`Close ${title}`}
            className="size-6 shrink-0 text-muted-foreground"
            onClick={onClose}
            size="icon-sm"
            variant="ghost"
          >
            <XIcon />
          </Button>
        ) : null}
      </span>
    </div>
  );
}
