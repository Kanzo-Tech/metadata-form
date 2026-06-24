import { Badge, Flex, HoverCard, Link, ScrollArea, Text } from "@radix-ui/themes";
import type { Severity } from "../../core/schema/validation.js";
import type { MetadataFormController } from "../hooks/useMetadataForm.js";

const MSG_COLOR: Record<Severity, "red" | "amber" | "blue"> = {
  violation: "red",
  warning: "amber",
  info: "blue",
};

export interface ValidationSummaryProps {
  form: MetadataFormController;
  /** Text for the valid state. */
  validLabel?: string;
}

/**
 * A compact validation status pill. Hover for every issue (field + message on
 * one row, tinted by severity); click a field to jump to it.
 */
export function ValidationSummary({ form, validLabel = "Valid" }: ValidationSummaryProps) {
  const { rows } = form.report.issues;

  if (rows.length === 0) {
    return (
      <Badge color="green" variant="soft" radius="full">
        {validLabel}
      </Badge>
    );
  }

  const color = rows.some((r) => r.severity === "violation") ? "red" : "amber";

  return (
    <HoverCard.Root openDelay={120}>
      <HoverCard.Trigger>
        <Badge color={color} variant="soft" radius="full" style={{ cursor: "default" }}>
          {rows.length} issue{rows.length === 1 ? "" : "s"}
        </Badge>
      </HoverCard.Trigger>
      {/* Explicit width (not maxWidth) so the popover actually widens — a
          shrink-to-fit maxWidth collapses because the inner ScrollArea is 100%
          wide. With room to breathe, each issue (field + message) sits on one row. */}
      <HoverCard.Content size="2" style={{ width: "min(480px, 92vw)" }}>
        <ScrollArea type="auto" style={{ maxHeight: 320 }}>
          <Flex direction="column" gap="2" pr="2">
            {rows.map((row, i) => (
              <Flex key={`${row.key}-${i}`} align="baseline" justify="between" gap="4">
                <Link
                  size="2"
                  weight="medium"
                  color="gray"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    form.revealField(row.key);
                  }}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {row.label}
                </Link>
                <Text size="1" color={MSG_COLOR[row.severity]} align="right">
                  {row.message}
                </Text>
              </Flex>
            ))}
          </Flex>
        </ScrollArea>
      </HoverCard.Content>
    </HoverCard.Root>
  );
}
