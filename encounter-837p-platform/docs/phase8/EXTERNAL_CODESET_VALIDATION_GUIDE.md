# External Code Set Validation Guide

This guide defines how to operate code-set validation for 837 processing in a repeatable, auditable way.

## 1) Scope

Minimum code systems to support for robust 837P validation:

- ICD-10-CM diagnosis codes
- CPT/HCPCS procedure codes
- Place of Service (POS) codes
- NPI reference checks (for provider shape/format and optionally existence checks)
- Payer-specific claim frequency and status code lists (profile-driven)

## 2) Core operating model

1. Ingest code sets from authoritative source.
2. Normalize into canonical CSV/JSON shape.
3. Produce immutable versioned bundle (`codeset_version_id`).
4. Validate bundle integrity (row counts, checksums, required columns).
5. Publish bundle to runtime store.
6. Pin each validation/render run to a `codeset_version_id`.
7. Keep previous versions for replay and audit.

## 3) Data model recommendations

Use these logical tables (or equivalent):

- `codeset_catalog`
  - `codeset_name` (ICD10CM, CPT, HCPCS, POS, ...)
  - `authority`
  - `description`

- `codeset_versions`
  - `codeset_version_id` (immutable)
  - `codeset_name`
  - `effective_from`
  - `effective_to`
  - `published_at`
  - `source_uri`
  - `source_checksum`
  - `status` (DRAFT, PUBLISHED, RETIRED)

- `codeset_entries`
  - `codeset_version_id`
  - `code`
  - `display`
  - `effective_from`
  - `effective_to`
  - `attributes` (json)

- `codeset_publish_audit`
  - who/when/why and validation metrics

## 4) Runtime behavior

At validation time:

- Resolve active `codeset_version_id` by transaction date and payer profile.
- Validate each code against the resolved version.
- Emit findings with:
  - `rule_code`
  - `code_system`
  - `invalid_code`
  - `codeset_version_id`
  - `field_path`
  - severity + blocking flag

At render time:

- Re-validate critical code systems against same pinned `codeset_version_id`.
- Persist version id in render artifact metadata for replay.

## 5) Change management rules

- Never mutate published versions.
- All changes create a new version.
- Enforce dual-check:
  - structural checks (schema, required columns)
  - semantic checks (no duplicate active code rows, valid date windows)
- Promote DRAFT -> PUBLISHED only after:
  - validation suite pass
  - diff review
  - business sign-off for partner-impacting changes

## 6) Validation checks to implement

For each published bundle:

- File-level:
  - checksum match
  - expected row count range
  - no null in required fields

- Row-level:
  - code format regex by system
  - no overlapping effective windows for same code
  - normalized casing and trimmed whitespace

- Cross-set:
  - payer profile references only existing codes
  - no future-effective set accidentally marked active

## 7) Failure policy

- Missing required code set version: fail closed (blocking).
- Invalid code in claim:
  - severity by rule profile (WARN for optional, ERROR/FATAL for required)
- Codeset runtime unavailable:
  - if cache has valid pinned version: continue with warning
  - else fail closed for submission path

## 8) Suggested cadence

- Monthly scheduled code set update cycle
- Emergency out-of-band patch path with explicit approval
- Nightly smoke validation using current and next DRAFT versions

## 9) Recommended artifacts per release

- `manifest.json` (version metadata + checksums)
- `entries.csv` (canonical rows)
- `diff_report.md` (added/removed/changed codes)
- `validation_report.json` (quality metrics)
- release note with impacted rule codes and partners

