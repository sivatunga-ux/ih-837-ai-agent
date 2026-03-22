# Cursor Agent Roles and Ownership Matrix

This document defines non-overlapping ownership for the Encounters Data Analysis project.

## Agent Directory Ownership (single writer per area)

| Agent ID | Role | Owns Paths | Does Not Edit |
|---|---|---|---|
| A1 | Intake and Envelope Agent | `services/ingestion/**`, `contracts/intake/**` | parser, rules, db schema |
| A2 | Parser Core Agent | `services/parser/**`, `profiles/loop-definitions/**` | ingestion api, rules, ui contracts |
| A3 | Mapping and Canonical Model Agent | `services/mapping/**`, `contracts/canonical/**`, `profiles/mappings/**` | parser tokenizer/state machine |
| A4 | Tagging and Search Agent | `services/indexing/**`, `contracts/search/**`, `profiles/tags/**` | parser core and validation logic |
| A5 | Validation Rules Agent | `services/validation/**`, `profiles/rules/**` | parser loop logic, db migrations |
| A6 | Versioning and Audit Agent | `services/versioning/**`, `services/audit/**`, `db/migrations/audit/**` | parser and rule implementations |
| A7 | Orchestration and Reliability Agent | `services/orchestration/**`, `infra/**`, `runbooks/**` | business mappings and rules |
| A8 | UI Contract Agent (ingestion-facing) | `contracts/ui/**`, `docs/api/**` | backend logic code |
| A9 | QA and Performance Agent | `tests/**`, `benchmarks/**`, `fixtures/**` | production service code (except test hooks) |
| A10 | Security and Compliance Agent | `security/**`, `policies/**`, `docs/compliance/**` | parser behavior and mappings |

## Role Charters (focused task definitions)

### A1 Intake and Envelope Agent
- Build upload/file intake contracts, file identity, checksum, idempotency keys.
- Implement ISA/GS/ST envelope pre-checks and reject reasons.
- Emit intake audit events only.

### A2 Parser Core Agent
- Implement delimiter detection and segment tokenizer.
- Build 837P/837I/837D loop state machine and segment capture.
- Output only lossless parse artifacts.

### A3 Mapping and Canonical Model Agent
- Transform lossless structures into canonical JSON models.
- Maintain profile-based field mapping registry.
- Publish mapping catalog metadata for UI dictionary.

### A4 Tagging and Search Agent
- Assign segment tags by profile rules.
- Maintain claim-level segment index records for search APIs.
- Ensure searchable fields align with UI contract requirements.

### A5 Validation Rules Agent
- Create syntax, structure, semantic, and business-rule engines.
- Maintain versioned rulesets and severity model.
- Produce deterministic issue records with rule identifiers.

### A6 Versioning and Audit Agent
- Manage claim version graph (`ORIGINAL`, `AUTO_CORRECTED`, `USER_EDITED`, `APPROVED`).
- Persist append-only audit events and actor attribution.
- Enforce no overwrite of original artifacts.

### A7 Orchestration and Reliability Agent
- Design queueing, retries, replay, DLQ, and back-pressure behavior.
- Define throughput SLOs and failure-handling runbooks.
- Manage workflow stage transitions and status consistency.

### A8 UI Contract Agent
- Define query contracts for mappings, tags, segment search, issue visibility.
- Maintain API docs and schema examples for frontend integration.
- Keep response formats stable and versioned.

### A9 QA and Performance Agent
- Build golden-corpus round-trip tests (EDI -> JSON -> EDI).
- Add scale tests for million-transaction batches.
- Validate deterministic replay and idempotency.

### A10 Security and Compliance Agent
- Define PHI handling controls and logging restrictions.
- Ensure encryption, retention, and access policy coverage.
- Validate audit sufficiency for compliance evidence.

## Handoff Contracts (no overlap)

1. A1 -> A2: normalized intake artifact + file metadata + raw pointer.
2. A2 -> A3/A4/A5: lossless parse output and parse diagnostics.
3. A3 -> A8: canonical schema + mapping dictionary metadata.
4. A4 -> A8: searchable index contract + tag taxonomy.
5. A5 -> A8: issue contract and validation explanation schema.
6. A6 -> all: audit event schema and version transition rules.
7. A9 validates outputs from all producer agents; cannot modify producer code paths.

## Conflict Prevention Rules

- One task card maps to one owner agent only.
- Any cross-path change requires a formal handoff and reassignment.
- If a task touches multiple owned paths, split into sub-tasks by owner.
- Reviewer agent must be different from author agent.
