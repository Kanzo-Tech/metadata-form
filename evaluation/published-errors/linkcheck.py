#!/usr/bin/env python3
"""Published errors — probe one distribution link per sampled record.

This exists to keep the "preventable at entry" share honest. Every constraint a
SHACL profile can state is, by construction, one a shape-driven form can enforce
before submission - so a taxonomy built only from SHACL results would report
100% preventable and mean nothing. A dead link is the clearest defect that no
entry-time gate can prevent, so it has to be in the denominator.

Politeness, deliberately conservative:
  * at most ONE request per sampled record - the first dcat:accessURL only;
  * HEAD, never GET, so nothing is downloaded;
  * records are processed in an order that interleaves hosts, and a per-host
    minimum interval is enforced on top of the global one;
  * a descriptive User-Agent;
  * no retries - a flake is recorded as "unknown", not re-probed.

Only `gone` (404/410), `dns_fail` and `conn_fail` are counted as dead by
validate.py. 403/405/429 are recorded as `blocked` and are NOT counted: a portal
that refuses HEAD from an unknown client is not a broken link.

Output data/linkcheck.csv (NOT committed - it is a per-record status keyed by
record, i.e. exactly the leaderboard this study refuses to publish; the
aggregate goes to results/).

Usage: python linkcheck.py
"""

from __future__ import annotations

import csv
import json
import socket
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

from rdflib import Graph, Namespace, URIRef

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
RAW = DATA / "raw"
OUT = DATA / "linkcheck.csv"

DCAT = Namespace("http://www.w3.org/ns/dcat#")

USER_AGENT = (
    "keasy-metadata-form-published-errors/1.0 "
    "(academic metadata-quality study; HEAD only; one request per record)"
)
GLOBAL_INTERVAL = 0.8
HOST_INTERVAL = 20.0
TIMEOUT = 15

_last_global = 0.0
_last_host: dict[str, float] = defaultdict(float)


def probe(url: str) -> str:
    global _last_global
    host = urllib.parse.urlsplit(url).hostname or ""
    wait = max(GLOBAL_INTERVAL - (time.monotonic() - _last_global),
               HOST_INTERVAL - (time.monotonic() - _last_host[host]))
    if wait > 0:
        time.sleep(wait)
    _last_global = time.monotonic()
    _last_host[host] = time.monotonic()

    req = urllib.request.Request(url, method="HEAD",
                                 headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return "ok" if 200 <= resp.status < 400 else f"http_{resp.status}"
    except urllib.error.HTTPError as exc:
        if exc.code in (404, 410):
            return "gone"
        if exc.code in (401, 403, 405, 406, 429):
            return "blocked"
        if 500 <= exc.code < 600:
            return "server_error"
        return f"http_{exc.code}"
    except urllib.error.URLError as exc:
        reason = exc.reason
        if isinstance(reason, socket.gaierror):
            return "dns_fail"
        if isinstance(reason, (ssl.SSLError, ssl.SSLCertVerificationError)):
            return "tls_fail"
        if isinstance(reason, (ConnectionRefusedError, ConnectionResetError)):
            return "conn_fail"
        if isinstance(reason, socket.timeout) or "timed out" in str(reason):
            return "timeout"
        return "conn_fail"
    except (TimeoutError, socket.timeout):
        return "timeout"
    except Exception:
        return "unknown"


def first_access_url(path: Path, root: URIRef) -> str | None:
    g = Graph()
    try:
        g.parse(path, format="turtle")
    except Exception:
        return None
    for dist in sorted(g.objects(root, DCAT.distribution), key=str):
        for u in sorted(g.objects(dist, DCAT.accessURL), key=str):
            s = str(u)
            if s.startswith(("http://", "https://")):
                return s
    return None


def main() -> None:
    manifest = list(csv.DictReader((DATA / "manifest.csv").open()))
    todo = []
    for rec in manifest:
        url = first_access_url(RAW / f"{rec['key']}.ttl", URIRef(rec["dataset_iri"]))
        todo.append({"key": rec["key"], "url": url})

    done: dict[str, str] = {}
    if OUT.exists():
        done = {r["key"]: r["status"] for r in csv.DictReader(OUT.open())}

    # interleave hosts so no single server sees a burst
    by_host: dict[str, list] = defaultdict(list)
    for t in todo:
        h = urllib.parse.urlsplit(t["url"]).hostname if t["url"] else ""
        by_host[h or ""].append(t)
    order: list = []
    while any(by_host.values()):
        for h in list(by_host):
            if by_host[h]:
                order.append(by_host[h].pop(0))

    rows = []
    for i, t in enumerate(order, 1):
        if t["key"] in done:
            status = done[t["key"]]
        elif not t["url"]:
            status = "no_access_url"
        else:
            status = probe(t["url"])
        rows.append({"key": t["key"], "status": status})
        if i % 25 == 0:
            print(f"  probed {i}/{len(order)}")

    with OUT.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["key", "status"])
        w.writeheader()
        w.writerows(rows)
    counts: dict[str, int] = defaultdict(int)
    for r in rows:
        counts[r["status"]] += 1
    print(json.dumps(dict(sorted(counts.items(), key=lambda kv: -kv[1])), indent=1))


if __name__ == "__main__":
    main()
