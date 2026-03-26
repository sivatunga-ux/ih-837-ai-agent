from __future__ import annotations

import json
from dataclasses import asdict
from hashlib import sha256
from typing import Dict, List, Tuple
from uuid import uuid4

from .models import (
    AddressSnapshotInput,
    CoverageSnapshotInput,
    SnapshotRecord,
    SnapshotType,
)


class InMemorySnapshotStore:
    """Simple in-memory store keyed by (claim_id, snapshot_type)."""

    def __init__(self) -> None:
        self._data: Dict[Tuple[str, SnapshotType], List[SnapshotRecord]] = {}

    def get_history(self, claim_id: str, snapshot_type: SnapshotType) -> List[SnapshotRecord]:
        return list(self._data.get((claim_id, snapshot_type), []))

    def append(self, record: SnapshotRecord) -> None:
        key = (record.claim_id, record.snapshot_type)
        self._data.setdefault(key, []).append(record)


class SnapshotService:
    """Creates deterministic coverage/address snapshots with monotonic versioning."""

    def __init__(self, store: InMemorySnapshotStore) -> None:
        self._store = store

    @staticmethod
    def _checksum(payload: dict) -> str:
        normalized = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return sha256(normalized).hexdigest()

    def _next_version(self, claim_id: str, snapshot_type: SnapshotType) -> int:
        history = self._store.get_history(claim_id, snapshot_type)
        if not history:
            return 1
        return max(item.snapshot_version for item in history) + 1

    def snapshot_coverage(
        self,
        *,
        claim_id: str,
        input_data: CoverageSnapshotInput,
        reason: str,
    ) -> SnapshotRecord:
        payload = asdict(input_data)
        checksum = self._checksum(payload)
        history = self._store.get_history(claim_id, SnapshotType.COVERAGE)
        if history and history[-1].snapshot_checksum == checksum:
            existing = history[-1]
            return SnapshotRecord(
                snapshot_id=existing.snapshot_id,
                claim_id=existing.claim_id,
                snapshot_type=existing.snapshot_type,
                snapshot_version=existing.snapshot_version,
                reason=reason,
                snapshot_payload=existing.snapshot_payload,
                snapshot_checksum=existing.snapshot_checksum,
                changed=False,
            )
        record = SnapshotRecord(
            snapshot_id=str(uuid4()),
            claim_id=claim_id,
            snapshot_type=SnapshotType.COVERAGE,
            snapshot_version=self._next_version(claim_id, SnapshotType.COVERAGE),
            reason=reason,
            snapshot_payload=payload,
            snapshot_checksum=checksum,
            changed=True,
        )
        self._store.append(record)
        return record

    def snapshot_address(
        self,
        *,
        claim_id: str,
        input_data: AddressSnapshotInput,
        reason: str,
    ) -> SnapshotRecord:
        payload = asdict(input_data)
        checksum = self._checksum(payload)
        history = self._store.get_history(claim_id, SnapshotType.ADDRESS)
        if history and history[-1].snapshot_checksum == checksum:
            existing = history[-1]
            return SnapshotRecord(
                snapshot_id=existing.snapshot_id,
                claim_id=existing.claim_id,
                snapshot_type=existing.snapshot_type,
                snapshot_version=existing.snapshot_version,
                reason=reason,
                snapshot_payload=existing.snapshot_payload,
                snapshot_checksum=existing.snapshot_checksum,
                changed=False,
            )
        record = SnapshotRecord(
            snapshot_id=str(uuid4()),
            claim_id=claim_id,
            snapshot_type=SnapshotType.ADDRESS,
            snapshot_version=self._next_version(claim_id, SnapshotType.ADDRESS),
            reason=reason,
            snapshot_payload=payload,
            snapshot_checksum=checksum,
            changed=True,
        )
        self._store.append(record)
        return record

