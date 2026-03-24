# Daily Refresh Agent

This agent refreshes your local repository daily, logs code changes, and runs basic application/web smoke checks.

## What it does

1. Runs `git fetch` + `git pull` on a configured branch.
2. Captures a daily changelog:
   - current branch and commit,
   - commit range pulled,
   - `git diff --name-status` summary,
   - recent commit list.
3. Runs smoke checks:
   - Python smoke test for ingestion gateway (optional),
   - web page smoke test (verifies `Index.html` + linked files exist and title is present).
4. Writes JSON logs in a date-partitioned folder.

## Files

- `daily_refresh_agent.py` - main runner
- `config.example.json` - runtime config template
- `install_cron.sh` - installs a daily cron job
- `tests/test_daily_refresh_agent.py` - component tests

## Quick start

```bash
python3 /workspace/encounters-data-analysis/ops/daily-refresh-agent/daily_refresh_agent.py \
  --config /workspace/encounters-data-analysis/ops/daily-refresh-agent/config.example.json
```

## Install daily schedule (cron)

```bash
bash /workspace/encounters-data-analysis/ops/daily-refresh-agent/install_cron.sh \
  python3 \
  /workspace/encounters-data-analysis/ops/daily-refresh-agent/config.example.json
```

Default schedule in script: `0 6 * * *` (daily at 06:00).

