export type ShareStatus = "idle" | "copied" | "uncopied";
import { useCallback, useState } from "react";
import { decodeState, encodeState, type PermalinkState } from "../lib/permalink.js";

/** Permalink wiring around a single source of truth: the URL fragment.
 *  - `initial`: the state decoded from `location.hash` on first load (null if none).
 *  - `writeUrl`: sync the hash to a state on a discrete action (example/data pick),
 *    via `replaceState` so it never adds a history entry. Edits do NOT call this.
 *  - `share`: write the hash + copy the URL (the explicit way to commit edits). */
export function useUrlState() {
  // Read once, synchronously, so the workspace can seed from it before first paint.
  const [initial] = useState<PermalinkState | null>(() =>
    typeof location === "undefined" ? null : decodeState(location.hash),
  );
  const [status, setStatus] = useState<ShareStatus>("idle");

  const writeUrl = useCallback((state: PermalinkState) => {
    history.replaceState(null, "", `#${encodeState(state)}`);
  }, []);

  /**
   * Copy the permalink, and **say so when it did not copy**.
   *
   * The `catch` here used to be empty, with a comment explaining that the address
   * bar holds the URL anyway. It does — but nobody reads a comment, and on
   * `http://localhost` `navigator.clipboard` is `undefined`, so every Share threw
   * a TypeError into that silence and the button said nothing at all. Confirmed as
   * the second, independent cause of "sharing does not work"; the first was a
   * frozen options object in `useWorkspace`.
   *
   * The guard is explicit rather than relying on the throw: a missing API is a
   * known state to report, not an exception to swallow.
   */
  const share = useCallback(
    async (state: PermalinkState) => {
      writeUrl(state);
      if (!navigator.clipboard) return setStatus("uncopied");
      try {
        await navigator.clipboard.writeText(location.href);
        setStatus("copied");
        setTimeout(() => setStatus("idle"), 1500);
      } catch {
        setStatus("uncopied");
      }
    },
    [writeUrl],
  );

  return { initial, writeUrl, share, status };
}
