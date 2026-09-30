#!/usr/bin/env python3
"""Published errors — assemble the class hierarchy the `sh:class` constraints need.

`sh:class C` holds when a value node has `rdf:type/rdfs:subClassOf* C` **in the
data graph**. A record that says its contact point is a `vcard:Individual`
satisfies DCAT-AP's `sh:class vcard:Kind` only if the validator can also see
`vcard:Individual rdfs:subClassOf vcard:Kind`. Without it, every well-formed
contact point in the sample fails - which is a bug in the harness, not in the
records, and it is a bug this experiment made once before catching it.

So: fetch the vocabularies DCAT-AP's ranges are drawn from, keep only their
`rdfs:subClassOf` (and `owl:equivalentClass`) axioms, and merge that into every
record graph before validating. Nothing else from those files is used - no
domains, no ranges, no cardinalities - so this cannot mask or invent a defect,
it can only stop a subclass being mistaken for a wrong class.

Output data/class-hierarchy.ttl (COMMITTED - it is small and it is an input to
every number in the report).

Usage: python ontology.py
"""

from __future__ import annotations

import time
import urllib.request
from pathlib import Path

from rdflib import Graph, OWL, RDFS

HERE = Path(__file__).resolve().parent
CACHE = HERE / "data" / "ontologies"
OUT = HERE / "data" / "class-hierarchy.ttl"

USER_AGENT = (
    "keasy-metadata-form-published-errors/1.0 "
    "(academic metadata-quality study; single-threaded; <=1 req/s)"
)

SOURCES = [
    ("vcard", "http://www.w3.org/2006/vcard/ns", "text/turtle", "turtle"),
    ("dcat", "http://www.w3.org/ns/dcat.ttl", "text/turtle", "turtle"),
    ("dcterms", "https://www.dublincore.org/specifications/dublin-core/dcmi-terms/dublin_core_terms.ttl",
     "text/turtle", "turtle"),
    ("foaf", "http://xmlns.com/foaf/spec/index.rdf", "application/rdf+xml", "xml"),
    ("adms", "http://www.w3.org/ns/adms.ttl", "text/turtle", "turtle"),
    ("skos", "http://www.w3.org/2004/02/skos/core.rdf", "application/rdf+xml", "xml"),
    ("prov", "http://www.w3.org/ns/prov-o.ttl", "text/turtle", "turtle"),
    ("org", "http://www.w3.org/ns/org.ttl", "text/turtle", "turtle"),
]


def fetch(name: str, url: str, accept: str) -> bytes | None:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{name}.rdf"
    if path.exists():
        return path.read_bytes()
    req = urllib.request.Request(
        url, headers={"Accept": accept, "User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            blob = resp.read()
    except Exception as exc:
        print(f"  {name}: FETCH FAILED ({exc}) - skipped")
        return None
    path.write_bytes(blob)
    time.sleep(1.0)
    return blob


def main() -> None:
    out = Graph()
    for name, url, accept, fmt in SOURCES:
        blob = fetch(name, url, accept)
        if blob is None:
            continue
        g = Graph()
        try:
            g.parse(data=blob, format=fmt)
        except Exception as exc:
            print(f"  {name}: PARSE FAILED ({exc}) - skipped")
            continue
        n = 0
        for s, p, o in g.triples((None, RDFS.subClassOf, None)):
            if s.__class__.__name__ == "URIRef" and o.__class__.__name__ == "URIRef":
                out.add((s, p, o))
                n += 1
        for s, p, o in g.triples((None, OWL.equivalentClass, None)):
            if s.__class__.__name__ == "URIRef" and o.__class__.__name__ == "URIRef":
                out.add((s, RDFS.subClassOf, o))
                out.add((o, RDFS.subClassOf, s))
                n += 2
        print(f"  {name}: {n} subclass axioms")

    # Two axioms the published vocabularies do not carry but every DCAT-AP
    # implementation assumes. Stated here rather than hidden.
    extra = Graph()
    extra.parse(data="""
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:  <http://purl.org/dc/terms/> .
dct:LicenseDocument rdfs:subClassOf dct:RightsStatement .
dct:MediaType rdfs:subClassOf dct:MediaTypeOrExtent .
""", format="turtle")
    out += extra

    out.bind("rdfs", RDFS)
    out.serialize(destination=OUT, format="turtle")
    print(f"wrote {OUT} ({len(out)} axioms)")


if __name__ == "__main__":
    main()
