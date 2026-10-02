import { Assist, type AssistTranslations } from "@kanzo-tech/ai";
import type { AssistUi } from "../react/assistUi.js";
import { fill, type ResolvedStrings } from "../i18n/strings.js";
import { fieldContext, siblingValues } from "./context.js";

/**
 * Model assistance for the form, over `@kanzo-tech/ai`'s `Assist` — hand it to the
 * form, under the host's own provider:
 *
 *   <AssistProvider model={model} translations={assistTranslations(form.strings)}>
 *     <MetadataForm form={form} assistUi={assistUi} />
 *   </AssistProvider>
 *
 * `Assist` reads the field's label and helper text off the control; what the shape
 * says beyond them — the datatype, `sh:in`, the bounds, what the record already
 * holds — goes in as the field's own context, read when the field asks.
 */
export const assistUi: AssistUi = ({ field, focus, graph, locale, value, onValueChange, children }) => (
  <Assist
    context={() =>
      [fieldContext(field), siblingValues({ graph, focus, field }), `Write in the language tagged "${locale}".`]
        .filter(Boolean)
        .join("\n")
    }
    onValueChange={onValueChange}
    value={value}
  >
    {children}
  </Assist>
);

/** The catalog's assistance words, as `AssistProvider`'s `translations`. */
export function assistTranslations(strings: ResolvedStrings): AssistTranslations {
  const { dismiss, ...words } = strings.assist;
  return { ...words, dismiss: (text) => fill(dismiss, { text }) };
}
