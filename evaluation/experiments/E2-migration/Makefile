# E2 — DASH-era encoding vs its SHACL 1.2 equivalent.
#
#   make            regenerate data/after/, run the engine, rewrite results/
#   make check      the same, but fail if any equivalence check breaks
#   make venv       create .venv and pin the rdflib used for measurement
#
# Every number in §6 of the paper is produced by this Makefile. Nothing in
# results/ is written by hand.
#
# There is one SHACL engine here: rudof, the engine the library ships and the
# engine that drives the form. rdflib is in the venv to *measure* graphs
# (counting, isomorphism); it never validates anything.

PY      := ./.venv/bin/python
REPO    := ../../..
HARNESS := evaluation/experiments/E2-migration/equivalence.harness.ts
VITEST  := npx vitest run --config evaluation/experiments/vitest.config.ts

.PHONY: all check venv clean

all: check

venv:
	uv venv --python 3.13 .venv
	VIRTUAL_ENV=$(PWD)/.venv uv pip install 'rdflib==7.6.0'

check: results/equivalence-rudof.json
	$(PY) report.py

results/equivalence-rudof.json: equivalence.harness.ts data/before data/after
	$(PY) migrate.py
	cd $(REPO) && $(VITEST) $(HARNESS)

clean:
	rm -rf data/after/health-ri-core-shacl12 results/equivalence-*.json results/metrics.json results/migration.md
