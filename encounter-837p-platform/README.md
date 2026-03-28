# encounter-837p-platform

Starter repository for an 837 encounter validation platform.

## What is included

- Deterministic rules engine in `rules/`
- Data contracts and demo samples in `data/`
- Advisory-only AI layer in `agent/`
- Simple browser UI in `ui/`
- Lightweight automated tests in `tests/`

## Local run

1. From this directory, run:
   - `npm test`
   - `npm run start`
2. Open `http://localhost:4173`.

## Python + PostgreSQL workflow

1. Install Python dependencies:
   - `python3 -m pip install -r requirements-dev.txt`
2. Run DB migration plan:
   - `python3 -m platform_837p.db.migrate --plan`
3. Apply schema migration:
   - `DATABASE_URL=postgresql://... python3 -m platform_837p.db.migrate`
4. Apply seed plan:
   - `python3 -m platform_837p.db.seed --plan`
5. Apply realistic sample seed:
   - `DATABASE_URL=postgresql://... python3 -m platform_837p.db.seed`

## Phase 3 validation engine

- Core engine: `platform_837p/validation/engine.py`
- Rule contracts: `platform_837p/validation/models.py`
- Sample rules: `platform_837p/validation/rules/`
- Default ruleset: `platform_837p/validation/ruleset.py`
- Tests: `tests_py/test_validation_engine.py`

## Phase 4 snapshot logic (coverage + address)

- Snapshot service: `platform_837p/snapshot/service.py`
- Snapshot models: `platform_837p/snapshot/models.py`
- New schema migration: `db/migrations/0002_snapshot_coverage_address.sql`
- Tests: `tests_py/test_snapshot_service.py`

## Phase 7 submission job + submission file

- Submission models/service: `platform_837p/submission/`
- New schema migration: `db/migrations/0003_submission_job_file.sql`
- New seed data: `db/seeds/0002_seed_submission_job_file.sql`
- Tests: `tests_py/test_submission_service.py`

## Phase 8 hardening kickoff docs

- Hardening plan + sub-agent task map: `docs/phase8/PHASE8_HARDENING_PLAN.md`
- External codeset validation SOP: `docs/phase8/EXTERNAL_CODESET_VALIDATION_GUIDE.md`
- Codeset templates:
  - `templates/codesets/codeset_manifest.template.yaml`
  - `templates/codesets/codeset_entries.template.csv`
  - `templates/codesets/codeset_validation_policy.template.yaml`

## ICD-10 external codeset loading (CMS)

- New migration for codeset catalog/version/entries and load runs:
  - `db/migrations/0004_external_codesets_icd10.sql`
- CMS ICD-10 downloader/parser and loader:
  - `platform_837p/codesets/cms_icd10.py`
  - `platform_837p/codesets/load_icd10.py`

Examples:

1. Plan migrations:
   - `python3 -m platform_837p.db.migrate --plan`
2. Apply migrations:
   - `DATABASE_URL=postgresql://... python3 -m platform_837p.db.migrate`
3. Download + load ICD-10-CM and ICD-10-PCS for FY range:
   - `DATABASE_URL=postgresql://... python3 -m platform_837p.codesets.load_icd10 --start-year 2024 --end-year 2026 --download-dir ./downloads/icd10`
4. Dry run (download + parse + CSV export only):
   - `python3 -m platform_837p.codesets.load_icd10 --start-year 2026 --end-year 2026 --download-dir ./downloads/icd10 --emit-csv-only`

## Project guardrails

- Deterministic validation rules are source of truth.
- AI output is advisory and never mutates claims.
- Business logic lives in `rules/`, not `ui/`.
