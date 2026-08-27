# E3 — Does a lang-tagged `sh:message` survive to the consumer?

Run 2026-08-27. Every number below is produced by `../run.sh`; the raw output it
wrote is in `raw/`, referenced per row.

---

## Headline, and a correction to our own claim

The claim we set out to test was: *"multilingual SHACL is specified but not
implemented by validators — `sh:message` with language tags gets flattened or
dropped."*

**As stated, that claim is false, and we should not publish it.** Every SHACL
validator we could install emits a **fully conformant RDF validation report**:
all three languages, tags intact, on the same `sh:ValidationResult`. That is
pySHACL, Apache Jena, TopBraid (the reference implementation from the spec's
editor, built on Jena), rdf-validate-shacl and rudof — four independent engines
across five products. The RDF layer of the ecosystem is in good shape and we say
so.

What we did find, and what the paper can defend, is narrower and in our view
more interesting:

1. **The multilingual case is untested by the conformance suite.** Across the
   W3C SHACL 1.0 test suite (150 test graphs) and the SHACL 1.2 test suite
   (426), **not one** shape carries two or more `sh:message` values. Exactly one
   subject in each suite carries a language tag at all, and it is a single
   `@en` message. The sentence in §2.1.5 that governs the multilingual case is
   therefore unexercised by any approved test.
2. **Behaviour diverges precisely where the suite does not reach** — in the
   surfaces a consumer actually reads. The RDF report is tested by
   `message-001`, and everyone passes it. The CLI text renderers and
   language-binding ABIs are not tested, and there they diverge: pySHACL's
   `table` renderer prints one message chosen **non-deterministically**; the
   upstream `rudof` CLI's default renderer prints **none**; and our own
   `@kanzo-tech/rudof-wasm@0.3.4` flattened every message to a bare `string`,
   destroying the tag at the JavaScript boundary.
3. **No validator performs language negotiation.** Not one of the five selects a
   message for a requested locale. Every one either hands over all messages or picks one
   by accident. Choosing the right message for the reader is left entirely to
   the consumer — which is exactly the job a form has to do, and exactly why the
   ABI must carry the tag.

So the honest framing for §5 is not *"validators drop language tags"*. It is
*"the conformance suite never asks a validator to handle more than one language,
and in the layers it does not reach, the tag is where implementations quietly
disagree — including ours."*

---

## What the specification requires

SHACL 1.0 §2.1.5 *Declaring Messages for a Shape*
([W3C Recommendation, 20 July 2017](https://www.w3.org/TR/shacl/#message)):

> Shapes can have values for the property `sh:message`. The values of
> `sh:message` in a shape are either `xsd:string` literals or literals with a
> language tag. A shape should not have more than one value for `sh:message`
> with the same language tag.
>
> If a shape has at least one value for `sh:message` in the shapes graph, then
> all validation results produced as a result of the shape will have **exactly
> these messages** as their value of `sh:resultMessage`, i.e. the values will be
> **copied from the shapes graph into the results graph**.

SHACL 1.0 §3.6.2.7 *Message (`sh:resultMessage`)*:

> While `sh:resultMessage` may have multiple values, there should not be two
> values with the same language tag. […] In cases where a constraint does not
> have any values for `sh:message` in the shapes graph the SHACL processor MAY
> automatically generate other values for `sh:resultMessage`.

SHACL 1.2 Core §3.1.5 (W3C Working Draft, 3 August 2026) restates the copying
requirement **verbatim**, widening the permitted datatypes to `xsd:string`,
`rdf:langString`, `rdf:dirLangString` and `rdf:HTML`, and adding per-triple
reified messages. The requirement has not changed in nine years.

Two consequences matter for how we read the results:

- **The requirement binds the results graph, not the console.** A CLI that
  renders one message out of three to a terminal is not violating §2.1.5, as
  long as the RDF report it can emit carries all three. We grade the RDF report
  against the spec, and grade the rendering layers separately, as usability.
- **The spec's own worked example is the multilingual case.** §2.1.4 shows a
  shape with `sh:message "Too many characters"@en` and `"Zu viele Zeichen"@de`
  and a report carrying both. The behaviour is not an obscure corner; it is the
  illustration the Recommendation chose. It is simply not in the test suite.

---

## Test inputs

`../data/shapes.ttl` — one node shape, two constraints. C1 carries the same
message in `@en`, `@es` and `@ca`; C2 is the control, one untagged
`xsd:string` message.

```turtle
ex:DatasetShape a sh:NodeShape ;
    sh:targetClass ex:Dataset ;
    sh:property [                                    # C1
        sh:path ex:identifier ;
        sh:minCount 1 ;
        sh:message "A dataset must have an identifier."@en ;
        sh:message "Un conjunto de datos debe tener un identificador."@es ;
        sh:message "Un conjunt de dades ha de tenir un identificador."@ca ;
    ] ;
    sh:property [                                    # C2 — control, untagged
        sh:path ex:issued ;
        sh:datatype xsd:date ;
        sh:message "Issue date must be an xsd:date." ;
    ] .
```

`../data/data.ttl` — one node violating both:

```turtle
ex:d1 a ex:Dataset ; ex:issued "March 2026" .
```

Three further probe graphs (`probe-no-en.ttl`, `probe-en-last.ttl`,
`probe-data.ttl`) vary the languages present and their document order, to
determine *on what basis* a renderer that shows one message picks it.

---

## Tab. 2 — `sh:message` language tags across SHACL validators

Test input: one constraint carrying `@en` + `@es` + `@ca`, one carrying an
untagged message. "Surface" is the output the row grades. **Tags kept** = the
language tag is recoverable by the consumer. **Languages emitted** = how many of
the three reach the consumer. **Negotiates** = selects by a requested locale.

| Validator | Version tested | Surface graded | Tags kept | Languages emitted | Selection basis | Conformant (§2.1.5) | Raw |
|---|---|---|---|---|---|---|---|
| pySHACL | 0.40.1 (rdflib 7.6.0) | RDF report (`-f turtle`) | ✅ yes | 3 of 3 | n/a — emits all | ✅ yes | `raw/01` |
| pySHACL | 0.40.1 | text report (`-f human`) | ⚠️ no tag shown | 3 of 3 | n/a — emits all | n/a (rendering) | `raw/02` |
| pySHACL | 0.40.1 | table report (`-f table`) | ❌ no | **1 of 3** | **non-deterministic** | n/a (rendering) | `raw/03`, `raw/14` |
| Apache Jena SHACL | 6.2.0 | RDF report (default) | ✅ yes | 3 of 3 | n/a — emits all | ✅ yes | `raw/04` |
| Apache Jena SHACL | 6.2.0 | text report (`--text`) | ✅ yes (`@ca`,`@es`,`@en`) | 3 of 3 | n/a — emits all | n/a (rendering) | `raw/05` |
| TopBraid SHACL API | 1.4.4 | RDF report (`shaclvalidate.sh`) | ✅ yes | 3 of 3 | n/a — emits all | ✅ yes | `raw/06` |
| rdf-validate-shacl | 0.6.5 | RDF report (`report.dataset`) | ✅ yes | 3 of 3 | n/a — emits all | ✅ yes | `raw/07` |
| rdf-validate-shacl | 0.6.5 | JS API (`result.message`) | ✅ yes (RDF/JS terms) | 3 of 3 | n/a — emits all | n/a (binding) | `raw/07` |
| rudof CLI (upstream) | 0.3.14 | RDF report (`-r turtle`) | ✅ yes | 3 of 3 | n/a — emits all | ⚠️ near — see note | `raw/09` |
| rudof CLI (upstream) | 0.3.14 | table (`-r compact`, default) | ❌ n/a | **0 of 3** | messages not rendered | n/a (rendering) | `raw/08` |
| rudof CLI (upstream) | 0.3.14 | table (`-r details`) | ✅ yes (`es:`/`en:`/`ca:`) | 3 of 3 | n/a — emits all | n/a (rendering) | `raw/10` |
| rudof CLI (upstream) | 0.3.14 | JSON (`-r json`) | — | — | **`todo!()` panic** | n/a | `raw/11` |
| **rudof-wasm — before** | **@kanzo-tech/rudof-wasm@0.3.4** | **JS ABI (`message`)** | **❌ no — `string[]`** | 3 of 3, **indistinguishable** | **none possible** | n/a (binding) | `raw/12` |
| **rudof-wasm — after** | **@kanzo-tech/rudof-wasm@0.3.5** | **JS ABI (`message`)** | **✅ yes — `{value, language}[]`** | 3 of 3 | consumer picks by locale | n/a (binding) | `raw/13` |

**Every RDF validation report tested is conformant with §2.1.5.** No validator
we ran drops a language tag from the results graph, and none picks one language
over another in that graph.

---

## Row notes

### pySHACL 0.40.1 — the `table` renderer picks at random

`-f turtle` and `-f human` both emit all three messages; `-f human` prints them
on three `Message:` lines without their tags, which loses the tag but not the
text. `-f table` prints exactly **one**, and we could not find a rule behind the
choice. Twelve runs per input (`raw/14`):

| Shapes graph (document order of the messages) | en | es | ca | de | zz |
|---|---|---|---|---|---|
| `shapes.ttl` (en, es, ca) | 6 | 2 | 4 | – | – |
| `probe-no-en.ttl` (ca, es, de) | – | 4 | 3 | 5 | – |
| `probe-en-last.ttl` (zz, es, en) | 4 | 3 | – | – | 5 |

The choice is not locale-aware (it does not prefer `@en`; it happily prints
`@de` or the nonsense tag `@zz`), not document order, and **not stable between
runs of the same command on the same input** — consistent with iteration over
an rdflib term set under Python's randomised string hashing. A user re-running
the same validation can be shown a different language each time, in a format
that does not say which language it is.

The counts above are one run of `run.sh` — the committed `raw/14`. They are
themselves random, and re-running the harness redistributes them (an earlier run
of the same 12×3 gave 3/5/4, 2/5/5 and 3/5/4 for the same three rows). What
reproduces is the *shape* of the result: every language present appears, none
dominates, and no run of twelve is the same as another. Reviewers re-running
`run.sh` should expect different counts and the same conclusion.

This is a rendering defect, not a spec violation, and we present it as such.

### Apache Jena SHACL 6.2.0 — conformant, and tags visible in `--text`

The only tested CLI whose *text* output keeps the tags, printing the messages as
a bracketed list `["…"@ca,"…"@es,"…"@en]`. Order was identical across three runs.
No negotiation: it shows all three and leaves the reader to choose.

### TopBraid SHACL API 1.4.4 — conformant

The reference implementation (Holger Knublauch, spec editor). Its report body is
byte-identical to Jena's — the two files differ only in the prefix block, TopBraid
declaring `dash:`, `tosh:` and friends — which is unsurprising, since TopBraid's
API runs on Jena (it bundles `jena-arq-5.2.0`). Read the two rows as one engine
family with two front ends, not as two independent confirmations.
`shaclvalidate.sh` exits `1` on non-conformance, which is a CLI convention, not
an error. Tested via the
Maven Central binary distribution (`sha256 f382585d…`); we have no TopBraid EDG
licence and did not test the commercial product.

### rdf-validate-shacl 0.6.5 — conformant, and the JS binding keeps the terms

The one JS validator that models messages as RDF/JS `Literal` terms rather than
strings, so `result.message[i].language` is available to the caller. This is the
design our fork adopted for the wasm ABI. Requires `@zazuko/env-node` (3.1.0
tested) as its factory; the bare `rdf-ext` factory lacks the `clownface` method
the validator calls, so a naive install fails at construction.

### rudof — the before/after, and where the loss actually was

The interesting detail is **which layer lost the tag**. It was not the engine.

The Rust core keeps messages in a map keyed by `Option<Lang>`, and both the
upstream CLI's Turtle report and its `--details` table print all three with
their tags (`raw/09`, `raw/10`). The loss was in the **WASM ABI serializer**:
`result_to_dto` in `rudof_wasm/src/validate.rs` called
`r.message().messages().values()`, taking the map's values and discarding the
keys that held the tags. Everything downstream of the JavaScript boundary — the
entire React form — received `string[]`, three sentences with no way to tell
Catalan from Spanish. The fix (fork commit `3fda6b26b`, shipped in
`@kanzo-tech/rudof-wasm@0.3.5`) preserves the key: `message` is now
`{ value, language }[]`, with untagged entries carrying `language: ""`.

```jsonc
// @kanzo-tech/rudof-wasm@0.3.4 — published 2026-06-30
"message": [
  "Un conjunto de datos debe tener un identificador.",
  "MinCount(1) not satisfied",
  "Un conjunt de dades ha de tenir un identificador.",
  "A dataset must have an identifier."
]

// @kanzo-tech/rudof-wasm@0.3.5 — published 2026-08-27
"message": [
  { "value": "Un conjunt de dades ha de tenir un identificador.", "language": "ca" },
  { "value": "A dataset must have an identifier.",                "language": "en" },
  { "value": "MinCount(1) not satisfied",                         "language": ""   },
  { "value": "Un conjunto de datos debe tener un identificador.", "language": "es" }
]
```

Both packages are on npm and can be installed side by side:
`@kanzo-tech/rudof-wasm@0.3.4` (`sha512-ptA6/I5/yBIe…`, 2026-06-30T11:57:51Z) and
`@kanzo-tech/rudof-wasm@0.3.5` (`sha512-G+rKIn0jHjHE…`, 2026-08-27T12:19:14Z).
These are the only two versions published.

**Two things this row does not let us claim.** First, the loss was in *our*
binding, not in rudof's engine, so it is evidence that a language binding is a
place tags get dropped — not that rudof was broken. Second, the fix is the
*precondition* for locale selection, not the selection itself; picking the right
message is still the form's job.

### Where rudof is itself not conformant, and we should say so

Both rudof versions add an engine-generated message —
`"MinCount(1) not satisfied"` — to a result whose shape already declares three
`sh:message` values. §2.1.5 says such a result will have **exactly** the shape's
messages, and §3.6.2.7 permits an engine-generated message only "in cases where
a constraint does not have any values for `sh:message`". Emitting both is
outside what the spec allows, in the upstream CLI's Turtle report (`raw/09`) as
well as in the wasm ABI. It is a small defect and it is ours to fix, not
someone else's; the 0.3.5 ABI at least tags it `language: ""` so a consumer can
exclude it from a locale choice rather than have it shadow a localised message.

Two further rudof 0.3.14 observations, recorded because they are facts about the
current published version: the default `compact` renderer has a `Details` column
that stays empty, so `rudof validate -M shacl` shows **no message at all** unless
`-r details` is passed; and `-r json` panics on an unimplemented branch
(`serialize_shacl_validation_results.rs:42`) rather than returning an error.
Neither bears on language tags.

Finally, **order is not stable anywhere in rudof** — neither the order of results
in a report nor the order of messages within one result, in the CLI's Turtle and
`--details` output as well as in the wasm ABI. The *set* is stable (`raw/15`,
8 runs, identical), so nothing is lost; but a consumer must not treat
`message[0]` as meaningful, and our runner sorts by path so the committed dumps
stay comparable. Re-running `run.sh` reorders `raw/09` and `raw/10` without
changing their content.

---

## The finding that carries §5 — the conformance suite never asks

`raw/16`, regenerated from `w3c/data-shapes` @ `d4756bf2` (2026-08-26), parsed
with rdflib rather than grepped, counting **subjects**:

| | SHACL 1.0 suite | SHACL 1.2 suite |
|---|---|---|
| test graphs parsed | 150 | 426 |
| subjects carrying ≥1 `sh:message` | 9 | 8 (+1, see caveat) |
| subjects carrying **>1** `sh:message` value | **0** | **0** |
| subjects with a language-tagged `sh:message` | 1 | 1 (+1) |
| subjects with **two or more distinct languages** | **0** | **0** |

The one language-tagged test is `core/misc/message-001`, whose whole content is
a single `sh:message "Test message"@en` and an expected report containing the
same literal. Its own comment says what it is for:

> Note: This test verifies that the sh:message is copied into sh:resultMessage.

SHACL 1.2 adds `core/misc/message-002`, the same assertion through RDF 1.2
reifier syntax — `sh:datatype xsd:integer {| sh:message "Test message"@en |}`.
Still one message, still one language.

So an implementation can pass the entire approved conformance suite while
handling exactly one message in exactly one language. Every implementation we
tested does better than that in its RDF report — but nothing in the process
required it to, and in the layers with no test at all (renderers, bindings) the
behaviour is inconsistent, undocumented and, in pySHACL's table, random.

That is the argument §5 should make: not that the ecosystem is broken, but that
the multilingual half of `sh:message` is **unverified**, and unverified
behaviour is what a data space cannot build on. A profile author in Catalonia
choosing whether to write `sh:message` in three languages has no way to know
whether it will reach a user — and E1's finding that the official Health-RI
profile carries 321 `@en` tags and no other language is what that uncertainty
looks like downstream.

---

## Method

1. Author one shapes graph and one data graph (above), deliberately tiny so they
   fit in the paper. C1 exercises the multilingual case, C2 the untagged control
   that shows a validator is not simply dropping every message.
2. Install each validator at a pinned version into a scratch tree, run the same
   two files through it, and capture **every** output format it offers — because
   the spec constrains the RDF report and users read the renderer, and those can
   disagree.
3. Where a renderer emits one message out of several, vary the input to find the
   selection rule: remove `@en` to test for a hard-coded English preference,
   reorder the messages to test for document order, and repeat each run twelve
   times to test for stability.
4. Grade the RDF report against SHACL §2.1.5 / §3.6.2.7, and grade renderers and
   bindings separately as usability, saying which is which.
5. Count what the W3C conformance suites actually test, by parsing them.

Reproduce with `../run.sh`. It installs everything (pySHACL via `uv`, Jena via
`brew`, TopBraid from Maven Central with a checksum, the npm packages, `rudof`
via `cargo install`), writes `raw/00-environment.txt` and re-derives every file
in `raw/`. Set `E3_WORK` to keep the installs between runs.

### Environment (`raw/00-environment.txt`)

```
Darwin 25.2.0 arm64
Python 3.14.5          pySHACL 0.40.1, rdflib 7.6.0
node v23.9.0           rdf-validate-shacl 0.6.5, @zazuko/env-node 3.1.0
openjdk 26.0.2         Apache Jena SHACL 6.2.0
                       org.topbraid:shacl:1.4.4 (sha256 f382585d…)
rudof 0.3.14 (crates.io rudof_cli, upstream)
@kanzo-tech/rudof-wasm 0.3.4 and 0.3.5
```

---

## Threats to validity, and what we could not test

**Validators we could not run.**

- **TopBraid EDG / TopBraid Composer** — the commercial products. We tested the
  open-source `org.topbraid:shacl` API, which is the engine behind them, but we
  hold no licence and cannot speak for the products' own UI rendering. Since
  their UI is precisely the kind of surface where we found divergence, this is a
  real gap.
- **SHACL validators behind hosted services** (e.g. portal-side validation in
  data.europa.eu) — not installable, versions not published, so out of scope.
- **Older versions of the validators tested.** We ran current stable releases
  only. It is entirely possible that a 2019 pySHACL flattened tags; testing an
  old version to make the claim land would be cherry-picking, and we did not.
  The claim is about the ecosystem as it is today.
- **`-r json` for the rudof CLI**, which panics; there is nothing to grade.

**Four independent engines, one shapes graph.** Five products, but TopBraid's API
is built on Jena and returns the same report, so the table's rows are not five
independent confirmations — they are pySHACL (rdflib), the Jena family, 
rdf-validate-shacl and rudof. We tested one constraint type carrying three
languages. We did not sweep constraint components, nor SHACL-SPARQL
messages with `{?var}` substitution, where the interaction between substitution
and language tags is a plausible second failure mode we have not looked at.

**The non-determinism finding is platform-conditional.** pySHACL's random
selection depends on Python's hash randomisation, which is on by default but can
be disabled with `PYTHONHASHSEED`. On a runner that pins the seed the choice
would be stable — arbitrary, but stable. We report it as observed with default
settings, which is what a user gets.

**We are not disinterested.** This experiment exists to justify a fork we
maintain, and the one clear "before" failure in the table is our own package.
That cuts both ways: it is the reason to be careful about the claim, and it is
also why the table reports our own spec violation (the extra engine message)
alongside everyone else's clean results. Reviewers can re-run `run.sh`.

**We reported nothing upstream yet.** If §5 is going to observe that pySHACL's
table renderer is non-deterministic, an issue on `RDFLib/pySHACL` should be
filed before the camera-ready, and the paper should cite it. Same for the rudof
`compact` renderer's empty `Details` column and the `-r json` panic. Publishing
a defect at a community venue without having told the maintainers first is not
how we want to do this.
