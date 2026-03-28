-- Phase 2: small, realistic seed data for all schema tables.
BEGIN;

INSERT INTO members (
  member_id, payer_member_id, first_name, last_name, date_of_birth, gender_code
) VALUES
  ('10000000-0000-0000-0000-000000000001', 'W123456789', 'Jane', 'Doe', '1980-06-14', 'F'),
  ('10000000-0000-0000-0000-000000000002', 'W223456789', 'John', 'Smith', '1974-11-02', 'M')
ON CONFLICT (payer_member_id) DO NOTHING;

INSERT INTO providers (
  provider_id, npi, organization_name, first_name, last_name, taxonomy_code
) VALUES
  ('20000000-0000-0000-0000-000000000001', '1234567890', 'Invent Primary Care', 'Alicia', 'Nguyen', '207Q00000X'),
  ('20000000-0000-0000-0000-000000000002', '1234567891', 'Invent Primary Care', 'Marcus', 'Lee', '207R00000X'),
  ('20000000-0000-0000-0000-000000000003', '1234567892', 'Invent Billing Group', NULL, NULL, '193200000X')
ON CONFLICT (npi) DO NOTHING;

INSERT INTO encounters (
  encounter_id, encounter_external_id, source_system, member_id,
  servicing_provider_id, billing_provider_id, encounter_date, clinical_note_ref, status
) VALUES
  (
    '30000000-0000-0000-0000-000000000001', 'ENC-PRO-1001', 'EHR',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000003',
    '2026-02-03', 'NOTE-2026-02-03-1001', 'VALIDATED'
  ),
  (
    '30000000-0000-0000-0000-000000000002', 'ENC-PRO-1002', 'EHR',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    '2026-02-04', 'NOTE-2026-02-04-1002', 'SNAPSHOT'
  )
ON CONFLICT (encounter_external_id) DO NOTHING;

INSERT INTO encounter_diagnoses (
  encounter_diagnosis_id, encounter_id, sequence_num, diagnosis_code, diagnosis_code_system, diagnosis_description
) VALUES
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'E119', 'ICD10CM', 'Type 2 diabetes mellitus without complications'),
  ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 2, 'I10', 'ICD10CM', 'Essential hypertension'),
  ('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 1, 'N186', 'ICD10CM', 'End stage renal disease')
ON CONFLICT (encounter_id, sequence_num) DO NOTHING;

INSERT INTO encounter_procedures (
  encounter_procedure_id, encounter_id, procedure_code, procedure_code_system,
  service_from_date, service_to_date, units, charge_amount
) VALUES
  ('32000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '99213', 'CPT', '2026-02-03', '2026-02-03', 1, 145.00),
  ('32000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '99214', 'CPT', '2026-02-04', '2026-02-04', 1, 188.00)
ON CONFLICT DO NOTHING;

INSERT INTO claims (
  claim_id, encounter_id, claim_control_number, claim_frequency_type_code, place_of_service_code,
  claim_status, total_charge_amount
) VALUES
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'CCN-1001', '1', '11', 'READY', 145.00),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'CCN-1002', '1', '11', 'DRAFT', 188.00)
ON CONFLICT (encounter_id) DO NOTHING;

INSERT INTO claim_lines (
  claim_line_id, claim_id, line_number, procedure_code, units, line_charge_amount,
  diagnosis_pointer_1, diagnosis_pointer_2, rendering_provider_id, service_date
) VALUES
  (
    '41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
    1, '99213', 1, 145.00, 1, 2, '20000000-0000-0000-0000-000000000001', '2026-02-03'
  ),
  (
    '41000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002',
    1, '99214', 1, 188.00, 1, NULL, '20000000-0000-0000-0000-000000000002', '2026-02-04'
  )
ON CONFLICT (claim_id, line_number) DO NOTHING;

INSERT INTO claim_validations (
  validation_id, claim_id, rule_code, severity, message, field_path, is_blocking
) VALUES
  (
    '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
    'RA-ELIG-001', 'INFO', 'Claim includes risk-eligible E/M service.', 'CLM/SV1', FALSE
  ),
  (
    '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002',
    'RA-DX-010', 'WARN', 'ESRD identified without dialysis status diagnosis.', 'HI', FALSE
  )
ON CONFLICT DO NOTHING;

INSERT INTO claim_snapshots (
  snapshot_id, claim_id, snapshot_version, snapshot_reason, snapshot_payload
) VALUES
  (
    '60000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    1,
    'Initial validated state',
    jsonb_build_object('claim_status', 'READY', 'line_count', 1, 'diagnosis_count', 2)
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    1,
    'Pre-render draft state',
    jsonb_build_object('claim_status', 'DRAFT', 'line_count', 1, 'diagnosis_count', 1)
  )
ON CONFLICT (claim_id, snapshot_version) DO NOTHING;

INSERT INTO claim_render_artifacts (
  artifact_id, claim_id, renderer_version, edi_text,
  interchange_control_number, functional_group_control_number, transaction_set_control_number
) VALUES
  (
    '70000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'v0.1.0',
    'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *260205*1200*^*00501*000000901*0*T*:~GS*HC*SENDER*RECEIVER*20260205*1200*901*X*005010X222A1~ST*837*0001*005010X222A1~SE*3*0001~GE*1*901~IEA*1*000000901~',
    '000000901',
    '901',
    '0001'
  )
ON CONFLICT DO NOTHING;

INSERT INTO lineage_events (
  lineage_event_id, claim_id, encounter_id, parent_event_id, event_type, actor_type, actor_id, details
) VALUES
  (
    '80000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    NULL,
    'ENCOUNTER_INGESTED',
    'SYSTEM',
    'ingest-job-1',
    jsonb_build_object('source_system', 'EHR')
  ),
  (
    '80000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001',
    'CLAIM_VALIDATED',
    'JOB',
    'validation-job-1',
    jsonb_build_object('blocking_count', 0, 'warn_count', 0)
  )
ON CONFLICT DO NOTHING;

INSERT INTO submissions (
  submission_id, claim_id, artifact_id, destination, transport_type, submission_status,
  external_tracking_id, submitted_at, response_received_at, response_payload
) VALUES
  (
    '90000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    'payer-clearinghouse-a',
    'SFTP',
    'ACKNOWLEDGED',
    'TRACK-1001',
    '2026-02-05T12:10:00Z',
    '2026-02-05T12:25:00Z',
    jsonb_build_object('ack_code', 'A', 'ack_message', 'Accepted')
  ),
  (
    '90000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    NULL,
    'payer-clearinghouse-a',
    'SFTP',
    'PENDING',
    NULL,
    NULL,
    NULL,
    NULL
  )
ON CONFLICT DO NOTHING;

COMMIT;
