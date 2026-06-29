import { useCallback } from "react";
import type { Term } from "@rdfjs/types";
import { useFocusNode, useFormContext } from "../form/context.js";
import { fieldKey } from "../../validation/mapResults.js";
import type { FieldModel } from "../../model/FormModel.js";
import type { FieldError } from "../../model/validation.js";

export interface UseFieldResult {
  errors: FieldError[];
  setValue: (oldValue: Term | null, newValue: Term | null) => void;
  addValue: (value: Term) => void;
  removeValue: (value: Term) => void;
  createNested: () => Term;
}

/** Low-level field operations bound to the current focus node and path. */
export function useField(field: FieldModel): UseFieldResult {
  const { graph, errors } = useFormContext();
  const focusNode = useFocusNode();

  const setValue = useCallback(
    (oldValue: Term | null, newValue: Term | null) =>
      graph.setValue(focusNode, field.path, oldValue, newValue),
    [graph, focusNode, field.path],
  );
  const addValue = useCallback(
    (value: Term) => graph.addValue(focusNode, field.path, value),
    [graph, focusNode, field.path],
  );
  const removeValue = useCallback(
    (value: Term) => graph.removeValue(focusNode, field.path, value),
    [graph, focusNode, field.path],
  );
  const createNested = useCallback(
    () => graph.createNested(focusNode, field.path, field.nestedTypeIri),
    [graph, focusNode, field.path, field.nestedTypeIri],
  );

  return {
    errors: errors.get(fieldKey(focusNode, field.path)) ?? [],
    setValue,
    addValue,
    removeValue,
    createNested,
  };
}
