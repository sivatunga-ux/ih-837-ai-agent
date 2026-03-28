from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


PY_FAILURE_RE = re.compile(r"^(FAILED|ERROR)\s+([^\s]+)", flags=re.MULTILINE)
JS_FAILURE_RE = re.compile(r"^not ok\s+\d+\s+-\s+(.+)$", flags=re.MULTILINE)


@dataclass(frozen=True)
class FailureItem:
    suite: str
    identifier: str

    @property
    def key(self) -> str:
        return f"{self.suite}:{self.identifier}"


def parse_python_failures(output: str) -> list[FailureItem]:
    failures = []
    for match in PY_FAILURE_RE.finditer(output):
        failures.append(FailureItem(suite="python", identifier=match.group(2)))
    return dedupe_failures(failures)


def parse_js_failures(output: str) -> list[FailureItem]:
    failures = []
    for match in JS_FAILURE_RE.finditer(output):
        failures.append(FailureItem(suite="javascript", identifier=match.group(1).strip()))
    # If node test run hard-fails before "not ok", capture first syntax/import error line.
    if not failures:
        for line in output.splitlines():
            if "SyntaxError:" in line or "ImportError:" in line:
                failures.append(FailureItem(suite="javascript", identifier=line.strip()))
                break
    return dedupe_failures(failures)


def dedupe_failures(items: Iterable[FailureItem]) -> list[FailureItem]:
    seen = set()
    output = []
    for item in items:
        if item.key in seen:
            continue
        seen.add(item.key)
        output.append(item)
    return output


def load_previous_failures(path: Path | None) -> list[FailureItem]:
    if path is None or not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    result = []
    for entry in payload.get("current_failures", []):
        suite = entry.get("suite", "unknown")
        identifier = entry.get("identifier", "")
        if identifier:
            result.append(FailureItem(suite=suite, identifier=identifier))
    return dedupe_failures(result)


def to_sorted_keys(items: Iterable[FailureItem]) -> list[str]:
    return sorted(item.key for item in items)


def map_from_keys(keys: Iterable[str]) -> list[dict]:
    rows = []
    for key in sorted(keys):
        suite, identifier = key.split(":", maxsplit=1)
        rows.append({"suite": suite, "identifier": identifier})
    return rows


def build_report(
    *,
    python_exit_code: int,
    js_exit_code: int,
    python_failures: list[FailureItem],
    js_failures: list[FailureItem],
    previous_failures: list[FailureItem],
) -> dict:
    current = dedupe_failures([*python_failures, *js_failures])
    current_keys = set(to_sorted_keys(current))
    previous_keys = set(to_sorted_keys(previous_failures))

    new_failures = current_keys - previous_keys
    fixed_failures = previous_keys - current_keys
    ongoing_failures = current_keys & previous_keys

    status = "PASS" if python_exit_code == 0 and js_exit_code == 0 and not current else "FAIL"

    return {
        "status": status,
        "python_exit_code": python_exit_code,
        "javascript_exit_code": js_exit_code,
        "counts": {
            "current_failures": len(current_keys),
            "new_failures": len(new_failures),
            "fixed_failures": len(fixed_failures),
            "ongoing_failures": len(ongoing_failures),
        },
        "current_failures": map_from_keys(current_keys),
        "new_failures": map_from_keys(new_failures),
        "fixed_failures": map_from_keys(fixed_failures),
        "ongoing_failures": map_from_keys(ongoing_failures),
    }


def to_markdown(report: dict) -> str:
    def section(title: str, rows: list[dict]) -> list[str]:
        out = [f"### {title} ({len(rows)})"]
        if not rows:
            out.append("- None")
            return out
        for row in rows:
            out.append(f"- `{row['suite']}`: {row['identifier']}")
        return out

    lines = [
        "## Nightly Validation Summary",
        f"- **Status:** {report['status']}",
        f"- **Python exit code:** {report['python_exit_code']}",
        f"- **JavaScript exit code:** {report['javascript_exit_code']}",
        "",
    ]
    lines.extend(section("New failures since previous run", report["new_failures"]))
    lines.append("")
    lines.extend(section("Fixed since previous run", report["fixed_failures"]))
    lines.append("")
    lines.extend(section("Still failing", report["ongoing_failures"]))
    lines.append("")
    lines.extend(section("Current failures (detailed)", report["current_failures"]))
    lines.append("")
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build nightly validation summary report.")
    parser.add_argument("--python-log", type=Path, required=True)
    parser.add_argument("--js-log", type=Path, required=True)
    parser.add_argument("--python-exit", type=int, required=True)
    parser.add_argument("--js-exit", type=int, required=True)
    parser.add_argument("--previous-json", type=Path)
    parser.add_argument("--output-json", type=Path, required=True)
    parser.add_argument("--output-md", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    python_log = args.python_log.read_text(encoding="utf-8") if args.python_log.exists() else ""
    js_log = args.js_log.read_text(encoding="utf-8") if args.js_log.exists() else ""

    report = build_report(
        python_exit_code=args.python_exit,
        js_exit_code=args.js_exit,
        python_failures=parse_python_failures(python_log),
        js_failures=parse_js_failures(js_log),
        previous_failures=load_previous_failures(args.previous_json),
    )

    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_md.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(json.dumps(report, indent=2), encoding="utf-8")
    args.output_md.write_text(to_markdown(report), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
