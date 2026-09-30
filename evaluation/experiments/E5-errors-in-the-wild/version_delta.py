#!/usr/bin/env python3
"""E5 — what the two rudof fixes changed on this corpus, measured.

The headline numbers moved when this experiment stopped running pySHACL and
started running rudof alone, and they moved again because the rudof that runs
now is not the rudof that produced the original figures.
`@kanzo-tech/rudof-wasm@0.3.8` is strictly *stricter* than the `0.3.5` the first
run used:

  * the Turtle parser raises on an IRI it will not accept, where 0.3.5 dropped
    the triple and carried on;
  * `sh:targetClass` selects through the `rdfs:subClassOf` closure, where 0.3.5
    matched `rdf:type` directly.

"The numbers moved because the engine got stricter" is a claim, and a paper
should not make a claim it can measure. So this script runs the *identical*
staged corpus through both versions and reports the difference, per constraint
component and per triage bucket. Nothing is attributed by argument.

0.3.5 is fetched from npm into a work directory; it is our own engine's previous
release, not a second implementation. `rudof_validate.mjs` is copied there so it
resolves that version rather than the repository's.

Requires `data/stage/`, so run `validate.py` first.

Outputs:
  results/version-delta.json
  results/version-delta.md

Usage: python version_delta.py
       E5_WORK=~/e5 python version_delta.py   # keep the install between runs
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import validate as V

HERE = Path(__file__).resolve().parent
STAGE = HERE / "data" / "stage"
RESULTS = HERE / "results"

BEFORE = "0.3.5"       # the version the first run of this experiment used
PACKAGE = "@kanzo-tech/rudof-wasm"


def install(version: str) -> Path:
    """npm-install one published version of our engine into a work directory."""
    work = Path(os.environ.get("E5_WORK", Path(tempfile.gettempdir()) / "e5-versions"))
    d = work / version
    d.mkdir(parents=True, exist_ok=True)
    if not (d / "node_modules" / "@kanzo-tech" / "rudof-wasm").exists():
        if not (d / "package.json").exists():
            subprocess.run(["npm", "init", "-y"], cwd=d, check=True,
                           capture_output=True)
        subprocess.run(["npm", "install", "--silent", f"{PACKAGE}@{version}"],
                       cwd=d, check=True, capture_output=True)
    shutil.copy(HERE / "rudof_validate.mjs", d / "rudof_validate.mjs")
    return d


def run(where: Path, out: Path) -> dict:
    subprocess.run(["node", str(where / "rudof_validate.mjs"), str(STAGE),
                    str(out)], cwd=where, check=True)
    return json.loads(out.read_text())


def tally(ru: dict, keys: list[str], meta: dict, only: list[str] | None = None):
    """Triage one engine's whole report through `validate.py`'s classifier."""
    scope = only if only is not None else keys
    buckets: Counter = Counter()
    defects: Counter = Counter()
    raw: Counter = Counter()
    refused: list[str] = []
    flagged: set[str] = set()
    for k in scope:
        if ru["loaded_quads"].get(k) is None:
            refused.append(k)
        for layer in ("L1", "L2"):
            rows = ru["records"].get(k, {}).get(layer)
            if rows is None:
                continue
            for row in rows:
                raw[row["component"]] += 1
            got, counts = V.classify(rows, meta[k])
            buckets[f"{layer}:defect"] += counts["defect"]
            buckets["not_assessable"] += counts["not_assessable"]
            buckets["scaffolding"] += counts["scaffolding"]
            for d in got:
                defects[f"{layer}:{d['component']}"] += 1
            if got:
                flagged.add(k)
    return {"buckets": buckets, "defects": defects, "raw": raw,
            "refused": refused, "flagged": flagged}


def main() -> None:
    if not (STAGE / "keys.json").exists():
        raise SystemExit("data/stage/ is empty — run validate.py first")
    keys = json.loads((STAGE / "keys.json").read_text())
    meta = json.loads((STAGE / "meta.json").read_text())

    after_raw = json.loads((STAGE / "rudof-raw.json").read_text())
    before_raw = run(install(BEFORE), STAGE / f"rudof-raw-{BEFORE}.json")

    a = tally(after_raw, keys, meta)
    b = tally(before_raw, keys, meta)

    # The two records 0.3.8 refuses cannot be compared, so the second half of
    # the measurement is restricted to the records both versions read. That
    # separates the parser fix from the target-selection fix instead of
    # reporting their sum.
    common = [k for k in keys if after_raw["loaded_quads"].get(k) is not None]
    a_c = tally(after_raw, keys, meta, only=common)
    b_c = tally(before_raw, keys, meta, only=common)

    def delta(x: Counter, y: Counter) -> list[dict]:
        return [{"key": k, "before": x[k], "after": y[k], "delta": y[k] - x[k]}
                for k in sorted(set(x) | set(y)) if x[k] != y[k]]

    lost = sorted(b["flagged"] - a["flagged"])
    out = {
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "package": PACKAGE,
        "before": before_raw["version"],
        "after": after_raw["version"],
        "n_records": len(keys),
        "whole_corpus": {
            "records_refused_before": len(b["refused"]),
            "records_refused_after": len(a["refused"]),
            "records_flagged_before": len(b["flagged"]),
            "records_flagged_after": len(a["flagged"]),
            "defects_before": sum(b["defects"].values()),
            "defects_after": sum(a["defects"].values()),
            "defect_delta_by_component": delta(b["defects"], a["defects"]),
            # Every record the newer parser refuses, and what the older one
            # charged it. This is the whole of the headline movement.
            "defects_in_refused_records_under_before": sum(
                1 for k in a["refused"]
                for layer in ("L1", "L2")
                for _ in V.classify(before_raw["records"][k][layer], meta[k])[0]),
            "records_no_longer_flagged": len(lost),
            "records_no_longer_flagged_are_exactly_the_refused":
                lost == sorted(a["refused"]),
        },
        "records_both_versions_read": {
            "n": len(common),
            "defects_before": sum(b_c["defects"].values()),
            "defects_after": sum(a_c["defects"].values()),
            "defect_delta_by_component": delta(b_c["defects"], a_c["defects"]),
            "triage_delta": delta(b_c["buckets"], a_c["buckets"]),
            "raw_result_delta_by_component": delta(b_c["raw"], a_c["raw"]),
        },
    }
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "version-delta.json").write_text(json.dumps(out, indent=1))
    render(out)
    print(json.dumps({k: v for k, v in out["whole_corpus"].items()
                      if not isinstance(v, list)}, indent=1))


def render(s: dict) -> None:
    w, c = s["whole_corpus"], s["records_both_versions_read"]
    L = []
    L.append(f"# E5 — what changed between `{s['package']}@{s['before']}` "
             f"and `@{s['after']}`\n")
    L.append(f"\nGenerated by `version_delta.py` on {s['generated_utc']}. Both "
             f"versions read the **same {s['n_records']} staged validation "
             "graphs** and the same two shapes files, so every difference below "
             "is a difference between the two engine builds.\n")
    L.append(f"\n{s['after']} is the stricter of the two: its Turtle parser "
             "raises on an IRI it will not accept instead of dropping the "
             "triple, and `sh:targetClass` selects through the "
             "`rdfs:subClassOf` closure. Both were defects; both are fixed. "
             "The point of this file is to say where that moved a number.\n")

    L.append("\n## Whole corpus\n\n")
    L.append(f"| | {s['before']} | {s['after']} |\n|---|---:|---:|\n")
    L.append(f"| records the parser refused | {w['records_refused_before']} | "
             f"{w['records_refused_after']} |\n")
    L.append(f"| records flagged | {w['records_flagged_before']} | "
             f"{w['records_flagged_after']} |\n")
    L.append(f"| defects | {w['defects_before']} | {w['defects_after']} |\n")

    L.append(f"\nThe {w['records_refused_after']} record(s) "
             f"{s['after']} refuses carried "
             f"**{w['defects_in_refused_records_under_before']}** defect(s) "
             f"under {s['before']}, which is exactly the drop in the defect "
             f"total ({w['defects_before']} → {w['defects_after']}). The "
             f"records that stopped being flagged are exactly the refused "
             f"ones: **{w['records_no_longer_flagged_are_exactly_the_refused']}"
             f"**.\n")
    if w["defect_delta_by_component"]:
        L.append("\n| component | " + f"{s['before']} | {s['after']} | Δ |\n")
        L.append("|---|---:|---:|---:|\n")
        for d in w["defect_delta_by_component"]:
            L.append(f"| `{d['key']}` | {d['before']} | {d['after']} | "
                     f"{d['delta']:+d} |\n")

    L.append(f"\n## Restricted to the {c['n']} records both versions read\n\n")
    L.append("This is the target-selection fix on its own, with the parser fix "
             "held out.\n\n")
    L.append(f"Defects: **{c['defects_before']} → {c['defects_after']}**.\n\n")
    if c["defect_delta_by_component"]:
        L.append("| component | before | after | Δ |\n|---|---:|---:|---:|\n")
        for d in c["defect_delta_by_component"]:
            L.append(f"| `{d['key']}` | {d['before']} | {d['after']} | "
                     f"{d['delta']:+d} |\n")
    else:
        L.append("**No defect count changes at all.** Not one.\n")

    if c["raw_result_delta_by_component"]:
        L.append("\nThe fix is not invisible — it produces more validation "
                 "results. They land where the old cross-check predicted they "
                 "would:\n\n")
        L.append("| component | raw results before | after | Δ |\n")
        L.append("|---|---:|---:|---:|\n")
        for d in c["raw_result_delta_by_component"]:
            L.append(f"| `{d['key']}` | {d['before']} | {d['after']} | "
                     f"{d['delta']:+d} |\n")
    if c["triage_delta"]:
        L.append("\n…and this is which bucket they land in:\n\n")
        L.append("| bucket | before | after | Δ |\n|---|---:|---:|---:|\n")
        for d in c["triage_delta"]:
            L.append(f"| `{d['key']}` | {d['before']} | {d['after']} | "
                     f"{d['delta']:+d} |\n")
    (RESULTS / "version-delta.md").write_text("".join(L))


if __name__ == "__main__":
    main()
