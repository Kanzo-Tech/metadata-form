import type { Quad, Term } from "@rdfjs/types";
import { quad } from "../rdf/factory.js";
import { toTerm, toTermValue } from "../rdf/termValue.js";
import type { ProjectedForm, ShapeModel } from "../shape/ShapeIR.js";
import type { GraphBackend } from "../ports/GraphBackend.js";
import type { RdfEngine } from "../ports/RdfEngine.js";
import type { Severity, ValidationResult } from "../schema/validation.js";
import { shapeModelFromJson } from "./rehydrate.js";
import type { RudofLoader, RudofResult, RudofSession } from "./abi.js";

const TURTLE = "text/turtle";

function mapSeverity(s: string | undefined): Severity {
  if (s?.endsWith("Warning")) return "warning";
  if (s?.endsWith("Info")) return "info";
  return "violation";
}

function toValidationResult(r: RudofResult): ValidationResult {
  return {
    focusNode: toTerm(r.focusNode),
    path: r.path ? toTerm(r.path) : undefined,
    message: r.message.join(" "),
    severity: mapSeverity(r.severity),
    constraint: r.sourceConstraintComponent,
    value: r.value ? toTerm(r.value) : undefined,
  };
}

/** A {@link GraphBackend} over a rudof session's current graph. The session owns
 *  the single in-wasm graph; this just adapts term marshalling to RDF/JS. */
class RudofGraphBackend implements GraphBackend {
  constructor(private readonly session: RudofSession) {}

  add(s: Term, p: Term, o: Term): void {
    this.session.add(toTermValue(s), toTermValue(p), toTermValue(o));
  }
  remove(s: Term, p: Term, o: Term): void {
    this.session.remove(toTermValue(s), toTermValue(p), toTermValue(o));
  }
  match(s?: Term | null, p?: Term | null, o?: Term | null): Quad[] {
    return this.session
      .quads(s ? toTermValue(s) : null, p ? toTermValue(p) : null, o ? toTermValue(o) : null)
      .map((q) => quad(toTerm(q.subject) as never, toTerm(q.predicate) as never, toTerm(q.object) as never));
  }
  serialize(mediaType: string): string {
    return this.session.serialize(mediaType);
  }
}

/**
 * The default {@link RdfEngine}: a single rudof session (shapes + graph) behind
 * the wasm ABI. Lazy, memoized init via the injected {@link RudofLoader} — so the
 * {@link RdfEngine} port stays the only seam that touches wasm, and tests can
 * swap the loader.
 */
export class RudofEngine implements RdfEngine {
  private session?: RudofSession;
  private initOnce?: Promise<void>;

  constructor(private readonly load: RudofLoader) {}

  ready(): Promise<void> {
    return (this.initOnce ??= this.load().then((m) => {
      this.session = m.newSession();
    }));
  }

  private get s(): RudofSession {
    if (!this.session) throw new Error("RudofEngine.ready() must be awaited before use");
    return this.session;
  }

  async loadShapes(text: string, mediaType = TURTLE): Promise<ShapeModel> {
    await this.ready();
    return shapeModelFromJson(this.s.loadShapes(text, mediaType));
  }

  async loadData(text: string, mediaType = TURTLE): Promise<GraphBackend> {
    await this.ready();
    this.s.loadData(text, mediaType);
    return new RudofGraphBackend(this.s);
  }

  async newGraph(): Promise<GraphBackend> {
    await this.ready();
    this.s.newData();
    return new RudofGraphBackend(this.s);
  }

  async validate(shapeId?: string): Promise<ValidationResult[]> {
    await this.ready();
    return this.s.validate(shapeId ?? null).results.map(toValidationResult);
  }

  async validateFocus(focus: Term, shapeId: string): Promise<ValidationResult[]> {
    await this.ready();
    return this.s.validateFocus(toTermValue(focus), shapeId).results.map(toValidationResult);
  }

  async projectForm(focus: Term, shapeId: string): Promise<ProjectedForm> {
    await this.ready();
    return this.s.projectForm(toTermValue(focus), shapeId);
  }

  /**
   * Synchronous projection — requires {@link ready} to have already resolved
   * (throws otherwise). wasm-bindgen calls are synchronous once the module is
   * instantiated, so this lets the React per-edit rebuild stay synchronous (no
   * await straddling the model `useMemo`).
   */
  projectFormSync(focus: Term, shapeId: string): ProjectedForm {
    return this.s.projectForm(toTermValue(focus), shapeId);
  }
}
