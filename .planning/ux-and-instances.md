# Playground UX, and metadata-form as a deployable instance

Folded in from a review on 2026-08-26, after migrating to `@kanzo-tech/ui` and
comparing our playground with the design system's own metadata-form showcase.

Two of these are kanzo-ui's, the rest are ours. Ordered within each section by
value, not by the order they were raised.

---

## kanzo-ui

### K1 — Pills as a reusable component — **ALREADY DONE**
`Suggestions` / `Suggestion` are in `@kanzo-tech/ui/simples/suggestions.tsx`, and
deliberately *not* in `@kanzo-tech/ai`: the line that package draws is *does the
component know a model exists*, and a strip of buttons that each commit a string
does not. Its own docblock names the general cases — "recent searches, saved
filters, a questionnaire's quick answers and a model's candidates are one
component". That is the ai-sdk `suggestion` concept, already generalised.

**Nothing to build.** What we can do is *use* it beyond the ✨: our large-`sh:in`
combobox and the reference field could offer recent/likely values as a strip.

### K2 — `MadeWith` — it exists no more, and the reason is on the record
`packages/ui/src/composites/MadeWith.tsx` and `MadeWithKanzo.tsx` were deleted in
`396bfd7`, whose message states the charge:

> `MadeWith` hard-coded the English "Made with" and defaulted `by` to "Kanzo", a
> brand name in a library whose first admission rule is domain-freedom.

So bringing it back is **reopening a decision, not fixing an oversight** — and
kanzo-ui's own rule is that reopening means editing the paragraph that recorded
it, not re-arguing. Two honest ways:

1. **Re-admit it, domain-free.** No default brand, no built-in English: `<MadeWith>`
   takes children and a `href`. Then it is a styled attribution line, which is a
   real, generic thing. The deletion's charge was the hard-coding, not the idea.
2. **Keep it out, and let the consumer write it.** Three elements and a `Link`;
   the playground already does exactly this.

Option 1 is the one worth having *if* the line "a small attribution, styled
consistently" is a thing more than one product needs. That is the question to
answer, and it belongs in kanzo-ui's `/docs/design`, not here.

---

## metadata-form

### M1 — Sharing is broken, and permalinks should carry the whole instance ⭐
**The largest item, and the one the others lean on.** Reported: "el sistema de
compartir no funciona en absoluto". Verify first, then rethink rather than patch.

The ambition, in the author's words: the same mechanism should serve *demos and
examples* **and** *standing up an instance for a client*. Evidenze has its own
colours and shapes; we make them a kanzo-ui theme and stand up a metadata-form
instance that carries **their** shapes.

That makes the URL/config one concept with two grades:
- **A permalink** — shapes + data + view state, compressed into the fragment.
  Shareable, ephemeral, what the playground does today.
- **An instance** — a named theme + a shape set + branding, resolved at boot.
  Not a fragment; a config the deployment carries.

Design them together or the second grows as a pile of special cases inside the
first. Consequence for M4: if the URL carries which shape and which data preset,
the pickers stop being page state and become a view of the address.

### M2 — Source and Output belong in a side rail, not in the top bar
The showcase's `PanelRail`: a `ShellAside` with a vertical `ToggleGroup` of icons
on the edge the panels open on. Its docblock carries the trap — a `ToggleGroup` is
a CONTROL, so its recipe brings `w-fit` and `rounded-lg`, and used as a region it
curls its corner away from the header border and reads as a second border. Give
the region to `ShellAside` and put the group inside it.

### M3 — The issues panel: theirs is better, and `Diagnostic` is why
They render findings with `Diagnostic` — severity badge, source, collapsible body.
That is the component whose own comment names a SHACL violation as its case. It is
right for a *panel* and wrong for our hover pill (a collapsible inside a hover card
is a control nobody can open), so this is a **new** surface beside
`ValidationSummary`, not a replacement.

Reported: in `blocks` it overflows. **Review kanzo-ui's blocks generally** — the
author says it will help, and an overflow there is likely a bug worth reporting
upstream rather than working around.

### M4 — Tabs that carry their own selector
Their Source pane reads `SHACL shape` as a tab with the shape selector beside it,
`Data graph` likewise. We put both selectors in one pane header. Theirs is better:
each selector sits with the tab whose document it replaces.
**Blocked on M1** — see the note there.

### M5 — Better inputs, and this is the reference mapping
"El inline es muy fino"; the native multi-select is worse than what the system
ships. This is the SHACL-1.2-editor → widget table, and the author wants it to
stand as *the reference*. Concretely: `TagsInput` for keywords, `Combobox` with
`multiple` for multi-valued enumerations, `RadioGroupCard` for small closed sets,
`Slider` where a range is bounded. The registry is already keyed by editor IRI, so
each of these is one entry.

### M6 — Validation messages must be legible
Reported verbatim:
> `Shape _:db9dc3bc6e05eb3301a1c103c00c6311: Node(NodeShape Targets: - targetClass(...) Property Shapes: [22, 13, 23]) constraint not satisfied for _:mf1`

That is an engine dump reaching a person. Two halves, and both are ours:
- **the message** — `friendly()` already prefers the author's `sh:message` and
  then a catalog keyed by constraint component; this one fell through to
  "whatever the engine said". Find which component it is and give it wording, or
  make the fallback say something true and short instead of echoing the AST.
- **the presentation** — see M3; the showcase does this "MUY BIEN" per the author.

### M7 — The output pane deserves better than a text dump
- JSON-LD through the system's **`JsonTreeView`**, not a read-only editor.
- Tabs carrying their own selector, as in M4.
- **And the graph as a graph.** `@kanzo-tech/graph` exists — cosmos.gl over a
  Mosaic/DuckDB stack. "¿Para qué tenemos un motor de grafos?" is a fair question.
  Plus a download.

### M8 — The companion overlaps the preferences FAB, and theming needs rethinking
They collide bottom-right; one of them moves.

The larger half: preferences now come from a *theme*, which changes what the
playground should even offer. The author is thinking aloud — light + dark + custom?
Load a custom CSS? How does DaisyUI do it? — and concludes "aquí la muestra de
temas digamos que no está". Worth looking at what `PreferencesColor` needs to
render (it stays absent until a tenant publishes two themes) and whether the
playground should publish two so the section appears at all. Ties to M1's instance
half: a client instance *is* a published theme.

### M9 — Columns: three options, not a number
1, 2 or 3, shown like the layout switcher (`RadioGroupCard` with an icon each),
instead of an unbounded number input. Unlimited columns is not a thing anyone
wants and the control implies otherwise.

---

## Order

M1 first — it is the biggest, it is broken today, and M4 and half of M8 hang off
it. Then M6 (a user-facing defect), M2 + M3 + M7 as one pass over the workspace
chrome, then M5 and M9, which are contained. K2 needs a decision before code; K1
needs none.


---

## Execution plan (folded from five parallel investigations, 2026-08-26)

### 1. Conflicts and dependencies

**Files claimed by more than one lane.**

| File | Claimed by | Resolution |
|---|---|---|
| `playground/src/App.tsx` | M1 (permalink/locale/instance), M2 (rail), M3 (issues aside), M7 (output pane), M8a (assistant offset), M8b (`KanzoThemeProvider` props) | **Three sequential passes, never parallel.** Pass A = one-line prop fixes + dead classes (W2). Pass B = the top half: provider props, `branding` lifted above the provider, live `locale` into `share` (W3). Pass C = the bottom half: `ShellBody` restructure, rail, issues aside, output pane (W4). |
| `playground/src/Preferences.tsx` | M8b (`PreferencesColor` position), M9 (columns), M2/M8 (`basis-16` dead class) | **One pass, W2.** Do all three at once; the `PreferencesColor` reorder is inert until W3 supplies `themes`, but it is a safe move and avoids a second pass. |
| `playground/src/presets.ts` | M1 (delete `ExampleBranding.theme`, move branding to the instance), M8b (wire `branding.theme` as `defaultTheme`) | **Direct conflict — decision D1 below.** Resolve before W3. Recommended: `theme` stays on the example as a light/dark *pair*, and `instance.ts` becomes its reader; the field is not deleted, it changes owner. |
| `src/react/validation/useFormReport.ts` | M3 (add `constraint`), M6 (add `constraint` + `value`, fix the empty-label fallback) | **Merge into one edit in W1**, before the panel that reads it exists. M6's superset wins. |
| `test/tailwind-classes.test.ts` | M2 and M8 both propose "also scan `playground/src`" | **One edit, W2, landing *after* the eight class fixes in the same wave** — otherwise the wave is red between commits. |
| `KanzoThemeProvider` mount site | M1 (`themes`/`defaultTheme`/`policy` from the instance), M8b (`themes={themeIndex…}` + `defaultTheme`) | Same call site, same shape. Do M8b's version in W3 with `THEMES` hoisted to module scope; `instance.ts` supplies the values from the start so M1 needs no second edit here. |

**Hard dependencies.**
- W0 (the `options` setter) blocks *everything* that exercises example switching — it is the reported break and it is one line.
- The dead-class sweep + guard-test widening must precede all new playground chrome (W4), or the new chrome copies more dead classes from the same showcase source that produced `basis-16`.
- `useFormReport.ts` widening (W1) blocks `ValidationPanel` (W4): the panel's `DiagnosticSource` and second `DiagnosticFrame` have no data until the row carries `constraint`/`value`.
- `validateTree` (W1) blocks the *content* of the issues panel: without it the only row a nested `sh:node` produces is the rollup, so the panel would ship showing "something in here is wrong" and nothing else.
- `branding` must be lifted above `KanzoThemeProvider` (W3) before `themes`/`defaultTheme` can be example-driven — this is the real cost of M8b and it drags `useUrlState`/`useWorkspace` up with it.
- M4 is blocked on M1 as the plan states, and lands inside W4.
- The fork changes (`node.rs`) are gated on republishing `@kanzo-tech/rudof-wasm` (currently `^0.3.4`). Treat as an **independent track**, never a blocker.

**Fully disjoint from the playground and safe to run in parallel with W3/W4:** the whole of M5 (`src/react/widgets/*`, `src/react/fieldassist/*`, `src/engine/GraphState.ts`, `src/react/form/FieldRenderer.tsx`, `README.md`). Only watch `src/index.ts`, which W4 also touches to export `ValidationPanel`.

---

### 2. The ordered plan

#### Wave 0 — the hotfix (do today, alone)
| Files | Change | Closes | Effort |
|---|---|---|---|
| `playground/src/state/useWorkspace.ts` | `const [options, setOptions] = useState(seed.options)`; call `setOptions(state.options)` inside `applyPreset`. | M1 (the reported break) | S |

Root cause, reproduced: options freeze at mount, so every example keeps the *first*-loaded example's `rootShape`. Switching the Shape picker kills the form (`Could not resolve a root node shape`) and Share emits a permalink pairing one example's shapes with another's `rootShape`, overwriting the correct URL the pick had already written. One line fixes both.

#### Wave 1 — validation messages and the report row (library only)
| Files | Change | Closes | Effort |
|---|---|---|---|
| `src/form/validation.ts` | In `friendly()`, if `result.constraint` is in the `sh:` namespace, return the catalog wording or `_fallback` — never fall through to the engine's text. Step 3 stays for `constraint === undefined` or a non-`sh:` IRI (the ShEx seam). | M6 | S |
| `src/i18n/strings.ts` | Add the 21 missing SHACL components to `validationDefaults` in en/es/ca, `NodeConstraintComponent` first ("Some details in this section are incomplete"). | M6 | S |
| `src/react/validation/useFormReport.ts` | `labels.get(key) \|\| key.split("\|").filter(Boolean).pop() \|\| key` (today `"x\|".split("\|").pop()` is `""`, which `??` does not catch → a blank row that jumps nowhere). Add `constraint?` and `value?` to `IssueRow` and populate them. | M6 + M3 prerequisite | S |
| `src/engine/projectTree.ts`, `src/engine/RudofEngine.ts`, `src/react/hooks/useMetadataForm.ts` | Have `projectTree` return the `(focus, shapeId)` pairs it already walks (the `visited` set *is* the list). Add `RudofEngine.validateTree(nodes)` = `validateFocus` per pair, concatenated. Call it from `useMetadataForm.ts:193` and `:229`. | M6 (second half) | M |
| `src/react/validation/useFormReport.ts` | Suppress the `sh:node` rollup row when a result exists whose focus node equals its `value` term; keep it when nothing nested was reported. | M6 | S |
| `test/i18n-messages.test.ts` | Pin: a result with `constraint: sh:NodeConstraintComponent` and the AST-dump message resolves to catalog wording in en/es/ca and contains no `"NodeShape"` and no newline. | M6 | S |

The half the plan does not name: `node.rs` computes the inner results and keeps only a boolean, so *"Name is required"* never reaches the report at any severity — and whole-graph `validate()` does not recover it when the nested shape has no `sh:targetClass`, which the Evidenze shapes deliberately do. Without `validateTree`, the best wording `sh:node` can ever have is "something in here is wrong".

#### Wave 1b — upstream, independent track (not a blocker)
| Files | Change | Closes | Effort |
|---|---|---|---|
| `shacl/src/validator/constraints/core/shape_based/node.rs` | Print `node_shape.id()`, never `Display for IRShape`. Merge `shape.message()` as `constraints/mod.rs:117-121` does. | M6 (the cure) | M |
| the other ten overriding components (`not`, `xone`, `if_`, `or`, `qualified_value_shape`, `unique_lang`, `less_than`, `less_than_or_equals`, `disjoint`, `basic_sparql`) | Same `sh:message` merge. | M6 | M |

Verified: 11 of 30 components silently drop the author's `sh:message` — a shape writing `sh:message "El publicador está incompleto"@es` on a `sh:node` property shape gets it ignored. That is a spec bug on exactly the multilingual path the i18n work was built on.

#### Wave 2 — the cheap defects sweep (one App.tsx pass, all of Preferences.tsx)
| Files | Change | Closes | Effort |
|---|---|---|---|
| `playground/src/{App,Header,PaneHeader,CodePanel,ExamplePickers,Preferences}.tsx` | Replace the eight classes absent from `@kanzo-tech/ui/dist/styles.css` with inline styles: `h-[3px]`, `h-11`, `pt-6`, `flex-none`, `gap-1.5`, `gap-2.5`, `size-3.5`, `basis-16`(→`basis-20`, which ships). Three are visible defects now: the brand tint line is 0px tall, the header has no fixed height, the pane icons render at lucide's default 24px. | M2 hygiene | M |
| `test/tailwind-classes.test.ts` | Make `SRC` a list and also walk `playground/src`. Land last in the wave. | — | S |
| `playground/src/components/BrandLogo.tsx`, `src/react/assistant/mascot.tsx`, `src/react/utils/scrollToField.ts`, `playground/styles.css` | Replace the Radix Themes leftovers (`--accent-12`, `--accent-a3/a4/a6`, `--accent-9`) with Kanzo tokens. The Evidenze wordmark currently paints nothing — `document.images` is `[]` on the branded example. | M1/M8 | S |
| `src/react/assistant/FormAssistant.tsx` | Add `offset?: { bottom?: string; inline?: string }`, default `1.5rem`, spread into the existing inline style. Docblock: the library floats one thing in a corner and cannot know what else the host floats there. | M8a | S |
| `playground/src/App.tsx` | `<FormAssistant … offset={{ bottom: "4rem" }} />`. | M8a | S |
| `playground/src/Preferences.tsx` | Columns: replace the number input with three `RadioGroupCard`s (`RectangleHorizontal`/`Columns2`/`Columns3`), built exactly like `LAYOUTS`. Move `<PreferencesColor />` to the top of the panel body and correct the docblock's claim about section order. | M9 + M8b prep | S |

The FAB (`fixed end-4 bottom-4`, z-40, 2rem square) and the companion (`fixed bottom/right 1.5rem`, z-50) overlap by a 24×24px square with the companion on top — roughly half the FAB's hit area. The design system's FAB keeps its spot; ours moves.

#### Wave 3 — the instance layer, permalink v2, theming (App.tsx pass B)
| Files | Change | Closes | Effort |
|---|---|---|---|
| `playground/src/instance.ts` **(new)** | One module resolving the deployment's identity at boot: `{ id, themes, defaultTheme, policy, branding: {logo, favicon, docTitle}, shapeSets, defaultShapeSet, allowShapeEditing }`. Bundled default → `import.meta.env.VITE_MF_INSTANCE`. `presets.ts` becomes the *default instance's* `shapeSets`, not a global constant. | M1 (instance half) | L |
| `playground/src/lib/permalink.ts` | `{v:2, ex, preset?}` when the example is unedited (~40-char URL); `{v:2, ex, shapes?, data?, options, locale?}` when dirty. Accept v1. Make `decodeState` distinguish "no fragment" from "fragment present but undecodable". | M1 | M |
| `playground/src/hooks/useUrlState.ts` | Return a status from `share` (`Copied` / `Copy failed — the URL is in the address bar`); guard `navigator.clipboard === undefined` explicitly instead of letting the `TypeError` land in a comment-only catch. Surface the decode failure from `initial`. Read the instance config beside the fragment. | M1 | M |
| `playground/src/App.tsx` | Lift `branding` above `KanzoThemeProvider`; pass `themes={THEMES}` (module-scope, from `themeIndex`) + `defaultTheme` from the resolved instance/example. Include the live `uiLocale` in the object passed to `share`. Render the pickers only when the instance offers more than one shape set. | M1 + M8b | M |
| `playground/src/presets.ts` | `theme?: { light: string; dark: string }` (D1). Stable `id` per `ShapeExample` for the v2 permalink to reference. Replace the 25-line open-question docblock with the answer: `defaultTheme` is a non-persisting overlay that a stated preference outranks (`resolvePref`: pinned → stored → policy → declaration default). | M1 + M8b | M |
| `playground/src/components/ExamplePickers.tsx` | The selects become a view of the address: `value` from the decoded state, `onChange` navigates. Move each select next to the tab whose document it replaces. | M1 → M4 | M |

Current permalinks are 15–18 KB (`location.hash.length` measured: 15545 on the Evidenze example) — past what chat and mail carry, and a truncated fragment decodes to `null` and silently loads HealthDCAT-AP, which is indistinguishable from "sharing does nothing". The 29 published themes are already in the page (`@kanzo-tech/ui/styles.css` imports `@kanzo-tech/theme/themes.css`); `PreferencesColor` returns null purely because `themes` defaults to `[]` — and that section *is* the playground's only light/dark control, which is why there is none today.

#### Wave 4 — the workspace chrome (App.tsx pass C)
| Files | Change | Closes | Effort |
|---|---|---|---|
| `playground/src/components/PanelRail.tsx` **(new)** | `ShellAside` owns the region (`shrink-0 bg-card`), a vertical `ToggleGroup` inside it with `className="rounded-none"` and **inline** `paddingInline: "0.375rem"` (`px-1.5` is not in our sheet). Keyboard hint in `title`. | M2 | S |
| `playground/src/App.tsx` | Rail as the first child of `ShellBody`; wrap the workspace/overlay branch in `<div className="relative flex min-w-0 flex-1">` so the `absolute inset-0` overlay aside does not eat the rail on narrow. Delete the two header `<Toggle>`s. | M2 | S |
| `playground/src/components/Toggle.tsx` | Delete (no other call sites). | M2 | S |
| `playground/src/hooks/usePanels.ts` | Third panel `issues`, same mutual-exclusion rule. | M3 | S |
| `src/react/validation/ValidationPanel.tsx` **(new)**, `src/index.ts` | `DiagnosticList` over `form.report.issues.rows`. Per row: `DiagnosticSeverity` + `DiagnosticSource` (constraint **local name**, not the IRI) + `DiagnosticTrigger`; `DiagnosticTitle className="basis-full"`; content = description + `DiagnosticFrame path={…} onSelect={form.revealField}`. **One open-id at panel level**, not per-Diagnostic — opening a panel re-keys the splitter and remounts every column, which closes uncontrolled Collapsibles. | M3 | M |
| `playground/src/App.tsx` | Issues aside: `ShellAside side="end"` + `PaneHeader` with counts + scrolling body. | M3 | S |
| `playground/src/components/PaneHeader.tsx` | Add the `tone` prop (a `Status` dot before `detail`). | M3 | S |
| `playground/src/hooks/useFormOutputs.ts` | Return `{ turtle, jsonld, jsonldText }` — keep the object, don't only stringify. | M7 | S |
| `playground/src/App.tsx` | Output pane: `JsonTreeView data={outputs.jsonld}` replaces the read-only JSON editor; Turtle stays a read-only `CodeEditor`. Drop Output's tab strip for a `NativeSelect` in its `PaneHeader`; **Source keeps its tabs**. Add `DownloadTrigger` (it takes a deferred `() => form.toTurtle()`, no blob plumbing) for both formats. | M7 + M4 | M |

The panel body is **library-side**, the pane chrome is the playground's — that is the split the showcase itself uses, `ValidationSummary`'s own docblock already argues for it, and an Evidenze instance needs the panel without copying playground code.

#### Wave 5 — the inputs (library only; may run in parallel with W3/W4)
| Files | Change | Closes | Effort |
|---|---|---|---|
| `src/react/widgets/widgets.ts` | `MultiWidgetProps { values: string[]; onChange(values); minCount; maxCount }` + `WidgetDef { render; multi?; assist? }`. `FieldRenderer` picks `multi` when `field.repeatable && entry.multi`, else today's `FieldArray`. Also thread `minExclusive`, `maxExclusive`, `minLength`, `flags`, `minCount`, `maxCount`, `repeatable`, `defaultValue`. | M5 (structural blocker) | M |
| `src/engine/GraphState.ts` | `setValues(focus, predicate, next: Term[])` — diff, then **one** `bump()`. | M5 | S |
| `src/react/widgets/defaultWidgets.tsx` | `className="w-full"` on `NativeSelect` (its wrapper is `w-fit` and only `className` reaches it — this is the most visible "our form looks thinner" defect, one word). `TagsInput` for repeatable `xsd:string`. `Combobox multiple` for repeatable `sh:in` and repeatable `sh:class`. `NumberInput` for numeric. `SegmentGroup` for ≤4-option enums and for the three-state optional boolean; `Switch` only when `sh:minCount ≥ 1` or `sh:defaultValue`. Register `shui:BlankNodeEditor` as nested. Rewrite the `NumberInput` docblock — its claim that NumberInput is not Field-aware is false (`use-number-input.js:13-25` reads Field). | M5 | L |
| `src/react/widgets/LanguagePicker.tsx` + `defaultWidgets.tsx` | Use `ComboboxFieldInput` (or `showTrigger={false}` + its own `id`) so the picker stops claiming the Field's control id — today `LangField` emits **duplicate DOM ids** and draws a bordered box inside a bordered box with a spurious chevron. Drop the `border: 0` hacks. | M5 ("el inline es muy fino") | M |
| `src/react/fieldassist/AsyncCombobox.tsx` | Explicit `showTrigger` prop; debounce the `allowCustomValue` commit (250 ms + flush on blur) — today every keystroke writes a `namedNode`, rebuilds the model and re-runs wasm validation. | M5 | M |
| `src/react/form/FieldRenderer.tsx` | Stop passing `sh:pattern` to the HTML `pattern` attribute (D5). | M5 | S |
| `README.md` §`shui:` | Replace the prose list with the editor-IRI → control table, plus the explicit "cannot render" list (`rdf:langString` + repeatable, `sh:uniqueLang`, `sh:hasValue`, `sh:min/maxExclusive`, `sh:minLength`, `sh:flags`, `sh:qualifiedValueShape`). | M5 (the reference mapping) | S |
| `src/react/widgets/DateField.tsx` | Thread `disabled`/`invalid` by hand — Ark's DatePicker reads no Field context, so a `Field disabled` renders a fully interactive calendar today. | M5 | S |

#### Doc correction (any wave)
`.planning/ux-and-instances.md` M4 describes an older showcase revision: Source and Output no longer use tabs there at all — each is one document with a `NativeSelect` in its `PaneHeader`. M3's "in `blocks` it overflows" is also unreproducible: `Diagnostic` is imported by no `blocks` example, and the `flex-nowrap` bug it would have been is already fixed in the tarball we consume.

---

### 3. Decisions that block code

**D1 — Who owns an example's theme, and is it one name or a pair?** *(blocks W3; M1 and M8b conflict here)*
→ **A pair, owned by the example, read by `instance.ts`.** `defaultTheme` is side-agnostic, so `theme: "night"` paints the light side dark with `.dark` off. Change the field to `{ light, dark }` and ask kanzo-ui to widen `defaultTheme?: string | Partial<Record<Appearance, string>>` (~5 lines at `KanzoThemeProvider.tsx:534`). Interim if upstream is not available this cycle: one string, and pin appearance to that theme's side via `themeIndex.find(…).dark` — the move `ThemeMenu` already makes. Do **not** lift a second appearance resolver into the playground. Do not delete the field into `instance.ts`; change its reader, not its home.

**D2 — What does a permalink carry for an unedited bundled example?** *(blocks W3)*
→ **Reference by id when clean, embed only when dirty.** Same envelope either way. Accept the trade out loud: an id-only link resolves only on a deployment that ships that shape set — which is what an instance *is*.

**D3 — How is a client instance delivered?** *(blocks W3)*
→ **Build-time only in the first cut** (`VITE_MF_INSTANCE`). Shapes stay in the bundle: no flash, no network dependency, works offline. Cut the runtime `fetch('/mf-instance.json')` until someone asks for it (see §4).

**D4 — Which themes does an instance publish, and does it pin?** *(blocks W3)*
→ Playground publishes **all 29** via `themeIndex` (it *is* a showcase, the index is generated so it cannot drift, chips are 24px). A client instance publishes **exactly its light and dark themes** — two entries, so the section renders and appearance still works. **Never `policy.pinned`**: pinning sets `offered: false`, `ColorSection` filters to one entry and returns null, and the deployment ends up with no appearance control at all.

**D5 — Does `sh:pattern` keep reaching the HTML `pattern` attribute?** *(blocks W5)*
→ **Drop it.** `sh:pattern` is an unanchored XPath regex; the HTML attribute is implicitly `^(?:…)$`, so `sh:pattern "[0-9]{4}"` rejects `AB1234`, which SHACL accepts. `sh:flags` is unrepresentable there anyway, and the engine already validates on commit. We were enforcing something the shape did not say.

**D6 — Multi-value control selection: cardinality or new vocabulary?** *(blocks W5)*
→ **Cardinality** (`field.repeatable`). No invented IRIs; an explicit `shui:editor` still wins in `resolveWidget`, so the override case falls out free.

**D7 — Once nested results are in the report, what does the outer `sh:node` row do?** *(blocks W1 and the W4 panel)*
→ **Suppress the rollup** whenever a result exists whose focus node is its `value` term. One violation, one actionable row; a "something in here" row beside the row that says exactly what is noise and doubles the header count. Keep it only when nothing nested was reported.

**Author input needed, not a decision:** what URL were you on when Share failed? On plain HTTP or in a sandboxed iframe, `navigator.clipboard` is undefined and *every* Share silently does nothing — a second, independent cause of "no funciona en absoluto" that only W3's error surfacing would reveal.

---

### 4. What to cut

**Cut: the RDF graph view (`@kanzo-tech/graph`), M7's third bullet.** "¿Para qué tenemos un motor de grafos?" is fair, and the from-arrays path (`memorySource` + `useGraph`, no DuckDB) is genuinely viable — but the package is neither published nor packed (`scripts/link-kanzo-ui.sh:17` packs only theme/ui/ai), `@cosmos.gl/graph` is a hard non-optional WebGL peer, and we would have to write the quads→`{vertices, positions, links, categories}` projection *and* seed positions by hand before the simulation has anything to relax. That is a milestone, not an item in a chrome pass. Ship `JsonTreeView` + `DownloadTrigger` now — both are already in the tarball — and raise the graph separately.

**Cut: "review kanzo-ui's blocks generally" (M3).** The premise does not hold. `Diagnostic` is imported by no `blocks` example, and the `DiagnosticHeader` `flex-nowrap` overflow is already fixed upstream and the fix is in our vendored tarball. Filing "it overflows in blocks" would be rejected. Replace with a narrow, accurate report of the two real paths — `DiagnosticSource` is `shrink-0 whitespace-nowrap` with no `truncate`, and `DiagnosticFrame`'s file segment is `shrink-0` while only the directory truncates, so any identifier without a `/` (i.e. an IRI) overflows — and shorten our own strings to local names regardless, which fixes us either way.

**Cut: `Slider` for bounded numbers (M5).** It is the only row that forces the registry to break its founding rule and hand-thread `invalid`/`disabled` (Ark's Slider reads no Field context at all), RDF cares about the exact value, and the selection heuristic ("both bounds present, range ≤ 100") is invented — nothing in SHACL says it. `NumberInput` with real bounds is the honest control. Revisit if a shape appears that actually wants it.

**Cut: `RadioGroupCard` for 5–15-option enums (M5).** Its trigger condition is options carrying `sh:description`, which none of our shapes do, and it depends on a `--columns` grid rule we have not confirmed ships in the compiled sheet. The visible defect is `NativeSelect` rendering thin, and `className="w-full"` fixes that in one word.

**Cut for now: `SubClassEditor` + TreeView + the `subClasses` seam (M5 row 19).** Real gap — a flat `WidgetOption[]` means nobody, not even a consumer overriding the editor, can reach TreeView — but no data source in the repo produces a hierarchy and no consumer would wire the seam this cycle. Three editors sharing one body is honest until someone has a tree. Document it as a known gap in the README table instead.

**Cut: the custom-CSS paste box in Preferences (M8).** There is no authoring gap: kanzo-ui's `/theme-generator` already authors a theme as a form and emits a paste-able `[data-theme="…"] { … }` block plus a permalink — which is exactly what daisyUI's generator does, so "how does DaisyUI do it" is answered by "the same way, and we already have it". A paste box is only worth building when the pasted block can *travel*, i.e. when the permalink carries the instance. Link out now; revisit inside M1's second grade if it is ever asked for.

**Cut from the first cut: runtime `fetch('/mf-instance.json')` (M1/D3).** Speculative escape hatch. Build-time resolution keeps the shapes in the bundle, which matters because the shapes drive the whole form. Add the runtime layer the first time a deployment actually needs to change a logo without a rebuild — `instance.ts` is the one place that knows the resolution order, so adding a step later is cheap.

**Cut: carrying the theme in the permalink.** Both lanes converge here independently. A permalink is about the document; the theme belongs to the deployment and to the reader's persisted preference. Carrying it reintroduces exactly the "opening an example silently rewrites somebody's saved theme" problem `presets.ts` already documents.

**Cut from this plan: K2 (`MadeWith`).** It is a kanzo-ui admission decision, it belongs in that repo's `/docs/design`, and nothing in metadata-form is blocked on it. The playground already writes the three elements and a `Link` itself, which is option 2 and is fine.

**Do not cut, despite being upstream and gated: the fork's `sh:message` merge (W1b).** Eleven of thirty constraint components silently discard the author's message. That is a spec bug on the multilingual path the whole i18n effort was built on, and no TS-side change can substitute for it. Run it as an independent track so the republish gate never blocks the playground work.

---

## Decisions taken, 2026-08-26

Answered by the author; the plan's recommendation was taken in all four.

| | Decision | Consequence |
|---|---|---|
| **D1** | An example's theme is a **`{ light, dark }` pair, owned by the example**, read by `instance.ts`. | `defaultTheme` is side-agnostic, so a single name paints the light side dark. Needs `defaultTheme?: string \| Partial<Record<Appearance, string>>` widened in kanzo-ui (~5 lines). The field changes reader, not home. |
| **D2** | A permalink **references a bundled example by id when clean and embeds only when dirty**. | ~40-char URLs instead of 15.5 KB. Accepted out loud: an id-only link resolves only on a deployment shipping that shape set — which is what an instance is. |
| **D3** | An instance is **build-time only** (`VITE_MF_INSTANCE`). | Shapes stay in the bundle: no flash, no network dependency, offline. The runtime `fetch` layer is cut until someone asks. |
| **D4–D7** | Taken as recommended, unread: publish all 29 themes in the playground and exactly two in a client instance (never `policy.pinned`); drop `sh:pattern` from the HTML attribute; select multi-value controls by cardinality; suppress the `sh:node` rollup row when something nested reported. | — |

**Confirmed, not decided:** the author was on `http://localhost`, so `navigator.clipboard`
was `undefined` and the empty catch swallowed a TypeError on *every* Share. That is the
second, independent cause of "sharing does not work" — the first was the frozen options
object. Both are now fixed.


---

## Wave 1b landed, and the finding was understated

`rudof-fork` `c4362e002` on `arch/wasm-validator`.

The investigation said **11 of 30** components drop the author's `sh:message`. The truth is
**14**: every component that builds its own `ValidationResult` dropped it. The eleven named
were all real; the finding missed `and.rs`, `equals.rs` and `closed.rs` — and those three are
worse, because they set no message *at all*, so those violations reached a user with no text
whatsoever.

The merge is now one helper, `with_shape_message`, and the two sites in `constraints/mod.rs`
that already did it correctly call it too. `sh:sparql` deliberately keeps its own ordering
(solution `?message` > the constraint's > the shape's), since all three are author text.

`node.rs` stops `Display`ing the whole `IRShape` — that dump is what reached the screen.

**Consuming this needs a republish of `@kanzo-tech/rudof-wasm` with a NEW version number.**
The published `0.3.4` and the local `0.3.4` are already different binaries; republishing
`0.3.4` again would leave three artefacts wearing one version string.

**Two consequences to check after the republish.** `and`/`equals`/`closed` now carry text
where they carried none, so anything downstream that read "empty message" as a signal will
see a string. And `sh:node`'s untagged default changed shape — if a test pins the old AST
dump, that break *is* the fix landing.

**Known gap, reported rather than hidden:** the `basic_sparql` ordering change is
compile-verified and reviewed, not test-covered — exercising it needs a `sh:sparql`
constraint under `ShaclValidationMode::Sparql`, and the crate's tests there are `ignored`.

---

## The republish, and what verifying it actually showed (2026-08-27)

`rudof-fork` `arch/wasm-validator` carried two changes that were never committed —
found while preparing the republish, not listed in any handover:

- `rudof_wasm/src/{dto,validate}.rs` — `message` as `Vec<LangString>` instead of
  `Vec<String>`. `result_to_dto` collected `.values()` and discarded the key that
  held each message's language, so the multilingual half of SHACL messages was
  unreachable through the whole ABI. Now `3fda6b26b`.
- `rudof_wasm/build.sh` + `.github/workflows/publish-wasm.yml` — off wasm-pack
  (archived) onto the three tools it wrapped, with the wasm-bindgen 0.2.120 and
  binaryen 116 pins stated and enforced. Now `8db3a61ea`.

That is the third artefact explained: published `0.3.4` (30 Jun) has **no**
`LangString`; the `node_modules` `0.3.4` (15 Jul) has it but predates
`c4362e002`, so it lacks the fourteen-component `sh:message` merge.

### Both warned-about consequences are absorbed, and here is why

Neither turned a test red, and the reason is structural rather than luck:

- **`and`/`equals`/`closed` now carry text.** `authorMessage`
  (`src/form/validation.ts:48`) reads lang-**tagged** entries only, and nothing in
  `src/` reads message-emptiness as a signal. The new text is the author's
  `sh:message`, which is the point of the change.
- **`sh:node`'s default changed shape.** `friendly()` already stops every `sh:`
  constraint at the catalog or `_fallback` and never falls through to engine text
  (`validation.ts:85`), so no dump could reach a screen before or after. Nothing
  pinned it because nothing could see it.

What the new binary actually emits for the M6 case, verified end to end:
the author's `@es` and `@en` messages both arrive tagged, and the untagged default
is `Node(http://example.org/AgentShape)` — the shape's ID. M6's reported dump,
`Node(NodeShape Targets: … Property Shapes: [22, 13, 23])`, is gone.
Pinned by `test/rudof-wasm.integration.test.ts` (`93b7508`), which fails on the
published `0.3.4` on purpose: it is the acceptance test for the republish.

### Runbook — in this order, or CI stays red

Version is **0.3.5** (author's call; `^0.3.4` therefore resolves to it, so no
consumer range needs editing — the lockfile does).

1. `git push` — `rudof-fork arch/wasm-validator`, then `metadata-form feat/kanzo-ui`.
   **Needs the human**: `~/.ssh/kanzo` is passphrase-protected with nothing in the
   agent, and the `gh` token (account `angelip2303`) is read-only on `Kanzo-Tech`.
2. Tag, which is what publishes:
   `git -C ../rudof-fork tag rudof-wasm-v0.3.5 8db3a61ea && git -C ../rudof-fork push upstream rudof-wasm-v0.3.5`
   The workflow builds from the tag and authenticates by OIDC — no `NPM_TOKEN`.
   The tag must point at `8db3a61ea` or later: `c4362e002` alone lacks the ABI.
3. **Refresh the lockfile — publishing alone does nothing for CI.** It pins
   `0.3.4` to the *published* tarball's integrity hash, and CI runs `npm install`,
   so it keeps serving the old binary until:
   `npm install @kanzo-tech/rudof-wasm@0.3.5` — then commit `package-lock.json`.
4. `npm test` (81 expected) and `npm run typecheck`. The two wasm tests that were
   red in a clean clone, plus the new one, go green together — they always had the
   one cause.

Local `node_modules` currently holds the un-published build (`3022552` bytes,
from `8db3a61ea`); step 3 replaces it with the real artefact. The previous copy is
at `/tmp/rudof-wasm-backup` until then.
