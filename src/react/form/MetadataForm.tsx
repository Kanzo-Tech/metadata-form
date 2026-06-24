import { useMemo } from "react";
import { Text } from "@radix-ui/themes";
import type { MetadataFormController } from "../hooks/useMetadataForm.js";
import { FormContext, type FormContextValue, type FormLayout, type GridLayout } from "./context.js";
import { NodeForm } from "./NodeForm.js";
import { defaultWidgets } from "../widgets/defaultWidgets.js";
import type { WidgetRegistry } from "../widgets/widgets.js";

export interface MetadataFormProps {
  /** A controller from `useMetadataForm`. */
  form: MetadataFormController;
  /** Widget overrides, merged over the defaults. */
  widgets?: WidgetRegistry;
  /** How the root property groups are arranged. Defaults to `sequential`. */
  layout?: FormLayout;
  /** Column layout within each group (and per-field spans). */
  grid?: GridLayout;
  className?: string;
}

/**
 * The form component. Renders a controller as the editable form UI. Requires a
 * `<Theme>` ancestor from @radix-ui/themes (and its stylesheet).
 *
 *   const form = useMetadataForm({ shapes, data });
 *   <Theme><MetadataForm form={form} /></Theme>
 */
export function MetadataForm({ form, widgets, layout, grid, className }: MetadataFormProps) {
  const registry = useMemo<WidgetRegistry>(
    () => ({ ...defaultWidgets, ...widgets }),
    [widgets],
  );

  const ctx = useMemo<FormContextValue | null>(() => {
    if (!form._graph || !form.model) return null;
    return {
      graph: form._graph,
      model: form.model,
      widgets: registry,
      locale: form.locale,
      errors: form.errors,
      report: form.report,
      assist: form.assist,
      layout,
      grid,
      revealTarget: form._revealTarget,
    };
  }, [form._graph, form.model, registry, form.locale, form.errors, form.report, form.assist, layout, grid, form._revealTarget]);

  if (form.error) {
    return (
      <Text color="red" role="alert">
        Failed to load form: {form.error.message}
      </Text>
    );
  }
  if (!ctx) {
    return (
      <Text color="gray" aria-busy="true">
        Loading…
      </Text>
    );
  }

  return (
    <FormContext.Provider value={ctx}>
      <form className={className} onSubmit={(e) => e.preventDefault()}>
        <NodeForm model={ctx.model} root />
      </form>
    </FormContext.Provider>
  );
}
