from __future__ import annotations

from decimal import Decimal, InvalidOperation
from pathlib import Path

from .models import ParsedClaim, ParsingIssue, ParsingResultChunk, ServiceLine, Subscriber


def _to_decimal(value: str | None) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(value)
    except InvalidOperation:
        return None


class Edi837Parser:
    """Lightweight 837 parser with chunked parse results."""

    def __init__(self, source: str | Path):
        path = Path(source)
        if path.exists():
            self._raw_text = path.read_text(encoding="utf-8")
        else:
            self._raw_text = str(source)
        self._claims: list[ParsedClaim] | None = None
        self._issues: list[ParsingIssue] | None = None
        self._cursor = 0

    @staticmethod
    def get_version() -> str:
        return "0.1.0"

    @staticmethod
    def get_license_info() -> str:
        return "Educational use parser for 837 examples."

    def __enter__(self) -> "Edi837Parser":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def _parse_all(self) -> tuple[list[ParsedClaim], list[ParsingIssue]]:
        claims: list[ParsedClaim] = []
        issues: list[ParsingIssue] = []
        segments = [seg.strip() for seg in self._raw_text.split("~") if seg.strip()]
        current: dict | None = None
        header_billing_provider_npi: str | None = None
        header_subscriber_member_id: str | None = None
        header_subscriber_last_name: str | None = None

        for index, seg in enumerate(segments):
            parts = seg.split("*")
            tag = parts[0]
            if tag == "NM1" and len(parts) >= 3:
                if parts[1] in {"41", "85", "82"}:
                    header_billing_provider_npi = parts[-1] if len(parts) > 1 else None
                if parts[1] == "IL":
                    header_subscriber_last_name = parts[3] if len(parts) > 3 else None
                    header_subscriber_member_id = parts[-1] if len(parts) > 1 else None
            if tag == "CLM":
                if current is not None:
                    claims.append(_build_claim(current))
                current = {
                    "claim_id": parts[1] if len(parts) > 1 else "UNKNOWN",
                    "patient_control_number": parts[1] if len(parts) > 1 else None,
                    "charge_amount": _to_decimal(parts[2] if len(parts) > 2 else None),
                    "billing_provider_npi": header_billing_provider_npi,
                    "subscriber_member_id": header_subscriber_member_id,
                    "subscriber_last_name": header_subscriber_last_name,
                    "diagnoses": [],
                    "lines": [],
                }
                continue

            if current is None:
                continue

            if tag == "NM1" and len(parts) >= 3:
                entity = parts[1]
                if entity == "IL":
                    current["subscriber_last_name"] = parts[3] if len(parts) > 3 else None
                    current["subscriber_member_id"] = parts[-1] if len(parts) > 1 else None
                elif entity in {"85", "82", "41"}:
                    current["billing_provider_npi"] = parts[-1] if len(parts) > 1 else None
            elif tag == "HI":
                for code_part in parts[1:]:
                    code = code_part.split(":")[-1].replace(".", "").upper()
                    if code:
                        current["diagnoses"].append(code)
            elif tag == "SV1":
                procedure = None
                if len(parts) > 1:
                    procedure = parts[1].split(":")[-1].replace(".", "").upper() or None
                line = ServiceLine(
                    source_line_id=str(len(current["lines"]) + 1),
                    procedure_code=procedure,
                    line_charge_amount=_to_decimal(parts[2] if len(parts) > 2 else None),
                    unit_count=_to_decimal(parts[4] if len(parts) > 4 else None),
                )
                current["lines"].append(line)
            elif tag == "SE":
                claims.append(_build_claim(current))
                current = None
            elif tag not in {"ST", "BHT", "HL", "SBR", "REF", "DTP", "N3", "N4", "LX"}:
                issues.append(ParsingIssue(message=f"Unhandled segment {tag}", segment_index=index))

        if current is not None:
            claims.append(_build_claim(current))
        return claims, issues

    def parse(self, chunk_size: int = 100) -> ParsingResultChunk:
        if self._claims is None or self._issues is None:
            self._claims, self._issues = self._parse_all()
            self._cursor = 0
        end = min(self._cursor + max(chunk_size, 1), len(self._claims))
        claim_slice = self._claims[self._cursor:end]
        is_done = end >= len(self._claims)
        issue_slice = self._issues if self._cursor == 0 else []
        self._cursor = end
        return ParsingResultChunk(claims=claim_slice, parsing_issues=issue_slice, is_done=is_done)

    def parse_all(self) -> ParsingResultChunk:
        if self._claims is None or self._issues is None:
            self._claims, self._issues = self._parse_all()
            self._cursor = len(self._claims)
        return ParsingResultChunk(claims=self._claims, parsing_issues=self._issues, is_done=True)


def _build_claim(payload: dict) -> ParsedClaim:
    return ParsedClaim(
        claim_id=payload.get("claim_id") or "UNKNOWN",
        patient_control_number=payload.get("patient_control_number"),
        charge_amount=payload.get("charge_amount"),
        billing_provider_npi=payload.get("billing_provider_npi"),
        subscriber=Subscriber(
            member_id=payload.get("subscriber_member_id"),
            last_name=payload.get("subscriber_last_name"),
        ),
        diagnoses=list(payload.get("diagnoses", [])),
        lines=list(payload.get("lines", [])),
    )

