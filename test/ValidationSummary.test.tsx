import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ValidationSummary } from "@/react/validation/ValidationSummary.js";
import type { IssueRow } from "@/react/validation/formReport.js";
import type { FieldError } from "@/form/validation.js";
import { resolveStrings } from "@/i18n/strings.js";
import { es, ca } from "@kanzo-tech/metadata-form/i18n";
import type { MetadataFormController } from "@/react/hooks/useMetadataForm.js";

const MIN_COUNT = "http://www.w3.org/ns/shacl#MinCountConstraintComponent";

/** The tally reads the report, the strings, the message resolver and two verbs. */
function controllerFor(rows: IssueRow[], languages = ["en"]) {
  const setRevealAll = vi.fn();
  const revealField = vi.fn();
  const form = {
    report: { issues: { total: rows.length, hasViolations: rows.some((r) => r.severity === "violation"), rows } },
    strings: resolveStrings(languages, { es: es.strings, ca: ca.strings }),
    resolveMessage: (e: FieldError) => ({ text: e.messages[0].value }),
    revealAll: false,
    setRevealAll,
    revealField,
  } as unknown as MetadataFormController;
  return { form, setRevealAll, revealField };
}

const row = (over: Partial<IssueRow>): IssueRow => ({
  key: "d1|title",
  label: "Title",
  messages: [{ value: "This field is required", language: "" }],
  severity: "violation",
  constraint: MIN_COUNT,
  ...over,
});

const ROWS = [
  row({ key: "d1|licence", label: "Licence", severity: "warning", messages: [{ value: "Not a known licence", language: "" }] }),
  row({ key: "d1|title", label: "Title" }),
  row({ key: "d1|notice", label: "Notice" }),
];

const open = async (name: RegExp | string) => {
  fireEvent.click(screen.getByRole("button", { name }));
  return screen.findByRole("dialog");
};

describe("ValidationSummary", () => {
  it("counts every issue and wears the worst one", () => {
    const { form } = controllerFor(ROWS);
    render(<ValidationSummary form={form} />);
    const trigger = screen.getByRole("button", { name: "3 issues" });
    expect(trigger.getAttribute("data-variant")).toBe("destructive");
  });

  it("is valid, and not a control, when nothing was found", () => {
    const { form } = controllerFor([]);
    render(<ValidationSummary form={form} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Valid").getAttribute("data-variant")).toBe("success");
  });

  it("marks every issue on its field when it is opened, and lists them worst first", async () => {
    const { form, setRevealAll } = controllerFor(ROWS);
    render(<ValidationSummary form={form} />);
    const dialog = await open("3 issues");

    expect(setRevealAll).toHaveBeenCalledWith(true);
    const groups = within(dialog).getAllByRole("region");
    expect(groups.map((g) => g.getAttribute("data-variant"))).toEqual(["destructive", "warning"]);
    expect(within(groups[0]!).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Title"),
      expect.stringContaining("Notice"),
    ]);
  });

  it("goes to a finding's field and closes", async () => {
    const { form, revealField } = controllerFor(ROWS);
    render(<ValidationSummary form={form} />);
    const dialog = await open("3 issues");
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Go to field" })[0]!);
    expect(revealField).toHaveBeenCalledWith("d1|title");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("speaks the form's language", async () => {
    const { form } = controllerFor(ROWS, ["es"]);
    render(<ValidationSummary form={form} />);
    const dialog = await open("3 incidencias");
    expect(within(dialog).getByRole("region", { name: "Infracciones 2" })).toBeTruthy();
    expect(within(dialog).getAllByRole("button", { name: "Ir al campo" })).toHaveLength(3);
  });
});
