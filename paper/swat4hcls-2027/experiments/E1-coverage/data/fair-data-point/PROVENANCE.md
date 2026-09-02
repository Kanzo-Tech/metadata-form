# FAIR Data Point shapes — vendored snapshot

- Source: https://github.com/FAIRDataTeam/FAIRDataPoint
- Path: `src/main/resources/org/fairdatateam/fairdatapoint/service/reset/`
  (plus `src/main/resources/defaultNavigationShacl.ttl`)
- Commit: `5a113605a0746c3e2dfc1ff74a91f482f8fa2bc9` (2026-07-24)
- Release: **v1.22.0**, published 2026-07-24
- Retrieved: 2026-08-27
- Licence: **MIT** (`src/LICENSE`) — redistribution permitted.
- Publisher: FAIR Data Team (FDP reference implementation).

## Why this path

These are the shapes a running FAIR Data Point ships and **serves to its own
metadata editor** — the default set an instance is reset to. They are the closest
thing in the corpus to a profile authored *for a form* rather than for a
validator, which is why they carry `dash:editor` and `sh:order` on nearly every
property. The repository also holds a long trail of `database/mongo/migration/`
copies of earlier versions of these files; those are migration history, not the
current profile, and are not vendored.

The FDP-O ontology itself is published separately (fairdatapoint.org) and
contains no SHACL.
