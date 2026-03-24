#!/usr/bin/env python3
"""
Daily repository refresh agent.

Responsibilities:
- Fetch and pull latest code for configured branch.
- Record daily git change summary.
- Run smoke tests (python + optional frontend static check).
- Emit status logs for operator visibility.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _run(cmd: list[str], cwd: Path) -> tuple[int, str, str]:
    p = subprocess.run(
        cmd,
        cwd=str(cwd),
        text=True,
        capture_output=True,
        check=False,
    )
    return p.returncode, p.stdout.strip(), p.stderr.strip()


@dataclass
class AgentConfig:
    repo_path: Path
    branch: str
    logs_dir: Path
    run_python_tests: bool
    python_test_path: str
    run_web_smoke: bool
    web_entry_file: str
    strict_fail_on_dirty_repo: bool

    @staticmethod
    def from_json(path: Path) -> "AgentConfig":
        raw = json.loads(path.read_text(encoding="utf-8"))
        return AgentConfig(
            repo_path=Path(raw["repo_path"]).resolve(),
            branch=str(raw.get("branch", "main")),
            logs_dir=Path(raw.get("logs_dir", "./logs")).resolve(),
            run_python_tests=bool(raw.get("tests", {}).get("run_python_tests", True)),
            python_test_path=str(raw.get("tests", {}).get("python_test_path", "")),
            run_web_smoke=bool(raw.get("tests", {}).get("run_web_smoke", True)),
            web_entry_file=str(raw.get("tests", {}).get("web_entry_file", "Index.html")),
            strict_fail_on_dirty_repo=bool(raw.get("git", {}).get("strict_fail_on_dirty_repo", False)),
        )


def _append_jsonl(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(payload, separators=(",", ":")) + "\n")


def _git_refresh(cfg: AgentConfig) -> dict[str, Any]:
    results: dict[str, Any] = {"stage": "git_refresh", "ok": False}
    rc, out, err = _run(["git", "status", "--porcelain"], cfg.repo_path)
    if rc != 0:
        results["error"] = f"git status failed: {err or out}"
        return results
    if out and cfg.strict_fail_on_dirty_repo:
        results["error"] = "working tree is dirty; strict mode enabled"
        results["dirty"] = True
        return results
    results["dirty"] = bool(out)

    rc, out, err = _run(["git", "fetch", "origin", cfg.branch], cfg.repo_path)
    if rc != 0:
        results["error"] = f"git fetch failed: {err or out}"
        return results
    results["fetch"] = out or "ok"

    rc, out, err = _run(["git", "pull", "origin", cfg.branch], cfg.repo_path)
    if rc != 0:
        results["error"] = f"git pull failed: {err or out}"
        return results
    results["pull"] = out or "ok"
    results["ok"] = True
    return results


def _collect_daily_change_log(cfg: AgentConfig) -> dict[str, Any]:
    today = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
    rc, out, err = _run(
        ["git", "log", "--since", f"{today} 00:00:00", "--oneline"],
        cfg.repo_path,
    )
    if rc != 0:
        return {"stage": "daily_changes", "ok": False, "error": err or out}
    commits = [line for line in out.splitlines() if line.strip()]
    return {
        "stage": "daily_changes",
        "ok": True,
        "date_utc": today,
        "commit_count": len(commits),
        "commits": commits,
    }


def _run_python_tests(cfg: AgentConfig) -> dict[str, Any]:
    if not cfg.run_python_tests:
        return {"stage": "python_tests", "ok": True, "skipped": True}
    if not cfg.python_test_path:
        return {"stage": "python_tests", "ok": False, "error": "python_test_path is empty"}
    rc, out, err = _run(["python3", "-m", "pytest", cfg.python_test_path, "-q"], cfg.repo_path)
    return {
        "stage": "python_tests",
        "ok": rc == 0,
        "command": f"python3 -m pytest {cfg.python_test_path} -q",
        "stdout": out,
        "stderr": err,
    }


def _run_web_smoke(cfg: AgentConfig) -> dict[str, Any]:
    if not cfg.run_web_smoke:
        return {"stage": "web_smoke", "ok": True, "skipped": True}
    entry = cfg.repo_path / cfg.web_entry_file
    if not entry.exists():
        return {"stage": "web_smoke", "ok": False, "error": f"missing file: {entry}"}
    text = entry.read_text(encoding="utf-8", errors="replace")
    has_html = "<html" in text.lower()
    has_script_ref = "app.js" in text
    return {
        "stage": "web_smoke",
        "ok": bool(has_html and has_script_ref),
        "entry": str(entry),
        "checks": {
            "has_html_tag": has_html,
            "references_app_js": has_script_ref,
        },
    }


def run_agent(config_path: Path) -> int:
    cfg = AgentConfig.from_json(config_path)
    cfg.logs_dir.mkdir(parents=True, exist_ok=True)

    day = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
    run_log = cfg.logs_dir / f"{day}.daily-refresh.json"
    event_log = cfg.logs_dir / "events.jsonl"

    report: dict[str, Any] = {
        "ts": _now_iso(),
        "agent": "daily-refresh-agent",
        "repo_path": str(cfg.repo_path),
        "branch": cfg.branch,
        "stages": [],
    }

    stage_git = _git_refresh(cfg)
    report["stages"].append(stage_git)
    _append_jsonl(event_log, {"ts": _now_iso(), **stage_git})
    if not stage_git.get("ok"):
        run_log.write_text(json.dumps(report, indent=2), encoding="utf-8")
        return 1

    stage_changes = _collect_daily_change_log(cfg)
    report["stages"].append(stage_changes)
    _append_jsonl(event_log, {"ts": _now_iso(), **stage_changes})

    stage_py = _run_python_tests(cfg)
    report["stages"].append(stage_py)
    _append_jsonl(event_log, {"ts": _now_iso(), **stage_py})

    stage_web = _run_web_smoke(cfg)
    report["stages"].append(stage_web)
    _append_jsonl(event_log, {"ts": _now_iso(), **stage_web})

    all_ok = all(s.get("ok", False) for s in report["stages"] if not s.get("skipped", False))
    report["ok"] = all_ok
    run_log.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return 0 if all_ok else 2


def main() -> int:
    parser = argparse.ArgumentParser(description="Run daily repo refresh and smoke tests.")
    parser.add_argument("--config", required=True, help="Path to JSON config file.")
    args = parser.parse_args()
    return run_agent(Path(args.config).resolve())


if __name__ == "__main__":
    raise SystemExit(main())
