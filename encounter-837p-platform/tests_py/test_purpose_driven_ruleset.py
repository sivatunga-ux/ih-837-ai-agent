from datetime import date

from platform_837p.codesets.validator import CodesetRelease, InMemoryCodesetRepository
from platform_837p.validation.engine import ValidationEngine
from platform_837p.validation.models import RuleSeverity
from platform_837p.validation.ruleset import default_ruleset


def _repo() -> InMemoryCodesetRepository:
    repo = InMemoryCodesetRepository()
    repo.add_release(
        CodesetRelease(
            codeset_name="ICD10CM",
            release_year=2026,
            release_phase="ANNUAL",
            effective_start=date(2025, 10, 1),
            effective_end=date(2026, 9, 30),
            codes={"E119", "I10"},
        )
    )
    repo.add_release(
        CodesetRelease(
            codeset_name="CPT",
            release_year=2026,
            release_phase="ANNUAL",
            effective_start=date(2025, 10, 1),
            effective_end=date(2026, 9, 30),
            codes={"99213"},
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


def test_purpose_driven_codeset_checks_pass_for_valid_claim() -> None:
    claim = {
        "claim_id": "40000000-0000-0000-0000-000000000801",
        "member_id": "10000000-0000-0000-0000-000000000001",
        "servicing_provider_npi": "1234567890",
        "diagnoses": ["E119", "I10"],
        "lines": [{"procedure_code": "99213"}],
        "service_date": date(2026, 1, 15),
    }
    engine = ValidationEngine(default_ruleset(codeset_repo=_repo()))
    report = engine.validate(claim)
    codes = {finding.rule_code for finding in report.findings}
    assert "CODESET-DIAG-001" not in codes
    assert "CODESET-PROC-001" not in codes


def test_purpose_driven_codeset_checks_flag_invalid_codes() -> None:
    claim = {
        "claim_id": "40000000-0000-0000-0000-000000000802",
        "member_id": "10000000-0000-0000-0000-000000000001",
        "servicing_provider_npi": "1234567890",
        "diagnoses": ["INVALIDDX"],
        "lines": [{"procedure_code": "INVALIDPROC"}],
        "service_date": date(2026, 1, 15),
    }
    engine = ValidationEngine(default_ruleset(codeset_repo=_repo()))
    report = engine.validate(claim)
    findings_by_code = {item.rule_code: item for item in report.findings}
    assert "CODESET-DIAG-001" in findings_by_code
    assert "CODESET-PROC-001" in findings_by_code
    assert findings_by_code["CODESET-DIAG-001"].severity == RuleSeverity.ERROR
    assert findings_by_code["CODESET-PROC-001"].severity == RuleSeverity.ERROR

