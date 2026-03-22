# Audit Trail and Agent Attribution Process

This process ensures every change is attributable to one agent role, linked to one task, and traceable through code, commits, and PR discussions.

## 1) Required Identifiers

Every change must include:

- `TASK_ID`: unique task identifier (example: `EDA-ING-014`)
- `AGENT_ROLE`: one of the approved roles in `AGENT_ROLES.md`
- `WAVE_ID`: execution wave identifier (example: `WAVE-03`)

## 2) Commit Message Standard

Commit messages must follow:

`[TASK_ID][AGENT_ROLE] short imperative summary`

Examples:

- `[EDA-ING-014][Parser Agent] add 837D loop transitions`
- `[EDA-RULE-007][Validation Rules Agent] add structure checks for 2300`

## 3) Code-Level Attribution Comment

For non-trivial logic blocks, include a concise attribution comment:

```text
# task: EDA-ING-014 | agent: Parser Agent
```

Rules:

- Do not over-comment every line.
- Add comments where behavior is complex or policy-sensitive.
- Keep comments factual and short.

## 4) PR Description Attribution Block

Each PR must include:

- Task IDs completed
- Owning agent role per task
- Files touched by task
- Validation evidence summary
- Known limitations

Use `templates/pr-comment-template.md`.

## 5) Append-Only Change Log

All merged tasks must be recorded in `CHANGE_AUDIT_LOG.md`:

- Date/time (UTC)
- Task ID
- Agent role
- Commit SHA
- Summary
- Validation evidence
- Reviewer

No deletions or edits to previous entries; only append corrections.

## 6) File Ownership and Violation Handling

If a task touches files outside owned scope:

1. Mark task as `Scope Violation`.
2. Stop merge.
3. Re-assign with explicit exception approval from orchestrator.
4. Record violation in change log.

## 7) Decision and Exception Logging

Record decisions that affect architecture/rules in PR comments:

- Decision statement
- Alternatives considered
- Risk accepted
- Impacted modules

These comments become part of audit evidence.

## 8) Minimum Evidence Before Merge

No merge unless all are present:

- Lint/tests pass (or exception documented)
- Mapping/rules version updated where applicable
- Change log entry prepared
- PR attribution block complete
- Reviewer approval

