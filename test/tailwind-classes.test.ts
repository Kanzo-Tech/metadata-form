import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Neither the library nor the playground may use a utility class that
 * `@kanzo-tech/ui/styles.css` does not actually ship.
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
 *
 * `playground/src` is scanned too. It is an app, not the library, so it may use
 * classes freely — but it compiles no Tailwind of its own either: it loads the
 * same one compiled sheet, so an invented class is exactly as inert there. Eight
 * of them were, and three were visible (`h-[3px]` painted a 0px brand line,
 * `h-11` left the header without a height, `size-3.5` let the pane icons render
 * at lucide's 24px default).
 */
const ROOTS = [resolve(__dirname, "../src"), resolve(__dirname, "../playground/src")];
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

describe("utility classes", () => {
  it("only uses classes present in @kanzo-tech/ui's compiled stylesheet", () => {
    const sheet = readFileSync(SHEET, "utf8");
    const has = (c: string) =>
      new RegExp(`\\.${c.replace(/[.[\]/%:]/g, "\\$&")}(?![\\w-])`).test(sheet);

    const repo = resolve(__dirname, "..");
    const missing = new Map<string, string[]>();
    for (const root of ROOTS) {
      for (const file of tsxFiles(root)) {
        for (const c of new Set(classesIn(readFileSync(file, "utf8")))) {
          if (has(c)) continue;
          const rel = file.slice(repo.length + 1);
          missing.set(c, [...(missing.get(c) ?? []), rel]);
        }
      }
    }
    expect(
      Object.fromEntries(missing),
      "these classes are not in the design system's sheet — use an inline style",
    ).toEqual({});
  });
});
