import { useMemo } from "react";
import {
  Badge,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  Show,
  useAsyncCollection,
  useDebouncedCommit,
  useFilter,
  useListCollection,
  type AsyncCollection,
} from "@kanzo-tech/ui";
import { XIcon } from "lucide-react";
import type { WidgetOption } from "../../assist.js";
import { useStrings } from "../form/context.js";

/**
 * A combobox over candidates, and where the candidates come from.
 *
 * Two readings, and the design system makes the difference one prop rather than
 * two components:
 *
 * - **open** (`custom`, no trigger) — a `sh:class` reference. The list is a set of
 *   suggestions, not the permitted values, so an IRI nobody suggested must survive
 *   being typed.
 * - **closed** (a trigger, no custom values) — a `sh:in` enumeration too large to
 *   scroll. The permitted values *are* the list, so the machine reverting an
 *   unmatched input on blur is exactly right.
 *
 * And two sources, which is all that differs between a reference and an
 * enumeration: {@link ReferenceCombobox} asks `assist.search` as you type
 * (`useAsyncCollection`), {@link EnumCombobox} filters a list it already holds
 * (`useListCollection`). Both hand the control the same four things.
 */

/** What a combobox needs of its candidates — `useAsyncCollection`'s own shape, so
 *  a fetched list and a held one are interchangeable. */
type Candidates = Pick<AsyncCollection<WidgetOption>, "collection" | "setQuery" | "empty" | "labelOf">;

/** A list the shape already states, filtered by what is typed. */
function useHeldCandidates(items: WidgetOption[]): Candidates {
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection<WidgetOption>({
    initialItems: items,
    itemToValue: (i) => i.value,
    itemToString: (i) => i.label,
    filter: contains,
  });
  return {
    collection,
    setQuery: filter,
    empty: collection.size === 0,
    labelOf: (v) => items.find((i) => i.value === v)?.label,
  };
}

function Options({ candidates }: { candidates: Candidates }) {
  const { chrome } = useStrings();
  const { collection, empty } = candidates;
  return (
    <ComboboxContent>
      {empty && <ComboboxEmpty>{chrome.noMatches}</ComboboxEmpty>}
      {collection.items.map((item) => (
        <ComboboxItem item={item} key={item.value}>
          {item.label}
        </ComboboxItem>
      ))}
    </ComboboxContent>
  );
}

function Single(props: {
  candidates: Candidates;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  /** Let a value that matches nothing stand (a reference IRI). */
  custom?: boolean;
}) {
  const { candidates, value, onChange, custom = false } = props;
  // A typed custom value would otherwise write a `namedNode` on *every keystroke*
  // — "h", "ht", "htt", "http" — and each write rebuilds the form model and
  // re-enters the wasm validator. A pick commits at once.
  const { change, commit, flush } = useDebouncedCommit(value, onChange);
  const selected = useMemo(() => (value ? [value] : []), [value]);

  return (
    <Combobox
      allowCustomValue={custom}
      collection={candidates.collection}
      onInputValueChange={(d) => {
        candidates.setQuery(d.inputValue);
        // A custom value reaches us here and nowhere else: the selection is only
        // ever an item from the collection.
        if (custom) change(d.inputValue || null);
      }}
      onValueChange={(d) => commit(d.value[0] ?? null)}
      value={selected}
    >
      {/* A trigger promises a list you can browse; an open field's list is only
          whatever the last query returned. */}
      <ComboboxInput onBlur={flush} placeholder={props.placeholder} showTrigger={!custom} />
      <Options candidates={candidates} />
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
 * reopening a list to find the row you already chose; `labelOf` keeps them reading
 * as their label once the next query has replaced the batch that offered them.
 */
function Multi(props: {
  candidates: Candidates;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** `sh:maxCount` — the machine stops offering picks once the list is full. */
  max?: number;
}) {
  const { chrome } = useStrings();
  const { candidates, values, onChange } = props;

  return (
    <div className="flex flex-col gap-1.5">
      <Combobox
        collection={candidates.collection}
        multiple
        onInputValueChange={(d) => candidates.setQuery(d.inputValue)}
        onValueChange={(d) => onChange(d.value)}
        value={values}
      >
        <ComboboxInput
          disabled={props.max !== undefined && values.length >= props.max}
          placeholder={props.placeholder}
        />
        <Options candidates={candidates} />
      </Combobox>
      <Show when={values.length > 0}>
        <div className="flex flex-wrap gap-1">
          {values.map((v) => (
            <Badge asChild key={v} size="sm" variant="secondary">
              <button
                onClick={() => onChange(values.filter((x) => x !== v))}
                title={v}
                type="button"
              >
                {candidates.labelOf(v) ?? v}
                <XIcon aria-hidden />
                <span className="sr-only">{chrome.remove}</span>
              </button>
            </Badge>
          ))}
        </div>
      </Show>
    </div>
  );
}

type Load = (query: string, signal?: AbortSignal) => Promise<WidgetOption[]>;

/** A reference: candidates fetched as you type, and an IRI nobody suggested may stand. */
export function ReferenceCombobox(props: {
  value: string | null;
  onChange: (v: string | null) => void;
  load: Load;
  placeholder?: string;
}) {
  const { load, ...rest } = props;
  return <Single {...rest} candidates={useAsyncCollection({ load })} custom />;
}

export function ReferenceMultiCombobox(props: {
  values: string[];
  onChange: (values: string[]) => void;
  load: Load;
  placeholder?: string;
  max?: number;
}) {
  const { load, ...rest } = props;
  return <Multi {...rest} candidates={useAsyncCollection({ load })} />;
}

/** A closed enumeration too long for a `<select>`. */
export function EnumCombobox(props: {
  value: string | null;
  onChange: (v: string | null) => void;
  items: WidgetOption[];
  placeholder?: string;
}) {
  const { items, ...rest } = props;
  return <Single {...rest} candidates={useHeldCandidates(items)} />;
}

export function EnumMultiCombobox(props: {
  values: string[];
  onChange: (values: string[]) => void;
  items: WidgetOption[];
  placeholder?: string;
  max?: number;
}) {
  const { items, ...rest } = props;
  return <Multi {...rest} candidates={useHeldCandidates(items)} />;
}
