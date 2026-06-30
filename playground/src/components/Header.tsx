import { Box, Button, Flex, Heading, Kbd, Link, Text } from "@radix-ui/themes";
import { CheckIcon, CodeIcon, FileTextIcon, Share1Icon } from "@radix-ui/react-icons";
import { ValidationSummary } from "metadata-form";
import { Toggle } from "./Toggle.js";
import { ExamplePickers } from "./ExamplePickers.js";
import { PANEL_BORDER } from "./panel.js";
import type { ShapeExample } from "@examples/index.js";

/** The app chrome: a low-key utility strip (example pickers + attribution) over the
 *  title bar (heading + Source/Output toggles + the canonical validation summary). */
export function Header({
  examples,
  shapeId,
  dataOptions,
  dataId,
  onPickShape,
  onPickData,
  onShare,
  shared,
  showSource,
  toggleSource,
  showOutput,
  toggleOutput,
  form,
}: {
  examples: ShapeExample[];
  shapeId: string;
  dataOptions: ShapeExample["data"];
  dataId: string;
  onPickShape: (id: string) => void;
  onPickData: (id: string) => void;
  onShare: () => void;
  shared: boolean;
  showSource: boolean;
  toggleSource: () => void;
  showOutput: boolean;
  toggleOutput: () => void;
  form: React.ComponentProps<typeof ValidationSummary>["form"];
}) {
  return (
    <>
      {/* Utility strip — example pickers, deliberately low-key (top-right, like a
          language switcher) so they read as context, not primary controls. */}
      <Flex
        align="center"
        justify="between"
        gap="3"
        px="5"
        py="1"
        style={{ flexShrink: 0, background: "var(--gray-a2)", borderBottom: PANEL_BORDER }}
      >
        <Flex align="center" gap="3">
          <ExamplePickers
            examples={examples}
            shapeId={shapeId}
            dataOptions={dataOptions}
            dataId={dataId}
            onPickShape={onPickShape}
            onPickData={onPickData}
          />
          {/* Copy a self-contained permalink (shapes + data compressed into the URL
              fragment). Explicit-only so edits don't spam history. */}
          <Button size="1" variant="ghost" color="gray" onClick={onShare}>
            {shared ? <CheckIcon /> : <Share1Icon />}
            {shared ? "Copied!" : "Share"}
          </Button>
        </Flex>
        <Text size="1" color="gray">
          Made with ❤️ at{" "}
          <Link href="https://kanzo.tech" target="_blank" rel="noreferrer" size="1" color="gray" highContrast>
            Kanzo
          </Link>
        </Text>
      </Flex>

      {/* Top bar — title + view toggles. */}
      <Flex align="center" gap="3" wrap="wrap" px="5" py="3" style={{ flexShrink: 0, borderBottom: PANEL_BORDER }}>
        <Flex direction="column" mr="2">
          <Heading size="4">metadata-form</Heading>
          <Text size="1" color="gray">
            SHACL/DASH shapes → editable RDF form → Turtle &amp; JSON-LD
          </Text>
        </Flex>

        <Box flexGrow="1" />

        <Toggle on={showSource} onClick={toggleSource} icon={<FileTextIcon />} kbd="S">
          Source
        </Toggle>
        <Toggle on={showOutput} onClick={toggleOutput} icon={<CodeIcon />} kbd="O">
          Output
        </Toggle>
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
