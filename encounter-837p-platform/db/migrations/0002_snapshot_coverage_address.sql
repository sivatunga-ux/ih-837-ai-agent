-- Phase 4: coverage/address snapshot support.

CREATE TABLE IF NOT EXISTS member_coverages (
  coverage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  payer_name TEXT NOT NULL,
  plan_name TEXT,
  policy_number TEXT NOT NULL,
  group_number TEXT,
  effective_start DATE NOT NULL,
  effective_end DATE,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_addresses (
  address_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  address_type TEXT NOT NULL DEFAULT 'HOME',
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state_code TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'US',
  effective_start DATE NOT NULL,
  effective_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (address_type IN ('HOME', 'MAILING', 'BILLING'))
);

CREATE TABLE IF NOT EXISTS claim_coverage_snapshots (
  coverage_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  snapshot_version INTEGER NOT NULL,
  coverage_payload JSONB NOT NULL,
  source_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (claim_id, snapshot_version)
);

CREATE TABLE IF NOT EXISTS claim_address_snapshots (
  address_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  snapshot_version INTEGER NOT NULL,
  address_payload JSONB NOT NULL,
  source_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (claim_id, snapshot_version)
);

CREATE INDEX IF NOT EXISTS idx_member_coverages_member
  ON member_coverages(member_id, effective_start DESC);

CREATE INDEX IF NOT EXISTS idx_member_addresses_member
  ON member_addresses(member_id, effective_start DESC);

CREATE INDEX IF NOT EXISTS idx_claim_coverage_snapshots_claim
  ON claim_coverage_snapshots(claim_id, snapshot_version DESC);

CREATE INDEX IF NOT EXISTS idx_claim_address_snapshots_claim
  ON claim_address_snapshots(claim_id, snapshot_version DESC);
