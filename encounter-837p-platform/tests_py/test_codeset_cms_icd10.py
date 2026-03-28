from platform_837p.codesets.cms_icd10 import build_default_periods, cms_zip_url_candidates


def test_default_periods_for_year() -> None:
    periods = build_default_periods(2026)
    assert len(periods) == 2
    assert periods[0].period_label == "FY2026_H1"
    assert periods[0].effective_start.isoformat() == "2025-10-01"
    assert periods[0].effective_end.isoformat() == "2026-03-31"
    assert periods[1].period_label == "FY2026_H2_APRIL_UPDATE"
    assert periods[1].effective_start.isoformat() == "2026-04-01"
    assert periods[1].effective_end.isoformat() == "2026-09-30"


def test_url_candidates_include_cm_and_pcs() -> None:
    urls = cms_zip_url_candidates(2026)
    flat = [x.url for x in urls]
    assert any("2026-code-descriptions-tabular-order.zip" in u for u in flat)
    assert any("2026-icd-10-pcs-codes-file.zip" in u for u in flat)
    assert any("april-1-2026-code-descriptions-tabular-order.zip" in u for u in flat)
    assert any("april-1-2026-icd-10-pcs-codes-file.zip" in u for u in flat)

