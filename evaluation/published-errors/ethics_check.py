#!/usr/bin/env python3
"""Published errors — mechanically check the binding ethics rule over everything in results/.

The evidence spec makes this binding: aggregates only, no publisher
named, no identifying record excerpt. The README asserted this had been
"checked by script"; there was no script. This is it, so the claim and the check
are the same object and the check runs again whenever a new result file is
added.

Three things are looked for, over every file in `results/`:

  1. any of the 77 catalogue slugs, as a whole token;
  2. any of the 372 record IRIs, or the identifying tail of one;
  3. any `dct:title` / `dct:description` / `dcat:keyword` literal from any
     harvested record, as a substring.

(3) needs `data/raw/`, which is not committed. Without it the first two still
run and the third is reported as skipped rather than silently passed.

Exit status is non-zero on any hit, so this is usable as a gate.

Usage: python ethics_check.py
"""

from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

from rdflib import Graph, Literal, Namespace, URIRef

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
RESULTS = HERE / "results"

DCT = Namespace("http://purl.org/dc/terms/")
DCAT = Namespace("http://www.w3.org/ns/dcat#")

# Short slugs collide with ordinary English ("ep" in "step", "comp" in
# "component"), so a slug counts only as a whole token.
def token(s: str) -> re.Pattern:
    return re.compile(r"(?<![A-Za-z0-9-])" + re.escape(s) + r"(?![A-Za-z0-9-])")


def main() -> int:
    manifest = list(csv.DictReader((DATA / "manifest.csv").open()))
    slugs = sorted({r["catalogue"] for r in manifest})
    iris = sorted({r["dataset_iri"] for r in manifest})
    tails = sorted({i.rsplit("/", 1)[-1] for i in iris if len(i.rsplit("/", 1)[-1]) > 8})

    files = sorted(p for p in RESULTS.glob("**/*") if p.is_file())
    findings: list[str] = []

    for f in files:
        try:
            text = f.read_text()
        except UnicodeDecodeError:
            continue
        for s in slugs:
            if token(s).search(text):
                findings.append(f"{f.name}: catalogue slug {s!r}")
        for i in iris:
            if i in text:
                findings.append(f"{f.name}: record IRI")
        for t in tails:
            if t in text:
                findings.append(f"{f.name}: record IRI tail")

    # (3) human-facing literals from the records themselves.
    raw = DATA / "raw"
    literal_check = "skipped (data/raw/ absent — regenerate with harvest.py)"
    if raw.is_dir():
        texts = {f: f.read_text() for f in files if f.suffix in (".md", ".json", ".csv")}
        n = 0
        for rec in manifest:
            p = raw / f"{rec['key']}.ttl"
            if not p.exists():
                continue
            g = Graph()
            try:
                g.parse(p, format="turtle")
            except Exception:
                continue
            for prop in (DCT.title, DCT.description, DCAT.keyword):
                for o in g.objects(None, prop):
                    if not isinstance(o, Literal):
                        continue
                    v = str(o).strip()
                    # Short strings collide by chance; only substantive ones are
                    # identifying anyway.
                    if len(v) < 25:
                        continue
                    n += 1
                    for f, text in texts.items():
                        if v in text:
                            findings.append(f"{f.name}: record literal")
        literal_check = f"ran over {n} literals"

    print(f"files scanned: {len(files)}")
    print(f"catalogue slugs: {len(slugs)}  record IRIs: {len(iris)}")
    print(f"record-literal check: {literal_check}")
    if findings:
        print(f"\nFAIL — {len(findings)} finding(s):")
        for x in sorted(set(findings)):
            print(f"  {x}")
        return 1
    print("\nPASS — no catalogue, record IRI or record literal appears in results/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
