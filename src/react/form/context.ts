import { createContext, useContext } from "react";
import type { Term } from "@rdfjs/types";
import type { GraphState } from "../../engine/GraphState.js";
import type { FormModel } from "../../form/FormModel.js";
import type { FieldError } from "../../form/validation.js";
import type { FormAssist } from "../../assist.js";
import type { WidgetRegistry } from "../widgets/widgets.js";
import type { FormReport } from "../validation/formReport.js";
import { EN, type ResolvedStrings } from "../../i18n/strings.js";

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
  /** The most preferred language — for what takes a single one (an assistant's prompt). */
  locale: string;
  /** The reader's ordered language ranges. */
  languages: readonly string[];
  /** The interface strings, in the reader's language. */
  strings: ResolvedStrings;
  /** The text of one validation failure, in the reader's language. */
  messageOf: (error: Pick<FieldError, "messages" | "constraint">) => string;
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

const ENGLISH: ResolvedStrings = { ...EN, language: "en" };

/** The interface strings: the form's, or English where a widget is rendered on its
 *  own, outside a `<MetadataForm>`. */
export function useStrings(): ResolvedStrings {
  return useContext(FormContext)?.strings ?? ENGLISH;
}

/** Provides the focus node for the current (sub-)form scope. */
export const NodeContext = createContext<Term | null>(null);

export function useFocusNode(): Term {
  const node = useContext(NodeContext);
  if (!node) throw new Error("useFocusNode must be used within a node form scope");
  return node;
}
