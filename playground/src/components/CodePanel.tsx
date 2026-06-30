import { useMemo } from "react";
import { Box, Tabs } from "@radix-ui/themes";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { StreamLanguage } from "@codemirror/language";
import { turtle } from "@codemirror/legacy-modes/mode/turtle";
import { EditorView } from "@codemirror/view";

// Module-level so each is a single stable instance — passing fresh
// extensions/setup per render makes @uiw/react-codemirror reconfigure the
// editor on every keystroke.
const turtleLang = StreamLanguage.define(turtle);
const jsonLang = json();
const cmFont = EditorView.theme({
  "&": { fontSize: "12px" },
  ".cm-content": { fontFamily: "var(--code-font-family, ui-monospace, monospace)" },
});

/** Tabs of code editors that fill the height of their docked aside (Source / Output). */
export function CodePanel({ tabs }: { tabs: { value: string; label: string; node: React.ReactNode }[] }) {
  return (
    <Tabs.Root
      defaultValue={tabs[0].value}
      style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
    >
      <Tabs.List style={{ flexShrink: 0 }}>
        {tabs.map((t) => (
          <Tabs.Trigger key={t.value} value={t.value}>
            {t.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Box style={{ flex: 1, minHeight: 0 }}>
        {tabs.map((t) => (
          <Tabs.Content key={t.value} value={t.value} style={{ height: "100%" }}>
            {t.node}
          </Tabs.Content>
        ))}
      </Box>
    </Tabs.Root>
  );
}

/** One cohesive code editor for every panel: same font, syntax highlighting. */
export function CodeEditor(props: {
  value: string;
  onChange?: (v: string) => void;
  lang: "turtle" | "json";
  readOnly?: boolean;
  dark?: boolean;
}) {
  const { lang, readOnly } = props;
  const extensions = useMemo(() => [lang === "json" ? jsonLang : turtleLang, cmFont], [lang]);
  const basicSetup = useMemo(
    () => ({ lineNumbers: true, foldGutter: false, highlightActiveLine: !readOnly }),
    [readOnly],
  );
  return (
    <CodeMirror
      value={props.value}
      height="100%"
      style={{ height: "100%" }}
      theme={props.dark ? "dark" : "light"}
      editable={!readOnly}
      readOnly={readOnly}
      extensions={extensions}
      basicSetup={basicSetup}
      onChange={props.onChange}
    />
  );
}
