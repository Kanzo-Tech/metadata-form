import { useMemo } from "react";
import type { MetadataFormController } from "../hooks/useMetadataForm.js";
import { FormContext, type FormContextValue, type FormLayout, type GridLayout } from "./context.js";
import { NodeForm } from "./NodeForm.js";
import { defaultWidgets } from "../widgets/defaultWidgets.js";
import type { WidgetRegistry } from "../widgets/widgets.js";
import { ink } from "../styles.js";

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
 * The form component. Renders a controller as the editable form UI.
 *
 *   const form = useMetadataForm({ shapes, data });
 *   <MetadataForm form={form} />
 *
 * Requires `@kanzo-tech/ui/styles.css`, and the theme attributes on `<html>` —
 * `KanzoThemeProvider` puts them there. Not a wrapper element: Ark's overlays
 * portal to `document.body`, outside anything this component could wrap, and
 * density sets the root font-size the whole `rem` scale resolves against.
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
      strings: form.strings,
      errors: form.errors,
      report: form.report,
      assist: form.assist,
      layout,
      grid,
      revealTarget: form._revealTarget,
    };
  }, [form._graph, form.model, registry, form.locale, form.strings, form.errors, form.report, form.assist, layout, grid, form._revealTarget]);

  if (form.error) {
    return (
      <p style={{ color: ink.destructive }} role="alert">
        Failed to load form: {form.error.message}
      </p>
    );
  }
  if (!ctx) {
    return (
      <p style={{ color: ink.muted }} aria-busy="true">
        Loading…
      </p>
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
