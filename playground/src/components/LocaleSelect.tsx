import { Select as RSelect } from "@radix-ui/themes";
import { Field } from "./Field.js";

/** The UI-language selector — switches the language of the form's labels and
 *  descriptions (`useMetadataForm({ locale })`). Shown only for examples whose
 *  shape provides labels in more than one language. Matches the ghost look of the
 *  example pickers so it reads as context. */
export function LocaleSelect({
  value,
  locales,
  onChange,
}: {
  value: string;
  locales: string[];
  onChange: (locale: string) => void;
}) {
  return (
    <Field label="Idioma" size="1">
      <RSelect.Root size="1" value={value} onValueChange={onChange}>
        <RSelect.Trigger variant="ghost" color="gray" />
        <RSelect.Content>
          {locales.map((l) => (
            <RSelect.Item key={l} value={l}>
              {endonym(l)}
            </RSelect.Item>
          ))}
        </RSelect.Content>
      </RSelect.Root>
    </Field>
  );
}

/** A language tag's name in its own language (e.g. `ca` → "Català"). */
function endonym(tag: string): string {
  try {
    const name = new Intl.DisplayNames([tag], { type: "language" }).of(tag.split("-")[0]);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : tag;
  } catch {
    return tag;
  }
}
