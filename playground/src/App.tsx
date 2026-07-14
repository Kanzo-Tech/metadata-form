import { useEffect, useMemo, useState } from "react";
import { Box, Card, Flex, Separator, Text, Theme } from "@radix-ui/themes";
import { CodeIcon, FileTextIcon } from "@radix-ui/react-icons";
import { FormAssistant, MetadataForm, useMetadataForm, type FormAssist } from "metadata-form";
import { Preferences, usePreferences } from "./Preferences.js";
import { Header } from "./components/Header.js";
import { ExamplePickers } from "./components/ExamplePickers.js";
import { LocaleSelect } from "./components/LocaleSelect.js";
import { ShareButton } from "./components/ShareButton.js";
import { Toggle } from "./components/Toggle.js";
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

/** A consistent short vertical divider between header control groups. */
function HeaderDivider() {
  return <Separator orientation="vertical" style={{ height: 18, alignSelf: "center" }} />;
}

function ThemedApp() {
  const { prefs, update } = usePreferences();
  const apiKey = prefs.ai.claudeKey;

  // The assistance seam is wired only when an API key is present.
  const assist = useMemo<FormAssist | undefined>(() => (apiKey ? makeAssist(apiKey) : undefined), [apiKey]);

  // Permalink: the URL fragment is the source of truth. Hydrate from it on load,
  // keep it in sync on example/data picks, and copy it on Share.
  const { initial, writeUrl, share, shared } = useUrlState();
  const workspace = useWorkspace(initial, writeUrl);
  const { shapeText, dataText, setShapeText, setDataText, applied, shape, options } = workspace;
  // A bundled example may carry its own identity (logo bar + accent); when present
  // it overrides the user's accent so the playground wears that product's brand.
  const branding = shape.branding;
  // The example's brand may prefer an appearance; it wins while active (reverts on
  // switch). Drives both the Radix theme and the code editors.
  const appearance = branding?.appearance ?? prefs.theme.appearance;
  const dark = appearance === "dark";
  // UI-language selector: the shape's label languages, defaulting to the first.
  // Reset when the example changes so we land on its default language.
  const localeOptions = shape.uiLocales ?? [];
  const [uiLocale, setUiLocale] = useState<string | undefined>(undefined);
  useEffect(() => setUiLocale(undefined), [workspace.shapeId]);
  const locale = uiLocale ?? localeOptions[0] ?? options.locale;

  // Branded examples take over the browser tab: title + favicon (the brand mark),
  // restored to the playground defaults when a plain example is active.
  useEffect(() => {
    document.title = branding?.docTitle ?? "metadata-form playground";
  }, [branding?.docTitle]);
  useEffect(() => {
    const id = "mf-brand-favicon";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (branding?.faviconUrl) {
      if (!link) {
        link = document.createElement("link");
        link.id = id;
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = branding.faviconUrl;
    } else {
      link?.remove();
    }
  }, [branding?.faviconUrl]);

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
    locale,
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
      appearance={appearance}
      accentColor={(branding?.accentColor ?? prefs.theme.accentColor) as never}
      grayColor={(branding?.grayColor ?? prefs.theme.grayColor) as never}
      panelBackground={prefs.theme.panelBackground as never}
      radius={prefs.theme.radius}
      scaling={prefs.theme.scaling as never}
    >
      {/* IDE-style shell: a fixed top bar over a full-height workspace whose three
          regions (source aside | form main | output aside) each scroll on their own. */}
      <Flex direction="column" style={{ height: "100vh", overflow: "hidden" }}>
        {/* Brand-tinted top edge — a thin line of the brand accent (adapts to light/dark). */}
        {branding?.tint && <Box style={{ height: 3, flexShrink: 0, background: "var(--accent-9)" }} />}
        <Header
          form={form}
          branding={branding}
          tint={!!branding?.tint}
          pickers={
            <Flex align="center" gap="4">
              <ExamplePickers
                examples={workspace.examples}
                shapeId={workspace.shapeId}
                presets={shape.presets}
                presetId={workspace.presetId}
                onPickShape={workspace.pickShape}
                onPickPreset={workspace.pickPreset}
              />
              {localeOptions.length > 1 && locale && (
                <>
                  <HeaderDivider />
                  <LocaleSelect value={locale} locales={localeOptions} onChange={setUiLocale} />
                </>
              )}
              <HeaderDivider />
              <ShareButton
                shared={shared}
                onShare={async () => {
                  // Capture the form's LIVE graph (its serialization), not the stale
                  // source-panel text — so a permalink reproduces what you built.
                  const dataText = form.ready ? await form.toTurtle() : workspace.dataText;
                  share({ ...workspace.permalink, dataText });
                }}
              />
            </Flex>
          }
          actions={
            <>
              <Toggle on={source.show} onClick={source.toggle} icon={<FileTextIcon />} kbd="S">
                Source
              </Toggle>
              <Toggle on={output.show} onClick={output.toggle} icon={<CodeIcon />} kbd="O">
                Output
              </Toggle>
            </>
          }
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
