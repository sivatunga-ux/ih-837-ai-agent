from __future__ import annotations

import argparse
import json
import sys
from datetime import date
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
    parser.add_argument("--input-file", type=Path, required=True, help="Path to sample claim JSON file.")
    parser.add_argument("--output-file", type=Path, required=True, help="Path to write validation report JSON.")
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


def main() -> int:
    args = parse_args()
    claim = json.loads(args.input_file.read_text(encoding="utf-8"))
    claim.setdefault("service_date", "2026-01-15")

    engine = ValidationEngine(default_ruleset(codeset_repo=_default_repo()))
    report = engine.validate(claim)

    output_payload = {
        "claim_id": claim.get("claim_id"),
        "status": report.status,
        "finding_count": len(report.findings),
        "findings": [
            {
                "rule_code": finding.rule_code,
                "severity": finding.severity.value if hasattr(finding.severity, "value") else str(finding.severity),
                "message": finding.message,
                "field_path": finding.field_path,
                "is_blocking": finding.is_blocking,
            }
            for finding in report.findings
        ],
    }
    args.output_file.parent.mkdir(parents=True, exist_ok=True)
    args.output_file.write_text(json.dumps(output_payload, indent=2), encoding="utf-8")
    print(f"Wrote validation agent report to {args.output_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

