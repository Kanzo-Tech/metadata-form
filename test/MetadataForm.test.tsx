import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor, renderHook, act, within } from "@testing-library/react";
import { MetadataForm } from "@/react/form/MetadataForm.js";
import { ValidationSummary } from "@/react/validation/ValidationSummary.js";
import { assistUi } from "@/ai/index.js";
import { useMetadataForm, type UseMetadataFormOptions } from "@/react/hooks/useMetadataForm.js";
import { Editors } from "@/form/vocab/shacl-ui.js";
import { namedNode } from "@/form/factory.js";
import { healthDcatApShapes } from "@examples/health-dcat-ap/index.js";

const shapes = healthDcatApShapes;

/** Test helper: the unified usage (hook + component). */
function Form(props: UseMetadataFormOptions & { onReady?: (q: number) => void }) {
  const form = useMetadataForm({ validateOn: "off", ...props });
  props.onReady?.(form.quads.length);
  return (
    <MetadataForm form={form} />
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
        <MetadataForm form={form} layout="tabs" />
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
        <MetadataForm form={form} layout="tabs" />
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
        <MetadataForm form={form} assistUi={assistUi} />
      );
    }
    render(<AssistForm />);
    await waitFor(() => expect(screen.getByText("Title")).toBeInTheDocument());

    // The ✨ asks the seam and the candidates stream into a strip under the field.
    // The strip is shown while the field has focus, and jsdom's click does not
    // move focus the way a real press does — so focus it as a browser would.
    // Title is the first suggestible field.
    const sparkles = screen.getAllByRole("button", { name: "Suggest" });
    sparkles[0].focus();
    fireEvent.focus(sparkles[0]);
    fireEvent.click(sparkles[0]);

    const pick = await screen.findByText("Suggested Title");
    fireEvent.click(pick);

    await waitFor(() => {
      const input = document.querySelector<HTMLInputElement>("input");
      expect(input?.value).toBe("Suggested Title");
    });
  });

  it("takes a budget from the stream, and dismissing one does not refill it", async () => {
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
        <MetadataForm form={form} assistUi={assistUi} />
      );
    }
    render(<AssistForm />);
    await waitFor(() => expect(screen.getByText("Title")).toBeInTheDocument());

    // See above: the strip lives for as long as the field has focus.
    const mark = screen.getAllByRole("button", { name: "Suggest" })[0];
    mark.focus();
    fireEvent.focus(mark);
    fireEvent.click(mark);

    // A strip wraps, so the count is a budget rather than a window: all five
    // arrive, and dismissing one leaves four. The old three-row window existed to
    // keep a popover full, and there is no popover now.
    await screen.findByText("Echo");
    expect(screen.getAllByRole("button", { name: /^Dismiss / })).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss Alpha" }));
    await waitFor(() => expect(screen.queryByText("Alpha")).toBeNull());
    expect(screen.getAllByRole("button", { name: /^Dismiss / })).toHaveLength(4);
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
        <MetadataForm form={form} assistUi={assistUi} />
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

  it("renders the custom date picker (calendar button) for xsd:date fields", async () => {
    render(<Form shapes={shapes} />);
    await waitFor(() => expect(screen.getByText("Release date")).toBeInTheDocument());
    expect(document.querySelector('[aria-label="Open calendar"]')).toBeInTheDocument();
  });

  it("renders a repeatable string field as ONE tags input, and commits the whole list", async () => {
    // `dcat:keyword` has no `sh:maxCount`, so it is the cardinality case the multi
    // widgets exist for: one control holding every value, not N rows each with its
    // own add/remove. The registry entry is the same `shui:TextFieldEditor`.
    let form!: ReturnType<typeof useMetadataForm>;
    function TagForm() {
      form = useMetadataForm({ shapes, validateOn: "off" });
      return <MetadataForm form={form} />;
    }
    render(<TagForm />);
    await waitFor(() => expect(screen.getByText("Keywords")).toBeInTheDocument());

    const field = document.querySelector('[data-field$="|http://www.w3.org/ns/dcat#keyword"]');
    expect(field).not.toBeNull();
    expect(field!.querySelector('[data-slot="tags-input"]')).not.toBeNull();

    const input = field!.querySelector<HTMLInputElement>('[data-slot="tags-input-input"]')!;
    // The machine only accepts Enter once it has processed the focus it queued in a
    // microtask, and it tracks the draft through React's `onInput` — `change` never
    // reaches it.
    input.focus();
    fireEvent.focus(input);
    for (const tag of ["health", "registry"]) {
      await act(() => Promise.resolve());
      fireEvent.input(input, { target: { value: tag } });
      await act(() => Promise.resolve());
      fireEvent.keyDown(input, { key: "Enter" });
    }

    await waitFor(() => {
      const kws = form.quads
        .filter((q) => q.predicate.value === "http://www.w3.org/ns/dcat#keyword")
        .map((q) => q.object.value)
        .sort();
      expect(kws).toEqual(["health", "registry"]);
    });
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
        <>
          <MetadataForm form={form} />
          <ValidationSummary form={form} />
        </>
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
        <MetadataForm form={form} />
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
        <ValidationSummary form={form} />
      );
    }
    render(<Summary />);
    await waitFor(() => expect(screen.getByText(/issue/)).toBeInTheDocument());
  });

  // Complex paths, end to end through the widgets — the model-level rules are
  // pinned in test/write-paths.test.ts; these are the two things a person sees.
  const pathShapes = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://example.org/> .
    ex:S a sh:NodeShape ; sh:targetClass ex:Thing ;
      sh:property [ sh:path [ sh:inversePath ex:parent ] ; sh:name "Parent of" ; sh:maxCount 1 ] ;
      sh:property [ sh:path ( ex:a ex:b ) ; sh:name "Behind a resource" ; sh:maxCount 1 ] .
  `;

  it("commits through an inverse path: typing writes (value, predicate, focus)", async () => {
    const { result } = renderHook(() =>
      useMetadataForm({
        shapes: pathShapes,
        focusNode: "http://example.org/d1",
        rootShape: "http://example.org/S",
        validateOn: "off",
      }),
    );
    await waitFor(() => expect(result.current.ready).toBe(true));

    const field = result.current.model!.groups[0].fields.find((f) => f.label === "Parent of")!;
    expect(field.readOnly).toBeFalsy();

    act(() => {
      result.current.graph!.setValue(
        result.current.focusNode!,
        field.write!,
        null,
        namedNode("http://example.org/child"),
      );
    });

    await waitFor(() =>
      expect(
        result.current.model!.groups[0].fields
          .find((f) => f.label === "Parent of")!
          .values.map((v) => v.value?.value),
      ).toEqual(["http://example.org/child"]),
    );
    // The statement is on the child, so the whole graph carries it even though the
    // focus's own subgraph does not.
    expect(result.current.graph!.allQuads().some((q) => q.subject.value.endsWith("child"))).toBe(true);
  });

  it("shows WHY a still-read-only field is disabled, instead of a dead input", async () => {
    render(
      <Form
        shapes={pathShapes}
        focusNode="http://example.org/d1"
        rootShape="http://example.org/S"
      />,
    );
    await waitFor(() => expect(screen.getByText("Behind a resource")).toBeInTheDocument());
    const reason = document.querySelector('[data-readonly-reason="intermediate-missing"]');
    expect(reason).not.toBeNull();
    expect(reason!.textContent).toMatch(/does not exist yet/);
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
