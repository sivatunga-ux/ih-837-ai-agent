from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Iterable


def utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class SubmissionJobStatus(str, Enum):
    QUEUED = "QUEUED"
    BUILDING_FILES = "BUILDING_FILES"
    READY = "READY"
    SUBMITTING = "SUBMITTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class SubmissionFileStatus(str, Enum):
    PENDING = "PENDING"
    BUILT = "BUILT"
    SENT = "SENT"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


@dataclass(frozen=True)
class SubmissionJob:
    submission_job_id: str
    job_name: str
    destination: str
    transport_type: str
    status: SubmissionJobStatus
    created_at: datetime = field(default_factory=utcnow)
    updated_at: datetime = field(default_factory=utcnow)
    started_at: datetime | None = None
    completed_at: datetime | None = None


@dataclass(frozen=True)
class SubmissionFile:
    submission_file_id: str
    submission_job_id: str
    artifact_id: str
    file_name: str
    claim_count: int
    status: SubmissionFileStatus
    payload_text: str
    checksum_sha256: str
    external_tracking_id: str | None = None
    sent_at: datetime | None = None
    ack_received_at: datetime | None = None
    created_at: datetime = field(default_factory=utcnow)
    updated_at: datetime = field(default_factory=utcnow)


@dataclass(frozen=True)
class BuildSubmissionFileInput:
    artifact_id: str
    file_name: str
    payload_text: str
    claim_ids: list[str]

    @property
    def claim_count(self) -> int:
        return len(self.claim_ids)

