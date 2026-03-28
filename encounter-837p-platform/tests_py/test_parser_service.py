from pathlib import Path

from platform_837p.parser import Edi837Parser


def _fixture_path() -> Path:
    return Path(__file__).parent / "parser_fixtures" / "claim_837p_sample.edi"


def test_parser_extracts_claim_and_core_fields() -> None:
    parser = Edi837Parser(_fixture_path())
    result = parser.parse_all()

    assert result.is_done is True
    assert len(result.claims) == 1

    claim = result.claims[0]
    assert claim.patient_control_number == "PCN12345"
    assert claim.billing_provider_npi == "1234567890"
    assert claim.subscriber.member_id == "W123456789"
    assert claim.lines[0].procedure_code == "99213"


def test_parser_chunked_parse_mimics_stream_processing() -> None:
    parser = Edi837Parser(_fixture_path())
    result = parser.parse(chunk_size=1)
    assert len(result.claims) == 1
    assert result.is_done is True


def test_parser_exposes_version_and_license_info() -> None:
    assert Edi837Parser.get_version() == "0.1.0"
    assert "educational use" in Edi837Parser.get_license_info().lower()

