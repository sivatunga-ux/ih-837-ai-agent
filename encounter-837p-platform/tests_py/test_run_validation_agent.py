import json
import subprocess
import sys
from pathlib import Path


def test_run_validation_agent_processes_directory_and_writes_consolidated_summary(tmp_path: Path) -> None:
    claims_dir = tmp_path / "claims"
    claims_dir.mkdir(parents=True, exist_ok=True)

    (claims_dir / "valid.json").write_text(
        json.dumps(
            {
                "claim_id": "40000000-0000-0000-0000-000000001001",
                "member_id": "10000000-0000-0000-0000-000000000001",
                "servicing_provider_npi": "1234567890",
                "diagnoses": ["E119", "I10"],
                "lines": [{"procedure_code": "99213"}],
                "service_date": "2026-01-15",
            }
        ),
        encoding="utf-8",
    )
    (claims_dir / "invalid.json").write_text(
        json.dumps(
            {
                "claim_id": "40000000-0000-0000-0000-000000001002",
                "member_id": "10000000-0000-0000-0000-000000000001",
                "servicing_provider_npi": "1234567890",
                "diagnoses": ["INVALIDDX"],
                "lines": [{"procedure_code": "INVALIDPROC"}],
                "service_date": "2026-01-15",
            }
        ),
        encoding="utf-8",
    )

    output_file = tmp_path / "report.json"
    summary_file = tmp_path / "report.md"
    script = Path(__file__).resolve().parents[1] / "agents" / "run_validation_agent.py"

    completed = subprocess.run(
        [
            sys.executable,
            str(script),
            "--input-dir",
            str(claims_dir),
            "--output-file",
            str(output_file),
            "--summary-file",
            str(summary_file),
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    assert "Wrote validation agent JSON report to" in completed.stdout
    assert "Wrote validation agent markdown summary to" in completed.stdout
    assert output_file.exists()
    assert summary_file.exists()

    payload = json.loads(output_file.read_text(encoding="utf-8"))
    assert payload["summary"]["total_claims"] == 2
    assert payload["summary"]["pass_count"] == 1
    assert payload["summary"]["fail_count"] == 1
    assert len(payload["claims"]) == 2

    status_by_claim_id = {item["claim_id"]: item["status"] for item in payload["claims"]}
    assert status_by_claim_id["40000000-0000-0000-0000-000000001001"] == "PASS"
    assert status_by_claim_id["40000000-0000-0000-0000-000000001002"] in {"RA_BLOCKED", "FAIL"}

    top_rules = payload["top_failing_rules"]
    top_rule_codes = {item["rule_code"] for item in top_rules}
    assert "CODESET-DIAG-001" in top_rule_codes
    assert "CODESET-PROC-001" in top_rule_codes

    markdown = summary_file.read_text(encoding="utf-8")
    assert "# Validation Agent Consolidated Summary" in markdown
    assert "## Claim Results" in markdown
    assert "## Top Failing Rules" in markdown
    assert "`40000000-0000-0000-0000-000000001001`" in markdown
    assert "`40000000-0000-0000-0000-000000001002`" in markdown
