from __future__ import annotations

from dataclasses import asdict
from datetime import date
from hashlib import sha256
from typing import Optional, Sequence

from .models import AddressSnapshotInput, CoverageSnapshotInput, SnapshotRecord


class SnapshotService:
    """Creates deterministic coverage/address snapshots with monotonic versioning."""

    @staticmethod
    def _checksum(payload: dict) -> str:
        normalized = str(payload).encode("utf-8")
        return sha256(normalized).hexdigest()

    def build_coverage_payload(self, coverage: CoverageSnapshotInput) -> dict:
        return {
            "payer_name": coverage.payer_name,
            "plan_name": coverage.plan_name,
            "policy_number": coverage.policy_number,
            "group_number": coverage.group_number,
            "coverage_type": coverage.coverage_type,
            "effective_start": coverage.effective_start.isoformat(),
            "effective_end": coverage.effective_end.isoformat()
            if coverage.effective_end
            else None,
        }

    def build_address_payload(self, address: AddressSnapshotInput) -> dict:
        return {
            "address_type": address.address_type,
            "line_1": address.line_1,
            "line_2": address.line_2,
            "city": address.city,
            "state": address.state,
            "postal_code": address.postal_code,
            "country_code": address.country_code,
            "effective_start": address.effective_start.isoformat(),
            "effective_end": address.effective_end.isoformat()
            if address.effective_end
            else None,
        }

    def next_version(self, existing: Sequence[SnapshotRecord]) -> int:
        if not existing:
            return 1
        return max(item.snapshot_version for item in existing) + 1

    def create_coverage_snapshot(
        self,
        *,
        member_id: str,
        coverage: CoverageSnapshotInput,
        existing: Sequence[SnapshotRecord],
        captured_on: date,
    ) -> SnapshotRecord:
        payload = self.build_coverage_payload(coverage)
        checksum = self._checksum(payload)
        if existing and existing[-1].snapshot_checksum == checksum:
            return existing[-1]
        return SnapshotRecord(
            snapshot_version=self.next_version(existing),
            member_id=member_id,
            snapshot_type="COVERAGE",
            effective_start=coverage.effective_start,
            effective_end=coverage.effective_end,
            snapshot_payload=payload,
            snapshot_checksum=checksum,
            captured_on=captured_on,
        )

    def create_address_snapshot(
        self,
        *,
        member_id: str,
        address: AddressSnapshotInput,
        existing: Sequence[SnapshotRecord],
        captured_on: date,
    ) -> SnapshotRecord:
        payload = self.build_address_payload(address)
        checksum = self._checksum(payload)
        if existing and existing[-1].snapshot_checksum == checksum:
            return existing[-1]
        return SnapshotRecord(
            snapshot_version=self.next_version(existing),
            member_id=member_id,
            snapshot_type="ADDRESS",
            effective_start=address.effective_start,
            effective_end=address.effective_end,
            snapshot_payload=payload,
            snapshot_checksum=checksum,
            captured_on=captured_on,
        )

