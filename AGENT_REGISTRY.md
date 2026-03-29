# Agent Registry — Complete Inventory

## Status: All code committed. Working tree clean. No pending tasks.

---

## 1. Deployed Agents (Running Code)

### 1.1 Encounter Analytics Pipeline (encounter-analytics/pipeline.js)

**Production-ready 6-agent pipeline.** Processes claims through ingest → validate → generate 837P EDI.

| Agent | Function | File | Invoke |
|-------|----------|------|--------|
| **A1-Ingest** | `ingestClaims(claims)` | `encounter-analytics/pipeline.js` | Takes raw claim array, normalizes dates/amounts/codes |
| **A2-Map** | `mapFields(claim)` | `encounter-analytics/pipeline.js` | Maps to 837 segment positions, auto-populates 72 qualifiers |
| **A3-Validate** | `validateClaim(mappedClaim)` | `encounter-analytics/pipeline.js` | Runs 35 claim-level CMS checks (V-C01 through V-C35) |
| **A4-Template** | `applyTemplate(claim, config)` | `encounter-analytics/pipeline.js` | Applies CMS envelope (ISA/GS/ST/BHT), generates control numbers in ET |
| **A5-Generate** | `generate837(templatedClaims)` | `encounter-analytics/pipeline.js` | Builds complete 837P EDI string in CMS segment order |
| **A6-ValidateOutput** | `validateOutput(ediString)` | `encounter-analytics/pipeline.js` | Self-check: parses generated 837, runs 18 file-level checks |

**Orchestrator:**
```js
import { runPipeline } from "./encounter-analytics/pipeline.js";

const result = runPipeline(claimsArray, {
  contractId: "H1234",
  environment: "P",
  submitterName: "INVENT HEALTH",
  submitterPhone: "8005551234",
  submitterEmail: "ED@INVENTHEALTH.COM"
});
// result.files → array of {fileName, ediContent, claimCount, segmentCount}
// result.claims → array of {id, pcn, status, validationResult}
// result.summary → {total, passed, failed, totalCharge, totalPaid}
// result.pipelineSteps → [{agent, duration, claimsProcessed}]
```

**Run all 6 agents in sequence (pipeline order is mandatory — each depends on previous):**
```js
// Sequential — each agent feeds the next
const ingested = ingestClaims(rawClaims);           // A1
const mapped = ingested.map(c => mapFields(c));      // A2
const validated = mapped.map(c => validateClaim(c));  // A3
const templated = validated.filter(c => c.status === "PASS")
                           .map(c => applyTemplate(c, config)); // A4
const edi = generate837(templated);                  // A5
const verified = validateOutput(edi);                // A6
```

---

### 1.2 Analytics Engine (encounter-analytics/analyticsEngine.js)

**10 analytics functions.** All take `pipelineResult` from `runPipeline()`.

| Function | Returns | Call |
|----------|---------|------|
| `getFileSummary(result)` | File-level: name, claims, segments, charge, date | Post-pipeline |
| `getBillingProviderSummary(result)` | By billing NPI: claims, charge, paid, members, rendering | Post-pipeline |
| `getRenderingProviderSummary(result)` | By rendering NPI: claims, charge, billing orgs, members | Post-pipeline |
| `getMemberSummary(result)` | By member ID: claims, charge, paid, providers, date range | Post-pipeline |
| `getMonthlyTrend(result)` | By YYYY-MM: claims, charge, paid, members, providers | Post-pipeline |
| `getDiagnosisSummary(result)` | Top Dx codes by frequency | Post-pipeline |
| `getProcedureSummary(result)` | Top CPT codes by frequency and charge | Post-pipeline |
| `getFacilityCodeSummary(result)` | By POS code | Post-pipeline |
| `getValidationSummary(result)` | Pass rate, check-by-check detail | Post-pipeline |
| `search(result, filters)` | Cross-file search by NPI/member/date/query | On-demand |

**Run analytics in parallel (all independent of each other):**
```js
import * as analytics from "./encounter-analytics/analyticsEngine.js";

// These can ALL run in parallel — no dependencies between them
const [files, billing, rendering, members, trends, dx, cpt, pos, validation] =
  await Promise.all([
    Promise.resolve(analytics.getFileSummary(result)),
    Promise.resolve(analytics.getBillingProviderSummary(result)),
    Promise.resolve(analytics.getRenderingProviderSummary(result)),
    Promise.resolve(analytics.getMemberSummary(result)),
    Promise.resolve(analytics.getMonthlyTrend(result)),
    Promise.resolve(analytics.getDiagnosisSummary(result)),
    Promise.resolve(analytics.getProcedureSummary(result)),
    Promise.resolve(analytics.getFacilityCodeSummary(result)),
    Promise.resolve(analytics.getValidationSummary(result))
  ]);

// Search is on-demand
const searchResults = analytics.search(result, { query: "SMITH", billingNPI: "1234567890" });
```

---

### 1.3 Qualifier Registry (data/qualifierRegistry.js)

**115 configurable qualifier entries with format validation.**

| Function | Purpose | Parallelizable |
|----------|---------|:-:|
| `validateQualifier(loop, seg, elem, value, claimType, tz)` | Check value against allowed set + format | Yes — per field |
| `validateFormat(value, formatSpec, timezone)` | Date/time/NPI/EIN format checks | Yes — per field |
| `validateDateNotFuture(dateStr, fmt, tz)` | Reject future dates in ET | Yes — per date |
| `validateDateReal(dateStr)` | Calendar reality (no Feb 30) | Yes — per date |
| `validateTime(timeStr)` | HHMM 00-23/00-59 | Yes — per time |
| `generateSubmissionTimestamps(tz)` | Current ET date/time for ISA/GS/BHT | Once per batch |
| `getAutoPopulatedValues(config, claimType, tz)` | 76 auto-filled field values | Once per batch |
| `getFileLevelFields()` | 61 file-level entries | Once |
| `getDataDependentFields()` | 54 data-dependent entries | Once |
| `getRegistryStats()` | Summary counts | Once |

---

### 1.4 Claims Search Engine (claims-search/searchEngine.js)

| Function | Purpose |
|----------|---------|
| `new ClaimsSearchEngine({fields, pageSize})` | Create engine instance |
| `engine.loadData(claims)` | Build inverted index (250 claims in <5ms) |
| `engine.search({query, filters, sort, page, pageSize, facetKeys})` | Full-text + structured search with facets |
| `engine.getById(id)` | Get single claim |
| `engine.getStats()` | Index statistics |

---

### 1.5 Validation Test Suite (data/testcases837.js)

| Function | Purpose |
|----------|---------|
| `runAllTests()` | Run all 25 tests (16 Prof + 5 Inst + 4 Delimiter) |
| `runTestsByType("837P")` | Run 16 professional tests only |
| `runTestsByType("837I")` | Run 5 institutional tests only |
| `runTestsByType("Delimiter")` | Run 4 delimiter detection tests only |

---

### 1.6 Main App Agents (services/)

| Agent | File | Function | Status |
|-------|------|----------|--------|
| Claim Ingest | `services/claimIngest.js` | `ingestFile(text, fileName, claimType)` | Built |
| Claim Mapper | `services/claimMapper.js` | `getFieldMap(claimType)`, `validateClaimForConversion(claim)` | Built |
| 837 Generator | `services/edi837Generator.js` | `generate837(fullClaim, config)` | Built |
| Conversion Agent | `services/conversionAgent.js` | `new ConversionAgent(db).runPipeline(text, name, type, config)` | Built |
| Claims DB | `data/claimsdb.js` | `new ClaimsDB()` — CRUD with localStorage | Built |
| Delimiter Detection | `data/delimiters.js` | `detectDelimiters(rawX12)` | Built |

---

## 2. Parallel Execution Guide

### 2.1 What CAN Run in Parallel

```
┌─────────────────────────────────────────────────────────┐
│                    PARALLEL-SAFE                         │
├─────────────────────────────────────────────────────────┤
│ Per-field qualifier validation  (validateQualifier)     │
│ Per-field format validation     (validateFormat)        │
│ Per-date future-date check      (validateDateNotFuture) │
│ All 10 analytics functions      (independent of each)   │
│ Claims search                   (read-only)             │
│ Test suite execution            (stateless)             │
│ Multiple file generation        (different claim sets)  │
│ Delimiter detection             (stateless)             │
└─────────────────────────────────────────────────────────┘
```

### 2.2 What MUST Run Sequentially

```
┌──────────────────────────────────────────────────────────┐
│              SEQUENTIAL (Pipeline Order)                  │
│                                                          │
│  A1-Ingest ──▶ A2-Map ──▶ A3-Validate ──▶ A4-Template   │
│                                              │           │
│                                         A5-Generate      │
│                                              │           │
│                                       A6-ValidateOutput  │
│                                                          │
│  Reason: Each agent depends on the output of the         │
│  previous one. A claim must be ingested before mapping,  │
│  mapped before validation, validated before templating,  │
│  templated before generation.                            │
└──────────────────────────────────────────────────────────┘
```

### 2.3 Parallel Within Sequential Steps

Within each sequential step, **individual claims can be processed in parallel**:

```js
// A3-Validate: validate all 500 claims in parallel
const validationResults = await Promise.all(
  mappedClaims.map(claim => Promise.resolve(validateClaim(claim)))
);

// A5-Generate: generate multiple files in parallel (different claim batches)
const files = await Promise.all(
  claimBatches.map(batch => Promise.resolve(generate837(batch)))
);

// Post-pipeline: all analytics in parallel
const [billing, rendering, members, trends] = await Promise.all([
  Promise.resolve(analytics.getBillingProviderSummary(result)),
  Promise.resolve(analytics.getRenderingProviderSummary(result)),
  Promise.resolve(analytics.getMemberSummary(result)),
  Promise.resolve(analytics.getMonthlyTrend(result))
]);
```

### 2.4 Production Parallel Architecture

```
                    ┌─── Worker 1: Claims 1-100 ───┐
                    │                                │
Input ──▶ A1 ──▶ ──┼─── Worker 2: Claims 101-200 ──┼──▶ A5 (per batch) ──▶ A6
  (500)   Ingest    │                                │    Generate            Verify
                    ├─── Worker 3: Claims 201-300 ──┤
                    │        A2+A3+A4 per claim      │
                    ├─── Worker 4: Claims 301-400 ──┤
                    │                                │
                    └─── Worker 5: Claims 401-500 ──┘

Post-pipeline (all parallel):
  ├── getBillingProviderSummary()
  ├── getRenderingProviderSummary()
  ├── getMemberSummary()
  ├── getMonthlyTrend()
  ├── getDiagnosisSummary()
  ├── getProcedureSummary()
  ├── getFacilityCodeSummary()
  └── getValidationSummary()
```

---

## 3. Applications & URLs

| Application | URL | Description |
|-------------|-----|-------------|
| **Encounter Analytics** | `/encounter-analytics/index.html` | 6-agent pipeline + 10-tab analytics dashboard |
| **Claims Search** | `/claims-search/index.html` | 26-field search with facets, 250 sample claims |
| **Main 837 Analyzer** | `/Index.html` | Original app: ingestion, validation, workqueue, 837 map, delimiter config, test runner, generator |

**Start server:** `python3 -m http.server 5501 --directory /workspace`

---

## 4. Documentation Inventory

| Document | Purpose |
|----------|---------|
| `ORIGINAL_ENCOUNTER_PIPELINE_SPEC.md` | Production spec: 6 agents, 48 input fields, 132 validations, sample files, expected 837P output |
| `CMS_ENCOUNTER_ARCHITECTURE.md` | 14 recommended agents, 12-table data model, CMS processing pipeline, ACK parsing |
| `CMS_EDIT_MANAGEMENT_ARCHITECTURE.md` | Edit management: SQL schema, Excel upload, MBI validation, MDE crosswalk, maintenance process |
| `claims-search/ARCHITECTURE.md` | Scalable search: PostgreSQL + Elasticsearch + Redis + Kafka for 10M+ records |
| `AGENTS.md` | Cursor Cloud development instructions |
| `PROJECT_RULES.md` | Architecture principles |

---

## 5. Module Dependency Map

```
encounter-analytics/          ← STANDALONE (no external deps)
  sampleClaims.js             ← Data generator
  pipeline.js                 ← 6-agent pipeline (imports sampleClaims)
  analyticsEngine.js          ← 10 analytics functions (imports nothing)
  app.js                      ← UI (imports all above)

claims-search/                ← STANDALONE (no external deps)
  searchConfig.js             ← Field definitions
  sampleData.js               ← 250 sample claims
  searchEngine.js             ← Inverted index search
  app.js                      ← UI (imports all above)

data/                         ← Shared data modules
  qualifierRegistry.js        ← 115 qualifiers + format validation (no deps)
  mapping837P.js              ← 837P segment map (no deps)
  mapping837I.js              ← 837I segment map (no deps)
  delimiters.js               ← Delimiter spec + detection (no deps)
  testcases837.js             ← 25 test cases (imports validation.js + delimiters.js)
  claimsdb.js                 ← Claims DB class (no deps)
  constants.js                ← App constants (no deps)
  models.js                   ← Data models (no deps)
  samples.js                  ← Original sample EDI strings (no deps)

services/                     ← Main app services
  claimIngest.js              ← Multi-format parser (no deps)
  claimMapper.js              ← DB→837 field map (no deps)
  edi837Generator.js          ← 837 builder (imports claimMapper)
  conversionAgent.js          ← Pipeline orchestrator (imports ingest, mapper, generator, validation)
  workflow.js                 ← Workqueue logic (imports models)
  integrations.js             ← Slack/Teams/ticket payloads (no deps)
  docs.js                     ← CCD simulation (no deps)

rules/
  validation.js               ← Core 837 parser + validator (no deps)
```
