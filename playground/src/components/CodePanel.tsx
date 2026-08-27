import { useMemo, useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kanzo-tech/ui";
import { CodeEditor as KanzoCodeEditor } from "@kanzo-tech/ui/editor";
import { json } from "@codemirror/lang-json";
import { StreamLanguage } from "@codemirror/language";
import { turtle } from "@codemirror/legacy-modes/mode/turtle";

// Module-level so each is a single stable instance — a fresh extension array per
// render reconfigures the editor on every keystroke.
const turtleLang = StreamLanguage.define(turtle);
const jsonLang = json();

/** One document of a panel: the tab that names it, what it draws, and the control
 *  that replaces it. */
export interface CodeTab {
  value: string;
  label: string;
  node: ReactNode;
  /** A control over THIS document — the picker that swaps what the tab is showing.
   *  Drawn at the end of the tab strip, and only while its own tab is active. */
  action?: ReactNode;
}

/**
 * Tabs of documents that fill the height of their docked aside.
 *
 * The strip is a row, not just a `TabsList`: a document's own picker sits at its
 * end, against the tab it replaces. That is the design system's rule about where a
 * control belongs applied one level down — the pane header answers *what is this
 * panel*, and a panel with two documents needs somewhere to answer *which one*,
 * which is the tab, so the selector that changes a document belongs beside it.
 *
 * Controlled, only so the strip knows which action to draw.
 */
export function CodePanel({ tabs }: { tabs: CodeTab[] }) {
  const [value, setValue] = useState(tabs[0].value);
  const active = tabs.find((t) => t.value === value) ?? tabs[0];

  return (
    <Tabs value={value} onValueChange={(d) => setValue(d.value)} className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-2" style={{ flex: "none" }}>
        <TabsList className="min-w-0">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {active.action ? <span className="ms-auto flex min-w-0 items-center">{active.action}</span> : null}
      </div>
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
