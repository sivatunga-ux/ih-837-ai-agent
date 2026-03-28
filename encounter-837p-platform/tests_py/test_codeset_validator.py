from datetime import date

from platform_837p.codesets.validator import (
    CodeValidationInput,
    CodesetRelease,
    InMemoryCodesetRepository,
    ValidationSeverity,
    validate_codes,
)


def _repo() -> InMemoryCodesetRepository:
    repo = InMemoryCodesetRepository()

    repo.add_release(
        CodesetRelease(
            codeset_name="ICD10CM",
            release_year=2026,
            release_phase="ANNUAL",
            effective_start=date(2025, 10, 1),
            effective_end=date(2026, 3, 31),
            codes={"E119", "I10", "N186"},
        )
    )
    repo.add_release(
        CodesetRelease(
            codeset_name="ICD10CM",
            release_year=2026,
            release_phase="APRIL_UPDATE",
            effective_start=date(2026, 4, 1),
            effective_end=date(2026, 9, 30),
            codes={"E119", "I10", "N186", "Z992"},
        )
    )
    repo.add_release(
        CodesetRelease(
            codeset_name="ICD10PCS",
            release_year=2026,
            release_phase="ANNUAL",
            effective_start=date(2025, 10, 1),
            effective_end=date(2026, 3, 31),
            codes={"0JH60DZ"},
        )
    )
    repo.add_release(
        CodesetRelease(
            codeset_name="ICD10PCS",
            release_year=2026,
            release_phase="APRIL_UPDATE",
            effective_start=date(2026, 4, 1),
            effective_end=date(2026, 9, 30),
            codes={"0JH60DZ", "0JH63DZ"},
        )
    )
    return repo


def test_validate_codes_consistent_for_cm_and_pcs_same_date() -> None:
    repo = _repo()
    service_date = date(2026, 5, 2)  # Uses APRIL_UPDATE for both CM and PCS

    findings = validate_codes(
        repo=repo,
        checks=[
            CodeValidationInput(code_system="ICD10CM", code="Z992", field_path="claim.diagnoses[1]"),
            CodeValidationInput(code_system="ICD10PCS", code="0JH63DZ", field_path="claim.procedures[0]"),
        ],
        service_date=service_date,
    )

    assert findings == []


def test_validate_codes_uses_same_error_shape_for_any_codeset() -> None:
    repo = _repo()
    service_date = date(2026, 5, 2)

    findings = validate_codes(
        repo=repo,
        checks=[
            CodeValidationInput(code_system="ICD10CM", code="INVALIDCM", field_path="claim.diagnoses[0]"),
            CodeValidationInput(code_system="ICD10PCS", code="INVALIDPCS", field_path="claim.procedures[0]"),
        ],
        service_date=service_date,
    )

    assert len(findings) == 2
    assert findings[0].severity == ValidationSeverity.ERROR
    assert findings[1].severity == ValidationSeverity.ERROR
    assert findings[0].reason == "CODE_NOT_FOUND"
    assert findings[1].reason == "CODE_NOT_FOUND"
    assert findings[0].codeset_version_label == "FY2026_APRIL_UPDATE"
    assert findings[1].codeset_version_label == "FY2026_APRIL_UPDATE"


def test_validate_codes_respects_effective_dates_consistently() -> None:
    repo = _repo()

    # Z992 and 0JH63DZ are only in APRIL_UPDATE releases, not H1.
    findings = validate_codes(
        repo=repo,
        checks=[
            CodeValidationInput(code_system="ICD10CM", code="Z992", field_path="claim.diagnoses[0]"),
            CodeValidationInput(code_system="ICD10PCS", code="0JH63DZ", field_path="claim.procedures[0]"),
        ],
        service_date=date(2026, 2, 15),
    )

    assert len(findings) == 2
    assert all(item.reason == "CODE_NOT_FOUND" for item in findings)
    assert all(item.codeset_version_label == "FY2026_ANNUAL" for item in findings)
