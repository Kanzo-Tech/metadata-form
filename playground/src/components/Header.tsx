import { Kbd, MadeWith } from "@kanzo-tech/ui";
import { ScrollTextIcon } from "lucide-react";
import { ValidationSummary } from "metadata-form";
import { BrandLogo } from "./BrandLogo.js";
import { useChrome } from "../i18n.js";
import type { ExampleBranding } from "../presets.js";

/**
 * The app chrome: **one row**, per the design system's own shell showcases.
 *
 * It used to be two — a utility strip carrying the example pickers and the
 * attribution, over a title bar. The pickers moved into the Source pane's header,
 * because they replace the document that panel is showing and a control belongs
 * against the thing it acts on; what is left fits on a line.
 *
 * `actions` is the caller's slot for controls that act on the whole page.
 */
export function Header({
  actions,
  form,
  branding,
}: {
  actions: React.ReactNode;
  form: React.ComponentProps<typeof ValidationSummary>["form"];
  branding?: ExampleBranding;
}) {
  const chrome = useChrome();
  return (
    // The row's height and its two gaps are inline: `h-11`, `gap-2.5` and
    // `gap-1.5` are not in the compiled sheet, so the header had no height of
    // its own and only whatever the shell gave it.
    <div className="flex items-center px-3 text-xs" style={{ height: "2.75rem", gap: "0.625rem" }}>
      {branding?.logoUrl ? (
        <BrandLogo url={branding.logoUrl} ratio={branding.logoRatio ?? 4} height={20} label="Evidenze" />
      ) : (
        <>
          <ScrollTextIcon aria-hidden size={14} className="shrink-0 text-muted-foreground" />
          <h1 className="shrink-0 font-heading font-medium text-sm">metadata-form</h1>
          <span className="hidden shrink-0 text-muted-foreground lg:inline">{chrome.tagline}</span>
        </>
      )}

      <div className="ms-auto flex shrink-0 items-center" style={{ gap: "0.375rem" }}>
        {actions}
        {/* The canonical validation summary — same in every layout (per-section
            badges in tabs/steps are wayfinding dots, not a competing counter). */}
        <ValidationSummary form={form} />
        <span className="hidden text-muted-foreground xl:inline">
          {chrome.preferences} <Kbd>P</Kbd>
        </span>
        <MadeWith href="https://kanzo.tech" className="hidden 2xl:inline-flex">
          Kanzo
        </MadeWith>
      </div>
    </div>
  );
}
