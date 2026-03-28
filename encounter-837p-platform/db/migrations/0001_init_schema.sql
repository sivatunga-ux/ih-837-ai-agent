-- Phase 1 schema baseline for 837P platform.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS members (
  member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_member_id TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  gender_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS providers (
  provider_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npi TEXT NOT NULL UNIQUE,
  organization_name TEXT,
  first_name TEXT,
  last_name TEXT,
  taxonomy_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS encounters (
  encounter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_external_id TEXT NOT NULL UNIQUE,
  source_system TEXT NOT NULL,
  member_id UUID NOT NULL REFERENCES members(member_id),
  servicing_provider_id UUID REFERENCES providers(provider_id),
  billing_provider_id UUID REFERENCES providers(provider_id),
  encounter_date DATE NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  clinical_note_ref TEXT,
  status TEXT NOT NULL DEFAULT 'INGESTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('INGESTED', 'VALIDATED', 'SNAPSHOT', 'RENDERED', 'SUBMITTED', 'REJECTED'))
);

CREATE TABLE IF NOT EXISTS encounter_diagnoses (
  encounter_diagnosis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(encounter_id) ON DELETE CASCADE,
  sequence_num INTEGER NOT NULL,
  diagnosis_code TEXT NOT NULL,
  diagnosis_code_system TEXT NOT NULL DEFAULT 'ICD10CM',
  diagnosis_description TEXT,
  present_on_admission_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (encounter_id, sequence_num)
);

CREATE TABLE IF NOT EXISTS encounter_procedures (
  encounter_procedure_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(encounter_id) ON DELETE CASCADE,
  procedure_code TEXT NOT NULL,
  procedure_code_system TEXT NOT NULL DEFAULT 'CPT',
  modifier_1 TEXT,
  modifier_2 TEXT,
  modifier_3 TEXT,
  modifier_4 TEXT,
  service_from_date DATE,
  service_to_date DATE,
  units NUMERIC(12, 2) NOT NULL DEFAULT 1,
  charge_amount NUMERIC(14, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claims (
  claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL UNIQUE REFERENCES encounters(encounter_id) ON DELETE CASCADE,
  claim_control_number TEXT,
  claim_frequency_type_code TEXT NOT NULL DEFAULT '1',
  place_of_service_code TEXT,
  facility_type_code TEXT,
  claim_status TEXT NOT NULL DEFAULT 'DRAFT',
  total_charge_amount NUMERIC(14, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (claim_status IN ('DRAFT', 'READY', 'SUBMITTED', 'ACCEPTED', 'REJECTED'))
);

CREATE TABLE IF NOT EXISTS claim_lines (
  claim_line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  procedure_code TEXT NOT NULL,
  modifier_1 TEXT,
  modifier_2 TEXT,
  modifier_3 TEXT,
  modifier_4 TEXT,
  units NUMERIC(12, 2) NOT NULL DEFAULT 1,
  line_charge_amount NUMERIC(14, 2) NOT NULL,
  diagnosis_pointer_1 SMALLINT,
  diagnosis_pointer_2 SMALLINT,
  diagnosis_pointer_3 SMALLINT,
  diagnosis_pointer_4 SMALLINT,
  rendering_provider_id UUID REFERENCES providers(provider_id),
  service_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (claim_id, line_number)
);

CREATE TABLE IF NOT EXISTS claim_validations (
  validation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  field_path TEXT,
  is_blocking BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (severity IN ('INFO', 'WARN', 'ERROR', 'FATAL'))
);

CREATE TABLE IF NOT EXISTS claim_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  snapshot_version INTEGER NOT NULL,
  snapshot_reason TEXT NOT NULL,
  snapshot_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (claim_id, snapshot_version)
);

CREATE TABLE IF NOT EXISTS claim_render_artifacts (
  artifact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  renderer_version TEXT NOT NULL,
  edi_text TEXT NOT NULL,
  interchange_control_number TEXT,
  functional_group_control_number TEXT,
  transaction_set_control_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lineage_events (
  lineage_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES claims(claim_id) ON DELETE SET NULL,
  encounter_id UUID REFERENCES encounters(encounter_id) ON DELETE SET NULL,
  parent_event_id UUID REFERENCES lineage_events(lineage_event_id),
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (actor_type IN ('SYSTEM', 'USER', 'JOB'))
);

CREATE TABLE IF NOT EXISTS submissions (
  submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  artifact_id UUID REFERENCES claim_render_artifacts(artifact_id),
  destination TEXT NOT NULL,
  transport_type TEXT NOT NULL,
  submission_status TEXT NOT NULL DEFAULT 'PENDING',
  external_tracking_id TEXT,
  submitted_at TIMESTAMPTZ,
  response_received_at TIMESTAMPTZ,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (submission_status IN ('PENDING', 'SENT', 'ACKNOWLEDGED', 'REJECTED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_encounters_member_date ON encounters(member_id, encounter_date DESC);
CREATE INDEX IF NOT EXISTS idx_claim_validations_claim ON claim_validations(claim_id, severity);
CREATE INDEX IF NOT EXISTS idx_claim_snapshots_claim_version ON claim_snapshots(claim_id, snapshot_version DESC);
CREATE INDEX IF NOT EXISTS idx_lineage_events_claim_time ON lineage_events(claim_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_claim_status ON submissions(claim_id, submission_status);
