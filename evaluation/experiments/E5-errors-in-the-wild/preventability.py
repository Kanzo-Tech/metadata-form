#!/usr/bin/env python3
"""E5 — measure preventability instead of asserting it.

`validate.py` used to say, in a docstring:

    L1 and L2 are preventable at entry by construction - a shape-driven form
    cannot submit a graph that violates a shape it is generated from.

That is a piece of reasoning. It produced the second headline (96.5%) and it was
never tested, even though the sibling experiment E1 had already measured that
the form does *not* render every construct a profile can carry. This script
replaces the reasoning with a measurement, and reports three numbers where there
was one:

  WIDGET      the control makes the bad value untypable — an `sh:in` enumeration
              rendered as a select, a `sh:maxCount` that hides "+ Add", a
              `sh:datatype` the binding layer stamps by construction.
  VALIDATION  the value can be typed, but the form runs the whole shapes graph
              on commit, surfaces the violation and drops `form.isValid` to
              false, so the host application's Save button is disabled.
  NOT         our form does not render or enforce that constraint at all, or the
              defect is one no shape can express (L3).

Everything below is joined from three committed artefacts and nothing is typed
by hand:

  results/form-fields.json   what the form ACTUALLY renders for these shapes,
                             written by form_fields.harness.ts against the real
                             buildFormModel and the real widget registry
  the corpus                 re-validated here to recover, per defect, *how* the
                             value was wrong (a literal where an IRI belongs is
                             a different question for a form than a wrong
                             datatype IRI)
  results/summary.json       the totals this has to reconcile against

Two findings drove the design and both are measured, not assumed:

 1. **DCAT-AP 3.0.1's generated SHACL puts every constraint in its own property
    shape.** `dct:format` on `dcat:Distribution` is four property shapes — one
    with `sh:nodeKind`, one with `sh:class`, one with neither, and (from L2) one
    with `sh:in`. `buildFormModel` renders one field per property shape and does
    not merge them, so the form shows four controls over the same predicate.
    A closed enumeration beside three open text boxes does not make anything
    untypable. Prevention-by-widget is therefore a property of *all* the fields
    on a path, not of the best one, and that is how it is computed here.

 2. **`primitiveToTerm` emits an IRI only for `sh:nodeKind sh:IRI`.** DCAT-AP
    says `sh:BlankNodeOrIRI`, which is not that IRI, so the binding layer falls
    through and writes a literal — the exact defect the corpus is full of.

Ethics: unchanged and binding. Output is per constraint component and per
profile property; no record, catalogue, publisher or value appears.

Outputs:
  results/preventability.json
  results/preventability.md

Usage: python preventability.py   # reads data/stage/, written by validate.py
"""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import validate as V

HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results"

WIDGET = "widget"
VALIDATION = "validation"
NOT_PREVENTED = "not_prevented"

SH = "http://www.w3.org/ns/shacl#"
XSD = "http://www.w3.org/2001/XMLSchema#"

# `validate.py.short_path` prefixes, inverted, so a defect row's `dct:format`
# can be joined to the inventory's full IRI.
PREFIXES = {
    "dct:": "http://purl.org/dc/terms/",
    "dcat:": "http://www.w3.org/ns/dcat#",
    "foaf:": "http://xmlns.com/foaf/0.1/",
    "vcard:": "http://www.w3.org/2006/vcard/ns#",
    "adms:": "http://www.w3.org/ns/adms#",
    "spdx:": "http://spdx.org/rdf/terms#",
    "skos:": "http://www.w3.org/2004/02/skos/core#",
    "owl:": "http://www.w3.org/2002/07/owl#",
    "prov:": "http://www.w3.org/ns/prov#",
    "odrl:": "http://www.w3.org/ns/odrl/2/",
    "dcatap:": "http://data.europa.eu/r5r/",
    "locn:": "http://www.w3.org/ns/locn#",
    "time:": "http://www.w3.org/2006/time#",
    "rdfs:": "http://www.w3.org/2000/01/rdf-schema#",
}


def expand(short: str) -> str:
    for p, ns in PREFIXES.items():
        if short.startswith(p):
            return ns + short[len(p):]
    return short


def emits_iri(field: dict) -> bool:
    """Would `primitiveToTerm` turn this field's input into a NamedNode?

    src/react/widgets/widgets.ts:

        if (c.nodeKind === SH_IRI || dt === `${XSD}anyURI` || (!dt && c.classIri))
          return namedNode(raw);

    Note what is *not* there: `sh:BlankNodeOrIRI`. DCAT-AP uses that value on
    every one of the properties this corpus fails, so the branch never fires for
    them and the field writes a literal.
    """
    dt, nk, cls = field["datatype"], field["nodeKind"], field["classIri"]
    return nk == f"{SH}IRI" or dt == f"{XSD}anyURI" or (not dt and bool(cls))


# ---------------------------------------------------------------- the rules
#
# One rule per constraint component. Each takes the defect and the list of
# fields the form renders for that (class, path) and returns a bucket plus the
# reason, which is carried into the report so every row can be audited.
#
# The universal precondition: prevention by the WIDGET requires that *every*
# editable field on the path enforces it, because the user may type into any of
# them. Prevention by VALIDATION requires only that the constraint be in the
# shapes graph the form was handed — `RudofEngine.validateTree` compiles the
# whole schema and validates each node of the projected tree against it, so
# there is no "the form only checks what it rendered" filter.


def rule_in(d, fields):
    if all(f["closedControl"] for f in fields):
        return WIDGET, "every control on this path is a closed enumeration"
    open_n = sum(1 for f in fields if not f["closedControl"])
    return VALIDATION, (f"{open_n} of {len(fields)} controls on this path accept "
                        "free input, so the enumeration does not make the bad "
                        "value untypable")


def rule_maxcount(d, fields):
    if all(f["maxCount"] is not None for f in fields):
        return WIDGET, "every control on this path is capped, so '+ Add' stops"
    return VALIDATION, ("the cap is on one property shape; the other controls "
                        "on the same path are uncapped")


def rule_datatype(d, fields):
    declared = {f["datatype"] for f in fields if f["datatype"]}
    if d.get("value_datatype") and d["value_datatype"] in declared:
        return VALIDATION, ("the datatype IRI is right and the lexical form is "
                            "ill-typed; the widget stamps the IRI, not the "
                            "lexical form")
    if declared and all(f["datatype"] in declared and f["datatype"] for f in fields):
        return WIDGET, "every control on this path stamps the declared datatype"
    return VALIDATION, ("at least one control on this path carries no "
                        "sh:datatype, so a value written through it is emitted "
                        "untyped")


def rule_nodekind(d, fields):
    # The corpus's nodeKind defects are literals where a non-literal is required.
    if d.get("value_kind") == "Literal":
        if all(emits_iri(f) for f in fields):
            return WIDGET, "every control on this path emits an IRI by construction"
        return VALIDATION, ("primitiveToTerm emits an IRI only for sh:nodeKind "
                            "sh:IRI; this profile says sh:BlankNodeOrIRI, so the "
                            "control writes a literal")
    return VALIDATION, "not made untypable by the control"


def rule_class(d, fields):
    if all(f["nested"] for f in fields):
        return WIDGET, ("the value is a nested sub-form, so the form stamps its "
                        "rdf:type")
    return VALIDATION, ("the reference control sets allowCustomValue on purpose, "
                        "so any IRI can be typed")


def rule_validation_only(reason):
    def rule(d, fields):
        return VALIDATION, reason
    return rule


RULES = {
    "InConstraintComponent": rule_in,
    "MaxCountConstraintComponent": rule_maxcount,
    "DatatypeConstraintComponent": rule_datatype,
    "NodeKindConstraintComponent": rule_nodekind,
    "ClassConstraintComponent": rule_class,
    "NodeConstraintComponent": rule_class,
    "MinCountConstraintComponent": rule_validation_only(
        "the array control never blocks removing the last value; sh:minCount is "
        "presentational in the UI and enforced only by the validator"),
    "MinLengthConstraintComponent": rule_validation_only(
        "HTML minlength only fires on submit, and the form calls preventDefault "
        "on submit, so it never fires"),
    "MaxLengthConstraintComponent": rule_validation_only(
        "maxLength does reach the input; counted here only if it ever occurs"),
    "PatternConstraintComponent": rule_validation_only(
        "sh:pattern is deliberately not passed to the HTML pattern attribute — "
        "an unanchored XPath regex is not an anchored HTML one"),
    "UniqueLangConstraintComponent": rule_validation_only(
        "sh:uniqueLang reaches FieldConstraints and no widget reads it"),
    "LanguageInConstraintComponent": rule_validation_only(
        "sh:languageIn does constrain the LanguagePicker; counted here only if "
        "it ever occurs"),
    "HasValueConstraintComponent": rule_validation_only(
        "sh:hasValue is seeded once and then freely editable; no widget reads it"),
}


def bucket(d: dict, index: dict) -> tuple[str, str]:
    if d["layer"] == "L3":
        return NOT_PREVENTED, "no shape can express this defect (that is the point)"

    key = (d["focus_class"], expand(d["path"]))
    fields = index.get(key, [])
    if not fields:
        return NOT_PREVENTED, ("the form renders no field for this class and "
                               "path, so neither a control nor the validator "
                               "sees it")
    editable = [f for f in fields if not f["readOnly"]]
    if not editable:
        return NOT_PREVENTED, ("every field on this path is read-only (complex "
                               "path), and buildComplexField erases its "
                               "constraints from the field model")

    rule = RULES.get(d["component"])
    if rule is None:
        return NOT_PREVENTED, f"no rule for {d['component']}"
    return rule(d, editable)


# ------------------------------------------------------------------- report


def main() -> None:
    inv_path = RESULTS / "form-fields.json"
    if not inv_path.exists():
        sys.exit("results/form-fields.json is missing. Run the harness first:\n"
                 "  npx vitest run --config "
                 "evaluation/experiments/vitest.config.ts \\\n"
                 "    evaluation/experiments/E5-errors-in-the-wild")
    inv = json.loads(inv_path.read_text())

    # Only the merged row inventory is written out; each row carries the shapes
    # graph its node shape came from, so the published-only view is a filter
    # rather than a second file.
    rows = inv["inventories"]["merged"]["rows"]

    def build_index(keep) -> dict:
        idx: dict[tuple[str, str], list] = defaultdict(list)
        for r in rows:
            if not keep(r):
                continue
            for cls in r["focusClasses"]:
                idx[(cls, r["pathKey"])].append(r)
        return idx

    merged = build_index(lambda r: True)
    published = build_index(lambda r: not r["fromVocab"])
    assert sum(len(v) for v in published.values()) >= 1

    # --- recover the defects, with the value facts the rules need -----------
    stage = V.STAGE
    if not (stage / "rudof-raw.json").exists():
        raise SystemExit("data/stage/ is empty — run validate.py first")
    keys = json.loads((stage / "keys.json").read_text())
    meta = json.loads((stage / "meta.json").read_text())
    # The committed run's own report, not a fresh one. This used to re-validate
    # the whole corpus with a second engine just to recover, per defect, *how*
    # the value was wrong. `validate.py` already wrote that down; reading it
    # back is both cheaper and stricter, because the defects bucketed here are
    # then the same objects the headline counted rather than a re-derivation
    # that has to be argued equal.
    ru = json.loads((stage / "rudof-raw.json").read_text())

    defects: list[dict] = []
    for key in keys:
        m = meta[key]
        for layer in ("L1", "L2"):
            rows = ru["records"].get(key, {}).get(layer)
            if rows is None:
                continue
            got, _ = V.classify(rows, m)
            for d in got:
                d["layer"] = layer
                defects.append(d)

    # L3 defects carry no SHACL result, so they come from the committed run.
    summary = json.loads((RESULTS / "summary.json").read_text())
    l3 = {k.split(":", 1)[1]: v for k, v in summary["by_component"].items()
          if k.startswith("L3:")}
    for comp, n in l3.items():
        for _ in range(n):
            defects.append({"layer": "L3", "component": comp, "path": "",
                            "focus_class": "", "value_kind": None,
                            "value_datatype": None})

    total = len(defects)
    assert total == summary["total_defects"], (
        f"recovered {total} defects, summary.json says {summary['total_defects']}")

    # --- bucket, twice -----------------------------------------------------
    out_merged: Counter = Counter()
    out_published: Counter = Counter()
    by_comp: defaultdict[str, Counter] = defaultdict(Counter)
    reasons: Counter = Counter()
    for d in defects:
        b, why = bucket(d, merged)
        out_merged[b] += 1
        by_comp[f"{d['layer']}:{d['component']}"][b] += 1
        reasons[(f"{d['layer']}:{d['component']}", b, why)] += 1
        # Against the profile as SEMIC publishes it: a constraint that only
        # exists because this study wrote it is not one a publisher's form would
        # have had either.
        bp, _ = bucket(d, published)
        if d["layer"] == "L2":
            bp = NOT_PREVENTED
        out_published[bp] += 1

    def pct(k: int) -> float:
        return round(100 * k / total, 1)

    prevented = out_merged[WIDGET] + out_merged[VALIDATION]
    prevented_pub = out_published[WIDGET] + out_published[VALIDATION]

    # Composition caveat, measured: DCAT-AP declares no sh:node at all, so a
    # form rooted at the Dataset shape projects a tree of exactly one node and
    # `validateTree` never reaches the distribution. Editing each class under
    # its own shape is the charitable reading and the one the numbers above
    # take; this counts what it costs if you do not.
    non_root = sum(1 for d in defects
                   if d["layer"] != "L3" and d["focus_class"] not in ("Dataset", ""))

    result = {
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total_defects": total,
        "old_claim": {
            "statement": "L1 and L2 are preventable at entry by construction",
            "pct_defects_preventable": summary["pct_defects_preventable"],
        },
        "measured_against_the_shapes_the_validator_ran": {
            "widget": out_merged[WIDGET], "pct_widget": pct(out_merged[WIDGET]),
            "validation": out_merged[VALIDATION],
            "pct_validation": pct(out_merged[VALIDATION]),
            "not_prevented": out_merged[NOT_PREVENTED],
            "pct_not_prevented": pct(out_merged[NOT_PREVENTED]),
            "prevented_total": prevented, "pct_prevented": pct(prevented),
        },
        "measured_against_the_published_profile_alone": {
            "widget": out_published[WIDGET], "pct_widget": pct(out_published[WIDGET]),
            "validation": out_published[VALIDATION],
            "pct_validation": pct(out_published[VALIDATION]),
            "not_prevented": out_published[NOT_PREVENTED],
            "pct_not_prevented": pct(out_published[NOT_PREVENTED]),
            "prevented_total": prevented_pub, "pct_prevented": pct(prevented_pub),
        },
        "by_component": [
            {"component": k, "widget": v[WIDGET], "validation": v[VALIDATION],
             "not_prevented": v[NOT_PREVENTED], "n": sum(v.values())}
            for k, v in sorted(by_comp.items(),
                               key=lambda kv: (-sum(kv[1].values()), kv[0]))
        ],
        "reasons": [
            {"component": k[0], "bucket": k[1], "reason": k[2], "n": v}
            for k, v in sorted(reasons.items(), key=lambda kv: (-kv[1], str(kv[0])))
        ],
        "form_inventory": {
            name: {k: v for k, v in inv["inventories"][name].items()
                   if k != "rows"}
            for name in ("published", "vocab", "merged")
        },
        "duplicate_path_fields": duplicate_paths(inv),
        # What "prevented by validation" is worth, stated in numbers rather
        # than in adjectives.
        "validation_gate": {
            "severities_seen": dict(Counter(
                d.get("severity") or "Violation"
                for d in defects if d["layer"] != "L3")),
            "non_violation_severities": sum(
                1 for d in defects if d["layer"] != "L3"
                and (d.get("severity") or "Violation") != "Violation"),
            "note": "form.isValid is false only for severity=violation, so a "
                    "warning would not gate anything. Every constraint in both "
                    "shapes graphs leaves sh:severity unstated, which SHACL "
                    "§2.1.2 defaults to sh:Violation.",
            "library_ships_no_submit_gate": True,
            "gate_note": "MetadataForm's <form> calls preventDefault on submit "
                         "and the library renders no submit button; "
                         "toTurtle()/toJsonLd() serialize unconditionally. "
                         "form.isValid is a boolean the host application must "
                         "choose to honour. 'Prevented by validation' therefore "
                         "means the form surfaces the violation and offers the "
                         "gate, not that the library closes it.",
        },
        "composition_caveat": {
            "sh_node_fields_in_profile":
                inv["inventories"]["merged"]["nested"],
            "defects_not_on_the_root_class": non_root,
            "pct": pct(non_root),
            "note": "DCAT-AP 3.0.1 declares no sh:node, so a form rooted at the "
                    "Dataset shape projects a tree of one node and validateTree "
                    "never reaches the distribution. The numbers above assume "
                    "each class is edited under its own shape.",
        },
    }
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "preventability.json").write_text(json.dumps(result, indent=1))
    render(result)
    print(json.dumps(result["measured_against_the_shapes_the_validator_ran"],
                     indent=1))


def duplicate_paths(inv: dict) -> dict:
    """How often the profile splits one predicate across several property shapes.

    This is the whole reason prevention-by-widget collapses for DCAT-AP, so it
    is counted rather than asserted.
    """
    out = {}
    rows = inv["inventories"]["merged"]["rows"]
    for name, keep in (("published", lambda r: not r["fromVocab"]),
                       ("vocab", lambda r: r["fromVocab"]),
                       ("merged", lambda r: True)):
        seen: Counter = Counter()
        for r in (x for x in rows if keep(x)):
            for cls in r["focusClasses"]:
                seen[(cls, r["pathKey"])] += 1
        multi = {k: v for k, v in seen.items() if v > 1}
        out[name] = {
            "distinct_class_path_pairs": len(seen),
            "pairs_with_more_than_one_field": len(multi),
            "max_fields_on_one_pair": max(seen.values()) if seen else 0,
            "extra_fields": sum(v - 1 for v in multi.values()),
        }
    return out


def render(r: dict) -> None:
    a = r["measured_against_the_shapes_the_validator_ran"]
    b = r["measured_against_the_published_profile_alone"]
    L = []
    L.append("# E5 — is it actually preventable?\n\n")
    L.append(f"Generated by `preventability.py` on {r['generated_utc']}. "
             "Every number is computed from `results/form-fields.json` (what "
             "the form renders, measured by `form_fields.harness.ts` against "
             "the real `buildFormModel`) joined to the corpus. Nothing is "
             "typed.\n\n")
    L.append(f"The claim under test: *\"{r['old_claim']['statement']}\"*, which "
             f"produced the headline **{r['old_claim']['pct_defects_preventable']}%**.\n\n")

    L.append("## Three numbers, not one\n\n")
    L.append("| | defects | share |\n|---|---:|---:|\n")
    L.append(f"| prevented by the **widget** (untypable) | {a['widget']} | "
             f"{a['pct_widget']}% |\n")
    L.append(f"| prevented by **validation** on commit | {a['validation']} | "
             f"{a['pct_validation']}% |\n")
    L.append(f"| **not prevented** | {a['not_prevented']} | "
             f"{a['pct_not_prevented']}% |\n")
    L.append(f"| prevented, either way | **{a['prevented_total']}** | "
             f"**{a['pct_prevented']}%** |\n")

    L.append("\nAgainst DCAT-AP 3.0.1 **as SEMIC publishes it** — no `sh:in`, "
             "no `sh:pattern`, so a form generated from it has neither the "
             "control nor the check:\n\n")
    L.append("| | defects | share |\n|---|---:|---:|\n")
    L.append(f"| widget | {b['widget']} | {b['pct_widget']}% |\n")
    L.append(f"| validation | {b['validation']} | {b['pct_validation']}% |\n")
    L.append(f"| not prevented | {b['not_prevented']} | {b['pct_not_prevented']}% |\n")
    L.append(f"| prevented, either way | **{b['prevented_total']}** | "
             f"**{b['pct_prevented']}%** |\n")

    L.append("\n## Why the widget number is what it is\n\n")
    d = r["duplicate_path_fields"]["merged"]
    L.append(f"The profile's generated SHACL splits one predicate across "
             f"several property shapes, and `buildFormModel` renders one field "
             f"per property shape without merging them. Of "
             f"{d['distinct_class_path_pairs']} distinct (class, path) pairs, "
             f"**{d['pairs_with_more_than_one_field']}** get more than one "
             f"field — up to {d['max_fields_on_one_pair']} controls over the "
             f"same predicate, {d['extra_fields']} extra fields in all. A "
             f"closed enumeration standing beside three open text boxes on the "
             f"same property does not make anything untypable, so almost "
             f"everything falls through to the commit-time check.\n")

    g = r["validation_gate"]
    L.append("\n## What \"prevented by validation\" is worth\n\n")
    L.append(f"{g['note']} Severities observed across the non-L3 defects: "
             f"{g['severities_seen']} — {g['non_violation_severities']} that "
             f"would not gate.\n\n")
    L.append(f"But: {g['gate_note']}\n")

    L.append("\n## Per constraint component\n\n")
    L.append("| component | widget | validation | not prevented | n |\n")
    L.append("|---|---:|---:|---:|---:|\n")
    for c in r["by_component"]:
        L.append(f"| `{c['component']}` | {c['widget']} | {c['validation']} | "
                 f"{c['not_prevented']} | {c['n']} |\n")

    L.append("\n## Every bucket decision, with its reason\n\n")
    L.append("| component | bucket | n | why |\n|---|---|---:|---|\n")
    for x in r["reasons"]:
        L.append(f"| `{x['component']}` | {x['bucket']} | {x['n']} | "
                 f"{x['reason']} |\n")

    L.append("\n## What the form renders for this profile\n\n")
    L.append("| inventory | node shapes | fields | read-only | complex path | "
             "nested sub-forms | closed controls |\n")
    L.append("|---|---:|---:|---:|---:|---:|---:|\n")
    for name, v in r["form_inventory"].items():
        L.append(f"| {name} | {v['nodeShapes']} | {v['fields']} | "
                 f"{v['readOnly']} | {v['complexPath']} | {v['nested']} | "
                 f"{v['closedControls']} |\n")
    L.append("\nE1's two largest gaps — `sh:or` (216 occurrences across nine "
             "profiles) and complex paths rendering read-only (634 fields) — do "
             "not appear here at all: this profile uses neither. That is why "
             "they contribute nothing to the *not prevented* column, and it is "
             "a fact about DCAT-AP rather than a clean bill of health for the "
             "form.\n")

    cc = r["composition_caveat"]
    L.append(f"\n## The caveat the numbers do not carry\n\n"
             f"Nested sub-form fields in this profile: "
             f"{cc['sh_node_fields_in_profile']}. {cc['note']} "
             f"**{cc['defects_not_on_the_root_class']}** of the defects "
             f"({cc['pct']}%) sit on a class other than the root, so under the "
             f"one-form reading they would be neither rendered nor "
             f"validated.\n")
    (RESULTS / "preventability.md").write_text("".join(L))


if __name__ == "__main__":
    main()
