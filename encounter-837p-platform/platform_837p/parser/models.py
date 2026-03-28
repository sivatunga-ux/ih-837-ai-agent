from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass(frozen=True)
class Subscriber:
    member_id: str | None
    last_name: str | None


@dataclass(frozen=True)
class ServiceLine:
    source_line_id: str
    procedure_code: str | None
    line_charge_amount: Decimal | None
    unit_count: Decimal | None


@dataclass(frozen=True)
class ParsedClaim:
    claim_id: str
    patient_control_number: str | None
    charge_amount: Decimal | None
    billing_provider_npi: str | None
    subscriber: Subscriber
    diagnoses: list[str] = field(default_factory=list)
    lines: list[ServiceLine] = field(default_factory=list)


@dataclass(frozen=True)
class ParsingIssue:
    message: str
    segment_index: int | None = None


@dataclass(frozen=True)
class ParsingResultChunk:
    claims: list[ParsedClaim]
    parsing_issues: list[ParsingIssue]
    is_done: bool

