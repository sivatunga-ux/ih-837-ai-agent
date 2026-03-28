from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SnapshotType(str, Enum):
    COVERAGE = "COVERAGE"
    ADDRESS = "ADDRESS"


@dataclass(frozen=True)
class CoverageSnapshotInput:
    payer_name: str
    payer_id: str
    plan_type: str
    group_number: str
    policy_number: str
    relationship_code: str
    effective_date: str
    termination_date: str | None
    coverage_rank: int
    is_active: bool


@dataclass(frozen=True)
class AddressSnapshotInput:
    address_line_1: str
    address_line_2: str | None
    city: str
    state_code: str
    postal_code: str
    country_code: str
    address_type: str


@dataclass(frozen=True)
class SnapshotRecord:
    snapshot_id: str
    claim_id: str
    snapshot_type: SnapshotType
    snapshot_version: int
    reason: str
    snapshot_payload: dict
    snapshot_checksum: str
    changed: bool
    created_at: datetime = field(default_factory=utc_now)

