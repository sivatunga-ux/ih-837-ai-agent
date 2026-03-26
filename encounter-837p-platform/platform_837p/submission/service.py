from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from typing import Iterable, List
from uuid import uuid4

from .models import SubmissionFile, SubmissionFileStatus, SubmissionJob, SubmissionJobStatus


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_submission_job(
    *,
    destination: str,
    transport_type: str,
    created_by: str,
    file_count: int,
    idempotency_key: str | None = None,
) -> SubmissionJob:
    now = utc_now()
    return SubmissionJob(
        submission_job_id=str(uuid4()),
        destination=destination,
        transport_type=transport_type,
        job_status=SubmissionJobStatus.PENDING,
        created_by=created_by,
        file_count=file_count,
        success_count=0,
        failure_count=0,
        idempotency_key=idempotency_key,
        started_at=None,
        completed_at=None,
        created_at=now,
        updated_at=now,
    )


def new_submission_file(
    *,
    submission_job_id: str,
    claim_id: str,
    artifact_id: str | None,
    file_name: str,
    file_payload: str,
) -> SubmissionFile:
    now = utc_now()
    return SubmissionFile(
        submission_file_id=str(uuid4()),
        submission_job_id=submission_job_id,
        claim_id=claim_id,
        artifact_id=artifact_id,
        file_name=file_name,
        file_payload=file_payload,
        file_status=SubmissionFileStatus.PENDING,
        external_tracking_id=None,
        response_code=None,
        response_message=None,
        submitted_at=None,
        acknowledged_at=None,
        created_at=now,
        updated_at=now,
    )


def start_job(job: SubmissionJob) -> SubmissionJob:
    now = utc_now()
    return replace(
        job,
        job_status=SubmissionJobStatus.IN_PROGRESS,
        started_at=job.started_at or now,
        updated_at=now,
    )


def mark_file_sent(file: SubmissionFile, tracking_id: str | None = None) -> SubmissionFile:
    now = utc_now()
    return replace(
        file,
        file_status=SubmissionFileStatus.SENT,
        external_tracking_id=tracking_id,
        submitted_at=now,
        updated_at=now,
    )


def mark_file_acknowledged(
    file: SubmissionFile,
    *,
    response_code: str,
    response_message: str,
) -> SubmissionFile:
    now = utc_now()
    return replace(
        file,
        file_status=SubmissionFileStatus.ACKNOWLEDGED,
        response_code=response_code,
        response_message=response_message,
        acknowledged_at=now,
        updated_at=now,
    )


def mark_file_failed(
    file: SubmissionFile,
    *,
    response_code: str,
    response_message: str,
) -> SubmissionFile:
    now = utc_now()
    return replace(
        file,
        file_status=SubmissionFileStatus.FAILED,
        response_code=response_code,
        response_message=response_message,
        updated_at=now,
    )


def finalize_job(job: SubmissionJob, files: Iterable[SubmissionFile]) -> SubmissionJob:
    file_list: List[SubmissionFile] = list(files)
    success = sum(1 for item in file_list if item.file_status == SubmissionFileStatus.ACKNOWLEDGED)
    failure = sum(1 for item in file_list if item.file_status in {SubmissionFileStatus.FAILED, SubmissionFileStatus.REJECTED})

    if failure > 0 and success > 0:
        status = SubmissionJobStatus.PARTIAL
    elif failure > 0:
        status = SubmissionJobStatus.FAILED
    elif success == len(file_list):
        status = SubmissionJobStatus.COMPLETED
    else:
        status = SubmissionJobStatus.IN_PROGRESS

    now = utc_now()
    completed_at = now if status in {SubmissionJobStatus.COMPLETED, SubmissionJobStatus.PARTIAL, SubmissionJobStatus.FAILED} else None
    return replace(
        job,
        job_status=status,
        success_count=success,
        failure_count=failure,
        completed_at=completed_at,
        updated_at=now,
    )

