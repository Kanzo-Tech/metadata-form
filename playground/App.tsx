import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Kbd,
  Select as RSelect,
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

const PANEL_HEIGHT = 480;
const turtleLang = StreamLanguage.define(turtle);
const cmFont = EditorView.theme({
  "&": { fontSize: "12px" },
  ".cm-content": { fontFamily: "var(--code-font-family, ui-monospace, monospace)" },
});

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
  const [showSource, setShowSource] = useState(false);
  const [showOutput, setShowOutput] = useState(true);

  // Keyboard toggles (S / O). Preferences owns the "," shortcut.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const k = e.key.toUpperCase();
      if (k === "S") setShowSource((v) => !v);
      else if (k === "O") setShowOutput((v) => !v);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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

  const cols = [showSource && "minmax(0, 0.95fr)", "minmax(0, 1.2fr)", showOutput && "minmax(0, 1fr)"]
    .filter(Boolean)
    .join(" ");

  return (
    <Theme
      appearance={prefs.theme.appearance}
      accentColor={prefs.theme.accentColor as never}
      grayColor={prefs.theme.grayColor as never}
      panelBackground={prefs.theme.panelBackground as never}
      radius={prefs.theme.radius}
      scaling={prefs.theme.scaling as never}
    >
      <Box p="5" style={{ maxWidth: 1700, margin: "0 auto" }}>
        {/* Header */}
        <Flex direction="column" gap="1" mb="4">
          <Heading size="7">metadata-form</Heading>
          <Text size="2" color="gray">
            Auto-generate editable RDF metadata forms from SHACL/DASH shapes — edit the form, get
            Turtle &amp; JSON-LD.
          </Text>
        </Flex>

        {/* Toolbar */}
        <Flex align="center" gap="3" wrap="wrap" mb="4">
          <Field label="Shape">
            <RSelect.Root value={shapeId} onValueChange={pickShape}>
              <RSelect.Trigger />
              <RSelect.Content>
                {EXAMPLES.map((e) => (
                  <RSelect.Item key={e.id} value={e.id}>
                    {e.label}
                  </RSelect.Item>
                ))}
              </RSelect.Content>
            </RSelect.Root>
          </Field>
          <Field label="Data">
            <RSelect.Root value={dataId} onValueChange={pickData}>
              <RSelect.Trigger />
              <RSelect.Content>
                {shape.data.map((d) => (
                  <RSelect.Item key={d.id} value={d.id}>
                    {d.label}
                  </RSelect.Item>
                ))}
              </RSelect.Content>
            </RSelect.Root>
          </Field>

          <Box flexGrow="1" />

          <Toggle on={showSource} onClick={() => setShowSource((v) => !v)} icon={<FileTextIcon />} kbd="S">
            Source
          </Toggle>
          <Toggle on={showOutput} onClick={() => setShowOutput((v) => !v)} icon={<CodeIcon />} kbd="O">
            Output
          </Toggle>
          {/* The canonical validation summary — same in every layout (per-section
              badges in tabs/steps are wayfinding dots, not a competing counter). */}
          <ValidationSummary form={form} />
          <Text size="1" color="gray">
            Preferences <Kbd>P</Kbd>
          </Text>
        </Flex>

        {/* Columns: Source (toggle) | Form (fixed) | Output (toggle) */}
        <Box style={{ display: "grid", gridTemplateColumns: cols, gap: "1rem", alignItems: "start" }}>
          {showSource && (
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
          )}

          <Box style={{ minWidth: 0 }}>
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

          {showOutput && (
            <CodePanel
              tabs={[
                { value: "turtle", label: "Turtle", node: <CodeEditor value={turtleOut} lang="turtle" readOnly dark={dark} /> },
                { value: "jsonld", label: "JSON-LD", node: <CodeEditor value={jsonldOut} lang="json" readOnly dark={dark} /> },
              ]}
            />
          )}
        </Box>
      </Box>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Flex align="center" gap="2">
      <Text size="2" color="gray">
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
    <Button variant={props.on ? "solid" : "soft"} color={props.on ? undefined : "gray"} onClick={props.onClick}>
      {props.icon}
      {props.children}
      <Kbd size="1">{props.kbd}</Kbd>
    </Button>
  );
}

/** A Card with tabs of code editors — shared by the Source and Output columns. */
function CodePanel({ tabs }: { tabs: { value: string; label: string; node: React.ReactNode }[] }) {
  return (
    <Card style={{ minWidth: 0 }}>
      <Tabs.Root defaultValue={tabs[0].value}>
        <Tabs.List>
          {tabs.map((t) => (
            <Tabs.Trigger key={t.value} value={t.value}>
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Box pt="2">
          {tabs.map((t) => (
            <Tabs.Content key={t.value} value={t.value}>
              {t.node}
            </Tabs.Content>
          ))}
        </Box>
      </Tabs.Root>
    </Card>
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
      height={`${PANEL_HEIGHT}px`}
      theme={props.dark ? "dark" : "light"}
      editable={!props.readOnly}
      readOnly={props.readOnly}
      extensions={[props.lang === "json" ? json() : turtleLang, cmFont]}
      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: !props.readOnly }}
      onChange={props.onChange}
    />
  );
}
