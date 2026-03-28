from platform_837p.codesets.catalog import all_codesets, codeset_purpose


def test_all_codesets_contains_core_sets() -> None:
    names = {item.name for item in all_codesets()}
    assert {"ICD10CM", "ICD10PCS", "CPT", "HCPCS", "POS", "NDC"} <= names


def test_codeset_purpose_returns_non_empty_text() -> None:
    assert "diagnosis" in codeset_purpose("ICD10CM").lower()
    assert "institutional" in codeset_purpose("ICD10PCS").lower()
    assert "procedure" in codeset_purpose("CPT").lower()

