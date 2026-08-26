import {
  Badge,
  Button,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  ScrollArea,
} from "@kanzo-tech/ui";
import type { Severity } from "../../form/validation.js";
import { column, ink, row } from "../styles.js";
import type { MetadataFormController } from "../hooks/useMetadataForm.js";

/** Severity is a domain word; on the surface the design system spells the same
 *  three families `destructive` / `warning` / `info`, and `destructive` is what
 *  every other recipe uses for "this went wrong". Read as tokens, not classes —
 *  see `../styles.ts`. */
const MSG_INK: Record<Severity, string> = {
  violation: ink.destructive,
  warning: ink.warning,
  info: ink.muted,
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
      <Badge variant="success" pill>
        {validLabel}
      </Badge>
    );
  }

  const variant = rows.some((r) => r.severity === "violation") ? "destructive" : "warning";

  return (
    <HoverCard openDelay={120}>
      <HoverCardTrigger>
        <Badge variant={variant} pill style={{ cursor: "default" }}>
          {rows.length} issue{rows.length === 1 ? "" : "s"}
        </Badge>
      </HoverCardTrigger>
      {/* An explicit width, not a max: a shrink-to-fit box collapses because the
          scroll area inside it is 100% wide. With room to breathe, each issue
          (field + message) sits on one row. */}
      <HoverCardContent style={{ width: "min(480px, 92vw)" }}>
        <ScrollArea style={{ maxHeight: "20rem" }}>
          <div style={{ ...column, paddingInlineEnd: "0.5rem" }}>
            {rows.map((r, i) => (
              <div key={`${r.key}-${i}`} style={{ ...row, alignItems: "baseline", justifyContent: "space-between", gap: "1rem" }}>
                <Button
                  variant="link"
                  size="sm"
                  style={{ height: "auto", padding: 0, whiteSpace: "nowrap", fontWeight: 500 }}
                  onClick={() => form.revealField(r.key)}
                >
                  {r.label}
                </Button>
                <span style={{ textAlign: "end", fontSize: "0.75rem", color: MSG_INK[r.severity] }}>{r.message}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </HoverCardContent>
    </HoverCard>
  );
}
