-- Phase 7: small seed data for submission_job and submission_file.
BEGIN;

INSERT INTO submission_jobs (
  submission_job_id,
  destination,
  transport_type,
  job_status,
  started_at,
  completed_at,
  created_by,
  job_metadata
) VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'payer-clearinghouse-a',
  'SFTP',
  'COMPLETED',
  '2026-02-05T12:00:00Z',
  '2026-02-05T12:30:00Z',
  'submission-worker-1',
  jsonb_build_object('batch_size', 2, 'notes', 'daily outbound run')
)
ON CONFLICT DO NOTHING;

INSERT INTO submission_files (
  submission_file_id,
  submission_job_id,
  file_name,
  file_checksum,
  file_size_bytes,
  file_status,
  claim_count,
  artifact_id,
  created_at
) VALUES
  (
    'b1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    '837p_20260205_1200_001.edi',
    'sha256:demo-001',
    1268,
    'SENT',
    1,
    '70000000-0000-0000-0000-000000000001',
    '2026-02-05T12:08:00Z'
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000001',
    '837p_20260205_1200_002.edi',
    'sha256:demo-002',
    1192,
    'GENERATED',
    1,
    NULL,
    '2026-02-05T12:09:00Z'
  )
ON CONFLICT DO NOTHING;

COMMIT;
