import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  DownloadTrigger,
  JsonTreeView,
  KanzoThemeProvider,
  PreferencesRoot,
  PreferencesTrigger,
  ShellAside,
  ShellBody,
  ShellHeader,
  ShellMain,
  ShellRoot,
} from "@kanzo-tech/ui";
import { AssistProvider } from "@kanzo-tech/ai";
import { Code2Icon, DownloadIcon, FileTextIcon } from "lucide-react";
import { MetadataForm, useMetadataForm } from "@kanzo-tech/metadata-form";
import { assistTranslations, assistUi } from "@kanzo-tech/metadata-form/ai";
import { es, ca } from "@kanzo-tech/metadata-form/i18n";
import { PLAYGROUND_SECTION, PreferencesPanelContent, useClaudeKey, useClaudeModel, useLayoutPrefs, useMascot } from "./Preferences.js";
import { Header } from "./components/Header.js";
import { ExamplePickers } from "./components/ExamplePickers.js";
import { LocaleSelect } from "./components/LocaleSelect.js";
import { initialLanguage } from "./lib/language.js";
import { ShareButton } from "./components/ShareButton.js";
import { Companion } from "./components/Companion.js";
import { PanelRail } from "./components/PanelRail.js";
import { WorkspaceColumns, type WorkspaceColumn } from "./components/Workspace.js";
import { DocumentPane, CodeEditor } from "./components/DocumentPane.js";
import { useMediaQuery } from "./hooks/useMediaQuery.js";
import { usePanels } from "./hooks/usePanels.js";
import { useHotkey } from "./hooks/useHotkey.js";
import { useFormOutputs } from "./hooks/useFormOutputs.js";
import { useUrlState } from "./hooks/useUrlState.js";
import { useWorkspace } from "./state/useWorkspace.js";
import { ChromeContext, fill, pickChrome } from "./i18n.js";
import { makeModel } from "./lib/assist.js";
import { DEFAULT_THEME } from "./theme.js";

/** The form keeps what the panels do not take: 24% each, down to a floor of 34%.
 *  Written as a sum rather than a table of splits — there are eight open-sets with
 *  three panels, and the table was already two ternaries deep at two. */
const asideSplit = (asides: number) => {
  const main = Math.max(34, 100 - asides * 24);
  return { main, aside: (100 - main) / asides };
};

/** Below this width the asides can't sit beside the form, so the layout switches
 *  to form-only with a single overlay drawer. */
const NARROW = "(max-width: 1024px)";

/** The interface strings of the languages the library ships beyond English: data
 *  the playground imports from `@kanzo-tech/metadata-form/i18n`, like any consumer. */
const STRINGS = { es: es.strings, ca: ca.strings };

export function App() {
  // The URL is read once, synchronously, so the workspace seeds from it before
  // first paint.
  const url = useUrlState();
  const workspace = useWorkspace(url.initial, url.writeUrl);

  return (
    // The theme lives on <html>, not on a wrapper element: Ark's overlays portal
    // to document.body, outside anything a wrapper could reach, and density sets
    // the root font-size the whole rem scale resolves against.
    <KanzoThemeProvider defaultTheme={DEFAULT_THEME} sections={[PLAYGROUND_SECTION]}>
      {/* `p`, opt-in: a design system must not claim an unmodified key in its
          host's keymap without being asked. */}
      <PreferencesRoot hotkey="p">
        <ThemedApp url={url} workspace={workspace} />
      </PreferencesRoot>
    </KanzoThemeProvider>
  );
}


function ThemedApp({
  url,
  workspace,
}: {
  url: ReturnType<typeof useUrlState>;
  workspace: ReturnType<typeof useWorkspace>;
}) {
  const [apiKey] = useClaudeKey();
  const [model] = useClaudeModel();
  const layoutPrefs = useLayoutPrefs();
  const [mascot, setMascot] = useMascot();

  // Model assistance is drawn only when there is a key to call a model with.
  const languageModel = useMemo(() => (apiKey ? makeModel(apiKey, model) : undefined), [apiKey, model]);

  const { share, status: shareStatus, decoded } = url;
  const { shapeText, dataText, setShapeText, setDataText, applied, shape } = workspace;
  const { options } = applied;
  // UI-language selector: the languages the loaded shapes are written in, which the
  // form reports once it has read them. The reader's own choice wins; before that,
  // the browser's preference among them, else the most written. Reset when the
  // example changes so we land on its default language.
  const [languages, setLanguages] = useState<string[]>([]);
  const [uiLocale, setUiLocale] = useState<string | undefined>(undefined);
  useEffect(() => setUiLocale(undefined), [workspace.shapeId]);
  const locale =
    uiLocale && languages.includes(uiLocale) ? uiLocale : initialLanguage(languages, navigator.languages) ?? options.locale;
  // The workspace's own words follow the form's language, from the playground's
  // catalog rather than the library's — see `i18n.ts` for where that line is drawn.
  // A pane header reading "Issues · 3 blocking of 3" over a Spanish panel is the
  // half-translated page this exists to stop.
  const chrome = useMemo(() => pickChrome(locale), [locale]);

  // What the fragment turned out to be, when it was not a document.
  const [dismissed, setDismissed] = useState(false);
  const notice =
    decoded.status === "unreadable"
      ? { title: chrome.notice.truncatedTitle, detail: chrome.notice.truncatedDetail }
      : decoded.status === "unknown"
        ? {
            title: fill(chrome.notice.unknownTitle, { id: decoded.exampleId }),
            detail: chrome.notice.unknownDetail,
          }
        : null;

  const isNarrow = useMediaQuery(NARROW);
  const { panels, open, setOpen } = usePanels({ narrow: isNarrow });
  const { source, output } = panels;

  // Keyboard toggles (S / O). Preferences owns the "P" shortcut.
  useHotkey(useMemo(() => ({ S: source.toggle, O: output.toggle }), [source.toggle, output.toggle]));

  // Which document each pane is showing. They live HERE, above `ShellBody`, and
  // that is not a preference: opening any panel re-keys the splitter, the re-key
  // remounts every column, and state held inside a column would reset as the
  // reader used it.
  const [sourceDoc, setSourceDoc] = useState<"shape" | "data">("shape");
  const [outputDoc, setOutputDoc] = useState<"turtle" | "jsonld">("turtle");

  const form = useMetadataForm({
    shapes: applied.shapes,
    data: applied.data || undefined,
    validateOn: options.validateOn ?? "change",
    focusNode: options.focusNode,
    rootShape: options.rootShape,
    locale,
    strings: STRINGS,
  });

  useEffect(() => setLanguages(form.availableLanguages), [form.availableLanguages]);

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

  // Panel content defined once and reused by the docked aside (wide) and the drawer
  // (narrow). Each panel carries its own header: what it is, which of its documents
  // it is showing, and a close.
  const sourcePanel = (
    <DocumentPane
      icon={FileTextIcon}
      title={chrome.panes.source}
      onClose={source.toggle}
      value={sourceDoc}
      onValueChange={setSourceDoc}
      tabs={[
        {
          value: "shape",
          label: chrome.source.shapeTab,
          node: <CodeEditor value={shapeText} onChange={setShapeText} lang="turtle" />,
        },
        {
          value: "data",
          label: chrome.source.dataTab,
          node: <CodeEditor value={dataText} onChange={setDataText} lang="turtle" />,
        },
      ]}
    />
  );

  // Two renderings of one graph, chosen like Source's two documents are. JSON-LD is
  // a tree, not text: the object survives all the way here, so the reader can
  // collapse a node instead of scrolling past it.
  const outputFormat = outputDoc === "turtle" ? "Turtle" : "JSON-LD";
  const outputPanel = (
    <DocumentPane
      icon={Code2Icon}
      title={chrome.panes.output}
      onClose={output.toggle}
      value={outputDoc}
      onValueChange={setOutputDoc}
      tabs={[
        { value: "turtle", label: "Turtle", node: <CodeEditor value={outputs.turtle} lang="turtle" readOnly /> },
        {
          value: "jsonld",
          label: "JSON-LD",
          node: (
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {outputs.jsonld ? <JsonTreeView data={outputs.jsonld} defaultExpandedDepth={2} /> : null}
            </div>
          ),
        },
      ]}
      actions={
        // `data` is deferred, so the graph is serialized when somebody asks for the
        // file and not on every keystroke — and there is no object URL of ours to
        // build, revoke or leak.
        <DownloadTrigger
          asChild
          data={outputDoc === "turtle" ? () => form.toTurtle() : () => form.toJsonLd().then((j) => JSON.stringify(j, null, 2))}
          fileName={outputDoc === "turtle" ? "metadata.ttl" : "metadata.jsonld"}
          mimeType={outputDoc === "turtle" ? "text/turtle" : "application/ld+json"}
        >
          <Button
            aria-label={fill(chrome.output.download, { format: outputFormat })}
            className="bg-card text-muted-foreground"
            size="icon-sm"
            variant="outline"
          >
            <DownloadIcon />
          </Button>
        </DownloadTrigger>
      }
    />
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
        ) : languageModel ? (
          <AssistProvider model={languageModel} translations={assistTranslations(form.strings)}>
            <MetadataForm form={form} assistUi={assistUi} layout={layoutPrefs.layout} grid={{ columns: layoutPrefs.columns }} />
          </AssistProvider>
        ) : (
          <MetadataForm form={form} layout={layoutPrefs.layout} grid={{ columns: layoutPrefs.columns }} />
        )}
      </div>
    </ShellMain>
  );

  // Wide: the open panels sit beside the form as columns of one draggable row, in
  // reading order — the shapes that define the form, the form, and what it
  // produces. What validation found is not a column: the tally in the header lists
  // it and marks it on the fields, which is where a finding is fixed. Narrow: the form fills and the single active panel is an
  // overlay aside.
  const aside = (id: string, label: string, side: "start" | "end", body: React.ReactNode) => ({
    id,
    minSize: 16,
    node: (
      // `bg-card` is load-bearing: ShellAside is presentational and paints nothing.
      <ShellAside side={side} aria-label={label} className="h-full bg-card">
        {body}
      </ShellAside>
    ),
  });

  const columns: WorkspaceColumn[] = [
    ...(source.show ? [aside("source", chrome.panes.source, "start", sourcePanel)] : []),
    { id: "form", minSize: 34, node: formColumn },
    ...(output.show ? [aside("output", chrome.panes.output, "end", outputPanel)] : []),
  ];
  const split = asideSplit(Math.max(1, columns.length - 1));

  const activePanel = source.show ? sourcePanel : outputPanel;
  const overlay = isNarrow && open.length > 0;

  return (
    // Everything below reads its own words from here — the pane headers, the rail,
    // Share, and the preferences drawer, which renders inside this tree even though
    // its root sits above it.
    <ChromeContext.Provider value={chrome}>
      <ShellRoot>
        <ShellHeader>
          <Header
            form={form}
            pickers={
              <ExamplePickers
                examples={workspace.examples}
                shapeId={workspace.shapeId}
                onPickShape={workspace.pickShape}
                presets={shape.presets}
                presetId={workspace.presetId}
                onPickPreset={workspace.pickPreset}
              />
            }
            actions={
              <>
                {locale && <LocaleSelect value={locale} locales={languages} onChange={setUiLocale} />}
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
                {/* No panel toggles here. A control that opens a region belongs against
                    the region — they are on the rail now, on the edge they open on. */}
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
                {chrome.notice.dismiss}
              </Button>
            </AlertAction>
          </Alert>
        )}

        <ShellBody>
          {/* Which panels are open, drawn as icons on the edge they open on. First
              child of the body, so it keeps its strip whatever the workspace does. */}
          <PanelRail
            label={chrome.panes.rail}
            onValueChange={setOpen}
            panels={[
              { icon: FileTextIcon, label: `${chrome.panes.source} — ${chrome.panes.sourceHint} (S)`, value: "source" },
              { icon: Code2Icon, label: `${chrome.panes.output} — ${chrome.panes.outputHint} (O)`, value: "output" },
            ]}
            value={open}
          />

          {/* The workspace is wrapped, and the wrapper is the rail's whole defence: the
              narrow branch's aside is `absolute inset-0`, and inset-0 of the BODY would
              have covered the rail along with the form. */}
          <div className="relative flex min-w-0 flex-1">
            {overlay ? (
              <>
                {formColumn}
                {/* `bg-card` is load-bearing: ShellAside is presentational and paints
                    nothing, so an overlay without a surface shows the form straight
                    through it. The deleted Aside.tsx carried this as PANEL_BG. The
                    last two readers of that constant are gone, so `panel.ts` went
                    with them. */}
                <ShellAside
                  overlay
                  className="bg-card"
                  side={source.show ? "start" : "end"}
                  aria-label={source.show ? chrome.panes.source : chrome.panes.output}
                >
                  {activePanel}
                </ShellAside>
              </>
            ) : (
              <WorkspaceColumns
                columns={columns}
                defaultSize={columns.map((c) => (c.id === "form" ? split.main : split.aside))}
              />
            )}
          </div>
        </ShellBody>

        {mascot && (
          // The FAB is fixed bottom-end and owns that spot (it is the design system's,
          // and every showcase puts it there); the companion is the guest, so it moves
          // up by the FAB's height and its gap rather than sitting on top of it.
          <Companion
            report={form.report}
            onReveal={form.revealField}
            offset="4rem"
            onDismiss={() => setMascot(false)}
          />
        )}

        {/* The FAB and the drawer: every section, the theme's and ours, then the key. */}
        <PreferencesTrigger />
        <PreferencesPanelContent />
      </ShellRoot>
    </ChromeContext.Provider>
  );
}
