# Guardrails: Token Usage and Focused Tasking

This document defines how Cursor agents should be run to minimize token usage, control cost, and maximize precision.

## Core Principles

1. Keep prompts narrow and module-scoped.
2. Pass only required context files, not full-repo dumps.
3. Avoid duplicate discovery: reuse shared task cards and findings.
4. Use deterministic checks before launching additional analysis.
5. Stop agents immediately when acceptance criteria are met.

## Prompt Discipline Standard

Each agent prompt must include:

- Task ID and role
- Allowed file paths
- Disallowed paths
- Input contracts
- Output contract
- Acceptance criteria
- "Do not explore outside listed files"

## Context Budgeting

### Maximum context payload per run

- Up to 8 files, unless explicitly justified.
- Prefer summaries over full file contents for large files.
- Share only relevant schema sections, not entire documents.

### Read strategy

1. First pass: names/signatures only.
2. Second pass: targeted sections.
3. Third pass: full file read only when required for edit correctness.

## Parallelization Guardrails

- Max 4 active agents in a wave.
- One module owner per wave.
- Shared interface docs are read-only for non-owner agents.

## Retry Policy

- Do not relaunch an agent with the same prompt unchanged.
- On retry, include explicit delta:
  - what failed
  - what to keep
  - what to change

## Task Granularity

Use task slices that fit in one focused agent pass:

- "Implement parser loop detection for 2000/2300 only"
- "Add audit event schema and migrations"
- "Implement segment tag indexing API filter by claim_id"

Avoid broad tasks:

- "Build parser and validation system end-to-end"

## Token-Saving Tactics

- Use checklists instead of long narratives.
- Prefer table outputs for mapping diffs.
- Ask agents for "changed files + rationale + tests run" only.
- Prohibit repeated architecture explanations after wave 1.

## Validation and Regression Test Gate

Before making new changes in any module, agents must satisfy the following:

1. Create or update validation test cases for the affected component.
2. Run regression tests at the component scope before merge.
3. Record test evidence in task handoff and PR comment (commands + pass/fail).

Scope policy:

- Regression testing is limited to individual components (module-level) by default.
- Full integration testing is a separate pipeline/activity and should not be bundled into every component change unless explicitly requested.
- If no component test suite exists, the owner agent must add a minimal baseline suite in the same task before code changes are considered complete.
## Termination Criteria

Stop an agent when:

- All acceptance criteria pass.
- Tests for owned scope pass.
- Output contract is complete.

Do not continue for speculative improvements unless opened as a new Task ID.
