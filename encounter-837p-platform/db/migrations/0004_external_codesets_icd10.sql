-- Phase 8: external codeset storage for ICD-10 CM/PCS yearly validation.

CREATE TABLE IF NOT EXISTS external_codeset_catalog (
  codeset_name TEXT PRIMARY KEY,
  authority TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS external_codeset_releases (
  release_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codeset_name TEXT NOT NULL REFERENCES external_codeset_catalog(codeset_name) ON DELETE RESTRICT,
  release_year INTEGER NOT NULL,
  release_phase TEXT NOT NULL DEFAULT 'ANNUAL',
  effective_start DATE NOT NULL,
  effective_end DATE NOT NULL,
  source_url TEXT NOT NULL,
  source_checksum_sha256 TEXT NOT NULL,
  local_zip_path TEXT,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (codeset_name, release_year, release_phase)
);

CREATE TABLE IF NOT EXISTS external_codeset_entries (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES external_codeset_releases(release_id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  effective_start DATE NOT NULL,
  effective_end DATE NOT NULL,
  raw_line TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (release_id, code)
);

CREATE TABLE IF NOT EXISTS external_codeset_load_runs (
  load_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  initiated_by TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED'))
);

INSERT INTO external_codeset_catalog (codeset_name, authority, description)
VALUES
  ('ICD10CM', 'CMS/NCHS', 'ICD-10-CM diagnosis code set for claim and encounter validation'),
  ('ICD10PCS', 'CMS', 'ICD-10-PCS procedure code set primarily for institutional coding validation')
ON CONFLICT (codeset_name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_external_codeset_releases_name_year
  ON external_codeset_releases(codeset_name, release_year DESC);

CREATE INDEX IF NOT EXISTS idx_external_codeset_entries_release_code
  ON external_codeset_entries(release_id, code);
