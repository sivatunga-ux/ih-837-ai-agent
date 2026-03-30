# CMS Encounter Data — Edit Management Architecture & Data Model

## Document Purpose
Comprehensive architecture for managing CMS encounter data edits across all claim types (837P Professional, 837I Institutional, DME). Designed for deploy-once with annual maintenance via Excel upload.

---

## 1. Edit Taxonomy — All Claim Types

### 1.1 Edit Sources & Report Mapping

| Edit Source | Processing Phase | Report | Claim Types | Frequency of Change |
|-------------|-----------------|--------|-------------|-------------------|
| **Pre-Screen** | File-level structural validation | EDFES Notification | All | Rare — system-level |
| **TA1** | ISA/IEA interchange envelope syntax | TA1 Acknowledgement | All | Very rare |
| **CEM** (Common Edits Module) | GS/GE functional group + segment syntax | 999 Acknowledgement | All | Annual CMS update |
| **CCEM** (Combined Common Edits) | Transaction set / claim-level edits | 277CA Claim Acknowledgement | All | Quarterly CMS update |
| **EDPPPS** (Processing & Pricing) | Detail-level business rules, pricing | MAO-002 Processing Status | Professional + DME | Quarterly CMS update |
| **EDPIPS** (Inst. Processing & Pricing) | Institutional detail-level edits | MAO-002 Processing Status | Institutional | Quarterly CMS update |
| **Duplicate Edits** | Header + service-line dedup | MAO-001 Duplicates | All | Rare |
| **MBI Edits** | Beneficiary ID validation | 277CA + MAO-002 | All | Rare — one-time transition |
| **Risk Adjustment Filtering** | Diagnosis eligibility for RA | MAO-004 Risk Filter | All | Annual model update |

### 1.2 Edit Lifecycle States

```
PROPOSED → ACTIVE → DEACTIVATED → RETIRED
              ↑          ↓
              └── REACTIVATED
```

### 1.3 MBI Edits (Appendix 3C)

| Edit Code | Edit Type | Description | Claim Types |
|-----------|-----------|-------------|-------------|
| A7:164:IL | 277CA | Member ID for Subscriber is Not Valid | All |
| 02110 | MAO-002 | Medicare Beneficiary Identifier Not on File | All |
| 355 (RAPS) | RAPS | MBI Number Not Formatted Correctly | RAPS |
| 356 (RAPS) | RAPS | MBI Number Does Not Exist | RAPS |
| 357 (RAPS) | RAPS | MBI Changed, No Replacement | RAPS |
| 358 (RAPS) | RAPS | MBI Cross-Referenced to Non-Existing MBI | RAPS |
| 360 (RAPS) | RAPS | MBI May Not Be Used Before Transition Date | RAPS |
| 361 (RAPS) | RAPS | MBI Is a Test Number | RAPS |
| 490 (RAPS) | RAPS | Could Not Delete; Diagnosis Cluster Not Found | RAPS |
| 503 (RAPS) | RAPS | Beneficiary ID Changed (Informational) | RAPS |

### 1.4 MBI Format Validation Rules

```
Position 1: Numeric 1-9
Position 2: Alpha A-Z (excluding S, L, O, I, B, Z)
Position 3: Alphanumeric 0-9 or A-Z (excluding S, L, O, I, B, Z)
Position 4: Numeric 0-9
Position 5: Alpha A-Z (excluding S, L, O, I, B, Z)
Position 6: Alphanumeric 0-9 or A-Z (excluding S, L, O, I, B, Z)
Position 7: Numeric 0-9
Position 8: Alpha A-Z (excluding S, L, O, I, B, Z)
Position 9: Alpha A-Z (excluding S, L, O, I, B, Z)
Position 10: Numeric 0-9
Position 11: Numeric 0-9
```

---

## 2. Data Model — Edit Rules Database

### 2.1 Core Schema

```sql
-- ═══════════════════════════════════════════════════════
-- EDIT RULE MASTER TABLE
-- Deploy-once, update via Excel upload
-- ═══════════════════════════════════════════════════════
CREATE TABLE edit_rules (
  id                  SERIAL PRIMARY KEY,
  edit_code           VARCHAR(30) NOT NULL,        -- e.g., "98325", "A7:164:IL", "X222.105.2300.CLM02.010"
  edit_source         VARCHAR(20) NOT NULL,        -- PRE_SCREEN, TA1, CEM, CCEM, EDPPPS, EDPIPS, DUPLICATE, MBI
  report_type         VARCHAR(10) NOT NULL,        -- EDFES_NOTIF, TA1, 999, 277CA, MAO_001, MAO_002, MAO_004
  claim_types         VARCHAR(30) NOT NULL,        -- PROF, INST, DME, PROF+DME, ALL
  description         TEXT NOT NULL,
  severity            VARCHAR(15) NOT NULL,        -- REJECT, INFORMATIONAL, WARNING
  loop_id             VARCHAR(20),                 -- e.g., "2300", "2010AA", "2400"
  segment_id          VARCHAR(10),                 -- e.g., "CLM", "NM1", "SV1"
  element_id          VARCHAR(20),                 -- e.g., "CLM02", "NM109", "SV101-2"
  
  -- Edit logic
  validation_type     VARCHAR(30),                 -- REQUIRED, FORMAT, VALUE_SET, CROSS_FIELD, RANGE, REGEX, CUSTOM
  expected_values     TEXT,                         -- JSON array of valid values or regex pattern
  cross_field_ref     TEXT,                         -- JSON: related fields for cross-field edits
  custom_logic_key    VARCHAR(50),                  -- Key to custom validation function
  
  -- Lifecycle
  status              VARCHAR(15) NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE, DEACTIVATED, RETIRED
  effective_date      DATE NOT NULL,
  deactivated_date    DATE,
  
  -- CMS source tracking
  cms_spreadsheet_ver VARCHAR(20),                 -- e.g., "EB20251V01"
  cms_guide_version   VARCHAR(20),                 -- e.g., "5.2"
  phase               VARCHAR(10),                 -- PHASE_I, PHASE_II, PHASE_III (for EDPPPS)
  
  -- Resolution
  resolution_strategy TEXT,                         -- How to fix when edit triggers
  prevention_tip      TEXT,                         -- How to avoid triggering the edit
  
  -- Audit
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW(),
  created_by          VARCHAR(50),
  updated_by          VARCHAR(50),
  version             INTEGER DEFAULT 1,
  change_notes        TEXT
);

CREATE INDEX idx_edit_rules_code ON edit_rules(edit_code);
CREATE INDEX idx_edit_rules_source ON edit_rules(edit_source);
CREATE INDEX idx_edit_rules_claim_types ON edit_rules(claim_types);
CREATE INDEX idx_edit_rules_status ON edit_rules(status);
CREATE INDEX idx_edit_rules_loop ON edit_rules(loop_id);
CREATE INDEX idx_edit_rules_segment ON edit_rules(segment_id);

-- ═══════════════════════════════════════════════════════
-- EDIT RULE VERSIONS (audit trail for changes)
-- ═══════════════════════════════════════════════════════
CREATE TABLE edit_rule_versions (
  id                  SERIAL PRIMARY KEY,
  edit_rule_id        INTEGER REFERENCES edit_rules(id),
  version             INTEGER NOT NULL,
  change_type         VARCHAR(20) NOT NULL,        -- CREATED, MODIFIED, DEACTIVATED, REACTIVATED, RETIRED
  previous_values     JSONB,                        -- Snapshot of changed fields before update
  new_values          JSONB,                        -- Snapshot of changed fields after update
  change_source       VARCHAR(50),                  -- EXCEL_UPLOAD, MANUAL, CMS_UPDATE
  cms_spreadsheet_ver VARCHAR(20),
  changed_at          TIMESTAMP DEFAULT NOW(),
  changed_by          VARCHAR(50),
  notes               TEXT
);

-- ═══════════════════════════════════════════════════════
-- EDIT UPLOAD BATCHES (tracks Excel uploads)
-- ═══════════════════════════════════════════════════════
CREATE TABLE edit_upload_batches (
  id                  SERIAL PRIMARY KEY,
  file_name           VARCHAR(255) NOT NULL,
  file_hash           VARCHAR(64),                  -- SHA-256 of uploaded file
  upload_type         VARCHAR(30) NOT NULL,          -- CEM_UPDATE, CCEM_UPDATE, EDPPPS_UPDATE, FULL_REFRESH
  claim_type_scope    VARCHAR(30) NOT NULL,          -- PROF, INST, DME, ALL
  cms_spreadsheet_ver VARCHAR(20),
  effective_date      DATE,
  
  -- Results
  total_rows          INTEGER,
  rules_added         INTEGER DEFAULT 0,
  rules_modified      INTEGER DEFAULT 0,
  rules_deactivated   INTEGER DEFAULT 0,
  rules_unchanged     INTEGER DEFAULT 0,
  errors              INTEGER DEFAULT 0,
  error_details       JSONB,
  
  -- Lifecycle
  status              VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED, ROLLED_BACK
  uploaded_at         TIMESTAMP DEFAULT NOW(),
  processed_at        TIMESTAMP,
  uploaded_by         VARCHAR(50),
  
  -- Rollback support
  rollback_available  BOOLEAN DEFAULT TRUE,
  rolled_back_at      TIMESTAMP,
  rolled_back_by      VARCHAR(50)
);

-- ═══════════════════════════════════════════════════════
-- ELEMENT FIELD REGISTRY
-- Maps every loop/segment/element across claim types
-- ═══════════════════════════════════════════════════════
CREATE TABLE field_registry (
  id                  SERIAL PRIMARY KEY,
  claim_type          VARCHAR(10) NOT NULL,          -- PROF, INST, DME
  loop_id             VARCHAR(20) NOT NULL,
  segment_id          VARCHAR(10) NOT NULL,
  element_id          VARCHAR(20) NOT NULL,
  element_name        VARCHAR(100) NOT NULL,
  data_type           VARCHAR(20),                   -- ID, AN, DT, TM, N0, R
  min_length          INTEGER,
  max_length          INTEGER,
  tr3_usage           VARCHAR(15),                   -- REQUIRED, SITUATIONAL, NOT_USED
  cms_usage           VARCHAR(15),                   -- REQUIRED, SITUATIONAL, NOT_USED, CMS_SPECIFIC
  cms_supplemental    BOOLEAN DEFAULT FALSE,         -- TRUE if CMS has supplemental instructions
  cms_instruction     TEXT,                           -- CMS-specific instruction text
  cms_default_value   VARCHAR(100),                  -- Default value if applicable
  valid_values        JSONB,                          -- JSON array of valid codes
  UNIQUE(claim_type, loop_id, segment_id, element_id)
);

-- ═══════════════════════════════════════════════════════
-- CMS TEMPLATE DEFAULTS
-- Envelope and payer defaults per contract
-- ═══════════════════════════════════════════════════════
CREATE TABLE cms_template_defaults (
  id                  SERIAL PRIMARY KEY,
  template_name       VARCHAR(50) NOT NULL,
  claim_type          VARCHAR(10) NOT NULL,          -- PROF, INST, DME
  
  -- Envelope defaults
  isa_receiver_id     VARCHAR(15) DEFAULT '80882',
  isa_id_qualifier    VARCHAR(2) DEFAULT 'ZZ',
  isa_ack_requested   VARCHAR(1) DEFAULT '1',
  isa_repetition_sep  VARCHAR(1) DEFAULT '^',
  gs_receiver_code    VARCHAR(15) DEFAULT '80882',
  gs_version_id       VARCHAR(20),                   -- 005010X222A1 or 005010X223A2
  bht06_claim_id      VARCHAR(2) DEFAULT 'CH',
  
  -- Submitter/Receiver
  submitter_entity_type VARCHAR(1) DEFAULT '2',
  receiver_name       VARCHAR(60) DEFAULT 'EDSCMS',
  receiver_id         VARCHAR(15) DEFAULT '80882',
  
  -- Payer defaults
  payer_name          VARCHAR(60) DEFAULT 'EDSCMS',
  payer_id            VARCHAR(15) DEFAULT '80882',
  payer_id_qualifier  VARCHAR(2) DEFAULT 'PI',
  payer_address       VARCHAR(55) DEFAULT '7500 Security Blvd',
  payer_city          VARCHAR(30) DEFAULT 'Baltimore',
  payer_state         VARCHAR(2) DEFAULT 'MD',
  payer_zip           VARCHAR(15) DEFAULT '212441850',
  
  -- Subscriber defaults
  sbr01_payer_resp    VARCHAR(1) DEFAULT 'S',
  sbr09_filing_code   VARCHAR(2),                    -- MB (Prof), MA (Inst)
  
  -- Provider defaults (atypical)
  default_npi_prof    VARCHAR(10) DEFAULT '1999999984',
  default_npi_inst    VARCHAR(10) DEFAULT '1999999950',
  default_npi_dme     VARCHAR(10) DEFAULT '1999999976',
  default_ein_prof    VARCHAR(9)  DEFAULT '199999998',
  default_ein_inst    VARCHAR(9)  DEFAULT '199999998',
  default_ein_dme     VARCHAR(9)  DEFAULT '550196148',
  default_zip_suffix  VARCHAR(4)  DEFAULT '9998',
  
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════
-- VALIDATION RESULTS (execution log)
-- ═══════════════════════════════════════════════════════
CREATE TABLE validation_results (
  id                  BIGSERIAL PRIMARY KEY,
  encounter_id        BIGINT NOT NULL,
  edit_rule_id        INTEGER REFERENCES edit_rules(id),
  edit_code           VARCHAR(30) NOT NULL,
  severity            VARCHAR(15) NOT NULL,
  triggered           BOOLEAN NOT NULL,
  field_value         TEXT,                           -- Actual value that triggered the edit
  expected_value      TEXT,                           -- What was expected
  message             TEXT,
  validated_at        TIMESTAMP DEFAULT NOW(),
  batch_id            BIGINT                          -- Links to submission batch
);

CREATE INDEX idx_validation_results_encounter ON validation_results(encounter_id);
CREATE INDEX idx_validation_results_edit ON validation_results(edit_code);
CREATE INDEX idx_validation_results_batch ON validation_results(batch_id);
```

### 2.2 Entity Relationship Diagram

```
┌──────────────┐ 1:N ┌──────────────────┐
│ edit_upload_  │────>│ edit_rule_versions│
│ batches      │     └────────┬─────────┘
└──────────────┘              │ N:1
                        ┌─────┴──────┐
                        │ edit_rules  │
                        └─────┬──────┘
                              │ 1:N
                    ┌─────────┴──────────┐
                    │ validation_results  │
                    └─────────┬──────────┘
                              │ N:1
                    ┌─────────┴──────────┐
                    │ encounter_records   │
                    └────────────────────┘

┌──────────────────┐     ┌──────────────────────┐
│ field_registry    │     │ cms_template_defaults │
│ (reference data)  │     │ (per claim type)      │
└──────────────────┘     └──────────────────────┘
```

---

## 3. Agent Architecture for Edit Management

### 3.1 Agent Registry (Extended)

| # | Agent | Deploy-Once | Annual Update | Claim Types |
|---|-------|:-----------:|:-------------:|-------------|
| **E1** | Edit Rule Loader Agent | Yes | Via Excel upload | All |
| **E2** | Pre-Screen Validator | Yes | Rarely | All |
| **E3** | Envelope Validator (TA1) | Yes | Rarely | All |
| **E4** | CEM/CCEM Edit Engine | Yes | Quarterly Excel | All |
| **E5** | MBI Validator | Yes | One-time + rare | All |
| **E6** | EDPPPS Edit Engine (Prof) | Yes | Quarterly Excel | Prof + DME |
| **E7** | EDPIPS Edit Engine (Inst) | Yes | Quarterly Excel | Inst |
| **E8** | Duplicate Detector | Yes | Rarely | All |
| **E9** | ACK Report Parser | Yes | Rarely | All |
| **E10** | Edit Reconciliation Agent | Yes | Rarely | All |
| **E11** | Field Registry Manager | Yes | Annual | All |
| **E12** | Edit Upload Processor | Yes | As-needed | All |

### 3.2 Edit Rule Loader Agent (E1/E12)

**Purpose:** Process Excel uploads containing CMS edit spreadsheets, compare with existing rules, apply changes.

**Input:** Excel file (CMS 5010 Edit Spreadsheet format)

**Excel Expected Columns:**
```
| Column | Description | Maps To |
|--------|-------------|---------|
| Edit Code | e.g., X222.105.2300.CLM02.010 | edit_code |
| Description | Edit description text | description |
| Loop | e.g., 2300 | loop_id |
| Segment | e.g., CLM | segment_id |
| Element | e.g., CLM02 | element_id |
| Severity | Reject / Informational | severity |
| Claim Type | Prof / Inst / DME | claim_types |
| Effective Date | MM/DD/YYYY | effective_date |
| Status | Active / Deactivated | status |
| Resolution | Fix instructions | resolution_strategy |
```

**Processing Steps:**
1. Parse Excel → extract rows
2. Hash file for dedup (prevent re-upload)
3. For each row:
   - If edit_code exists in DB → compare all fields → if changed, update + version
   - If edit_code NOT in DB → insert as new rule
4. Edits in DB but NOT in Excel → mark as candidate for deactivation (require confirmation)
5. Generate upload batch report (added/modified/deactivated/unchanged/errors)
6. Store rollback snapshot

### 3.3 CEM/CCEM Edit Engine (E4)

**Purpose:** Run Common Edits Module validations before submission. Catches errors that would produce 999 or 277CA rejections.

**Edit Categories:**
- Segment syntax validation
- Required element presence
- Code set validation (ICD-10, CPT, HCPCS, revenue codes)
- Cross-field consistency
- Date format and range validation
- NPI Luhn check

**Query Pattern:**
```sql
SELECT * FROM edit_rules
WHERE edit_source IN ('CEM', 'CCEM')
  AND status = 'ACTIVE'
  AND claim_types IN (:claimType, 'ALL')
ORDER BY loop_id, segment_id, element_id;
```

### 3.4 EDPPPS/EDPIPS Edit Engine (E6/E7)

**Purpose:** Run back-end processing edits before submission. Catches errors that would produce MAO-002 rejections.

**Separate engines for Professional (E6) and Institutional (E7) because:**
- Different edit code ranges
- Different pricing logic
- Different mandatory elements (SV1 vs SV2, CLM05 values, CL1 segment)
- DME uses Professional engine with DME-specific overrides

---

## 4. Maintenance Process — Annual/Quarterly Edit Updates

### 4.1 Update Cadence

| Update Type | Frequency | Source | Impact |
|-------------|-----------|--------|--------|
| CMS 5010 Edit Spreadsheet (CEM) | Annual (4 quarterly releases) | CMS Transmittals page | Front-end edits |
| CCEM Edit Spreadsheet | Annual (4 quarterly releases) | CSSC Operations | Front-end edits |
| EDPPPS Edit Updates | Quarterly | CMS Companion Guide | Back-end edits |
| Deactivated Edits List | As-needed | Appendix 4A of ED Guide | Edit status changes |
| MBI Edits | One-time (2018), rare updates | Appendix 3C | Beneficiary validation |
| Risk Adjustment Model | Annual | CMS Advance Notice | Diagnosis filtering |

### 4.2 Step-by-Step Maintenance Process

#### Step 1: Download New Edit Spreadsheet
```
Source: https://www.csscoperations.com
File: CMS 5010 Edits Spreadsheet (EB=Prof, EA=Inst, CE=DME)
Version ID format: {LOB}{YEAR}{QTR}V{NN}
  - EB20251V01 = Professional, 2025, Q1 release, first iteration
```

#### Step 2: Upload to Edit Management System
```
1. Navigate to Admin → Edit Management → Upload
2. Select file (Excel .xlsx)
3. Select claim type scope (Prof / Inst / DME / All)
4. System auto-detects CMS version from file
5. Click "Analyze" — shows preview of changes
6. Review: X new, Y modified, Z to deactivate, W unchanged
7. Click "Apply" to commit
8. System creates edit_upload_batch record
9. All changes versioned in edit_rule_versions
```

#### Step 3: Validate Changes
```
1. Run test suite against sample encounters
2. Compare results with previous version
3. Review any new rejections or acceptance changes
4. If issues found → Rollback (one-click from upload batch)
```

#### Step 4: Promote to Production
```
1. Changes are applied in TEST environment first
2. Run regression tests with known-good encounters
3. Approve promotion
4. Apply same upload batch to PRODUCTION
5. Update cms_spreadsheet_ver on affected rules
```

### 4.3 Rollback Process

```
1. Navigate to Admin → Edit Management → Upload History
2. Find the batch to rollback
3. Click "Rollback" — system reads edit_rule_versions
4. For each version record in the batch:
   - CREATED → delete the rule
   - MODIFIED → restore previous_values
   - DEACTIVATED → reactivate with previous values
5. Status updates to ROLLED_BACK
```

---

## 5. MDE Crosswalk (Appendix 3B Analysis)

### 5.1 Loops and Segments Required for EDR and CRR

| MDE Table | Loop/Segment | Name | Prof | Inst | DME | CMS Supplemental? |
|:---------:|:------------|------|:----:|:----:|:---:|:-----------------:|
| 1 | ISA | Interchange Control Header | Yes | Yes | Yes | Yes |
| 22 | IEA | Interchange Control Trailer | Yes | Yes | Yes | Yes |
| 2 | GS | Functional Group Header | Yes | Yes | Yes | Yes |
| 21 | GE | Functional Group Trailer | Yes | Yes | Yes | Yes |
| 3 | ST | Transaction Set Header | Yes | Yes | Yes | Yes |
| 20 | SE | Transaction Trailer | Yes | Yes | Yes | Yes |
| 4 | BHT | Begin Hierarchical Transaction | Yes | Yes | Yes | Partial |
| 5 | 1000A | Submitter Name | Yes | Yes | Yes | Yes |
| 6 | 1000B | Receiver Name | Yes | Yes | Yes | Yes |
| 7 | 2000A | Billing Provider HL Level | Yes | Yes | Yes | No |
| 8 | 2010AA | Billing Provider Name | Yes | Yes | Yes | Yes |
| 9 | 2000B | Subscriber HL Level | Yes | Yes | Yes | Yes |
| 10 | 2010BA | Subscriber Name | Yes | Yes | Yes | Yes |
| 11 | 2010BB | Payer Name | Yes | Yes | Yes | Yes |
| 12 | 2300 | Claim Information | Yes | Yes | Yes | Yes |
| 13 | 2310E | Ambulance Pick-Up Location | **Prof only** | — | — | Yes |
| 14 | 2310F | Ambulance Drop-Off Location | **Prof only** | — | — | Yes |
| 15 | 2320 | Other Subscriber Information | Yes | Yes | Yes | Yes |
| 16 | 2330A | Other Subscriber Name | Yes | Yes | Yes | Yes |
| 17 | 2330B | Other Payer Name | Yes | Yes | Yes | Yes |
| 18 | 2400 | Service Line | Yes | Yes | Yes | Yes |
| 19 | 2430 | Line Adjudication Information | Yes | Yes | Yes | Yes |

### 5.2 Elements with CMS Supplemental Instructions

These are the fields where CMS has requirements BEYOND the TR3:

| Loop | Element | CMS Supplemental Instruction | Claim Types |
|------|---------|------|-------------|
| ISA | ISA05/07 | Must be ZZ | All |
| ISA | ISA06 | EN + Contract ID | All |
| ISA | ISA08 | 80882 | All |
| ISA | ISA11 | ^ (caret) | All |
| ISA | ISA13 | 9 chars, unique 12 months, part of duplicate key | All |
| ISA | ISA14 | 1 (ACK requested) | All |
| GS | GS02 | Must match ISA06 | All |
| GS | GS03 | Must match ISA08 | All |
| GS | GS06 | Part of duplicate key, must match GE02 | All |
| GS | GS08 | 005010X222A1 (Prof/DME), 005010X223A2 (Inst) | Per type |
| BHT | BHT03 | Unique across all files, part of duplicate key | All |
| BHT | BHT06 | CH (Chargeable) | All |
| 1000A | NM102 | 2 (Non-Person) | All |
| 1000A | NM109 | EN + Contract ID | All |
| 1000A | PER03/05/07 | TE, EM, FX recommended | All |
| 1000B | NM103 | EDSCMS | All |
| 1000B | NM109 | 80882 | All |
| 2010AA | NM108 | XX (NPI qualifier) | All |
| 2010AA | NM109 | 10-digit starting with 1; default NPIs for atypical | All |
| 2010AA | N403 | 9-digit ZIP, default suffix 9998 | All |
| 2010AA | REF01 | EI (EIN) | All |
| 2010AA | REF02 | 9-digit EIN; defaults for atypical | All |
| 2000B | SBR01 | S (secondary — CMS is secondary payer) | All |
| 2000B | SBR09 | MB (Prof), MA (Inst) | Per type |
| 2010BA | NM108 | MI (Member ID) | All |
| 2010BA | NM109 | HICN or MBI | All |
| 2010BB | NM103 | EDSCMS | All |
| 2010BB | NM108 | PI | All |
| 2010BB | NM109 | 80882 | All |
| 2010BB | N301-N403 | 7500 Security Blvd / Baltimore / MD / 212441850 | All |
| 2010BB | REF01/02 | 2U / Contract ID | All |
| 2300 | CLM05-3 | 1 (orig), 7 (replace), 8 (void) | All |
| 2300 | PWK01/02 | 09/AA (CRR), OZ/AA (paper), AM/AA (ambulance) | Situational |
| 2300 | CN101 | 05 (capitated) | Situational |
| 2300 | REF*F8 | ICN for adj/void/CRR linking | Situational |
| 2300 | REF*EA=8 | CRR-Delete signal | Situational |
| 2300 | NTE01/02 | ADD / Default data reason code | Situational |
| 2320 | SBR01 | P (primary) or T (tertiary) | All |
| 2320 | SBR09 | 16 (HMO Medicare Risk) | All |
| 2330A | NM109 | Must match 2010BA NM109 | All |
| 2330B | NM108 | XV | All |
| 2330B | NM109 | Contract ID (if no other payer ID) | All |
| 2400 | CN101 | 05 (capitated service line) | Situational |
| 2430 | SVD01 | Must match 2330B NM109 | All |
| 2430 | DTP03 | Receipt date minus 1 day (if adj date unavailable) | All |

---

## 6. Configuration-Driven Design Principles

### 6.1 Adding a New Edit Rule
1. Upload Excel with new row OR add via Admin UI
2. System inserts into `edit_rules` table
3. Edit engine picks it up automatically — **no code deploy required**

### 6.2 Adding a New Searchable/Validatable Field
1. Add to `field_registry` table
2. Edit engine uses field_registry for element-level validation
3. Search engine picks up from config — **no code deploy required**

### 6.3 Supporting a New Claim Type
1. Add claim type to `field_registry` (bulk insert from TR3 mapping)
2. Add edit rules scoped to new claim type
3. Add `cms_template_defaults` entry
4. Edit engines already support claim_type filtering — **no code change needed**

### 6.4 Quarterly CMS Update Process
```
Admin uploads new CMS spreadsheet
  → E12 (Edit Upload Processor) parses
  → Diffs against existing edit_rules
  → Preview: "12 new, 5 modified, 2 deactivated, 180 unchanged"
  → Admin approves
  → Changes applied with full audit trail
  → Test suite runs automatically
  → Admin promotes to production
```

---

## 7. Recommended Implementation Priority

### Phase 1 — Foundation (Core edit infrastructure)
| Component | Description |
|-----------|-------------|
| `edit_rules` table + seed data | Deploy with all known CEM/CCEM/EDPPPS edits |
| `field_registry` table + seed data | All 837P elements from Appendix 3B crosswalk |
| `cms_template_defaults` | CMS envelope defaults per claim type |
| Edit Rule Loader Agent (E1) | Parse + load from Excel |
| Envelope Validator (E3) | ISA/GS/ST matching edits |
| MBI Validator (E5) | Format validation per Appendix 3C rules |

### Phase 2 — Professional Edits
| Component | Description |
|-----------|-------------|
| CEM/CCEM Edit Engine (E4) | All front-end edits for 837P |
| EDPPPS Edit Engine (E6) | Professional back-end edits |
| Duplicate Detector (E8) | ISA13+GS06+ST02+BHT03 |
| Edit Upload Processor (E12) | Excel upload with diff/preview/rollback |

### Phase 3 — Acknowledgement Processing
| Component | Description |
|-----------|-------------|
| ACK Report Parser (E9) | TA1, 999, 277CA, MAO-001, MAO-002 |
| Edit Reconciliation Agent (E10) | Match ACK edits to pre-submission validation |
| `validation_results` table | Store all validation execution logs |

### Phase 4 — Institutional + DME
| Component | Description |
|-----------|-------------|
| `field_registry` rows for 837I | Institutional elements (CL1, SV2, etc.) |
| EDPIPS Edit Engine (E7) | Institutional back-end edits |
| DME overrides in E6 | DME-specific edit rules using PROF engine |
| `cms_template_defaults` for INST/DME | Institutional and DME envelope defaults |

### Phase 5 — Operational Excellence
| Component | Description |
|-----------|-------------|
| Compliance dashboard | CMS metrics O1-O3, C1-C4 |
| Edit trend analytics | Which edits fire most, resolution rates |
| Automated regression testing | Run known-good encounters after every edit update |
| Self-service edit management UI | Admin UI for edit CRUD without Excel |

---

## 8. Summary — What to Build Next

When you share the complete CMS edit spreadsheet, I will:

1. **Parse the Excel** → extract every edit row
2. **Seed `edit_rules` table** → one row per edit with all metadata
3. **Seed `field_registry`** → every element from Appendix 3B crosswalk
4. **Build validation functions** → one per validation_type (REQUIRED, FORMAT, VALUE_SET, etc.)
5. **Create test cases** → one per edit code with pass/fail sample data
6. **Build the Edit Upload Processor** → Excel upload → diff → preview → apply → rollback

The architecture is designed so that once the core agents are deployed, ongoing maintenance is **configuration-only** — upload a new Excel, review the diff, approve, done.
