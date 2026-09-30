import { useMemo } from "react";
import type { MetadataFormController } from "../hooks/useMetadataForm.js";
import { FormContext, type FormContextValue, type FormLayout, type GridLayout } from "./context.js";
import { NodeForm } from "./NodeForm.js";
import { defaultWidgets } from "../widgets/defaultWidgets.js";
import type { AssistUi } from "../assistUi.js";
import type { WidgetRegistry } from "../widgets/widgets.js";
import { ink } from "../styles.js";
import { fill } from "../../i18n/strings.js";

export interface MetadataFormProps {
  /** A controller from `useMetadataForm`. */
  form: MetadataFormController;
  /** Widget overrides, merged over the defaults. */
  widgets?: WidgetRegistry;
  /** The UI for `form.assist` — `assistUi` from `metadata-form/ai`. Without it the
   *  form draws plain inputs and never calls the assistance. */
  assistUi?: AssistUi;
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
 * Requires the Tailwind entries in README (`metadata-form/tailwind.css`), and the theme attributes on `<html>` —
 * `KanzoThemeProvider` puts them there. Not a wrapper element: Ark's overlays
 * portal to `document.body`, outside anything this component could wrap, and
 * density sets the root font-size the whole `rem` scale resolves against.
 */
export function MetadataForm({ form, widgets, assistUi, layout, grid, className }: MetadataFormProps) {
  const registry = useMemo<WidgetRegistry>(
    () => ({ ...defaultWidgets, ...widgets }),
    [widgets],
  );

  const ctx = useMemo<FormContextValue | null>(() => {
    if (!form.ready || !form.graph || !form.model) return null;
    return {
      graph: form.graph,
      model: form.model,
      widgets: registry,
      locale: form.locale,
      languages: form.languages,
      strings: form.strings,
      messageOf: form.messageOf,
      errors: form.errors,
      report: form.report,
      assist: form.assist,
      assistUi,
      layout,
      grid,
      revealTarget: form._revealTarget,
    };
  }, [form.ready, form.graph, form.model, registry, form.locale, form.languages, form.strings, form.messageOf, form.errors, form.report, form.assist, assistUi, layout, grid, form._revealTarget]);

  if (form.error) {
    return (
      <p style={{ color: ink.destructive }} role="alert">
        {fill(form.strings.chrome.loadFailed, { error: form.error.message })}
      </p>
    );
  }
  if (!ctx) {
    return (
      <p style={{ color: ink.muted }} aria-busy="true">
        {form.strings.chrome.loading}
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
