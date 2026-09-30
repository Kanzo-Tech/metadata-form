import { useMemo, type ComponentProps, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kanzo-tech/ui";
import { CodeEditor as KanzoCodeEditor } from "@kanzo-tech/ui/editor";
import { json } from "@codemirror/lang-json";
import { StreamLanguage } from "@codemirror/language";
import { turtle } from "@codemirror/legacy-modes/mode/turtle";
import { PaneHeader } from "./PaneHeader.js";

// Module-level so each is a single stable instance — a fresh extension array per
// render reconfigures the editor on every keystroke.
const turtleLang = StreamLanguage.define(turtle);
const jsonLang = json();

/** One document of a panel: the tab that names it and what it draws. */
export interface DocumentTab<V extends string> {
  value: V;
  label: string;
  node: ReactNode;
}

/**
 * A panel that shows one of several documents, filling its docked aside.
 *
 * **One row of chrome.** The tabs sit in the pane's own header, between its name
 * and its close. They used to be a second strip under it, sharing that strip with
 * a picker — two rows to say "Source: the shapes", and at a quarter of the window
 * neither the tabs nor the picker fit on theirs. Source and Output are the same
 * kind of thing (a panel, a choice of document) and now they are drawn the same.
 *
 * Controlled, and the value lives with the caller: opening any panel re-keys the
 * splitter and remounts every column, so a tab chosen in here would reset itself.
 */
export function DocumentPane<V extends string>({
  actions,
  onValueChange,
  tabs,
  value,
  ...header
}: {
  /** Controls over the open document. They float in its top corner, the way a code
   *  block carries its copy button: the header says which document, and what is
   *  done TO the document sits on it. */
  actions?: ReactNode;
  onValueChange: (value: V) => void;
  tabs: DocumentTab<V>[];
  value: V;
} & Pick<ComponentProps<typeof PaneHeader>, "icon" | "onClose" | "title">) {
  return (
    <Tabs value={value} onValueChange={(d) => onValueChange(d.value as V)} className="flex min-h-0 flex-1 flex-col gap-0">
      <PaneHeader {...header}>
        <TabsList className="min-w-0 self-stretch" variant="underline">
          {tabs.map((t) => (
            <TabsTrigger className="text-xs" key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </PaneHeader>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {tabs.map((t) => (
          <TabsContent className="flex min-h-0 flex-1 flex-col" key={t.value} value={t.value}>
            {t.node}
          </TabsContent>
        ))}
        {actions ? (
          <div className="absolute z-10 flex items-center" style={{ top: "0.5rem", insetInlineEnd: "0.75rem" }}>
            {actions}
          </div>
        ) : null}
      </div>
    </Tabs>
  );
}

/**
 * One cohesive code editor for every panel.
 *
 * The design system's, from the `/editor` subpath — so CodeMirror stays off the
 * base bundle for anyone who does not open a code panel. It carries the Kanzo
 * token theme itself, so the editor reads the same theme as everything else.
 *
 * `chrome={false}`: the bordered, focus-ringed surface is a FIELD's, and this is
 * not a field in a form — it is the panel's document, and the panel is already
 * its frame. Bare, it is a flex child that takes the whole height of its pane,
 * however short the document is.
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
      chrome={false}
      className="min-h-0 flex-1"
    />
  );
}
