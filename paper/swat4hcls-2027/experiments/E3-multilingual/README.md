# E3 — Does a lang-tagged `sh:message` survive to the consumer?

Spec: `~/dev/kanzo/papers/swat4hcls2027/EVIDENCE.md`, §E3.

- `data/` — the test shapes and data graphs, plus three probes (committed)
- `runners/` — the two Node runners the harness calls
- `run.sh` — installs six pinned validators and regenerates everything in `results/raw/`
- `results/message-langtags.md` — **the writeup → Tab. 2**
- `results/raw/` — every raw validator output, committed

## Status

**Done — 2026-08-27.** Six validators run, all outputs committed.
**The claim as originally written does not survive the experiment.** See below.

## How to reproduce

```sh
./run.sh                 # installs into a temp dir, then runs everything
E3_WORK=~/e3 ./run.sh    # keep the installs between runs
```

Prerequisites: `python3` + `uv`, `node` + `npm`, `java`, `brew`, `curl`, `cargo`.
The script pins every version, checksums the TopBraid download, records the
environment to `results/raw/00-environment.txt`, and rewrites all of
`results/raw/`. Installs are skipped when already present.

## Findings

### 1. Our claim was wrong, and the paper must be rewritten around what is true

The claim under test was *"multilingual SHACL is specified but not implemented
by validators — `sh:message` with language tags gets flattened or dropped."*

It is false. **Every** validator tested emits a fully conformant RDF validation
report carrying all three languages with tags intact: pySHACL 0.40.1, Apache
Jena 6.2.0, TopBraid SHACL API 1.4.4, rdf-validate-shacl 0.6.5 and rudof 0.3.14
— four independent engines across five products. Nobody drops a tag from the
results graph. **Do not write the sentence in §5 as drafted.**

### 2. What is true, and is a better paper argument anyway

**The multilingual case is untested by the W3C conformance suites.** Across the
SHACL 1.0 suite (150 test graphs) and the SHACL 1.2 suite (426), **zero**
subjects carry two or more `sh:message` values. Exactly one subject in each
carries a language tag at all — `core/misc/message-001`, a lone `@en` message.
An implementation can pass the whole approved suite while handling one message
in one language.

**Behaviour diverges exactly where the suite does not reach** — the renderers
and language bindings a consumer actually reads:

- pySHACL's `-f table` prints **one** message of the three, chosen
  **non-deterministically**: over 12 runs of the identical command it printed
  `@en` 6×, `@ca` 4×, `@es` 2× — and a re-run redistributes them. Not
  locale-aware (it will print `@de` or a nonsense `@zz` tag over `@en`), not
  document order, not stable between runs. Expect different counts on re-run
  and the same conclusion.
  This is a rendering defect, not a spec violation, and we report it as such.
- The upstream `rudof` CLI's default `compact` renderer prints **no message at
  all**; `-r details` prints all three with their tags; `-r json` panics on an
  unimplemented branch.
- Our own `@kanzo-tech/rudof-wasm@0.3.4` flattened all messages to `string[]` at
  the JavaScript boundary — three sentences with no way to tell Catalan from
  Spanish.

**Nobody negotiates.** Not one of the five picks a message for a requested
locale. That job is left entirely to the consumer, which is the job a form has
to do — and the reason the ABI must carry the tag.

### 3. The rudof before/after, told accurately

The loss was **not in the engine**. rudof's Rust core keys messages by
`Option<Lang>` and its CLI has always printed the tags. The loss was in the
**wasm ABI serializer**, which took the map's values and discarded its keys.
Fork commit `3fda6b26b` preserves them; `message` changes from `string[]` to
`{ value, language }[]`. Published as `@kanzo-tech/rudof-wasm@0.3.5`
(2026-08-27), against `0.3.4` (2026-06-30). Both are on npm and install side by
side; `run.sh` runs the same input through both.

So the fork is still justified — but as *"a language binding is a place tags get
dropped, and ours dropped them"*, not *"the ecosystem is broken"*.

### 4. Where rudof is itself non-conformant — ours to fix

Both rudof versions add an engine message (`"MinCount(1) not satisfied"`) to a
result whose shape already declares three `sh:message` values. §2.1.5 says such
a result carries **exactly** the shape's messages, and §3.6.2.7 permits a
generated message only when the constraint has none. This appears in the
upstream CLI's Turtle report too. Small, real, and ours.

## Follow-ups before camera-ready

- [ ] Rewrite §5 around "unverified, not unimplemented". The E1 finding that the
      official Health-RI profile carries 321 `@en` tags and no other language is
      what that uncertainty looks like downstream — that is the link to make.
- [ ] File the pySHACL table non-determinism upstream (`RDFLib/pySHACL`) and
      cite the issue. Publishing a defect at the maintainers' own community
      venue without telling them first is not how we want to do this.
- [ ] Fix rudof's extra engine message when a shape declares its own (§2.1.5),
      and the empty `Details` column in `-r compact`.
- [ ] Optional: test SHACL-SPARQL `sh:message` with `{?var}` substitution — a
      plausible second failure mode we did not look at.
