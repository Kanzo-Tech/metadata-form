#!/usr/bin/env python
"""
E2 — the mechanical half of the migration: DASH annotations → SHACL-UI.

Rewrites `data/before/health-ri-core/*.ttl` (verbatim Health-RI, CC-BY-4.0) into
`data/after/health-ri-core-shacl12/*.ttl`:

  * `dash:editor dash:XEditor`  →  `shui:editor shui:X'Editor` (table below)
  * `dash:viewer …`             →  dropped. A capture form has no separate view
                                   mode; SHACL-UI's viewer terms exist, but this
                                   profile's 464 viewer triples carry no
                                   information the editor term does not.
  * `@prefix dash:`             →  `@prefix shui:`, dropped when unused

Nothing else changes: every `sh:path`, `sh:minCount`, `sh:maxCount`,
`sh:nodeKind`, `sh:datatype`, `sh:in`, `sh:node`, `sh:pattern`, `sh:name`,
`sh:description` and `sh:defaultValue` is carried across byte-for-byte, which is
what makes "property shapes preserved" a checkable claim rather than an
assertion. The conditional is *not* added here — it lives in the overlay
`data/after/overlay-04-shacl12-if.ttl`.

    python migrate.py
"""

from __future__ import annotations

import glob
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "data", "before", "health-ri-core")
DST = os.path.join(HERE, "data", "after", "health-ri-core-shacl12")

SHUI_NS = "http://www.w3.org/ns/shacl-ui/"

# dash: editor term -> SHACL-UI term. Every editor kind this profile uses has a
# SHACL-UI counterpart; `dash:URIEditor` is the only rename.
EDITOR_MAP = {
    "URIEditor": "IRIEditor",
    "TextFieldEditor": "TextFieldEditor",
    "TextAreaEditor": "TextAreaEditor",
    "DateTimePickerEditor": "DateTimePickerEditor",
    "EnumSelectEditor": "EnumSelectEditor",
    "BlankNodeEditor": "BlankNodeEditor",
}

VIEWER_LINE = re.compile(r"^\s*dash:viewer\s+dash:\w+\s*[;,.]?\s*$")
EDITOR_LINE = re.compile(r"(dash:editor\s+dash:)(\w+)")
PREFIX_LINE = re.compile(r"^@prefix\s+dash:\s+<[^>]*>\s*\.\s*$")


def migrate(text: str) -> tuple[str, dict[str, int]]:
    stats = {"viewers_dropped": 0, "editors_rewritten": 0, "unmapped": 0}
    out: list[str] = []
    for line in text.splitlines():
        if VIEWER_LINE.match(line):
            stats["viewers_dropped"] += 1
            continue
        if PREFIX_LINE.match(line):
            out.append(f"@prefix shui: <{SHUI_NS}> .")
            continue
        m = EDITOR_LINE.search(line)
        if m:
            term = EDITOR_MAP.get(m.group(2))
            if term is None:
                stats["unmapped"] += 1
            else:
                line = EDITOR_LINE.sub(lambda _m: f"shui:editor shui:{term}", line)
                stats["editors_rewritten"] += 1
        out.append(line)
    return "\n".join(out) + "\n", stats


def main() -> int:
    os.makedirs(DST, exist_ok=True)
    total = {"viewers_dropped": 0, "editors_rewritten": 0, "unmapped": 0, "files": 0}
    for src in sorted(glob.glob(os.path.join(SRC, "*.ttl"))):
        text, stats = migrate(open(src).read())
        with open(os.path.join(DST, os.path.basename(src)), "w") as fh:
            fh.write(text)
        for k, v in stats.items():
            total[k] += v
        total["files"] += 1
    print(total)
    if total["unmapped"]:
        raise SystemExit(f"{total['unmapped']} dash: editor term(s) with no SHACL-UI counterpart")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
