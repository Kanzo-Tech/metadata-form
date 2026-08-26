import { useEffect, useRef, useState } from "react";
import { Box, Button, Card, Flex, IconButton, Popover, Spinner, Text, TextField } from "@radix-ui/themes";
import { MagicWandIcon } from "@radix-ui/react-icons";
import { useCombobox } from "downshift";
import type { FieldSuggestion, WidgetOption } from "../widgets/widgets.js";
import { CloseButton } from "../form/CloseButton.js";

/**
 * Suggestion primitives. The `reference` widget is a typed async combobox
 * (downshift `useCombobox`); the ✨ field-assist is a Radix `Popover` — portalled,
 * theme-aware, and (unlike a menu) it stays open while you triage, so suggestions
 * can stream in, be dismissed one by one, and be refreshed. The library stays
 * LLM-agnostic — callers pass plain async callbacks.
 */

const surface = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  zIndex: 30,
  marginTop: 4,
  maxHeight: 240,
  overflowY: "auto",
} as const;

function itemStyle(active: boolean): React.CSSProperties {
  return {
    padding: "var(--space-1) var(--space-2)",
    borderRadius: "var(--radius-2)",
    cursor: "pointer",
    background: active ? "var(--accent-a3)" : "transparent",
  };
}

/** Typed async combobox (downshift `useCombobox`) — for `reference` fields. */
export function Combobox(props: {
  value: string | null;
  onChange: (v: string | null) => void;
  loadItems: (query: string, signal?: AbortSignal) => Promise<WidgetOption[]>;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [items, setItems] = useState<WidgetOption[]>([]);
  // Commit to the graph on a short debounce (and on blur/select) so typing an
  // IRI doesn't rebuild the form model per keystroke — same policy as useCommit.
  const [text, setText] = useState(props.value ?? "");
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const search = useRef<AbortController | undefined>(undefined); // aborts the in-flight query when a newer one starts
  useEffect(() => {
    if (!dirty.current) setText(props.value ?? "");
  }, [props.value]);
  const commit = (v: string) => {
    dirty.current = false;
    props.onChange(v ? v : null);
  };
  const schedule = (v: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(v), 250);
  };

  const { isOpen, getMenuProps, getInputProps, getItemProps, highlightedIndex } = useCombobox({
    items,
    inputValue: text,
    itemToString: (it) => it?.value ?? "",
    onInputValueChange: ({ inputValue }) => {
      const v = inputValue ?? "";
      setText(v);
      dirty.current = true;
      search.current?.abort();
      if (v.length >= 1) {
        const ctrl = new AbortController();
        search.current = ctrl;
        props
          .loadItems(v, ctrl.signal)
          .then(setItems)
          .catch(() => {
            if (!ctrl.signal.aborted) setItems([]);
          });
      } else setItems([]);
      schedule(v);
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (!selectedItem) return;
      clearTimeout(timer.current);
      setText(selectedItem.value);
      commit(selectedItem.value);
    },
  });
  const open = isOpen && items.length > 0;
  return (
    <Box position="relative" style={{ flex: 1, minWidth: 0 }}>
      <TextField.Root
        {...getInputProps({
          onBlur: () => {
            clearTimeout(timer.current);
            if (dirty.current) commit(text);
          },
        })}
        placeholder={props.placeholder}
        disabled={props.disabled}
        color={props.invalid ? "red" : undefined}
        style={{ width: "100%" }}
      />
      <Card size="1" {...getMenuProps()} style={{ ...surface, display: open ? "block" : "none" }}>
        <Flex direction="column" gap="1">
          {open &&
            items.map((item, index) => (
              <Box key={`${item.value}-${index}`} {...getItemProps({ item, index })} style={itemStyle(highlightedIndex === index)}>
                <Text size="2">{item.label}</Text>
              </Box>
            ))}
        </Flex>
      </Card>
    </Box>
  );
}

/** Case-insensitive key for deduping suggestion values. */
const norm = (v: string) => v.trim().toLowerCase();

/** How many suggestions to keep on screen. Dismissing one regenerates another from the
 * stream to keep the window full, so there's always a fixed set to choose from. */
const VISIBLE = 3;

/** ✨ button → a fixed window of streamed suggestions, in a portalled Radix `Popover`.
 * Suggestions stream in one at a time and are deduped live against the field's current
 * values and each other; dismissing a row (✕) regenerates another to keep {@link VISIBLE}
 * on screen. Fetched once per open-cycle (cached across reopen); Esc / click-away closes
 * (returning focus to the trigger). */
export function SuggestMenu(props: {
  fetch: (signal?: AbortSignal) => AsyncIterable<FieldSuggestion>;
  /** Current field values — suggestions equal to one of these (case-insensitive) are dropped. */
  existing: string[];
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FieldSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const started = useRef(false); // fetch once per open-cycle, then cache across reopen
  const ctrl = useRef<AbortController | undefined>(undefined);
  const iter = useRef<AsyncIterator<FieldSuggestion> | null>(null);
  const seen = useRef<Set<string>>(new Set()); // existing values + everything already shown
  const shown = useRef(0); // live count of visible rows (drives the fill loop)
  const filling = useRef(false); // serialize pulls — one AsyncIterator, one consumer
  const retried = useRef(false); // allow one fresh stream when the first runs dry

  useEffect(() => () => ctrl.current?.abort(), []); // cancel in-flight on unmount

  // Pull the next unique suggestion from the stream — restarting it once when it runs
  // dry — or null when the source can give no more.
  const pull = async (): Promise<FieldSuggestion | null> => {
    for (;;) {
      const signal = ctrl.current?.signal;
      if (!iter.current || signal?.aborted) return null;
      let res: IteratorResult<FieldSuggestion>;
      try {
        res = await iter.current.next();
      } catch (e) {
        if (!signal?.aborted) setError(e instanceof Error ? e.message : "Couldn’t load suggestions");
        return null;
      }
      if (signal?.aborted) return null;
      if (res.done) {
        if (retried.current) return (iter.current = null);
        retried.current = true;
        iter.current = props.fetch(ctrl.current!.signal)[Symbol.asyncIterator]();
        continue;
      }
      const k = norm(res.value.value);
      if (!k || seen.current.has(k)) continue;
      seen.current.add(k);
      return res.value;
    }
  };

  // Top the visible window back up to VISIBLE, appending each as it arrives.
  const fill = async () => {
    if (filling.current) return;
    filling.current = true;
    setLoading(true);
    try {
      while (shown.current < VISIBLE) {
        const next = await pull();
        if (!next) break;
        shown.current += 1;
        setItems((prev) => [...prev, next]);
      }
    } finally {
      filling.current = false;
      setLoading(false);
    }
  };

  const start = () => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    seen.current = new Set(props.existing.map(norm).filter(Boolean));
    retried.current = false;
    shown.current = 0;
    iter.current = props.fetch(c.signal)[Symbol.asyncIterator]();
    setItems([]);
    setError(null);
    void fill();
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      if (!started.current) {
        started.current = true;
        start();
      }
    } else if (loading) {
      // Interrupted mid-load: stop the (paid) stream and refetch fresh next time.
      ctrl.current?.abort();
      started.current = false;
      setLoading(false);
    }
  };

  const pick = (value: string) => {
    props.onPick(value);
    setOpen(false);
  };

  // Dismiss one and regenerate another to keep the window full.
  const dismiss = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    shown.current -= 1;
    void fill();
  };

  const pad = { padding: "var(--space-1) var(--space-2)" } as const;
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger>
        <IconButton type="button" variant="soft" size="1" color="violet" disabled={props.disabled} aria-label="Suggest a value">
          <MagicWandIcon />
        </IconButton>
      </Popover.Trigger>
      <Popover.Content align="end" style={{ minWidth: 240, maxWidth: 380 }}>
        {loading && items.length === 0 && (
          <Flex align="center" gap="2" px="2" py="1">
            <Spinner size="1" />
            <Text size="1" color="gray">
              Thinking…
            </Text>
          </Flex>
        )}
        {error && (
          <Text size="1" color="red" style={{ display: "block", ...pad }}>
            {error}
          </Text>
        )}
        {!loading && !error && items.length === 0 && (
          <Text size="1" color="gray" style={{ display: "block", ...pad }}>
            No suggestions
          </Text>
        )}
        <Flex direction="column" gap="1">
          {items.map((item, index) => (
            <Flex key={`${item.value}-${index}`} align="center" gap="2">
              <Button
                type="button"
                variant="ghost"
                color="gray"
                onClick={() => pick(item.value)}
                style={{ flex: 1, minWidth: 0, height: "auto", justifyContent: "start", textAlign: "start", whiteSpace: "normal", padding: "var(--space-2)", margin: 0 }}
              >
                <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
                  <Text size="2">{item.label ?? item.value}</Text>
                  {item.rationale && (
                    <Text size="1" color="gray">
                      {item.rationale}
                    </Text>
                  )}
                </Flex>
              </Button>
              <CloseButton label="Dismiss suggestion" onClick={() => dismiss(index)} />
            </Flex>
          ))}
        </Flex>
        {loading && items.length > 0 && (
          <Flex align="center" justify="center" pt="2">
            <Spinner size="1" />
          </Flex>
        )}
      </Popover.Content>
    </Popover.Root>
  );
}
