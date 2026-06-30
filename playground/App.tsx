import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Kbd,
  Link,
  Select as RSelect,
  Separator,
  Tabs,
  Text,
  Theme,
} from "@radix-ui/themes";
import { CodeIcon, FileTextIcon } from "@radix-ui/react-icons";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { StreamLanguage } from "@codemirror/language";
import { turtle } from "@codemirror/legacy-modes/mode/turtle";
import { EditorView } from "@codemirror/view";
import { createAnthropic } from "@ai-sdk/anthropic";
import {
  FormAssistant,
  MetadataForm,
  useMetadataForm,
  ValidationSummary,
  type FormAssist,
} from "metadata-form";
import { createFormAssist } from "metadata-form/ai";
import {
  healthDcatApShapes,
  healthDcatApSampleData,
} from "./examples/health-dcat-ap/index.js";
import { Preferences, usePreferences } from "./Preferences.js";
import "@radix-ui/themes/styles.css";

/** Local demo catalog: each shape carries several input-data examples. */
const EXAMPLES = [
  {
    id: "health-dcat-ap",
    label: "HealthDCAT-AP",
    shapes: healthDcatApShapes,
    data: [
      { id: "empty", label: "Empty (new dataset)", ttl: "" },
      { id: "covid", label: "COVID-19 registry", ttl: healthDcatApSampleData },
    ],
  },
];

/** Side-panel widths (px) are user-draggable; clamp keeps them in a usable band. */
const MIN_PANEL_W = 240;
const MAX_PANEL_W = 760;
const DEFAULT_SOURCE_W = 380;
const DEFAULT_OUTPUT_W = 440;
const clampPanelW = (w: number) => Math.max(MIN_PANEL_W, Math.min(MAX_PANEL_W, w));

/** Shared chrome tokens: the hairline divider and the panel surface. */
const PANEL_BORDER = "1px solid var(--gray-a5)";
const PANEL_BG = "var(--color-panel-solid)";
const turtleLang = StreamLanguage.define(turtle);
const cmFont = EditorView.theme({
  "&": { fontSize: "12px" },
  ".cm-content": { fontFamily: "var(--code-font-family, ui-monospace, monospace)" },
});

/** Below this width the two asides can't sit beside the form, so the layout switches
 *  to form-only with a single overlay drawer. */
const NARROW = "(max-width: 1024px)";

/** Track a media query (browser-only demo, no SSR) so the layout can react to the
 *  viewport crossing the breakpoint. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** Keep an aside mounted through its slide-out so closing animates too: while `open`
 *  it animates in; when it flips false it animates out and unmounts on `animationend`.
 *  When `animate` is false (wide viewport / reduced motion) it mounts and unmounts at once. */
function useAsidePresence(open: boolean, animate: boolean) {
  const [state, setState] = useState<"open" | "closing" | "closed">(open ? "open" : "closed");
  useEffect(() => {
    setState((prev) => {
      if (open) return "open";
      if (prev === "closed") return "closed";
      return animate ? "closing" : "closed";
    });
  }, [open, animate]);
  const onAnimationEnd = useCallback(() => {
    setState((prev) => (prev === "closing" ? "closed" : prev));
  }, []);
  return { mounted: state !== "closed", closing: state === "closing", onAnimationEnd };
}

/** The assistance seam, wired to Claude via the `metadata-form/ai` adapter over the
 * Vercel AI SDK (the library core stays LLM-agnostic). `createFormAssist` gives
 * streaming ghost-text (`complete`) and typed ✨ suggestions (`suggest`) for free.
 * `dangerous-direct-browser-access` is only needed because this demo calls Anthropic
 * straight from the browser. */
function makeAssist(apiKey: string): FormAssist {
  const provider = createAnthropic({
    apiKey,
    headers: { "anthropic-dangerous-direct-browser-access": "true" },
  });
  return createFormAssist(provider("claude-opus-4-8"));
}

export function App() {
  return (
    <Preferences.Root>
      <ThemedApp />
    </Preferences.Root>
  );
}

function ThemedApp() {
  const { prefs, update } = usePreferences();
  const dark = prefs.theme.appearance === "dark";
  const apiKey = prefs.ai.claudeKey;

  // The assistance seam is wired only when an API key is present.
  const assist = useMemo<FormAssist | undefined>(() => (apiKey ? makeAssist(apiKey) : undefined), [apiKey]);

  const [shapeId, setShapeId] = useState(EXAMPLES[0].id);
  const [dataId, setDataId] = useState(EXAMPLES[0].data[0].id);
  const [shapeText, setShapeText] = useState(EXAMPLES[0].shapes);
  const [dataText, setDataText] = useState(EXAMPLES[0].data[0].ttl);
  const isNarrow = useMediaQuery(NARROW);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // Everything starts collapsed — the form is the only panel shown by default.
  const [showSource, setShowSource] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [sourceW, setSourceW] = useState(DEFAULT_SOURCE_W);
  const [outputW, setOutputW] = useState(DEFAULT_OUTPUT_W);

  // Crossing into a narrow viewport collapses everything to form-only.
  useEffect(() => {
    if (isNarrow) {
      setShowSource(false);
      setShowOutput(false);
    }
  }, [isNarrow]);

  // On narrow viewports only one panel is active at a time, so opening one closes the other.
  const toggleSource = useCallback(() => {
    const opening = !showSource;
    setShowSource(opening);
    if (opening && isNarrow) setShowOutput(false);
  }, [showSource, isNarrow]);
  const toggleOutput = useCallback(() => {
    const opening = !showOutput;
    setShowOutput(opening);
    if (opening && isNarrow) setShowSource(false);
  }, [showOutput, isNarrow]);

  // Asides slide in/out on narrow viewports; presence keeps them mounted until the
  // exit finishes. Wide viewport or reduced motion → no animation, instant mount/unmount.
  const animate = isNarrow && !reduceMotion;
  const sourcePresence = useAsidePresence(showSource, animate);
  const outputPresence = useAsidePresence(showOutput, animate);

  // Keyboard toggles (S / O). Preferences owns the "," shortcut.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const k = e.key.toUpperCase();
      if (k === "S") toggleSource();
      else if (k === "O") toggleOutput();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleSource, toggleOutput]);

  // Live, debounced — no Apply button.
  const [applied, setApplied] = useState({ shapes: shapeText, data: dataText });
  useEffect(() => {
    const t = setTimeout(() => setApplied({ shapes: shapeText, data: dataText }), 350);
    return () => clearTimeout(t);
  }, [shapeText, dataText]);

  const form = useMetadataForm({
    shapes: applied.shapes,
    data: applied.data || undefined,
    validateOn: "change",
    assist,
  });

  const [turtleOut, setTurtleOut] = useState("");
  const [jsonldOut, setJsonldOut] = useState("");
  useEffect(() => {
    let active = true;
    if (!form.ready) return;
    form.toTurtle().then((t) => active && setTurtleOut(t));
    form.toJsonLd().then((j) => active && setJsonldOut(JSON.stringify(j, null, 2)));
    return () => {
      active = false;
    };
  }, [form]);

  const shape = useMemo(() => EXAMPLES.find((e) => e.id === shapeId)!, [shapeId]);

  const pickShape = (id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setShapeId(id);
    setShapeText(ex.shapes);
    setDataId(ex.data[0].id);
    setDataText(ex.data[0].ttl);
  };
  const pickData = (id: string) => {
    const d = shape.data.find((x) => x.id === id);
    if (!d) return;
    setDataId(id);
    setDataText(d.ttl);
  };

  // Panel content defined once and reused by the docked aside (wide) and the drawer (narrow).
  const sourcePanel = (
    <CodePanel
      tabs={[
        {
          value: "shape",
          label: "SHACL shape",
          node: <CodeEditor value={shapeText} onChange={setShapeText} lang="turtle" dark={dark} />,
        },
        {
          value: "data",
          label: "Data graph",
          node: <CodeEditor value={dataText} onChange={setDataText} lang="turtle" dark={dark} />,
        },
      ]}
    />
  );
  const outputPanel = (
    <CodePanel
      tabs={[
        { value: "turtle", label: "Turtle", node: <CodeEditor value={turtleOut} lang="turtle" readOnly dark={dark} /> },
        { value: "jsonld", label: "JSON-LD", node: <CodeEditor value={jsonldOut} lang="json" readOnly dark={dark} /> },
      ]}
    />
  );

  return (
    <Theme
      appearance={prefs.theme.appearance}
      accentColor={prefs.theme.accentColor as never}
      grayColor={prefs.theme.grayColor as never}
      panelBackground={prefs.theme.panelBackground as never}
      radius={prefs.theme.radius}
      scaling={prefs.theme.scaling as never}
    >
      {/* IDE-style shell: a fixed top bar over a full-height workspace whose three
          regions (source aside | form main | output aside) each scroll on their own. */}
      <Flex direction="column" style={{ height: "100vh", overflow: "hidden" }}>
        {/* Utility strip — example pickers, deliberately low-key (top-right, like a
            language switcher) so they read as context, not primary controls. */}
        <Flex
          align="center"
          justify="between"
          gap="3"
          px="5"
          py="1"
          style={{ flexShrink: 0, background: "var(--gray-a2)", borderBottom: PANEL_BORDER }}
        >
          <Flex align="center" gap="4">
            <Field label="Shape" size="1">
              <RSelect.Root size="1" value={shapeId} onValueChange={pickShape}>
                <RSelect.Trigger variant="ghost" color="gray" />
                <RSelect.Content>
                  {EXAMPLES.map((e) => (
                    <RSelect.Item key={e.id} value={e.id}>
                      {e.label}
                    </RSelect.Item>
                  ))}
                </RSelect.Content>
              </RSelect.Root>
            </Field>
            <Separator orientation="vertical" />
            <Field label="Data" size="1">
              <RSelect.Root size="1" value={dataId} onValueChange={pickData}>
                <RSelect.Trigger variant="ghost" color="gray" />
                <RSelect.Content>
                  {shape.data.map((d) => (
                    <RSelect.Item key={d.id} value={d.id}>
                      {d.label}
                    </RSelect.Item>
                  ))}
                </RSelect.Content>
              </RSelect.Root>
            </Field>
          </Flex>

          <Text size="1" color="gray">
            Made with ❤️ at{" "}
            <Link href="https://kanzo.tech" target="_blank" rel="noreferrer" size="1" color="gray" highContrast>
              Kanzo
            </Link>
          </Text>
        </Flex>

        {/* Top bar — title + view toggles. */}
        <Flex
          align="center"
          gap="3"
          wrap="wrap"
          px="5"
          py="3"
          style={{ flexShrink: 0, borderBottom: PANEL_BORDER }}
        >
          <Flex direction="column" mr="2">
            <Heading size="4">metadata-form</Heading>
            <Text size="1" color="gray">
              SHACL/DASH shapes → editable RDF form → Turtle &amp; JSON-LD
            </Text>
          </Flex>

          <Box flexGrow="1" />

          <Toggle on={showSource} onClick={toggleSource} icon={<FileTextIcon />} kbd="S">
            Source
          </Toggle>
          <Toggle on={showOutput} onClick={toggleOutput} icon={<CodeIcon />} kbd="O">
            Output
          </Toggle>
          {/* The canonical validation summary — same in every layout (per-section
              badges in tabs/steps are wayfinding dots, not a competing counter). */}
          <ValidationSummary form={form} />
          <Text size="1" color="gray">
            Preferences <Kbd>P</Kbd>
          </Text>
        </Flex>

        {/* Workspace — wide: docked Source | Form | Output (draggable asides). Narrow: the
            form fills, and the single active panel slides over it as a drawer. */}
        <Flex style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <AsideSection
            side="left"
            narrow={isNarrow}
            presence={sourcePresence}
            width={sourceW}
            onResize={setSourceW}
            defaultWidth={DEFAULT_SOURCE_W}
          >
            {sourcePanel}
          </AsideSection>

          <main style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
            <Box p="5" style={{ maxWidth: 1080, margin: "0 auto" }}>
              {form.error ? (
                <Card>
                  <Text color="red">{form.error.message}</Text>
                </Card>
              ) : (
                <MetadataForm
                  form={form}
                  layout={prefs.layout.mode}
                  grid={{ columns: prefs.layout.columns }}
                />
              )}
            </Box>
          </main>

          <AsideSection
            side="right"
            narrow={isNarrow}
            presence={outputPresence}
            width={outputW}
            onResize={setOutputW}
            defaultWidth={DEFAULT_OUTPUT_W}
          >
            {outputPanel}
          </AsideSection>
        </Flex>
      </Flex>

      {prefs.assistant.enabled && (
        <FormAssistant form={form} onDismiss={() => update("assistant", { enabled: false })} />
      )}

      <Preferences.Panel>
        <Preferences.Theme />
        <Preferences.Layout />
        <Preferences.Assistant />
        <Preferences.ClaudeKey />
      </Preferences.Panel>
    </Theme>
  );
}

function Field({
  label,
  children,
  size = "2",
}: {
  label: string;
  children: React.ReactNode;
  size?: "1" | "2";
}) {
  return (
    <Flex align="center" gap="2">
      <Text size={size} color="gray" mr="2">
        {label}
      </Text>
      {children}
    </Flex>
  );
}

function Toggle(props: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  kbd: string;
  children: React.ReactNode;
}) {
  return (
    <Button variant="soft" color={props.on ? undefined : "gray"} onClick={props.onClick}>
      {props.icon}
      {props.children}
      <Kbd size="1">{props.kbd}</Kbd>
    </Button>
  );
}

/** A mounted aside plus its resize handle (wide only). Encapsulates the side-specific
 *  bits — handle order (always on the form side) and drag direction — so the two panels
 *  read as one symmetric call instead of two mirror blocks. */
function AsideSection({
  side,
  narrow,
  presence,
  width,
  onResize,
  defaultWidth,
  children,
}: {
  side: "left" | "right";
  narrow: boolean;
  presence: ReturnType<typeof useAsidePresence>;
  width: number;
  onResize: React.Dispatch<React.SetStateAction<number>>;
  defaultWidth: number;
  children: React.ReactNode;
}) {
  if (!presence.mounted) return null;
  const aside = (
    <Aside
      side={side}
      width={width}
      narrow={narrow}
      closing={presence.closing}
      onAnimationEnd={presence.onAnimationEnd}
    >
      {children}
    </Aside>
  );
  if (narrow) return aside;
  const handle = (
    <ResizeHandle
      onDrag={(dx) => onResize((w) => clampPanelW(w + (side === "left" ? dx : -dx)))}
      onReset={() => onResize(defaultWidth)}
    />
  );
  return side === "left" ? (
    <>
      {aside}
      {handle}
    </>
  ) : (
    <>
      {handle}
      {aside}
    </>
  );
}

/** The side panel — semantically an <aside> (the form is the page's <main>). One
 *  component for both layouts: docked with a draggable width on wide viewports, or a
 *  full-screen overlay sliding in from its own edge on narrow ones. */
function Aside({
  side,
  width,
  narrow,
  closing,
  onAnimationEnd,
  children,
}: {
  side: "left" | "right";
  width: number;
  narrow: boolean;
  closing: boolean;
  onAnimationEnd: () => void;
  children: React.ReactNode;
}) {
  const border = side === "left" ? { borderRight: PANEL_BORDER } : { borderLeft: PANEL_BORDER };
  const layout: React.CSSProperties = narrow
    ? { position: "absolute", inset: 0, zIndex: 5 }
    : { width, flexShrink: 0, minWidth: 0, ...border };
  const animClass = narrow ? `mf-aside-${closing ? "out" : "in"}-${side}` : undefined;
  return (
    <aside
      className={animClass}
      onAnimationEnd={onAnimationEnd}
      style={{
        display: "flex",
        flexDirection: "column",
        background: PANEL_BG,
        ...layout,
      }}
    >
      {children}
    </aside>
  );
}

/** Native, dependency-free splitter (Radix ships no resizable primitive): pointer
 *  drags adjust the neighbouring aside's width, double-click restores its default.
 *  A thin hit-strip with a hairline that lights up on hover/drag, like an IDE divider. */
function ResizeHandle({ onDrag, onReset }: { onDrag: (dx: number) => void; onReset: () => void }) {
  const last = useRef<number | null>(null);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className="mf-resize-handle"
      title="Drag to resize · double-click to reset"
      onDoubleClick={onReset}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = e.clientX;
      }}
      onPointerMove={(e) => {
        if (last.current === null) return;
        const dx = e.clientX - last.current;
        last.current = e.clientX;
        onDrag(dx);
      }}
      onPointerUp={(e) => {
        last.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      style={{
        flexShrink: 0,
        width: 7,
        cursor: "col-resize",
        display: "flex",
        justifyContent: "center",
        background: PANEL_BG,
        touchAction: "none",
      }}
    >
      <span style={{ width: 1, background: "var(--gray-a6)" }} />
    </div>
  );
}

/** Tabs of code editors that fill the height of their docked aside (Source / Output). */
function CodePanel({ tabs }: { tabs: { value: string; label: string; node: React.ReactNode }[] }) {
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
function CodeEditor(props: {
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
