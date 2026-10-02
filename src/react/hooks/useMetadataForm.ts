import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { NamedNode, Quad, Term } from "@rdfjs/types";
import { namedNode } from "../../form/factory.js";
import { mapResults } from "../../form/validation.js";
import { langOf, localName, matchesLanguage, resolveLanguage } from "../../form/terms.js";
import { shapeLanguages } from "../../form/languages.js";
import { resolveStrings, type ResolvedStrings, type StringTables } from "../../i18n/strings.js";
import { resolveLanguages } from "../../i18n/languages.js";
import { allFields, type FormModel } from "../../form/FormModel.js";
import type { FieldError } from "../../form/validation.js";
import type { ShapeModel } from "../../form/ShapeIR.js";
import { GraphState } from "../../engine/GraphState.js";
import { createRudofEngine } from "../../engine/index.js";
import type { RudofEngine } from "../../engine/RudofEngine.js";
import { buildFormModel, type Diagnostic, type DiagnosticSink } from "../../form/buildFormModel.js";
import type { FormAssist } from "../../assist.js";
import { computeFormReport, type FormReport } from "../validation/formReport.js";

export interface UseMetadataFormOptions {
  /** The SHACL shapes document — a Turtle or JSON-LD string (rudof parses it). */
  shapes: string;
  /** Optional pre-filled data graph — a Turtle or JSON-LD string. */
  data?: string;
  /** The rudof-over-WASM engine; defaults to a fresh `createRudofEngine()`. Pass a
   *  shared engine (or one with a test loader) to control the wasm session. */
  engine?: RudofEngine;
  /** Subject to edit; inferred from data or created fresh when omitted. */
  focusNode?: string;
  /** Explicit root shape IRI. */
  rootShape?: string;
  /** The reader's language, or an ordered list of them, most preferred first.
   *  Labels, descriptions and validation messages are picked from it by RFC 4647
   *  basic filtering (`en-US` matches `en`, not the reverse). Defaults to
   *  `navigator.languages`, else `en`. */
  locale?: string | readonly string[];
  /** Interface strings by language tag (`{ es: es.strings }` from
   *  `@kanzo-tech/metadata-form/i18n`, or your own). English is built in; a table may be partial. */
  strings?: StringTables;
  /** Extra default validation messages, as Turtle documents of
   *  `<constraint component> sh:message "…"@lang` triples with `{$param}`
   *  templates — how a language is added, or a built-in wording changed. The engine
   *  carries English, Spanish and Catalan; these are handed to it as they are
   *  (`Session.loadMessages`), and the later document wins per component and
   *  language. */
  messages?: string | readonly string[];
  /** When the form validates: after every change (`"change"`, once the edit has
   *  been drawn, so typing stays responsive), only when {@link MetadataFormController.validate}
   *  is called (`"manual"`), or never (`"off"`). */
  validateOn?: "change" | "manual" | "off";
  /** The single assistance seam (reference search · suggestions · completion).
   * The lib never calls an LLM/service itself — these callbacks do. */
  assist?: FormAssist;
  /** Receives non-fatal build issues (dropped paths, missing shapes, texts the
   * profile wrote only in languages the reader did not ask for) instead of them
   * failing silently. */
  onDiagnostic?: DiagnosticSink;
}

/**
 * The form controller — a React-idiomatic handle (think react-hook-form's
 * `useForm`). Owns (or wraps) the editable graph and exposes the live output
 * reactively, so you don't need `onChange`. Pass it to `<MetadataForm form />`.
 */
export interface MetadataFormController {
  ready: boolean;
  error?: Error;
  model?: FormModel;
  focusNode?: Term;
  /** Live data subgraph (re-derived on every edit). */
  quads: Quad[];
  errors: Map<string, FieldError[]>;
  isValid: boolean;
  /** Single derived view of form state (validation + completion + health). */
  report: FormReport;
  toTurtle(): Promise<string>;
  toJsonLd(): Promise<object>;
  validate(): Promise<FieldError[]>;
  reset(): void;
  /** Observe graph changes (autosave, external sync). Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** The most preferred of {@link languages}. */
  locale: string;
  /** The reader's ordered language ranges. */
  languages: readonly string[];
  /** The languages the shapes are written in — the tags on their `sh:name`,
   *  `sh:description`, `sh:message` and the `rdfs:label`s of groups and predicates —
   *  most written first. What a language selector should offer; empty when nothing
   *  is tagged. */
  availableLanguages: string[];
  /** The interface strings, in the reader's language. */
  strings: ResolvedStrings;
  /** The text of one validation failure, in the reader's language: the message the
   *  engine reported for it (the author's `sh:message`, else its default wording)
   *  in the most preferred language that has one, English next. Evaluated against
   *  the current language, so a change of `locale` re-words errors already
   *  reported. */
  messageOf(error: Pick<FieldError, "messages">): string;
  /** {@link messageOf}, and the tag to put in the `lang` attribute of the element that
   *  shows it: present only when the text is in a language the reader did not ask for
   *  (English, which the engine's catalog always has, included). */
  resolveMessage(error: Pick<FieldError, "messages">): { text: string; lang?: string };
  /** The non-fatal issues of the current model — what `onDiagnostic` is handed, kept:
   *  the last build's, plus the messages found lacking a language since. Each
   *  `missing-language` is one shape and kind, not one render. */
  diagnostics: Diagnostic[];
  /** The underlying editable graph (mutable, observable). */
  graph?: GraphState;
  assist?: FormAssist;
  /** Reveal a field by id: switch to its tab/step if needed, scroll, focus and
   * pulse it. Lets a companion or `<ValidationSummary>` (rendered outside the
   * form) drive navigation through the shared controller. */
  revealField(fieldId: string): void;
  /** Whether every field shows its errors, touched or not. Off, a field stays quiet
   *  until the reader has been in it; `<ValidationSummary>` turns this on when
   *  pressed, which is "show me where they are" for the count it carries. */
  revealAll: boolean;
  setRevealAll(on: boolean): void;
  /** Internal: the current reveal request (id + bump counter). */
  readonly _revealTarget?: { id: string; n: number };
}

interface Prepared {
  /** The engine whose session this is. Everything below is a handle into it. */
  engine: RudofEngine;
  shapes: ShapeModel;
  graph: GraphState;
  initialQuads: Quad[];
  focusNode: Term;
  /** The resolved root node-shape id — drives projection + scoped validation. */
  rootShapeId: string;
}

const NOOP_UNSUB = () => () => {};

/** Turtle vs JSON-LD by a cheap leading-char sniff (rudof parses by media type). */
function detectMediaType(text: string): string {
  const t = text.trimStart();
  return t.startsWith("{") || t.startsWith("[") ? "application/ld+json" : "text/turtle";
}

export function useMetadataForm(options: UseMetadataFormOptions): MetadataFormController {
  const {
    shapes,
    data,
    engine: providedEngine,
    focusNode,
    rootShape,
    locale: localeOption,
    strings: stringsOption,
    messages: messagesOption,
    validateOn = "change",
    assist,
    onDiagnostic,
  } = options;

  const engine = useMemo(() => providedEngine ?? createRudofEngine(), [providedEngine]);
  const languagesKey = typeof localeOption === "string" ? localeOption : localeOption?.join("\0");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const languages = useMemo(() => resolveLanguages(localeOption), [languagesKey]);
  const locale = languages[0];
  const strings = useMemo(() => resolveStrings(languages, stringsOption), [languages, stringsOption]);

  // The default messages are the engine's: a result carries one per language of its
  // catalog, so the reader's is picked, and English is what a language it lacks gets.
  const resolveMessage = useCallback(
    (error: Pick<FieldError, "messages">) => {
      const picked = resolveLanguage(error.messages, [...languages, "en"]);
      const asked = !!picked && languages.some((range) => matchesLanguage(picked.item.language, range));
      return {
        text: picked?.item.value ?? "",
        lang: langOf(picked && { ...picked, fallback: !asked }),
      };
    },
    [languages],
  );
  const messageOf = useCallback((error: Pick<FieldError, "messages">) => resolveMessage(error).text, [resolveMessage]);
  const documents = typeof messagesOption === "string" ? [messagesOption] : (messagesOption ?? []);
  const documentsKey = documents.join("\0");

  // A session is only as good as the engine that holds it: when the engine is
  // replaced (a new `engine` prop, or a hot reload re-creating the default one) the
  // state kept from the old one names shapes and a graph the new one has never
  // loaded, and projecting it threw "ready() must be awaited" into the render. It
  // is not this form's session until the load below has run against this engine.
  const [held, setPrepared] = useState<Prepared | null>(null);
  const prepared = held?.engine === engine ? held : null;
  const [error, setError] = useState<Error | undefined>(undefined);
  const [errors, setErrors] = useState<Map<string, FieldError[]>>(new Map());
  const [revealTarget, setRevealTarget] = useState<{ id: string; n: number }>();
  const [revealAll, setRevealAll] = useState(false);
  const revealField = useCallback(
    (id: string) => setRevealTarget((t) => ({ id, n: (t?.n ?? 0) + 1 })),
    [],
  );

  // Parse shapes + data, build/adopt the editable graph + validator.
  useEffect(() => {
    let active = true;
    setError(undefined);
    setErrors(new Map());
    (async () => {
      // rudof parses both documents (Turtle / JSON-LD by media type).
      const shapeModel = await engine.loadShapes(shapes, detectMediaType(shapes));
      // The consumer's message documents extend the engine's catalog for this session.
      for (const document of documents) await engine.loadMessages(document);
      const root = rootShape ? (namedNode(rootShape) as NamedNode) : undefined;
      // Load the initial data into the engine session ONCE, seed the focus into it,
      // and build GraphState over that live session — the single source of truth.
      const session = await engine.createGraph(
        shapeModel,
        data,
        data ? detectMediaType(data) : undefined,
        focusNode ? namedNode(focusNode) : undefined,
        root,
      );
      const graph = new GraphState(session.backend);
      if (!active) return;
      setPrepared({
        engine,
        shapes: shapeModel,
        graph,
        // Reset baseline = the seeded session graph (focus type + sh:hasValue seeds).
        initialQuads: graph.allQuads(),
        focusNode: session.focusNode,
        rootShapeId: session.rootShapeId,
      });
    })().catch((e) => active && setError(e instanceof Error ? e : new Error(String(e))));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, shapes, data, focusNode, rootShape, documentsKey]);

  const graph = prepared?.graph;
  const availableLanguages = useMemo(() => (prepared ? shapeLanguages(prepared.shapes) : []), [prepared]);

  const subscribe = useCallback(
    (cb: () => void) => (graph ? graph.subscribe(cb) : NOOP_UNSUB()),
    [graph],
  );
  const getVersion = useCallback(() => (graph ? graph.getVersion() : 0), [graph]);
  const version = useSyncExternalStore(subscribe, getVersion, getVersion);

  // The model and the tree's `(focus, shapeId)` nodes come out of the SAME
  // projection: validation needs the nodes the model was built from, and a second
  // `projectValues` call for them would re-enter wasm over the whole tree.
  const projected = useMemo(() => {
    if (!prepared) return undefined;
    // Single graph: re-derive field values from the engine session (sync, after
    // ready()) on every edit, then build the model over them.
    const { values, labels, satisfied, nodes } = engine.projectValues(prepared.shapes, prepared.focusNode, prepared.rootShapeId);
    const diagnostics: Diagnostic[] = [];
    const model = buildFormModel({
      shapes: prepared.shapes,
      focusNode: prepared.focusNode,
      shape: prepared.shapes.nodeShapes.get(prepared.rootShapeId)!,
      languages,
      onDiagnostic: (d) => {
        diagnostics.push(d);
        onDiagnostic?.(d);
      },
      values,
      labels,
      satisfied,
      // The live graph, for the one question the shapes cannot answer: whether a
      // sequence path's intermediate resource exists and is unique (see BuildArgs).
      readStep: prepared.graph.readStep,
    });
    // `prepared` rides along so a consumer of a DEFERRED projection can tell which
    // session it was projected from.
    return { model, nodes, diagnostics, prepared };
    // `version` re-projects field values from the graph after each edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, prepared, version, languages, onDiagnostic]);

  const model: FormModel | undefined = projected?.model;

  // Live validation follows the form React has drawn, not a clock: the projection is
  // deferred, so an edit is painted first and validated in the render that catches
  // up, and a burst of edits validates the last of them once. The validation reads
  // the live session, so what it checks is the graph as it is when it runs, and a
  // result that arrives after a newer edit began is dropped.
  const deferred = useDeferredValue(projected);
  useEffect(() => {
    if (!prepared || validateOn !== "change") return;
    // The deferred projection lags by a render, and on the render where a new
    // session arrives it is still the old session's tree: its shape ids are not in
    // the shapes the engine now holds, and validating them throws "shape not found
    // in shapes graph". Wait for the projection of THIS session, one render on.
    if (deferred?.prepared !== prepared) return;
    let current = true;
    // Every node of the projected tree, not only the root: see `RudofEngine.validateTree`.
    void engine.validateTree(deferred.nodes).then((results) => current && setErrors(mapResults(results)));
    return () => {
      current = false;
    };
  }, [engine, prepared, deferred, validateOn]);

  const isValid = useMemo(() => {
    for (const list of errors.values()) {
      if (list.some((e) => e.severity === "violation")) return false;
    }
    return true;
  }, [errors]);

  const report = useMemo(() => computeFormReport(model, errors), [model, errors]);

  // A message is a result of validation, not of the build, so its missing language is
  // found here: once per field and requested languages, for as long as the session
  // lasts (a new session, or a new language, starts the count again).
  const reportedMessages = useRef(new Set<string>());
  const [messageDiagnostics, setMessageDiagnostics] = useState<Diagnostic[]>([]);
  useEffect(() => {
    reportedMessages.current = new Set();
    setMessageDiagnostics([]);
  }, [prepared, languages]);
  useEffect(() => {
    const fresh: Diagnostic[] = [];
    const labels = new Map((model ? allFields(model) : []).map((f) => [f.id, f.label]));
    for (const [key, list] of errors) {
      const path = key.slice(key.indexOf("|") + 1);
      const once = `${key}|message|${languages.join(",")}`;
      const lang = list.map((e) => resolveMessage(e).lang).find(Boolean);
      if (!lang || reportedMessages.current.has(once)) continue;
      reportedMessages.current.add(once);
      fresh.push({
        level: "info",
        code: "missing-language",
        message: `No message in ${languages.join(", ")} for ${labels.get(key) ?? localName(path)}; showing ${lang}.`,
        detail: path,
      });
    }
    if (fresh.length === 0) return;
    setMessageDiagnostics((all) => [...all, ...fresh]);
    for (const d of fresh) onDiagnostic?.(d);
  }, [errors, model, languages, resolveMessage, onDiagnostic]);
  const diagnostics = useMemo(
    () => [...(projected?.diagnostics ?? []), ...messageDiagnostics],
    [projected, messageDiagnostics],
  );

  // The graph is edited in place, so its identity never changes: `version` is the
  // counter that says it did, and the only thing that makes this read current.
  const quads = useMemo(
    () => (graph && model ? graph.subgraphFrom(model.focusNode) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the mutable graph's change signal
    [graph, model, version],
  );

  const reset = useCallback(() => {
    if (!prepared) return;
    // Reset the session too: reload the captured baseline quads into a fresh
    // session graph (the quad path re-adds them as-is, preserving blank labels).
    void engine
      .createGraph(prepared.shapes, prepared.initialQuads, undefined, prepared.focusNode, namedNode(prepared.rootShapeId) as NamedNode)
      .then((session) => {
        setPrepared((p) => (p ? { ...p, graph: new GraphState(session.backend) } : p));
        setErrors(new Map());
      });
  }, [engine, prepared]);

  const validate = useCallback(async () => {
    if (!prepared) return [];
    const results = await engine.validateTree(projected?.nodes ?? []);
    const map = mapResults(results);
    setErrors(map);
    return [...map.values()].flat();
  }, [engine, prepared, projected]);

  return useMemo<MetadataFormController>(
    () => ({
      ready: !!model,
      error,
      model,
      focusNode: model?.focusNode,
      quads,
      errors,
      isValid,
      report,
      locale,
      languages,
      availableLanguages,
      strings,
      messageOf,
      resolveMessage,
      diagnostics,
      graph,
      // rudof serializes just the focus's subgraph (one record), prefixes retained.
      toTurtle: () => (model ? engine.serializeFocus(model.focusNode, "text/turtle") : Promise.resolve("")),
      toJsonLd: async () =>
        model ? JSON.parse(await engine.serializeFocus(model.focusNode, "application/ld+json")) : {},
      validate,
      reset,
      subscribe,
      assist,
      revealField,
      revealAll,
      setRevealAll,
      _revealTarget: revealTarget,
    }),
    [model, error, quads, errors, isValid, report, locale, languages, availableLanguages, strings, messageOf, resolveMessage, diagnostics, graph, engine, validate, reset, subscribe, assist, revealField, revealAll, revealTarget],
  );
}
