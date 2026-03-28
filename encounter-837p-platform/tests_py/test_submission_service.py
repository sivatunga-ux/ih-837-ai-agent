from platform_837p.submission.models import (
    JobStatus,
    SubmissionFileInput,
    SubmissionJobInput,
)
from platform_837p.submission.service import SubmissionService


def test_create_job_defaults_to_queued() -> None:
    service = SubmissionService()

    job = service.create_job(
        SubmissionJobInput(
            destination="payer-clearinghouse-a",
            transport_type="SFTP",
            submitted_by="system-job",
            notes=None,
        )
    )

    assert job.job_status == JobStatus.QUEUED
    assert job.destination == "payer-clearinghouse-a"
    assert job.transport_type == "SFTP"


def test_add_submission_file_to_job() -> None:
    service = SubmissionService()
    job = service.create_job(
        SubmissionJobInput(
            destination="payer-clearinghouse-a",
            transport_type="SFTP",
            submitted_by="system-job",
            notes="nightly cycle",
        )
    )

    submission_file = service.add_file(
        job.job_id,
        SubmissionFileInput(
            artifact_id="70000000-0000-0000-0000-000000000001",
            claim_id="40000000-0000-0000-0000-000000000001",
            file_name="837p_20260205_1200.edi",
            file_sha256="abc123",
            file_size_bytes=512,
        ),
    )

    assert submission_file.job_id == job.job_id
    assert submission_file.claim_id == "40000000-0000-0000-0000-000000000001"
    assert submission_file.file_name.endswith(".edi")
    assert submission_file.file_status == "PENDING"


def test_update_job_status() -> None:
    service = SubmissionService()
    job = service.create_job(
        SubmissionJobInput(
            destination="payer-clearinghouse-a",
            transport_type="SFTP",
            submitted_by="system-job",
            notes=None,
        )
    )

    sent = service.update_job_status(job.job_id, JobStatus.SENT)
    completed = service.update_job_status(job.job_id, JobStatus.COMPLETED)

    assert sent.job_status == JobStatus.SENT
    assert completed.job_status == JobStatus.COMPLETED
