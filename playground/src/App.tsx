import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Card, Flex, Text, Theme } from "@radix-ui/themes";
import { FormAssistant, MetadataForm, useMetadataForm, type FormAssist } from "metadata-form";
import { Preferences, usePreferences } from "./Preferences.js";
import { Header } from "./components/Header.js";
import { AsideSection } from "./components/Aside.js";
import { CodePanel, CodeEditor } from "./components/CodePanel.js";
import { useMediaQuery } from "./hooks/useMediaQuery.js";
import { useAsidePresence } from "./hooks/useAsidePresence.js";
import { useUrlState } from "./hooks/useUrlState.js";
import { useWorkspace } from "./state/useWorkspace.js";
import { makeAssist } from "./lib/assist.js";
import "@radix-ui/themes/styles.css";

const DEFAULT_SOURCE_W = 380;
const DEFAULT_OUTPUT_W = 440;

/** Below this width the two asides can't sit beside the form, so the layout switches
 *  to form-only with a single overlay drawer. */
const NARROW = "(max-width: 1024px)";

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

  // Permalink: the URL fragment is the source of truth. Hydrate from it on load,
  // keep it in sync on example/data picks, and copy it on Share.
  const { initial, writeUrl, share, shared } = useUrlState();
  const workspace = useWorkspace(initial, writeUrl);
  const { shapeText, dataText, setShapeText, setDataText, applied, shape, options } = workspace;

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

  const form = useMetadataForm({
    shapes: applied.shapes,
    data: applied.data || undefined,
    validateOn: options.validateOn ?? "change",
    focusNode: options.focusNode,
    rootShape: options.rootShape,
    locale: options.locale,
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
        <Header
          examples={workspace.examples}
          shapeId={workspace.shapeId}
          dataOptions={shape.data}
          dataId={workspace.dataId}
          onPickShape={workspace.pickShape}
          onPickData={workspace.pickData}
          onShare={() => share(workspace.permalink)}
          shared={shared}
          showSource={showSource}
          toggleSource={toggleSource}
          showOutput={showOutput}
          toggleOutput={toggleOutput}
          form={form}
        />

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
                <MetadataForm form={form} layout={prefs.layout.mode} grid={{ columns: prefs.layout.columns }} />
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
