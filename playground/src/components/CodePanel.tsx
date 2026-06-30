import { Box, Tabs } from "@radix-ui/themes";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { StreamLanguage } from "@codemirror/language";
import { turtle } from "@codemirror/legacy-modes/mode/turtle";
import { EditorView } from "@codemirror/view";

const turtleLang = StreamLanguage.define(turtle);
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
  return (
    <CodeMirror
      value={props.value}
      height="100%"
      style={{ height: "100%" }}
      theme={props.dark ? "dark" : "light"}
      editable={!props.readOnly}
      readOnly={props.readOnly}
      extensions={[props.lang === "json" ? json() : turtleLang, cmFont]}
      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: !props.readOnly }}
      onChange={props.onChange}
    />
  );
}
