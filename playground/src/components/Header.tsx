import { Kbd, Link } from "@kanzo-tech/ui";
import { ValidationSummary } from "metadata-form";
import { PANEL_BORDER } from "./panel.js";
import { BrandLogo } from "./BrandLogo.js";
import type { ExampleBranding } from "../presets.js";

/** The app chrome: a low-key utility strip (example pickers + Share + attribution)
 *  over the title bar (heading + view toggles + the canonical validation summary).
 *  Pure layout — the caller passes the picker cluster and the toggles as slots.
 *  When the active example carries {@link ExampleBranding}, its wordmark replaces
 *  the app title so the playground wears that product's identity. */
export function Header({
  pickers,
  actions,
  form,
  branding,
  tint,
}: {
  pickers: React.ReactNode;
  actions: React.ReactNode;
  form: React.ComponentProps<typeof ValidationSummary>["form"];
  branding?: ExampleBranding;
  tint?: boolean;
}) {
  return (
    <>
      {/* Utility strip — example pickers + Share, deliberately low-key (like a
          language switcher) so they read as context, not primary controls. */}
      <div
        className={`flex flex-none items-center justify-between gap-3 px-5 py-1 ${
          tint ? "bg-primary/8" : "bg-muted"
        }`}
        style={{ borderBottom: PANEL_BORDER }}
      >
        {pickers}
        <span className="text-muted-foreground text-xs">
          Made with ❤️ at{" "}
          <Link href="https://kanzo.tech" target="_blank" rel="noreferrer">
            Kanzo
          </Link>
        </span>
      </div>

      {/* Top bar — title + view toggles. */}
      <div
        className="flex flex-none flex-wrap items-center gap-3 px-5 py-3"
        style={{ borderBottom: PANEL_BORDER }}
      >
        <div className="me-2 flex flex-col gap-1">
          {branding?.logoUrl ? (
            <BrandLogo url={branding.logoUrl} ratio={branding.logoRatio ?? 4} height={26} label="Evidenze" />
          ) : (
            <>
              <h1 className="font-heading font-semibold text-lg">metadata-form</h1>
              <span className="text-muted-foreground text-xs">
                SHACL shapes → editable RDF form → Turtle &amp; JSON-LD
              </span>
            </>
          )}
        </div>

        <div className="flex-1" />

        {actions}
        {/* The canonical validation summary — same in every layout (per-section
            badges in tabs/steps are wayfinding dots, not a competing counter). */}
        <ValidationSummary form={form} />
        <span className="text-muted-foreground text-xs">
          Preferences <Kbd>P</Kbd>
        </span>
      </div>
    </>
  );
}
