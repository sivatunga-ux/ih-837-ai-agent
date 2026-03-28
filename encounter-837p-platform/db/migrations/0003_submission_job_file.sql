-- Phase 7: submission_job and submission_file support.

CREATE TABLE IF NOT EXISTS submission_jobs (
  submission_job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  destination TEXT NOT NULL,
  transport_type TEXT NOT NULL,
  job_status TEXT NOT NULL DEFAULT 'PENDING',
  created_by TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (job_status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'))
);

CREATE TABLE IF NOT EXISTS submission_files (
  submission_file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_job_id UUID NOT NULL REFERENCES submission_jobs(submission_job_id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_format TEXT NOT NULL DEFAULT 'X12_837P',
  file_status TEXT NOT NULL DEFAULT 'PENDING',
  checksum_sha256 TEXT,
  record_count INTEGER NOT NULL DEFAULT 0,
  file_size_bytes BIGINT,
  storage_uri TEXT,
  submitted_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (file_status IN ('PENDING', 'SENT', 'ACKNOWLEDGED', 'REJECTED', 'FAILED')),
  UNIQUE (submission_job_id, file_name)
);

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS submission_job_id UUID REFERENCES submission_jobs(submission_job_id),
  ADD COLUMN IF NOT EXISTS submission_file_id UUID REFERENCES submission_files(submission_file_id);

CREATE INDEX IF NOT EXISTS idx_submission_jobs_status
  ON submission_jobs(job_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submission_files_job_status
  ON submission_files(submission_job_id, file_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_job_file
  ON submissions(submission_job_id, submission_file_id);
