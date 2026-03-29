# Original Encounter Submission Pipeline — Production Specification

## Document Purpose
Complete specification for the happy-path Original Encounter (CLM05-3 = 1) submission pipeline. Covers data ingestion, field mapping, CMS-compliant validation, and 837P EDI generation. Designed for minimal human review by automating all CMS-mandated validations.

**Scope:** Original encounters only (not voids, adjustments, or CRRs).
**Claim type focus:** 837P Professional (extensible to 837I and DME).

---

## 1. Pipeline Overview

```
INPUT FILE                   AGENTS                          OUTPUT
(CSV/JSON/XML/837) ──┐
                     ├──▶ [A1] Ingest Agent ──────────────▶ Normalized Claim Records
                     │         │
                     │    [A2] Field Mapper Agent ────────▶ Mapped to 837 Schema
                     │         │
                     │    [A3] Validation Agent ──────────▶ Validation Report
                     │         │                              (pass/fail per field)
                     │    [A4] Template Agent ────────────▶ CMS Envelope Applied
                     │         │
                     │    [A5] 837 Generator Agent ───────▶ 837P EDI File
                     │         │
                     │    [A6] Output Validator Agent ────▶ Self-Check Report
                     │                                        (parse generated 837,
                     │                                         run same validations)
                     │
                     └──▶ AUDIT LOG (every step recorded)
```

**Principle:** Each agent is stateless and idempotent. Given the same input, it produces the same output. All state is stored in the claims database between steps.

---

## 2. Input Data Specification

### 2.1 What the System Expects

The input file contains one or more claim records with provider, subscriber, diagnosis, and service line data. The system accepts 4 formats:

| Format | Detection | Notes |
|--------|-----------|-------|
| CSV | File extension `.csv` or first line contains comma-separated headers | One row = one claim (flat, service lines in columns or repeated rows) |
| JSON | File starts with `{` or `[` | Nested structure with arrays for diagnoses and service lines |
| XML | File starts with `<?xml` or `<` | `<claim>` elements with child elements |
| 837 | File starts with `ISA*` | Re-process existing 837 — extract claim data and regenerate |

### 2.2 Input Field Catalog

These are the fields the system can accept from any input format. Fields marked **Required** must be present; **Recommended** improve acceptance rates; **Optional** are passed through if provided.

#### 2.2.1 Claim Header Fields

| # | Input Field Name | Required | Maps To (837) | Aliases Accepted | Notes |
|---|-----------------|:--------:|---------------|-----------------|-------|
| 1 | `patientControlNumber` | **Yes** | CLM01 | `pcn`, `claim_id`, `claim_number`, `claimId` | Unique per claim. Max 20 chars. |
| 2 | `totalChargeAmount` | **Yes** | CLM02 | `total_charge`, `charge_amount`, `total_amount` | Decimal. Must equal sum of line charges. |
| 3 | `facilityCode` | **Yes** | CLM05-1 | `pos`, `place_of_service`, `facility_type_code` | 2-digit POS code (11, 12, 22, etc.) |
| 4 | `serviceDateFrom` | **Yes** | DTP*472 | `dos`, `service_date`, `date_of_service`, `from_date` | CCYYMMDD or YYYY-MM-DD. Not future. |
| 5 | `serviceDateTo` | Recommended | DTP*472 | `service_date_to`, `to_date`, `thru_date` | Defaults to serviceDateFrom if absent |
| 6 | `claimType` | Recommended | ST03/GS08 | `claim_type`, `type` | `837P` or `837I`. Defaults to `837P` |

#### 2.2.2 Subscriber (Member/Patient) Fields

| # | Input Field Name | Required | Maps To (837) | Aliases Accepted | Notes |
|---|-----------------|:--------:|---------------|-----------------|-------|
| 7 | `memberId` | **Yes** | NM1*IL NM109 | `member_id`, `subscriber_id`, `hicn`, `mbi`, `beneficiary_id` | HICN or MBI. MBI format validated. |
| 8 | `subscriberLastName` | **Yes** | NM1*IL NM103 | `last_name`, `patient_last_name`, `sub_last` | |
| 9 | `subscriberFirstName` | **Yes** | NM1*IL NM104 | `first_name`, `patient_first_name`, `sub_first` | |
| 10 | `dateOfBirth` | **Yes** | DMG02 | `dob`, `birth_date`, `date_of_birth`, `birthDate` | CCYYMMDD. Must be past. Not future. |
| 11 | `gender` | **Yes** | DMG03 | `sex`, `subscriber_gender` | M, F, or U |
| 12 | `subscriberAddress` | Recommended | N3 N301 | `address`, `address_line_1`, `street` | |
| 13 | `subscriberCity` | Recommended | N4 N401 | `city` | |
| 14 | `subscriberState` | Recommended | N4 N402 | `state` | 2-letter state code |
| 15 | `subscriberZip` | Recommended | N4 N403 | `zip`, `zip_code`, `postal_code` | 5 or 9 digits |

#### 2.2.3 Billing Provider Fields

| # | Input Field Name | Required | Maps To (837) | Aliases Accepted | Notes |
|---|-----------------|:--------:|---------------|-----------------|-------|
| 16 | `billingNPI` | **Yes** | 2010AA NM109 | `billing_npi`, `billing_provider_npi` | 10-digit, starts with 1. Luhn check. |
| 17 | `billingProviderName` | **Yes** | 2010AA NM103 | `billing_name`, `billing_provider`, `billing_org` | Org name (if entity type 2) or last name |
| 18 | `billingProviderFirstName` | Situational | 2010AA NM104 | `billing_first_name` | Required if person (entity type 1) |
| 19 | `billingTaxId` | **Yes** | 2010AA REF02 | `billing_ein`, `tax_id`, `ein` | 9-digit EIN |
| 20 | `billingAddress` | **Yes** | 2010AA N301 | `billing_address`, `billing_street` | |
| 21 | `billingCity` | **Yes** | 2010AA N401 | `billing_city` | |
| 22 | `billingState` | **Yes** | 2010AA N402 | `billing_state` | 2-letter state code |
| 23 | `billingZip` | **Yes** | 2010AA N403 | `billing_zip`, `billing_zip_code` | 9-digit. Default suffix 9998 if only 5. |
| 24 | `billingTaxonomy` | Recommended | 2000A PRV03 | `billing_taxonomy`, `taxonomy_code` | Provider taxonomy code |
| 25 | `billingEntityType` | Recommended | 2010AA NM102 | `billing_entity_type` | 1=Person, 2=Org. Default: 2 |

#### 2.2.4 Rendering Provider Fields

| # | Input Field Name | Required | Maps To (837) | Aliases Accepted | Notes |
|---|-----------------|:--------:|---------------|-----------------|-------|
| 26 | `renderingNPI` | Recommended | 2310B NM109 | `rendering_npi`, `rendering_provider_npi`, `provider_npi` | 10-digit NPI. If absent, billing NPI used. |
| 27 | `renderingProviderLastName` | Recommended | 2310B NM103 | `rendering_name`, `rendering_provider`, `provider_last_name` | |
| 28 | `renderingProviderFirstName` | Recommended | 2310B NM104 | `rendering_first_name`, `provider_first_name` | |
| 29 | `renderingTaxonomy` | Optional | 2310B PRV03 | `rendering_taxonomy` | |
| 30 | `renderingEntityType` | Optional | 2310B NM102 | `rendering_entity_type` | 1=Person, 2=Org. Default: 1 |

#### 2.2.5 Diagnosis Fields

| # | Input Field Name | Required | Maps To (837) | Aliases Accepted | Notes |
|---|-----------------|:--------:|---------------|-----------------|-------|
| 31 | `diagnosisCode1` (principal) | **Yes** | HI*ABK:code | `icd`, `diagnosis_code`, `principal_dx`, `dx1`, `icd10` | ICD-10-CM. No decimal in 837. |
| 32 | `diagnosisCode2` through `diagnosisCode12` | Optional | HI*ABF:code | `dx2`…`dx12`, `other_dx`, `diagnosis_codes` | Up to 12 per 837P claim |

#### 2.2.6 Service Line Fields

For CSV: lines can be in columns (cpt1/charge1/units1, cpt2/charge2/units2) or as repeated rows with same PCN.

| # | Input Field Name | Required | Maps To (837) | Aliases Accepted | Notes |
|---|-----------------|:--------:|---------------|-----------------|-------|
| 33 | `procedureCode` | **Yes** | SV101-2 | `cpt`, `cpt_code`, `hcpcs`, `procedure`, `proc_code` | CPT/HCPCS code |
| 34 | `lineChargeAmount` | **Yes** | SV102 | `charge`, `line_charge`, `line_amount` | Decimal amount |
| 35 | `unitCount` | **Yes** | SV104 | `units`, `quantity`, `unit_count`, `service_units` | Positive integer |
| 36 | `modifier1` | Optional | SV101-3 | `modifier`, `mod1` | 2-character modifier |
| 37 | `modifier2` | Optional | SV101-4 | `mod2` | |
| 38 | `modifier3` | Optional | SV101-5 | `mod3` | |
| 39 | `modifier4` | Optional | SV101-6 | `mod4` | |
| 40 | `lineServiceDateFrom` | Optional | 2400 DTP*472 | `line_dos`, `line_service_date` | Defaults to claim serviceDateFrom |
| 41 | `lineServiceDateTo` | Optional | 2400 DTP*472 | `line_to_date` | Defaults to lineServiceDateFrom |
| 42 | `diagnosisPointers` | Recommended | SV107 | `diag_pointers`, `dx_pointers` | e.g., "1" or "1:2:3:4". Default: "1" |
| 43 | `unitType` | Optional | SV103 | `unit_type`, `unit_basis` | UN=Unit (default), MJ=Minutes, DA=Days |
| 44 | `ndcCode` | Optional | LIN03 | `ndc`, `drug_code` | National Drug Code |

#### 2.2.7 Other Payer (COB) Fields

| # | Input Field Name | Required | Maps To (837) | Aliases Accepted | Notes |
|---|-----------------|:--------:|---------------|-----------------|-------|
| 45 | `paidAmount` | **Yes** | 2320 AMT02 | `mao_paid_amount`, `plan_paid`, `paid` | MAO paid amount. Can be 0 for denied. |
| 46 | `adjudicationDate` | Recommended | 2430 DTP03 | `adj_date`, `payment_date`, `remit_date` | Default: receipt date minus 1 day |
| 47 | `denialReasonCode` | Situational | 2320 CAS02 / 2430 CAS02 | `denial_code`, `carc`, `adjustment_reason` | Required if claim was denied by MAO |
| 48 | `contractId` | **Yes** | 2010BB REF02 / ISA06 | `contract_id`, `contract_number`, `plan_id` | CMS contract ID (e.g., H1234) |

---

## 3. Agent Responsibilities

### Agent A1: Ingest Agent

**Input:** Raw file (CSV/JSON/XML/837)
**Output:** Array of normalized claim objects

| Step | Action | Validation |
|------|--------|-----------|
| 1.1 | Detect file format | Must be CSV, JSON, XML, or 837 |
| 1.2 | Parse file into raw rows/objects | Syntax must be valid (well-formed JSON/XML, valid CSV headers) |
| 1.3 | For each raw record, resolve field aliases | Map `dob` → `dateOfBirth`, `cpt` → `procedureCode`, etc. |
| 1.4 | Detect multi-line claims | If CSV has repeated PCNs, group into single claim with multiple service lines |
| 1.5 | Detect multi-diagnosis fields | Split `E11.9,I10,J44.1` into separate diagnosis entries |
| 1.6 | Normalize date formats | Convert `2024-03-15`, `03/15/2024`, `20240315` → `20240315` |
| 1.7 | Normalize amounts | Remove `$`, commas. Ensure decimal format. |
| 1.8 | Normalize codes | Strip dots from ICD codes (`E11.9` → `E119`), uppercase all codes |
| 1.9 | Assign internal claim ID | UUID for tracking through pipeline |
| 1.10 | Write to claims database | Status = `INGESTED` |

**Errors that halt a claim:** Missing PCN, unparseable file, no service lines detected.
**Errors that warn:** Missing optional fields, unrecognized columns.

---

### Agent A2: Field Mapper Agent

**Input:** Normalized claim from A1
**Output:** Claim mapped to 837 segment/element positions

| Step | Action | Uses |
|------|--------|------|
| 2.1 | Map each input field to its 837 loop/segment/element | `QUALIFIER_REGISTRY` for qualifier auto-population |
| 2.2 | Auto-populate all file-level qualifiers | `getAutoPopulatedValues()` — fills 72 single-value fields |
| 2.3 | Auto-populate date/time stamps | `generateSubmissionTimestamps()` — ISA09/10, GS04/05, BHT04/05 in ET |
| 2.4 | Apply CMS payer defaults | NM1*PR=EDSCMS, PI, 80882, 7500 Security Blvd, Baltimore, MD, 212441850 |
| 2.5 | Apply billing provider defaults | If no ZIP suffix → append 9998. REF01=EI. |
| 2.6 | Set original encounter qualifiers | CLM05-3=1, BHT06=CH, SBR01=S, SBR09=MB |
| 2.7 | Build HI segment from diagnosis list | First dx → ABK qualifier, rest → ABF |
| 2.8 | Build SV1 segments from service lines | SV101-1=HC, map procedure code, modifiers, charge, units |
| 2.9 | Build diagnosis pointer references | SV107 = pointers to HI positions (1-based) |
| 2.10 | Compute CLM02 | Sum of all SV102 line charges. Must match input totalChargeAmount. |
| 2.11 | Set Other Payer (2320/2330) | SBR01=P, SBR09=16, contract ID, paid amount |
| 2.12 | Generate control numbers | ISA13, GS06, ST02, BHT03 — unique, sequential, 9-digit padded |
| 2.13 | Write mapped record to DB | Status = `MAPPED` |

---

### Agent A3: Validation Agent

**Input:** Mapped claim from A2
**Output:** Validation report — list of pass/fail per field with error codes

This is the critical agent. It runs **every CMS-mandated edit** before submission to prevent TA1/999/277CA/MAO-002 rejections.

#### 3.1 File-Level Validations (Would cause TA1 or 999 rejection)

These are validated once per generated file, not per claim.

| # | Validation | Field | Rule | Edit Level |
|---|-----------|-------|------|-----------|
| V-F01 | ISA segment exactly 106 characters | ISA | Count chars | TA1 |
| V-F02 | ISA13 unique in 12 months | ISA13 | Check against `control_number_tracker` | TA1 |
| V-F03 | IEA02 matches ISA13 | IEA02 = ISA13 | Cross-field | TA1 |
| V-F04 | GS06 matches GE02 | GS06 = GE02 | Cross-field | 999 |
| V-F05 | ST02 matches SE02 | ST02 = SE02 | Cross-field | 999 |
| V-F06 | SE01 = actual segment count | SE01 | Count segments between ST and SE | 999 |
| V-F07 | GS08 matches ST03 | GS08 = ST03 | Cross-field | 999 |
| V-F08 | ISA06 format (EN + Contract ID) | ISA06 | Regex `^EN[A-Z0-9]+` padded to 15 | TA1 |
| V-F09 | ISA08 = 80882 | ISA08 | Exact match | TA1 |
| V-F10 | BHT03 unique across all files | BHT03 | Check against `control_number_tracker` | 999 |
| V-F11 | ISA09 date not future (ET) | ISA09 | `validateDateNotFuture()` | TA1 |
| V-F12 | ISA10 valid time | ISA10 | HH 00-23, MM 00-59 | TA1 |
| V-F13 | GS04 date not future (ET) | GS04 | `validateDateNotFuture()` | 999 |
| V-F14 | BHT04 date not future (ET) | BHT04 | `validateDateNotFuture()` | 999 |
| V-F15 | ISA05/07 = ZZ | ISA05, ISA07 | Exact match | TA1 |
| V-F16 | ISA14 = 1 | ISA14 | Exact match | TA1 |
| V-F17 | BHT06 = CH | BHT06 | Exact match | 999 |
| V-F18 | Max 5000 CLMs per ST/SE | ST/SE | Count claims | 999 |

#### 3.2 Claim-Level Validations (Would cause 277CA rejection)

| # | Validation | Field(s) | Rule | Category |
|---|-----------|---------|------|----------|
| V-C01 | Patient Control Number present | CLM01 | Required, max 20 chars | Required field |
| V-C02 | Total charge is positive decimal | CLM02 | > 0, decimal format | Format |
| V-C03 | CLM02 = sum of SV102 | CLM02 vs lines | Math check | Cross-field |
| V-C04 | Facility code is valid POS | CLM05-1 | Must be in CMS POS code set | Code set |
| V-C05 | CLM05-3 = 1 (original) | CLM05-3 | Exact match for this pipeline | Business rule |
| V-C06 | Billing NPI is 10 digits starting with 1 | NM109 in 2010AA | Regex + Luhn check | Format |
| V-C07 | Billing EIN is 9 digits | REF02 in 2010AA | Regex `^\d{9}$` | Format |
| V-C08 | Billing ZIP is 9 digits | N403 in 2010AA | Regex `^\d{9}$` | Format |
| V-C09 | Subscriber Member ID present | NM109 in 2010BA | Required, non-empty | Required field |
| V-C10 | Member ID is valid HICN or MBI format | NM109 in 2010BA | MBI regex from Appendix 3C | Format |
| V-C11 | Subscriber last name present | NM103 in 2010BA | Required, non-empty | Required field |
| V-C12 | Subscriber first name present | NM104 in 2010BA | Required, non-empty | Required field |
| V-C13 | Date of birth is valid CCYYMMDD | DMG02 | Calendar real + not future + year ≥ 1900 | Format |
| V-C14 | Gender is M, F, or U | DMG03 | Value set check | Code set |
| V-C15 | Service date is valid CCYYMMDD | DTP03*472 | Calendar real + not future | Format |
| V-C16 | Service date is not before DOB | DTP03*472 vs DMG02 | Service date ≥ DOB | Cross-field |
| V-C17 | At least one diagnosis code present | HI*ABK | Required | Required field |
| V-C18 | Principal diagnosis is valid ICD-10-CM format | HI*ABK code | Regex `^[A-TV-Z]\d[0-9A-Z]{1,5}$` | Code set |
| V-C19 | Other diagnosis codes valid ICD-10-CM | HI*ABF codes | Same regex as V-C18 | Code set |
| V-C20 | At least one service line present | SV1 | Required | Required field |
| V-C21 | Each SV1 has procedure code | SV101-2 | Required, non-empty | Required field |
| V-C22 | Each SV1 charge is positive | SV102 | > 0 | Format |
| V-C23 | Each SV1 unit count is positive integer | SV104 | > 0, integer | Format |
| V-C24 | Service line diagnosis pointers valid | SV107 | Each pointer references a valid HI position | Cross-field |
| V-C25 | Payer name = EDSCMS | NM103 in 2010BB | Exact match | CMS rule |
| V-C26 | Payer ID = 80882 | NM109 in 2010BB | Exact match | CMS rule |
| V-C27 | SBR01 = S (secondary) | SBR01 in 2000B | Exact match | CMS rule |
| V-C28 | SBR09 = MB | SBR09 in 2000B | Exact match for 837P | CMS rule |
| V-C29 | Other subscriber NM109 matches 2010BA NM109 | 2330A NM109 | Cross-field match | CMS rule |
| V-C30 | Other payer SBR09 = 16 | 2320 SBR09 | HMO Medicare Risk | CMS rule |
| V-C31 | Contract ID present in REF*2U | 2010BB REF02 | Required, non-empty | CMS rule |
| V-C32 | Paid amount present | 2320 AMT02 | Required (can be 0 for denied) | Required field |
| V-C33 | Adjudication date valid CCYYMMDD | 2430 DTP03 | Calendar real + not future | Format |
| V-C34 | Line adjudication SVD01 matches 2330B NM109 | 2430 SVD01 | Cross-field match | CMS rule |
| V-C35 | OI03 matches CLM08 | 2320 OI03 vs 2300 CLM08 | Cross-field match | CMS rule |

#### 3.3 Validation Summary Output

For each claim, the agent produces:

```json
{
  "claimId": "internal-uuid",
  "pcn": "CLM-001",
  "validationStatus": "PASS",     // PASS, FAIL, WARN
  "totalChecks": 35,
  "passed": 35,
  "failed": 0,
  "warnings": 0,
  "results": [
    { "id": "V-C01", "field": "CLM01", "value": "CLM-001", "status": "PASS" },
    { "id": "V-C06", "field": "2010AA.NM109", "value": "1234567890", "status": "PASS", "detail": "NPI valid, Luhn check passed" },
    ...
  ]
}
```

**Status = PASS** → proceed to generation.
**Status = FAIL** → halt, record in error queue, report to user.
**Status = WARN** → proceed but flag for review.

After validation, claim status in DB changes to `VALIDATED` (or `VALIDATION_FAILED`).

---

### Agent A4: Template Agent

**Input:** Validated claim
**Output:** Claim with all CMS envelope and qualifier values applied

| Step | Action | Source |
|------|--------|--------|
| 4.1 | Apply ISA defaults (receiver=80882, ZZ, ^, 00501) | `QUALIFIER_REGISTRY` file-level entries |
| 4.2 | Generate ISA13, GS06, ST02, BHT03 control numbers | `control_number_tracker` — sequential, unique |
| 4.3 | Generate ISA09/10, GS04/05, BHT04/05 timestamps | `generateSubmissionTimestamps()` in ET |
| 4.4 | Apply NM1*41 submitter (EN+ContractID) | Per-contract config |
| 4.5 | Apply NM1*40 receiver (EDSCMS, 80882) | `QUALIFIER_REGISTRY` |
| 4.6 | Apply NM1*PR payer block (EDSCMS, 80882, address) | `QUALIFIER_REGISTRY` |
| 4.7 | Apply SBR/DMG qualifiers (S, MB, MI, D8) | `QUALIFIER_REGISTRY` |
| 4.8 | Apply Other Payer defaults (SBR09=16, NM108=XV) | `QUALIFIER_REGISTRY` |
| 4.9 | Format ISA06 to exactly 15 chars (right-pad spaces) | Format rule |
| 4.10 | Format ISA08 to exactly 15 chars | Format rule |

Status in DB → `TEMPLATED`

---

### Agent A5: 837 Generator Agent

**Input:** Templated claim with all values finalized
**Output:** Complete 837P EDI string

Builds segments in this exact order:

```
ISA  (106 chars, space-padded, from template)
GS   (HC, sender, 80882, date, time, control, X, version)
ST   (837, control, version)
BHT  (0019, 00, batch ID, date, time, CH)
NM1*41  (submitter)
PER  (IC, contact, TE, phone, EM, email)
NM1*40  (EDSCMS, 80882)
HL*1  (billing provider level)
PRV  (BI, PXC, taxonomy)  [if taxonomy provided]
NM1*85  (billing provider)
N3   (billing address)
N4   (billing city/state/zip)
REF*EI  (billing EIN)
HL*2  (subscriber level)
SBR  (S, 18, group#, group name, ,,,,MB)
NM1*IL  (subscriber name + MI + member ID)
N3   (subscriber address)  [if provided]
N4   (subscriber city/state/zip)  [if provided]
DMG  (D8, DOB, gender)
NM1*PR  (EDSCMS, PI, 80882)
N3   (7500 Security Blvd)
N4   (Baltimore, MD, 212441850)
REF*2U  (contract ID)
CLM  (PCN, charge, , , POS:B:1, Y, A, Y, I)
DTP*472  (D8, service date)
HI   (ABK:dx1 * ABF:dx2 * ABF:dx3...)
NM1*82  (rendering provider)  [if different from billing]
PRV  (PE, PXC, taxonomy)  [if rendering taxonomy]
SBR  (P, 18, , , , , , , 16)  [other payer]
CAS  (denial reason)  [if denied]
AMT  (D, paid amount)
OI   (, , benefits assignment)
NM1*IL  (other subscriber = same member ID)
NM1*PR  (contract ID as other payer)
N3   (MAO address)
N4   (MAO city/state/zip)
  [For each service line:]
  LX   (line number)
  SV1  (HC:CPT:mod1:mod2:mod3:mod4, charge, UN, units, , , diag pointers)
  DTP*472  (D8, line service date)
  SVD  (contract ID, line paid, HC:CPT, , units)
  CAS  (line denial reason)  [if applicable]
  DTP*573  (D8, adj date)
SE  (segment count, control)
GE  (1, control)
IEA (1, control)
```

Each segment ends with `~` (segment terminator).
Element separator: `*`
Sub-element separator: `:`

Status in DB → `GENERATED`

---

### Agent A6: Output Validator Agent

**Input:** Generated 837 EDI string
**Output:** Self-check validation report

| Step | Action | Purpose |
|------|--------|---------|
| 6.1 | Parse the generated 837 back into segments | Verify it's parseable |
| 6.2 | Count segments, verify SE01 | Structural integrity |
| 6.3 | Verify ISA13 = IEA02 | Control number matching |
| 6.4 | Verify GS06 = GE02 | Control number matching |
| 6.5 | Verify ST02 = SE02 | Control number matching |
| 6.6 | Extract subscriber ID from NM1*IL | Verify data survived generation |
| 6.7 | Extract billing NPI from NM1*85 | Verify data survived generation |
| 6.8 | Extract diagnoses from HI | Verify all diagnosis codes present |
| 6.9 | Extract service lines from SV1 | Verify line count matches |
| 6.10 | Run `validateQualifier()` on key fields | Verify qualifiers are correct |
| 6.11 | Verify no future dates in output | Final date check in ET |

If all checks pass → Status = `READY_TO_SUBMIT`
If any check fails → Status = `GENERATION_ERROR` (should never happen if A3 passed)

---

## 4. Sample Input Files

### 4.1 Sample CSV

```csv
patientControlNumber,totalChargeAmount,facilityCode,serviceDateFrom,memberId,subscriberLastName,subscriberFirstName,dateOfBirth,gender,billingNPI,billingProviderName,billingTaxId,billingAddress,billingCity,billingState,billingZip,billingTaxonomy,renderingNPI,renderingProviderLastName,renderingProviderFirstName,diagnosisCode1,diagnosisCode2,procedureCode,lineChargeAmount,unitCount,modifier1,diagnosisPointers,paidAmount,adjudicationDate,contractId
CLM-ORG-001,250.00,11,20250115,1EG4TE5MK72,SMITH,JOHN,19800315,M,1234567890,ACME MEDICAL GROUP,123456789,100 Main St,Los Angeles,CA,900019998,207Q00000X,9876543210,WILLIAMS,JANE,E119,I10,99213,150.00,1,,1:2,125.00,20250120,H1234
CLM-ORG-001,250.00,11,20250115,1EG4TE5MK72,SMITH,JOHN,19800315,M,1234567890,ACME MEDICAL GROUP,123456789,100 Main St,Los Angeles,CA,900019998,207Q00000X,9876543210,WILLIAMS,JANE,E119,I10,36415,100.00,1,,1,125.00,20250120,H1234
```

Note: Same PCN on two rows = one claim with two service lines.

### 4.2 Sample JSON

```json
{
  "claims": [
    {
      "patientControlNumber": "CLM-ORG-002",
      "totalChargeAmount": 350.00,
      "facilityCode": "11",
      "serviceDateFrom": "20250201",
      "contractId": "H1234",
      "subscriber": {
        "memberId": "1EG4TE5MK72",
        "lastName": "JOHNSON",
        "firstName": "MARY",
        "dateOfBirth": "19750722",
        "gender": "F",
        "address": "200 Oak Ave",
        "city": "Chicago",
        "state": "IL",
        "zip": "606019998"
      },
      "billingProvider": {
        "npi": "1234567890",
        "name": "PREMIER HEALTHCARE",
        "taxId": "987654321",
        "address": "500 Medical Center Dr",
        "city": "Chicago",
        "state": "IL",
        "zip": "606029998",
        "taxonomy": "207Q00000X",
        "entityType": "2"
      },
      "renderingProvider": {
        "npi": "9876543210",
        "lastName": "CHEN",
        "firstName": "LISA",
        "entityType": "1",
        "taxonomy": "207Q00000X"
      },
      "diagnoses": [
        { "code": "J441", "sequence": 1 },
        { "code": "E785", "sequence": 2 }
      ],
      "serviceLines": [
        { "procedureCode": "99214", "chargeAmount": 220.00, "unitCount": 1, "diagnosisPointers": "1:2" },
        { "procedureCode": "93000", "chargeAmount": 130.00, "unitCount": 1, "diagnosisPointers": "1" }
      ],
      "paidAmount": 175.00,
      "adjudicationDate": "20250205"
    }
  ]
}
```

### 4.3 Sample XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<claims>
  <claim>
    <patientControlNumber>CLM-ORG-003</patientControlNumber>
    <totalChargeAmount>550.00</totalChargeAmount>
    <facilityCode>11</facilityCode>
    <serviceDateFrom>20250301</serviceDateFrom>
    <contractId>H1234</contractId>
    <subscriber>
      <memberId>1EG4TE5MK72</memberId>
      <lastName>GARCIA</lastName>
      <firstName>MARIA</firstName>
      <dateOfBirth>19900525</dateOfBirth>
      <gender>F</gender>
    </subscriber>
    <billingProvider>
      <npi>1234567890</npi>
      <name>VALLEY HEALTH CENTER</name>
      <taxId>111222333</taxId>
      <address>300 Valley Rd</address>
      <city>San Diego</city>
      <state>CA</state>
      <zip>921019998</zip>
    </billingProvider>
    <renderingProvider>
      <npi>9876543210</npi>
      <lastName>PARK</lastName>
      <firstName>JAMES</firstName>
    </renderingProvider>
    <diagnoses>
      <diagnosis sequence="1" code="I10"/>
      <diagnosis sequence="2" code="E119"/>
    </diagnoses>
    <serviceLines>
      <line procedureCode="99215" chargeAmount="550.00" unitCount="1" diagnosisPointers="1:2"/>
    </serviceLines>
    <paidAmount>275.00</paidAmount>
    <adjudicationDate>20250305</adjudicationDate>
  </claim>
</claims>
```

---

## 5. Expected 837P Output

For the JSON sample above (CLM-ORG-002), the generated 837P would be:

```
ISA*00*          *00*          *ZZ*ENH1234        *ZZ*80882          *250329*1200*^*00501*000000001*1*P*:~
GS*HC*ENH1234*80882*20250329*1200*000000001*X*005010X222A1~
ST*837*000000001*005010X222A1~
BHT*0019*00*BATCH20250329*20250329*1200*CH~
NM1*41*2*INVENT HEALTH*****46*ENH1234~
PER*IC*HELPDESK*TE*8005551234*EM*ED@INVENTHEALTH.COM~
NM1*40*2*EDSCMS*****46*80882~
HL*1**20*1~
PRV*BI*PXC*207Q00000X~
NM1*85*2*PREMIER HEALTHCARE*****XX*1234567890~
N3*500 Medical Center Dr~
N4*Chicago*IL*606029998~
REF*EI*987654321~
HL*2*1*22*0~
SBR*S*18*****MB~
NM1*IL*1*JOHNSON*MARY****MI*1EG4TE5MK72~
N3*200 Oak Ave~
N4*Chicago*IL*606019998~
DMG*D8*19750722*F~
NM1*PR*2*EDSCMS*****PI*80882~
N3*7500 Security Blvd~
N4*Baltimore*MD*212441850~
REF*2U*H1234~
CLM*CLM-ORG-002*350***11:B:1*Y*A*Y*I~
DTP*472*D8*20250201~
HI*ABK:J441*ABF:E785~
NM1*82*1*CHEN*LISA****XX*9876543210~
PRV*PE*PXC*207Q00000X~
SBR*P*18*****16~
AMT*D*175~
OI***Y~
NM1*IL*1*JOHNSON*MARY****MI*1EG4TE5MK72~
NM1*PR*2*H1234*****XV*H1234~
N3*500 Medical Center Dr~
N4*Chicago*IL*606029998~
LX*1~
SV1*HC:99214*220*UN*1***1:2~
DTP*472*D8*20250201~
SVD*H1234*110*HC:99214**1~
DTP*573*D8*20250205~
LX*2~
SV1*HC:93000*130*UN*1***1~
DTP*472*D8*20250201~
SVD*H1234*65*HC:93000**1~
DTP*573*D8*20250205~
SE*42*000000001~
GE*1*000000001~
IEA*1*000000001~
```

---

## 6. What is Validated vs What is Not

### 6.1 Fully Automated — No Human Review Needed

| Category | Count | Examples |
|----------|:-----:|---------|
| Qualifier value checks | 72 | ISA05=ZZ, ISA08=80882, BHT06=CH, SBR01=S, SBR09=MB |
| Format checks | 12 | Date CCYYMMDD, Time HHMM, NPI 10-digit, EIN 9-digit, ZIP 9-digit |
| No-future-date checks | 7 | ISA09, GS04, BHT04, DMG02, DTP03 claim, DTP03 line, DTP03*573 |
| Cross-field matches | 8 | ISA13=IEA02, GS06=GE02, ST02=SE02, CLM02=sum(SV102), etc. |
| Required field presence | 15 | CLM01, NM109(IL), NM103(IL), DMG02, DMG03, HI*ABK, SV101-2 |
| Code set validation | 4 | ICD-10-CM format, POS code, gender M/F/U, unit type |
| CMS-specific business rules | 8 | EDSCMS payer, 80882 receiver, contract ID in REF*2U, SBR09=16 |
| Structural integrity | 6 | ISA 106 chars, segment count, control number uniqueness |

**Total automated checks: 132 per claim**

### 6.2 Requires Human Review

| Item | Why | Mitigation |
|------|-----|-----------|
| Member ID exists in CMS database | System cannot verify against CMS beneficiary DB | MBI format validation reduces errors; actual verification happens at EDPS (edit 02110) |
| NPI is active in NPPES | System cannot query NPPES in real-time | NPI format + Luhn validated; NPPES lookup is recommended enhancement |
| Diagnosis code is risk-adjustment eligible | Requires CMS filtering logic | ICD-10-CM format validated; RA filtering happens at RAS |
| Provider taxonomy is valid for service | Requires NPI/taxonomy cross-reference | Format validated; CMS edits at EDPPPS catch mismatches |

---

## 7. Design Decisions (Finalized)

| # | Decision | Answer |
|---|----------|--------|
| 1 | **Control numbers** | DateTime-based: `String(Date.now()).slice(-9)` for ISA13/GS06. `ContractID-timestamp` for BHT03. Globally unique, stateless, no vendor prefix needed. |
| 2 | **File packaging** | 5,000 CLMs per ST/SE (CMS max). Multiple ST/SE per file. 85,000 encounters/file (FTP). All limits configurable. |
| 3 | **Paid amount splitting** | Proportional by line charge ratio (`line_charge / total_charge × paid_amount`) if no line-level amounts provided. |
| 4 | **Contract ID source** | System configuration per MA plan. Overridable per claim in input. Multi-contract ready. |
| 5 | **Rendering provider** | Copy billing NPI as rendering if not provided in input. |
| 6 | **Error threshold** | Generate 837 for valid claims. Report failures separately in error queue. Don't halt batch. |
| 7 | **Service date timezone** | Service dates (DTP*472) accepted as-is from input. Only ISA09/10, GS04/05, BHT04/05 validated against ET. |
| 8 | **Connectivity** | FTP (free-form, 85K/file). |
| 9 | **Volume tier** | Medium (5-50K claims/day). |
