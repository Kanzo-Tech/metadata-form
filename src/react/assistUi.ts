import type { Term } from "@rdfjs/types";
import type { ComponentType, ReactElement } from "react";
import type { GraphState } from "../engine/GraphState.js";
import type { FieldModel } from "../form/FormModel.js";

/** What the form hands the assistance around one control. */
export interface AssistUiProps {
  /** The field the control edits, its node, and the graph — what the model is told. */
  field: FieldModel;
  focus: Term;
  graph: GraphState;
  locale: string;
  /** The control's value: a string for one value, the list for a tags field. */
  value: string | string[];
  onValueChange: (value: string | string[]) => void;
  /** The control: `Textarea`, `Input` or `TagsInput`. */
  children: ReactElement;
}

/**
 * Model assistance around one control — supplied by the consumer, never imported
 * by the core, so a form without it renders plain inputs and carries no AI package.
 * `@kanzo-tech/metadata-form/ai` provides `assistUi`, over `@kanzo-tech/ai`'s `Assist`.
 */
export type AssistUi = ComponentType<AssistUiProps>;
