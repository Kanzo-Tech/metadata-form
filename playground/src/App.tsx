import { useMemo } from "react";
import { Box, Card, Flex, Text, Theme } from "@radix-ui/themes";
import { FormAssistant, MetadataForm, useMetadataForm, type FormAssist } from "metadata-form";
import { Preferences, usePreferences } from "./Preferences.js";
import { Header } from "./components/Header.js";
import { AsideSection } from "./components/Aside.js";
import { CodePanel, CodeEditor } from "./components/CodePanel.js";
import { useMediaQuery } from "./hooks/useMediaQuery.js";
import { usePanels } from "./hooks/usePanels.js";
import { useHotkey } from "./hooks/useHotkey.js";
import { useFormOutputs } from "./hooks/useFormOutputs.js";
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
  const { source, output } = usePanels({
    narrow: isNarrow,
    animate: isNarrow && !reduceMotion,
    defaults: { source: DEFAULT_SOURCE_W, output: DEFAULT_OUTPUT_W },
  });

  // Keyboard toggles (S / O). Preferences owns the "," shortcut.
  useHotkey(useMemo(() => ({ S: source.toggle, O: output.toggle }), [source.toggle, output.toggle]));

  const form = useMetadataForm({
    shapes: applied.shapes,
    data: applied.data || undefined,
    validateOn: options.validateOn ?? "change",
    focusNode: options.focusNode,
    rootShape: options.rootShape,
    locale: options.locale,
    assist,
  });

  const outputs = useFormOutputs(form);

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
        { value: "turtle", label: "Turtle", node: <CodeEditor value={outputs.turtle} lang="turtle" readOnly dark={dark} /> },
        { value: "jsonld", label: "JSON-LD", node: <CodeEditor value={outputs.jsonld} lang="json" readOnly dark={dark} /> },
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
          onShare={async () => {
            // Capture the form's LIVE graph (its serialization), not the stale
            // source-panel text — so a permalink reproduces what you built.
            const dataText = form.ready ? await form.toTurtle() : workspace.dataText;
            share({ ...workspace.permalink, dataText });
          }}
          shared={shared}
          showSource={source.show}
          toggleSource={source.toggle}
          showOutput={output.show}
          toggleOutput={output.toggle}
          form={form}
        />

        {/* Workspace — wide: docked Source | Form | Output (draggable asides). Narrow: the
            form fills, and the single active panel slides over it as a drawer. */}
        <Flex style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <AsideSection
            side="left"
            narrow={isNarrow}
            presence={source.presence}
            width={source.width}
            onResize={source.setWidth}
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
            presence={output.presence}
            width={output.width}
            onResize={output.setWidth}
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
