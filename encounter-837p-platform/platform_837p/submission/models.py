from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    SENT = "SENT"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class FileStatus(str, Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


@dataclass(frozen=True)
class SubmissionJobInput:
    destination: str
    transport_type: str
    submitted_by: str
    notes: str | None = None


@dataclass(frozen=True)
class SubmissionFileInput:
    artifact_id: str
    claim_id: str
    file_name: str
    file_sha256: str
    file_size_bytes: int


@dataclass(frozen=True)
class SubmissionJob:
    job_id: str
    destination: str
    transport_type: str
    submitted_by: str
    notes: str | None
    job_status: JobStatus
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True)
class SubmissionFile:
    file_id: str
    job_id: str
    artifact_id: str
    claim_id: str
    file_name: str
    file_sha256: str
    file_size_bytes: int
    file_status: FileStatus
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)


# Backward-compatible aliases for earlier naming.
SubmissionJobStatus = JobStatus
SubmissionFileStatus = FileStatus

