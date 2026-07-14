import { useMemo, useState } from "react";
import { Box, Flex, Popover, Text, TextField } from "@radix-ui/themes";
import { ChevronDownIcon } from "@radix-ui/react-icons";

/**
 * A compact, searchable language-tag picker for `rdf:langString` values, designed
 * to sit glued inside a text field's right slot (no visible gap). Big step up from
 * a bare 2-letter `<Select>`:
 *  - the dropdown shows each language's ENDONYM (its name in its own language) +
 *    the tag, so you read "Español · es", not "es";
 *  - typeahead over both the name and the tag (a long list stays usable);
 *  - honours `sh:languageIn` — when the shape constrains the languages the list is
 *    exactly those (and free entry is disabled); otherwise a broad curated list
 *    plus free BCP-47 entry.
 * Kept dumb: reads/writes a plain tag string; the binding layer stamps it on the
 * literal.
 */

/** A broad default set of language subtags (used when the shape does not pin
 *  `sh:languageIn`). The search filters it, so length is not an issue. */
const CURATED = [
  "en", "es", "fr", "de", "it", "pt", "nl", "ca", "gl", "eu", "ast", "oc",
  "ga", "cy", "sv", "da", "nb", "nn", "fi", "is", "pl", "cs", "sk", "sl",
  "hr", "sr", "bg", "ro", "hu", "el", "tr", "ru", "uk", "ar", "he", "fa",
  "hi", "bn", "ur", "zh", "ja", "ko", "th", "vi", "id", "ms", "sw", "af",
];

const BCP47 = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** The language's name in its own language (endonym), e.g. `es` → "Español".
 *  Falls back to the tag when the runtime can't name it. */
function endonym(tag: string): string {
  try {
    const base = tag.split("-")[0];
    const name = new Intl.DisplayNames([tag], { type: "language" }).of(base);
    if (!name || name.toLowerCase() === base.toLowerCase()) return tag;
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return tag;
  }
}

interface LangItem {
  code: string;
  name: string;
}

export function LanguagePicker({
  value,
  onChange,
  allowed,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (tag: string) => void;
  /** `sh:languageIn` — when non-empty, constrains the list and disables free entry. */
  allowed?: string[];
  disabled?: boolean;
  invalid?: boolean;
}) {
  const constrained = !!(allowed && allowed.length);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const items = useMemo<LangItem[]>(() => {
    const codes = constrained ? allowed! : CURATED;
    return codes.map((code) => ({ code, name: endonym(code) }));
  }, [constrained, allowed]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
  }, [items, query]);

  const pick = (tag: string) => {
    onChange(tag);
    setOpen(false);
    setQuery("");
  };

  const commitTyped = () => {
    const t = query.trim();
    if (!constrained && t && BCP47.test(t)) return pick(t.toLowerCase());
    if (filtered[active]) return pick(filtered[active].code);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); commitTyped(); }
  };

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) { setQuery(""); setActive(0); } }}>
      <Popover.Trigger disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          aria-label="Idioma"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            height: "100%",
            padding: "0 8px",
            margin: 0,
            border: "none",
            background: "transparent",
            font: "inherit",
            fontSize: "var(--font-size-1)",
            lineHeight: 1,
            cursor: disabled ? "default" : "pointer",
            color: invalid ? "var(--red-11)" : value ? "var(--gray-12)" : "var(--gray-a9)",
            opacity: disabled ? 0.5 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {value || "idioma"}
          <ChevronDownIcon aria-hidden style={{ opacity: 0.6, flexShrink: 0 }} />
        </button>
      </Popover.Trigger>
      <Popover.Content size="1" style={{ width: 240, padding: "var(--space-1)" }} onOpenAutoFocus={(e) => e.preventDefault()}>
        <TextField.Root
          autoFocus
          size="1"
          placeholder={constrained ? "Filtrar…" : "Buscar o escribir tag…"}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
        />
        <Box mt="1" style={{ maxHeight: 240, overflowY: "auto" }}>
          <Flex direction="column">
            {filtered.map((item, index) => (
              <Flex
                key={item.code}
                align="baseline"
                gap="2"
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(item.code)}
                style={{
                  padding: "var(--space-1) var(--space-2)",
                  borderRadius: "var(--radius-2)",
                  cursor: "pointer",
                  background: active === index ? "var(--accent-a3)" : value === item.code ? "var(--accent-a2)" : "transparent",
                }}
              >
                <Text size="2" style={{ flex: 1, minWidth: 0 }}>{item.name}</Text>
                <Text size="1" color="gray">{item.code}</Text>
              </Flex>
            ))}
            {filtered.length === 0 && (
              <Text size="1" color="gray" style={{ padding: "var(--space-1) var(--space-2)" }}>
                {constrained ? "Sin coincidencias" : "Pulsa Enter para usar este tag"}
              </Text>
            )}
          </Flex>
        </Box>
      </Popover.Content>
    </Popover.Root>
  );
}
