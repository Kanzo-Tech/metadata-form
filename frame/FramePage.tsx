import { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Diagnostic,
  DiagnosticActions,
  DiagnosticHeader,
  DiagnosticSeverity,
  DiagnosticSource,
  DiagnosticTitle,
  FindingsContent,
  FindingsGoTo,
  FindingsGroup,
  FindingsRoot,
  FindingsTrigger,
  KanzoThemeProvider,
} from "@kanzo-tech/ui";
import {
  MetadataForm,
  useMetadataForm,
  type IssueRow,
  type MetadataFormController,
} from "@kanzo-tech/metadata-form";
import { ca, es } from "@kanzo-tech/metadata-form/i18n";
import {
  EMBED_TEXTS,
  isHostMessage,
  type EmbedConfig,
  type EmbedTexts,
  type EmbedToHost,
  type EmbedVariant,
  type HostToEmbed,
} from "@kanzo-tech/metadata-form/embed";

/** How the page talks to the app that frames it. */
export interface Channel {
  post(message: EmbedToHost): void;
  listen(handler: (message: HostToEmbed) => void): () => void;
}

/** The channel to the parent window, or none when the page is not framed.
 *  The app's origin is the page's own unless its URL says another (`?origin=`). */
export function parentChannel(): Channel | undefined {
  if (window.parent === window) return undefined;
  const origin = new URLSearchParams(window.location.search).get("origin") ?? window.location.origin;
  return {
    post: (message) => window.parent.postMessage(message, origin),
    listen(handler) {
      function onMessage(e: MessageEvent) {
        if (e.source !== window.parent || e.origin !== origin) return;
        if (isHostMessage(e.data)) handler(e.data);
      }
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    },
  };
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));

const primary = (tag: string) => tag.split("-")[0].toLowerCase();

/** The reader's languages: the one picked in the page's selector first, then
 *  the app's (`locale`), else the browser's. */
function readerLanguages(locale: EmbedConfig["locale"], picked?: string): string[] {
  const base = locale === undefined ? [...navigator.languages] : typeof locale === "string" ? [locale] : [...locale];
  return picked ? [picked, ...base.filter((l) => l !== picked)] : base;
}

/** The page's texts in the first of the reader's languages it has them in
 *  (English otherwise), with the app's over them. */
function textsFor(config: EmbedConfig | undefined, languages: readonly string[]): EmbedTexts {
  const lang =
    languages.map(primary).find((l) => l in EMBED_TEXTS || (config?.textsByLanguage && l in config.textsByLanguage)) ??
    "en";
  return { ...(EMBED_TEXTS[lang] ?? EMBED_TEXTS.en), ...config?.texts, ...config?.textsByLanguage?.[lang] };
}

/** A language's own name for itself ("Español"), from the browser. */
function languageName(tag: string): string {
  try {
    const name = new Intl.DisplayNames([tag], { type: "language" }).of(tag);
    return name ? name.charAt(0).toLocaleUpperCase(tag) + name.slice(1) : tag;
  } catch {
    return tag;
  }
}

/** The page: waits for `mf:init`, then shows the form with a variant selector
 *  above it when there is more than one variant. */
export function FramePage({ channel }: { channel?: Channel }) {
  const [config, setConfig] = useState<EmbedConfig>();
  const seen = useRef<string>(undefined);
  const root = useRef<HTMLDivElement>(null);
  // The language picked in the selector, until the app sends another locale.
  const [picked, setPicked] = useState<string>();
  const localeKey = JSON.stringify(config?.locale ?? null);
  useEffect(() => setPicked(undefined), [localeKey]);

  useEffect(() => {
    if (!channel) return;
    const stop = channel.listen((m) => {
      if (m.type === "mf:init") {
        // The app may send the same configuration twice (when it starts, and
        // again on our `mf:waiting`): only a different one starts the form again.
        const key = JSON.stringify(m.config);
        if (key === seen.current) return;
        seen.current = key;
        setConfig(m.config);
      }
      if (m.type === "mf:sync" && !seen.current) channel.post({ type: "mf:waiting" });
    });
    channel.post({ type: "mf:waiting" });
    return stop;
  }, [channel]);

  // The content height, whenever it changes (and on "mf:sync"), so the iframe
  // grows and shrinks with the form instead of scrolling inside it.
  useEffect(() => {
    if (!channel || !root.current) return;
    const el = root.current;
    const report = () => channel.post({ type: "mf:resize", height: el.getBoundingClientRect().height });
    const observer = new ResizeObserver(report);
    observer.observe(el);
    const stop = channel.listen((m) => {
      if (m.type === "mf:sync") report();
    });
    return () => {
      observer.disconnect();
      stop();
    };
  }, [channel]);

  const languages = readerLanguages(config?.locale, picked);
  const texts = textsFor(config, languages);
  // Only other variants start the form again: another language or other texts
  // re-word it, and what was typed stays.
  const variantsKey = config ? JSON.stringify([config.variants, config.variant ?? null]) : "";
  return (
    <div ref={root}>
      {!channel ? (
        <p className="p-6">{texts.notEmbedded}</p>
      ) : !config ? (
        <p className="p-6">{texts.waiting}</p>
      ) : config.variants.length === 0 ? null : (
        <Variants
          key={variantsKey}
          config={config}
          texts={texts}
          languages={languages}
          picked={picked}
          onPick={setPicked}
          channel={channel}
        />
      )}
    </div>
  );
}

function Variants({
  config,
  texts,
  languages,
  picked,
  onPick,
  channel,
}: {
  config: EmbedConfig;
  texts: EmbedTexts;
  languages: readonly string[];
  picked?: string;
  onPick: (language: string) => void;
  channel: Channel;
}) {
  const first = config.variants.find((v) => v.id === config.variant) ?? config.variants[0];
  const [variant, setVariant] = useState<EmbedVariant>(first);
  const [shapes, setShapes] = useState<string>();
  const [error, setError] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const markDirty = useCallback(() => setDirty(true), []);
  // Bumped by "mf:reset": a new key mounts an empty form.
  const [run, setRun] = useState(0);
  // The languages the shapes are written in, as the form reports them.
  const [available, setAvailable] = useState<string[]>([]);

  useEffect(
    () =>
      channel.listen((m) => {
        if (m.type !== "mf:reset") return;
        setDirty(false);
        setRun((n) => n + 1);
      }),
    [channel],
  );

  useEffect(() => {
    let live = true;
    setShapes(undefined);
    setError(undefined);
    const load =
      variant.shapes !== undefined
        ? Promise.resolve(variant.shapes)
        : variant.shapesUrl
          ? fetch(variant.shapesUrl).then((r) =>
              r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)),
            )
          : Promise.reject(new Error("the variant has neither shapes nor shapesUrl"));
    load.then(
      (text) => live && setShapes(text),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [variant]);

  function choose(id: string) {
    const next = config.variants.find((v) => v.id === id);
    if (!next || next.id === variant.id) return;
    if (dirty && !window.confirm(texts.changeVariant)) return;
    setDirty(false);
    setVariant(next);
  }

  const showLanguages = !!config.languageSelector && available.length > 1;
  const language =
    available.find((a) => picked && primary(a) === primary(picked)) ??
    available.find((a) => languages.some((l) => primary(l) === primary(a))) ??
    available[0];

  return (
    <div className="space-y-4 p-4">
      {(config.variants.length > 1 || showLanguages) && (
        <div className="flex flex-wrap items-end justify-between gap-4">
          {config.variants.length > 1 ? (
            <label className="block text-sm font-semibold">
              {texts.variantLabel}
              <select
                className="mt-1 block rounded-md border px-3 py-2"
                value={variant.id}
                onChange={(e) => choose(e.target.value)}
              >
                {config.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span />
          )}
          {showLanguages && (
            <label className="block text-sm font-semibold">
              {texts.languageLabel}
              <select
                className="mt-1 block rounded-md border px-3 py-2"
                value={language}
                onChange={(e) => onPick(e.target.value)}
              >
                {available.map((tag) => (
                  <option key={tag} value={tag}>
                    {languageName(tag)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {error ? (
        <p>{fill(texts.loadFailed, { error })}</p>
      ) : shapes === undefined ? (
        <p>{texts.loadingShapes}</p>
      ) : (
        <Form
          key={`${variant.id}-${run}`}
          shapes={shapes}
          rootShape={variant.rootShape}
          locale={languages}
          texts={texts}
          channel={channel}
          onDirty={markDirty}
          onLanguages={setAvailable}
        />
      )}
    </div>
  );
}

function Form({
  shapes,
  rootShape,
  locale,
  texts,
  channel,
  onDirty,
  onLanguages,
}: {
  shapes: string;
  rootShape?: string;
  locale?: string | readonly string[];
  texts: EmbedTexts;
  channel: Channel;
  onDirty: () => void;
  onLanguages: (languages: string[]) => void;
}) {
  const form = useMetadataForm({
    shapes,
    rootShape,
    locale,
    // The empty English table keeps English in the running: the form takes the
    // first of the reader's languages that has a table.
    strings: { en: {}, es: es.strings, ca: ca.strings },
    validateOn: "change",
  });

  useEffect(() => {
    if (form.ready) channel.post({ type: "mf:ready" });
  }, [form.ready, channel]);

  const languagesKey = form.availableLanguages.join(",");
  useEffect(() => {
    onLanguages(form.availableLanguages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languagesKey, onLanguages]);

  useEffect(() => {
    if (!form.ready) return;
    return form.subscribe(onDirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ready, onDirty]);

  const report = async () => {
    const rows = form.report.issues.rows;
    const errors = rows.filter((r) => r.severity === "violation").length;
    channel.post({
      type: "mf:change",
      valid: form.isValid,
      errors,
      warnings: rows.length - errors,
      jsonLd: await form.toJsonLd(),
    });
  };

  // Every change, debounced.
  useEffect(() => {
    if (!form.ready) return;
    const timer = setTimeout(report, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, form.ready, form.quads, form.isValid, form.report.issues.total]);

  useEffect(
    () =>
      channel.listen((m) => {
        if (m.type === "mf:reveal-errors") form.setRevealAll(true);
        if (m.type === "mf:sync" && form.ready) {
          channel.post({ type: "mf:ready" });
          void report();
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channel, form, form.ready, form.isValid, form.report.issues.total],
  );

  if (form.error) return <p>{fill(texts.formFailed, { error: form.error.message })}</p>;
  if (!form.ready) return <p>{texts.loadingEngine}</p>;

  return (
    <KanzoThemeProvider storage={null}>
      <div className="space-y-4">
        <IssuePills form={form} texts={texts} />
        <MetadataForm form={form} />
      </div>
    </KanzoThemeProvider>
  );
}

// Errors and warnings as two pills, where the form's own summary
// (ValidationSummary) has one count for both. Each opens a list of its own
// findings, built from the same parts as that summary (Kanzo UI's Findings and
// Diagnostic), and marks every issue on its field.
type IssueFinding = { id: string; variant: "destructive" | "warning"; row: IssueRow };

function IssuePills({ form, texts }: { form: MetadataFormController; texts: EmbedTexts }) {
  const findings = form.report.issues.rows.map(
    (row, i): IssueFinding => ({
      id: `${row.key}|${row.constraint ?? ""}|${i}`,
      variant: row.severity === "violation" ? "destructive" : "warning",
      row,
    }),
  );
  if (findings.length === 0) {
    return (
      <Badge variant="success" size="xs" pill>
        {texts.noIssues}
      </Badge>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <IssuePill form={form} texts={texts} findings={findings.filter((f) => f.variant === "destructive")} />
      <IssuePill form={form} texts={texts} findings={findings.filter((f) => f.variant === "warning")} />
    </div>
  );
}

function IssuePill({
  form,
  texts,
  findings,
}: {
  form: MetadataFormController;
  texts: EmbedTexts;
  findings: IssueFinding[];
}) {
  if (findings.length === 0) return null;
  const errors = findings[0].variant === "destructive";
  return (
    <FindingsRoot
      findings={findings}
      onOpenChange={({ open }) => {
        if (open) form.setRevealAll(true);
      }}
      onSelect={({ row }) => form.revealField(row.key)}
    >
      <FindingsTrigger pill size="xs">
        {({ total }) =>
          fill(errors ? (total === 1 ? texts.errorOne : texts.errorOther) : total === 1 ? texts.warningOne : texts.warningOther, {
            n: total,
          })
        }
      </FindingsTrigger>
      <FindingsContent description={errors ? texts.errorsHint : texts.warningsHint}>
        <FindingsGroup<IssueFinding>
          variant={findings[0].variant}
          title={errors ? texts.errorsTitle : texts.warningsTitle}
        >
          {({ row }) => (
            <Diagnostic variant={findings[0].variant}>
              <DiagnosticHeader>
                <DiagnosticSeverity>{errors ? texts.errorSeverity : texts.warningSeverity}</DiagnosticSeverity>
                <DiagnosticSource>{row.label.split(" › ").pop() || row.label}</DiagnosticSource>
                <DiagnosticActions className="ms-auto">
                  <FindingsGoTo>{texts.goToField}</FindingsGoTo>
                </DiagnosticActions>
                <DiagnosticTitle className="basis-full">{form.resolveMessage(row).text}</DiagnosticTitle>
              </DiagnosticHeader>
            </Diagnostic>
          )}
        </FindingsGroup>
      </FindingsContent>
    </FindingsRoot>
  );
}
