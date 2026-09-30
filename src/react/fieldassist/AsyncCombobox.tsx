import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  useFilter,
  useListCollection,
} from "@kanzo-tech/ui";
import { XIcon } from "lucide-react";
import type { WidgetOption } from "../../assist.js";
import { grow, row } from "../styles.js";
import { useStrings } from "../form/context.js";

/**
 * A combobox over candidates fetched as you type.
 *
 * Two readings, and the design system makes the difference one prop rather than
 * two components:
 *
 * - **open** (`allowCustomValue`, no trigger) — a `sh:class` reference. The list
 *   is a set of suggestions, not the permitted values, so an IRI nobody suggested
 *   must survive being typed.
 * - **closed** (a trigger, no custom values) — a `sh:in` enumeration too large to
 *   scroll. The permitted values *are* the list, so the machine reverting an
 *   unmatched input on blur is exactly right.
 *
 * Filtering is ours to own by design: the machine never mutates the collection.
 */

/** How long a typed custom value waits before it becomes a term. */
const COMMIT_DELAY = 250;

/**
 * Candidates for the current query, aborting the previous fetch, plus every label
 * this control has ever been shown.
 *
 * The label map is not a cache: a selected value's label only exists in the batch
 * that offered it, and the next keystroke replaces the batch. Without it a chosen
 * item turns back into its IRI the moment you type again.
 */
function useCandidates(
  loadItems: (query: string, signal?: AbortSignal) => Promise<WidgetOption[]>,
) {
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, set } = useListCollection<WidgetOption>({
    initialItems: [],
    itemToValue: (i) => i.value,
    itemToString: (i) => i.label,
    filter: contains,
  });

  const seen = useRef(new Map<string, string>());
  // Aborts the in-flight query when a newer one starts — an out-of-order reply
  // would otherwise repopulate the list under the user's current input.
  const search = useRef<AbortController | undefined>(undefined);
  const [query, setQuery] = useState("");

  useEffect(() => {
    search.current?.abort();
    const ctrl = new AbortController();
    search.current = ctrl;
    let live = true;
    loadItems(query, ctrl.signal)
      .then((items) => {
        if (!live || ctrl.signal.aborted) return;
        for (const i of items) seen.current.set(i.value, i.label);
        set(items);
      })
      .catch(() => { /* an aborted or failed lookup leaves the list as it was */ });
    return () => { live = false; ctrl.abort(); };
    // `loadItems` is rebuilt per render by the caller; the query is what changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return { collection, setQuery, labelOf: (v: string) => seen.current.get(v) ?? v };
}

/**
 * Holds a typed custom value for {@link COMMIT_DELAY} before committing it.
 *
 * Without this, `allowCustomValue` writes a `namedNode` on *every keystroke* —
 * "h", "ht", "htt", "http" — and each write rebuilds the form model and re-enters
 * the wasm validator. `flush` on blur is what keeps the last few characters from
 * being lost when the control unmounts before the timer fires.
 */
function useDeferredCommit(commit: (v: string | null) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<string | null | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const defer = (v: string | null) => {
    pending.current = v;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pending.current = undefined;
      commit(v);
    }, COMMIT_DELAY);
  };
  const flush = () => {
    if (pending.current === undefined) return;
    clearTimeout(timer.current);
    const v = pending.current;
    pending.current = undefined;
    commit(v);
  };
  /** Commit now and cancel anything deferred — a pick supersedes typing. */
  const now = (v: string | null) => {
    clearTimeout(timer.current);
    pending.current = undefined;
    commit(v);
  };
  return { defer, flush, now };
}

export function AsyncCombobox(props: {
  value: string | null;
  onChange: (v: string | null) => void;
  loadItems: (query: string, signal?: AbortSignal) => Promise<WidgetOption[]>;
  placeholder?: string;
  /** Let a value that matches nothing stand (a reference IRI). Default false. */
  allowCustomValue?: boolean;
  /** The open/close chevron. Default: shown for a closed set, hidden for an open
   *  one — a trigger promises a list you can browse, and an open field's list is
   *  whatever the last query returned. */
  showTrigger?: boolean;
}) {
  const { chrome } = useStrings();
  const { collection, setQuery } = useCandidates(props.loadItems);
  const typed = useDeferredCommit(props.onChange);
  const value = useMemo(() => (props.value ? [props.value] : []), [props.value]);

  return (
    <Combobox
      style={grow}
      collection={collection}
      value={value}
      allowCustomValue={props.allowCustomValue}
      onValueChange={(d) => typed.now(d.value[0] ?? null)}
      onInputValueChange={(d) => {
        setQuery(d.inputValue);
        // A custom value reaches us here and nowhere else: the selection is only
        // ever an item from the collection.
        if (props.allowCustomValue) typed.defer(d.inputValue || null);
      }}
    >
      <ComboboxInput
        placeholder={props.placeholder}
        showTrigger={props.showTrigger ?? !props.allowCustomValue}
        onBlur={typed.flush}
      />
      <ComboboxContent>
        <ComboboxEmpty>{chrome.noMatches}</ComboboxEmpty>
        {collection.items.map((item) => (
          <ComboboxItem key={item.value} item={item}>
            {item.label}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}

/**
 * The same control holding a repeatable field's whole list.
 *
 * `multiple` also switches Ark's selection behaviour to `clear`, so the query
 * empties after each pick and the list is ready for the next — which is the
 * difference between picking five keywords and clearing the box five times.
 *
 * The chips are ours: the machine owns the value and says nothing about how a
 * selection is shown. They are buttons because removal has to be reachable without
 * reopening a list to find the row you already chose.
 */
export function AsyncMultiCombobox(props: {
  values: string[];
  onChange: (values: string[]) => void;
  loadItems: (query: string, signal?: AbortSignal) => Promise<WidgetOption[]>;
  placeholder?: string;
  /** `sh:maxCount` — the machine stops offering picks once the list is full. */
  max?: number;
  showTrigger?: boolean;
}) {
  const { chrome } = useStrings();
  const { collection, setQuery, labelOf } = useCandidates(props.loadItems);

  return (
    <div style={{ ...grow, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <Combobox
        collection={collection}
        value={props.values}
        multiple
        onValueChange={(d) => props.onChange(d.value)}
        onInputValueChange={(d) => setQuery(d.inputValue)}
      >
        <ComboboxInput
          placeholder={props.placeholder}
          showTrigger={props.showTrigger ?? true}
          disabled={props.max !== undefined && props.values.length >= props.max}
        />
        <ComboboxContent>
          <ComboboxEmpty>{chrome.noMatches}</ComboboxEmpty>
          {collection.items.map((item) => (
            <ComboboxItem key={item.value} item={item}>
              {item.label}
            </ComboboxItem>
          ))}
        </ComboboxContent>
      </Combobox>
      {props.values.length > 0 && (
        <div style={{ ...row, flexWrap: "wrap", gap: "0.25rem" }}>
          {props.values.map((v) => (
            <Badge key={v} variant="secondary" size="sm" asChild>
              <button
                type="button"
                title={v}
                onClick={() => props.onChange(props.values.filter((x) => x !== v))}
              >
                {labelOf(v)}
                <XIcon aria-hidden />
                <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>
                  {chrome.remove}
                </span>
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
