# CMS Encounter Data System — Architecture Analysis & Agent Recommendations

## Based on Analysis of:
1. **837P Companion Guide v37.0 (March 2016)** — Original processing, file naming, submission configs, data element tables, edits, business cases
2. **ED Submission & Processing Guide v5.2 (May 2025)** — Updated CRR linked/unlinked, loops/data element validations, EDFES/EDPS processing

---

## 1. Current CMS Processing Architecture (As-Is)

### 1.1 Processing Pipeline

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  MAO/Entity  │───>│    EDFES     │───>│     EDPS     │───>│  CMS Data    │
│  Submitter   │    │  Front-End   │    │  Back-End    │    │  Warehouse   │
└──────────────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
                          │                    │                    │
                    ┌─────┴─────┐        ┌─────┴─────┐       ┌────┴─────┐
                    │ TA1       │        │ MAO-001   │       │   RAS    │
                    │ 999       │        │ MAO-002   │       │ (Risk    │
                    │ 277CA     │        │ MAO-004   │       │  Scores) │
                    └───────────┘        └───────────┘       └──────────┘
```

### 1.2 EDFES Processing Phases (Front-End)

| Phase | Edit Type | Report | Scope | Failure Impact |
|-------|-----------|--------|-------|----------------|
| 1. Pre-Screen | File-level validation | EDFES Notification | Entire file | File rejected entirely |
| 2. TA1 | ISA/IEA envelope syntax | TA1 Acknowledgement | Interchange | Entire interchange rejected |
| 3. 999/CEM | GS/GE functional group + CEM edits | 999 Acknowledgement | Functional group | GS/GE rejected, next GS/GE continues |
| 4. 277CA | Transaction set / claim-level CEM edits | 277CA Claim Acknowledgement | Individual claim | Claim rejected, others continue |

### 1.3 EDPS Processing (Back-End)

| Phase | Edit Type | Report | Scope |
|-------|-----------|--------|-------|
| 5. Duplicate Check | Header + detail level duplicate detection | MAO-001 | Encounter |
| 6. EDPPPS Edits | Pricing, processing, business rules | MAO-002 | Encounter + service line |
| 7. Risk Filtering | Diagnosis eligibility for risk adjustment | MAO-004 | Diagnosis codes |

### 1.4 Connectivity Methods & File Constraints

| Method | Max Encounters/File | Max per ST/SE | File Format | Max Files/Day |
|--------|--------------------:|:-------------:|-------------|:-------------:|
| FTP | 85,000 | 5,000 | Free-form | No limit (1 per 5 min recommended) |
| NDM/Connect:Direct | 85,000 | 5,000 | 80-byte fixed block | 255 |
| Gentran/TIBCO | 5,000 | 5,000 | 80-byte fixed block | 255 |

### 1.5 File Naming Conventions

**EDFES Reports (Production FTP):**
| Report | Pattern |
|--------|---------|
| TA1 | `X12xxxxx.X12.TMMDDCCYYHHMMS` |
| 999 | `999#####.999.999` |
| 277CA | `RSPxxxxx.RSP_277CA` |
| EDFES Notification | `RSPxxxxx.RSP.REJECTED_ID` |

**EDPS Reports (Production FTP):**
| Report | Formatted | Flat File |
|--------|-----------|-----------|
| MAO-001 Duplicates | `RPTxxxxx.RPT.PROD_001_DATDUP_RPT` | `RPTxxxxx.RPT.PROD_001_DATDUP_File` |
| MAO-002 Processing Status | `RPTxxxxx.RPT.PROD_002_DATPRS_RPT` | `RPTxxxxx.RPT.PROD_002_DATPRS_File` |
| MAO-004 Risk Filter | `RPTxxxxx.RPT.PROD_004_RSKFLT_RPT` | `RPTxxxxx.RPT.PROD_004_RSKFLT_File` |

---

## 2. Record Types & Business Cases

### 2.1 Encounter Data Record (EDR) Types

| Type | CLM05-3 | REF*F8 | PWK01/02 | Description |
|------|:-------:|--------|----------|-------------|
| Standard Original | 1 | — | — | Initial encounter submission |
| Capitated | 1 | — | — | CN101=05 for capitated arrangements |
| Paper Generated | 1 | — | PY/AA | From paper claim source |
| Atypical Provider | 1 | — | — | Default NPI: 1999999984 (Prof) |
| Ambulance | 1 | — | AM/AA | With 2310E/F pick-up/drop-off |
| True COB | 1 | — | — | SBR01=P (primary) or T (tertiary) |
| Bundled | 1 | — | — | Multiple services in one encounter |
| Replacement | 7 | ICN of original | — | Replaces previously accepted EDR |
| Void/Delete | 8 | ICN of original | — | Voids previously accepted EDR |

### 2.2 Chart Review Record (CRR) Types

| Type | PWK01/02 | CLM05-3 | REF*F8 | REF*EA | Description |
|------|----------|:-------:|--------|--------|-------------|
| Linked CRR-Add | 09/AA | 1 | ICN of EDR/CRR | — | Add diagnoses to existing record |
| Linked CRR-Delete | 09/AA | 1 or 8 | ICN of EDR/CRR | EA/8 | Delete diagnoses from existing record |
| Unlinked CRR-Add | 09/AA | 1 | — | — | Add diagnoses (not linked to specific EDR) |
| Replacement CRR | 09/AA | 7 | ICN of CRR | — | Replace previously accepted CRR |
| Void CRR | 09/AA | 8 | ICN of CRR | — | Void previously accepted CRR |

### 2.3 Duplicate Detection Logic

**Header Level** — identified collectively by: ISA13 + GS06 + ST02 + BHT03

**Detail Level (EDPS):**
- Edit 98315: Linked Chart Review Duplicate
- Edit 98320: Chart Review Duplicate
- Edit 98325: Service Line(s) Duplicated

---

## 3. Key Data Elements (CMS-Specific Requirements)

### 3.1 Envelope (ISA/GS/ST/BHT)

| Element | CMS Value | Notes |
|---------|-----------|-------|
| ISA05/07 | ZZ | Mutually defined |
| ISA06 | EN + Contract ID | e.g., ENH1234 |
| ISA08 | 80882 | CMS receiver ID |
| ISA11 | ^ | Repetition separator |
| ISA14 | 1 | TA1 requested |
| ISA15 | T or P | Test / Production |
| GS02 | EN + Contract ID | Must match ISA06 |
| GS03 | 80882 | Must match ISA08 |
| GS08 | 005010X222A1 (837P) / 005010X223A2 (837I) | |
| BHT03 | Unique per file | Part of duplicate detection |
| BHT06 | CH | Chargeable |

### 3.2 Submitter/Receiver

| Element | CMS Value |
|---------|-----------|
| NM1*41 NM102 | 2 (Non-Person) |
| NM1*41 NM109 | EN + Contract ID |
| NM1*40 NM103 | EDSCMS |
| NM1*40 NM109 | 80882 |

### 3.3 Subscriber/Payer (CMS-Specific)

| Element | CMS Value | Notes |
|---------|-----------|-------|
| SBR01 | S | CMS is secondary payer |
| SBR09 | MB | Medicare Part B |
| NM1*IL NM108 | MI | Member ID qualifier |
| NM1*IL NM109 | HICN or MBI | Medicare Beneficiary Identifier |
| NM1*PR NM103 | EDSCMS | Payer name |
| NM1*PR NM108 | PI | Payer ID qualifier |
| NM1*PR NM109 | 80882 | Payer identification |
| NM1*PR N301 | 7500 Security Blvd | CMS address |
| NM1*PR N401/N402/N403 | Baltimore / MD / 212441850 | |
| REF*2U REF02 | Contract ID Number | In Loop 2010BB |

### 3.4 Other Payer (Loop 2320/2330)

| Element | CMS Value | Notes |
|---------|-----------|-------|
| SBR01 | P or T | Primary or Tertiary |
| SBR09 | 16 | HMO Medicare Risk |
| NM1*2330A NM109 | Must match 2010BA NM109 | Subscriber ID cross-check |
| NM1*2330B NM108 | XV | Other payer qualifier |
| NM1*2330B NM109 | Payer01 (Contract ID) | When no other payer ID available |
| AMT02 | MAO paid amount | |

### 3.5 Billing Provider

| Element | CMS Value | Notes |
|---------|-----------|-------|
| NM108 | XX | NPI qualifier |
| NM109 | 1XXXXXXXXX | 10-digit, starts with 1. Default: 1999999984 (Prof atypical) |
| N403 | 9-digit ZIP | Default last 4: 9998 |
| REF01 | EI | Employer ID Number |
| REF02 | XXXXXXXXX | Default: 199999998 (Prof atypical) |

### 3.6 Claim Header (Loop 2300)

| Element | Values | Notes |
|---------|--------|-------|
| CLM05-3 | 1 / 7 / 8 | Original / Replacement / Void |
| PWK01 | 09 (chart review), OZ (paper), AM (ambulance), PY (4010) | Special submission indicators |
| PWK02 | AA | For chart review / paper / ambulance |
| CN101 | 05 | Capitated arrangement |
| REF*F8 | ICN | Links to original for adjustment/void/CRR |
| REF*EA = 8 | — | Signals CRR-Delete diagnosis |
| NTE01 | ADD | Default data reason code |

---

## 4. Acknowledgement Report Parsing

### 4.1 TA1 (Interchange)
- TA104 = "R" → interchange rejected
- TA105 = numeric error code

### 4.2 999 (Functional Group)
- IK5 segment: A = Accepted, R = Rejected, P = Partially Accepted
- AK9 segment: mirrors IK5
- IK3: loop/segment with error (element 3 = loop ID)
- IK4: element with error (element 1 = element ID, element 3 = reason code)

### 4.3 277CA (Claim Acknowledgement)
- Hierarchical: Info Source → Info Receiver → Billing Provider → Patient
- STC03 = "WQ" → accepted; STC03 = "U" → rejected
- REF01=IK, REF02=ICN → assigned Internal Control Number
- STC01 = acknowledgement code on rejection

### 4.4 MAO-002 (Processing Status)
- Line "000" = header status (accepted/rejected)
- Lines "001", "002"... = service line statuses
- "Accepted" + edit in description = informational edit
- "Rejected" at 000 = entire encounter must be corrected

---

## 5. Recommended Agent Architecture

### 5.1 Agent Registry

| # | Agent Name | Responsibility | Input | Output |
|---|-----------|----------------|-------|--------|
| 1 | **Ingest Agent** | Parse raw claims from any format (CSV, JSON, XML, 4010, paper) | Raw files | Normalized claim records |
| 2 | **Enrollment Verification Agent** | Validate member eligibility, MBI/HICN lookup, contract enrollment | Member ID + DOS | Enrollment status, contract ID |
| 3 | **Provider Validation Agent** | Validate NPI, taxonomy, EIN; apply atypical provider defaults | Provider data | Validated provider records |
| 4 | **Claim Classification Agent** | Determine record type (EDR vs CRR, linked/unlinked, original/replacement/void) | Claim metadata | Classified record with correct CLM05-3, PWK, REF values |
| 5 | **CMS Template Agent** | Apply CMS-specific envelope defaults (ISA/GS/ST/BHT values, payer address, receiver ID) | Classified claim | Templated 837 with CMS envelope |
| 6 | **Pre-Submission Edit Agent** | Run CEM/CCEM edits BEFORE submission to catch errors early | Complete 837 | Edit results, pass/fail per claim |
| 7 | **837 Generator Agent** | Build compliant 837P or 837I from validated/templated data | Validated claim | 837 EDI file |
| 8 | **File Packaging Agent** | Split into files per connectivity limits, apply file naming, track control numbers | 837 files | Packaged submission batches |
| 9 | **Submission Agent** | Transmit files via FTP/NDM/TIBCO, track submission status | Packaged files | Submission confirmations |
| 10 | **ACK Parser Agent** | Parse TA1, 999, 277CA, MAO-001, MAO-002 reports | Report files | Parsed acknowledgements |
| 11 | **Reconciliation Agent** | Match ACK results to submitted claims, update statuses, identify resubmissions needed | ACK data + submission records | Reconciled status, resubmission queue |
| 12 | **CRR Management Agent** | Handle chart review workflows: linked/unlinked add/delete, replacement, void | Chart review requests | CRR records with correct linking |
| 13 | **Duplicate Detection Agent** | Pre-check duplicates before submission using ISA13+GS06+ST02+BHT03 and detail-level logic | Claims to submit | Duplicate flags |
| 14 | **Compliance Monitoring Agent** | Track CMS metrics (O1-O3, C1-C4), submission timeliness, acceptance rates | Submission history | Compliance dashboard |

### 5.2 Agent Interaction Flow

```
Raw Data → [1.Ingest] → [2.Enrollment] → [3.Provider] → [4.Classification]
                                                              ↓
[14.Compliance] ← [11.Reconciliation] ← [10.ACK Parser] ← [9.Submission]
                                                              ↑
                   [12.CRR Mgmt] → [5.Template] → [6.Pre-Edit] → [7.Generator] → [8.Packaging]
                                                                       ↑
                                                              [13.Duplicate Check]
```

---

## 6. Data Architecture

### 6.1 Core Tables

```
┌────────────────────────────────────────────────────┐
│                    submissions                      │
│ id, file_name, connectivity_method, isa_control_num │
│ gs_control_num, submitted_at, environment (T/P)     │
│ status, contract_id, claim_count                    │
└────────────────────────┬───────────────────────────┘
                         │ 1:N
┌────────────────────────┴───────────────────────────┐
│                   encounter_records                  │
│ id, submission_id, record_type (EDR/CRR)            │
│ claim_type (837P/837I), pcn, bht03, st02            │
│ frequency_code (1/7/8), linked_icn, crr_type        │
│ pwk01, pwk02, contract_id, total_charge             │
│ service_date_from, service_date_to                   │
│ cms_icn (assigned by 277CA), status                  │
│ created_at, submitted_at, accepted_at                │
└──────┬──────────┬──────────┬──────────┬────────────┘
       │          │          │          │
  1:1  │     1:N  │     1:N  │     1:N  │
┌──────┴──┐ ┌────┴────┐ ┌───┴───┐ ┌───┴────────────┐
│subscriber│ │providers│ │diagnoses│ │ service_lines  │
│member_id │ │role     │ │sequence│ │line_number     │
│hicn_mbi  │ │npi      │ │code    │ │procedure_code  │
│last_name │ │ein      │ │qualifier│ │revenue_code   │
│first_name│ │taxonomy │ │poa_ind │ │charge_amount   │
│dob,gender│ │is_atyp  │ │        │ │units, modifiers│
│address   │ │         │ │        │ │                │
└──────────┘ └─────────┘ └────────┘ └────────────────┘

┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│       payer_info                  │  │      other_payer_info             │
│ payer_name (EDSCMS)              │  │ sbr01 (P/T), sbr09 (16)          │
│ payer_id (80882)                 │  │ contract_id, paid_amount          │
│ address (7500 Security Blvd...)  │  │ cas_reason_code                   │
│ ref_2u (contract ID)             │  │ adjudication_date                 │
└──────────────────────────────────┘  └──────────────────────────────────┘

┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│     acknowledgements              │  │     control_number_tracker        │
│ id, encounter_id, submission_id  │  │ isa13, gs06, st02, bht03          │
│ ack_type (TA1/999/277CA/MAO001/2)│  │ used_at, environment              │
│ status (accepted/rejected)       │  │ contract_id                       │
│ icn_assigned, error_codes[]      │  │ (unique index for duplicate det.) │
│ ik3_loop, ik4_element, stc_codes │  │                                   │
│ received_at, raw_report          │  │                                   │
└──────────────────────────────────┘  └──────────────────────────────────┘

┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│      cms_template_defaults        │  │      edit_rules                   │
│ id, template_name                │  │ edit_code, description             │
│ isa_receiver (80882)             │  │ loop, segment, element             │
│ payer_name (EDSCMS)              │  │ severity (reject/info/warn)        │
│ payer_address, contract_id       │  │ phase (CEM/CCEM/EDPPPS)           │
│ default_npis{}, default_eins{}   │  │ active (true/false)               │
│ sbr_values{}, ref_values{}       │  │ deactivated_date                  │
│ valid_frequency_codes[]          │  │ resolution_strategy               │
└──────────────────────────────────┘  └──────────────────────────────────┘
```

### 6.2 Configuration Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `cms_template_defaults` | CMS envelope values, payer address, default NPIs/EINs | ISA receiver, payer name/ID, contract ID |
| `edit_rules` | All CEM/CCEM/EDPPPS edit rules with activation status | Edit code, loop/segment/element, severity, active flag |
| `connectivity_config` | Per-contract FTP/NDM/TIBCO settings | Method, host, credentials, file limits |
| `file_naming_rules` | Report file naming patterns by environment/method | Pattern template, environment, connectivity |
| `control_number_sequences` | Auto-incrementing ISA13/GS06/ST02/BHT03 | Sequence name, next value, contract |
| `default_data_codes` | DDRC codes for default data scenarios | Segment, code, reason, NTE text |
| `crr_linking_rules` | CRR type determination logic | Conditions, resulting PWK/CLM/REF values |
| `provider_defaults` | Atypical provider default NPIs and EINs by service type | Service type, default NPI, default EIN |

---

## 7. Segment Qualifier Templates

### 7.1 Standard EDR Template (837P Professional)

```
ISA*00*{10 spaces}*00*{10 spaces}*ZZ*{EN+ContractID,15}*ZZ*80882{10 spaces}*{YYMMDD}*{HHMM}*^*00501*{ISA13,9}*1*{T|P}*:~
GS*HC*{EN+ContractID}*80882*{CCYYMMDD}*{HHMM}*{GS06}*X*005010X222A1~
ST*837*{ST02}*005010X222A1~
BHT*0019*00*{BHT03}*{CCYYMMDD}*{HHMM}*CH~
NM1*41*2*{SubmitterName}*****46*{EN+ContractID}~
PER*IC*{ContactName}*TE*{Phone}*EM*{Email}~
NM1*40*2*EDSCMS*****46*80882~
HL*1**20*1~
PRV*BI*PXC*{Taxonomy}~
NM1*85*{1|2}*{BillingName}*{First}****XX*{BillingNPI}~
N3*{Address}~
N4*{City}*{State}*{ZIP9}~
REF*EI*{BillingEIN}~
HL*2*1*22*0~
SBR*S*18*****MB~
NM1*IL*1*{SubLastName}*{SubFirstName}****MI*{MBI}~
N3*{SubAddress}~
N4*{SubCity}*{SubState}*{SubZIP}~
DMG*D8*{DOB}*{Gender}~
NM1*PR*2*EDSCMS*****PI*80882~
N3*7500 Security Blvd~
N4*Baltimore*MD*212441850~
REF*2U*{ContractID}~
CLM*{PCN}*{TotalCharge}***{POS}:B:{FreqCode}*Y*A*Y*I~
DTP*472*D8*{ServiceDate}~
{HI segments}
{2310 Provider segments}
{2320/2330 Other Payer segments}
{2400 Service Line segments}
SE*{SegCount}*{ST02}~
GE*1*{GS06}~
IEA*1*{ISA13}~
```

### 7.2 CRR Templates Required

| Template | PWK01 | PWK02 | CLM05-3 | REF*F8 | REF*EA |
|----------|:-----:|:-----:|:-------:|--------|--------|
| Linked CRR-Add | 09 | AA | 1 | ICN | — |
| Linked CRR-Delete | 09 | AA | 1 | ICN | EA/8 |
| Unlinked CRR-Add | 09 | AA | 1 | — | — |
| Replacement CRR | 09 | AA | 7 | ICN of CRR | — |
| Void CRR | 09 | AA | 8 | ICN of CRR | — |
| Capitated EDR | — | — | 1 | — | — | (CN101=05) |
| Paper EDR | OZ | AA | 1 | — | — |
| Ambulance EDR | AM | AA | 1 | — | — |
| Replacement EDR | — | — | 7 | ICN | — |
| Void EDR | — | — | 8 | ICN | — |

---

## 8. Edit Validation Categories

### 8.1 Front-End (EDFES) Edit Phases

| Phase | Edit Source | Report | Scope |
|-------|-----------|--------|-------|
| Pre-Screen | File-level structural checks | EDFES Notification | File |
| ISA/IEA | Interchange envelope syntax | TA1 | Interchange |
| CEM (GS/GE) | Functional group + segment syntax | 999 | Functional group |
| CEM (ST/SE) | Transaction set / claim-level | 277CA | Claim |
| CCEM | Combined Common Edits | 277CA | Claim |

### 8.2 Back-End (EDPS) Edit Categories

| Category | Edit Range | Description |
|----------|-----------|-------------|
| Duplicate edits | 98315, 98320, 98325 | Header and service-line duplicate detection |
| EDPPPS edits | 98xxx, 02xxx, 00xxx | Processing, pricing, business rules |
| Informational edits | Various | Accepted but flagged for MAO review |
| Risk adjustment filtering | — | MAO-004 diagnosis eligibility |

### 8.3 Edit Rules We Must Implement

**Pre-submission validation (Agent 6) should cover:**

1. **Structural edits**: ISA/IEA matching, GS/GE matching, ST/SE matching, segment counts
2. **CMS-specific value edits**: ISA06 format, ISA08=80882, BHT06=CH, SBR01=S, SBR09=MB
3. **NPI validation**: 10 digits starting with 1, Luhn check
4. **Beneficiary ID**: Valid MBI format (per Appendix 3C)
5. **Date validation**: Valid CCYYMMDD, DOS in valid range, ICD-9/10 transition logic
6. **Code set validation**: Valid ICD-10-CM, CPT/HCPCS, revenue codes, HIPPS codes
7. **Cross-field edits**: ZIP must be 9 digits, control numbers must match
8. **CRR-specific edits**: Linked ICN must exist, delete requires EA/8, unlinked cannot delete
9. **Business rule edits**: Capitated encounter CN101=05, ambulance requires 2310E/F

---

## 9. Workflow for Data Processing

### 9.1 Ingestion Workflow

```
┌─────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Raw Claims   │──>│ Format       │──>│ Normalize    │──>│ Store in     │
│ (CSV/JSON/   │   │ Detection    │   │ to DB Schema │   │ Claims DB    │
│  XML/4010/   │   │ & Parse      │   │              │   │              │
│  paper)      │   │              │   │              │   │              │
└─────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

### 9.2 Validation & Generation Workflow

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Claims DB    │──>│ Classify     │──>│ Apply CMS    │──>│ Run Pre-     │
│ Records      │   │ (EDR/CRR/    │   │ Template     │   │ Submission   │
│              │   │  type)       │   │ Defaults     │   │ Edits        │
└──────────────┘   └──────────────┘   └──────────────┘   └──────┬───────┘
                                                                │
                                                          ┌─────┴─────┐
                                                          │  PASS?    │
                                                          └─────┬─────┘
                                                     Yes ┌──────┴──────┐ No
                                                         │             │
                                                  ┌──────┴──────┐  ┌──┴──────────┐
                                                  │ Generate    │  │ Error Queue │
                                                  │ 837 EDI     │  │ for Manual  │
                                                  │             │  │ Review      │
                                                  └──────┬──────┘  └─────────────┘
                                                         │
                                                  ┌──────┴──────┐
                                                  │ Package &   │
                                                  │ Submit      │
                                                  └─────────────┘
```

### 9.3 ACK Processing Workflow

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Receive ACK  │──>│ Parse Report │──>│ Match to     │──>│ Update       │
│ Files (TA1,  │   │ (TA1/999/    │   │ Submitted    │   │ Encounter    │
│  999, 277CA, │   │  277CA/      │   │ Records      │   │ Status       │
│  MAO-001/002)│   │  MAO-001/002)│   │              │   │              │
└──────────────┘   └──────────────┘   └──────────────┘   └──────┬───────┘
                                                                │
                                                         ┌──────┴──────┐
                                                         │ Rejected?   │
                                                         └──────┬──────┘
                                                    Yes ┌───────┴───────┐ No
                                                        │               │
                                                 ┌──────┴──────┐  ┌────┴────────┐
                                                 │ Resubmission│  │ Mark as     │
                                                 │ Queue +     │  │ Accepted +  │
                                                 │ Error Code  │  │ Store ICN   │
                                                 │ Analysis    │  │             │
                                                 └─────────────┘  └─────────────┘
```

---

## 10. Implementation Priorities

### Phase 1: Foundation
- **Agent 1** (Ingest) + **Agent 5** (CMS Template) + **Agent 7** (837 Generator)
- Core data architecture (encounter_records, subscribers, providers, diagnoses, service_lines)
- CMS template defaults configuration table
- Control number tracking

### Phase 2: Pre-Submission Quality
- **Agent 4** (Claim Classification) — EDR vs CRR, linked/unlinked
- **Agent 6** (Pre-Submission Edits) — implement CEM/CCEM edit rules
- **Agent 13** (Duplicate Detection) — ISA13+GS06+ST02+BHT03 uniqueness
- Edit rules configuration table

### Phase 3: Submission & Acknowledgement
- **Agent 8** (File Packaging) — split by connectivity limits, file naming
- **Agent 9** (Submission) — FTP/NDM integration
- **Agent 10** (ACK Parser) — TA1, 999, 277CA, MAO-001, MAO-002
- **Agent 11** (Reconciliation) — match ACKs to submissions

### Phase 4: Chart Review & Advanced
- **Agent 12** (CRR Management) — linked/unlinked CRR workflows
- **Agent 2** (Enrollment Verification) — MBI validation, contract matching
- **Agent 3** (Provider Validation) — NPI/EIN lookup, atypical provider defaults

### Phase 5: Compliance
- **Agent 14** (Compliance Monitoring) — CMS metrics O1-O3, C1-C4
- Quarterly report card generation
- Self-assessment dashboard

---

## 11. Next Steps

Once you share the complete edit list, I will:
1. Map each edit to a specific agent
2. Define edit validation rules with loop/segment/element references
3. Build edit configuration schemas
4. Create test cases per edit code
5. Define error resolution workflows per edit category
