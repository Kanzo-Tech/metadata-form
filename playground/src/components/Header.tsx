import { Box, Flex, Heading, Kbd, Link, Text } from "@radix-ui/themes";
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
      <Flex
        align="center"
        justify="between"
        gap="3"
        px="5"
        py="1"
        style={{ flexShrink: 0, background: tint ? "var(--accent-a2)" : "var(--gray-a2)", borderBottom: PANEL_BORDER }}
      >
        {pickers}
        <Text size="1" color="gray">
          Made with ❤️ at{" "}
          <Link href="https://kanzo.tech" target="_blank" rel="noreferrer" size="1" color="gray" highContrast>
            Kanzo
          </Link>
        </Text>
      </Flex>

      {/* Top bar — title + view toggles. */}
      <Flex align="center" gap="3" wrap="wrap" px="5" py="3" style={{ flexShrink: 0, borderBottom: PANEL_BORDER }}>
        <Flex direction="column" mr="2" gap="1">
          {branding?.logoUrl ? (
            <BrandLogo url={branding.logoUrl} ratio={branding.logoRatio ?? 4} height={26} label="Evidenze" />
          ) : (
            <>
              <Heading size="4">metadata-form</Heading>
              <Text size="1" color="gray">
                SHACL shapes → editable RDF form → Turtle &amp; JSON-LD
              </Text>
            </>
          )}
        </Flex>

        <Box flexGrow="1" />

        {actions}
        {/* The canonical validation summary — same in every layout (per-section
            badges in tabs/steps are wayfinding dots, not a competing counter). */}
        <ValidationSummary form={form} />
        <Text size="1" color="gray">
          Preferences <Kbd>P</Kbd>
        </Text>
      </Flex>
    </>
  );
}
