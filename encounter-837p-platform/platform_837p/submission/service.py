from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List
from uuid import uuid4

from .models import (
    FileStatus,
    JobStatus,
    SubmissionFile,
    SubmissionFileInput,
    SubmissionJob,
    SubmissionJobInput,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SubmissionService:
    """In-memory submission orchestration for phase 7."""

    def __init__(self) -> None:
        self._jobs: Dict[str, SubmissionJob] = {}
        self._files_by_job: Dict[str, List[SubmissionFile]] = {}

    def create_job(self, data: SubmissionJobInput) -> SubmissionJob:
        now = _utc_now()
        job = SubmissionJob(
            job_id=str(uuid4()),
            destination=data.destination,
            transport_type=data.transport_type,
            submitted_by=data.submitted_by,
            notes=data.notes,
            job_status=JobStatus.QUEUED,
            created_at=now,
            updated_at=now,
        )
        self._jobs[job.job_id] = job
        self._files_by_job[job.job_id] = []
        return job

    def add_file(self, job_id: str, data: SubmissionFileInput) -> SubmissionFile:
        if job_id not in self._jobs:
            raise KeyError(f"Unknown submission job: {job_id}")

        now = _utc_now()
        submission_file = SubmissionFile(
            file_id=str(uuid4()),
            job_id=job_id,
            artifact_id=data.artifact_id,
            claim_id=data.claim_id,
            file_name=data.file_name,
            file_sha256=data.file_sha256,
            file_size_bytes=data.file_size_bytes,
            file_status=FileStatus.PENDING,
            created_at=now,
            updated_at=now,
        )
        self._files_by_job[job_id].append(submission_file)
        return submission_file

    def update_job_status(self, job_id: str, new_status: JobStatus) -> SubmissionJob:
        if job_id not in self._jobs:
            raise KeyError(f"Unknown submission job: {job_id}")

        current = self._jobs[job_id]
        now = _utc_now()
        updated = SubmissionJob(
            job_id=current.job_id,
            destination=current.destination,
            transport_type=current.transport_type,
            submitted_by=current.submitted_by,
            notes=current.notes,
            job_status=new_status,
            created_at=current.created_at,
            updated_at=now,
        )
        self._jobs[job_id] = updated
        return updated

