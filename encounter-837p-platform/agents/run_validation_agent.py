from __future__ import annotations

import argparse
import collections
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from platform_837p.codesets.validator import CodesetRelease, InMemoryCodesetRepository
from platform_837p.validation.engine import ValidationEngine
from platform_837p.validation.ruleset import default_ruleset


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run purpose-driven claim validation agent on sample claims.",
    )
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--input-file", type=Path, help="Path to sample claim JSON file.")
    input_group.add_argument("--input-dir", type=Path, help="Path to directory containing sample claim JSON files.")
    parser.add_argument("--output-file", type=Path, required=True, help="Path to write validation report JSON.")
    parser.add_argument(
        "--summary-file",
        type=Path,
        default=None,
        help="Path to write consolidated markdown summary (defaults to output-file with .md suffix).",
    )
    return parser.parse_args()


def _default_repo() -> InMemoryCodesetRepository:
    repo = InMemoryCodesetRepository()
    repo.add_release(
        CodesetRelease(
            codeset_name="ICD10CM",
            release_year=2026,
            release_phase="ANNUAL",
            effective_start=date(2025, 10, 1),
            effective_end=date(2026, 9, 30),
            codes={"E119", "I10", "N186", "Z992"},
        )
    )
    repo.add_release(
        CodesetRelease(
            codeset_name="CPT",
            release_year=2026,
            release_phase="ANNUAL",
            effective_start=date(2025, 10, 1),
            effective_end=date(2026, 9, 30),
            codes={"99212", "99213", "99214", "99215"},
        )
    )
    repo.add_release(
        CodesetRelease(
            codeset_name="HCPCS",
            release_year=2026,
            release_phase="ANNUAL",
            effective_start=date(2025, 10, 1),
            effective_end=date(2026, 9, 30),
            codes={"J3490"},
        )
    )
    return repo


def _read_claims(payload: object) -> list[dict]:
    if isinstance(payload, dict):
        claims = payload.get("claims")
        if isinstance(claims, list):
            return [item for item in claims if isinstance(item, dict)]
        return [payload]
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    raise ValueError("Claim payload must be a JSON object, array, or object with a claims array.")


def _load_claims(input_file: Path | None, input_dir: Path | None) -> list[tuple[str, dict]]:
    sources: list[Path] = []
    if input_file is not None:
        sources = [input_file]
    elif input_dir is not None:
        if not input_dir.exists() or not input_dir.is_dir():
            raise ValueError(f"Input directory does not exist or is not a directory: {input_dir}")
        sources = sorted(path for path in input_dir.rglob("*.json") if path.is_file())
    if not sources:
        raise ValueError("No input claim files found.")

    loaded: list[tuple[str, dict]] = []
    for source in sources:
        payload = json.loads(source.read_text(encoding="utf-8"))
        claims = _read_claims(payload)
        for index, claim in enumerate(claims):
            claim_id = claim.get("claim_id")
            display_source = str(source)
            if len(claims) > 1:
                display_source = f"{source}#claims[{index}]"
            if not claim_id:
                claim["claim_id"] = f"{source.stem}-{index + 1}"
            loaded.append((display_source, claim))
    return loaded


def _finding_payload(finding: object) -> dict:
    severity = finding.severity.value if hasattr(finding.severity, "value") else str(finding.severity)
    return {
        "rule_code": finding.rule_code,
        "severity": severity,
        "message": finding.message,
        "field_path": finding.field_path,
        "is_blocking": finding.is_blocking,
    }


def _is_failure_finding(finding: dict) -> bool:
    return bool(finding.get("is_blocking")) or str(finding.get("severity", "")).upper() in {"ERROR", "FATAL"}


def _build_markdown(output_payload: dict) -> str:
    summary = output_payload["summary"]
    claim_rows = output_payload["claims"]
    top_rules = output_payload["top_failing_rules"]

    lines = [
        "# Validation Agent Consolidated Summary",
        "",
        f"Generated at: {summary['generated_at_utc']}",
        "",
        "## Totals",
        "",
        f"- Total claims: **{summary['total_claims']}**",
        f"- Pass: **{summary['pass_count']}**",
        f"- Fail: **{summary['fail_count']}**",
        "",
        "## Claim Results",
        "",
        "| Source | Claim ID | Status | Findings |",
        "|---|---|---|---:|",
    ]
    for item in claim_rows:
        lines.append(
            f"| `{item['source']}` | `{item.get('claim_id')}` | `{item['status']}` | {item['finding_count']} |"
        )

    lines.extend(["", "## Top Failing Rules", ""])
    if not top_rules:
        lines.append("No failing rules were detected.")
    else:
        lines.extend(
            [
                "| Rank | Rule Code | Count |",
                "|---:|---|---:|",
            ]
        )
        for idx, item in enumerate(top_rules, start=1):
            lines.append(f"| {idx} | `{item['rule_code']}` | {item['count']} |")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    engine = ValidationEngine(default_ruleset(codeset_repo=_default_repo()))
    summary_file = args.summary_file or args.output_file.with_suffix(".md")
    claim_inputs = _load_claims(args.input_file, args.input_dir)

    claim_results: list[dict] = []
    failing_rule_counts: collections.Counter[str] = collections.Counter()

    for source, claim in claim_inputs:
        claim.setdefault("service_date", "2026-01-15")
        report = engine.validate(claim)
        findings = [_finding_payload(finding) for finding in report.findings]
        failing_rule_counts.update(item["rule_code"] for item in findings if _is_failure_finding(item))
        claim_results.append(
            {
                "source": source,
                "claim_id": claim.get("claim_id"),
                "status": report.status,
                "finding_count": len(findings),
                "findings": findings,
            }
        )

    pass_count = sum(1 for row in claim_results if row["status"] == "PASS")
    output_payload = {
        "summary": {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "total_claims": len(claim_results),
            "pass_count": pass_count,
            "fail_count": len(claim_results) - pass_count,
        },
        "claims": claim_results,
        "top_failing_rules": [
            {"rule_code": rule_code, "count": count}
            for rule_code, count in failing_rule_counts.most_common(10)
        ],
    }
    args.output_file.parent.mkdir(parents=True, exist_ok=True)
    summary_file.parent.mkdir(parents=True, exist_ok=True)
    args.output_file.write_text(json.dumps(output_payload, indent=2), encoding="utf-8")
    summary_file.write_text(_build_markdown(output_payload), encoding="utf-8")
    print(f"Wrote validation agent JSON report to {args.output_file}")
    print(f"Wrote validation agent markdown summary to {summary_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

