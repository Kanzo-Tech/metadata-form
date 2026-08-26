import { Kbd, MadeWith } from "@kanzo-tech/ui";
import { ScrollTextIcon } from "lucide-react";
import { ValidationSummary } from "metadata-form";
import { BrandLogo } from "./BrandLogo.js";
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
  return (
    <div className="flex h-11 items-center gap-2.5 px-3 text-xs">
      {branding?.logoUrl ? (
        <BrandLogo url={branding.logoUrl} ratio={branding.logoRatio ?? 4} height={20} label="Evidenze" />
      ) : (
        <>
          <ScrollTextIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <h1 className="shrink-0 font-heading font-medium text-sm">metadata-form</h1>
          <span className="hidden shrink-0 text-muted-foreground lg:inline">
            SHACL shapes → editable RDF form → Turtle &amp; JSON-LD
          </span>
        </>
      )}

      <div className="ms-auto flex shrink-0 items-center gap-1.5">
        {actions}
        {/* The canonical validation summary — same in every layout (per-section
            badges in tabs/steps are wayfinding dots, not a competing counter). */}
        <ValidationSummary form={form} />
        <span className="hidden text-muted-foreground xl:inline">
          Preferences <Kbd>P</Kbd>
        </span>
        <MadeWith href="https://kanzo.tech" className="hidden 2xl:inline-flex">
          Kanzo
        </MadeWith>
      </div>
    </div>
  );
}
