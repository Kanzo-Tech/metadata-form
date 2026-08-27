import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kanzo-tech/ui";
import { CodeEditor as KanzoCodeEditor } from "@kanzo-tech/ui/editor";
import { json } from "@codemirror/lang-json";
import { StreamLanguage } from "@codemirror/language";
import { turtle } from "@codemirror/legacy-modes/mode/turtle";

// Module-level so each is a single stable instance — a fresh extension array per
// render reconfigures the editor on every keystroke.
const turtleLang = StreamLanguage.define(turtle);
const jsonLang = json();

/** Tabs of code editors that fill the height of their docked aside (Source / Output). */
export function CodePanel({ tabs }: { tabs: { value: string; label: string; node: React.ReactNode }[] }) {
  return (
    <Tabs defaultValue={tabs[0].value} className="flex min-h-0 flex-1 flex-col">
      <TabsList style={{ flex: "none" }}>
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="min-h-0 flex-1">
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="h-full">
            {t.node}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}

/**
 * One cohesive code editor for every panel.
 *
 * The design system's, from the `/editor` subpath — so CodeMirror stays off the
 * base bundle for anyone who does not open a code panel. It carries the Kanzo
 * token theme itself, which is why there is no `dark` prop any more: the editor
 * reads the same theme as everything else instead of being told which one is on.
 *
 * `wrap={false}` for Turtle on purpose, and the component's own docs say why: a
 * predicate list read against its indentation stops being a list once every third
 * line reflows.
 */
export function CodeEditor(props: {
  value: string;
  onChange?: (v: string) => void;
  lang: "turtle" | "json";
  readOnly?: boolean;
}) {
  const { lang, readOnly } = props;
  const extensions = useMemo(() => (lang === "json" ? jsonLang : turtleLang), [lang]);
  return (
    <KanzoCodeEditor
      value={props.value}
      onChange={props.onChange}
      extensions={extensions}
      readOnly={readOnly}
      lineNumbers
      wrap={false}
      maxHeight="100%"
    />
  );
}
