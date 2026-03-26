from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class CoverageState:
    claim_id: str
    payer_name: str | None
    payer_plan_code: str | None
    policy_number: str | None
    group_number: str | None
    coverage_start_date: date | None
    coverage_end_date: date | None


@dataclass(frozen=True)
class AddressState:
    claim_id: str
    address_type: str
    line1: str
    line2: str | None
    city: str
    state_code: str
    postal_code: str
    country_code: str

