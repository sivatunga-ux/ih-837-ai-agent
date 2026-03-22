# Encounters Data Analysis - 837 Processing Blueprint

This project defines an ingestion-first, production-grade blueprint for 837 encounter processing (837P, 837I, 837D) with a configuration-driven model, full auditability, and a Cursor-agent operating model.

## Objectives

- Build complete 837 parsing capability (all loops/segments, not node-specific parsing).
- Support million-transaction scale with deterministic, replayable ingestion.
- Preserve original data and transformed versions for user approval workflows.
- Make mappings, tags, and segment-level search UI-ready from day one.
- Enable safe parallel work with non-overlapping Cursor agent roles.

## Ingestion-First Architecture

1. Ingestion Gateway (API/File intake)
2. Immutable Raw Store
3. Envelope Validator (ISA/GS/ST checks)
4. Full Parser Engine (loop state machine, all 837 types)
5. Dual outputs:
   - Lossless JSON (round-trip safe)
   - Canonical JSON (normalized business model)
6. Mapping + Tagging Resolver
7. Segment Index Store (search-ready)
8. Validation Engine (syntax/structure/business)
9. Issue Store + Audit Event Store

## Project Files

- `AGENT_ROLES.md` - role boundaries and ownership matrix (no overlap).
- `ORCHESTRATION_WORKFLOW.md` - execution lifecycle and agent coordination process.
- `GUARDRAILS_TOKEN_USAGE.md` - token optimization and prompt discipline standards.
- `AUDIT_TRAIL_PROCESS.md` - attribution, audit comments, commit conventions.
- `CHANGE_AUDIT_LOG.md` - append-only project change log template and entries.
- `templates/` - task card and PR comment templates.

## Operating Rules

- Every task has one owner agent and one task ID.
- Every code change must carry agent attribution in commit metadata and log entries.
- No overlapping ownership of files/modules within a single task wave.
- Deterministic logic first; AI suggestions are advisory until approved.
