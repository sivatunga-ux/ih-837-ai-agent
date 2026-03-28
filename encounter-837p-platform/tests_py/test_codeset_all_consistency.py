from datetime import date

from platform_837p.codesets.catalog import (
    CATALOG,
    PURPOSE_CLAIM_837P_DIAGNOSIS,
    PURPOSE_CLAIM_837P_PROCEDURE,
    PURPOSE_CLAIM_STATUS,
)
from platform_837p.codesets.validator import (
    CodeValidationInput,
    CodesetRelease,
    InMemoryCodesetRepository,
    ValidationSeverity,
    validate_codes,
)


def test_all_catalog_codesets_follow_same_validation_shape() -> None:
    repo = InMemoryCodesetRepository()
    for defn in CATALOG:
        repo.add_release(
            CodesetRelease(
                codeset_name=defn.code_system,
                release_year=2026,
                release_phase="ANNUAL",
                effective_start=date(2025, 10, 1),
                effective_end=date(2026, 9, 30),
                codes={f"{defn.code_system}_VALID"},
            )
        )

    checks = [
        CodeValidationInput(code_system=defn.code_system, code="INVALID", field_path=f"claim.{defn.code_system.lower()}")
        for defn in CATALOG
    ]
    findings = validate_codes(repo=repo, checks=checks, service_date=date(2026, 1, 1))

    assert len(findings) == len(CATALOG)
    assert all(item.severity == ValidationSeverity.ERROR for item in findings)
    assert all(item.reason == "CODE_NOT_FOUND" for item in findings)


def test_purpose_filters_target_only_expected_codesets() -> None:
    diag_defs = CATALOG.by_purpose(PURPOSE_CLAIM_837P_DIAGNOSIS)
    proc_defs = CATALOG.by_purpose(PURPOSE_CLAIM_837P_PROCEDURE)
    status_defs = CATALOG.by_purpose(PURPOSE_CLAIM_STATUS)

    assert {d.code_system for d in diag_defs} == {"ICD10CM"}
    assert {"CPT", "HCPCS", "ICD10PCS"} == {d.code_system for d in proc_defs}
    assert {"CLAIM_STATUS_CODE"} == {d.code_system for d in status_defs}
