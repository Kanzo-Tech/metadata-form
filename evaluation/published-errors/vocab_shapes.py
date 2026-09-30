#!/usr/bin/env python3
"""Published errors — build the layer-2 shapes: controlled-vocabulary conformance.

DCAT-AP 3.0.1 *says*, in prose, that a handful of properties must take their
values from a named EU authority table. Its published SHACL file does not say
so: `dcat-ap-SHACL.ttl` contains zero `sh:in` and zero `sh:pattern`. A validator
run against the shipped shapes therefore cannot catch a value that is off the
mandated vocabulary, even though the specification forbids it.

This script writes that missing layer out as ordinary SHACL, so those defects
land in the same report and the same taxonomy as everything else, and so the
two layers can be reported separately.

Small, closed tables become `sh:in`. Tables too large to enumerate politely
(languages, IANA media types) become an `sh:pattern` namespace check, which is
weaker: it accepts a well-formed IRI in the right namespace even if the
concept does not exist. Where that matters it is stated in the results.

Outputs data/vocab-shapes.ttl (COMMITTED) and data/vocab/<table>.rdf (not
committed - regenerable).

Usage: python vocab_shapes.py
"""

from __future__ import annotations

import re
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
VOCAB_DIR = HERE / "data" / "vocab"
OUT = HERE / "data" / "vocab-shapes.ttl"

USER_AGENT = (
    "keasy-metadata-form-published-errors/1.0 "
    "(academic metadata-quality study; single-threaded; <=1 req/s)"
)

AUTHORITY = "http://publications.europa.eu/resource/authority/"

# Only the properties DCAT-AP 3.0.1 puts in its "controlled vocabularies that
# MUST be used" table. Its own text says of that class of requirement:
# "Validation systems SHOULD produce errors." Its own SHACL file contains zero
# sh:in, so no validator can. Nothing weaker is scored here:
#   * dcat:theme is MUST-have-at-least-one, and the sample is *defined* by
#     carrying the HEAL theme, so checking it would be circular;
#   * dct:accessRights is RECOMMENDED, dct:type on a Dataset is MAY - neither
#     is a violation and neither is counted.
IN_CHECKS = [
    ("dcat:Dataset", "dct:accrualPeriodicity", "frequency"),
    ("dcat:Distribution", "dct:format", "file-type"),
    ("dcat:Distribution", "adms:status", "distribution-status"),
    ("dcat:Distribution", "dcatap:availability", "planned-availability"),
]

# sh:uniqueLang. Not in the DCAT-AP SHACL file, but the official Health-RI
# formalisation of HealthDCAT-AP applies exactly these three - and only these
# three - in Core/PiecesShape/Dataset.ttl (lines 144, 411, 434), so a health
# data space would enforce them. Note it does NOT apply uniqueLang to
# dcat:keyword, and neither do we: many keywords in one language is normal.
UNIQUELANG_CHECKS = [
    ("dcat:Dataset", "dct:title"),
    ("dcat:Dataset", "dct:description"),
    ("dcat:Dataset", "adms:versionNotes"),
]

# sh:minLength. SHACL's sh:minCount is satisfied by an empty literal, so
# `dct:title ""` conforms to every published DCAT-AP and HealthDCAT-AP shape
# while carrying no title at all. No published profile adds sh:minLength. This
# one does, and says so: it is our construction, not the profile's.
MINLENGTH_CHECKS = [
    ("dcat:Dataset", "dct:title"),
    ("dcat:Dataset", "dct:description"),
]

# property -> namespace prefix, for tables we do not enumerate
NS_CHECKS = [
    ("dcat:Dataset", "dct:language", AUTHORITY + "language/"),
    ("dcat:Distribution", "dct:language", AUTHORITY + "language/"),
    # http/https and the bare host are all in live use for IANA media types and
    # all identify the same registry entry; rejecting the older forms would
    # manufacture 400+ violations out of a URL-scheme preference. Verified
    # against the sample before the pattern was written.
    ("dcat:Distribution", "dcat:mediaType",
     "https?://(www\\.)?iana\\.org/assignments/media-types/"),
]

PREFIXES = """@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix dcat:  <http://www.w3.org/ns/dcat#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix adms:  <http://www.w3.org/ns/adms#> .
@prefix dcatap: <http://data.europa.eu/r5r/> .
@prefix e5:    <https://example.org/e5/vocab-shapes#> .
"""


def fetch_table(table: str) -> list[str]:
    VOCAB_DIR.mkdir(parents=True, exist_ok=True)
    path = VOCAB_DIR / f"{table}.rdf"
    if not path.exists():
        req = urllib.request.Request(
            AUTHORITY + table,
            headers={"Accept": "application/rdf+xml", "User-Agent": USER_AGENT},
        )
        with urllib.request.urlopen(req, timeout=90) as resp:
            path.write_bytes(resp.read())
        time.sleep(1.0)
    text = path.read_text(encoding="utf-8", errors="replace")
    pat = re.compile(re.escape(AUTHORITY + table) + r"/([A-Za-z0-9_.+-]+)")
    # The RDF also carries the table's own version identifier (20260617-0) and
    # SKOS-XL label nodes (xl_en_0b6b4de6, d4e12775) under the same namespace.
    # They are not concepts and must not end up in the sh:in list.
    noise = re.compile(r"^(\d{8}-\d+|xl_[a-z]{2}_[0-9a-f]+|[0-9a-f]{8})$")
    return sorted({m.group(1) for m in pat.finditer(text)
                   if not noise.match(m.group(1))})


def main() -> None:
    lines = [PREFIXES, ""]
    lines.append("# Generated by vocab_shapes.py. Do not hand-edit.")
    lines.append("# Layer 2: constraints DCAT-AP 3.0.1 states in prose but does")
    lines.append("# not express in its published SHACL file.\n")

    for i, (cls, prop, table) in enumerate(IN_CHECKS):
        members = fetch_table(table)
        vals = " ".join(f"<{AUTHORITY}{table}/{m}>" for m in members)
        name = f"e5:In{i:02d}_{table.replace('-', '')}"
        lines.append(f"""{name} a sh:NodeShape ;
  sh:targetClass {cls} ;
  sh:property [
    sh:path {prop} ;
    sh:in ( {vals} ) ;
    sh:message "value is not a member of the EU authority table '{table}'" ;
  ] .
""")
        print(f"  {table}: {len(members)} concepts")

    for i, (cls, prop, ns) in enumerate(NS_CHECKS):
        name = f"e5:Ns{i:02d}"
        # backslashes are Turtle escapes as well as regex escapes; double them
        ns_ttl = ns.replace("\\", "\\\\")
        lines.append(f"""{name} a sh:NodeShape ;
  sh:targetClass {cls} ;
  sh:property [
    sh:path {prop} ;
    sh:pattern "^{ns_ttl}" ;
    sh:message "value is outside the vocabulary namespace the profile mandates" ;
  ] .
""")

    for i, (cls, prop) in enumerate(MINLENGTH_CHECKS):
        name = f"e5:NonEmpty{i:02d}"
        lines.append(f"""{name} a sh:NodeShape ;
  sh:targetClass {cls} ;
  sh:property [
    sh:path {prop} ;
    sh:minLength 1 ;
    sh:message "a mandatory property is present but its value is empty" ;
  ] .
""")

    for i, (cls, prop) in enumerate(UNIQUELANG_CHECKS):
        name = f"e5:Lang{i:02d}"
        lines.append(f"""{name} a sh:NodeShape ;
  sh:targetClass {cls} ;
  sh:property [
    sh:path {prop} ;
    sh:uniqueLang true ;
    sh:message "more than one value carries the same language tag" ;
  ] .
""")

    OUT.write_text("\n".join(lines))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
