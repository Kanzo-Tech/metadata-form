# E7 inputs

## `permalink-v1-covid.txt`

One line: a **working** permalink to the bundled *HealthDCAT-AP · COVID-19
registry* example on the deployed playground,
<https://kanzo-tech.github.io/metadata-form/>.

It is a **v1 (embedded)** link — 4,538 characters of `lz-string`-compressed
fragment carrying `shapes.ttl` + `sample.ttl` inline — because the deployment is
built from `main`, whose `permalink.ts` understands only v1. The 67-character
v2 by-reference link this branch can produce does **not** resolve there; see
`../results/availability.md` §2.

Regenerate it from what the deployment actually ships:

```sh
git show origin/main:playground/examples/health-dcat-ap/shapes.ttl > /tmp/shapes.ttl
git show origin/main:playground/examples/health-dcat-ap/sample.ttl > /tmp/sample.ttl
node -e '
const fs = require("fs");
const { compressToEncodedURIComponent: z } = require("lz-string");
const wire = {
  v: 1,
  exampleId: "health-dcat-ap",
  shapesText: fs.readFileSync("/tmp/shapes.ttl", "utf8"),
  dataText:   fs.readFileSync("/tmp/sample.ttl", "utf8"),
  options: { validateOn: "change" },
};
console.log("https://kanzo-tech.github.io/metadata-form/#" + z(JSON.stringify(wire)));
'
```

The wire shape is `origin/main:playground/src/lib/permalink.ts` — `PermalinkState`
with `v: 1`, and `presets.ts` on that branch supplies `{ validateOn: "change" }`
as the COVID preset's options. Anything else decodes to `null` there and opens the
default example silently.

**Verified 28 Aug 2026** by loading the URL in a browser against the live
deployment and reading the rendered inputs: `COVID-19 Patient Registry`,
`Anonymised registry of COVID-19 cases collected during 2020-2022.`,
`epidemiology`, `covid-19`, `2023-01-15`.

Nothing else is vendored here: E7's inputs are the npm registry, the GitHub API
and this repository, all queried live by `../run.sh`.
