import { Button } from "@kanzo-tech/ui";
import { CheckIcon, Share2Icon } from "lucide-react";

/** Copy a self-contained permalink (shapes + the form's live data, compressed into
 *  the URL fragment). Picks keep the URL in sync; Share commits the current edits. */
export function ShareButton({ onShare, shared }: { onShare: () => void; shared: boolean }) {
  return (
    <Button size="sm" variant="ghost" onClick={onShare}>
      {shared ? <CheckIcon /> : <Share2Icon />}
      {shared ? "Copied!" : "Share"}
    </Button>
  );
}
