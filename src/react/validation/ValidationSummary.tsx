import {
  Badge,
  Button,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  ScrollArea,
  Status,
} from "@kanzo-tech/ui";
import type { Severity } from "../../form/validation.js";
import type { MetadataFormController } from "../hooks/useMetadataForm.js";
import { count } from "../../i18n/strings.js";

/** Severity is a domain word; on the surface the design system spells the same
 *  three families `destructive` / `warning` / `info`, and `destructive` is what
 *  every other recipe uses for "this went wrong". */
const TONE: Record<Severity, "destructive" | "warning" | "info"> = {
  violation: "destructive",
  warning: "warning",
  info: "info",
};

export interface ValidationSummaryProps {
  form: MetadataFormController;
  /** Text for the valid state; defaults to the form's own word for it. */
  validLabel?: string;
}

/**
 * A compact validation tally that can be interrogated. Hover for every issue
 * (field + message on one row, tinted by severity; click a field to jump to it);
 * press it to mark them all **where they are**, on their fields.
 *
 * Drawn as the design system draws a tally: the house's smallest pill, outlined,
 * with the severity carried by a dot — a count is a fact about the form, not an
 * alarm, and a filled red pill in a page header is the loudest thing on the page
 * for as long as the form is unfinished. It fills only while pressed, which is
 * when it is saying something the reader asked for.
 *
 * Deliberately not `Diagnostic`, which the design system built for exactly this
 * domain — its own comment names a SHACL violation. `Diagnostic` is a collapsible
 * finding for a *panel*, and a collapsible inside a hover card that closes when
 * the pointer leaves is a control nobody can open. This is the summary half of
 * "summary now, inline on touch"; `ValidationPanel` is the list.
 */
export function ValidationSummary({ form, validLabel }: ValidationSummaryProps) {
  const { rows } = form.report.issues;
  const { chrome } = form.strings;

  if (rows.length === 0) {
    return (
      <Badge pill size="xs" variant="success">
        {validLabel ?? chrome.valid}
      </Badge>
    );
  }

  const tone = rows.some((r) => r.severity === "violation") ? "destructive" : "warning";
  const active = form.revealAll;

  return (
    <HoverCard openDelay={120}>
      {/* The press lives on the badge and not inside the card: a hover card closes
          as soon as the pointer leaves its trigger. Hovering reads; pressing acts. */}
      <HoverCardTrigger asChild>
        <button
          aria-label={active ? chrome.unmarkIssues : chrome.markIssues}
          aria-pressed={active}
          className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          onClick={() => form.setRevealAll(!active)}
          type="button"
        >
          <Badge className="tabular-nums" pill size="xs" variant={active ? tone : "outline"}>
            <Status style={{ width: "0.375rem", height: "0.375rem" }} variant={tone} />
            {count(form.strings, chrome.issues, rows.length)}
          </Badge>
        </button>
      </HoverCardTrigger>
      {/* An explicit width, not a max: a shrink-to-fit box collapses because the
          scroll area inside it is 100% wide. With room to breathe, each issue
          (field + message) sits on one row. */}
      <HoverCardContent className="w-[min(480px,92vw)]">
        <ScrollArea className="max-h-80">
          <div className="flex flex-col gap-2 pe-2">
            {rows.map((r, i) => (
              <div className="flex items-baseline justify-between gap-4" key={`${r.key}-${i}`}>
                <span className="flex items-center gap-2">
                  <Status variant={TONE[r.severity]} />
                  <Button
                    className="h-auto whitespace-nowrap p-0"
                    onClick={() => form.revealField(r.key)}
                    size="sm"
                    variant="link"
                  >
                    {r.label}
                  </Button>
                </span>
                <span className="text-end" lang={form.resolveMessage(r).lang}>
                  {form.resolveMessage(r).text}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </HoverCardContent>
    </HoverCard>
  );
}
