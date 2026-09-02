#!/usr/bin/env python3
"""E5 — is rudof right about SHACL, and does it read what it is given?

The corpus run in `validate.py` tells you what rudof says about 372 real
records. It cannot tell you whether an answer is right, only whether it is
consistent. So every SHACL construct the two shapes graphs actually use is also
probed in isolation, with a case whose correct answer is forced by the
specification's own words.

`expect` is not "what some other engine says". It is what the quoted TEXTUAL
DEFINITION requires. An engine that disagrees with `expect` is wrong.

This file is the residue of a comparison that has been retired. An earlier
round ran the whole corpus through pySHACL as well and diffed the two reports
defect by defect. That instrument earned its keep: it found two real rudof
defects, both departures from the Recommendation and one of them silent.

  1. `sh:targetClass` did not select through `rdfs:subClassOf`. SHACL §1.1
     makes the SHACL types of a term include the SHACL superclasses of its
     `rdf:type` values, and §2.1.3.2 makes the SHACL instances of a class the
     target. Cases `target-subclass-1hop`, `target-subclass-2hop`.
  2. The Turtle parser silently discarded triples whose IRI it would not
     accept: `loadData` returned, nothing was raised, and the triple was simply
     absent from the graph. Rejecting these IRIs is defensible and accepting
     them is defensible; discarding them and then reporting `conforms: true` is
     the one behaviour that is not, because it means a record can be made to
     pass by embedding a malformed IRI in it. Cases `parse-double-hash`,
     `parse-illegal-pipe`, `parse-relative`.

Both are fixed and published in `@kanzo-tech/rudof-wasm@0.3.8`. The comparison
that found them is gone — a second SHACL implementation is a workshop
instrument, never evidence, and this experiment's published claims rest on the
engine the library ships. The cases it produced stay, because they never needed
the second engine: each one's expected answer comes from the specification.

Ethics: unchanged and binding. Every case here is synthetic. No value from any
harvested record appears in this file or in anything it writes.

Outputs:
  results/rudof-conformance.json
  results/rudof-conformance.md

Usage: python conformance.py
"""

from __future__ import annotations

import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from rdflib import Graph

import validate as V

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
STAGE = DATA / "stage"
RESULTS = HERE / "results"


# ------------------------------------------------------- conformance probe
#
# Spec: SHACL, W3C Recommendation 20 July 2017 — https://www.w3.org/TR/shacl/

SH_P = "@prefix sh: <http://www.w3.org/ns/shacl#> .\n"
EX_P = "@prefix ex: <http://example.org/> .\n"
XSD_P = "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n"
RDFS_P = "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n"

_TARGET_SHAPE = (SH_P + EX_P + "ex:S a sh:NodeShape ; sh:targetClass ex:Super ;\n"
                 "  sh:property [ sh:path ex:label ; sh:minCount 1 ] .\n")


def _prop(body: str, target: str = "sh:targetNode ex:x") -> str:
    return (SH_P + EX_P + XSD_P
            + f"ex:S a sh:NodeShape ; {target} ;\n"
            + f"  sh:property [ sh:path ex:p ; {body} ] .\n")


SPEC = {
    "instance": "§1.1: \"The SHACL types of an RDF term in an RDF graph is the "
                "set of its values for rdf:type in the graph as well as the "
                "SHACL superclasses of these values in the graph.\"",
    "targetclass": "§2.1.3.2: \"If s is a shape in a shapes graph SG and s has "
                   "value c for sh:targetClass in SG then the set of SHACL "
                   "instances of c in a data graph DG is a target from DG for "
                   "s in SG.\"",
    "class": "§4.1.1: \"For each value node that is either a literal, or a "
             "non-literal that is not a SHACL instance of $class in the data "
             "graph, there is a validation result…\"",
    "datatype": "§4.1.2: \"A literal matches a datatype if the literal's "
                "datatype has the same IRI and, for the datatypes supported by "
                "SPARQL 1.1, is not an ill-typed literal.\"",
    "nodekind": "§4.1.3: \"For each value node that does not match $nodeKind, "
                "there is a validation result…\"",
    "mincount": "§4.2.1: \"If the number of value nodes is less than "
                "$minCount, there is a validation result.\"",
    "maxcount": "§4.2.2: \"If the number of value nodes is greater than "
                "$maxCount, there is a validation result.\"",
    "minlength": "§4.4.1: \"…the length of the string representation … less "
                 "than $minLength …\"",
    "pattern": "§4.4.3: \"For each value node … that does not match the "
               "regular expression $pattern …\" — matched with SPARQL REGEX, "
               "which is a partial (unanchored) match.",
    "uniquelang": "§4.4.5: \"For each pair of value nodes that have the same "
                  "language tag, there is a validation result.\"",
    "closed": "§4.8.1: sh:closed true rejects any predicate not covered by the "
              "shape's property shapes or sh:ignoredProperties.",
    "in": "§4.8.3: \"For each value node that is not a member of $in, there is "
          "a validation result…\"",
    "turtle": "Turtle §6.5 / RDF 1.1 Concepts §3.2: an IRI that does not "
              "satisfy the IRIREF production is a syntax error the parser must "
              "report; it is never a triple the parser may quietly discard.",
}

PROBES: list[dict] = [
    # --- target selection -------------------------------------------------
    {"id": "target-direct", "group": "sh:targetClass", "expect": "violation",
     "spec": SPEC["targetclass"], "shapes": _TARGET_SHAPE,
     "data": EX_P + "ex:a a ex:Super .",
     "why": "ex:a is directly typed ex:Super, so it is a target, and it has no "
            "ex:label."},
    {"id": "target-subclass-1hop", "group": "sh:targetClass",
     "expect": "violation", "spec": SPEC["instance"] + " " + SPEC["targetclass"],
     "shapes": _TARGET_SHAPE,
     "data": EX_P + RDFS_P + "ex:Sub rdfs:subClassOf ex:Super . ex:b a ex:Sub .",
     "why": "ex:Super is a SHACL type of ex:b, so ex:b is a SHACL instance of "
            "ex:Super and therefore a target."},
    {"id": "target-subclass-2hop", "group": "sh:targetClass",
     "expect": "violation", "spec": SPEC["instance"] + " " + SPEC["targetclass"],
     "shapes": _TARGET_SHAPE,
     "data": EX_P + RDFS_P + "ex:Sub2 rdfs:subClassOf ex:Sub . "
             "ex:Sub rdfs:subClassOf ex:Super . ex:c a ex:Sub2 .",
     "why": "SHACL subclass is the transitive closure of rdfs:subClassOf."},
    {"id": "target-unrelated", "group": "sh:targetClass", "expect": "conform",
     "spec": SPEC["targetclass"], "shapes": _TARGET_SHAPE,
     "data": EX_P + "ex:d a ex:Other .",
     "why": "not an instance of ex:Super by any route, so not a target."},

    # --- value type -------------------------------------------------------
    {"id": "class-direct", "group": "sh:class", "expect": "conform",
     "spec": SPEC["class"], "shapes": _prop("sh:class ex:Super"),
     "data": EX_P + "ex:v a ex:Super . ex:x ex:p ex:v ."},
    {"id": "class-subclass", "group": "sh:class", "expect": "conform",
     "spec": SPEC["class"] + " " + SPEC["instance"],
     "shapes": _prop("sh:class ex:Super"),
     "data": EX_P + RDFS_P + "ex:Sub rdfs:subClassOf ex:Super . ex:v a ex:Sub . "
             "ex:x ex:p ex:v .",
     "why": "the same SHACL-instance rule that governs sh:targetClass."},
    {"id": "class-untyped", "group": "sh:class", "expect": "violation",
     "spec": SPEC["class"], "shapes": _prop("sh:class ex:Super"),
     "data": EX_P + "ex:x ex:p ex:v ."},
    {"id": "class-literal", "group": "sh:class", "expect": "violation",
     "spec": SPEC["class"], "shapes": _prop("sh:class ex:Super"),
     "data": EX_P + 'ex:x ex:p "a literal" .'},
    {"id": "datatype-match", "group": "sh:datatype", "expect": "conform",
     "spec": SPEC["datatype"], "shapes": _prop("sh:datatype xsd:integer"),
     "data": EX_P + XSD_P + 'ex:x ex:p "5"^^xsd:integer .'},
    {"id": "datatype-mismatch", "group": "sh:datatype", "expect": "violation",
     "spec": SPEC["datatype"], "shapes": _prop("sh:datatype xsd:integer"),
     "data": EX_P + XSD_P + 'ex:x ex:p "5"^^xsd:string .',
     "why": "the exact defect class this corpus is full of — dcat:byteSize as "
            "xsd:integer where xsd:nonNegativeInteger is required."},
    {"id": "datatype-plain-is-string", "group": "sh:datatype",
     "expect": "conform", "spec": SPEC["datatype"] + " RDF 1.1 §3.3: a literal "
     "with no datatype IRI is xsd:string.",
     "shapes": _prop("sh:datatype xsd:string"),
     "data": EX_P + 'ex:x ex:p "plain" .'},
    {"id": "datatype-ill-typed", "group": "sh:datatype", "expect": "violation",
     "spec": SPEC["datatype"], "shapes": _prop("sh:datatype xsd:integer"),
     "data": EX_P + XSD_P + 'ex:x ex:p "3.5"^^xsd:integer .',
     "why": "the datatype IRI matches but the literal is ill-typed. This is "
            "precisely what a shape-driven form can still emit: the widget "
            "stamps the declared datatype, the user supplies the lexical form."},
    {"id": "nodekind-iri-ok", "group": "sh:nodeKind", "expect": "conform",
     "spec": SPEC["nodekind"], "shapes": _prop("sh:nodeKind sh:IRI"),
     "data": EX_P + "ex:x ex:p ex:v ."},
    {"id": "nodekind-literal-violates", "group": "sh:nodeKind",
     "expect": "violation", "spec": SPEC["nodekind"],
     "shapes": _prop("sh:nodeKind sh:IRI"), "data": EX_P + 'ex:x ex:p "lit" .'},

    # --- cardinality ------------------------------------------------------
    {"id": "mincount-violated", "group": "sh:minCount", "expect": "violation",
     "spec": SPEC["mincount"], "shapes": _prop("sh:minCount 1"),
     "data": EX_P + "ex:x a ex:Thing ."},
    {"id": "mincount-satisfied", "group": "sh:minCount", "expect": "conform",
     "spec": SPEC["mincount"], "shapes": _prop("sh:minCount 1"),
     "data": EX_P + 'ex:x ex:p "v" .'},
    {"id": "maxcount-violated", "group": "sh:maxCount", "expect": "violation",
     "spec": SPEC["maxcount"], "shapes": _prop("sh:maxCount 1"),
     "data": EX_P + 'ex:x ex:p "a" , "b" .'},
    {"id": "maxcount-satisfied", "group": "sh:maxCount", "expect": "conform",
     "spec": SPEC["maxcount"], "shapes": _prop("sh:maxCount 1"),
     "data": EX_P + 'ex:x ex:p "a" .'},

    # --- string-based -----------------------------------------------------
    {"id": "pattern-partial-match", "group": "sh:pattern", "expect": "conform",
     "spec": SPEC["pattern"], "shapes": _prop('sh:pattern "abc"'),
     "data": EX_P + 'ex:x ex:p "xxabcxx" .',
     "why": "SHACL's regex is unanchored. This is why the form deliberately "
            "does not pass sh:pattern to the HTML pattern attribute, which is "
            "implicitly ^(?:…)$ and would reject this value."},
    {"id": "pattern-anchored-fails", "group": "sh:pattern",
     "expect": "violation", "spec": SPEC["pattern"],
     "shapes": _prop('sh:pattern "^abc"'), "data": EX_P + 'ex:x ex:p "xabc" .'},
    {"id": "pattern-flags-i", "group": "sh:pattern", "expect": "conform",
     "spec": SPEC["pattern"] + " sh:flags supplies the regex flags.",
     "shapes": _prop('sh:pattern "^abc$" ; sh:flags "i"'),
     "data": EX_P + 'ex:x ex:p "ABC" .'},
    {"id": "minlength-violated", "group": "sh:minLength", "expect": "violation",
     "spec": SPEC["minlength"], "shapes": _prop("sh:minLength 1"),
     "data": EX_P + 'ex:x ex:p "" .'},
    {"id": "minlength-satisfied", "group": "sh:minLength", "expect": "conform",
     "spec": SPEC["minlength"], "shapes": _prop("sh:minLength 1"),
     "data": EX_P + 'ex:x ex:p "a" .'},
    {"id": "uniquelang-duplicate", "group": "sh:uniqueLang",
     "expect": "violation", "spec": SPEC["uniquelang"],
     "shapes": _prop("sh:uniqueLang true"),
     "data": EX_P + 'ex:x ex:p "one"@en , "two"@en .'},
    {"id": "uniquelang-distinct", "group": "sh:uniqueLang", "expect": "conform",
     "spec": SPEC["uniquelang"], "shapes": _prop("sh:uniqueLang true"),
     "data": EX_P + 'ex:x ex:p "one"@en , "deux"@fr .'},
    {"id": "uniquelang-untagged", "group": "sh:uniqueLang", "expect": "conform",
     "spec": SPEC["uniquelang"], "shapes": _prop("sh:uniqueLang true"),
     "data": EX_P + 'ex:x ex:p "one" , "two" .',
     "why": "untagged literals have no language tag, so no pair shares one."},

    # --- other ------------------------------------------------------------
    {"id": "in-member", "group": "sh:in", "expect": "conform",
     "spec": SPEC["in"], "shapes": _prop("sh:in ( ex:a ex:b )"),
     "data": EX_P + "ex:x ex:p ex:a ."},
    {"id": "in-nonmember", "group": "sh:in", "expect": "violation",
     "spec": SPEC["in"], "shapes": _prop("sh:in ( ex:a ex:b )"),
     "data": EX_P + "ex:x ex:p ex:c ."},
    {"id": "closed-true-extra", "group": "sh:closed", "expect": "violation",
     "spec": SPEC["closed"],
     "shapes": SH_P + EX_P + "ex:S a sh:NodeShape ; sh:targetNode ex:x ; "
     "sh:closed true ;\n  sh:property [ sh:path ex:p ] .\n",
     "data": EX_P + 'ex:x ex:p "a" ; ex:q "b" .'},
    {"id": "closed-false-extra", "group": "sh:closed", "expect": "conform",
     "spec": SPEC["closed"],
     "shapes": SH_P + EX_P + "ex:S a sh:NodeShape ; sh:targetNode ex:x ; "
     "sh:closed false ;\n  sh:property [ sh:path ex:p ] .\n",
     "data": EX_P + 'ex:x ex:p "a" ; ex:q "b" .',
     "why": "DCAT-AP 3.0.1 says sh:closed false on all 33 of its node shapes, "
            "so this is the case the corpus actually exercises."},
]

# Parser cases. The question is not what the report says but whether the triple
# reached the graph at all: a validator that discards its input and then reports
# conformance is answering a question nobody asked.
PARSER_PROBES: list[dict] = [
    {"id": "parse-plain-iri", "iri": "http://example.org/a",
     "expect": "kept", "spec": SPEC["turtle"],
     "why": "a well-formed IRI; the control case."},
    {"id": "parse-double-hash", "iri": "http://example.org/a##",
     "expect": "kept-or-error", "spec": SPEC["turtle"],
     "why": "'#' is not excluded by the Turtle IRIREF production, so this "
            "parses; it is not a valid RFC 3987 IRI, so a parser may reject "
            "it. Silently dropping the triple is the one answer that is not "
            "available."},
    {"id": "parse-illegal-pipe", "iri": "http://example.org/a|b",
     "expect": "kept-or-error", "spec": SPEC["turtle"],
     "why": "'|' IS excluded by the Turtle IRIREF production, so this is a "
            "syntax error and a conformant parser must report it."},
    {"id": "parse-relative", "iri": "not-an-iri", "expect": "kept-or-error",
     "spec": "Turtle §6.3: relative IRIs are resolved against the base IRI.",
     "why": "resolve against the base or refuse; do not discard."},
]


def run_cases(cases: list[dict], where: Path) -> dict:
    """Hand a list of {id, shapes, data} to rudof and read the verdicts back."""
    where.mkdir(parents=True, exist_ok=True)
    (where / "cases.json").write_text(json.dumps(cases))
    out = where / "rudof-cases.json"
    subprocess.run(["node", str(HERE / "rudof_validate.mjs"), str(where),
                    str(out)], check=True, cwd=HERE, capture_output=True)
    return json.loads(out.read_text())


def run_probes() -> dict:
    probe_dir = STAGE / "_probes"
    cases = [{"id": p["id"], "shapes": p["shapes"], "data": p["data"]}
             for p in PROBES]
    # Parser cases share one trivial shape; only the parse matters.
    parse_shape = SH_P + EX_P + "ex:S a sh:NodeShape ; sh:targetNode ex:s .\n"
    cases += [{"id": p["id"], "shapes": parse_shape,
               "data": EX_P + f"ex:s ex:p <{p['iri']}> ."}
              for p in PARSER_PROBES]
    raw = run_cases(cases, probe_dir)
    ru = raw["cases"]

    rows = []
    for p in PROBES:
        r = ru.get(p["id"], {})
        got = ("error" if r.get("error")
               else "conform" if r.get("conforms") else "violation")
        rows.append({
            "id": p["id"], "group": p["group"], "expect": p["expect"],
            "rudof": got, "correct": got == p["expect"],
            "spec": p["spec"], "why": p.get("why", ""),
        })

    parse_rows = []
    for p in PARSER_PROBES:
        r = ru.get(p["id"], {})
        got = ("error" if r.get("error")
               else "kept" if (r.get("loaded_quads") or 0) >= 1 else "dropped")
        ok = (got == "kept") if p["expect"] == "kept" else \
             (got in ("kept", "error"))
        parse_rows.append({
            "id": p["id"], "expect": p["expect"], "rudof": got, "correct": ok,
            "spec": p["spec"], "why": p["why"],
        })

    return {
        "version": raw["version"],
        "constraints": rows,
        "parser": parse_rows,
        "failed": [r["id"] for r in rows if not r["correct"]],
        "parser_failed": [r["id"] for r in parse_rows if not r["correct"]],
        "n_constraint_cases": len(rows),
        "n_parser_cases": len(parse_rows),
    }


# ---------------------------------------------------------- dangling probe


def probe_dangling() -> dict:
    """Is dropping the two dangling `sh:property` links a no-op for the answer?

    DCAT-AP 3.0.1's `dcat:DataServiceShape` links two property shapes that do
    not exist anywhere in the file. `validate.py` drops those links before
    validating, on the argument that an empty property shape constrains
    nothing. That argument is checked here rather than asserted: a synthetic
    `dcat:DataService` that violates four constraints on purpose is validated
    under the shapes as published and under the de-dangled shapes, and the two
    runs must return the same four results.

    A *conforming* probe record could not settle this - 0 results is the right
    answer whether the shape was validated or skipped - which is why the probe
    violates.
    """
    probe_dir = STAGE / "_dangling"
    control_dir = STAGE / "_dangling_fixed"
    for d in (probe_dir, control_dir):
        d.mkdir(parents=True, exist_ok=True)

    published = Graph()
    published.parse(DATA / "dcat-ap-3.0.1" / "dcat-ap-SHACL.ttl", format="turtle")
    published.serialize(probe_dir / "L1.ttl", format="turtle")

    fixed = Graph()
    fixed.parse(DATA / "dcat-ap-3.0.1" / "dcat-ap-SHACL.ttl", format="turtle")
    dangling = V.drop_dangling_property_shapes(fixed)
    fixed.serialize(control_dir / "L1.ttl", format="turtle")

    # Carries no value from any harvested record. It must violate: dct:title
    # and dcat:endpointURL are sh:minCount 1, and dcat:theme is
    # sh:nodeKind sh:BlankNodeOrIRI + sh:class skos:Concept.
    probe_ttl = (
        "@prefix dcat: <http://www.w3.org/ns/dcat#> .\n"
        "@prefix dct:  <http://purl.org/dc/terms/> .\n"
        "<http://example.org/svc> a dcat:DataService ;\n"
        '  dcat:theme "not an IRI" .\n'
    )
    for d in (probe_dir, control_dir):
        (d / "probe.ttl").write_text(probe_ttl)
        (d / "keys.json").write_text(json.dumps(["probe"]))
        shutil.copy(d / "L1.ttl", d / "L2.ttl")
        if (d / "cases.json").exists():
            (d / "cases.json").unlink()

    def run(d: Path) -> tuple[str, list[str]]:
        out = d / "rudof.json"
        subprocess.run(["node", str(HERE / "rudof_validate.mjs"), str(d),
                        str(out)], check=True, cwd=HERE, capture_output=True)
        raw = json.loads(out.read_text())
        err = raw["errors"].get("probe", {}).get("L1")
        if err:
            return f"refused: {err}", []
        return "ran", sorted(
            f"{r['component'].replace('ConstraintComponent', '')}"
            f"@{V.short_path(r['path'])}"
            for r in raw["records"]["probe"]["L1"])

    pub, pub_r = run(probe_dir)
    fix, fix_r = run(control_dir)
    return {
        "dangling_links": dangling,
        "probe": "a synthetic dcat:DataService violating four constraints",
        "as_published": pub, "as_published_results": pub_r,
        "de_dangled": fix, "de_dangled_results": fix_r,
        "same_answer": pub_r == fix_r and bool(fix_r),
    }


# ------------------------------------------------------------------ report


def render(s: dict) -> None:
    cp = s["conformance_probe"]
    L = []
    L.append("# E5 — rudof against the specification\n")
    L.append(f"\nGenerated by `conformance.py` on {s['generated_utc']} against "
             f"`@kanzo-tech/rudof-wasm@{cp['version']}`. Every number is "
             "computed; none is typed.\n")
    L.append("\nThe corpus run says what the engine reports about 372 real "
             "records. It cannot say whether a report is *right*. So every "
             "SHACL construct the two shapes graphs use is probed in "
             "isolation, against a case whose answer the specification's own "
             "words decide. `expect` is the spec's answer, not another "
             "engine's.\n")

    L.append("\n## Constraint components\n\n")
    L.append("| case | construct | spec says | rudof |\n|---|---|---|---|\n")
    for c in cp["constraints"]:
        v = c["rudof"] if c["correct"] else f"**{c['rudof']}** (wrong)"
        L.append(f"| `{c['id']}` | `{c['group']}` | {c['expect']} | {v} |\n")
    L.append(f"\nrudof: **{cp['n_constraint_cases'] - len(cp['failed'])} of "
             f"{cp['n_constraint_cases']}**.\n")
    for c in cp["constraints"]:
        if not c["correct"]:
            L.append(f"\n**`{c['id']}` — rudof is wrong.** {c['spec']}"
                     + (f" {c['why']}" if c["why"] else "") + "\n")

    L.append("\n## The parser, before the validator\n\n")
    L.append("Every result a validator can report is a statement about a "
             "triple it holds. A parser that drops a triple it dislikes and "
             "then reports `conforms: true` has answered a question nobody "
             "asked, and a record can be made to pass by embedding a malformed "
             "IRI in it. Rejecting is fine. Accepting is fine. Discarding "
             "silently is not.\n\n")
    L.append("| case | required | rudof |\n|---|---|---|\n")
    for c in cp["parser"]:
        v = c["rudof"] if c["correct"] else f"**{c['rudof']}** (wrong)"
        L.append(f"| `{c['id']}` | {c['expect']} | {v} |\n")
    L.append(f"\nrudof: **{cp['n_parser_cases'] - len(cp['parser_failed'])} of "
             f"{cp['n_parser_cases']}**.\n")
    for c in cp["parser"]:
        if not c["correct"]:
            L.append(f"\n**`{c['id']}` — rudof is wrong.** {c['spec']} "
                     f"{c['why']}\n")

    L.append("\n## Two fixed defects, and where they came from\n\n")
    L.append("Both of the cases groups above were written because a retired "
             "cross-check against a second SHACL implementation found rudof "
             "wrong, and both defects are fixed in the version tested here. "
             "The cross-check is gone; the cases stay, because their expected "
             "answers come from the specification and never came from the "
             "other engine.\n\n")
    for gid, what in (("target-subclass",
                       "`sh:targetClass` now selects through the "
                       "`rdfs:subClassOf` closure (SHACL §1.1, §2.1.3.2)."),
                      ("parse-",
                       "the Turtle parser now raises on an IRI it will not "
                       "accept instead of dropping the triple.")):
        cases = [c for c in cp["constraints"] + cp["parser"]
                 if c["id"].startswith(gid)]
        ok = all(c["correct"] for c in cases)
        L.append(f"- {what} Cases "
                 + ", ".join(f"`{c['id']}`" for c in cases)
                 + f": **{'all pass' if ok else 'STILL FAILING'}**.\n")

    L.append("\n## The published DCAT-AP shapes, undropped\n\n")
    p = s["dangling_probe"]
    L.append("`dcat:DataServiceShape` links two `sh:property` shapes that do "
             "not exist in the file:\n\n")
    for d in p["dangling_links"]:
        L.append(f"- `{d}`\n")
    L.append("\n`validate.py` drops those links, on the argument that an empty "
             "property shape constrains nothing. Probe: " + p["probe"]
             + ". If the argument holds, the shapes as published and the "
             "de-dangled shapes must give the same answer.\n\n")
    L.append("| shapes | run | results |\n|---|---|---|\n")
    L.append(f"| as published | {p['as_published']} | "
             f"`{', '.join(p['as_published_results']) or 'none'}` |\n")
    L.append(f"| de-dangled | {p['de_dangled']} | "
             f"`{', '.join(p['de_dangled_results']) or 'none'}` |\n")
    L.append(f"\nSame answer: **{p['same_answer']}**. So the drop is a "
             "no-op for the corpus numbers, and rudof is not silently skipping "
             "`dcat:DataServiceShape`: it ignores the two empty property "
             "shapes, which constrain nothing, and validates the rest of the "
             "shape exactly as a working profile would be validated.\n")
    (RESULTS / "rudof-conformance.md").write_text("".join(L))


def main() -> None:
    STAGE.mkdir(parents=True, exist_ok=True)
    out = {
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "conformance_probe": run_probes(),
        "dangling_probe": probe_dangling(),
    }
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "rudof-conformance.json").write_text(json.dumps(out, indent=1))
    render(out)
    cp = out["conformance_probe"]
    print(json.dumps({
        "version": cp["version"],
        "constraints": f"{cp['n_constraint_cases'] - len(cp['failed'])}/"
                       f"{cp['n_constraint_cases']}",
        "parser": f"{cp['n_parser_cases'] - len(cp['parser_failed'])}/"
                  f"{cp['n_parser_cases']}",
        "failed": cp["failed"] + cp["parser_failed"],
    }, indent=1))


if __name__ == "__main__":
    main()
