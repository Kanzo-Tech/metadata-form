import { Store } from "n3";
import SHACLValidator from "rdf-validate-shacl";
import rdfDataset from "@rdfjs/dataset";
import type { DatasetCore, Quad, Term } from "@rdfjs/types";
import { sh } from "../../rdf/factory.js";
import type {
  Severity,
  ValidationResult,
  Validator,
  ValidatorInput,
} from "../../schema/validation.js";

const SH_VIOLATION = sh("Violation").value;
const SH_WARNING = sh("Warning").value;

function dataset(quads: Quad[]): DatasetCore {
  return (rdfDataset as { dataset: (q: Quad[]) => DatasetCore }).dataset(quads);
}

function mapSeverity(term: Term | undefined): Severity {
  if (!term) return "violation";
  if (term.value === SH_WARNING) return "warning";
  if (term.value === SH_VIOLATION) return "violation";
  return "info";
}

interface ShaclResultLike {
  focusNode?: Term;
  path?: Term;
  message?: Term[];
  severity?: Term;
  sourceConstraintComponent?: Term;
  value?: Term;
}

/**
 * SHACL validator wrapping rdf-validate-shacl. Constructed once per shapes graph
 * (construction is the expensive part); maps native reports into agnostic
 * {@link ValidationResult}s.
 */
export class ShaclValidator implements Validator {
  private engine: InstanceType<typeof SHACLValidator>;

  constructor(shapes: Store) {
    const shapesDataset = dataset(shapes.getQuads(null, null, null, null) as Quad[]);
    this.engine = new SHACLValidator(shapesDataset as never, {});
  }

  validate(input: ValidatorInput): ValidationResult[] {
    // Whole-graph, target-based validation: every typed node (the root + nested
    // resources) is validated as a target and reports granular per-node results,
    // which map to their fields by (focusNode, path).
    const report = this.engine.validate(dataset(input.data) as never);
    const results = report.results as unknown as ShaclResultLike[];

    return results.map((r) => ({
      focusNode: r.focusNode as Term,
      path: r.path ?? undefined,
      message: messageText(r.message),
      severity: mapSeverity(r.severity),
      constraint: r.sourceConstraintComponent?.value,
      value: r.value ?? undefined,
    }));
  }
}

function messageText(messages: Term[] | undefined): string {
  if (!messages || messages.length === 0) return "Invalid value";
  return messages.map((m) => m.value).join(" ");
}
