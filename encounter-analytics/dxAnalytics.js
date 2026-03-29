// dxAnalytics.js — Dx Analytics Agent
// Comorbidity gap detection, member history, chronic condition monitoring,
// CPT-Dx association, and provider quality scoring.
// ES module. Depends only on sampleClaims.js from this directory.

import { SAMPLE_CLAIMS } from "./sampleClaims.js";

// ═══════════════════════════════════════════════════════════════════════════════
// DETERMINISTIC PRNG (mulberry32) — local copy for history generation
// ═══════════════════════════════════════════════════════════════════════════════

function createRng(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ICD-10 CHAPTER MAP
// ═══════════════════════════════════════════════════════════════════════════════

const ICD10_CHAPTERS = {
  A: "Infectious & Parasitic",
  B: "Infectious & Parasitic",
  C: "Neoplasms",
  D: "Blood / Neoplasms",
  E: "Endocrine / Metabolic",
  F: "Mental / Behavioral",
  G: "Nervous System",
  H: "Eye / Ear",
  I: "Circulatory",
  J: "Respiratory",
  K: "Digestive",
  L: "Skin",
  M: "Musculoskeletal",
  N: "Genitourinary",
  O: "Pregnancy",
  P: "Perinatal",
  Q: "Congenital",
  R: "Symptoms / Signs",
  S: "Injury / Poisoning",
  T: "Injury / Poisoning",
  V: "External Causes",
  W: "External Causes",
  X: "External Causes",
  Y: "External Causes",
  Z: "Factors Influencing Health",
};

// ═══════════════════════════════════════════════════════════════════════════════
// DX NAME LOOKUP — covers both sample data and registry codes
// ═══════════════════════════════════════════════════════════════════════════════

const DX_NAMES = {
  E119:   "Type 2 DM unspecified",
  E1165:  "Type 2 DM with hyperglycemia",
  E1122:  "Type 2 DM with CKD",
  E1162:  "Type 2 DM with skin complication",
  I10:    "Essential hypertension",
  I110:   "Hypertensive heart disease with HF",
  I2510:  "Ischemic heart disease",
  I4891:  "Atrial fibrillation unspecified",
  I5020:  "Unspecified systolic HF",
  I5022:  "Chronic systolic HF",
  I5030:  "Unspecified diastolic HF",
  I5032:  "Chronic diastolic HF",
  J441:   "COPD with acute exacerbation",
  J449:   "COPD unspecified",
  J459:   "Asthma unspecified",
  E785:   "Hyperlipidemia unspecified",
  E039:   "Hypothyroidism unspecified",
  E669:   "Obesity unspecified",
  E6601:  "Morbid obesity",
  N189:   "CKD unspecified",
  N184:   "CKD Stage 4",
  N185:   "CKD Stage 5",
  N186:   "End stage renal disease",
  F329:   "Major depressive disorder",
  G4733:  "Obstructive sleep apnea",
  M179:   "Osteoarthritis unspecified",
  K219:   "GERD unspecified",
  N400:   "BPH without obstruction",
  Z992:   "Dependence on dialysis",
  Z890:   "Acquired absence of limb",
  Z940:   "Kidney transplant status",
};

function getDxName(code) {
  if (DX_NAMES[code]) return DX_NAMES[code];
  const entry = CONDITION_SIGNIFICANCE_REGISTRY.find(e => e.code === code);
  return entry ? entry.name : code;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONDITION SIGNIFICANCE REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

export const CONDITION_SIGNIFICANCE_REGISTRY = [
  { code: "E119",  name: "Type 2 DM unspecified",            hcc: "HCC 37",  cdps: "DIA1", monitor: true,  rafWeight: 0.105 },
  { code: "E1165", name: "Type 2 DM with hyperglycemia",     hcc: "HCC 37",  cdps: "DIA1", monitor: true,  rafWeight: 0.105 },
  { code: "E1122", name: "Type 2 DM with CKD",               hcc: "HCC 18",  cdps: "DIA2", monitor: true,  rafWeight: 0.302 },
  { code: "E1162", name: "Type 2 DM with skin complication",  hcc: "HCC 18",  cdps: "DIA2", monitor: true,  rafWeight: 0.302 },
  { code: "I10",   name: "Essential hypertension",            hcc: null,       cdps: null,   monitor: false, rafWeight: 0 },
  { code: "I110",  name: "Hypertensive heart disease with HF",hcc: "HCC 85",  cdps: "CHF",  monitor: true,  rafWeight: 0.323 },
  { code: "I5020", name: "Unspecified systolic HF",           hcc: "HCC 85",  cdps: "CHF",  monitor: true,  rafWeight: 0.323 },
  { code: "I5022", name: "Chronic systolic HF",               hcc: "HCC 85",  cdps: "CHF",  monitor: true,  rafWeight: 0.323 },
  { code: "I5030", name: "Unspecified diastolic HF",          hcc: "HCC 85",  cdps: "CHF",  monitor: true,  rafWeight: 0.323 },
  { code: "I5032", name: "Chronic diastolic HF",              hcc: "HCC 85",  cdps: "CHF",  monitor: true,  rafWeight: 0.323 },
  { code: "I2510", name: "Ischemic heart disease",            hcc: "HCC 87",  cdps: "CAR1", monitor: true,  rafWeight: 0.140 },
  { code: "J441",  name: "COPD with acute exacerbation",      hcc: "HCC 111", cdps: "PUL5", monitor: true,  rafWeight: 0.335 },
  { code: "J449",  name: "COPD unspecified",                  hcc: "HCC 111", cdps: "PUL5", monitor: true,  rafWeight: 0.335 },
  { code: "N186",  name: "End stage renal disease",           hcc: "HCC 326", cdps: "REN2", monitor: true,  rafWeight: 0.290 },
  { code: "N184",  name: "CKD Stage 4",                       hcc: "HCC 329", cdps: "REN1", monitor: true,  rafWeight: 0.237 },
  { code: "N185",  name: "CKD Stage 5",                       hcc: "HCC 326", cdps: "REN2", monitor: true,  rafWeight: 0.290 },
  { code: "E6601", name: "Morbid obesity",                    hcc: "HCC 48",  cdps: null,   monitor: true,  rafWeight: 0.250 },
  { code: "Z992",  name: "Dependence on dialysis",            hcc: null,       cdps: null,   monitor: true,  rafWeight: 0 },
  { code: "Z890",  name: "Acquired absence of limb",          hcc: "HCC 189", cdps: null,   monitor: true,  rafWeight: 0.588 },
  { code: "Z940",  name: "Kidney transplant status",          hcc: "HCC 186", cdps: null,   monitor: true,  rafWeight: 0.830 },
  { code: "F329",  name: "Major depressive disorder",         hcc: "HCC 155", cdps: "PSY1", monitor: true,  rafWeight: 0.309 },
  { code: "G4733", name: "Obstructive sleep apnea",           hcc: null,       cdps: null,   monitor: false, rafWeight: 0 },
];

export function isMonitoredCondition(dxCode) {
  return CONDITION_SIGNIFICANCE_REGISTRY.some(
    entry => entry.monitor && (dxCode.startsWith(entry.code) || entry.code.startsWith(dxCode))
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMORBIDITY RULES (17 rules)
// ═══════════════════════════════════════════════════════════════════════════════

export const COMORBIDITY_RULES = [
  // ── Obesity / BMI ──
  {
    id: "CMB-001", name: "Morbid Obesity Missing BMI", severity: "HIGH",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes) => dxCodes.some(d => d.startsWith("E6601")),
    expected:  (dxCodes) => dxCodes.some(d => /^Z68[34]/.test(d)),
    description: "Morbid obesity (E66.01) reported without BMI range code (Z68.3x–Z68.4x)",
    hcc: "HCC 48", estimatedRAF: 0.250, active: true,
  },
  {
    id: "CMB-002", name: "BMI 40+ Without Morbid Obesity", severity: "HIGH",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes) => dxCodes.some(d => /^Z684/.test(d)),
    expected:  (dxCodes) => dxCodes.some(d => d.startsWith("E6601")),
    description: "BMI ≥ 40 (Z68.4x) reported without morbid obesity diagnosis (E66.01)",
    hcc: "HCC 48", estimatedRAF: 0.250, active: true,
  },
  {
    id: "CMB-003", name: "Obesity Without Sleep Apnea Screening", severity: "MEDIUM",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes) => dxCodes.some(d => d.startsWith("E66")),
    expected:  (dxCodes) => dxCodes.some(d => d.startsWith("G4733")),
    description: "Obesity (E66.x) reported without obstructive sleep apnea (G47.33) — consider screening",
    hcc: null, estimatedRAF: 0, active: true,
  },

  // ── Diabetes ──
  {
    id: "CMB-010", name: "Type 2 DM Lacking Specificity", severity: "HIGH",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes) => dxCodes.some(d => d === "E119"),
    expected:  (dxCodes) => dxCodes.some(d => /^E11[2-6]/.test(d)),
    description: "Type 2 DM unspecified (E11.9) without complication codes (E11.2x–E11.6x) — specificity gap",
    hcc: "HCC 18", estimatedRAF: 0.302, active: true,
  },
  {
    id: "CMB-011", name: "DM with CKD Missing CKD Stage", severity: "MEDIUM",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes) => dxCodes.some(d => d.startsWith("E1122")),
    expected:  (dxCodes) => dxCodes.some(d => /^N18[1-6]/.test(d)),
    description: "Type 2 DM with CKD (E11.22) reported without CKD stage (N18.1–N18.6)",
    hcc: "HCC 326", estimatedRAF: 0.290, active: true,
  },
  {
    id: "CMB-012", name: "DM Hyperglycemia Missing Complication Detail", severity: "LOW",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes) => dxCodes.some(d => d.startsWith("E1165")),
    expected:  (dxCodes) => dxCodes.some(d => /^E11[2-4]/.test(d)),
    description: "DM with hyperglycemia (E11.65) without additional complication specificity",
    hcc: "HCC 18", estimatedRAF: 0.302, active: true,
  },
  {
    id: "CMB-013", name: "Type 2 DM Missing Hypertension", severity: "MEDIUM",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes) => dxCodes.some(d => d.startsWith("E11")),
    expected:  (dxCodes) => dxCodes.some(d => d.startsWith("I10") || d.startsWith("I11")),
    description: "Type 2 DM (E11.x) reported without hypertension (I10/I11) — common comorbidity",
    hcc: null, estimatedRAF: 0, active: true,
  },
  {
    id: "CMB-014", name: "Type 2 DM Missing Obesity Screening", severity: "LOW",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes) => dxCodes.some(d => d.startsWith("E11")),
    expected:  (dxCodes) => dxCodes.some(d => d.startsWith("E66") || d.startsWith("Z68")),
    description: "Type 2 DM (E11.x) without obesity / BMI documentation (E66 / Z68)",
    hcc: "HCC 48", estimatedRAF: 0.250, active: true,
  },

  // ── Cardiovascular ──
  {
    id: "CMB-020", name: "Heart Failure Missing Hypertension", severity: "HIGH",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes) => dxCodes.some(d => d.startsWith("I50")),
    expected:  (dxCodes) => dxCodes.some(d => d.startsWith("I10") || d.startsWith("I11")),
    description: "Heart failure (I50.x) without hypertension documentation (I10/I11)",
    hcc: null, estimatedRAF: 0, active: true,
  },
  {
    id: "CMB-021", name: "Hypertensive Heart Disease Missing HF Specificity", severity: "HIGH",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes) => dxCodes.some(d => d.startsWith("I110")),
    expected:  (dxCodes) => dxCodes.some(d => d.startsWith("I50")),
    description: "Hypertensive heart disease with HF (I11.0) without HF type specificity (I50.x)",
    hcc: "HCC 85", estimatedRAF: 0.323, active: true,
  },
  {
    id: "CMB-022", name: "Ischemic Heart Disease Missing Associated Conditions", severity: "MEDIUM",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes) => dxCodes.some(d => d.startsWith("I25")),
    expected:  (dxCodes) => dxCodes.some(d => d.startsWith("I10") || d.startsWith("I48") || d.startsWith("E78")),
    description: "Ischemic heart disease (I25.x) without HTN (I10), AFib (I48), or hyperlipidemia (E78)",
    hcc: null, estimatedRAF: 0, active: true,
  },

  // ── Respiratory ──
  {
    id: "CMB-030", name: "COPD Missing Tobacco Use History", severity: "MEDIUM",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes) => dxCodes.some(d => d.startsWith("J44")),
    expected:  (dxCodes) => dxCodes.some(d => d.startsWith("F17") || d.startsWith("Z87891")),
    description: "COPD (J44.x) without tobacco use / history (F17 / Z87.891)",
    hcc: null, estimatedRAF: 0, active: true,
  },
  {
    id: "CMB-031", name: "COPD Exacerbation Missing Respiratory Failure", severity: "HIGH",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes) => dxCodes.some(d => d.startsWith("J441")),
    expected:  (dxCodes) => dxCodes.some(d => d.startsWith("J96")),
    description: "COPD with acute exacerbation (J44.1) without respiratory failure (J96.x)",
    hcc: "HCC 84", estimatedRAF: 0.282, active: true,
  },

  // ── Renal ──
  {
    id: "CMB-040", name: "CKD Missing Etiological Diagnosis", severity: "MEDIUM",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes) => dxCodes.some(d => d.startsWith("N18")),
    expected:  (dxCodes) => dxCodes.some(d => d.startsWith("E11") || d.startsWith("I10") || d.startsWith("I12")),
    description: "CKD (N18.x) without etiological condition — DM (E11), HTN (I10), or hypertensive renal disease (I12)",
    hcc: "HCC 37", estimatedRAF: 0.105, active: true,
  },
  {
    id: "CMB-041", name: "ESRD Missing Dialysis Status", severity: "HIGH",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes) => dxCodes.some(d => d.startsWith("N186")),
    expected:  (dxCodes) => dxCodes.some(d => d.startsWith("Z992")),
    description: "End stage renal disease (N18.6) without dialysis dependence status (Z99.2)",
    hcc: null, estimatedRAF: 0, active: true,
  },

  // ── Status Codes ──
  {
    id: "CMB-050", name: "Dialysis Status Without ESRD", severity: "HIGH",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes, cptCodes) =>
      dxCodes.some(d => d.startsWith("Z992")) ||
      (cptCodes || []).some(c => ["90935", "90937", "90945", "90947"].includes(c)),
    expected:  (dxCodes) => dxCodes.some(d => d.startsWith("N186") || d.startsWith("N185")),
    description: "Dialysis status (Z99.2) or dialysis CPT without ESRD (N18.6) or CKD stage 5 (N18.5)",
    hcc: "HCC 326", estimatedRAF: 0.290, active: true,
  },
  {
    id: "CMB-051", name: "Kidney Transplant Missing Complication Codes", severity: "MEDIUM",
    category: "COMORBIDITY_GAP",
    trigger:   (dxCodes) => dxCodes.some(d => d.startsWith("Z940")),
    expected:  (dxCodes) => dxCodes.some(d => d.startsWith("T86") || d.startsWith("Z7982")),
    description: "Kidney transplant status (Z94.0) without transplant complication (T86) or immunosuppression (Z79.82)",
    hcc: "HCC 186", estimatedRAF: 0.830, active: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DX ANALYTICS AGENT
// ═══════════════════════════════════════════════════════════════════════════════

export class DxAnalyticsAgent {
  constructor(currentClaims, historicalClaims = []) {
    this.current = currentClaims;
    this.history = historicalClaims;
    this.all = [...currentClaims, ...historicalClaims];
    this._cache = {};
  }

  // ── Layer 1: Descriptive ─────────────────────────────────────────────────

  getVolumeMetrics() {
    const claims = this.current;
    const dxPerClaim = claims.map(c => (c.diagnoses || []).length);
    const totalDx = dxPerClaim.reduce((s, n) => s + n, 0);
    const allCodes = claims.flatMap(c => (c.diagnoses || []).map(d => d.code));
    const uniqueDx = new Set(allCodes).size;
    const avgDxPerClaim = claims.length > 0 ? totalDx / claims.length : 0;

    const sorted = [...dxPerClaim].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianDxPerClaim = sorted.length === 0 ? 0 :
      sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    const singleDxClaims = dxPerClaim.filter(n => n === 1).length;
    const singleDxPct = claims.length > 0 ? (singleDxClaims / claims.length) * 100 : 0;
    const maxDxOnClaim = dxPerClaim.length > 0 ? Math.max(...dxPerClaim) : 0;

    const distMap = {};
    for (const n of dxPerClaim) {
      distMap[n] = (distMap[n] || 0) + 1;
    }
    const dxDistribution = Object.entries(distMap)
      .map(([count, claimCount]) => ({ count: Number(count), claims: claimCount }))
      .sort((a, b) => a.count - b.count);

    return {
      totalDx,
      uniqueDx,
      avgDxPerClaim: Math.round(avgDxPerClaim * 100) / 100,
      medianDxPerClaim,
      singleDxClaims,
      singleDxPct: Math.round(singleDxPct * 100) / 100,
      maxDxOnClaim,
      dxDistribution,
    };
  }

  getTopCodes(qualifier = "ABK", limit = 20) {
    const claims = this.current;
    const counts = {};
    for (const claim of claims) {
      for (const dx of (claim.diagnoses || [])) {
        if (qualifier === "ALL" || dx.qualifier === qualifier) {
          counts[dx.code] = (counts[dx.code] || 0) + 1;
        }
      }
    }
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    return Object.entries(counts)
      .map(([code, count]) => ({
        code,
        name: getDxName(code),
        count,
        pct: Math.round((count / Math.max(total, 1)) * 10000) / 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getCategoryBreakdown() {
    const claims = this.current;
    const chapters = {};
    for (const claim of claims) {
      for (const dx of (claim.diagnoses || [])) {
        const ch = dx.code.charAt(0).toUpperCase();
        chapters[ch] = (chapters[ch] || 0) + 1;
      }
    }
    const total = Object.values(chapters).reduce((s, n) => s + n, 0);
    return Object.entries(chapters)
      .map(([chapter, count]) => ({
        chapter,
        name: ICD10_CHAPTERS[chapter] || "Unknown",
        count,
        pct: Math.round((count / Math.max(total, 1)) * 10000) / 100,
      }))
      .sort((a, b) => b.count - a.count);
  }

  getQualifierBreakdown() {
    const claims = this.current;
    let abk = 0;
    let abf = 0;
    let total = 0;
    for (const claim of claims) {
      for (const dx of (claim.diagnoses || [])) {
        total++;
        if (dx.qualifier === "ABK") abk++;
        else if (dx.qualifier === "ABF") abf++;
      }
    }
    return { abk, abf, total };
  }

  // ── Layer 2: Diagnostic (Provider Quality) ──────────────────────────────

  getProviderQuality() {
    const claims = this.current;
    const byProvider = {};

    for (const claim of claims) {
      const npi = claim.billingProvider?.npi || "UNKNOWN";
      if (!byProvider[npi]) {
        byProvider[npi] = { npi, name: claim.billingProvider?.name || "", claims: [], dxCodes: new Set() };
      }
      byProvider[npi].claims.push(claim);
      for (const dx of (claim.diagnoses || [])) {
        byProvider[npi].dxCodes.add(dx.code);
      }
    }

    const { anomalies } = this.runComorbidityRules();
    const gapsByProvider = {};
    for (const a of anomalies) {
      gapsByProvider[a.billingProvider] = (gapsByProvider[a.billingProvider] || 0) + 1;
    }

    const histByProvider = {};
    for (const claim of this.history) {
      const npi = claim.billingProvider?.npi || "UNKNOWN";
      if (!histByProvider[npi]) histByProvider[npi] = [];
      histByProvider[npi].push(claim);
    }

    return Object.values(byProvider).map(p => {
      const totalClaims = p.claims.length;
      const totalDx = p.claims.reduce((s, c) => s + (c.diagnoses || []).length, 0);
      const avgDxPerClaim = totalClaims > 0 ? totalDx / totalClaims : 0;
      const singleDxClaims = p.claims.filter(c => (c.diagnoses || []).length === 1).length;
      const singleDxPct = totalClaims > 0 ? singleDxClaims / totalClaims : 0;
      const uniqueDxCodes = p.dxCodes.size;

      const base = Math.min(avgDxPerClaim / 5.0, 1.0) * 40;
      const variety = Math.min(uniqueDxCodes / 20, 1.0) * 20;
      const singleDxPenalty = Math.max(0, (1 - singleDxPct / 0.30)) * 20;
      const gapRate = totalClaims > 0 ? (gapsByProvider[p.npi] || 0) / totalClaims : 0;
      const comorbidityBonus = (1 - gapRate) * 20;
      const completenessScore = Math.min(100, Math.round(base + variety + singleDxPenalty + comorbidityBonus));

      const histClaims = histByProvider[p.npi] || [];
      let trend = null;
      if (histClaims.length > 0) {
        const histDx = histClaims.reduce((s, c) => s + (c.diagnoses || []).length, 0);
        const histAvg = histDx / histClaims.length;
        trend = Math.round((avgDxPerClaim - histAvg) * 100) / 100;
      }

      return {
        npi: p.npi,
        name: p.name,
        claims: totalClaims,
        totalDx,
        avgDxPerClaim: Math.round(avgDxPerClaim * 100) / 100,
        singleDxPct: Math.round(singleDxPct * 10000) / 100,
        uniqueDxCodes,
        completenessScore,
        trend,
      };
    }).sort((a, b) => b.claims - a.claims);
  }

  getRenderingProviderQuality() {
    const claims = this.current;
    const byProvider = {};

    for (const claim of claims) {
      const npi = claim.renderingProvider?.npi || "UNKNOWN";
      if (!byProvider[npi]) {
        const rp = claim.renderingProvider || {};
        byProvider[npi] = {
          npi,
          name: `${rp.firstName || ""} ${rp.lastName || ""}`.trim(),
          claims: [],
          dxCodes: new Set(),
        };
      }
      byProvider[npi].claims.push(claim);
      for (const dx of (claim.diagnoses || [])) {
        byProvider[npi].dxCodes.add(dx.code);
      }
    }

    const { anomalies } = this.runComorbidityRules();
    const gapsByProvider = {};
    for (const a of anomalies) {
      gapsByProvider[a.renderingProvider] = (gapsByProvider[a.renderingProvider] || 0) + 1;
    }

    const histByProvider = {};
    for (const claim of this.history) {
      const npi = claim.renderingProvider?.npi || "UNKNOWN";
      if (!histByProvider[npi]) histByProvider[npi] = [];
      histByProvider[npi].push(claim);
    }

    return Object.values(byProvider).map(p => {
      const totalClaims = p.claims.length;
      const totalDx = p.claims.reduce((s, c) => s + (c.diagnoses || []).length, 0);
      const avgDxPerClaim = totalClaims > 0 ? totalDx / totalClaims : 0;
      const singleDxClaims = p.claims.filter(c => (c.diagnoses || []).length === 1).length;
      const singleDxPct = totalClaims > 0 ? singleDxClaims / totalClaims : 0;
      const uniqueDxCodes = p.dxCodes.size;

      const base = Math.min(avgDxPerClaim / 5.0, 1.0) * 40;
      const variety = Math.min(uniqueDxCodes / 20, 1.0) * 20;
      const singleDxPenalty = Math.max(0, (1 - singleDxPct / 0.30)) * 20;
      const gapRate = totalClaims > 0 ? (gapsByProvider[p.npi] || 0) / totalClaims : 0;
      const comorbidityBonus = (1 - gapRate) * 20;
      const completenessScore = Math.min(100, Math.round(base + variety + singleDxPenalty + comorbidityBonus));

      const histClaims = histByProvider[p.npi] || [];
      let trend = null;
      if (histClaims.length > 0) {
        const histDx = histClaims.reduce((s, c) => s + (c.diagnoses || []).length, 0);
        const histAvg = histDx / histClaims.length;
        trend = Math.round((avgDxPerClaim - histAvg) * 100) / 100;
      }

      return {
        npi: p.npi,
        name: p.name,
        claims: totalClaims,
        totalDx,
        avgDxPerClaim: Math.round(avgDxPerClaim * 100) / 100,
        singleDxPct: Math.round(singleDxPct * 10000) / 100,
        uniqueDxCodes,
        completenessScore,
        trend,
      };
    }).sort((a, b) => b.claims - a.claims);
  }

  getUnderReporters(threshold = 2.0) {
    return this.getProviderQuality().filter(p => p.avgDxPerClaim < threshold);
  }

  // ── Layer 3: Predictive (Comorbidity Gaps) ──────────────────────────────

  runComorbidityRules() {
    if (this._cache.comorbidityGaps) return this._cache.comorbidityGaps;

    const anomalies = [];
    const activeRules = COMORBIDITY_RULES.filter(r => r.active);

    for (const claim of this.current) {
      const dxCodes = (claim.diagnoses || []).map(d => d.code);
      const cptCodes = (claim.serviceLines || []).map(l => l.procedureCode);

      for (const rule of activeRules) {
        if (rule.trigger(dxCodes, cptCodes) && !rule.expected(dxCodes, cptCodes)) {
          const triggerDx = dxCodes.filter(d => {
            try { return rule.trigger([d], cptCodes); } catch { return false; }
          });

          anomalies.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            category: rule.category,
            claimId: claim.id,
            memberId: claim.subscriber?.memberId,
            memberName: `${claim.subscriber?.firstName || ""} ${claim.subscriber?.lastName || ""}`.trim(),
            billingProvider: claim.billingProvider?.npi,
            renderingProvider: claim.renderingProvider?.npi,
            serviceDate: claim.serviceDateFrom,
            triggerDx,
            expectedDx: rule.description,
            description: rule.description,
            hcc: rule.hcc,
            estimatedRAF: rule.estimatedRAF,
            estimatedRevenue: Math.round((rule.estimatedRAF || 0) * 10000 * 100) / 100,
            status: "DETECTED",
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    const byRule = {};
    const bySeverity = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    const byProvider = {};
    for (const a of anomalies) {
      byRule[a.ruleId] = (byRule[a.ruleId] || 0) + 1;
      bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
      byProvider[a.billingProvider] = (byProvider[a.billingProvider] || 0) + 1;
    }

    const result = { anomalies, summary: { byRule, bySeverity, byProvider } };
    this._cache.comorbidityGaps = result;
    return result;
  }

  detectChronicGaps() {
    if (this._cache.chronicGaps) return this._cache.chronicGaps;

    const gaps = [];
    const monitoredEntries = CONDITION_SIGNIFICANCE_REGISTRY.filter(e => e.monitor);

    const historyByMember = {};
    for (const claim of this.history) {
      const mid = claim.subscriber?.memberId;
      if (!mid) continue;
      if (!historyByMember[mid]) historyByMember[mid] = [];
      historyByMember[mid].push(claim);
    }

    const currentByMember = {};
    for (const claim of this.current) {
      const mid = claim.subscriber?.memberId;
      if (!mid) continue;
      if (!currentByMember[mid]) currentByMember[mid] = [];
      currentByMember[mid].push(claim);
    }

    for (const [memberId, currentClaims] of Object.entries(currentByMember)) {
      const historyClaims = historyByMember[memberId] || [];
      if (historyClaims.length === 0) continue;

      const currentDxCodes = new Set(
        currentClaims.flatMap(c => (c.diagnoses || []).map(d => d.code))
      );

      for (const entry of monitoredEntries) {
        let timesInHistory = 0;
        let lastReported = null;

        for (const hClaim of historyClaims) {
          const hasCondition = (hClaim.diagnoses || []).some(
            d => d.code === entry.code || d.code.startsWith(entry.code)
          );
          if (hasCondition) {
            timesInHistory++;
            if (!lastReported || hClaim.serviceDateFrom > lastReported) {
              lastReported = hClaim.serviceDateFrom;
            }
          }
        }

        if (timesInHistory >= 2) {
          const inCurrent = [...currentDxCodes].some(
            code => code === entry.code || code.startsWith(entry.code)
          );
          if (!inCurrent) {
            const memberName =
              `${currentClaims[0].subscriber?.firstName || ""} ${currentClaims[0].subscriber?.lastName || ""}`.trim();
            gaps.push({
              memberId,
              memberName,
              missingCondition: entry.name,
              code: entry.code,
              hcc: entry.hcc,
              lastReported,
              timesInHistory,
              currentClaimId: currentClaims[0].id,
              estimatedRAF: entry.rafWeight,
            });
          }
        }
      }
    }

    this._cache.chronicGaps = gaps;
    return gaps;
  }

  // ── Layer 3b: CPT-Dx Association ────────────────────────────────────────

  getCptDxAssociation() {
    const assocMap = {};
    const historySet = new Set(this.history);

    for (const claim of this.all) {
      const dxCodes = (claim.diagnoses || []).map(d => d.code);
      const cptCodes = (claim.serviceLines || []).map(l => l.procedureCode);
      const isHistory = historySet.has(claim);

      for (const cpt of cptCodes) {
        for (const dx of dxCodes) {
          const key = `${cpt}|${dx}`;
          if (!assocMap[key]) {
            assocMap[key] = {
              cpt, dx, frequency: 0, currentCount: 0, historyCount: 0,
              providers: new Set(),
            };
          }
          assocMap[key].frequency++;
          if (isHistory) assocMap[key].historyCount++;
          else assocMap[key].currentCount++;
          if (claim.billingProvider?.npi) assocMap[key].providers.add(claim.billingProvider.npi);
        }
      }
    }

    return Object.values(assocMap)
      .map(a => ({
        cpt: a.cpt,
        dx: a.dx,
        frequency: a.frequency,
        currentCount: a.currentCount,
        historyCount: a.historyCount,
        providers: [...a.providers],
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  getCptDxMismatches() {
    const cptTotal = {};
    const cptDxCount = {};

    for (const claim of this.all) {
      const dxSet = new Set((claim.diagnoses || []).map(d => d.code));
      const cptSet = new Set((claim.serviceLines || []).map(l => l.procedureCode));

      for (const cpt of cptSet) {
        cptTotal[cpt] = (cptTotal[cpt] || 0) + 1;
        if (!cptDxCount[cpt]) cptDxCount[cpt] = {};
        for (const dx of dxSet) {
          cptDxCount[cpt][dx] = (cptDxCount[cpt][dx] || 0) + 1;
        }
      }
    }

    const expectedDxMap = {};
    for (const [cpt, dxCounts] of Object.entries(cptDxCount)) {
      const total = cptTotal[cpt];
      for (const [dx, count] of Object.entries(dxCounts)) {
        const pct = count / total;
        if (pct >= 0.60) {
          if (!expectedDxMap[cpt]) expectedDxMap[cpt] = [];
          expectedDxMap[cpt].push({ dx, pct: Math.round(pct * 100) });
        }
      }
    }

    const mismatches = [];
    for (const claim of this.current) {
      const dxSet = new Set((claim.diagnoses || []).map(d => d.code));
      const cptSet = new Set((claim.serviceLines || []).map(l => l.procedureCode));

      for (const cpt of cptSet) {
        const expectedList = expectedDxMap[cpt] || [];
        for (const { dx, pct } of expectedList) {
          if (!dxSet.has(dx)) {
            mismatches.push({
              claimId: claim.id,
              cpt,
              expectedDx: dx,
              reason: `${cpt} paired with ${dx} in ${pct}% of encounters`,
              confidence: pct,
            });
          }
        }
      }
    }

    return mismatches.sort((a, b) => b.confidence - a.confidence);
  }

  // ── Layer 4: Prescriptive (Prioritized Anomalies) ───────────────────────

  getPrioritizedAnomalies() {
    const { anomalies: comorbidityAnomalies } = this.runComorbidityRules();
    const chronicGaps = this.detectChronicGaps();
    const cptMismatches = this.getCptDxMismatches();

    const allAnomalies = [];

    for (const a of comorbidityAnomalies) {
      allAnomalies.push({ ...a, source: "COMORBIDITY" });
    }

    for (const g of chronicGaps) {
      allAnomalies.push({
        ruleId: "CHRONIC-GAP",
        ruleName: "Chronic Condition Gap",
        severity: "HIGH",
        category: "CHRONIC_GAP",
        claimId: g.currentClaimId,
        memberId: g.memberId,
        memberName: g.memberName,
        billingProvider: null,
        renderingProvider: null,
        serviceDate: g.lastReported,
        triggerDx: [g.code],
        expectedDx: g.missingCondition,
        description: `${g.missingCondition} (${g.code}) reported ${g.timesInHistory}x in history but absent from current claims`,
        hcc: g.hcc,
        estimatedRAF: g.estimatedRAF,
        estimatedRevenue: Math.round((g.estimatedRAF || 0) * 10000 * 100) / 100,
        status: "DETECTED",
        detectedAt: new Date().toISOString(),
        source: "CHRONIC",
      });
    }

    for (const m of cptMismatches.slice(0, 200)) {
      allAnomalies.push({
        ruleId: "CPT-DX-MISMATCH",
        ruleName: "CPT-Dx Association Mismatch",
        severity: "LOW",
        category: "CPT_DX_MISMATCH",
        claimId: m.claimId,
        memberId: null,
        memberName: null,
        billingProvider: null,
        renderingProvider: null,
        serviceDate: null,
        triggerDx: [m.cpt],
        expectedDx: m.expectedDx,
        description: m.reason,
        hcc: null,
        estimatedRAF: 0,
        estimatedRevenue: 0,
        status: "DETECTED",
        detectedAt: new Date().toISOString(),
        source: "CPT_DX",
        confidence: m.confidence,
      });
    }

    for (const a of allAnomalies) {
      const sevScore = (a.severity === "HIGH" ? 3 : a.severity === "MEDIUM" ? 2 : 1) * 3;
      const rafScore = ((a.estimatedRAF || 0) > 0.3 ? 3 : (a.estimatedRAF || 0) > 0.1 ? 2 : 1) * 2;
      const recencyScore = a.serviceDate ? 1 : 0;
      a.priorityScore = sevScore + rafScore + recencyScore;
      a.priority = a.priorityScore >= 12 ? 1 : a.priorityScore >= 8 ? 2 : 3;
    }

    allAnomalies.sort((a, b) => b.priorityScore - a.priorityScore);

    const p1 = allAnomalies.filter(a => a.priority === 1);
    const p2 = allAnomalies.filter(a => a.priority === 2);
    const p3 = allAnomalies.filter(a => a.priority === 3);

    const byStatus = {};
    const bySeverity = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const a of allAnomalies) {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
    }

    return { p1, p2, p3, total: allAnomalies.length, byStatus, bySeverity };
  }

  // ── Member Dx Profile ───────────────────────────────────────────────────

  buildMemberProfiles() {
    const memberMap = {};
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const cutoff =
      `${twelveMonthsAgo.getFullYear()}` +
      `${String(twelveMonthsAgo.getMonth() + 1).padStart(2, "0")}` +
      `${String(twelveMonthsAgo.getDate()).padStart(2, "0")}`;

    for (const claim of this.all) {
      const mid = claim.subscriber?.memberId;
      if (!mid) continue;

      if (!memberMap[mid]) {
        memberMap[mid] = {
          memberId: mid,
          name: `${claim.subscriber?.firstName || ""} ${claim.subscriber?.lastName || ""}`.trim(),
          dob: claim.subscriber?.dateOfBirth,
          gender: claim.subscriber?.gender,
          conditions: {},
          encounters: 0,
          dates: [],
        };
      }

      const member = memberMap[mid];
      member.encounters++;
      if (claim.serviceDateFrom) member.dates.push(claim.serviceDateFrom);

      for (const dx of (claim.diagnoses || [])) {
        const code = dx.code;
        if (!member.conditions[code]) {
          const regEntry = CONDITION_SIGNIFICANCE_REGISTRY.find(e => e.code === code);
          member.conditions[code] = {
            code,
            name: getDxName(code),
            hcc: regEntry?.hcc || null,
            firstSeen: claim.serviceDateFrom,
            lastSeen: claim.serviceDateFrom,
            timesReported: 0,
            rafWeight: regEntry?.rafWeight || 0,
          };
        }

        const cond = member.conditions[code];
        cond.timesReported++;
        if (claim.serviceDateFrom && claim.serviceDateFrom < cond.firstSeen) {
          cond.firstSeen = claim.serviceDateFrom;
        }
        if (claim.serviceDateFrom && claim.serviceDateFrom > cond.lastSeen) {
          cond.lastSeen = claim.serviceDateFrom;
        }
      }
    }

    return Object.values(memberMap).map(m => {
      const sortedDates = m.dates.sort();
      const conditions = Object.values(m.conditions).map(c => ({
        ...c,
        status: c.lastSeen >= cutoff ? "ACTIVE" : "HISTORICAL",
      }));
      const riskScore = conditions.reduce((s, c) => s + (c.rafWeight || 0), 0);

      return {
        memberId: m.memberId,
        name: m.name,
        dob: m.dob,
        gender: m.gender,
        conditions,
        totalEncounters: m.encounters,
        dateRange: {
          from: sortedDates[0] || null,
          to: sortedDates[sortedDates.length - 1] || null,
        },
        riskScore: Math.round(riskScore * 1000) / 1000,
      };
    });
  }

  getMemberProfile(memberId) {
    const profiles = this.buildMemberProfiles();
    return profiles.find(p => p.memberId === memberId) || null;
  }

  // ── Trending ────────────────────────────────────────────────────────────

  getMonthlyDxTrend() {
    const claims = this.current;
    const byMonth = {};

    for (const claim of claims) {
      const raw = claim.serviceDateFrom;
      if (!raw || raw.length < 6) continue;
      const key = `${raw.slice(0, 4)}-${raw.slice(4, 6)}`;
      if (!byMonth[key]) byMonth[key] = { dxCounts: [], gapCount: 0 };
      byMonth[key].dxCounts.push((claim.diagnoses || []).length);
    }

    const { anomalies } = this.runComorbidityRules();
    for (const a of anomalies) {
      const raw = a.serviceDate;
      if (!raw || raw.length < 6) continue;
      const key = `${raw.slice(0, 4)}-${raw.slice(4, 6)}`;
      if (byMonth[key]) byMonth[key].gapCount++;
    }

    return Object.entries(byMonth)
      .map(([month, data]) => {
        const avgDx = data.dxCounts.length > 0
          ? data.dxCounts.reduce((s, n) => s + n, 0) / data.dxCounts.length
          : 0;
        const singleDxPct =
          (data.dxCounts.filter(n => n === 1).length / Math.max(data.dxCounts.length, 1)) * 100;

        return {
          month,
          avgDx: Math.round(avgDx * 100) / 100,
          singleDxPct: Math.round(singleDxPct * 100) / 100,
          gaps: data.gapCount,
          resolved: 0,
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  getTopCodeShift() {
    const claims = this.current;
    const byMonth = {};
    for (const claim of claims) {
      const raw = claim.serviceDateFrom;
      if (!raw || raw.length < 6) continue;
      const key = `${raw.slice(0, 4)}-${raw.slice(4, 6)}`;
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(claim);
    }

    const abkCounts = {};
    for (const claim of claims) {
      const abk = (claim.diagnoses || []).find(d => d.qualifier === "ABK");
      if (abk) abkCounts[abk.code] = (abkCounts[abk.code] || 0) + 1;
    }

    const top10Codes = Object.entries(abkCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code]) => code);

    const months = Object.keys(byMonth).sort();

    const grid = top10Codes.map(code =>
      months.map(month => {
        const monthClaims = byMonth[month] || [];
        return monthClaims.filter(c =>
          (c.diagnoses || []).some(d => d.qualifier === "ABK" && d.code === code)
        ).length;
      })
    );

    return { months, codes: top10Codes, grid };
  }

  // ── Summary ─────────────────────────────────────────────────────────────

  getFullAnalytics() {
    return {
      volume: this.getVolumeMetrics(),
      topPrincipal: this.getTopCodes("ABK", 20),
      topOther: this.getTopCodes("ABF", 20),
      categories: this.getCategoryBreakdown(),
      qualifiers: this.getQualifierBreakdown(),
      providerQuality: this.getProviderQuality(),
      renderingQuality: this.getRenderingProviderQuality(),
      underReporters: this.getUnderReporters(),
      comorbidityGaps: this.runComorbidityRules(),
      chronicGaps: this.detectChronicGaps(),
      cptDxAssociation: this.getCptDxAssociation(),
      anomalies: this.getPrioritizedAnomalies(),
      memberProfiles: this.buildMemberProfiles(),
      monthlyTrend: this.getMonthlyDxTrend(),
      codeShift: this.getTopCodeShift(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATE MEMBER HISTORY — 2,000 simulated historical claims for demo
// ═══════════════════════════════════════════════════════════════════════════════

export function generateMemberHistory(claims, months = 24) {
  const rng = createRng(42424242);

  const members = {};
  const providerPairs = {};
  for (const c of claims) {
    members[c.subscriber.memberId] = c.subscriber;
    const bNpi = c.billingProvider.npi;
    if (!providerPairs[bNpi]) {
      providerPairs[bNpi] = { billing: c.billingProvider, rendering: c.renderingProvider };
    }
  }
  const memberList = Object.values(members);
  const providerList = Object.values(providerPairs);

  const baseDxCodes = [
    "E119", "I10", "J449", "E785", "N189",
    "F329", "I2510", "E039", "G4733", "M179",
    "K219", "J459", "E669", "I4891", "N400",
  ];

  const chronicInjects = [
    { code: "E1122", name: "Type 2 DM with CKD" },
    { code: "E1165", name: "Type 2 DM with hyperglycemia" },
    { code: "I5020", name: "Unspecified systolic HF" },
    { code: "E6601", name: "Morbid obesity" },
    { code: "N184",  name: "CKD Stage 4" },
    { code: "I5032", name: "Chronic diastolic HF" },
  ];

  const memberChronicMap = {};
  for (let i = 0; i < memberList.length; i++) {
    if (rng() < 0.25) {
      const numConditions = 1 + Math.floor(rng() * 2);
      const conditions = [];
      for (let j = 0; j < numConditions; j++) {
        conditions.push(pick(rng, chronicInjects));
      }
      memberChronicMap[memberList[i].memberId] = conditions;
    }
  }

  const now = new Date();
  const historicalClaims = [];
  const cptCodes = [
    "99213", "99214", "99215", "99203", "99204",
    "36415", "81001", "80053", "85025", "93000",
    "71046", "74177",
  ];

  for (let i = 0; i < 2000; i++) {
    const member = pick(rng, memberList);
    const provider = pick(rng, providerList);

    const monthsBack = 1 + Math.floor(rng() * months);
    const date = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1 + Math.floor(rng() * 28));
    if (date.getDate() > 28) date.setDate(28);
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const dateStr = `${yy}${mm}${dd}`;

    const diagCount = 1 + Math.floor(rng() * 4);
    const usedDx = new Set();
    const diagnoses = [];

    for (let d = 0; d < diagCount; d++) {
      let code;
      let attempts = 0;
      do {
        code = pick(rng, baseDxCodes);
        attempts++;
      } while (usedDx.has(code) && attempts < 20);
      usedDx.add(code);
      diagnoses.push({ code, sequence: d + 1, qualifier: d === 0 ? "ABK" : "ABF" });
    }

    const chronic = memberChronicMap[member.memberId];
    if (chronic && rng() < 0.70) {
      for (const cond of chronic) {
        if (!usedDx.has(cond.code)) {
          usedDx.add(cond.code);
          diagnoses.push({
            code: cond.code,
            sequence: diagnoses.length + 1,
            qualifier: "ABF",
          });
        }
      }
    }

    const lineCount = 1 + Math.floor(rng() * 3);
    const serviceLines = [];
    let totalCharge = 0;
    for (let l = 0; l < lineCount; l++) {
      const chargeAmount = Math.round((50 + rng() * 1950) * 100) / 100;
      totalCharge += chargeAmount;
      const maxPtr = Math.min(diagnoses.length, 4);
      serviceLines.push({
        lineNumber: l + 1,
        procedureCode: pick(rng, cptCodes),
        chargeAmount,
        unitCount: 1 + Math.floor(rng() * 3),
        unitType: "UN",
        diagnosisPointers: String(1 + Math.floor(rng() * maxPtr)),
        modifier1: null,
      });
    }
    totalCharge = Math.round(totalCharge * 100) / 100;
    const paidAmount = Math.round(totalCharge * (0.4 + rng() * 0.4) * 100) / 100;

    const adjDaysLater = 3 + Math.floor(rng() * 12);
    const adjDate = new Date(date.getTime() + adjDaysLater * 86400000);
    const adjDateStr =
      `${adjDate.getFullYear()}` +
      `${String(adjDate.getMonth() + 1).padStart(2, "0")}` +
      `${String(adjDate.getDate()).padStart(2, "0")}`;

    historicalClaims.push({
      id: `HCLM-${String(i + 1).padStart(6, "0")}`,
      patientControlNumber: `HPCN-${dateStr}-${String(i + 1).padStart(6, "0")}`,
      totalChargeAmount: totalCharge,
      facilityCode: pick(rng, ["11", "22", "23"]),
      serviceDateFrom: dateStr,
      serviceDateTo: dateStr,
      contractId: "H1234",
      subscriber: {
        memberId: member.memberId,
        lastName: member.lastName,
        firstName: member.firstName,
        dateOfBirth: member.dateOfBirth,
        gender: member.gender,
        address: member.address,
        city: member.city,
        state: member.state,
        zip: member.zip,
      },
      billingProvider: { ...provider.billing },
      renderingProvider: { ...provider.rendering },
      diagnoses,
      serviceLines,
      paidAmount,
      adjudicationDate: adjDateStr,
    });
  }

  return historicalClaims;
}
