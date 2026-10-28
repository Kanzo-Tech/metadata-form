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
