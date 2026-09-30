import { useCallback, useMemo } from "react";
import type { Term } from "@rdfjs/types";
import { useFocusNode, useFormContext } from "../form/context.js";
import { fieldKey } from "../../form/validation.js";
import { forwardWrite, type FieldWrite } from "../../form/writePath.js";
import type { FieldModel } from "../../form/FormModel.js";
import type { FieldError } from "../../form/validation.js";

export interface FieldBinding {
  errors: FieldError[];
  setValue: (oldValue: Term | null, newValue: Term | null) => void;
  addValue: (value: Term) => void;
  /** Replace the field's whole value list (a multi-value control's commit). */
  setValues: (values: Term[]) => void;
  removeValue: (value: Term) => void;
  createNested: () => Term;
}

/** A field model bound to the graph: its findings, and the writes at the current
 *  focus node and the field's path. Not Kanzo UI's `useField`, which is the state
 *  of the enclosing `Field`. */
export function useFieldBinding(field: FieldModel): FieldBinding {
  const { graph, errors } = useFormContext();
  const focusNode = useFocusNode();

  // A read-only field has no write plan at all, and the widgets it renders are
  // disabled — but a custom widget could still call a commit, so it gets a plan
  // that names its own path rather than a crash or a silent no-op. The graph then
  // refuses (or writes exactly what the path says) rather than this layer guessing.
  const write: FieldWrite = useMemo(
    () => field.write ?? forwardWrite(field.path),
    [field.write, field.path],
  );

  const setValue = useCallback(
    (oldValue: Term | null, newValue: Term | null) =>
      graph.setValue(focusNode, write, oldValue, newValue),
    [graph, focusNode, write],
  );
  const addValue = useCallback(
    (value: Term) => graph.addValue(focusNode, write, value),
    [graph, focusNode, write],
  );
  const setValues = useCallback(
    (values: Term[]) => graph.setValues(focusNode, write, values),
    [graph, focusNode, write],
  );
  const removeValue = useCallback(
    (value: Term) => graph.removeValue(focusNode, write, value),
    [graph, focusNode, write],
  );
  const createNested = useCallback(
    () => graph.createNested(focusNode, write, field.nestedTypeIri),
    [graph, focusNode, write, field.nestedTypeIri],
  );

  return {
    // `field.id` by construction — see FieldModel.path: one key for the field, its
    // values and its findings.
    errors: errors.get(fieldKey(focusNode, field.path)) ?? [],
    setValue,
    addValue,
    setValues,
    removeValue,
    createNested,
  };
}
