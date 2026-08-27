import { NativeSelect, NativeSelectOption } from "@kanzo-tech/ui";
import { useChrome } from "../i18n.js";

/** The UI-language selector — switches the language of the form's labels and
 *  descriptions (`useMetadataForm({ locale })`). Shown only for examples whose
 *  shape provides labels in more than one language.
 *
 *  A native select: a handful of languages, flat, no icons — so the platform's own
 *  keyboard and mobile picker are worth more than a styled listbox. */
export function LocaleSelect({
  value,
  locales,
  onChange,
}: {
  value: string;
  locales: string[];
  onChange: (locale: string) => void;
}) {
  // Its own accessible name follows the language it is currently selecting — this
  // said "Idioma" in every locale, which is the defect this control invites.
  const chrome = useChrome();
  return (
    <NativeSelect
      size="sm"
      aria-label={chrome.language}
      style={{ height: "1.75rem", width: "7rem" }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {locales.map((l) => (
        <NativeSelectOption key={l} value={l}>
          {endonym(l)}
        </NativeSelectOption>
      ))}
    </NativeSelect>
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
