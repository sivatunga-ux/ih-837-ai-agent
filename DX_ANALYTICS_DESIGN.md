# Diagnosis Analytics & Insights Engine — Design Specification

## Vision
Transform encounter data from a compliance exercise into clinical intelligence. Tell a **story** with diagnosis data: what's being reported, what's missing, who's reporting well, and what needs action — with a prioritized workflow for anomaly resolution.

---

## 1. Analytics Layers — The Story Structure

```
Layer 1: DESCRIPTIVE       "What happened?"
         ├─ Dx volume, distribution, averages
         └─ Top codes, qualifier breakdown

Layer 2: DIAGNOSTIC         "Why did it happen?"
         ├─ Provider reporting patterns
         └─ Code completeness by category

Layer 3: PREDICTIVE         "What's likely missing?"
         ├─ Comorbidity gap detection
         └─ HCC linkage analysis

Layer 4: PRESCRIPTIVE       "What should we do?"
         ├─ Prioritized anomaly worklist
         └─ Action tracker with resolution
```

---

## 2. Insight Modules — What We Analyze

### Module 1: Dx Volume & Distribution

| Insight | Metric | Visualization |
|---------|--------|---------------|
| Total Dx codes reported | Count across all claims | KPI card |
| Unique Dx codes | Distinct ICD-10 codes | KPI card |
| Average Dx per claim | Total ÷ claim count | KPI card with trend arrow |
| Dx per claim distribution | Histogram: claims with 1 Dx, 2 Dx, 3 Dx… | Bar chart |
| Claims with single Dx | Count + % — risk of under-coding | KPI card (flagged if >30%) |
| Dx qualifier breakdown | ABK (principal) vs ABF (other) counts | Pie/donut chart |
| Top 20 principal Dx (ABK) | By frequency | Horizontal bar chart |
| Top 20 other Dx (ABF) | By frequency | Horizontal bar chart |
| Dx code category grouping | Group by ICD-10 chapter (E=Endocrine, I=Circulatory, J=Respiratory…) | Treemap or stacked bar |

### Module 2: Provider Reporting Quality

| Insight | Metric | Visualization |
|---------|--------|---------------|
| Avg Dx per claim by billing provider | Compare across orgs | Bar chart (sorted) |
| Avg Dx per claim by rendering provider | Compare across physicians | Bar chart (sorted) |
| Providers with avg <2 Dx/claim | Under-reporters | Alert table (red) |
| Providers with avg >6 Dx/claim | Possible over-coders | Alert table (amber) |
| Single-Dx claim rate by provider | % of their claims with only 1 diagnosis | Ranked table |
| Dx completeness score per provider | 0-100 based on comorbidity rules | Scorecard |
| Provider Dx variety | Unique Dx codes per provider | Scatter plot concept |
| Month-over-month provider trends | Is reporting improving or declining? | Sparklines per provider |

### Module 3: Comorbidity Gap Detection (Anomaly Engine)

**This is the high-value clinical intelligence layer.** Detect claims where expected comorbidity codes are missing based on clinical rules.

#### Rule Set 1: Obesity & BMI

| Trigger | Expected Companion | Rule ID | Severity |
|---------|-------------------|---------|----------|
| E66.01 (Morbid obesity) | Z68.3x-Z68.4x (BMI 30+) | CMB-001 | High |
| E66.0x (Obesity) | Z68.2x-Z68.4x (BMI range) | CMB-002 | Medium |
| Z68.4x (BMI 40+) | E66.01 (Morbid obesity) | CMB-003 | High |

#### Rule Set 2: Diabetes Complications

| Trigger | Expected Companion | Rule ID | Severity |
|---------|-------------------|---------|----------|
| E11.x (Type 2 DM) + L89.x (Pressure ulcer) | E11.62x (DM with skin complication) | CMB-010 | High |
| E11.x (Type 2 DM) + N18.x (CKD) | E11.22 (DM with CKD) | CMB-011 | High |
| E11.x (Type 2 DM) + H35.x (Retinopathy) | E11.3x (DM with ophthalmic) | CMB-012 | Medium |
| E11.x (Type 2 DM) + G62.x (Polyneuropathy) | E11.4x (DM with neurological) | CMB-013 | Medium |
| E11.9 (Type 2 DM unspecified) present with specific complications | Replace E11.9 with specific DM code | CMB-014 | High |

#### Rule Set 3: Cardiovascular

| Trigger | Expected Companion | Rule ID | Severity |
|---------|-------------------|---------|----------|
| I50.x (Heart failure) | I50.2x/3x/4x (Specify systolic/diastolic) | CMB-020 | Medium |
| I25.10 (Ischemic heart) + I48.x (AFib) | Document both on same encounter | CMB-021 | Low |
| I10 (Essential HTN) with I50.x (Heart failure) | I11.0 (Hypertensive heart disease with HF) | CMB-022 | High |

#### Rule Set 4: Respiratory

| Trigger | Expected Companion | Rule ID | Severity |
|---------|-------------------|---------|----------|
| J44.x (COPD) + J96.x (Respiratory failure) | Specify J44.0/J44.1 (with exacerbation) | CMB-030 | Medium |
| J96.x (Respiratory failure) | Z99.1x (Dependence on respirator) if applicable | CMB-031 | Low |

#### Rule Set 5: Renal

| Trigger | Expected Companion | Rule ID | Severity |
|---------|-------------------|---------|----------|
| N18.6 (ESRD) | Z99.2 (Dependence on dialysis) | CMB-040 | High |
| N18.x (CKD Stage) + Z94.0 (Kidney transplant) | N18.x stage + Z94.0 both present | CMB-041 | Medium |

#### Rule Set 6: Status Codes

| Trigger | Expected Companion | Rule ID | Severity |
|---------|-------------------|---------|----------|
| CPT 27880/27882 (Amputation) on service line | Z89.x (Acquired absence of limb) | CMB-050 | High |
| CPT 50360/50365 (Transplant) on service line | Z94.x (Transplant status) | CMB-051 | High |

### Module 4: Trending & Change Detection

| Insight | Metric | Visualization |
|---------|--------|---------------|
| Monthly Dx per claim trend | Average over 12 months | Line chart |
| Monthly top principal Dx shift | How top 10 ABK codes change month to month | Heatmap table |
| New Dx codes appearing | Codes not seen in prior months | Alert list |
| Disappearing Dx codes | Codes present before but absent now | Alert list |
| Comorbidity gap trend | Are gaps increasing or decreasing? | Trend line |
| Provider improvement tracking | Providers who addressed prior anomalies | Progress indicators |

---

## 3. Action Workflow — Anomaly → Resolution

### 3.1 Anomaly Lifecycle

```
DETECTED  →  PRIORITIZED  →  ASSIGNED  →  IN_REVIEW  →  RESOLVED  →  VERIFIED
                                              ↓
                                          DEFERRED (with reason)
```

### 3.2 Anomaly Record Structure

```
{
  id: "ANO-2025-03-00001",
  ruleId: "CMB-001",                        // Which comorbidity rule triggered
  severity: "HIGH",                         // HIGH, MEDIUM, LOW
  category: "COMORBIDITY_GAP",              // GAP, UNDER_CODING, OVER_CODING, PATTERN
  
  // What was found
  claimId: "CLM-000123",
  memberId: "1EG4TE5MK72",
  memberName: "JOHN SMITH",
  billingProvider: "ACME MEDICAL GROUP",
  renderingProvider: "Dr. Jane Williams",
  serviceDate: "2025-01-15",
  
  // The anomaly
  triggerDx: ["E66.01"],                    // Codes that triggered the rule
  expectedDx: ["Z68.3x-Z68.4x"],           // What's missing
  description: "Morbid obesity (E66.01) reported without BMI range code (Z68.3x-Z68.4x)",
  
  // Impact
  potentialHCC: "HCC 22",                   // Affected HCC category
  estimatedRAFImpact: 0.25,                 // RAF score delta
  estimatedRevenueImpact: 2800,             // Dollar estimate
  
  // Workflow
  status: "DETECTED",
  priority: 1,                              // 1=immediate, 2=this week, 3=this month
  assignedTo: null,
  assignedAt: null,
  resolvedAt: null,
  resolution: null,                         // "CORRECTED", "DEFERRED", "FALSE_POSITIVE"
  resolutionNotes: null,
  
  // Audit
  detectedAt: "2025-03-29T12:00:00Z",
  detectedBy: "Dx Analytics Agent",
  monthDetected: "2025-03"
}
```

### 3.3 Priority Scoring

```
Priority Score = (Severity Weight × 3) + (RAF Impact × 2) + (Recency × 1)

Severity Weight: HIGH=3, MEDIUM=2, LOW=1
RAF Impact: >0.3=3, 0.1-0.3=2, <0.1=1
Recency: Current month=3, Last month=2, Older=1

Score 20-27 → Priority 1 (Immediate)
Score 12-19 → Priority 2 (This week)
Score 6-11  → Priority 3 (This month)
```

---

## 4. Agent Design — Dx Analytics Agent

### 4.1 Agent Interface

```js
class DxAnalyticsAgent {
  constructor(claims, config) { ... }
  
  // Layer 1: Descriptive
  getVolumeMetrics()           // KPIs, averages, distributions
  getTopCodes(qualifier, n)    // Top N by ABK or ABF
  getCategoryBreakdown()       // Group by ICD-10 chapter
  
  // Layer 2: Diagnostic
  getProviderReportingQuality()  // Avg Dx, completeness score per provider
  getUnderReporters(threshold)   // Providers below threshold
  
  // Layer 3: Predictive
  runComorbidityRules()        // All CMB-xxx rules → anomaly list
  runRule(ruleId, claim)       // Single rule against single claim
  
  // Layer 4: Prescriptive
  getPrioritizedAnomalies()    // Sorted by priority score
  getActionSummary()           // Counts by status, severity, category
  
  // Trending
  getMonthlyTrend()            // Dx metrics by month
  getMonthOverMonthDelta()     // Change detection
  
  // Extensible
  addRule(rule)                // Add new comorbidity rule at runtime
  addInsightModule(module)     // Plug in new analytics module
}
```

### 4.2 Comorbidity Rule Definition (Configurable)

```js
const COMORBIDITY_RULES = [
  {
    id: "CMB-001",
    name: "Morbid Obesity Missing BMI",
    severity: "HIGH",
    category: "COMORBIDITY_GAP",
    trigger: { dxPattern: /^E6601/ },                    // Regex for trigger Dx
    expected: { dxPattern: /^Z68\.[34]/ },               // Expected companion
    description: "Morbid obesity (E66.01) without BMI range code (Z68.3x-Z68.4x)",
    potentialHCC: "HCC 22",
    estimatedRAF: 0.25,
    active: true
  },
  // ... more rules
];
```

Adding a new rule = adding one object to this array. **No code changes needed.**

---

## 5. UI Design — Insights Dashboard

### 5.1 Layout

```
┌────────────────────────────────────────────────────────────────┐
│ HEADER: Dx Analytics • {Month} • {Claim Count}                 │
├──────────┬─────────────────────────────────────────────────────┤
│ LEFT NAV │  MAIN CONTENT AREA                                  │
│          │                                                     │
│ Overview │  [Dynamic content per selected nav item]            │
│ Top Codes│                                                     │
│ Providers│                                                     │
│ Gaps &   │                                                     │
│  Anomaly │                                                     │
│ Trending │                                                     │
│ Actions  │                                                     │
│ Settings │                                                     │
│          │                                                     │
├──────────┴─────────────────────────────────────────────────────┤
│ FOOTER: Action Summary Bar — {X} open anomalies, {Y} resolved │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 Pages

#### Page 1: Overview — "The Story at a Glance"

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Total Dx │ │ Unique   │ │ Avg Dx/  │ │ Single-Dx│
│  2,847   │ │ Codes:89 │ │ Claim:5.7│ │ Claims:12│
│  ↑ +4.2% │ │  ↑ +3    │ │  ↑ +0.3  │ │  ↓ -8%   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

┌─ Dx Qualifier Breakdown ──┐  ┌─ Dx per Claim Distribution ──┐
│ ● ABK (Principal)  500    │  │ ████████████       1 Dx:  12  │
│ ● ABF (Other)    2,347    │  │ ████████████████   2 Dx:  87  │
│                           │  │ ███████████████████ 3 Dx: 156  │
│       [donut chart]       │  │ ██████████████████  4 Dx: 145  │
│                           │  │ ██████████████      5+ Dx: 100 │
└───────────────────────────┘  └──────────────────────────────┘

┌─ Anomaly Alert Banner ──────────────────────────────────────┐
│ ⚠ 47 anomalies detected this month (18 HIGH, 22 MED, 7 LOW)│
│ [View All →]                                                │
└─────────────────────────────────────────────────────────────┘
```

#### Page 2: Top Codes — "What's Being Reported"

```
┌─ Top 20 Principal Diagnosis (ABK) ────────────────────┐
│ E11.9  Type 2 DM, unspecified    ██████████████  87   │
│ I10    Essential hypertension     ████████████    72   │
│ J44.1  COPD w/ acute exacerb.    ██████████      58   │
│ E78.5  Hyperlipidemia            █████████       51   │
│ ...                                                    │
└────────────────────────────────────────────────────────┘

┌─ ICD-10 Chapter Distribution ─────────────────────────┐
│ E (Endocrine)    ████████████████████   412  (28.8%)  │
│ I (Circulatory)  ██████████████████     356  (24.9%)  │
│ J (Respiratory)  ███████████            198  (13.8%)  │
│ M (Musculoskele) ████████              147  (10.3%)  │
│ ...                                                    │
└────────────────────────────────────────────────────────┘
```

#### Page 3: Provider Quality — "Who's Reporting Well"

```
┌─ Provider Dx Completeness Scorecard ──────────────────────────────┐
│ PROVIDER                  │ CLAIMS │ AVG DX │ SCORE │ TREND      │
│ ACME MEDICAL GROUP        │    88  │   5.2  │  82   │ ↑ +3       │
│ PREMIER HEALTHCARE        │    54  │   6.1  │  91   │ ↑ +5       │
│ COASTAL CARE PHYSICIANS   │    75  │   3.1  │  58   │ ↓ -2  ⚠   │
│ VALLEY MEDICAL            │    58  │   2.4  │  42   │ ↓ -7  🔴  │
└───────────────────────────────────────────────────────────────────┘

[Drill-down: click provider → their claims, Dx patterns, anomalies]
```

#### Page 4: Gaps & Anomalies — "What's Missing"

```
┌─ Comorbidity Gap Summary ─────────────────────────────────────────┐
│ RULE                              │ GAPS │ IMPACT  │ STATUS      │
│ CMB-001 Obesity missing BMI       │   12 │ $33,600 │ 8 open      │
│ CMB-010 DM + Pressure ulcer gap   │    7 │ $19,600 │ 5 open      │
│ CMB-022 HTN + HF not coded as I11 │   15 │ $42,000 │ 12 open     │
│ CMB-040 ESRD missing Z99.2        │    3 │ $8,400  │ 2 open      │
│ CMB-050 Amputation missing Z89    │    2 │ $5,600  │ 1 resolved  │
└───────────────────────────────────────────────────────────────────┘

[Click rule → see affected claims → assign for review]
```

#### Page 5: Trending — "How Are We Changing"

```
Month    Avg Dx   Single-Dx%   Gaps   Gap Resolution Rate
2024-04   4.8       8.2%        52      —
2024-05   4.9       7.9%        48     78%
2024-06   5.1       7.1%        41     82%
...
2025-03   5.7       4.8%        18     91%  ← improving!

[Line chart: avg Dx per claim over 12 months]
[Line chart: anomaly count trending down]
[Line chart: resolution rate trending up]
```

#### Page 6: Action Tracker — "What Do We Do About It"

```
┌─ Action Worklist ─────────────────────────────────────────────────┐
│ 🔴 P1: 18 items │ 🟡 P2: 22 items │ 🟢 P3: 7 items              │
│                                                                    │
│ ☐ ANO-001 | CMB-001 | SMITH, JOHN | E66.01 → needs Z68.3x       │
│   Provider: VALLEY MEDICAL | DOS: 2025-02-15 | RAF: +0.25        │
│   [Assign] [Defer] [Resolve]                                      │
│                                                                    │
│ ☐ ANO-002 | CMB-022 | JOHNSON, MARY | I10+I50 → needs I11.0     │
│   Provider: COASTAL CARE | DOS: 2025-03-01 | RAF: +0.31          │
│   [Assign] [Defer] [Resolve]                                      │
│                                                                    │
│ ✅ ANO-015 | CMB-040 | GARCIA, MARIA | N18.6 → Z99.2 added      │
│   Resolved by: J. Williams | 2025-03-20 | CRR submitted          │
└───────────────────────────────────────────────────────────────────┘

Filters: [All] [Open] [Resolved] [Deferred] [By Provider ▼] [By Rule ▼]
```

#### Page 7: Settings — "Configure the Engine"

```
- Toggle comorbidity rules on/off
- Adjust severity thresholds
- Add custom rules (trigger Dx → expected Dx)
- Set provider alerting thresholds (avg Dx below X)
- Configure RAF impact estimates
- Export anomaly report (CSV/PDF)
```

### 5.3 Design Principle: Insights Change Monthly

The UI is **data-driven, not layout-driven**. Every chart and table is rendered from the agent's output. When next month's data is loaded:

1. KPIs auto-update with trend arrows (vs prior month)
2. Top codes re-rank
3. New anomalies appear in the worklist
4. Resolved anomalies move to history
5. Trending charts extend by one month
6. Provider scores recalculate

**No UI code change needed when insights change** — just load new data and invoke the same agents.

---

## 6. Extensibility — Future Modules

### 6.1 CPT–Dx Association (Next Phase)

```js
// Future agent module
class CptDxAssociationAgent {
  analyzeCptDxPairs()          // Which CPTs are commonly paired with which Dx
  detectMismatchedPairs()      // CPT doesn't match reported Dx
  detectUnbundling()           // CPTs that should be billed together
  getEMCodeDistribution()      // 99213 vs 99214 vs 99215 spread
  detectUpcoding()             // Unusual E/M level patterns
  getCptComplexityScore()      // Average RVU per provider
}
```

### 6.2 HCC Opportunity Analysis (Future)

```js
class HCCOpportunityAgent {
  mapDxToHCC()                 // Which reported Dx map to HCCs
  findMissedHCCs()             // HCCs with partial coding
  estimateRAFImpact()          // Dollar value of coding gaps
  getHCCCompletionRate()       // % of known conditions fully coded
}
```

### 6.3 Provider Performance Trending (Future)

```js
class ProviderTrendAgent {
  getProviderTrajectory()      // Improving or declining over quarters
  benchmarkAgainstPeers()      // Compare vs same specialty
  identifyTrainingNeeds()      // Specific areas where provider gaps exist
}
```

---

## 7. Implementation Plan

### Phase 1: Core Analytics (Build Now)

| Component | Description | Effort |
|-----------|-------------|--------|
| `DxAnalyticsAgent` class | Volumes, distributions, top codes, categories | Core module |
| `ComorbidityRuleEngine` | 15 configurable rules, gap detection | Core module |
| `ProviderQualityScorer` | Avg Dx, completeness score, under-reporter flags | Core module |
| Overview + Top Codes pages | KPIs, charts, tables | UI |
| Provider Quality page | Scorecard, drill-down | UI |
| Gaps & Anomalies page | Rule summary, affected claims | UI |

### Phase 2: Workflow & Trending

| Component | Description | Effort |
|-----------|-------------|--------|
| `AnomalyTracker` class | Lifecycle management (detect → assign → resolve) | Core module |
| Action Tracker page | Worklist, assign/defer/resolve actions | UI |
| Trending page | Monthly trend charts, delta detection | UI |
| Priority scoring engine | Auto-prioritize by severity + RAF + recency | Core module |
| Export functionality | CSV/PDF anomaly reports | UI |

### Phase 3: Advanced Analytics

| Component | Description | Effort |
|-----------|-------------|--------|
| CPT–Dx Association Agent | Pair analysis, mismatch detection | New agent |
| HCC Opportunity Agent | RAF impact estimation, missed HCCs | New agent |
| Provider Benchmarking | Peer comparison, trajectory tracking | New agent |
| Settings page | Rule configuration, threshold tuning | UI |

---

## 8. Review Questions

1. **Rule priority** — Should comorbidity rules be pre-loaded (deploy-once) or configurable via a settings UI? I recommend pre-loaded with UI toggle on/off.

2. **Action workflow** — Should anomaly assignments integrate with an external system (Jira, ServiceNow) or stay internal? I recommend internal first with export capability.

3. **Provider scoring** — Should the completeness score be visible to providers or internal-only? This affects how aggressive the scoring algorithm should be.

4. **RAF estimates** — The revenue impact numbers are estimates based on published HCC coefficients. Should we include them in the UI or keep them internal?

5. **Historical depth** — How many months of data should the trending analysis cover? I recommend 12 months rolling.

6. **CPT analytics scope** — Should CPT–Dx association analysis run on every pipeline execution or be a separate on-demand analysis?
