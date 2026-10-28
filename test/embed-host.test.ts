import { describe, it, expect, vi, afterEach } from "vitest";
import { createMetadataFormFrame, type EmbedConfig } from "@kanzo-tech/metadata-form/embed";

// The app's side of the form in an iframe. The frame is a real (empty) iframe;
// what it would say is dispatched on the app's window as it would arrive.

const config: EmbedConfig = { variants: [{ id: "one", label: "One", shapes: "" }], locale: ["en"] };
const origin = window.location.origin;

function setup(options: Partial<Parameters<typeof createMetadataFormFrame>[1]> = {}) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("src", "/frame/index.html");
  document.body.append(iframe);
  const sent = vi.spyOn(iframe.contentWindow!, "postMessage");
  const frame = createMetadataFormFrame(iframe, { config, ...options });
  const fromFrame = (data: unknown, from: { origin?: string; source?: Window | null } = {}) =>
    window.dispatchEvent(
      new MessageEvent("message", {
        data,
        origin: from.origin ?? origin,
        source: from.source === undefined ? iframe.contentWindow : from.source,
      }),
    );
  const types = () => sent.mock.calls.map(([m]) => (m as { type: string }).type);
  return { iframe, frame, sent, fromFrame, types };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createMetadataFormFrame", () => {
  it("sends the configuration at once, and again when the frame says it is waiting", () => {
    const { sent, fromFrame, types } = setup();
    expect(sent).toHaveBeenCalledWith({ type: "mf:init", config }, origin);
    expect(types()).toEqual(["mf:init", "mf:sync"]);

    fromFrame({ type: "mf:waiting" });
    expect(types()).toEqual(["mf:init", "mf:sync", "mf:init"]);
  });

  it("hands the form's state to onChange and sizes the iframe to its content", () => {
    const onChange = vi.fn();
    const onReady = vi.fn();
    const { iframe, fromFrame } = setup({ onChange, onReady });

    fromFrame({ type: "mf:ready" });
    fromFrame({ type: "mf:change", valid: false, errors: 2, warnings: 3, jsonLd: { "@id": "_:b1" } });
    fromFrame({ type: "mf:resize", height: 412.4 });

    expect(onReady).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith({ valid: false, errors: 2, warnings: 3, jsonLd: { "@id": "_:b1" } });
    expect(iframe.style.height).toBe("413px");
  });

  it("reads nothing from another window or another origin", () => {
    const onChange = vi.fn();
    const { fromFrame, types } = setup({ onChange });
    const change = { type: "mf:change", valid: true, errors: 0, warnings: 0, jsonLd: {} };

    fromFrame(change, { origin: "https://elsewhere.example" });
    fromFrame(change, { source: window });
    fromFrame({ type: "mf:waiting" }, { origin: "https://elsewhere.example" });

    expect(onChange).not.toHaveBeenCalled();
    expect(types()).toEqual(["mf:init", "mf:sync"]);
  });

  it("sends reveal-errors, reset and a new configuration, and stops listening once destroyed", () => {
    const onChange = vi.fn();
    const { frame, fromFrame, types, sent } = setup({ onChange });
    const spanish: EmbedConfig = { ...config, locale: ["es"] };

    frame.revealErrors();
    frame.reset();
    frame.configure(spanish);
    expect(types()).toEqual(["mf:init", "mf:sync", "mf:reveal-errors", "mf:reset", "mf:init"]);
    expect(sent).toHaveBeenLastCalledWith({ type: "mf:init", config: spanish }, origin);

    frame.destroy();
    fromFrame({ type: "mf:change", valid: true, errors: 0, warnings: 0, jsonLd: {} });
    expect(onChange).not.toHaveBeenCalled();
  });
});
