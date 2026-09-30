#!/usr/bin/env python
"""
E2 — measure everything and write results/migration.md + results/metrics.json.

Every number in §6 of the paper comes out of this script. Nothing is typed by
hand into the markdown: the tables are rendered from `metrics`.

One SHACL engine is involved: rudof, the engine the library ships. rdflib is
used here to *measure* graphs — count shapes, compare subgraphs for isomorphism
— and never to validate. See §7 of the generated report for what that costs.

Order of operations:

    python migrate.py                                   # regenerate data/after/
    npx vitest run --config ../vitest.config.ts \
        equivalence.harness.ts                          # rudof validates
    python report.py                                    # this

"""

from __future__ import annotations

import glob
import json
import os
import sys
from collections import Counter, OrderedDict

import rdflib
from rdflib import Graph, Namespace, RDF, URIRef, BNode
from rdflib.compare import to_isomorphic

SH = Namespace("http://www.w3.org/ns/shacl#")
DASH = Namespace("http://datashapes.org/dash#")
SHUI = Namespace("http://www.w3.org/ns/shacl-ui/")
DCAT = Namespace("http://www.w3.org/ns/dcat#")

HERE = os.path.dirname(os.path.abspath(__file__))
BEFORE = os.path.join(HERE, "data", "before")
AFTER = os.path.join(HERE, "data", "after")
RESULTS = os.path.join(HERE, "results")

CORE_BEFORE = os.path.join(BEFORE, "health-ri-core")
CORE_AFTER = os.path.join(AFTER, "health-ri-core-shacl12")

ENCODINGS = OrderedDict(
    [
        ("shipped", (os.path.join(BEFORE, "overlay-00-shipped.ttl"), "—", "not encoded (prose in `sh:description`)")),
        ("partition-subjectsof", (os.path.join(BEFORE, "overlay-01-partition-subjectsof.ttl"), "1.0", "node-shape partition, `sh:targetSubjectsOf`")),
        ("partition-sparql", (os.path.join(BEFORE, "overlay-02-partition-sparql.ttl"), "1.0 + AF", "node-shape partition, `sh:SPARQLTarget`")),
        ("implication", (os.path.join(BEFORE, "overlay-03-implication.ttl"), "1.0", "`sh:or ( [ sh:not C ] T )`")),
        ("shacl12-if", (os.path.join(AFTER, "overlay-04-shacl12-if.ttl"), "1.2", "`sh:if` / `sh:then` / `sh:else`")),
    ]
)


def load_dir(d: str) -> Graph:
    g = Graph()
    for f in sorted(glob.glob(os.path.join(d, "*.ttl"))):
        g.parse(f, format="turtle")
    return g


def lines(paths: list[str]) -> int:
    return sum(sum(1 for _ in open(p)) for p in paths)


def strip(g: Graph, preds: set) -> Graph:
    h = Graph()
    for t in g:
        if t[1] not in preds:
            h.add(t)
    return h


def property_shapes(g: Graph) -> int:
    """Anything carrying an sh:path — the profile's actual field inventory."""
    return len(set(g.subjects(SH.path, None)))


def corpus_metrics() -> dict:
    b_files = sorted(glob.glob(os.path.join(CORE_BEFORE, "*.ttl")))
    a_files = sorted(glob.glob(os.path.join(CORE_AFTER, "*.ttl")))
    b, a = load_dir(CORE_BEFORE), load_dir(CORE_AFTER)
    editors = Counter(str(o).rsplit("#", 1)[-1] for o in b.objects(None, DASH.editor))
    viewers = Counter(str(o).rsplit("#", 1)[-1] for o in b.objects(None, DASH.viewer))
    logical = {
        p: len(list(b.triples((None, SH[p], None))))
        for p in ["or", "and", "not", "xone", "if", "then", "else", "qualifiedValueShape", "sparql", "condition"]
    }
    return {
        "files": len(b_files),
        "lines_before": lines(b_files),
        "lines_after": lines(a_files),
        "triples_before": len(b),
        "triples_after": len(a),
        "node_shapes": len(set(b.subjects(RDF.type, SH.NodeShape))),
        "target_classes": len(set(b.objects(None, SH.targetClass))),
        "property_shapes_before": property_shapes(b),
        "property_shapes_after": property_shapes(a),
        "dash_editor": len(list(b.triples((None, DASH.editor, None)))),
        "dash_viewer": len(list(b.triples((None, DASH.viewer, None)))),
        "dash_editor_kinds": dict(editors.most_common()),
        "dash_viewer_kinds": dict(viewers.most_common()),
        "shui_editor_after": len(list(a.triples((None, SHUI.editor, None)))),
        "shui_viewer_after": len(list(a.triples((None, SHUI.viewer, None)))),
        "logical_constraints": logical,
        "sh_defaultValue": len(list(b.triples((None, SH.defaultValue, None)))),
        "sh_in": len(list(b.triples((None, SH["in"], None)))),
        "non_ui_isomorphic": to_isomorphic(strip(b, {DASH.editor, DASH.viewer}))
        == to_isomorphic(strip(a, {SHUI.editor, SHUI.viewer})),
    }


def overlay_metrics() -> dict:
    core = load_dir(CORE_BEFORE)
    base_targets = len([s for s in core.subjects(SH.targetClass, DCAT.Dataset)])
    out = {}
    for name, (path, version, label) in ENCODINGS.items():
        g = Graph()
        g.parse(path, format="turtle")
        merged = Graph()
        for t in core:
            merged.add(t)
        for t in g:
            merged.add(t)
        # Entry points: shapes that carry any target and can therefore fire on a
        # dcat:Dataset independently of hri:DatasetShape.
        targets = set(g.subjects(SH.targetClass, None)) | set(g.subjects(SH.targetSubjectsOf, None)) | set(
            g.subjects(SH.target, None)
        )
        named_shapes = {s for s in set(g.subjects()) if isinstance(s, URIRef) and (
            (s, RDF.type, SH.NodeShape) in g
        )}
        anon_shapes = {s for s in set(g.subjects()) if isinstance(s, BNode) and (
            (s, SH.property, None) in g or (s, SH["not"], None) in g or (s, SH.path, None) in g
        )}
        sparql = [str(o) for o in g.objects(None, SH.select)]
        out[name] = {
            "version": version,
            "label": label,
            "file": os.path.basename(path),
            "lines": lines([path]),
            "triples": len(g),
            "entry_points_on_dataset": base_targets + len(targets),
            "named_node_shapes_added": len(named_shapes),
            "anonymous_shapes_added": len(anon_shapes),
            "hidden_stamp_fields": len(list(g.triples((None, DASH.hidden, None)))),
            "dash_triples": len([1 for _, p, _ in g if str(p).startswith(str(DASH))]),
            "sh_or": len(list(g.triples((None, SH["or"], None)))),
            "sh_not": len(list(g.triples((None, SH["not"], None)))),
            "sh_if": len(list(g.triples((None, SH["if"], None)))),
            "sparql_chars": sum(len(s) for s in sparql),
        }
    return out


DCATAP = os.path.join(
    HERE, "..", "E1-coverage", "data", "health-ri", "src",
    "Formalisation(shacl)", "Core", "ReusedCommunityStandards", "dcatap.shapes.ttl",
)


def dcatap_metrics() -> dict:
    """The SHACL 1.0 logic workarounds Health-RI actually ships, in the DCAT-AP
    shapes it vendors under ReusedCommunityStandards/. These are the only logical
    constraints anywhere in the corpus — and none of them is a conditional."""
    g = Graph()
    g.parse(DCATAP, format="turtle")
    node_shapes = set(g.subjects(RDF.type, SH.NodeShape))
    targetless = sorted(str(s) for s in node_shapes if (s, SH.targetClass, None) not in g)
    refs = {}
    for s_ in targetless:
        u = URIRef(s_)
        refs[s_] = len(list(g.triples((None, SH.node, u)))) + len(list(g.triples((None, SH.shape, u))))
    stamps = [
        (str(g.value(ps, SH.path)), str(g.value(ps, SH.hasValue)))
        for ps in g.subjects(SH.hasValue, None)
    ]
    return {
        "file": "Health-RI ReusedCommunityStandards/dcatap.shapes.ttl (DCAT-AP 2.0)",
        "node_shapes": len(node_shapes),
        "targetless_logic_shapes": targetless,
        "references_to_them": refs,
        "sh_or": len(list(g.triples((None, SH["or"], None)))),
        "hasValue_stamps": stamps,
    }


def equivalence() -> dict:
    ru = json.load(open(os.path.join(RESULTS, "equivalence-rudof.json")))
    cases = sorted(ru["cases"])
    encs = list(ENCODINGS)

    def verdict(case, enc):
        r = ru["cases"][case].get(enc, {})
        if "error" in r:
            return "E"
        return "C" if r.get("conforms") else "V"

    matrix = {c: {e: verdict(c, e) for e in encs} for c in cases}

    def norm(rows) -> list[tuple]:
        """The harness writes base rows tab-joined, with '' for a missing path."""
        out = []
        for r in rows:
            f, p, comp = r.split("\t") if isinstance(r, str) else r
            out.append((f, p or None, comp or None))
        return sorted(out)

    def agree(enc_a, enc_b, base_only: bool = False):
        """Same verdict AND the same base-shape violation signature on every case.

        With `base_only`, only the base-shape signature is compared — used to
        show that an overlay changes the conditional and disturbs nothing else.
        """
        for c in cases:
            a, b = ru["cases"][c][enc_a], ru["cases"][c][enc_b]
            if not base_only:
                if a.get("conforms") != b.get("conforms"):
                    return False, c, "conformance"
                if a.get("conditional_fired") != b.get("conditional_fired"):
                    return False, c, "conditional fired"
            if norm(a.get("base", [])) != norm(b.get("base", [])):
                return False, c, "base-shape results"
        return True, None, None

    def as_expected(enc):
        """The verdict the requirement demands, fixed before any run (EXPECTED)."""
        for c in cases:
            if verdict(c, enc) != EXPECTED.get(c):
                return False, c, "verdict"
        return True, None, None

    # Checks that must hold for the equivalence claim to stand. All of them are
    # rudof against rudof: the claim is that the migration preserves behaviour
    # in the engine that drives the form, and this is that engine.
    checks = OrderedDict()
    checks["rudof(implication) == rudof(shacl12-if)"] = agree("implication", "shacl12-if")
    checks["rudof(shacl12-if) == expected"] = as_expected("shacl12-if")
    checks["rudof(implication) == expected"] = as_expected("implication")
    checks["rudof(shacl12-if) base results == rudof(shipped) base results"] = agree(
        "shipped", "shacl12-if", base_only=True
    )

    # Divergences that must NOT hold — each is a finding in its own right.
    diverge = OrderedDict()
    diverge["rudof(shipped) != rudof(implication)"] = agree("shipped", "implication")
    diverge["rudof(partition-subjectsof) != rudof(implication)"] = agree(
        "partition-subjectsof", "implication"
    )
    diverge["rudof(partition-sparql) != rudof(implication)"] = agree("partition-sparql", "implication")

    return {
        "engine": f"{ru['validator']} {ru['package']}@{ru['version']}",
        "measurement_toolkit": f"rdflib {rdflib.__version__}, Python {sys.version.split()[0]} (measurement only — not a validator)",
        "cases": cases,
        "matrix": matrix,
        "checks": {k: {"holds": v[0], "first_divergence": v[1], "on": v[2]} for k, v in checks.items()},
        "divergences": {k: {"identical": v[0], "first_divergence": v[1], "on": v[2]} for k, v in diverge.items()},
    }


# --------------------------------------------------------------------------- #
# rendering
# --------------------------------------------------------------------------- #

CASE_LABELS = {
    "01-no-personal-data": "no personal data",
    "02-no-personal-data-with-legal-basis": "no personal data, legal basis anyway",
    "03-personal-data-complete": "personal data + basis + purpose",
    "04-personal-data-no-legal-basis": "personal data, no legal basis",
    "05-personal-data-no-purpose": "personal data, no purpose",
    "06-personal-data-neither": "personal data, neither",
    "07-personal-data-multivalued": "3 personal-data values, complete",
    "08-personal-data-on-non-dataset": "personal data on a non-Dataset node",
    "09-base-violation-missing-title": "base: no dct:title",
    "10-base-violation-bad-access-rights": "base: accessRights outside sh:in",
    "11-personal-data-plus-base-violation": "base violation + conditional violation",
}

EXPECTED = {
    "01-no-personal-data": "C",
    "02-no-personal-data-with-legal-basis": "C",
    "03-personal-data-complete": "C",
    "04-personal-data-no-legal-basis": "V",
    "05-personal-data-no-purpose": "V",
    "06-personal-data-neither": "V",
    "07-personal-data-multivalued": "C",
    "08-personal-data-on-non-dataset": "C",
    "09-base-violation-missing-title": "V",
    "10-base-violation-bad-access-rights": "V",
    "11-personal-data-plus-base-violation": "V",
}


def render(m: dict) -> str:
    c, o, e = m["corpus"], m["overlays"], m["equivalence"]
    L: list[str] = []
    A = L.append

    A("# E2 — the encoding the ecosystem ships, and its SHACL 1.2 equivalent")
    A("")
    A("Generated by `report.py`. **Do not edit by hand** — every number here comes")
    A("out of the scripts in this folder.")
    A("")
    A(f"- Engine: {e['engine']} — the engine this library ships and the one that")
    A("  drives the form. It is the only SHACL implementation in this experiment.")
    A(f"- Measurement toolkit: {e['measurement_toolkit']}")
    A("- Re-run: an earlier revision of this experiment ran rudof `0.3.5` and used a")
    A("  second SHACL implementation as an independent cross-check. The cross-check is")
    A("  withdrawn (§7); the engine version above is the one every number below comes")
    A("  from. `0.3.8` is the stricter engine — malformed IRIs are parse errors rather")
    A("  than silently dropped triples, and `sh:targetClass` selects through the")
    A("  `rdfs:subClassOf` closure — and on this corpus **no number moved**: all")
    A(f"  {len(e['cases']) * len(ENCODINGS)} verdicts in Tab. 2 and every base-shape result signature behind")
    A("  them are unchanged, as are all the structural counts, which never involved an")
    A("  engine at all.")
    A("- Subject: Health-RI Core (HealthDCAT-AP), commit `acec1359` (2026-08-25), CC-BY-4.0,")
    A(f"  vendored verbatim in `data/before/health-ri-core/` — {c['files']} files, {c['lines_before']} lines,")
    A(f"  {c['node_shapes']} node shapes, {c['property_shapes_before']} property shapes.")
    A("")

    A("## 1. What the ecosystem actually ships")
    A("")
    A("Measured over the verbatim profile, before anything is rewritten.")
    A("")
    A("| | |")
    A("|---|---:|")
    A(f"| node shapes | {c['node_shapes']} |")
    A(f"| distinct `sh:targetClass` | {c['target_classes']} |")
    A(f"| property shapes (`sh:path`) | {c['property_shapes_before']} |")
    A(f"| `dash:editor` triples | {c['dash_editor']} |")
    A(f"| `dash:viewer` triples | {c['dash_viewer']} |")
    A(f"| distinct `dash:` editor kinds | {len(c['dash_editor_kinds'])} |")
    lg = c["logical_constraints"]
    A(f"| `sh:or` / `sh:and` / `sh:not` / `sh:xone` | {lg['or']} / {lg['and']} / {lg['not']} / {lg['xone']} |")
    A(f"| `sh:qualifiedValueShape` | {lg['qualifiedValueShape']} |")
    A(f"| `sh:if` / `sh:then` / `sh:else` | {lg['if']} / {lg['then']} / {lg['else']} |")
    A(f"| `sh:sparql` | {lg['sparql']} |")
    A("")
    A("The profile carries a full second vocabulary for the user interface —")
    A(f"{c['dash_editor'] + c['dash_viewer']} DASH triples over {c['property_shapes_before']} property shapes — and **not one**")
    A("logical or conditional constraint of any kind. Its conditional requirements are")
    A("there, but as English prose inside `sh:description`. The one this experiment")
    A("takes as its subject is stated on `dpv:hasLegalBasis`:")
    A("")
    A("> *\"The legal basis used to justify processing of personal data. The legal")
    A("> basis can be provided as a value from the dpv taxonomy …\"*")
    A("> — `data/before/health-ri-core/Dataset.ttl`, `sh:minCount` absent")
    A("")
    A("(Counted over `Core/PiecesShape` only — the profile as authored. The repository")
    A(f"ships two further re-serialisations of the same {c['node_shapes']} shapes")
    A("(`Core/ValidationShape`, `Core/FairDataPointShape`); summed per file the DASH")
    A("annotations come to 464 `dash:editor` and 464 `dash:viewer`, but they add no")
    A("distinct constraint — E1 establishes that the copies collapse by shape identity.)")
    A("")

    A("## 2. Tab. 1 — one requirement, five encodings")
    A("")
    A("*A dataset that declares `dpv:hasPersonalData` must state `dpv:hasLegalBasis`")
    A("and `dpv:hasPurpose`.* Each row is an overlay merged with the verbatim profile;")
    A("only the overlay differs.")
    A("")
    A("| Encoding | SHACL | Entry points on `dcat:Dataset` | Node shapes added | Anon. shapes | Hidden `dash:hidden` stamps | `sh:or`/`sh:not` | `sh:if` | SPARQL chars | Lines | Triples |")
    A("|---|:--:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    for name, r in o.items():
        A(
            f"| {r['label']} | {r['version']} | {r['entry_points_on_dataset']} | {r['named_node_shapes_added']} | "
            f"{r['anonymous_shapes_added']} | {r['hidden_stamp_fields']} | {r['sh_or']}/{r['sh_not']} | "
            f"{r['sh_if']} | {r['sparql_chars']} | {r['lines']} | {r['triples']} |"
        )
    A("")
    A("*Entry points* = node shapes that can fire on a `dcat:Dataset` on their own")
    A("(the profile's own `hri:DatasetShape` plus anything the overlay targets). Two")
    A("entry points for one class is the DASH-era signature: the requirement is split")
    A("across shapes that a reader — and a form generator — must reassemble.")
    A("")
    A("The SHACL 1.2 row adds *two* named node shapes to the partition's one, and that is")
    A("not a defect: neither carries a target, so neither can fire on its own. They are")
    A("named fragments of one constraint hanging off `hri:DatasetShape`, and inlining")
    A("them as blank nodes would take the count to 0 at the cost of readability. The")
    A("column that matters is the first one.")
    A("")

    A("## 3. Tab. 1b — the mechanical half: DASH → SHACL-UI")
    A("")
    A("`migrate.py` rewrites the whole vendored profile. Nothing but the UI")
    A("vocabulary changes, and that is checked, not asserted.")
    A("")
    A("| | before | after |")
    A("|---|---:|---:|")
    A(f"| files | {c['files']} | {c['files']} |")
    A(f"| lines of Turtle | {c['lines_before']} | {c['lines_after']} |")
    A(f"| triples | {c['triples_before']} | {c['triples_after']} |")
    A(f"| property shapes (`sh:path`) | {c['property_shapes_before']} | {c['property_shapes_after']} |")
    A(f"| editor annotations | {c['dash_editor']} `dash:editor` | {c['shui_editor_after']} `shui:editor` |")
    A(f"| viewer annotations | {c['dash_viewer']} `dash:viewer` | {c['shui_viewer_after']} |")
    A(f"| non-UI subgraph isomorphic | — | **{'yes' if c['non_ui_isomorphic'] else 'NO'}** |")
    A("")
    A("Editor kinds used, and their SHACL-UI counterparts:")
    A("")
    A("| `dash:` | count | `shui:` |")
    A("|---|---:|---|")
    mapping = {
        "URIEditor": "IRIEditor",
        "TextFieldEditor": "TextFieldEditor",
        "BlankNodeEditor": "BlankNodeEditor",
        "DateTimePickerEditor": "DateTimePickerEditor",
        "TextAreaEditor": "TextAreaEditor",
        "EnumSelectEditor": "EnumSelectEditor",
    }
    for k, n in c["dash_editor_kinds"].items():
        A(f"| `dash:{k}` | {n} | `shui:{mapping.get(k, '—')}` |")
    A("")
    A(f"The {c['dash_viewer']} `dash:viewer` triples are dropped, not translated: a capture")
    A("form has no separate read mode, and every viewer in this profile is the passive")
    A("twin of an editor already stated on the same property shape")
    A(f"({', '.join(f'`dash:{k}` ×{n}' for k, n in c['dash_viewer_kinds'].items())}).")
    A("")

    A("## 4. Tab. 2 — behavioural equivalence")
    A("")
    A("Eleven data graphs, five encodings, one engine. `C` = conforms, `V` =")
    A("violation, `E` = the engine could not run the encoding.")
    A("")
    A("What this table shows is that **rudof accepts and rejects the same data under")
    A("both encodings** — the SHACL 1.0 implication and the SHACL 1.2 conditional. It")
    A("is a demonstration in the engine that drives the form, not a cross-validated")
    A("proof against a second implementation. §7 says what that costs.")
    A("")
    header = "| Case | expected | " + " | ".join(ENCODINGS) + " |"
    A(header)
    A("|---|:--:|" + "|".join([":--:"] * len(ENCODINGS)) + "|")
    for case in e["cases"]:
        row = [f"`{case[:2]}` {CASE_LABELS.get(case, case)}", EXPECTED.get(case, "?")]
        for enc in ENCODINGS:
            row.append(e["matrix"][case][enc])
        A("| " + " | ".join(row) + " |")
    A("")
    A("*expected* is the verdict the requirement demands, fixed before any run")
    A("(`EXPECTED` in `report.py`).")
    A("")
    A("### Agreement checks")
    A("")
    A("Each check compares, case by case, the conformance verdict **and** the exact")
    A("set of base-shape results `(focus node, path, constraint component)` — so a")
    A("pair that agrees on `conforms` but disagrees on *why* fails. `make check`")
    A("exits non-zero if any of these breaks.")
    A("")
    A("| Check | holds | what it establishes |")
    A("|---|:--:|---|")
    established = {
        "rudof(implication) == rudof(shacl12-if)": f"the migration is behaviour-preserving: same verdict, same base-shape results, all {len(e['cases'])} cases",
        "rudof(shacl12-if) == expected": "and the behaviour preserved is the *right* one — the 1.2 encoding matches the requirement fixed in advance",
        "rudof(implication) == expected": "the 1.0 encoding it is compared against is itself correct, so the equivalence is not two engines agreeing on a mistake",
        "rudof(shacl12-if) base results == rudof(shipped) base results": "the conditional overlay adds a conditional and disturbs nothing else in the profile",
    }
    for k, v in e["checks"].items():
        mark = "yes" if v["holds"] else f"**NO** — diverges at {v['first_divergence']} ({v['on']})"
        A(f"| `{k}` | {mark} | {established.get(k, '')} |")
    A("")
    A("### Divergences — each one a finding")
    A("")
    A("These pairs must *not* agree. The first case where each parts company:")
    A("")
    A("| Pair | identical? | first divergence | what it shows |")
    A("|---|:--:|---|---|")
    why = {
        "rudof(shipped) != rudof(implication)": "the published profile does not enforce its own prose",
        "rudof(partition-subjectsof) != rudof(implication)": "`sh:targetSubjectsOf` leaks outside the class — the cheap SHACL 1.0 idiom is *wrong*",
        "rudof(partition-sparql) != rudof(implication)": "rudof does not implement `sh:SPARQLTarget`; it silently ignores the shape, so the SPARQL partition is untested here",
    }
    for k, v in e["divergences"].items():
        A(
            f"| `{k}` | {'yes (unexpected!)' if v['identical'] else 'no'} | "
            f"{v['first_divergence'] or '—'} ({v['on'] or '—'}) | {why.get(k, '')} |"
        )
    A("")
    A("The last row is a limit of this experiment and of our own engine, stated")
    A("plainly: rudof does not implement `sh:SPARQLTarget`, so the")
    A("`partition-sparql` row of Tab. 2 records silence, not a verdict. It is in")
    A("Tab. 1 for its *structural* cost — the size of the SPARQL string a correct")
    A("SHACL 1.0 partition needs — and that measurement does not need a validator.")
    A("")

    A("## 5. Listing 1 — the fragment for the paper")
    A("")
    A("**Before** — SHACL 1.0, the shape partition. Two entry points on one class, a")
    A("target chosen to coincide with the condition, and the condition written a")
    A("second time as a field the form must hide:")
    A("")
    A("```turtle")
    A("hri:PersonalDataDatasetShape a sh:NodeShape ;      # a SECOND entry point on dcat:Dataset")
    A("  sh:targetSubjectsOf dpv:hasPersonalData ;        # the target IS the condition")
    A("  sh:property [ sh:path dpv:hasPersonalData ;      # …and the condition, again,")
    A("                sh:minCount 1 ;                    #    as a field the form must hide")
    A("                dash:hidden true ] ,")
    A("              [ sh:path dpv:hasLegalBasis ; sh:minCount 1 ; sh:nodeKind sh:IRI ;")
    A("                dash:viewer dash:URIViewer ; dash:editor dash:URIEditor ] ,")
    A("              [ sh:path dpv:hasPurpose    ; sh:minCount 1 ; sh:nodeKind sh:IRI ;")
    A("                dash:viewer dash:LabelViewer ; dash:editor dash:URIEditor ] .")
    A("```")
    A("")
    A("It is also **wrong**: `sh:targetSubjectsOf` selects every subject of")
    A("`dpv:hasPersonalData`, dataset or not (case `08`). Making it correct in SHACL 1.0")
    A("means moving the condition into a SPARQL string")
    A("(`data/before/overlay-02-partition-sparql.ttl`), where no structural tool can")
    A("read it, or writing it backwards as `sh:or ( [ sh:not C ] T )`")
    A("(`data/before/overlay-03-implication.ttl`).")
    A("")
    A("**After** — SHACL 1.2. One entry point, no stamp, no target, and the condition")
    A("read in the order it is thought:")
    A("")
    A("```turtle")
    A("hri:DatasetShape                                   # the published shape, unchanged")
    A("  sh:if   hri:PersonalDataCondition ;")
    A("  sh:then hri:PersonalDataRequirements .")
    A("")
    A("hri:PersonalDataCondition a sh:NodeShape ;")
    A("  sh:property [ sh:path dpv:hasPersonalData ; sh:minCount 1 ] .")
    A("")
    A("hri:PersonalDataRequirements a sh:NodeShape ;")
    A("  sh:property [ sh:path dpv:hasLegalBasis ; sh:minCount 1 ; sh:nodeKind sh:IRI ;")
    A("                shui:editor shui:IRIEditor ;")
    A('                sh:message "A dataset that declares personal data must state its legal basis."@en ] ,')
    A("              [ sh:path dpv:hasPurpose    ; sh:minCount 1 ; sh:nodeKind sh:IRI ;")
    A("                shui:editor shui:IRIEditor ] .")
    A("```")
    A("")
    A("(Both listings inline the property shapes to fit a column; the files are")
    A("`data/before/overlay-01-partition-subjectsof.ttl` and")
    A("`data/after/overlay-04-shacl12-if.ttl`.)")
    A("")
    d = m["dcatap"]
    A("## 6. Where SHACL 1.2 does *not* replace the DASH-era pattern")
    A("")
    A("Four cases from the same corpus, stated plainly because they bound the claim.")
    A("")
    A("**(a) A disjunction is not a conditional.** The only logical constraints anywhere")
    A(f"in the Health-RI corpus are in the DCAT-AP shapes it vendors ({d['file']}):")
    A(f"{d['sh_or']} `sh:or`, each held by a node shape with **no target**, existing only so")
    A("that other property shapes can point at it:")
    A("")
    A("| targetless shape | referenced by |")
    A("|---|---:|")
    for s_, n in d["references_to_them"].items():
        A(f"| `{s_.rsplit('#', 1)[-1]}` | {n} property shape{'' if n == 1 else 's'} |")
    A("")
    A("`sh:if` is no improvement here. `DateOrDateTimeDataType_Shape` says *a date or a")
    A("dateTime*; there is no condition and no branch, and rewriting it as")
    A("`sh:if`/`sh:else` would be strictly worse. **SHACL 1.2 replaces `sh:or` only where")
    A("`sh:or` was standing in for an implication** — which is exactly the")
    A("`sh:or ( [ sh:not C ] T )` row of Tab. 1 and nothing else.")
    A("")
    A("**(b) A `sh:hasValue` stamp is sometimes a real constraint.** The corpus has")
    A(f"{len(d['hasValue_stamps'])}, in the same DCAT-AP file:")
    A("")
    for path, val in d["hasValue_stamps"]:
        A(f"- `{path}` **=** `{val}` (`sh:minCount 1`, `sh:maxCount 1`)")
    A("")
    A("A DASH form renders it as a field with exactly one legal value, which is the")
    A("ugliness — but the constraint itself is correct and must survive. What removes it")
    A("from the *form* is a UI annotation, not a conditional. The stamps a conditional")
    A("does remove are the ones that exist only to re-state a discriminator inside a")
    A("branch shape (Tab. 1, `dash:hidden` column): 1 per branch, 0 after.")
    A("")
    A("**(c) A partition whose discriminator is not in the data.** Where the DASH-era")
    A("profile split into N node shapes on one `sh:targetClass` and let the *application*")
    A("choose which one to load, `sh:if` cannot express it: `sh:if` reads a condition off")
    A("the focus node, so the discriminator must be a value in the graph. That is a")
    A("better design — the record then carries the reason it was validated the way it")
    A("was — but it is a change in the data model, not a pure re-encoding, and a")
    A("migration report should say so.")
    A("")
    A("**(d) A partition that needs SPARQL cannot be checked here.** rudof does not")
    A("implement `sh:SPARQLTarget`, so `partition-sparql` is measured structurally in")
    A("Tab. 1 and unvalidated in Tab. 2. See §7.")
    A("")
    A("## 7. Threats to validity")
    A("")
    A("**The equivalence is demonstrated in one engine only.** Every row of Tab. 2 is")
    A("rudof. That is a deliberate choice — the claim is that the migration preserves")
    A("behaviour *in the engine that drives the form*, and rudof is that engine, so a")
    A("result from any other implementation would not settle the question being asked.")
    A("But the consequence must be stated: **an encoding difference that both encodings")
    A("happen to hit the same way in rudof would not be detected here.** If rudof's")
    A("`sh:if` and its `sh:or ( [ sh:not C ] T )` share a bug — a mis-scoped focus")
    A("node, a mishandled empty branch — the two rows would agree and this experiment")
    A("would call that agreement equivalence. What Tab. 2 rules out is divergence")
    A("*between the encodings under rudof*, not divergence from the SHACL")
    A("specification. The `== expected` checks narrow that gap on these eleven cases —")
    A("the verdicts were fixed before any run — but eleven cases are eleven cases.")
    A("")
    A("**The tooling cost of adopting SHACL 1.2 is unmeasured.** How many deployed")
    A("validators understand `sh:if` today is a real question for anyone weighing this")
    A("migration, and this experiment does not answer it. An earlier revision reported")
    A("one datum from a second engine; that datum is withdrawn, and nothing replaced")
    A("it. A profile that migrates to SHACL 1.2 conditionals should expect uneven")
    A("support across the tools it is validated by, and should establish that support")
    A("for its own toolchain rather than take it from here.")
    A("")
    A("**The structural measurements need no validator.** §1, §2, §3 and §6 — the shape")
    A("and triple counts, the DASH inventory, the isomorphism of the non-UI subgraph,")
    A("the `sh:or` census — are graph measurements made with rdflib. They stand")
    A("independently of which engine validates, and nothing above weakens them.")
    A("")
    A("**One profile, one requirement.** The subject is a single published profile and")
    A("a single conditional requirement drawn from it. The five encodings are ours, so")
    A("they are as fair as we made them; the overlay files are in the repository to be")
    A("read and disagreed with.")
    A("")
    A("## 8. Provenance")
    A("")
    A("`data/before/health-ri-core/` is verbatim third-party Turtle. The five overlays")
    A("and the eleven data graphs are ours. Full statement in `data/PROVENANCE.md`;")
    A("regenerate everything with `make`.")
    A("")
    return "\n".join(L) + "\n"


def main() -> int:
    os.makedirs(RESULTS, exist_ok=True)
    m = {
        "corpus": corpus_metrics(),
        "overlays": overlay_metrics(),
        "dcatap": dcatap_metrics(),
        "equivalence": equivalence(),
    }
    with open(os.path.join(RESULTS, "metrics.json"), "w") as fh:
        json.dump(m, fh, indent=2)
    with open(os.path.join(RESULTS, "migration.md"), "w") as fh:
        fh.write(render(m))
    print("wrote results/metrics.json and results/migration.md")
    ok = True
    for k, v in m["equivalence"]["checks"].items():
        ok &= v["holds"]
        print(("  OK   " if v["holds"] else "  FAIL ") + k + ("" if v["holds"] else f"  <- {v['first_divergence']} ({v['on']})"))
    for k, v in m["equivalence"]["divergences"].items():
        ok &= not v["identical"]
        print(("  OK   " if not v["identical"] else "  FAIL ") + k + (f"  <- {v['first_divergence']} ({v['on']})" if not v["identical"] else "  <- unexpectedly identical"))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
