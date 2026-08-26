import { useEffect, useMemo, useRef, useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  useFilter,
  useListCollection,
} from "@kanzo-tech/ui";
import type { WidgetOption } from "../widgets/widgets.js";
import { grow } from "../styles.js";

/**
 * A combobox over candidates fetched as you type.
 *
 * Two readings, and the design system makes the difference one prop rather than
 * two components:
 *
 * - **open** (`allowCustomValue`, no trigger) — a `sh:class` reference. The list
 *   is a set of suggestions, not the permitted values, so an IRI nobody suggested
 *   must survive being typed. Without a source it degrades to plain IRI entry,
 *   which the caller handles by not rendering this at all.
 * - **closed** (a trigger, no custom values) — a `sh:in` enumeration too large to
 *   scroll. The permitted values *are* the list, so the machine reverting an
 *   unmatched input on blur is exactly right.
 *
 * Filtering is ours to own by design: the machine never mutates the collection.
 */
export function AsyncCombobox(props: {
  value: string | null;
  onChange: (v: string | null) => void;
  loadItems: (query: string, signal?: AbortSignal) => Promise<WidgetOption[]>;
  placeholder?: string;
  /** Let a value that matches nothing stand (a reference IRI). Default false. */
  allowCustomValue?: boolean;
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, set } = useListCollection<WidgetOption>({
    initialItems: [],
    itemToValue: (i) => i.value,
    itemToString: (i) => i.label,
    filter: contains,
  });

  // Aborts the in-flight query when a newer one starts — an out-of-order reply
  // would otherwise repopulate the list under the user's current input.
  const search = useRef<AbortController | undefined>(undefined);
  const [query, setQuery] = useState("");

  useEffect(() => {
    search.current?.abort();
    const ctrl = new AbortController();
    search.current = ctrl;
    let live = true;
    props.loadItems(query, ctrl.signal)
      .then((items) => { if (live && !ctrl.signal.aborted) set(items); })
      .catch(() => { /* an aborted or failed lookup leaves the list as it was */ });
    return () => { live = false; ctrl.abort(); };
    // `loadItems` is rebuilt per render by the caller; the query is what changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const value = useMemo(() => (props.value ? [props.value] : []), [props.value]);

  return (
    <Combobox
      style={grow}
      collection={collection}
      value={value}
      allowCustomValue={props.allowCustomValue}
      onValueChange={(d) => props.onChange(d.value[0] ?? null)}
      onInputValueChange={(d) => {
        setQuery(d.inputValue);
        // A custom value reaches us here and nowhere else: the selection is only
        // ever an item from the collection.
        if (props.allowCustomValue) props.onChange(d.inputValue || null);
      }}
    >
      <ComboboxInput placeholder={props.placeholder} />
      <ComboboxContent>
        <ComboboxEmpty>No matches</ComboboxEmpty>
        {collection.items.map((item) => (
          <ComboboxItem key={item.value} item={item}>
            {item.label}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
