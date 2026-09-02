#!/usr/bin/env python3
"""E5 — harvest a sample of published health dataset records from data.europa.eu.

Everything goes through the public SPARQL endpoint (https://data.europa.eu/sparql).
Nothing here scrapes HTML and nothing here touches a path that
https://data.europa.eu/robots.txt disallows.

Four stages, all idempotent and resumable:

  1. FRAME   one query for the per-catalogue HEAL dataset counts, then one query
             per catalogue for its dataset IRIs (Virtuoso caps ORDER BY at 10 000
             rows, and no single catalogue exceeds that). The frame is written to
             data/frame/ and is *not* committed - it is 33 k IRIs and it is
             regenerable in ~2 minutes.

  2. SAMPLE  a stratified sample (stratum = catalogue) with a floor of 2 and a
             cap of 40 per stratum, drawn with a fixed seed so the draw is
             reproducible.

  3. FETCH   two anchored CONSTRUCT queries per sampled record: the dataset plus
             one hop into blank nodes and aggregator resources, then the blank
             children of its distributions. Written to data/raw/<key>.ttl.
             DESCRIBE is NOT used - see the comment above Q_RECORD.

  4. TYPES   one batched query for the rdf:type of every external IRI the
             records reference, so that DCAT-AP's sh:class constraints on
             vocabulary values can be evaluated at all.

Politeness: single-threaded, one request at a time, REQUEST_INTERVAL seconds
apart, with a descriptive User-Agent and a retry/backoff on 5xx.

Outputs
  data/frame/catalogues.json        per-catalogue HEAL counts (not committed)
  data/frame/<cat>.json             dataset IRIs per catalogue (not committed)
  data/raw/<key>.ttl                harvested record graphs (NOT committed - see README)
  data/ref-types.ttl                rdf:type of referenced IRIs (NOT committed)
  data/manifest.csv                 COMMITTED: sample membership + sha256 per record
  data/sample-frame.json            COMMITTED: frame sizes + sampling parameters

Usage
  python harvest.py frame
  python harvest.py sample
  python harvest.py fetch
  python harvest.py types
  python harvest.py all
"""

from __future__ import annotations

import csv
import hashlib
import json
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
FRAME_DIR = DATA / "frame"
RAW_DIR = DATA / "raw"

ENDPOINT = "https://data.europa.eu/sparql"
THEME = "http://publications.europa.eu/resource/authority/data-theme/HEAL"

USER_AGENT = (
    "keasy-metadata-form-E5/1.0 "
    "(academic metadata-quality study; single-threaded; <=1 req/s)"
)

# ---- sampling parameters (change these and the draw changes; they are recorded
# ---- verbatim in data/sample-frame.json) ------------------------------------
SEED = 20260827
TARGET_N = 250          # nominal proportional budget, before floor and cap
STRATUM_FLOOR = 2       # every catalogue that has records contributes >= 2
STRATUM_CAP = 40        # no catalogue contributes more than this
REQUEST_INTERVAL = 0.7  # seconds between requests

_last_request = 0.0


def _throttle() -> None:
    global _last_request
    wait = REQUEST_INTERVAL - (time.monotonic() - _last_request)
    if wait > 0:
        time.sleep(wait)
    _last_request = time.monotonic()


def sparql(query: str, accept: str = "application/sparql-results+json",
           timeout: int = 45, attempts: int = 3, post: bool = False) -> str:
    """Run one SPARQL query. Throttled, retried on 5xx, single-threaded.

    `post` is for the batched type query, whose VALUES clause overruns the
    server's URI length limit.
    """
    body = urllib.parse.urlencode({"query": query}).encode()
    url = ENDPOINT if post else ENDPOINT + "?" + body.decode()
    last_err: Exception | None = None
    for attempt in range(attempts):
        _throttle()
        headers = {"Accept": accept, "User-Agent": USER_AGENT}
        if post:
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        req = urllib.request.Request(
            url, data=body if post else None, headers=headers
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:  # noqa: PERF203
            last_err = exc
            if exc.code < 500:
                raise
        except Exception as exc:  # network hiccup
            last_err = exc
        time.sleep(2 ** attempt * 3)
    raise RuntimeError(f"SPARQL failed after retries: {last_err}")


def key_for(iri: str) -> str:
    """Stable filename key for a dataset IRI (not a secret, just a short name)."""
    return hashlib.sha1(iri.encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------- stage 1: frame

# Stratum = one source catalogue as the aggregator models it. Restricted to the
# aggregator's own catalogue namespace: a dataset is also linked from the
# original publisher catalogue IRI (e.g. an Italian regional portal), and
# counting both would double-count and would make the strata overlap.
CATALOGUE_NS = "http://data.europa.eu/88u/catalogue/"

# NB the namespace restriction is applied client-side, not in the query: adding
# a FILTER(STRSTARTS(...)) alongside the GROUP BY makes this Virtuoso instance
# return the correct counts against a repeated ?cat label. Verified 27 Aug 2026.
Q_CATALOGUES = f"""PREFIX dcat: <http://www.w3.org/ns/dcat#>
SELECT ?cat (COUNT(DISTINCT ?d) AS ?n) WHERE {{
  ?d a dcat:Dataset ; dcat:theme <{THEME}> .
  ?cat dcat:dataset ?d .
}} GROUP BY ?cat ORDER BY DESC(?n)"""


def q_datasets(cat: str) -> str:
    return f"""PREFIX dcat: <http://www.w3.org/ns/dcat#>
SELECT ?d WHERE {{
  ?d a dcat:Dataset ; dcat:theme <{THEME}> .
  <{cat}> dcat:dataset ?d .
}} ORDER BY ?d LIMIT 10000"""


def stage_frame() -> None:
    FRAME_DIR.mkdir(parents=True, exist_ok=True)
    cats_path = FRAME_DIR / "catalogues.json"
    if cats_path.exists():
        cats = json.loads(cats_path.read_text())
    else:
        rows = json.loads(sparql(Q_CATALOGUES))["results"]["bindings"]
        cats = [{"cat": r["cat"]["value"], "n": int(r["n"]["value"])} for r in rows
                if r["cat"]["value"].startswith(CATALOGUE_NS)]
        cats_path.write_text(json.dumps(cats, indent=1))
    print(f"frame: {len(cats)} catalogues, {sum(c['n'] for c in cats)} HEAL datasets")

    for i, c in enumerate(cats, 1):
        slug = c["cat"].rsplit("/", 1)[-1]
        out = FRAME_DIR / f"{slug}.json"
        if out.exists():
            continue
        rows = json.loads(sparql(q_datasets(c["cat"])))["results"]["bindings"]
        out.write_text(json.dumps([r["d"]["value"] for r in rows], indent=0))
        print(f"  [{i}/{len(cats)}] {slug}: {len(rows)} (declared {c['n']})")


# --------------------------------------------------------------- stage 2: sample


def allocate(counts: dict[str, int]) -> dict[str, int]:
    """Near-proportional allocation with a breadth floor and an anti-dominance cap.

    The floor guarantees every catalogue is represented, so the result speaks to
    the whole ecosystem rather than to whichever portal happens to be largest.
    The cap stops any one portal from driving the headline. Both distortions are
    undone for the population estimate by Horvitz-Thompson weights (see
    validate.py); the unweighted numbers are reported too, as a sensitivity.
    """
    total = sum(counts.values())
    alloc = {}
    for cat, n in counts.items():
        want = STRATUM_FLOOR + round(TARGET_N * n / total)
        alloc[cat] = int(min(n, STRATUM_CAP, max(STRATUM_FLOOR, want)))
    return alloc


def stage_sample() -> None:
    cats = json.loads((FRAME_DIR / "catalogues.json").read_text())
    counts: dict[str, int] = {}
    members: dict[str, list[str]] = {}
    for c in cats:
        slug = c["cat"].rsplit("/", 1)[-1]
        iris = json.loads((FRAME_DIR / f"{slug}.json").read_text())
        if not iris:
            continue
        counts[slug] = len(iris)
        members[slug] = sorted(iris)

    alloc = allocate(counts)
    rng = random.Random(SEED)
    sample: list[dict] = []
    for slug in sorted(members):
        picked = rng.sample(members[slug], alloc[slug])
        for iri in sorted(picked):
            sample.append({"catalogue": slug, "iri": iri, "key": key_for(iri)})

    frame_meta = {
        "harvested_from": ENDPOINT,
        "theme": THEME,
        "frame_built_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "seed": SEED,
        "target_n": TARGET_N,
        "stratum_floor": STRATUM_FLOOR,
        "stratum_cap": STRATUM_CAP,
        "n_catalogues": len(counts),
        "n_population": sum(counts.values()),
        "n_sample": len(sample),
        # stratum sizes and allocation are needed to reweight; catalogue slugs
        # are provenance, not a result - no result file joins them to violations.
        "strata": {s: {"N": counts[s], "n": alloc[s]} for s in sorted(counts)},
    }
    (DATA / "sample-frame.json").write_text(json.dumps(frame_meta, indent=1))
    (DATA / "sample.json").write_text(json.dumps(sample, indent=1))
    print(f"sample: n={len(sample)} over {len(counts)} strata "
          f"(population {frame_meta['n_population']})")


# ---------------------------------------------------------------- stage 3: fetch

# DESCRIBE is not usable here: this Virtuoso returns a blank node's identity but
# not its properties, so a record comes back with an empty dcat:contactPoint,
# dct:provenance, adms:identifier ... and validates as broken for reasons that
# are entirely the harvester's fault. Anchored CONSTRUCTs return the real
# closure. Verified 27 Aug 2026 - see results/wild-errors.md, "threats".
#
# Q1 = the dataset plus one hop, expanded only into blank nodes and aggregator
#      resources (a distribution, an agent). External IRIs - EU authority
#      concepts, publisher websites - are referenced, not described; the
#      validator marks constraints on them "not assessable" rather than failing
#      them, which is the honest reading.
# Q2 = the blank children of the distributions (checksum, licence document),
#      which is one hop deeper than Q1 reaches.
Q_RECORD = """PREFIX dqv: <http://www.w3.org/ns/dqv#>
CONSTRUCT {{ <{iri}> ?p ?o . ?o ?p2 ?o2 }}
WHERE {{
  <{iri}> ?p ?o .
  FILTER(?p != dqv:hasQualityMeasurement && ?p != dqv:hasQualityMetadata)
  OPTIONAL {{
    FILTER(isBlank(?o) || STRSTARTS(STR(?o), "http://data.europa.eu/88u/"))
    ?o ?p2 ?o2
  }}
}}"""

# Q2 names the predicates it follows. The obvious `?o ?p2 ?o2 . FILTER(isBlank(?o2))`
# form joins before it filters and times the endpoint out on records with many
# distributions; enumerating the predicates that can carry a blank child keeps
# the join small. If it still fails the record is kept without this hop, and the
# validator treats the resulting empty nodes as "not assessable" rather than as
# a defect.
Q_DIST_LEAVES = """PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX spdx: <http://spdx.org/rdf/terms#>
PREFIX odrl: <http://www.w3.org/ns/odrl/2/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX adms: <http://www.w3.org/ns/adms#>
CONSTRUCT {{ ?o2 ?p3 ?o3 }}
WHERE {{
  <{iri}> dcat:distribution ?o .
  VALUES ?p2 {{ spdx:checksum dct:license dct:rights dct:conformsTo
               dcat:accessService odrl:hasPolicy foaf:page adms:status
               dct:format dcat:mediaType dct:language }}
  ?o ?p2 ?o2 .
  FILTER(isBlank(?o2))
  ?o2 ?p3 ?o3
}}"""


def stage_fetch() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    sample = json.loads((DATA / "sample.json").read_text())
    rows = []
    for i, rec in enumerate(sample, 1):
        out = RAW_DIR / f"{rec['key']}.ttl"
        if not out.exists():
            a = sparql(Q_RECORD.format(iri=rec["iri"]), accept="text/turtle")
            try:
                b = sparql(Q_DIST_LEAVES.format(iri=rec["iri"]),
                           accept="text/turtle", timeout=30, attempts=2)
            except RuntimeError:
                b = "# Q_DIST_LEAVES timed out for this record\n"
                print(f"  [{i}] leaf query timed out; record kept without it")
            out.write_text(a + "\n" + b)
            if i % 25 == 0:
                print(f"  fetched {i}/{len(sample)}")
        blob = out.read_bytes()
        rows.append({
            "key": rec["key"],
            "catalogue": rec["catalogue"],
            "dataset_iri": rec["iri"],
            "sha256": hashlib.sha256(blob).hexdigest(),
            "bytes": len(blob),
        })

    with (DATA / "manifest.csv").open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["key", "catalogue", "dataset_iri",
                                           "sha256", "bytes"])
        w.writeheader()
        w.writerows(rows)
    print(f"fetch: {len(rows)} records, manifest written")


# --------------------------------------------------- stage 4: reference types

# NB: `VALUES ?s {{...}} ?s a ?t` returns the wrong answer on this Virtuoso -
# it duplicates one binding and silently drops the rest. `FILTER(?s IN (...))`
# is correct and just as fast. Verified 27 Aug 2026. Sent by POST because the
# batch overruns the server's URI length limit.
Q_TYPES = """SELECT DISTINCT ?s ?t WHERE {{ ?s a ?t . FILTER(?s IN ({iris})) }}"""


def stage_types() -> None:
    """Fetch rdf:type for the external IRIs the records point at.

    DCAT-AP constrains `dct:language` with `sh:class dct:LinguisticSystem` and
    `dcat:theme` with `sh:class skos:Concept`. Those types live in the mandated
    EU vocabularies, not in the record, so a validator that has not loaded them
    fails every conformant record. The aggregator's store already asserts them
    (`language/EST a dct:LinguisticSystem`, and so on) - this stage collects
    exactly those `rdf:type` triples and nothing else.

    Type facts are used only to let a constraint on the *referring* record be
    evaluated. The referenced node itself is never validated: validate.py treats
    a violation whose focus node exists only here as "not assessable".
    """
    from rdflib import Graph, URIRef  # local import: only this stage needs it

    refs: set[str] = set()
    roots = {r["iri"] for r in json.loads((DATA / "sample.json").read_text())}
    for path in sorted(RAW_DIR.glob("*.ttl")):
        g = Graph()
        try:
            g.parse(path, format="turtle")
        except Exception:
            continue
        for _, _, o in g:
            if isinstance(o, URIRef) and str(o) not in roots \
                    and not str(o).startswith("http://data.europa.eu/88u/"):
                refs.add(str(o))

    print(f"types: {len(refs)} distinct referenced IRIs")
    out = Graph()
    batch, size = [], 150
    todo = sorted(refs)
    for i in range(0, len(todo), size):
        batch = todo[i:i + size]
        iris = ", ".join(f"<{u}>" for u in batch if '"' not in u and ">" not in u)
        try:
            rows = json.loads(
                sparql(Q_TYPES.format(iris=iris), post=True))["results"]["bindings"]
        except Exception as exc:
            print(f"  batch {i // size}: failed ({exc}) - skipped")
            continue
        for r in rows:
            out.add((URIRef(r["s"]["value"]),
                     URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
                     URIRef(r["t"]["value"])))
        if (i // size) % 10 == 0:
            print(f"  batch {i // size + 1}/{(len(todo) + size - 1) // size}")
    out.serialize(destination=DATA / "ref-types.ttl", format="turtle")
    print(f"types: {len(out)} type assertions written")


def main() -> None:
    stage = sys.argv[1] if len(sys.argv) > 1 else "all"
    if stage in ("frame", "all"):
        stage_frame()
    if stage in ("sample", "all"):
        stage_sample()
    if stage in ("fetch", "all"):
        stage_fetch()
    if stage in ("types", "all"):
        stage_types()


if __name__ == "__main__":
    main()
