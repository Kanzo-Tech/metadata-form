import type { ComponentType, ReactNode } from "react";
import { Button } from "@kanzo-tech/ui";
import { XIcon } from "lucide-react";
import { fill, useChrome } from "../i18n.js";

/**
 * A panel's own header: what the panel is, whatever governs its document, and a
 * way to close it. `h-9` — the same height as the page header's row.
 *
 * `children` is for something that acts on **this panel's document**: the tabs
 * that choose which one it shows, the button that downloads it. A control that
 * acts on the whole page (the example, Share, the validation tally) stays in the
 * page header — which is also why this carries no count of its own: the tally is
 * one number, and it is already up there.
 */
export function PaneHeader({
  children,
  icon: Icon,
  onClose,
  title,
}: {
  children?: ReactNode;
  // `size` rather than a `size-3.5` class: that class is not in the design
  // system's sheet, and every icon we pass here is a lucide component, which
  // takes the number directly.
  icon: ComponentType<{ "aria-hidden"?: boolean; className?: string; size?: number }>;
  onClose?: () => void;
  title: string;
}) {
  // `title` arrives already translated (it is the pane's name); the sentence built
  // around it for the close button is this component's, so it is resolved here.
  const chrome = useChrome();
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
      <Icon aria-hidden size={14} className="shrink-0 text-muted-foreground" />
      <span className="shrink-0 font-medium text-xs">{title}</span>
      {children}
      {onClose ? (
        <Button
          aria-label={fill(chrome.panes.close, { pane: title })}
          className="ms-auto size-6 shrink-0 text-muted-foreground"
          onClick={onClose}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  );
}
