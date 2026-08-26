import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor, renderHook, act, within } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { MetadataForm } from "@/react/form/MetadataForm.js";
import { ValidationSummary } from "@/react/validation/ValidationSummary.js";
import { FormAssistant } from "@/react/assistant/FormAssistant.js";
import { useMetadataForm, type UseMetadataFormOptions } from "@/react/hooks/useMetadataForm.js";
import { Editors } from "@/form/vocab/shacl-ui.js";
import { healthDcatApShapes } from "@examples/health-dcat-ap/index.js";

const shapes = healthDcatApShapes;

/** Test helper: the unified usage (hook + component) inside a Radix <Theme>. */
function Form(props: UseMetadataFormOptions & { onReady?: (q: number) => void }) {
  const form = useMetadataForm({ validateOn: "off", ...props });
  props.onReady?.(form.quads.length);
  return (
    <Theme>
      <MetadataForm form={form} />
    </Theme>
  );
}

describe("useMetadataForm + <MetadataForm>", () => {
  it("renders fields grouped by sh:group from the shape", async () => {
    render(<Form shapes={shapes} />);
    await waitFor(() => expect(screen.getByText("General")).toBeInTheDocument());
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Health-specific")).toBeInTheDocument();
  });

  it("arranges root groups as tabs when layout=\"tabs\"", async () => {
    function TabsForm() {
      const form = useMetadataForm({ shapes, validateOn: "off" });
      return (
        <Theme>
          <MetadataForm form={form} layout="tabs" />
        </Theme>
      );
    }
    render(<TabsForm />);
    await waitFor(() => expect(screen.getByRole("tab", { name: /General/ })).toBeInTheDocument());
    // One tab per property group (at least General + Health-specific).
    expect(screen.getAllByRole("tab").length).toBeGreaterThanOrEqual(2);
  });

  it("revealField switches to a field's tab so off-tab fields are reachable", async () => {
    let formRef: ReturnType<typeof useMetadataForm> | undefined;
    function TabsForm() {
      const form = useMetadataForm({ shapes, validateOn: "off" });
      formRef = form;
      return (
        <Theme>
          <MetadataForm form={form} layout="tabs" />
        </Theme>
      );
    }
    render(<TabsForm />);
    await waitFor(() => expect(screen.getByRole("tab", { name: /General/ })).toBeInTheDocument());

    const groups = formRef!.model!.groups;
    expect(groups.length).toBeGreaterThanOrEqual(2);
    const target = groups[1].fields[0]; // a field on a non-active tab
    const sel = `[data-field="${CSS.escape(target.id)}"]`;

    // Inactive tab content isn't mounted, so the field isn't in the DOM yet.
    expect(document.querySelector(sel)).toBeNull();

    // Revealing it must switch to its tab and mount it.
    act(() => formRef!.revealField(target.id));
    await waitFor(() => expect(document.querySelector(sel)).not.toBeNull());
  });

  it("offers field-assist suggestions via the ✨ button and commits the pick", async () => {
    function AssistForm() {
      const form = useMetadataForm({
        shapes,
        validateOn: "off",
        assist: { suggest: async function* ({ field }) { yield { value: `Suggested ${field.label}` }; } },
      });
      return (
        <Theme>
          <MetadataForm form={form} />
        </Theme>
      );
    }
    render(<AssistForm />);
    await waitFor(() => expect(screen.getByText("Title")).toBeInTheDocument());

    // The ✨ trigger opens a Radix Popover; suggestions stream in as the seam yields.
    // Title is the first suggestible field.
    const sparkles = screen.getAllByRole("button", { name: "Suggest a value" });
    fireEvent.click(sparkles[0]);

    const pick = await screen.findByText("Suggested Title");
    fireEvent.click(pick);

    await waitFor(() => {
      const input = document.querySelector<HTMLInputElement>("input");
      expect(input?.value).toBe("Suggested Title");
    });
  });

  it("keeps a fixed window of suggestions and regenerates one when dismissed", async () => {
    function AssistForm() {
      const form = useMetadataForm({
        shapes,
        validateOn: "off",
        assist: {
          suggest: async function* () {
            for (const v of ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]) yield { value: v };
          },
        },
      });
      return (
        <Theme>
          <MetadataForm form={form} />
        </Theme>
      );
    }
    render(<AssistForm />);
    await waitFor(() => expect(screen.getByText("Title")).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: "Suggest a value" })[0]);

    // Only the first three stream into the window — not all five.
    await screen.findByText("Charlie");
    expect(screen.getAllByRole("button", { name: "Dismiss suggestion" })).toHaveLength(3);
    expect(screen.queryByText("Delta")).toBeNull();

    // Dismissing Alpha regenerates the next one (Delta) to keep the window full.
    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss suggestion" })[0]);
    await screen.findByText("Delta");
    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Dismiss suggestion" })).toHaveLength(3);
  });

  it("streams inline ghost-text into the textarea and Tab accepts it", async () => {
    // Preload a description so the (repeatable) textarea field renders a row.
    const data = `@prefix dcterms: <http://purl.org/dc/terms/> .
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      <http://example.org/d1> a dcat:Dataset ; dcterms:description "Hello world" .`;
    function GhostForm() {
      const form = useMetadataForm({
        shapes,
        data,
        focusNode: "http://example.org/d1",
        validateOn: "off",
        // Streaming completion seam: two chunks.
        assist: { complete: async function* () { yield "the"; yield " rest"; } },
      });
      return (
        <Theme>
          <MetadataForm form={form} />
        </Theme>
      );
    }
    render(<GhostForm />);

    // A plain <textarea> again: the ghost is a compound composed over the design
    // system's Textarea, not an editor with a completion prop, so there is no
    // CodeMirror document to interrogate — only the value and what is painted.
    const area = () =>
      screen.getAllByRole("textbox").find((el) => el.tagName === "TEXTAREA") as HTMLTextAreaElement;
    await waitFor(() => expect(area()?.value).toContain("Hello world"));

    // A user edit requests a completion (debounced) which then streams into the ghost.
    fireEvent.change(area(), { target: { value: "Hello world." } });
    await waitFor(() => expect(document.body.textContent ?? "").toContain("the rest"), {
      timeout: 3000,
    });

    // Tab takes what is on offer, into the field's own value.
    fireEvent.keyDown(area(), { key: "Tab" });
    await waitFor(() => expect(area().value).toContain("the rest"));
  });

  it("<FormAssistant> reports the count of required-but-empty fields", async () => {
    function Guided() {
      const form = useMetadataForm({ shapes, validateOn: "off" });
      return (
        <Theme>
          <MetadataForm form={form} />
          <FormAssistant form={form} />
        </Theme>
      );
    }
    render(<Guided />);
    await waitFor(() => expect(screen.getByText(/required field/)).toBeInTheDocument());
  });

  it("renders the custom date picker (calendar button) for xsd:date fields", async () => {
    render(<Form shapes={shapes} />);
    await waitFor(() => expect(screen.getByText("Release date")).toBeInTheDocument());
    expect(document.querySelector('[aria-label="Open calendar"]')).toBeInTheDocument();
  });

  it("writes edits into the controller's graph", async () => {
    let latest = 0;
    render(<Form shapes={shapes} onReady={(q) => (latest = q)} />);
    await waitFor(() => expect(screen.getByText("Title")).toBeInTheDocument());

    const inputs = document.querySelectorAll<HTMLInputElement>("input");
    fireEvent.change(inputs[0], { target: { value: "My dataset" } });

    await waitFor(() => expect(latest).toBeGreaterThan(0));
    expect(inputs[0].value).toBe("My dataset");
  });

  it("keeps the same input node (no remount → no lost focus/hover) when an empty field gets its first value", async () => {
    let latest = 0;
    render(<Form shapes={shapes} onReady={(q) => (latest = q)} />);
    await waitFor(() => expect(screen.getByText("Title")).toBeInTheDocument());

    // Baseline = quads already present from seeding the focus node (its rdf:type).
    const baseline = latest;
    const input = document.querySelector<HTMLInputElement>("input")!;
    input.focus();
    expect(document.activeElement).toBe(input);

    // Typing commits the first value (debounced) → a new triple is added and the
    // model rebuilds. The row's React key must stay stable so the input is
    // patched, not remounted (a remount would drop focus/hover/caret).
    fireEvent.change(input, { target: { value: "My dataset" } });
    await waitFor(() => expect(latest).toBeGreaterThan(baseline));

    expect(document.contains(input)).toBe(true);
    expect(document.activeElement).toBe(input);
  });

  it("hides inline field errors until a field is touched (pristine form stays quiet)", async () => {
    const data = `@prefix dcterms: <http://purl.org/dc/terms/> .
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      <http://example.org/d1> a dcat:Dataset ; dcterms:title "Preloaded" .`;
    function Live() {
      const form = useMetadataForm({ shapes, data, focusNode: "http://example.org/d1", validateOn: "change" });
      return (
        <Theme>
          <MetadataForm form={form} />
          <ValidationSummary form={form} />
        </Theme>
      );
    }
    render(<Live />);
    await waitFor(() => {
      const input = document.querySelector<HTMLInputElement>("input");
      expect(input?.value).toBe("Preloaded");
    });

    // Other required fields are empty (invalid) → the summary counts them...
    await waitFor(() => expect(screen.getByText(/issue/)).toBeInTheDocument());
    // ...but none shows its inline error, because the user hasn't touched them.
    expect(screen.queryByText(/This field is required/)).toBeNull();

    // Clearing Title touches it and leaves it invalid → its error now appears.
    const input = document.querySelector<HTMLInputElement>("input")!;
    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => expect(screen.getByText(/This field is required/)).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it("empty repeatable fields show only '+ Add' (no default row) until pressed", async () => {
    let formRef: ReturnType<typeof useMetadataForm> | undefined;
    function F() {
      const form = useMetadataForm({ shapes, validateOn: "off" });
      formRef = form;
      return (
        <Theme>
          <MetadataForm form={form} />
        </Theme>
      );
    }
    render(<F />);
    await waitFor(() => expect(screen.getByText("Title")).toBeInTheDocument());

    // A repeatable, empty, text-like field (renders a textbox once a row exists).
    // Editors that render a role="textbox". Keyed by the SHACL-UI IRI, same as
    // the widget registry — there is no separate widget taxonomy to ask.
    const TEXTBOX = new Set<string>([
      Editors.TextField, Editors.IRI, Editors.TextArea, Editors.RichText,
      Editors.TextFieldWithLang, Editors.TextAreaWithLang,
      Editors.AutoComplete, Editors.InstancesSelect, Editors.SubClass,
    ]);
    const field = formRef!
      .model!.groups.flatMap((g) => g.fields)
      .find(
        (f) =>
          f.repeatable &&
          !f.nodeShape &&
          !f.readOnly &&
          f.values.length === 0 &&
          TEXTBOX.has(f.editorId),
      );
    expect(field).toBeTruthy();

    const shell = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(field!.id)}"]`)!;
    // No value row by default — just the Add button.
    expect(within(shell).queryByRole("textbox")).toBeNull();
    const addBtn = within(shell).getByRole("button", { name: /Add/ });

    // Pressing "+ Add" creates the first row.
    fireEvent.click(addBtn);
    await waitFor(() => expect(within(shell).queryByRole("textbox")).not.toBeNull());
  });

  it("preloads an existing data graph", async () => {
    const data = `@prefix dcterms: <http://purl.org/dc/terms/> .
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      <http://example.org/d1> a dcat:Dataset ; dcterms:title "Preloaded" .`;
    render(<Form shapes={shapes} data={data} focusNode="http://example.org/d1" />);
    await waitFor(() => {
      const input = document.querySelector<HTMLInputElement>("input");
      expect(input?.value).toBe("Preloaded");
    });
  });

  it("reports an empty form as invalid (required fields) and types the focus node", async () => {
    const { result } = renderHook(() => useMetadataForm({ shapes, validateOn: "manual" }));
    await waitFor(() => expect(result.current.ready).toBe(true));

    let errors: Awaited<ReturnType<typeof result.current.validate>> = [];
    await act(async () => {
      errors = await result.current.validate();
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(result.current.isValid).toBe(false);

    // The focus node is seeded with its target class, so the output declares it.
    const ttl = await result.current.toTurtle();
    expect(ttl).toContain("Dataset");
  });

  it("ValidationSummary shows the live issue count for an empty form", async () => {
    function Summary() {
      const form = useMetadataForm({ shapes, validateOn: "change" });
      return (
        <Theme>
          <ValidationSummary form={form} />
        </Theme>
      );
    }
    render(<Summary />);
    await waitFor(() => expect(screen.getByText(/issue/)).toBeInTheDocument());
  });

  it("exposes live output reactively (no onChange)", async () => {
    const data = `@prefix dcterms: <http://purl.org/dc/terms/> .
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      <http://example.org/d1> a dcat:Dataset ; dcterms:title "Controller" .`;
    const { result } = renderHook(() =>
      useMetadataForm({ shapes, data, focusNode: "http://example.org/d1", validateOn: "off" }),
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    const ttl = await result.current.toTurtle();
    expect(ttl).toContain("Controller");
    expect(result.current.quads.length).toBeGreaterThan(0);
  });
});
