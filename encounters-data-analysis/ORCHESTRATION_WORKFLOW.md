# Agent Orchestration Workflow (No Overlap)

This process defines how Cursor agents are scheduled, how tasks are isolated, and how handoffs are managed.

## 1) Planning Gate (Human + Lead Agent)

1. Create a `Wave` (e.g., `WAVE-001`).
2. Break work into task cards using `templates/agent-task-card.md`.
3. Assign each task card:
   - one owner agent role,
   - one bounded path scope,
   - one completion contract.
4. Reject any task card with overlapping path scope in the same wave.

## 2) Execution Gate (Parallel Work)

- Agents run in parallel only if path scopes do not overlap.
- If a task needs another module, create a dependency link instead of cross-editing.
- Any scope change requires planner approval and task card update.

## 3) Handoff Gate (Deterministic Contracts)

When a task is completed, owner agent must provide:

1. Changed files list
2. Tests executed and results
3. Known limitations
4. Structured handoff note for downstream owner

Downstream owners may consume outputs but cannot edit upstream-owned files in the same wave.

## 4) Merge Gate

Checklist before merge:

- [ ] Task card status: `DONE`
- [ ] No path overlap violations
- [ ] Commit message contains agent attribution
- [ ] `CHANGE_AUDIT_LOG.md` entry added
- [ ] PR comment includes issue links and validation notes

## 5) Hotfix Exception

For urgent fixes:

- Open `HOTFIX-*` task card
- Temporarily allow overlap with explicit approval
- Record root-cause and overlap justification in audit log

## 6) Ownership and Path Locks

Path lock policy:

- At wave start, lock owned paths to assigned agent role.
- Other roles can read but not modify locked paths.
- Lock release occurs only after task completion or wave closure.

## 7) Completion Definition

A task is complete only when:

- code merged in branch,
- validation evidence attached,
- audit entries recorded,
- downstream contracts satisfied.
