from platform_837p.validation.engine import ValidationEngine
from platform_837p.validation.ruleset import default_ruleset


def test_validation_engine_returns_findings_for_incomplete_claim() -> None:
    claim = {
        "claim_id": "40000000-0000-0000-0000-000000000200",
        "member_id": None,
        "servicing_provider_npi": "",
        "diagnoses": ["N186"],
        "lines": [{"procedure_code": "93000"}],
    }

    engine = ValidationEngine(default_ruleset())
    report = engine.validate(claim)

    assert report.status in {"RA_BLOCKED", "FAIL"}
    codes = {finding.rule_code for finding in report.findings}
    assert "REQ-IDENT-001" in codes
    assert "RA-ELIG-001" in codes
    assert "DX-ALIGN-001" in codes


def test_validation_engine_passes_valid_simple_claim() -> None:
    claim = {
        "claim_id": "40000000-0000-0000-0000-000000000201",
        "member_id": "10000000-0000-0000-0000-000000000001",
        "servicing_provider_npi": "1234567890",
        "diagnoses": ["E119", "I10"],
        "lines": [{"procedure_code": "99213"}],
    }

    engine = ValidationEngine(default_ruleset())
    report = engine.validate(claim)

    assert report.status == "PASS"
    assert report.findings == []
