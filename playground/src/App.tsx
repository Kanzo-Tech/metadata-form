import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  KanzoThemeProvider,
  ShellAside,
  ShellBody,
  ShellHeader,
  ShellMain,
  ShellRoot,
} from "@kanzo-tech/ui";
import { Code2Icon, FileTextIcon } from "lucide-react";
import { PaneHeader } from "./components/PaneHeader.js";
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
import { INSTANCE, brandingFor, defaultThemeFor, policyFor } from "./instance.js";
import type { ExampleBranding } from "./presets.js";
import { makeAssist } from "./lib/assist.js";
import "@kanzo-tech/ui/styles.css";

/** Default split of the workspace row, as percentages: source | form | output. */
const SPLIT_ALL = [24, 46, 30];
const SPLIT_ONE_ASIDE = [30, 70];

/** Below this width the two asides can't sit beside the form, so the layout switches
 *  to form-only with a single overlay drawer. */
const NARROW = "(max-width: 1024px)";

export function App() {
  // Permalink and workspace live ABOVE the provider, and that is the whole cost of a
  // branded example: the theme it wears is a provider prop, so which example is open
  // has to be known before the provider mounts. The URL is read once, synchronously,
  // so there is no flash of the wrong brand.
  const url = useUrlState();
  const workspace = useWorkspace(url.initial, url.writeUrl);
  const branding = brandingFor(workspace.shape);
  // Memoized because it is an object: a fresh literal every render would re-resolve
  // the theme — and therefore re-run every consumer of the theme context — on every
  // keystroke in the source editors.
  const defaultTheme = useMemo(() => defaultThemeFor(workspace.shape), [workspace.shape]);
  const policy = useMemo(() => policyFor(workspace.shape), [workspace.shape]);

  return (
    // The theme lives on <html>, not on a wrapper element: Ark's overlays portal
    // to document.body, outside anything a wrapper could reach, and density sets
    // the root font-size the whole rem scale resolves against.
    //
    // `themes` is what this deployment PUBLISHES and `defaultTheme` is what each side
    // defers to while nobody has chosen — a deferral target, never a preference, so a
    // branded example cannot overwrite a reader's saved theme. Publishing fewer than
    // two would hide the colour section, which is also the page's only light/dark
    // control; pinning would hide it outright. See `instance.ts`.
    <KanzoThemeProvider themes={INSTANCE.themes} defaultTheme={defaultTheme} policy={policy}>
      <Preferences.Root>
        <ThemedApp url={url} workspace={workspace} branding={branding} />
      </Preferences.Root>
    </KanzoThemeProvider>
  );
}


function ThemedApp({
  url,
  workspace,
  branding,
}: {
  url: ReturnType<typeof useUrlState>;
  workspace: ReturnType<typeof useWorkspace>;
  branding: ExampleBranding | undefined;
}) {
  const { prefs, update } = usePreferences();
  const apiKey = prefs.ai.claudeKey;

  // The assistance seam is wired only when an API key is present.
  const assist = useMemo<FormAssist | undefined>(() => (apiKey ? makeAssist(apiKey) : undefined), [apiKey]);

  const { share, status: shareStatus, decoded } = url;
  const { shapeText, dataText, setShapeText, setDataText, applied, shape, options } = workspace;
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

  // What the fragment turned out to be, when it was not a document.
  const [dismissed, setDismissed] = useState(false);
  const notice =
    decoded.status === "unreadable"
      ? {
          title: "That link did not survive the trip",
          detail: "The address carried a permalink we could not read — most likely truncated on the way here. Ask for it again, or start from an example below.",
        }
      : decoded.status === "unknown"
        ? {
            title: `This deployment does not ship “${decoded.exampleId}”`,
            detail: "The link names a shape set by id, which only resolves where that shape set is installed. Ask the sender for a link with the shapes embedded.",
          }
        : null;

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

  /**
   * The other half of "shareable by reference": the form's graph is still the one the
   * preset loaded.
   *
   * It cannot be a text comparison against the preset's Turtle — the data round-trips
   * through rudof and comes back reserialized — so the baseline is what the graph says
   * before anybody has typed, captured once per applied preset. Equal to it means the
   * link may name the preset and carry nothing else; different means embed.
   */
  const [baseline, setBaseline] = useState<string | null>(null);
  useEffect(() => setBaseline(null), [workspace.shapeId, workspace.presetId]);
  useEffect(() => {
    if (!form.ready || baseline !== null) return;
    let live = true;
    void form.toTurtle().then((turtle) => live && setBaseline(turtle));
    return () => {
      live = false;
    };
  }, [form, baseline]);

  // Panel content defined once and reused by the docked aside (wide) and the drawer (narrow).
  // Each panel carries its own header: what it is, a close, and — for Source — the
  // pickers, because they replace the document it is showing and a control belongs
  // against the thing it acts on.
  const sourcePanel = (
    <>
      <PaneHeader
        icon={FileTextIcon}
        title="Source"
        onClose={source.toggle}
        actions={
          <ExamplePickers
            examples={workspace.examples}
            shapeId={workspace.shapeId}
            presets={shape.presets}
            presetId={workspace.presetId}
            onPickShape={workspace.pickShape}
            onPickPreset={workspace.pickPreset}
          />
        }
      />
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
    </>
  );

  const outputPanel = (
    <>
      <PaneHeader icon={Code2Icon} title="Output" onClose={output.toggle} />
      <CodePanel
        tabs={[
          { value: "turtle", label: "Turtle", node: <CodeEditor value={outputs.turtle} lang="turtle" readOnly /> },
          { value: "jsonld", label: "JSON-LD", node: <CodeEditor value={outputs.jsonld} lang="json" readOnly /> },
        ]}
      />
    </>
  );

  const formColumn = (
    <ShellMain>
      <div style={{ margin: "0 auto", width: "100%", maxWidth: "48rem", padding: "2rem 1.5rem" }}>
        {form.error ? (
          <Card>
            <CardContent className="text-destructive-foreground" style={{ paddingBlock: "1.5rem" }}>
              {form.error.message}
            </CardContent>
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
            <ShellAside side="start" aria-label="Source" className="h-full bg-card">
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
            <ShellAside side="end" aria-label="Output" className="h-full bg-card">
              {outputPanel}
            </ShellAside>
          ),
        }]
      : []),
  ];

  const overlay = isNarrow && (source.show || output.show);

  return (
    <ShellRoot>
      {/* Brand-tinted top edge — a thin line of the theme's primary. The height
          is inline: `h-[3px]` is an arbitrary-value class, and nothing compiles
          Tailwind here, so it painted a 0px-tall line until this was noticed. */}
      {branding?.tint && <div className="bg-primary" style={{ height: "3px", flex: "none" }} />}
      <ShellHeader>
        <Header
          form={form}
          branding={branding}
          actions={
            <>
              {localeOptions.length > 1 && locale && (
                <LocaleSelect value={locale} locales={localeOptions} onChange={setUiLocale} />
              )}
              <ShareButton
                status={shareStatus}
                onShare={async () => {
                  // Capture the form's LIVE graph (its serialization), not the stale
                  // source-panel text — so a permalink reproduces what you built.
                  const dataText = form.ready ? await form.toTurtle() : workspace.dataText;
                  // The reader's chosen language rides along: it is a view knob, but a
                  // link to a Spanish form that opens in English is the wrong document.
                  share(
                    { ...workspace.permalink, dataText, locale: uiLocale },
                    workspace.sourcePristine && dataText === baseline,
                  );
                }}
              />
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

      {/* A link that arrived broken says so. Both of these used to decode to `null`
          and open the default example without a word — which, from the side of the
          person who shared it, is indistinguishable from Share doing nothing. Long
          links invite exactly this: chat clients truncate them. */}
      {notice && !dismissed && (
        <Alert variant="warning" style={{ flex: "none", margin: "0.5rem 0.75rem 0" }}>
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.detail}</AlertDescription>
          <AlertAction>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
              Dismiss
            </Button>
          </AlertAction>
        </Alert>
      )}

      <ShellBody>
        {overlay ? (
          <>
            {formColumn}
            {/* `bg-card` is load-bearing: ShellAside is presentational and paints
                nothing, so an overlay without a surface shows the form straight
                through it. The deleted Aside.tsx carried this as PANEL_BG. */}
            <ShellAside
              overlay
              className="bg-card"
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
