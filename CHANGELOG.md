# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/); this project will adopt
[Semantic Versioning](https://semver.org/) from 1.0.0.

## [Unreleased]

### Architecture
- **`form.report`** — the controller now exposes a single derived view of form
  state (validation + completion + health) computed in one traversal. Replaces the
  separate `useFormIssues`/`useFormAssistant` hooks; `ValidationSummary`, the
  per-group badges and `<FormAssistant>` all read from it.
- **Layered `src/react/`** — `form/`, `layout/`, `widgets/`, `fieldassist/`,
  `validation/`, `assistant/`, `hooks/`, `utils/`. Layout logic (sequential/tabs/
  steps + grid) extracted out of `NodeForm` into `layout/`.

### Added
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
- `sh:inversePath` rendered read-only; layout (`tabs`/`steps`) + column `grid` props.

### Changed
- `toJsonLd()` now returns **compacted** JSON-LD by default (against the given context
  or the default prefixes), not raw expanded output.

### Notes
- `sh:or`/`sh:xone` still derive only the first alternative's datatype/class; a
  multi-type UI is not yet built.
