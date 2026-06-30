import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Store } from "n3";
import type { NamedNode, Quad, Term } from "@rdfjs/types";
import { namedNode } from "../../rdf/factory.js";
import { collectPrefixes, toStore, type RdfInput } from "../../rdf/parse.js";
import { toJsonLd, toTurtle } from "../../rdf/serialize.js";
import type { JsonLdOptions, SerializeOptions } from "../../rdf/serialize.js";
import { mapResults } from "../../validation/mapResults.js";
import type { FormModel } from "../../model/FormModel.js";
import type { FieldError, Validator } from "../../model/validation.js";
import type { DiagnosticSink, ParsedSchema, SchemaAdapter } from "../../model/SchemaAdapter.js";
import { GraphState } from "../../state/GraphState.js";
import { createRudofShaclAdapter } from "../../shacl/adapter.js";
import type { FormAssist } from "../widgets/widgets.js";
import { computeFormReport, type FormReport } from "../validation/useFormReport.js";

export interface UseMetadataFormOptions {
  /** The SHACL shape (Turtle / JSON-LD string, n3 Store, or quads). */
  shapes: RdfInput;
  /** Optional pre-filled data graph. */
  data?: RdfInput;
  /** Shape-language adapter; defaults to SHACL. */
  adapter?: SchemaAdapter;
  /** Subject to edit; inferred from data or created fresh when omitted. */
  focusNode?: string;
  /** Explicit root shape IRI. */
  rootShape?: string;
  /** UI locale for label/description language selection. */
  locale?: string;
  /** Turtle prefixes override (defaults to the prefixes parsed from the inputs). */
  prefixes?: Record<string, string>;
  /** JSON-LD context override (defaults to the parsed prefixes). */
  jsonLdContext?: Record<string, unknown>;
  validateOn?: "change" | "manual" | "off";
  validationDebounceMs?: number;
  /** The single assistance seam (reference search · suggestions · completion).
   * The lib never calls an LLM/service itself — these callbacks do. */
  assist?: FormAssist;
  /** Receives non-fatal build issues (dropped paths, missing shapes) instead of
   * them failing silently. */
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
  toTurtle(opts?: SerializeOptions): Promise<string>;
  toJsonLd(opts?: JsonLdOptions): Promise<object>;
  validate(): Promise<FieldError[]>;
  reset(): void;
  /** Observe graph changes (autosave, external sync). Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
  locale: string;
  /** The underlying editable graph (mutable, observable). */
  graph?: GraphState;
  assist?: FormAssist;
  /** Reveal a field by id: switch to its tab/step if needed, scroll, focus and
   * pulse it. Lets `<FormAssistant>`/`<ValidationSummary>` (rendered outside the
   * form) drive navigation through the shared controller. */
  revealField(fieldId: string): void;
  /** Internal wiring consumed by <MetadataForm>. */
  readonly _graph?: GraphState;
  /** Internal: the current reveal request (id + bump counter). */
  readonly _revealTarget?: { id: string; n: number };
}

interface Prepared {
  schema: ParsedSchema;
  validator: Validator;
  graph: GraphState;
  initialQuads: Quad[];
  focusNode: Term;
  /** The resolved root node-shape id — drives projection + scoped validation. */
  rootShapeId: string;
  prefixes: Record<string, string>;
}

const NOOP_UNSUB = () => () => {};

export function useMetadataForm(options: UseMetadataFormOptions): MetadataFormController {
  const {
    shapes,
    data,
    adapter: providedAdapter,
    focusNode,
    rootShape,
    locale = "en",
    prefixes,
    jsonLdContext,
    validateOn = "change",
    validationDebounceMs = 300,
    assist,
    onDiagnostic,
  } = options;

  const adapter = useMemo(() => providedAdapter ?? createRudofShaclAdapter(), [providedAdapter]);

  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [errors, setErrors] = useState<Map<string, FieldError[]>>(new Map());
  const [revealTarget, setRevealTarget] = useState<{ id: string; n: number }>();
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
      const schema = await adapter.parseSchema(
        typeof shapes === "string" || shapes instanceof Store ? shapes : await toStore(shapes),
      );
      const derivedPrefixes = {
        ...collectPrefixes(shapes),
        ...(data ? collectPrefixes(data) : {}),
      };
      const root = rootShape ? (namedNode(rootShape) as NamedNode) : undefined;
      // Load the initial data into the engine session ONCE, seed the focus into it,
      // and build GraphState over that live session — the single source of truth.
      const initialData = data ? ((await toStore(data)).getQuads(null, null, null, null) as Quad[]) : [];
      const session = await adapter.createGraph(
        schema,
        initialData,
        focusNode ? namedNode(focusNode) : undefined,
        root,
      );
      const graph = new GraphState(session.backend);
      if (!active) return;
      setPrepared({
        schema,
        validator: adapter.createValidator(schema),
        graph,
        // Reset baseline = the seeded session graph (focus type + sh:hasValue seeds).
        initialQuads: graph.allQuads(),
        focusNode: session.focusNode,
        rootShapeId: session.rootShapeId,
        prefixes: derivedPrefixes,
      });
    })().catch((e) => active && setError(e instanceof Error ? e : new Error(String(e))));
    return () => {
      active = false;
    };
  }, [adapter, shapes, data, focusNode, rootShape]);

  const graph = prepared?.graph;

  const subscribe = useCallback(
    (cb: () => void) => (graph ? graph.subscribe(cb) : NOOP_UNSUB()),
    [graph],
  );
  const getVersion = useCallback(() => (graph ? graph.getVersion() : 0), [graph]);
  const version = useSyncExternalStore(subscribe, getVersion, getVersion);

  const model = useMemo<FormModel | undefined>(() => {
    if (!prepared) return undefined;
    // Single graph: re-derive field values from the engine session (sync, after
    // ready()) on every edit, then build the model over them — no n3 read path.
    const values = adapter.projectValues(prepared.schema, prepared.focusNode, prepared.rootShapeId);
    return adapter.buildFormModel({
      schema: prepared.schema,
      focusNode: prepared.focusNode,
      rootShape: namedNode(prepared.rootShapeId) as NamedNode,
      locale,
      onDiagnostic,
      values,
    });
    // `version` re-projects field values from the graph after each edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, prepared, version, locale, onDiagnostic]);

  // Debounced live validation.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!prepared || validateOn !== "change") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      // Validate the live session in place (no reload) — scoped to the focus.
      const results = await prepared.validator.validate({
        focusNode: prepared.focusNode,
        rootShape: namedNode(prepared.rootShapeId) as NamedNode,
      });
      setErrors(mapResults(results));
    }, validationDebounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [prepared, version, validateOn, validationDebounceMs]);

  const isValid = useMemo(() => {
    for (const list of errors.values()) {
      if (list.some((e) => e.severity === "violation")) return false;
    }
    return true;
  }, [errors]);

  const report = useMemo(() => computeFormReport(model, errors), [model, errors]);

  const getQuads = useCallback(
    () => (graph && model ? graph.subgraphFrom(model.focusNode) : []),
    [graph, model, version],
  );

  const serializePrefixes = useMemo(
    () => ({ ...prepared?.prefixes, ...prefixes }),
    [prepared, prefixes],
  );

  const reset = useCallback(() => {
    if (!prepared) return;
    // Reset the session too: reload the captured baseline into a fresh session graph.
    void adapter
      .createGraph(prepared.schema, prepared.initialQuads, prepared.focusNode, namedNode(prepared.rootShapeId) as NamedNode)
      .then((session) => {
        setPrepared((p) => (p ? { ...p, graph: new GraphState(session.backend) } : p));
        setErrors(new Map());
      });
  }, [adapter, prepared]);

  const validate = useCallback(async () => {
    if (!prepared) return [];
    const results = await prepared.validator.validate({
      focusNode: prepared.focusNode,
      rootShape: namedNode(prepared.rootShapeId) as NamedNode,
    });
    const map = mapResults(results);
    setErrors(map);
    return [...map.values()].flat();
  }, [prepared]);

  return useMemo<MetadataFormController>(
    () => ({
      ready: !!model,
      error,
      model,
      focusNode: model?.focusNode,
      quads: getQuads(),
      errors,
      isValid,
      report,
      locale,
      graph,
      toTurtle: (opts) => toTurtle(getQuads(), { prefixes: serializePrefixes, ...opts }),
      toJsonLd: (opts) =>
        toJsonLd(getQuads(), { context: jsonLdContext ?? serializePrefixes, ...opts }),
      validate,
      reset,
      subscribe,
      assist,
      revealField,
      _graph: graph,
      _revealTarget: revealTarget,
    }),
    [model, error, getQuads, errors, isValid, report, locale, graph, serializePrefixes, jsonLdContext, validate, reset, subscribe, assist, revealField, revealTarget],
  );
}
