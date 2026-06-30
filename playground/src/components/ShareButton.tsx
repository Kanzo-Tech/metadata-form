import { Button } from "@radix-ui/themes";
import { CheckIcon, Share1Icon } from "@radix-ui/react-icons";

/** Copy a self-contained permalink (shapes + the form's live data, compressed into
 *  the URL fragment). Picks keep the URL in sync; Share commits the current edits. */
export function ShareButton({ onShare, shared }: { onShare: () => void; shared: boolean }) {
  return (
    <Button size="1" variant="ghost" color="gray" onClick={onShare}>
      {shared ? <CheckIcon /> : <Share1Icon />}
      {shared ? "Copied!" : "Share"}
    </Button>
  );
}
