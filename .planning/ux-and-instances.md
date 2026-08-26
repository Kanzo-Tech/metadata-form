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
