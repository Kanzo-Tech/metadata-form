import {
  Badge,
  Button,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  ScrollArea,
} from "@kanzo-tech/ui";
import type { Severity } from "../../form/validation.js";
import type { MetadataFormController } from "../hooks/useMetadataForm.js";

/** Severity is a domain word; on the surface the design system spells the same
 *  three families `destructive` / `warning` / `info`, and `destructive` is what
 *  every other recipe uses for "this went wrong". */
const MSG_CLASS: Record<Severity, string> = {
  violation: "text-destructive-foreground",
  warning: "text-warning-foreground",
  info: "text-muted-foreground",
};

export interface ValidationSummaryProps {
  form: MetadataFormController;
  /** Text for the valid state. */
  validLabel?: string;
}

/**
 * A compact validation status pill. Hover for every issue (field + message on
 * one row, tinted by severity); click a field to jump to it.
 *
 * Deliberately not `Diagnostic`, which the design system built for exactly this
 * domain — its own comment names a SHACL violation. `Diagnostic` is a collapsible
 * finding for a *panel*, and a collapsible inside a hover card that closes when
 * the pointer leaves is a control nobody can open. This is the summary half of
 * "summary now, inline on touch"; a findings panel over `DiagnosticList` is a
 * different component, and worth having separately.
 */
export function ValidationSummary({ form, validLabel = "Valid" }: ValidationSummaryProps) {
  const { rows } = form.report.issues;

  if (rows.length === 0) {
    return (
      <Badge variant="success" className="rounded-full">
        {validLabel}
      </Badge>
    );
  }

  const variant = rows.some((r) => r.severity === "violation") ? "destructive" : "warning";

  return (
    <HoverCard openDelay={120}>
      <HoverCardTrigger>
        <Badge variant={variant} className="cursor-default rounded-full">
          {rows.length} issue{rows.length === 1 ? "" : "s"}
        </Badge>
      </HoverCardTrigger>
      {/* An explicit width, not a max: a shrink-to-fit box collapses because the
          scroll area inside it is 100% wide. With room to breathe, each issue
          (field + message) sits on one row. */}
      <HoverCardContent className="w-[min(480px,92vw)]">
        <ScrollArea className="max-h-80">
          <div className="flex flex-col gap-2 pe-2">
            {rows.map((row, i) => (
              <div key={`${row.key}-${i}`} className="flex items-baseline justify-between gap-4">
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto whitespace-nowrap p-0 font-medium"
                  onClick={() => form.revealField(row.key)}
                >
                  {row.label}
                </Button>
                <span className={`text-end text-xs ${MSG_CLASS[row.severity]}`}>{row.message}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </HoverCardContent>
    </HoverCard>
  );
}
