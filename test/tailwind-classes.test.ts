import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * The library may only use utility classes that `@kanzo-tech/ui/styles.css`
 * actually ships.
 *
 * That sheet is compiled, and it contains exactly the utilities the design
 * system's OWN components use — nothing generates ours. A class we invent is not
 * an error anywhere: it is a silent no-op in every consumer's app, and the only
 * way it surfaces is somebody noticing a panel is the wrong width. Three of these
 * shipped before this test existed (`max-w-70`, `max-h-80`, `bottom-6`).
 *
 * The rule the library follows, in `src/react/styles.ts`: **a component library
 * needs nothing but the component library.** Compose its components, and where it
 * deliberately ships no primitive, write the value as an inline `style`. A
 * `className` survives here only where a component takes no `style` prop — and
 * then it must be a class this sheet ships, which is what this test checks.
 */
const SRC = resolve(__dirname, "../src");
const SHEET = resolve(__dirname, "../node_modules/@kanzo-tech/ui/dist/styles.css");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) return tsxFiles(p);
    return p.endsWith(".tsx") ? [p] : [];
  });
}

/** Classes written as a literal `className` — the ones we control. */
function classesIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
    for (const group of [m[1], m[2], m[3]]) {
      if (!group) continue;
      for (const token of group.split(/\s+/)) {
        // Skip template holes and ternary fragments — they are not class tokens.
        if (!token || /[${}?:]/.test(token)) continue;
        if (/^[a-z0-9:[\]./%_-]+$/.test(token)) out.push(token);
      }
    }
  }
  return out;
}

describe("library utility classes", () => {
  it("only uses classes present in @kanzo-tech/ui's compiled stylesheet", () => {
    const sheet = readFileSync(SHEET, "utf8");
    const has = (c: string) =>
      new RegExp(`\\.${c.replace(/[.[\]/%:]/g, "\\$&")}(?![\\w-])`).test(sheet);

    const missing = new Map<string, string[]>();
    for (const file of tsxFiles(SRC)) {
      for (const c of new Set(classesIn(readFileSync(file, "utf8")))) {
        if (has(c)) continue;
        const rel = file.slice(SRC.length + 1);
        missing.set(c, [...(missing.get(c) ?? []), rel]);
      }
    }
    expect(
      Object.fromEntries(missing),
      "these classes are not in the design system's sheet — use an inline style",
    ).toEqual({});
  });
});
