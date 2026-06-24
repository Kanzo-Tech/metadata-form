import type { MouseEvent } from "react";
import { IconButton } from "@radix-ui/themes";
import { Cross2Icon } from "@radix-ui/react-icons";

/** The single ✕ control used across the whole UI — removing a repeatable field row,
 * dismissing a ✨ suggestion, closing the assistant or a panel — so the affordance looks
 * and behaves identically everywhere (ghost, gray, size 1, Radix's `Cross2Icon`). `label`
 * is the accessible name; `onClick` receives the event, so a control nested in a clickable
 * parent can `stopPropagation`. */
export function CloseButton({ onClick, label = "Close" }: { onClick: (e: MouseEvent) => void; label?: string }) {
  return (
    <IconButton type="button" variant="ghost" color="gray" size="1" aria-label={label} onClick={onClick}>
      <Cross2Icon />
    </IconButton>
  );
}
