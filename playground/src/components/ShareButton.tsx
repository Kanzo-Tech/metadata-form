import { Button } from "@kanzo-tech/ui";
import { CheckIcon, LinkIcon, Share2Icon } from "lucide-react";
import type { ShareStatus } from "../hooks/useUrlState.js";

/**
 * Copy a self-contained permalink (shapes + the form's live data, compressed into
 * the URL fragment). Picks keep the URL in sync; Share commits the current edits.
 *
 * Three states, because there are three. `uncopied` is the one that used to be
 * invisible: on `http://localhost` and inside a sandboxed iframe the clipboard API
 * is absent, so the link is in the address bar and nowhere else — and a button
 * that reports nothing in that case is indistinguishable from a broken one.
 */
export function ShareButton({ onShare, status }: { onShare: () => void; status: ShareStatus }) {
  const label =
    status === "copied" ? "Copied!" : status === "uncopied" ? "In the address bar" : "Share";
  const Icon = status === "copied" ? CheckIcon : status === "uncopied" ? LinkIcon : Share2Icon;
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onShare}
      title={status === "uncopied" ? "The clipboard is unavailable here — copy the URL from the address bar" : undefined}
    >
      <Icon />
      {label}
    </Button>
  );
}
