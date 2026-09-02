# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/); this project will adopt
[Semantic Versioning](https://semver.org/) from 1.0.0.

## [Unreleased]

### Architecture
- **rudof-over-WASM is the engine** — [rudof](https://github.com/rudof-project/rudof)
  (a Rust SHACL/ShEx stack) compiled to WebAssembly now owns every RDF concern over a
  **single** graph: parsing, SHACL validation, value projection, serialization, and
  SHACL-UI editor resolution. Replaces the previous JS pipeline (an `n3` graph +
  `rdf-validate-shacl` + a JS `SchemaAdapter`). One source of truth, no JS RDF
  reimplementation. Shipped as the `@kanzo-tech/rudof-wasm` dependency, lazy-loaded on
  first form mount.
- **`form.report`** — the controller now exposes a single derived view of form
  state (validation + completion + health) computed in one traversal. Replaces the
  separate `useFormIssues`/`useFormAssistant` hooks; `ValidationSummary`, the
  per-group badges and `<FormAssistant>` all read from it.
- **Layered `src/react/`** — `form/`, `layout/`, `widgets/`, `fieldassist/`,
  `validation/`, `assistant/`, `hooks/`, `utils/`. Layout logic (sequential/tabs/
  steps + grid) extracted out of `NodeForm` into `layout/`.

### Added
- **SHACL-UI editors** — field editors come from the
  [SHACL-UI](https://www.w3.org/TR/shacl12-ui/) `shui:editor` term (`shui:TextAreaEditor`,
  `DetailsEditor`, `DatePickerEditor`, …), resolved by rudof with a datatype / `nodeKind`
  / `sh:in` / `sh:class` / `sh:node` fallback. metadata-form binds each editor IRI to a
  React widget.
- **Focus-scoped serialization** — `serializeFocus` emits the subgraph for a single
  focus node (used for nested sub-forms and scoped output).
- **`metadata-form/rudof` subpath** — direct engine access (`createRudofEngine`,
  `RudofEngine`, `projectTree`) for power-user wiring.
- **Unified assistance seam** — one `assist={{ search, suggest }}` option
  (replaces `classInstanceProvider` + `fieldSuggester`). `search` powers `reference`
  autocomplete and `suggest` the ✨ value menu, both via downshift. The library never
  calls an LLM/service itself.
- **`<FormAssistant>`** — a non-intrusive corner mascot that surfaces the validation
  report *and* guides to the next field; swappable `character` seam (minimal default;
  Lottie example in the playground).
- **Adaptive validation surface** — global `ValidationSummary` in sequential layout,
  per-group badges in tabs/steps, never both.
- **Build diagnostics** — opt-in `onDiagnostic` surfaces dropped complex paths and
  missing `sh:node` shapes instead of failing silently.
- **Editable complex property paths.** A property path is no longer editable-or-not
  by whether it is an IRI. `sh:inversePath` of a predicate writes the one statement
  it means — `(value, p, focus)`; `sh:alternativePath` over simple branches writes
  through one branch and retracts from all of them (the union is what the path reads
  back); a sequence path writes onto its intermediate node whenever that node exists
  and is unique. The rules, and the reasoning for the one SHACL leaves open (which
  branch of an alternative), are in `src/form/writePath.ts`. `FieldModel.write`
  carries the plan; `GraphState` mutations are addressed by it rather than by a
  predicate.
- **`FieldModel.readOnlyReason`** — a field that still takes no input says why, as a
  stable code plus a sentence in the form's locale (`strings.readOnly`, en/es/ca),
  rendered under the disabled control. The four codes: `variable-length-path`
  (`p*`/`p+`/`p?` — writing through an unbounded path is not well-defined),
  `compound-path`, `intermediate-missing`, `intermediate-ambiguous`.
- Layout (`tabs`/`steps`) + column `grid` props.

### Changed
- **BREAKING — string-only input.** `shapes` and `data` are Turtle/JSON-LD **strings**
  (rudof parses them); passing pre-parsed graphs/quads is no longer supported.
- **BREAKING — `adapter` → `engine`.** The custom-backend option is now `engine` (a
  `RudofEngine`); the JS `SchemaAdapter` abstraction is gone. Engine internals moved off
  the main entry to the `metadata-form/rudof` subpath.
- **Editor selection: DASH → SHACL-UI.** `dash:editor`/`dash:viewer` are replaced by
  `shui:editor`/`shui:viewer` (the two `dash:*` mentions left in code are deliberate
  bridge comments).
- `toJsonLd()` now returns **compacted** JSON-LD by default (against the given context
  or the default prefixes), not raw expanded output.
- **BREAKING — `GraphState` mutations take a `FieldWrite`, not a predicate.**
  `setValue`/`setValues`/`addValue`/`removeValue`/`createNested` are addressed by a
  write plan, because a field's path is not always a predicate. A caller holding one
  wraps it: `graph.addValue(focus, forwardWrite(predicate), value)`.
- **`FieldModel.path` is the canonical path key**, not the predicate: `ex:p` for a
  predicate path, `^ex:p` / `(a|b)` / `(a/b)` for the rest. One key for a field, its
  projected values and its findings — `id === fieldKey(focusNode, path)` now holds for
  every field. An inverse-path field's `path` was previously the bare predicate, which
  collided with a forward field on the same predicate.

### Removed
- **JS RDF pipeline** — the `n3` graph, `jsonld`, and `rdf-validate-shacl` runtime
  dependencies, and the JS `SchemaAdapter` (`src/core/…`). All RDF work now runs in the
  rudof wasm engine.

### Notes
- `sh:or`/`sh:xone` still derive only the first alternative's datatype/class; a
  multi-type UI is not yet built.
