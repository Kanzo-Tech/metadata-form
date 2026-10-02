import {
  type Finding,
  FindingsContent,
  FindingsGoTo,
  FindingsGroup,
  FindingsRoot,
  FindingsTrigger,
} from "@kanzo-tech/ui";
import { count } from "../../i18n/strings.js";
import type { MetadataFormController } from "../hooks/useMetadataForm.js";
import type { IssueRow } from "./formReport.js";
import { IssueDiagnostic, issueId, type ValidationPanelLabels, VARIANT, wordsFor } from "./ValidationPanel.js";

export interface ValidationSummaryProps {
  form: MetadataFormController;
  /** Text for the valid state; defaults to the form's own word for it. */
  validLabel?: string;
  labels?: ValidationPanelLabels;
}

interface IssueFinding extends Finding {
  row: IssueRow;
}

/**
 * The validation tally: a pill counting the issues that opens on them, grouped
 * worst first, each one a collapsible finding with a way to its field. A valid
 * form's pill is not a control: there is nothing to open.
 *
 * **Opening it marks every issue on its field**, and closing it does not unmark
 * them: reading the list is asking to see the form's problems, and they stay in
 * view while they are fixed. A field still says nothing until it is touched for
 * as long as nobody has asked.
 */
export function ValidationSummary({ form, validLabel, labels }: ValidationSummaryProps) {
  const { rows } = form.report.issues;
  const { chrome } = form.strings;
  const words = wordsFor(form.strings, labels);
  const findings = rows.map((row, i): IssueFinding => ({ id: issueId(row, i), variant: VARIANT[row.severity], row }));

  const item = ({ row }: IssueFinding) => (
    <IssueDiagnostic actions={<FindingsGoTo>{words.goTo}</FindingsGoTo>} form={form} row={row} words={words} />
  );

  return (
    <FindingsRoot
      findings={findings}
      onOpenChange={({ open }) => {
        if (open) form.setRevealAll(true);
      }}
      onSelect={({ row }) => form.revealField(row.key)}
    >
      <FindingsTrigger pill size="xs">
        {({ total }) => (total ? count(form.strings, chrome.issues, total) : (validLabel ?? chrome.valid))}
      </FindingsTrigger>
      <FindingsContent description={words.description}>
        <FindingsGroup title={words.groups.violation} variant="destructive">
          {item}
        </FindingsGroup>
        <FindingsGroup title={words.groups.warning} variant="warning">
          {item}
        </FindingsGroup>
        <FindingsGroup title={words.groups.info} variant="info">
          {item}
        </FindingsGroup>
      </FindingsContent>
    </FindingsRoot>
  );
}
