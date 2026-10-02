# metadata-form

Auto-generate editable **React** forms from **SHACL** shapes. Pass a SHACL shape
(the "model") and an optional RDF data graph; get a form that edits the graph and
serializes back to **Turtle** and **JSON-LD**.

**[Try the playground →](https://kanzo-tech.github.io/metadata-form/)**

The shape engine is [**rudof**](https://github.com/rudof-project/rudof) — a Rust
SHACL/ShEx stack — compiled to **WebAssembly**. rudof owns the RDF: it parses the
shapes, validates, projects the form's values out of the data graph, and
serializes the result. metadata-form is the React layer on top: it maps each
field's **SHACL-UI editor** to a widget and renders the form.

- 🦀 **rudof-over-WASM engine** — parsing, **real SHACL validation**, value
  projection, and serialization all run in the rudof wasm module. No JS RDF
  reimplementation; one graph, one source of truth.
- 🎛️ **SHACL-UI editors** — the field's editor comes from the
  [SHACL-UI](https://www.w3.org/TR/shacl12-ui/) `shui:editor` term, with a
  datatype / `nodeKind` / `sh:in` / `sh:class` / `sh:node` fallback.
- 🎨 **Kanzo-native + overridable** — renders with
  [@kanzo-tech/ui](https://github.com/Kanzo-Tech/kanzo-ui) over
  [Ark UI](https://ark-ui.com); swap any input by overriding its widget.
- ✅ **Live validation** — per-field errors from rudof's SHACL validator, plus a
  ready-made `<ValidationSummary>` tally: open it for every issue, grouped worst
  first, each with a way to its field — and opening it marks them all where they are.
- 🤖 **Optional AI assist** — a separate `metadata-form/ai` subpath over
  [@kanzo-tech/ai](https://github.com/Kanzo-Tech/kanzo-ui)'s `Assist`: ghost text
  in textareas (Tab/Esc), candidate values under text fields and tags fields, and
  the field's own SHACL constraints in every prompt. The core imports no AI package.
- 📦 **Small example shapes** in the playground — a conditional field in SHACL
  Core and in SHACL 1.2, and one property per editor.
- 🧩 **ShEx-ready** — the engine seam is shape-language-agnostic; ShEx can be
  added without touching the UI.

## A running example

A complete shapes graph (prefix declarations omitted). It describes a dataset with a
title, a yes/no answer to "does it contain structured data?" and, only when the
answer is yes, a description of its variables:

```turtle
ex:DatasetShape a sh:NodeShape ;
  sh:targetClass dcat:Dataset ;
  sh:property ex:title , ex:structured ;
  sh:or ( [ sh:not ex:HasStructuredData ] ex:DescribesVariables ) .

ex:title sh:path dct:title ;
  sh:name "Title"@en , "Título"@es ;
  sh:datatype rdf:langString ; sh:minCount 1 ;
  sh:message "A dataset needs a title."@en ,
             "El dataset necesita un título."@es .

ex:structured sh:path healthdcatap:hasStructuredData ;
  sh:name "Structured data"@en , "Datos estructurados"@es ;
  sh:datatype xsd:boolean ; sh:maxCount 1 .

ex:HasStructuredData a sh:NodeShape ;        # the condition, C
  sh:property [ sh:path healthdcatap:hasStructuredData ;
                sh:hasValue true ] .

ex:DescribesVariables a sh:NodeShape ;       # the consequence, T
  sh:property [ sh:path healthdcatap:hasVariables ;
    sh:name "Variables"@en , "Variables"@es ;
    sh:node ex:VariableShape ; sh:minCount 1 ;
    sh:message "Describe the variables of a structured dataset."@en ,
               "Describe las variables de un dataset estructurado."@es ] .

ex:VariableShape a sh:NodeShape ;
  sh:property [ sh:path csvw:name ; sh:name "Name"@en , "Nombre"@es ;
                sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] .
```

From those triples, and with no code written for this profile, the form is:

![The form generated from the shapes above. Left: the dataset declares no structured data and the variables are absent. Right: it declares structured data; the variables appear, are required, and their message is the one the profile's author wrote.](docs/figures/conditional.png)

Each line has a visible consequence:

- `ex:title` is a language-tagged string that must occur at least once, so the form
  shows a text field with a language selector, marks it required, and lets the user
  add further titles in other languages. Its label is "Title" or "Título" depending on
  the reader's language, and so is the message shown while it is empty.
- `ex:structured` is a boolean that may occur at most once, so it is a single yes/no
  control and nothing offers a second value.
- The `sh:or` on the dataset shape says that a dataset either does not satisfy the
  condition (`ex:HasStructuredData`) or satisfies the consequence
  (`ex:DescribesVariables`). While the answer is "no" the variables are not in the
  form at all; when it becomes "yes" they appear, are required, and the record is
  reported invalid until one is described.
- A variable is itself described by a shape (`sh:node`), so it is edited in a nested
  form with its own required field.

The same graph validates the result: the form cannot accept what the profile
rejects, because one engine produces both. This is the example the
[playground](https://kanzo-tech.github.io/metadata-form/) opens on.

## Install

```sh
npm install metadata-form react react-dom lucide-react tailwindcss @kanzo-tech/ui
```

The AI layer is opt-in and has its own peers (`@kanzo-tech/ai`, `@kanzo-tech/llm`,
`ai` and `@ai-sdk/react`) — see [Assistance](#assistance).

ESM-only, React 19+, Tailwind CSS v4. The UI is built on **@kanzo-tech/ui**
(icons from [lucide](https://lucide.dev)), which ships Tailwind *source*, not
compiled CSS: your build compiles it, together with this library's classes, in
one stylesheet.

```css
@import "tailwindcss";
@import "@kanzo-tech/ui/tailwind.css";
@import "metadata-form/tailwind.css";
```

(With Vite, add `@tailwindcss/vite`.) Then put the theme attributes
on `<html>` with `KanzoThemeProvider`. There is **no wrapper component to render
inside** — Ark's overlays portal to `document.body`, outside anything a wrapper
could reach, and density sets the root font-size the whole `rem` scale resolves
against.

### The wasm engine

metadata-form depends on **[`@kanzo-tech/rudof-wasm`](https://www.npmjs.com/package/@kanzo-tech/rudof-wasm)**
(installed automatically) — the rudof engine as a `wasm-bindgen` `--target web`
module. The `.wasm` binary loads lazily the first time a form mounts, so importing
the library never pulls it until you use it.

Your **bundler serves the `.wasm`**. With Vite, keep it out of the dependency
pre-bundle so the binary is served verbatim (otherwise the dev server returns HTML
and you get `WebAssembly.instantiate: expected magic word`):

```ts
// vite.config.ts
export default defineConfig({
  optimizeDeps: { exclude: ["@kanzo-tech/rudof-wasm"] },
});
```

Most app bundlers (webpack 5, Next.js, etc.) handle the `new URL(..., import.meta.url)`
wasm asset out of the box. Static hosts serve `.wasm` as `application/wasm` by default.

## The contract

**SHACL shape + (optional) RDF graph → RDF graph.** Nothing custom.

One way to use it — a controller hook (think `react-hook-form`) plus one
component. The controller owns the editable graph and exposes the live output
reactively, so there is no `onChange`:

```tsx
import { useMetadataForm, MetadataForm, ValidationSummary } from "metadata-form";
import { KanzoThemeProvider } from "@kanzo-tech/ui";

export function App({ shape, graph }: { shape: string; graph?: string }) {
  const form = useMetadataForm({ shapes: shape, data: graph });

  return (
    <KanzoThemeProvider>
      <ValidationSummary form={form} />
      <MetadataForm form={form} />
      <button disabled={!form.isValid} onClick={async () => console.log(await form.toTurtle())}>
        Save
      </button>
    </KanzoThemeProvider>
  );
}
```

Shapes and data are **strings** — Turtle or JSON-LD; rudof parses both. The
controller is the single handle for everything:

| | |
|---|---|
| `form.quads` | live data graph (re-derived on each edit) |
| `form.toTurtle()` / `form.toJsonLd()` | serialized output (via rudof) |
| `form.isValid` / `form.errors` | live SHACL validation |
| `form.validate()` / `form.reset()` | imperative actions |
| `form.revealAll` / `form.setRevealAll(on)` | show every field's errors, touched or not (what opening `<ValidationSummary>` sets) |
| `form.report` | derived form state — `{progress, issues, pending, nextField, health}` |
| `form.subscribe(cb)` | observe changes (autosave, external sync) |

### Public API

The main entry is deliberately small.

| Export | |
|---|---|
| `useMetadataForm`, `MetadataForm` | the controller hook and the component that renders it |
| `ValidationSummary`, `ValidationPanel` | the issue tally and the issue list |
| `defaultWidgets`, `Editors` | the widget registry and the `shui:` editor IRIs it is keyed by |
| types | the form model (`FormModel`, `FieldModel`, …), the report (`FormReport`, `FieldError`, …), the widget contract (`Widget`, `WidgetProps`, `WidgetRegistry`, …), `FormAssist`, `AssistUi`, `AssistWrap`, `Strings`, `StringTables` |

Everything else is on a subpath: `metadata-form/rudof` (the engine and the shape
IR), `metadata-form/ai` (the AI layer: UI, prompt context, model adapter), `metadata-form/i18n` (languages other than
English, as data), `metadata-form/tailwind.css`.

### Languages

What the reader sees comes from three places, and the library says which:

| What | Where it comes from | Localised how |
|---|---|---|
| field labels (`sh:name`), help (`sh:description`), group names, `sh:or` alternative names, the author's `sh:message` | **the profile** — language-tagged literals in the shapes graph | picked by the reader's languages |
| the wording of a failure when the author wrote no `sh:message` | **the engine's message catalog** — RDF triples `<constraint component> sh:message "…"@lang`, English, Spanish and Catalan built in | picked by the same function |
| placeholders, `Yes`/`No`, counts, progress, the read-only reasons, the findings panel | **the strings table** — typed, English built in | by language tag |

```tsx
import { es, ca } from "metadata-form/i18n"; // languages other than English, as data

useMetadataForm({
  shapes,
  locale: ["ca", "es"],                          // ordered, most preferred first; default: navigator.languages, else "en"
  strings: { es: es.strings, ca: ca.strings },   // interface strings, by tag
  messages: "…",                                 // more default failure messages, as Turtle (see below)
});
```

**Picking.** One function picks every language-tagged string. It follows the SHACL-UI
Editor's Draft, *Label and Language Resolution*: the order of the property shape's
`sh:languageIn`, then the application's list (`locale`), with the browser's
`navigator.languages` as the default; tags match ranges by RFC 4647 §3.3.1 basic
filtering (the tag `en-US` matches the range `en`, and `en` does not match `en-US`, so
give `["es-ES", "es"]`, as a browser does). Among literals a range matches, and when
nothing matches, the choice never depends on the order they were read in: an untagged
literal, else the tagged ones by BCP-47 tag in code-point order, then by text. A property is labelled by the draft's *Property Labels* order: its `sh:name`, then
the `rdfs:label` of its predicate in the data graph, then in the shapes graph, then the
predicate's local name split into words; each step is picked by that same resolution, and the
first step that has a label wins.

**A text in a language nobody asked for.** SHACL says a result carries exactly the author's
messages, so when a profile wrote a name, description, group name or message only in
languages the reader did not ask for, that text is still what is shown. It is made visible
in two ways. The element that shows it carries the text's own `lang` attribute (`lang="ca"`
on a label, a description, a group title, an error), so a screen reader pronounces it in its
language; a text in a requested language, and an untagged one, carry none. And the form
reports it through `onDiagnostic` (also kept as `form.diagnostics`) as a diagnostic with
`level: "info"` and `code: "missing-language"`, once per shape (or field) and kind (name,
description, message) and requested languages, never per render: *No name in en for Nom;
showing ca.* An untagged text is language-neutral and is not reported. The picker itself is
`resolveLanguage(items, languages)`, which returns the literal and whether it was a
fallback; `pickByLanguage` is the same choice without the flag.

**Messages come from the engine.** A validation result carries its messages
language-tagged, and the form picks the one to draw when it draws it, so changing `locale`
re-words the errors already on screen without validating again. A result whose shape has an
`sh:message` carries exactly the author's literals (SHACL §2.1.5). A result whose shape has
none carries one message per language of the engine's catalog, generated from RDF inside the
engine — `sh:MinCountConstraintComponent sh:message "At least {$minCount} value(s) required"@en .`,
with the constraint's parameters filled in (`shacl/src/messages/README.md` in the engine says
what the standards fix and what the engine chose). Reading `sh:message` off a constraint
component is the engine's convention, not a rule of the SHACL recommendation;
`sh:ConstraintComponent` holds the message for any component the catalog does not name. A
reader whose language has no message gets English.

**Which languages the shapes are written in** is data too: `form.availableLanguages` lists the
tags found on the shapes' `sh:name`, `sh:description`, `sh:message` and on the `rdfs:label`s of
groups and predicates, most written first (untagged literals count for none). A language
selector offers exactly these, so it follows a shape edited live.

**Adding a language** is supplying data, with no code change: triples for the messages
(`messages: "@prefix sh: <http://www.w3.org/ns/shacl#> . sh:MinCountConstraintComponent sh:message \"Ce champ est obligatoire\"@fr ."`,
handed to the engine's `Session.loadMessages`; later documents win per component and language,
so the same option re-words a built-in message) and a table for the strings
(`strings: { fr: { chrome: { yes: "Oui", no: "Non" } } }`; a table may be partial and what it
leaves out stays English). The same `strings` option re-words English itself (`{ en: { … } }`).

**Localised by the form's language.** `<MetadataForm>` mounts Kanzo UI's `LocaleProvider`
with the first language of the list, so the calendar, number formatting and collation follow
it; the words of the parts the design system draws (`LanguagePicker`, `FieldArray`, the
steps' Back and Next, the ✨ and its announcement, the words after <kbd>Tab</kbd> and <kbd>Esc</kbd>
in the completion's keys hint) are in the strings table.

**Not localised.** The accessible names Ark's machines carry by default (the calendar's
"Open calendar", the tags input's delete button) are English: `@kanzo-tech/ui` does not
expose them as props. The `Diagnostic` messages
passed to `onDiagnostic` (developer-facing, and `missing-language` among them) and any text the AI adapter's prompts contain are
English. A shape's `sh:languageIn` orders the labels of its own property; it is not consulted
when choosing a failure message. Plural forms follow `Intl.PluralRules` for the table's
language, so a table must supply the forms its language uses.

### Assistance

Model assistance is **[@kanzo-tech/ai](https://github.com/Kanzo-Tech/kanzo-ui)'s
`Assist`**, and the core draws none of it: without `metadata-form/ai` a form renders
plain inputs and plain textareas and calls no model. Enabling it is the provider
you already mount for `Assist` anywhere, and one prop:

```tsx
import { AssistProvider } from "@kanzo-tech/ai";
import { assistTranslations, assistUi } from "metadata-form/ai"; // peers: @kanzo-tech/ai, @kanzo-tech/llm, ai, @ai-sdk/react

<AssistProvider model={model} translations={assistTranslations(form.strings)}>
  <MetadataForm form={form} assistUi={assistUi} />
</AssistProvider>
```

`model` is any [AI SDK](https://ai-sdk.dev) `LanguageModel` — `createGateway` from
`@kanzo-tech/llm` behind your own endpoint, or a provider such as `@ai-sdk/anthropic`.
What it offers depends on the control, not on a setting: a **textarea** (`TextArea`,
`RichText`, `TextAreaWithLang`) is continued at the caret as ghost text — Tab takes
it, Ctrl/⌘+→ a word, Alt+] the next — a one-line **input** (`TextField`,
`TextFieldWithLang`) gets candidate values under it, and a repeatable text field's
**tags input** gets values to add. A widget opts in with `assist: true` in its
registry entry; a custom widget wraps its control in the `assist` prop it receives.
`assistTranslations` hands the form's own words to the provider, so the ✨ and its
hints speak the form's language.

**What the model is told.** `Assist` reads the field's label and helper text off the
control; `assistUi` adds the field's own context: `fieldContext(field)` — everything
its shape states, one line per fact and nothing it does not state: label,
description, value type (`sh:datatype` / `sh:nodeKind` / `sh:class`), `sh:in`
options, `sh:pattern` (+ flags), length and numeric bounds, allowed language tags
(`sh:languageIn`), cardinality, and the values a repeatable field already holds —
plus `siblingValues(…)`, the literals already entered on the same resource, and the
form's language. Both are bounded (`DEFAULT_CONTEXT_LIMITS`: 25 listed `sh:in`
values, 12 sibling values, 200 characters per value). The model is asked to satisfy
the constraints; the shape still validates whatever is committed.

**Reference search** is not a model: `useMetadataForm({ assist: { search } })` feeds
the reference combobox with `sh:class` instances from your own vocabulary service,
with or without the AI layer.

### Layout

Arrange the root property groups and lay fields out in columns — all via props
(the shape stays untouched). Groups are keyed by their `sh:PropertyGroup` IRI,
per-field spans by the predicate IRI:

```tsx
<MetadataForm
  form={form}
  layout="tabs"            // "sequential" (default) | "tabs" | "steps"
  grid={{
    columns: 2,            // default columns for every group
    groups: { "http://example.org/group/general": { columns: 1 } },
    spans: { "http://purl.org/dc/terms/description": 2 }, // span 2 columns
  }}
/>
```

Nested sub-forms always render sequentially; only the root honors `layout`.

### Errors, and when they show

A field stays quiet until the reader has been in it, so a new form does not open
covered in "required". `<ValidationSummary>` counts every issue from the start;
opening it lists them worst first, each with a way to its field, and sets
`form.revealAll`, which shows all of them on their fields at once — closing it does
not hide them again. A valid form's tally is a plain badge with nothing to open. A
host with its own "Save" can call `form.setRevealAll(true)` on a failed submit.

### Conditional fields

A field that belongs in the form only when another answer makes it so is stated as
the constraint itself, not in a rule language of the form's own. Two standard
spellings are read, and the tests run the running example in both and check that
they give the same verdict, the same error and the same message on the same field:

- **SHACL Core**: `sh:or ( [ sh:not C ] T )` on the node shape — either the node does
  not satisfy the condition `C`, or it satisfies the consequence `T`. It is recognised
  deliberately narrowly (two branches, one of which only negates a shape), so every
  other `sh:or` stays a disjunction.
- **SHACL 1.2**: `T sh:targetWhere C` — the consequence is a shape that applies to
  exactly the nodes satisfying the condition.

```turtle
ex:DescribesVariables a sh:NodeShape ;       # the consequence, T
  sh:targetWhere ex:HasStructuredData ;      # applies where C holds
  sh:property [ sh:path healthdcatap:hasVariables ;
    sh:node ex:VariableShape ; sh:minCount 1 ] .
```

The rule for drawing them is one sentence: **the fields of the consequence are shown
exactly when the validator says the condition holds**. The form has no logic of its
own for deciding this; after each edit it asks the engine that will validate the
record. The engine also validates the node against the consequence by itself, which
is what puts the error on the field that can fix it rather than on the `sh:or`.
A third spelling, a node expression that computes `sh:minCount`, is not supported.

### Attribution

`<MetadataForm>` ends with a small "Made with ♥ at Kanzo" line, translated with
the rest of the interface. `attribution={false}` removes it.

### Example shapes

Shapes are just SHACL/Turtle strings — bring your own. The
[playground](https://kanzo-tech.github.io/metadata-form/) opens on three small ones
(`examples/paper-*`): a conditional field stated with `sh:or`, the same condition
with SHACL 1.2's `sh:targetWhere`, and one property per `shui:` editor. Full
profiles used by the tests and the evaluation (`examples/health-dcat-ap`, among
others) are in the repository to copy from. The library itself ships no shapes
(its job is shape→form, not shipping vocabularies).

## SHACL-UI editors (`shui:`)

A field's input is chosen from the [SHACL-UI](https://www.w3.org/TR/shacl12-ui/)
vocabulary. Annotate a property shape with `shui:editor` to pick one explicitly:

```turtle
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix shui: <http://www.w3.org/ns/shacl-ui/> .
@prefix ex:   <http://example.org/> .

ex:DatasetShape a sh:NodeShape ;
  sh:property [ sh:path ex:description ; shui:editor shui:TextAreaEditor ] ;
  sh:property [ sh:path ex:publisher   ; sh:node ex:AgentShape ; shui:editor shui:DetailsEditor ] .
```

When `shui:editor` is absent, rudof resolves an editor from the field's
constraints — `sh:datatype`, `sh:nodeKind`, `sh:in`, `sh:class`, `sh:node`.
metadata-form's job is exactly the editor-IRI → widget binding below, so a new
editor is a widget, not an engine change.

### The mapping

![From shapes to fields: a fact stated in the shapes graph, the shui: editor the engine resolves from it, and the control the default widget registry binds to that editor.](docs/figures/mapping.png)

`Repeatable` is the control a field gets when the shape allows more than one value
(no `sh:maxCount 1`). It is selected by **cardinality, not by a second vocabulary**:
`sh:maxCount` already states how many answers a property takes, and inventing
`shui:MultiEnumSelectEditor` would put that fact in a second place that could
disagree with it. Where the column says *rows*, the single-value control repeats
inside a `FieldArray` with add/remove.

| `shui:` editor | Picked when | Control | Repeatable |
| --- | --- | --- | --- |
| `TextFieldEditor` | anything with no better fact (the fallback) | `Input` | **`TagsInput`** — chips, one control |
| `TextAreaEditor` | stated | `Textarea`, ghost text under `assistUi` | rows |
| `RichTextEditor` | stated | `Textarea` — **the design system ships no rich-text editor**; the profile asked for something we do not have | rows |
| `TextFieldWithLangEditor` | `sh:datatype rdf:langString` | `InputGroup` + the language picker in its trailing slot; the language can be chosen before the text | rows |
| `TextAreaWithLangEditor` | stated | `Textarea` (with the same ghost text) + the language picker under it | rows |
| `NumberFieldEditor` | numeric `sh:datatype` | `NumberInput` — steppers, scrubber, `tabular-nums`; bounds from `sh:minInclusive`/`sh:maxInclusive` | rows |
| `BooleanEditor` | `sh:datatype xsd:boolean` | `SegmentGroup` (Yes / No / Not set) — or a `Switch` when `sh:minCount ≥ 1` or `sh:defaultValue` guarantees a value | rows |
| `EnumSelectEditor` | `sh:in` | ≤ 4 options: `SegmentGroup`. ≤ 15: `NativeSelect`. Beyond that a searchable `Combobox` | **`Combobox multiple`** |
| `DatePickerEditor` | `sh:datatype xsd:date` | `DatePicker` + calendar | rows |
| `DateTimePickerEditor` | `sh:datatype xsd:dateTime` | `DatePicker` + a time `Input` | rows |
| `IRIEditor` | `sh:nodeKind sh:IRI`, or `xsd:anyURI` | `Input type="url"` | rows |
| `AutoCompleteEditor` | `sh:class` | `Combobox` over `assist.search`, custom IRIs allowed; plain IRI entry with no `assist` | **`Combobox multiple`** (`TagsInput` with no `assist`) |
| `InstancesSelectEditor` | stated | same body as `AutoCompleteEditor`, its own registry entry | as above |
| `SubClassEditor` | stated | same body as `AutoCompleteEditor`, its own registry entry — **see the gap below** | as above |
| `DetailsEditor` | `sh:node` | a nested `<NodeForm>` inside a `FieldArray` | rows |
| `BlankNodeEditor` | stated | the same nested sub-form: whether the resource gets an IRI is the graph's business, not the form's | rows |

An explicit `shui:editor` always wins, including over the repeatable form — so
overriding one field is one registry entry, never a fork of the selection rules.

### What this does not render

Honest gaps, not oversights. Every one of these is still **validated** — the engine
sees the whole shape; it is the *input* that cannot express the constraint.

- **`sh:minExclusive` / `sh:maxExclusive`** — `NumberInput`'s bounds are inclusive,
  and there is no epsilon that is right for both `xsd:integer` and `xsd:double`.
  Carried on `WidgetProps` for a widget that wants to say so.
- **`sh:pattern` / `sh:flags`** — deliberately **not** the HTML `pattern`
  attribute. `sh:pattern` is an unanchored XPath regex and the attribute is
  implicitly `^(?:…)$`, so `sh:pattern "[0-9]{4}"` would reject `AB1234`, which the
  shape accepts; `sh:flags` has no representation there at all. Carried as
  information; the engine enforces the real regex on commit.
- **`sh:minLength`** — reaches the input's `minLength` attribute, which nothing
  enforces outside a native form submit. The engine is what rejects a short value.
- **`sh:uniqueLang`** — a repeatable `rdf:langString` field renders as rows of
  tagged inputs, and nothing stops two of them carrying `@es`. The violation
  arrives from the validator after the fact.
- **`rdf:langString` + repeatable** — no one-control form: chips would hide the
  text, and a tag per chip has nowhere to live.
- **`sh:hasValue`** — the required value is neither pre-filled nor pinned; it shows
  up as a validation message when it is missing.
- **`sh:qualifiedValueShape`** — no control distinguishes "at least two of these
  values must match *that* shape" from the rest of the list.
- **Class hierarchies (`SubClassEditor`)** — a real gap. rudof projects options as
  a flat `WidgetOption[]`, so nobody — not even a consumer overriding the
  editor — can reach a `TreeView`: the tree is not in the data to render. Three
  reference editors sharing one body is honest until the projection carries
  `subClasses`. Until then, override the entry with your own control if you have a
  hierarchy to show.

## Theming

The look is the design system's, applied as `data-*` attributes on `<html>` by
`KanzoThemeProvider` and controlled by the user through its own `Preferences`
panel (appearance, the theme per side, density; radius and typefaces are the
theme's own). Drop `<Preferences />` anywhere in your app and the form follows.

All RDF ⇄ value conversion lives in one binding layer; the inputs are **dumb
widgets** that receive a primitive `value: string | null` + `onChange` and never
touch RDF.

A registry is keyed by the property's **SHACL-UI editor IRI** — the one rudof
resolves for every property, explicitly from the shape or inferred from its type
facts. There is no intermediate widget taxonomy: both ends of the mapping are
vocabularies somebody else maintains, and a third invented in between could only
lose information. Keying on the IRI also makes the registry open — a profile with
a custom `shui:editor` is one more entry rather than a new case in core.

Override any widget per form:

```tsx
import { Editors, type WidgetRegistry } from "metadata-form";

const widgets: WidgetRegistry = {
  [Editors.DatePicker]: (p) => <MyDatePicker value={p.value} onChange={p.onChange} />,
  // A class hierarchy asked for a tree, and now it can have one without
  // touching plain autocomplete.
  [Editors.SubClass]: (p) => <MyClassTree value={p.value} onChange={p.onChange} />,
};

<MetadataForm form={form} widgets={widgets} />;
```

## Architecture

![Architecture: the four inputs of a SHACL-UI renderer go into one rudof session compiled to WebAssembly, which parses, projects, selects an editor per property, evaluates the conditions and validates; the React layer binds each editor IRI to a component.](docs/figures/architecture.png)

The layering is that of model-based user interfaces, and the renderer model of
[SHACL 1.2 User Interfaces](https://www.w3.org/TR/shacl12-ui/) can be read as an
instance of it. The *domain* is the shapes graph and the data graph; with a focus
node and a node shape they are the four inputs of a SHACL-UI renderer, inferred
from the data and the shapes' targets when not given. The *abstract interface* is a
tree of node and property components. The *concrete interface* is the same tree
with one `shui:` editor chosen for every property — the engine's intermediate
representation (IR), plain records rather than RDF terms. The *final interface* is
the React layer, whose widget registry is keyed by editor IRI.

rudof owns every RDF concern — parsing, validation, projection,
serialization, and SHACL-UI editor resolution — over a **single** wasm graph. The
React layer is shape-language-agnostic: it consumes the `ShapeModel` IR and binds
editor IRIs to widgets, and nothing in it imports an AI package (the `assist` seam is
fed, and drawn, by `metadata-form/ai` or by the consumer). Adding **ShEx** is an engine-side change behind the
same IR; the UI doesn't move.

### `metadata-form/rudof` — direct engine access

Power-user wiring lives at the `./rudof` subpath: a shared `RudofEngine`, custom
projection, or a raw graph session, without going through the hook. It also
carries the shape IR types (`ShapeModel`, `NodeShapeIR`, `PropertyShapeIR`,
`ProjectedForm`, …).

```ts
import { createRudofEngine, projectTree } from "metadata-form/rudof";

const engine = createRudofEngine();
const model = await engine.loadShapes(shapesTurtle);
await engine.loadData(dataTurtle);
```

## Develop

```sh
npm run dev          # standalone playground (Vite) — http://localhost:5173
npm test             # vitest
npm run typecheck    # library + playground projects
npm run build        # ESM + types into dist/ (library only)
npm run build:playground   # the standalone playground app
```

The playground is its own app under `playground/` with its own Vite/TS config; the
library build (`npm run build`) is decoupled from it.

**Contributors — building the wasm.** `@kanzo-tech/rudof-wasm` is published from the
[rudof fork](https://github.com/Kanzo-Tech/rudof); `rudof_wasm/build.sh` in that fork rebuilds it
(wasm-pack `--target web`) when you need to test an unpublished engine change.

## License

MIT
