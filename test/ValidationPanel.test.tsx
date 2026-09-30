import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ValidationPanel } from "@/react/validation/ValidationPanel.js";
import { computeFormReport, type IssueRow } from "@/react/validation/formReport.js";
import { fieldKey, type FieldError } from "@/form/validation.js";
import type { FieldModel, FormModel } from "@/form/FormModel.js";
import { blankNode, literal, namedNode } from "@/engine/factory.js";
import { resolveStrings } from "@/i18n/strings.js";
import type { MetadataFormController } from "@/react/hooks/useMetadataForm.js";

const SH = "http://www.w3.org/ns/shacl#";
const MIN_COUNT = `${SH}MinCountConstraintComponent`;
const NODE = `${SH}NodeConstraintComponent`;

/**
 * The panel reads exactly three things off the controller, so a test that stands
 * up rudof to reach them would be pinning the engine rather than the projection.
 * The rows come from `computeFormReport`, which has its own cases below.
 */
function controllerFor(
  rows: IssueRow[],
  extra: { locale?: string; revealField?: (id: string) => void } = {},
): MetadataFormController {
  return {
    report: {
      issues: { total: rows.length, hasViolations: rows.some((r) => r.severity === "violation"), rows },
    },
    strings: resolveStrings(extra.locale ?? "en"),
    revealField: extra.revealField ?? (() => {}),
  } as unknown as MetadataFormController;
}

const row = (over: Partial<IssueRow> = {}): IssueRow => ({
  key: "http://example.org/d1|http://purl.org/dc/terms/title",
  label: "Publisher › Name",
  message: "This field is required",
  severity: "violation",
  constraint: MIN_COUNT,
  ...over,
});

const slot = (name: string) => document.querySelectorAll<HTMLElement>(`[data-slot="${name}"]`);

/** Ark's Collapsible does not mount its content until it is open, so everything
 *  below the header — the consequence, the reported value, the frame — exists only
 *  after the reader asks for it. That is the panel's whole shape: a header you scan
 *  and a body you open. */
async function expand(index = 0) {
  fireEvent.click(slot("diagnostic-trigger")[index]);
  await waitFor(() => expect(slot("diagnostic-content")[0]).toBeDefined());
}

/** A field standing in for one the builder would have produced. */
const field = (over: Partial<FieldModel> & Pick<FieldModel, "id" | "label">): FieldModel => ({
  path: namedNode("http://example.org/p"),
  pathKind: "predicate",
  editorId: "http://datashapes.org/shui#TextFieldEditor",
  required: true,
  repeatable: false,
  minCount: 1,
  order: 0,
  groupId: "g",
  constraints: {},
  values: [],
  ...over,
});

describe("<ValidationPanel>", () => {
  it("names the FIELD in the always-visible slot and the RULE in the frame", async () => {
    render(<ValidationPanel form={controllerFor([row()])} />);

    // The leaf of the hierarchical label, not the constraint: three fields missing a
    // value all say "This field is required", so a constraint here would make three
    // collapsed rows a reader cannot tell apart.
    expect(slot("diagnostic-source")[0].textContent).toBe("Name");
    // The message gets the line under it, which is where a compiler prints one.
    expect(slot("diagnostic-title")[0].textContent).toBe("This field is required");

    // ...and the rule is a frame label, in its LOCAL name. The frame does not
    // truncate its own file segment, so an IRI there runs out of the panel.
    await expand();
    expect(slot("diagnostic-frame-label")[0].textContent).toBe("MinCount");
    expect(document.body.textContent).not.toContain(SH);
  });

  it("hands the hierarchical label over as a path, so the parent recedes", async () => {
    render(<ValidationPanel form={controllerFor([row()])} />);
    await expand();

    // `DiagnosticFrame` splits on the last "/" and gives the weight to what follows.
    // Fed the raw " › " label it would have one unbreakable segment and no hierarchy.
    expect(slot("diagnostic-frame-directory")[0].textContent).toBe("Publisher/");
    expect(slot("diagnostic-frame-file")[0].textContent).toBe("Name");
  });

  it("jumps to the field the finding is about", async () => {
    const revealField = vi.fn();
    render(<ValidationPanel form={controllerFor([row()], { revealField })} />);
    await expand();

    fireEvent.click(screen.getByRole("button", { name: "Publisher/Name — MinCount" }));
    expect(revealField).toHaveBeenCalledWith(row().key);
  });

  it("keeps two identical findings apart, because the wording cannot", async () => {
    const onOpenChange = vi.fn();
    const twice = [row(), row()];
    render(<ValidationPanel form={controllerFor(twice)} openId={null} onOpenChange={onOpenChange} />);

    // Same field, same rule, same wording — so the id has to carry the position, or
    // opening either one would open both. And with `openId` supplied the panel holds
    // nothing itself: every press is a report upward, which is the contract a host
    // that remounts its columns depends on.
    const triggers = slot("diagnostic-trigger");
    expect(triggers).toHaveLength(2);
    fireEvent.click(triggers[0]);
    fireEvent.click(triggers[1]);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledTimes(2));
    const [first, second] = onOpenChange.mock.calls.map(([id]) => id as string);
    expect(first).toBeTruthy();
    expect(first).not.toBe(second);
    // Nothing opened, because nothing told it to.
    expect(slot("diagnostic-content")).toHaveLength(0);
  });

  it("survives a row whose label has no parent and whose rule is unknown", async () => {
    render(<ValidationPanel form={controllerFor([row({ label: "Title", constraint: undefined })])} />);
    expect(slot("diagnostic-source")[0].textContent).toBe("Title");

    await expand();
    expect(slot("diagnostic-frame-file")[0].textContent).toBe("Title");
    expect(slot("diagnostic-frame-directory")).toHaveLength(0);
    // No rule to name, so the frame carries none — but it is still the jump.
    expect(slot("diagnostic-frame-label")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Title" })).toBeInTheDocument();
  });

  it("shows the offending term when the finding is opened, literals quoted", async () => {
    const rows = [row({ constraint: `${SH}DatatypeConstraintComponent`, value: literal("nope") })];
    render(<ValidationPanel form={controllerFor(rows)} />);
    await expand();

    expect(screen.getByText("Reported value: “nope”")).toBeInTheDocument();
    expect(screen.getByText("The data does not satisfy the shape until this is resolved.")).toBeInTheDocument();
  });

  it("takes its own chrome from the locale the messages came through", () => {
    render(<ValidationPanel form={controllerFor([row()], { locale: "es-ES" })} />);

    // A form whose fields and errors are Spanish and whose badge says "Violation" is
    // a form that is half translated — and that includes the name only a screen
    // reader hears, which is the half nobody notices is still English.
    expect(slot("diagnostic-severity")[0].textContent).toBe("Infracción");
    expect(screen.getByRole("button", { name: "Detalles de la incidencia en Publisher › Name" })).toBeInTheDocument();
  });

  it("says so when there is nothing to say, in the reader's language", () => {
    const { rerender } = render(<ValidationPanel form={controllerFor([])} />);
    expect(screen.getByText("Nothing to fix. Every shape this form covers is satisfied.")).toBeInTheDocument();
    expect(slot("diagnostic-list")).toHaveLength(0);

    rerender(<ValidationPanel form={controllerFor([], { locale: "ca" })} />);
    expect(screen.getByText("No hi ha res a corregir. El formulari compleix totes les formes.")).toBeInTheDocument();
  });
});

/**
 * D7, and the reason the panel can be a flat list at all: without the rollup drop a
 * nested violation arrives twice — once as the cause and once as "something in here
 * is wrong" — and the second row is noise that also doubles the header's count.
 */
describe("the rows the panel is given", () => {
  const dataset = namedNode("http://example.org/d1");
  const publisher = namedNode("http://purl.org/dc/terms/publisher");
  const name = namedNode("http://xmlns.com/foaf/0.1/name");
  const agent = blankNode("b0");
  const rollupKey = fieldKey(dataset, publisher);
  const nameKey = fieldKey(agent, name);

  /** A dataset with a nested publisher — the shape of every `sh:node` finding. */
  const model: FormModel = {
    focusNode: dataset,
    shape: namedNode("http://example.org/DatasetShape"),
    groups: [
      {
        id: "g",
        order: 0,
        fields: [
          field({
            id: rollupKey,
            label: "Publisher",
            path: publisher,
            nodeShape: namedNode("http://example.org/AgentShape"),
            values: [
              {
                id: "v0",
                value: agent,
                nested: {
                  focusNode: agent,
                  shape: namedNode("http://example.org/AgentShape"),
                  groups: [{ id: "g2", order: 0, fields: [field({ id: nameKey, label: "Name", path: name })] }],
                },
              },
            ],
          }),
        ],
      },
    ],
  };

  const rollup: FieldError = {
    message: "Some details in this section are incomplete",
    severity: "violation",
    constraint: NODE,
    value: agent,
  };
  const cause: FieldError = { message: "This field is required", severity: "violation", constraint: MIN_COUNT };

  it("drops the sh:node rollup once the nested cause has reported", () => {
    const report = computeFormReport(model, new Map([[rollupKey, [rollup]], [nameKey, [cause]]]));

    expect(report.issues.rows).toHaveLength(1);
    expect(report.issues.rows[0].label).toBe("Publisher › Name");
    expect(report.issues.rows[0].constraint).toBe(MIN_COUNT);
  });

  it("keeps it when nothing nested reported, because then it is all there is", () => {
    const report = computeFormReport(model, new Map([[rollupKey, [rollup]], [nameKey, []]]));

    expect(report.issues.rows).toHaveLength(1);
    expect(report.issues.rows[0].label).toBe("Publisher");
    expect(report.issues.rows[0].constraint).toBe(NODE);
  });
});
