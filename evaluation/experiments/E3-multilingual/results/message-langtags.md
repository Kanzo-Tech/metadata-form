# E3 — Does a lang-tagged `sh:message` survive to the consumer?

Re-run 2026-09-02 (`../run.sh`, `raw/00`-`16`); current-engine check 2026-09-30
(`../run-current.sh`, `raw/17`-`20`). Every number below is produced by one of
them; the raw output is in `raw/`, referenced per row. No third-party SHACL validator is
involved in any number on this page.

---

## Headline

**The multilingual half of `sh:message` is unverified by the W3C conformance
suites.** Across the SHACL 1.0 suite (150 test graphs) and the SHACL 1.2 suite
(426), **not one** subject carries two or more `sh:message` values. Exactly one
subject in each suite carries a language tag at all, and it is a single `@en`
message. An implementation can pass the entire approved suite while handling one
message in one language.

That is a fact about the suites, not about anybody's software. It says the
behaviour is **unconstrained by the conformance process** — never asked about,
so never guaranteed.

**And ours was in fact wrong there, until we fixed it.**
`@kanzo-tech/rudof-wasm@0.3.4` flattened every `sh:message` to a bare string at
the wasm ABI boundary, discarding the tag; `0.3.5` preserves it. That is the
worked example of the risk, evidenced on the one implementation we can speak
for.

So the framing for §5 is: *"the conformance suite never asks a validator to
handle more than one language, so what happens in the layers it does not reach
is nobody's promise — and in our own binding, the tag was being dropped."*

---

## Provenance, and a claim this experiment no longer makes

The claim we originally drafted was: *"multilingual SHACL is specified but not
implemented by validators — `sh:message` with language tags gets flattened or
dropped."*

An earlier round of this experiment (2026-08-27) tested that claim by running
the same shapes and data through four third-party SHACL products alongside
rudof. **The round refuted the claim**: we did not find the failure we had
assumed, and the drafted sentence was wrong.

Those runs have been removed from `run.sh` and from `raw/`. A survey of other
people's validators, published at those maintainers' own community venue, is not
what this paper is for — and that holds whichever way the survey came out.
**The paper therefore makes no claim about other implementations at all.** No
per-product behaviour is named, graded or tabulated here.

**What that costs, stated plainly.** E3 no longer has evidence about how widely
multilingual `sh:message` is handled in practice. We can say the conformance
suites do not test it, and we can say our own binding got it wrong; we cannot
say anything about how common that is. That is a weaker claim than the one the
draft made, and §5 must not recover the stronger one by implication — not with
"validators may…", not with "in practice…", not with an unsourced aside. Where
the reader wants to know how the rest of the ecosystem behaves, the honest
answer is that this paper does not measure it.

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
  against the spec, and grade the rendering and binding layers separately, as
  usability.
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
`probe-data.ttl`) existed to determine on what basis a third-party renderer that
shows one message picked it. They were inputs to the removed round only, and
have been deleted with it.

---

## The finding that carries §5 — the conformance suite never asks

`raw/16`, regenerated from `w3c/data-shapes` @ `b7844c77` (2026-09-01), parsed
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
Still one message, still one language. It is the `+1` in the table: rdflib 7.6.0
cannot parse RDF 1.2 reifier syntax, so `run.sh` prints it as skipped and we
read it by hand. Nineteen graphs of the 1.2 suite are skipped for that reason
(none in the 1.0 suite). `run.sh` greps every one of them for the literal string
`sh:message` and prints the counts at the foot of `raw/16`: **only
`message-002.ttl` matches at all** — three occurrences, being the one
`sh:message` triple and two mentions in the test's own `rdfs:comment`. The other
eighteen contain none, so excluding them costs the count nothing.

So an implementation can pass the entire approved conformance suite while
handling exactly one message in exactly one language. Nothing in the process
requires more. What an implementation does with a second language is not a
conformance question at all — it is a choice nobody checks.

That is the argument §5 should make: not that the ecosystem is broken, but that
the multilingual half of `sh:message` is **unverified**, and unverified
behaviour is what a data space cannot build on. A profile author in Catalonia
choosing whether to write `sh:message` in three languages has no way to know
whether it will reach a user — and E1's finding that the official Health-RI
profile carries 321 `@en` tags and no other language is what that uncertainty
looks like downstream.

**This number did not move.** The re-run picked up a newer upstream head
(`b7844c77`, 2026-09-01) than the first round (`d4756bf2`, 2026-08-26). All five
counts in each column are identical. The only change in `raw/16` is that
`sparql/rules/run-once-example.ttl` was renamed upstream to
`inference-rules/run-once-example.ttl`; it carries no `sh:message` and it is
unparseable by rdflib in both revisions, so it appears in the skip list either
way.

---

## Tab. 2 — where a language tag survives, in rudof

Only rudof surfaces. Test input as above: one constraint carrying `@en` + `@es`
+ `@ca`, one carrying an untagged message. "Surface" is the output the row
grades. **Tags kept** = the language tag is recoverable by the consumer.
**Languages emitted** = how many of the three reach the consumer.

| Build | Version | Surface graded | Tags kept | Languages emitted | Conformant (§2.1.5) | Raw |
|---|---|---|---|---|---|---|
| rudof CLI (upstream) | 0.3.14 | RDF report (`-r turtle`) | yes | 3 of 3 | near — see note | `raw/09` |
| rudof CLI (upstream) | 0.3.14 | table (`-r compact`, default) | n/a | **0 of 3** | n/a (rendering) | `raw/08` |
| rudof CLI (upstream) | 0.3.14 | table (`-r details`) | yes (`es:`/`en:`/`ca:`) | 3 of 3 | n/a (rendering) | `raw/10` |
| rudof CLI (upstream) | 0.3.14 | JSON (`-r json`) | — | — | `todo!()` panic | `raw/11` |
| **rudof-wasm — before** | **@kanzo-tech/rudof-wasm@0.3.4** | **JS ABI (`message`)** | **no — `string[]`** | 3 of 3, **indistinguishable** | n/a (binding) | `raw/12` |
| **rudof-wasm — after** | **@kanzo-tech/rudof-wasm@0.3.5** | **JS ABI (`message`)** | **yes — `{value, language}[]`** | 3 of 3, plus one untagged engine message | n/a (binding) | `raw/13` |
| **rudof-wasm — current** | **@kanzo-tech/rudof-wasm@0.3.10** | **JS ABI (`message`)** | **yes — `{value, language}[]`** | 3 of 3, **exactly** the author's | yes | `raw/17` |
| **rudof-wasm — current, no author message** | **@kanzo-tech/rudof-wasm@0.3.10** | **JS ABI (`message`)** | **yes** | engine-generated, **en, es and ca** | permitted (§3.6.2.7) | `raw/18` |

The engine never lost a tag. The default CLI renderer never shows one, and our
own JavaScript binding used to destroy one. Neither of those is a spec
violation; both are places a real consumer stops being able to pick a language.

---

## Row notes

### rudof — the before/after, and where the loss actually was

The interesting detail is **which layer lost the tag**. It was not the engine.

The Rust core keeps messages in a map keyed by `Option<Lang>`, and both the
upstream CLI's Turtle report and its `-r details` table print all three with
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

Both versions are on npm and can be installed side by side; `run.sh` installs
each into its own tree and runs the same input through both.

**The fix has shipped in every release since 0.3.5.** `raw/00` records the
package's full published history rather than leaving it to be hand-typed: the
published versions are 0.3.4 to 0.3.10 (`raw/20`), `latest` is **0.3.10**, and
0.3.4 is the only one that lacks the tags. The 0.3.4/0.3.5 pair in the table is
the before/after; the current package (0.3.10) carries the tags.

**Two things this row does not let us claim.** First, the loss was in *our*
binding, not in rudof's engine, so it is evidence that a language binding is a
place tags get dropped — not that rudof was broken, and certainly not that
anyone else's binding does the same. Second, the fix is the *precondition* for
locale selection, not the selection itself; picking the right message for the
reader is still the form's job.

### Where rudof was not conformant, and what the current engine does

Both pinned builds (0.3.4 and 0.3.5) add an engine-generated message —
`"MinCount(1) not satisfied"` — to a result whose shape already declares three
`sh:message` values. §2.1.5 says such a result will have **exactly** the shape's
messages, and §3.6.2.7 permits an engine-generated message only "in cases where
a constraint does not have any values for `sh:message`". Emitting both is
outside what the spec allows, in the upstream CLI's Turtle report (`raw/09`) as
well as in those two wasm builds. It was a small defect and ours to fix; the
0.3.5 ABI at least tagged it `language: ""` so a consumer could exclude it.

**It is fixed in the engine we ship.** With `@kanzo-tech/rudof-wasm@0.3.10`
(`raw/17`, and the assertions in `raw/19`, written by `../run-current.sh`):

- a result whose shape declares `sh:message` carries **exactly** those messages —
  three, tagged `ca`/`en`/`es`, for C1, and the single untagged message for the
  control C2 — and no engine text;
- a result whose shape declares **none** (`../data/shapes-nomsg.ttl`, `raw/18`)
  carries engine-generated messages in **en, es and ca**, each tagged, drawn from
  an RDF catalog of `sh:message` templates on the constraint components (e.g.
  `en: At least 1 value(s) required`, `es: Se requieren al menos 1 valor(es)`,
  `ca: Calen com a mínim 1 valor(s)` for `sh:minCount`). §3.6.2.7 permits this.

The upstream CLI 0.3.14 still shows the old behaviour (`raw/09`; not re-run).

Two further rudof 0.3.14 observations, recorded because they are facts about the
current published version: the default `compact` renderer has a `Details` column
that stays empty, so `rudof validate -M shacl` shows **no message at all** unless
`-r details` is passed (`raw/08`); and `-r json` panics on an unimplemented
branch (`serialize_shacl_validation_results.rs:42`) rather than returning an
error (`raw/11`). Neither bears on language tags.

Finally, **order is not stable anywhere in rudof** — neither the order of results
in a report nor the order of messages within one result, in the CLI's Turtle and
`-r details` output as well as in the wasm ABI. The *set* is stable (`raw/15`,
8 runs, identical), so nothing is lost; but a consumer must not treat
`message[0]` as meaningful, and our runner sorts by path so the committed dumps
stay comparable. Re-running `run.sh` reorders `raw/08`, `raw/09` and `raw/10`
without changing their content — the 2026-09-02 re-run did exactly that, and
nothing else.

### rudof does not negotiate, and nor should it

Neither the CLI nor the wasm ABI selects a message for a requested locale: both
hand over the whole set. We think that is right — the engine cannot know the
reader's locale, so its job is to preserve the tags and let the consumer choose.
That is precisely why the ABI has to carry the tag, and why 0.3.4 made the
consumer's job impossible. We make no claim about whether other implementations
negotiate.

---

## Method

1. Author one shapes graph and one data graph (above), deliberately tiny so they
   fit in the paper. C1 exercises the multilingual case, C2 the untagged control
   that shows an implementation is not simply dropping every message.
2. Install both pinned `@kanzo-tech/rudof-wasm` builds side by side and the
   pinned upstream `rudof` CLI, run the same two files through each, and capture
   **every** output format offered — because the spec constrains the RDF report
   and users read the renderer, and those can disagree.
3. Grade the RDF report against SHACL §2.1.5 / §3.6.2.7, and grade renderers and
   bindings separately as usability, saying which is which.
4. Count what the W3C conformance suites actually test, by parsing every test
   graph with rdflib. rdflib is an RDF toolkit, not a SHACL engine; it reads
   Turtle and nothing more.
5. Re-run the wasm probe eight times to confirm the message *set* is stable even
   though its order is not.

Reproduce with `../run.sh`. It installs everything (rdflib via `uv`, the npm
packages, `rudof` via `cargo install`), writes `raw/00-environment.txt` and
re-derives every file in `raw/`. Set `E3_WORK` to keep the installs between runs.

### Environment (`raw/00-environment.txt`)

```
Darwin 25.2.0 arm64
Python 3.13.12         rdflib 7.6.0 (pinned directly; W3C-suite parsing only)
node v23.9.0
rudof 0.3.14 (crates.io rudof_cli, upstream)
@kanzo-tech/rudof-wasm 0.3.4 and 0.3.5 (run.sh, 2026-09-02; published then: 0.3.4 … 0.3.8)
@kanzo-tech/rudof-wasm 0.3.10 (run-current.sh, 2026-09-30; published: 0.3.4 … 0.3.10; latest 0.3.10)
```

Two environment lines moved between the 2026-08-27 round and the 2026-09-02
re-run, and neither affects a result. Python is 3.13.12 rather than 3.14.5,
because the venv is now created for `rdflib` alone and `uv` picked a different
default interpreter; rdflib itself is pinned at the same 7.6.0 it was before, so
the suite parse is unchanged (and `raw/16` confirms it — identical counts). The
per-package version lines for the four removed products are gone with them.

---

## Threats to validity, and what we could not test

**We measure the suites and ourselves, and nothing else.** This is the largest
limitation and it is deliberate. E3 has no evidence about how any other SHACL
implementation handles a multilingual `sh:message`, in either direction. A
reader who wants to know whether the problem we found in our own binding is
common will not find the answer here, and §5 must not imply one.

**One shapes graph, one constraint type.** Three languages on a single
`sh:minCount`, plus an untagged control. We did not sweep constraint components,
nor SHACL-SPARQL messages with `{?var}` substitution, where the interaction
between substitution and language tags is a plausible second failure mode we
have not looked at.

**The corpus count is a count of the suites, not of the world.** It shows the
conformance process does not exercise the multilingual case. It does not show
that implementations therefore get it wrong — only that nothing obliges them to
get it right, which is a claim about assurance, not about quality.

**The `+1` rows are read by hand.** rdflib 7.6.0 cannot parse the RDF 1.2
reifier syntax in `shacl12-test-suite/core/misc/message-002.ttl`, so that file is
skipped by the parser and counted manually: one `sh:message`, one language. It
would not change any of the zeros. `run.sh` greps all nineteen skipped files for
`sh:message` and prints the result in `raw/16`, so a reviewer does not have to
take the exclusion on trust — the other eighteen contain none.

**We are not disinterested.** This experiment exists to justify a fork we
maintain, and the one clear "before" failure in the table is our own package.
That is also why the table reports our own spec violation — the extra engine
message — rather than only the fix. Reviewers can re-run `run.sh`.

**Third-party defects we observed are not reported here, and are not the
paper's to publish.** Anything the removed round turned up is a courtesy to be
raised with those maintainers directly, not a paper artefact.
