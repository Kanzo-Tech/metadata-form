import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  KanzoThemeProvider,
  Separator,
  ShellAside,
  ShellBody,
  ShellHeader,
  ShellMain,
  ShellRoot,
} from "@kanzo-tech/ui";
import { Code2Icon, FileTextIcon } from "lucide-react";
import { FormAssistant, MetadataForm, useMetadataForm, type FormAssist } from "metadata-form";
import { Preferences, usePreferences } from "./Preferences.js";
import { Header } from "./components/Header.js";
import { ExamplePickers } from "./components/ExamplePickers.js";
import { LocaleSelect } from "./components/LocaleSelect.js";
import { ShareButton } from "./components/ShareButton.js";
import { Toggle } from "./components/Toggle.js";
import { WorkspaceColumns, type WorkspaceColumn } from "./components/Workspace.js";
import { CodePanel, CodeEditor } from "./components/CodePanel.js";
import { useMediaQuery } from "./hooks/useMediaQuery.js";
import { usePanels } from "./hooks/usePanels.js";
import { useHotkey } from "./hooks/useHotkey.js";
import { useFormOutputs } from "./hooks/useFormOutputs.js";
import { useUrlState } from "./hooks/useUrlState.js";
import { useWorkspace } from "./state/useWorkspace.js";
import { makeAssist } from "./lib/assist.js";
import "@kanzo-tech/ui/styles.css";

/** Default split of the workspace row, as percentages: source | form | output. */
const SPLIT_ALL = [24, 46, 30];
const SPLIT_ONE_ASIDE = [30, 70];

/** Below this width the two asides can't sit beside the form, so the layout switches
 *  to form-only with a single overlay drawer. */
const NARROW = "(max-width: 1024px)";

export function App() {
  return (
    // The theme lives on <html>, not on a wrapper element: Ark's overlays portal
    // to document.body, outside anything a wrapper could reach, and density sets
    // the root font-size the whole rem scale resolves against.
    <KanzoThemeProvider>
      <Preferences.Root>
        <ThemedApp />
      </Preferences.Root>
    </KanzoThemeProvider>
  );
}

/** A consistent short vertical divider between header control groups. */
function HeaderDivider() {
  return <Separator orientation="vertical" className="h-4.5 self-center" />;
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
  // `branding.theme` names a published theme but is NOT applied — see the field's
  // own comment for why (it would overwrite the user's persisted choice). What did
  // change is that nothing here has to be told which look is on any more: the
  // theme is on <html>, so the code editors read it themselves rather than taking
  // a `dark` prop computed up here.
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
  const { source, output } = usePanels({ narrow: isNarrow });

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
          node: <CodeEditor value={shapeText} onChange={setShapeText} lang="turtle" />,
        },
        {
          value: "data",
          label: "Data graph",
          node: <CodeEditor value={dataText} onChange={setDataText} lang="turtle" />,
        },
      ]}
    />
  );
  const outputPanel = (
    <CodePanel
      tabs={[
        { value: "turtle", label: "Turtle", node: <CodeEditor value={outputs.turtle} lang="turtle" readOnly /> },
        { value: "jsonld", label: "JSON-LD", node: <CodeEditor value={outputs.jsonld} lang="json" readOnly /> },
      ]}
    />
  );

  const formColumn = (
    <ShellMain>
      <div className="mx-auto w-full max-w-[1080px] p-5">
        {form.error ? (
          <Card>
            <CardContent className="pt-6 text-destructive-foreground">{form.error.message}</CardContent>
          </Card>
        ) : (
          <MetadataForm form={form} layout={prefs.layout.mode} grid={{ columns: prefs.layout.columns }} />
        )}
      </div>
    </ShellMain>
  );

  // Wide: the open panels sit beside the form as columns of one draggable row.
  // Narrow: the form fills and the single active panel is an overlay aside.
  const columns: WorkspaceColumn[] = [
    ...(source.show
      ? [{
          id: "source",
          minSize: 15,
          node: (
            <ShellAside side="start" aria-label="Source" className="h-full">
              {sourcePanel}
            </ShellAside>
          ),
        }]
      : []),
    { id: "form", minSize: 30, node: formColumn },
    ...(output.show
      ? [{
          id: "output",
          minSize: 15,
          node: (
            <ShellAside side="end" aria-label="Output" className="h-full">
              {outputPanel}
            </ShellAside>
          ),
        }]
      : []),
  ];

  const overlay = isNarrow && (source.show || output.show);

  return (
    <ShellRoot>
      {/* Brand-tinted top edge — a thin line of the theme's primary. */}
      {branding?.tint && <div className="h-[3px] flex-none bg-primary" />}
      <ShellHeader>
        <Header
          form={form}
          branding={branding}
          tint={!!branding?.tint}
          pickers={
            <div className="flex items-center gap-4">
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
            </div>
          }
          actions={
            <>
              <Toggle on={source.show} onClick={source.toggle} icon={<FileTextIcon />} kbd="S">
                Source
              </Toggle>
              <Toggle on={output.show} onClick={output.toggle} icon={<Code2Icon />} kbd="O">
                Output
              </Toggle>
            </>
          }
        />
      </ShellHeader>

      <ShellBody>
        {overlay ? (
          <>
            {formColumn}
            <ShellAside
              overlay
              side={source.show ? "start" : "end"}
              aria-label={source.show ? "Source" : "Output"}
            >
              {source.show ? sourcePanel : outputPanel}
            </ShellAside>
          </>
        ) : (
          <WorkspaceColumns
            columns={columns}
            defaultSize={columns.length === 3 ? SPLIT_ALL : SPLIT_ONE_ASIDE}
          />
        )}
      </ShellBody>

      {prefs.assistant.enabled && (
        <FormAssistant form={form} onDismiss={() => update("assistant", { enabled: false })} />
      )}

      {/* The FAB and the drawer. The panel composes its own sections now — ours
          first, then the design system's theme axes. */}
      <Preferences.Trigger />
      <Preferences.Panel />
    </ShellRoot>
  );
}
