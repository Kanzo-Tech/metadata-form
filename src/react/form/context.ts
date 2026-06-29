import { createContext, useContext } from "react";
import type { Term } from "@rdfjs/types";
import type { GraphState } from "../../state/GraphState.js";
import type { FormModel } from "../../model/FormModel.js";
import type { FieldError } from "../../model/validation.js";
import type { FormAssist, WidgetRegistry } from "../widgets/widgets.js";
import type { FormReport } from "../validation/useFormReport.js";

/** Arrangement of the root property groups. */
export type FormLayout = "sequential" | "tabs" | "steps";

/** Column layout within each group (eje B). Keys are stable schema ids, not the
 * focus-node-derived `field.id`: groups by `GroupModel.id` (sh:PropertyGroup IRI),
 * spans by the predicate IRI (`field.path.value`). */
export interface GridLayout {
  /** Default number of columns for every group. */
  columns?: number;
  /** Per-group column overrides, keyed by `GroupModel.id`. */
  groups?: Record<string, { columns?: number }>;
  /** Per-field column span, keyed by predicate IRI (`field.path.value`). */
  spans?: Record<string, number>;
}

export interface FormContextValue {
  graph: GraphState;
  model: FormModel;
  widgets: WidgetRegistry;
  locale: string;
  errors: Map<string, FieldError[]>;
  report: FormReport;
  assist?: FormAssist;
  layout?: FormLayout;
  grid?: GridLayout;
  /** Active reveal request (from `form.revealField`) — drives tab/step switch + scroll. */
  revealTarget?: { id: string; n: number };
}

export const FormContext = createContext<FormContextValue | null>(null);

export function useFormContext(): FormContextValue {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("useFormContext must be used within a <MetadataForm>");
  return ctx;
}

/** Provides the focus node for the current (sub-)form scope. */
export const NodeContext = createContext<Term | null>(null);

export function useFocusNode(): Term {
  const node = useContext(NodeContext);
  if (!node) throw new Error("useFocusNode must be used within a node form scope");
  return node;
}
