import { useState } from "react";
import {
  Diagnostic,
  DiagnosticActions,
  DiagnosticContent,
  DiagnosticDescription,
  DiagnosticFrame,
  DiagnosticFrames,
  DiagnosticHeader,
  DiagnosticList,
  DiagnosticSeverity,
  DiagnosticSource,
  DiagnosticTitle,
  DiagnosticTrigger,
  EmptyDescription,
  EmptyHeader,
  EmptyRoot,
} from "@kanzo-tech/ui";
import type { Severity } from "../../form/validation.js";
import type { ResolvedStrings } from "../../i18n/strings.js";
import type { IssueRow } from "./formReport.js";
import type { MetadataFormController } from "../hooks/useMetadataForm.js";

/** Severity is a domain word; the design system spells the same three families
 *  `destructive` / `warning` / `info`, and `destructive` is what every other
 *  recipe uses for "this went wrong". */
export const VARIANT: Record<Severity, "destructive" | "warning" | "info"> = {
  violation: "destructive",
  warning: "warning",
  info: "info",
};

export interface ValidationPanelLabels {
  /** Shown when the report is clean. */
  empty?: string;
  severity?: Partial<Record<Severity, string>>;
  consequence?: Partial<Record<Severity, string>>;
  /** Precedes the offending term. */
  reportedValue?: string;
  /** Accessible name of the disclosure. `{field}` is replaced by the field's label. */
  detailsOf?: string;
  /** The tally's subtitle, group headings and go-to control. */
  description?: string;
  groups?: Partial<Record<Severity, string>>;
  goTo?: string;
}

/** The panel's own wording, from the catalog the controller already resolved for
 *  the active locale — the same one the messages themselves came through. A form
 *  whose fields and errors are Spanish and whose badge says "Violation" is a form
 *  that is half translated. `labels` still wins, per consumer. */
export function wordsFor(strings: ResolvedStrings, labels: ValidationPanelLabels | undefined) {
  const p = strings.validationPanel;
  return {
    empty: labels?.empty ?? p.empty,
    reportedValue: labels?.reportedValue ?? p.reportedValue,
    detailsOf: labels?.detailsOf ?? p.detailsOf,
    description: labels?.description ?? p.description,
    goTo: labels?.goTo ?? p.goTo,
    groups: {
      violation: labels?.groups?.violation ?? p.violations,
      warning: labels?.groups?.warning ?? p.warnings,
      info: labels?.groups?.info ?? p.infos,
    } as Record<Severity, string>,
    severity: {
      violation: labels?.severity?.violation ?? p.violation,
      warning: labels?.severity?.warning ?? p.warning,
      info: labels?.severity?.info ?? p.info,
    } as Record<Severity, string>,
    consequence: {
      violation: labels?.consequence?.violation ?? p.violationDetail,
      warning: labels?.consequence?.warning ?? p.warningDetail,
      info: labels?.consequence?.info ?? p.infoDetail,
    } as Record<Severity, string>,
  };
}

export interface ValidationPanelProps {
  form: MetadataFormController;
  /**
   * Which row is expanded, and the report of a change.
   *
   * **Controlled on purpose, and this is the trap it exists for.** A host that
   * docks this in a resizable workspace re-keys its splitter whenever any panel
   * opens, and the re-key remounts every column — so a finding held in its own
   * uncontrolled `Collapsible`, or even in this component's state, closes the
   * moment a frame here opens the source panel. The id has to live above the
   * thing that remounts. Omit both and the panel keeps its own state, which is
   * right for a host that does not remount it.
   */
  openId?: string | null;
  onOpenChange?: (id: string | null) => void;
  labels?: ValidationPanelLabels;
}

/** `sh:MinCountConstraintComponent` → `MinCount`. The IRI is unusable on this
 *  surface: `DiagnosticSource` is `shrink-0` with no truncation, so a full IRI
 *  runs straight out of a panel that is a fifth of the workspace wide. */
function constraintName(iri: string | undefined): string | undefined {
  if (!iri) return undefined;
  const local = iri.split(/[#/]/).pop() || iri;
  return local.replace(/ConstraintComponent$/, "") || local;
}

/** The hierarchical label as a *position*. `DiagnosticFrame` recedes everything
 *  before the last `/` and gives the weight to what follows — which is exactly
 *  what "Publisher › Name" means, so it is handed over in the punctuation that
 *  component reads. Without it the whole label is one unbreakable file segment. */
const asPath = (label: string) => label.split(" › ").join("/");

/** The offending term, in one short line. Literals read as their lexical form;
 *  a node is named by its IRI, which is long and has to be allowed to break. */
const valueText = (row: IssueRow) =>
  row.value ? (row.value.termType === "Literal" ? `“${row.value.value}”` : row.value.value) : undefined;

/** The words one finding is drawn with, resolved once per list. */
export type IssueWords = ReturnType<typeof wordsFor>;

export interface IssueDiagnosticProps {
  form: MetadataFormController;
  row: IssueRow;
  words: IssueWords;
  /** Beside the disclosure: the tally's "go to field". */
  actions?: React.ReactNode;
  /** Where the field frame goes. Without it the frame is a static position. */
  onSelect?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * One finding as a collapsible `Diagnostic`: severity, where and the disclosure on
 * one line, the message under them on its own (`basis-full`) — how every compiler
 * prints one, and the only shape that survives a narrow column. Opened, it says
 * what the severity costs, the offending value and the field as a position.
 *
 * The one row both the tally and the panel draw, so a finding reads the same
 * wherever it is listed.
 */
export function IssueDiagnostic({ form, row, words, actions, onSelect, open, onOpenChange }: IssueDiagnosticProps) {
  // The leaf of the hierarchical label, and NOT the constraint: three fields
  // missing a value all say "This field is required", so the constraint name
  // in the one always-visible identifier slot would make three rows a reader
  // cannot tell apart. The rule that raised it is a frame below.
  const where = row.label.split(" › ").pop() || row.label;
  const message = form.resolveMessage(row);
  const value = valueText(row);

  return (
    <Diagnostic
      onOpenChange={onOpenChange && ((d) => onOpenChange(d.open))}
      open={open}
      variant={VARIANT[row.severity]}
    >
      <DiagnosticHeader>
        <DiagnosticSeverity>{words.severity[row.severity]}</DiagnosticSeverity>
        <DiagnosticSource>{where}</DiagnosticSource>
        <DiagnosticActions className="ms-auto">
          {actions}
          {/* The chevron alone; the name it carries is what `aria-label` is for. */}
          <DiagnosticTrigger aria-label={words.detailsOf.replace("{field}", row.label)} />
        </DiagnosticActions>
        <DiagnosticTitle className="basis-full" lang={message.lang}>
          {message.text}
        </DiagnosticTitle>
      </DiagnosticHeader>
      <DiagnosticContent>
        <DiagnosticDescription>{words.consequence[row.severity]}</DiagnosticDescription>
        {value ? (
          // An IRI has no spaces, so it needs telling that it may break; without
          // this the reported value pushes the list's own scrollbar sideways.
          <DiagnosticDescription className="wrap-anywhere">
            {words.reportedValue}: {value}
          </DiagnosticDescription>
        ) : null}
        <DiagnosticFrames>
          <DiagnosticFrame label={constraintName(row.constraint)} onSelect={onSelect} path={asPath(row.label)} />
        </DiagnosticFrames>
      </DiagnosticContent>
    </Diagnostic>
  );
}

/**
 * The findings, as a panel: one {@link IssueDiagnostic} per issue, for a host that
 * wants the list on the page rather than behind {@link ValidationSummary}'s tally.
 * Both project the same `form.report.issues.rows`.
 *
 * **Library-side, chrome excluded.** What a host wraps this in — an aside, a
 * drawer, a header with counts — is the host's arrangement; what a finding *is*
 * is ours, and a deployment should not have to copy a playground to get it.
 */
export function ValidationPanel({ form, openId, onOpenChange, labels }: ValidationPanelProps) {
  const { rows } = form.report.issues;
  const words = wordsFor(form.strings, labels);
  const [held, setHeld] = useState<string | null>(null);
  const open = openId !== undefined ? openId : held;
  const setOpen = onOpenChange ?? setHeld;

  if (rows.length === 0) {
    return (
      <EmptyRoot>
        <EmptyHeader>
          <EmptyDescription>{words.empty}</EmptyDescription>
        </EmptyHeader>
      </EmptyRoot>
    );
  }

  return (
    <DiagnosticList>
      {rows.map((row, i) => {
        // The index is part of the id because one field can fail two ways with the
        // same wording, and two rows that cannot be told apart cannot be opened apart.
        const id = issueId(row, i);
        return (
          <IssueDiagnostic
            form={form}
            key={id}
            onOpenChange={(o) => setOpen(o ? id : null)}
            onSelect={() => form.revealField(row.key)}
            open={open === id}
            row={row}
            words={words}
          />
        );
      })}
    </DiagnosticList>
  );
}

/** A finding's identity in a list: its field, its rule and its place. */
export const issueId = (row: IssueRow, i: number) => `${row.key}|${row.constraint ?? ""}|${i}`;
