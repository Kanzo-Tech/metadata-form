import { describe, it, expect } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { EmbedConfig, EmbedToHost, HostToEmbed } from "@kanzo-tech/metadata-form/embed";
import { paperConditionalRootShape, paperConditionalShapes } from "@examples/paper-conditional/index.js";
import { paperMappingRootShape, paperMappingShapes } from "@examples/paper-mapping/index.js";
import { FramePage, type Channel } from "../frame/FramePage";

// The page shown in the iframe, with a channel standing in for the parent window.

function fakeChannel() {
  const sent: EmbedToHost[] = [];
  const handlers = new Set<(m: HostToEmbed) => void>();
  const channel: Channel = {
    post: (m) => void sent.push(m),
    listen(handler) {
      handlers.add(handler);
      return () => void handlers.delete(handler);
    },
  };
  // Async act: the page loads the shapes in a promise right after a message.
  const send = (m: HostToEmbed) =>
    act(async () => {
      handlers.forEach((h) => h(m));
    });
  const count = (type: EmbedToHost["type"]) => sent.filter((m) => m.type === type).length;
  return { channel, sent, send, count };
}

const conditional = { id: "conditional", label: "A conditional field", shapes: paperConditionalShapes, rootShape: paperConditionalRootShape };
const mapping = { id: "mapping", label: "From shapes to fields", shapes: paperMappingShapes, rootShape: paperMappingRootShape };
const one: EmbedConfig = { variants: [conditional], locale: ["en"], texts: { variantLabel: "Example" } };
const two: EmbedConfig = { ...one, variants: [conditional, mapping] };

describe("the frame page", () => {
  it("says what it is for when it is not in an iframe", () => {
    render(<FramePage />);
    expect(screen.getByText(/inside an iframe/)).toBeInTheDocument();
  });

  it("asks for its configuration and shows no form until it comes", () => {
    const { channel, sent } = fakeChannel();
    render(<FramePage channel={channel} />);
    expect(sent).toEqual([{ type: "mf:waiting" }]);
    expect(screen.getByText(/Waiting for the form's configuration/)).toBeInTheDocument();
    expect(screen.queryByText("Title")).not.toBeInTheDocument();
  });

  it("shows a selector only when there is more than one variant", async () => {
    const first = fakeChannel();
    const { unmount } = render(<FramePage channel={first.channel} />);
    await first.send({ type: "mf:init", config: one });
    expect(await screen.findByText("Title")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Example" })).not.toBeInTheDocument();
    unmount();

    const second = fakeChannel();
    render(<FramePage channel={second.channel} />);
    await second.send({ type: "mf:init", config: two });
    const selector = await screen.findByRole("combobox", { name: "Example" });
    expect([...(selector as HTMLSelectElement).options].map((o) => o.textContent)).toEqual([
      "A conditional field",
      "From shapes to fields",
    ]);
  });

  it("says it is ready and reports the form's state", async () => {
    const { channel, sent, send, count } = fakeChannel();
    render(<FramePage channel={channel} />);
    await send({ type: "mf:init", config: one });

    await waitFor(() => expect(count("mf:ready")).toBe(1));
    await waitFor(() => expect(count("mf:change")).toBeGreaterThan(0));
    const change = sent.filter((m) => m.type === "mf:change").pop();
    // The paper's example, empty: the title is missing.
    expect(change).toMatchObject({ type: "mf:change", valid: false, errors: 1, warnings: 0 });
  });

  it("does not start again for the same configuration, and starts again, empty, on mf:reset", async () => {
    const { channel, send, count } = fakeChannel();
    render(<FramePage channel={channel} />);
    await send({ type: "mf:init", config: one });
    await waitFor(() => expect(count("mf:ready")).toBe(1));

    await send({ type: "mf:init", config: structuredClone(one) });
    await new Promise((r) => setTimeout(r, 100));
    expect(count("mf:ready")).toBe(1);

    await send({ type: "mf:reset" });
    await waitFor(() => expect(count("mf:ready")).toBe(2));
  });

  it("shows a language selector only when the app asks for it", async () => {
    const off = fakeChannel();
    const { unmount } = render(<FramePage channel={off.channel} />);
    await off.send({ type: "mf:init", config: one });
    expect(await screen.findByText("Title")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Language" })).not.toBeInTheDocument();
    unmount();

    const on = fakeChannel();
    render(<FramePage channel={on.channel} />);
    await on.send({ type: "mf:init", config: { ...one, languageSelector: true } });
    const selector = await screen.findByRole("combobox", { name: "Language" });
    expect([...(selector as HTMLSelectElement).options].map((o) => o.value).sort()).toEqual(["en", "es"]);
  });

  it("re-words the form when the reader picks another language, without starting it again", async () => {
    const { channel, send, count } = fakeChannel();
    render(<FramePage channel={channel} />);
    await send({ type: "mf:init", config: { ...one, languageSelector: true } });
    await waitFor(() => expect(count("mf:ready")).toBe(1));

    fireEvent.change(await screen.findByRole("combobox", { name: "Language" }), { target: { value: "es" } });
    expect(await screen.findByText("Título")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Idioma" })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 100));
    expect(count("mf:ready")).toBe(1);
  });

  it("arranges the form as the app says (one after another by default), without starting it again", async () => {
    const { channel, send, count } = fakeChannel();
    render(<FramePage channel={channel} />);
    const sections: EmbedConfig = { variants: [mapping], locale: ["en"] };
    await send({ type: "mf:init", config: sections });
    await waitFor(() => expect(count("mf:ready")).toBe(1));
    expect(await screen.findByText("Values")).toBeInTheDocument();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();

    // The paper's mapping example has four groups: one tab each.
    await send({ type: "mf:init", config: { ...sections, layout: "tabs" } });
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(4));
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();

    // Steps: one per group too, with Back and Next.
    await send({ type: "mf:init", config: { ...sections, layout: "steps", grid: { columns: 2 } } });
    expect(await screen.findByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(document.querySelector('[data-slot="field-group"]')).toHaveClass("grid-cols-2");
    await new Promise((r) => setTimeout(r, 100));
    expect(count("mf:ready")).toBe(1);
  });

  it("shows no Shape or Data buttons unless the app asks for them", async () => {
    const { channel, send, count } = fakeChannel();
    render(<FramePage channel={channel} />);
    await send({ type: "mf:init", config: one });
    await waitFor(() => expect(count("mf:ready")).toBe(1));
    expect(screen.queryByRole("button", { name: "Shape" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Data" })).not.toBeInTheDocument();
  });

  it("by default opens the shapes and the record in a dialog, the form darkened behind it and keeping what was typed", async () => {
    const { channel, send, count } = fakeChannel();
    render(<FramePage channel={channel} />);
    await send({ type: "mf:init", config: { variants: [mapping], locale: ["en"], showShapes: true, showOutput: true } });
    await waitFor(() => expect(count("mf:ready")).toBe(1));

    // A value, picked in the form: a discrete control commits at once.
    fireEvent.click(await screen.findByText("draft"));

    // The shapes: the variant's own text, read only, in a dialog named after the
    // button, with the form darkened behind it.
    fireEvent.click(screen.getByRole("button", { name: "Shape" }));
    const shapes = await screen.findByRole("dialog", { name: "Shape" });
    await waitFor(() => expect(shapes.textContent).toContain("Status (sh:in)"));
    expect(document.querySelector('[data-slot="dialog-overlay"]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to the form" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // The record, as Turtle, with the value picked.
    fireEvent.click(screen.getByRole("button", { name: "Data" }));
    const record = await screen.findByRole("dialog", { name: "Data" });
    await waitFor(() => expect(record.querySelector(".cm-content")?.textContent).toContain('"draft"'));

    // Closed: no dialog, and the value is still there.
    fireEvent.click(screen.getByRole("button", { name: "Back to the form" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("draft").closest('[data-slot="segment-group-item"]')).toHaveAttribute("data-state", "checked");
    expect(count("mf:ready")).toBe(1);
  });

  it('with panels "dialog", the dialog floats over the form, which can still be used', async () => {
    const { channel, send, count } = fakeChannel();
    render(<FramePage channel={channel} />);
    await send({
      type: "mf:init",
      config: { variants: [mapping], locale: ["en"], showShapes: true, showOutput: true, panels: "dialog" },
    });
    await waitFor(() => expect(count("mf:ready")).toBe(1));

    fireEvent.click(screen.getByRole("button", { name: "Shape" }));
    await screen.findByRole("dialog", { name: "Shape" });
    expect(screen.getByRole("button", { name: "Shape" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Values")).toBeVisible();
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();

    // The other button is still there, behind no dark: it switches the dialog.
    fireEvent.click(screen.getByRole("button", { name: "Data" }));
    await screen.findByRole("dialog", { name: "Data" });
    fireEvent.click(screen.getByRole("button", { name: "Back to the form" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it('with panels "inline", shows the shapes and the record in the form\'s place, and the form keeps what was typed', async () => {
    const { channel, send, count } = fakeChannel();
    render(<FramePage channel={channel} />);
    await send({
      type: "mf:init",
      config: { variants: [mapping], locale: ["en"], showShapes: true, showOutput: true, panels: "inline" },
    });
    await waitFor(() => expect(count("mf:ready")).toBe(1));

    fireEvent.click(await screen.findByText("draft"));

    // The shapes, in the form's place: no dialog.
    fireEvent.click(screen.getByRole("button", { name: "Shape" }));
    await waitFor(() => expect(document.body.textContent).toContain("Status (sh:in)"));
    expect(screen.getByRole("button", { name: "Shape" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Values")).not.toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // The record, as Turtle, with the value picked.
    fireEvent.click(screen.getByRole("button", { name: "Data" }));
    await waitFor(() => expect(document.querySelector(".cm-content")?.textContent).toContain('"draft"'));

    // Back to the form: the value is still there.
    fireEvent.click(screen.getByRole("button", { name: "Back to the form" }));
    expect(screen.getByText("Values")).toBeVisible();
    expect(screen.getByText("draft").closest('[data-slot="segment-group-item"]')).toHaveAttribute("data-state", "checked");
    expect(count("mf:ready")).toBe(1);
  });

  it("reports the record as Turtle too, and which variant it was written for", async () => {
    const { channel, sent, send, count } = fakeChannel();
    render(<FramePage channel={channel} />);
    await send({ type: "mf:init", config: two });
    await waitFor(() => expect(count("mf:change")).toBeGreaterThan(0));
    const change = sent.filter((m) => m.type === "mf:change").pop();
    expect(change).toMatchObject({ variant: "conditional" });
    expect((change as { turtle: string }).turtle).toContain("http://www.w3.org/ns/dcat#Dataset");
  });

  it("re-words the form when the app sends another language, without starting it again", async () => {
    const { channel, send, count } = fakeChannel();
    render(<FramePage channel={channel} />);
    await send({ type: "mf:init", config: one });
    await waitFor(() => expect(count("mf:ready")).toBe(1));

    await send({ type: "mf:init", config: { ...one, locale: ["es"] } });
    expect(await screen.findByText("Título")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 100));
    expect(count("mf:ready")).toBe(1);
  });
});
