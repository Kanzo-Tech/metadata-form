import { ScrollTextIcon } from "lucide-react";
import { ValidationSummary } from "@kanzo-tech/metadata-form";

/**
 * The app chrome: **one row**, per the design system's own shell showcases —
 * whose page this is, which example it has open, and what acts on all of it.
 *
 * `pickers` is the example and its preset, read after the wordmark as a path;
 * `actions` is the caller's slot for controls that act on the whole page.
 */
export function Header({
  actions,
  pickers,
  form,
}: {
  actions: React.ReactNode;
  pickers: React.ReactNode;
  form: React.ComponentProps<typeof ValidationSummary>["form"];
}) {
  return (
    // The row's height and its two gaps are inline: `h-11`, `gap-2.5` and
    // `gap-1.5` are not in the compiled sheet, so the header had no height of
    // its own and only whatever the shell gave it.
    <div className="flex items-center px-3 text-xs" style={{ height: "2.75rem", gap: "0.625rem" }}>
      <ScrollTextIcon aria-hidden size={14} className="shrink-0 text-muted-foreground" />
      <h1 className="shrink-0 font-heading font-medium text-sm">metadata-form</h1>
      {pickers}

      <div className="ms-auto flex shrink-0 items-center" style={{ gap: "0.375rem" }}>
        {actions}
        {/* The canonical validation summary — same in every layout (per-section
            badges in tabs/steps are wayfinding dots, not a competing counter). */}
        <ValidationSummary form={form} />
      </div>
    </div>
  );
}
