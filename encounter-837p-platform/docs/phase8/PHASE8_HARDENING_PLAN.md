# Phase 8 Hardening Plan

This phase focuses on production hardening and closes critical gaps:

1. 837P renderer completion with golden-file testing.
2. SNIP-level validation model with external codeset governance.
3. Submission acknowledgement loop closure and operational reporting.

## Objectives

- Build deterministic, testable rendering and validation.
- Add structured controls for external codesets (versioned, auditable, reproducible).
- Improve reliability and observability of submission lifecycle.

## Subtask Agents (Recommended)

Use these as independent subtask workstreams. Each can run in parallel with limited coupling.

### Agent A: Renderer + Golden Files

Scope:
- Implement `platform_837p/renderer/` module for baseline 837P generation.
- Support subscriber, claim, and one service line in deterministic order.
- Add canonical serialization and control number generation service.
- Add golden-file tests under `tests_py/golden/` and `tests_py/test_renderer_golden.py`.

Definition of done:
- Renderer produces stable EDI output for fixture claims.
- Golden tests fail on any segment-order/content regression.

Deliverables:
- `platform_837p/renderer/models.py`
- `platform_837p/renderer/service.py`
- `platform_837p/renderer/control_numbers.py`
- `tests_py/golden/*.edi`
- `tests_py/test_renderer_golden.py`

### Agent B: SNIP Validation Framework + Codeset Validation

Scope:
- Introduce `snip_level` metadata for rules and execution reports.
- Split rules by SNIP level (L1-L7) and partner profile overlays.
- Add external codeset validator service with effective-date filtering and version pinning.
- Add rule result schema fields: `snip_level`, `codeset_version`, `partner_profile_id`.

Definition of done:
- Validation report includes SNIP level and deterministic pass/fail.
- Codeset version used in each run is persisted and queryable.

Deliverables:
- `platform_837p/validation/snip.py`
- `platform_837p/validation/codeset_validator.py`
- DB migration for codeset catalog/version/entries/run tracking.
- Unit tests for SNIP and codeset behavior.

### Agent C: Submission ACK Loop + Reliability

Scope:
- Add ingestion/parsing for TA1/999/277CA response payloads.
- Correlate acknowledgements to `submission_job` and `submission_file`.
- Implement state transition guardrails and retry policy.
- Add outcome metrics (`time_to_ack`, reject reason classes, retry count).

Definition of done:
- Submission lifecycle transitions are deterministic and auditable.
- Failed submissions can be retried safely with idempotency keys.

Deliverables:
- `platform_837p/submission/ack_parser.py`
- `platform_837p/submission/state_machine.py`
- migration for ack records and retry events
- tests for state transitions and correlation

### Agent D: Ops Reporting + Quality Gates

Scope:
- Expand nightly report to include trend deltas and top failing rule codes.
- Add release quality gate policy (must-pass suites + threshold checks).
- Produce summary markdown and machine-readable artifacts for dashboards.

Definition of done:
- Nightly artifacts include trend + fixed/new/ongoing failure slices.
- CI gate decision is deterministic and documented.

Deliverables:
- enhanced `scripts/nightly_validation_report.py`
- quality gate policy file + parser
- workflow updates and artifact docs

## Suggested Execution Order

1. Agent A (Renderer baseline) and Agent B (SNIP/codesets) start first.
2. Agent C starts once renderer artifacts and submission file schema are stable.
3. Agent D runs continuously and tightens gate policy as test reliability improves.

## Risk Controls

- Keep all domain APIs contract-tested before integration.
- Pin codeset versions for reproducible validation.
- Enforce schema migrations for every persistence change.
- Require golden-file updates to be explicit and reviewed.
