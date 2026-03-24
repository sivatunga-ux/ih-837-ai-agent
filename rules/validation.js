import { CODESET_TABLES, CODE_QUALIFIERS, normalizeCode, normalizeNdc } from "../data/codesets.js";

const NON_RISK_ELIGIBLE_CPTS = new Set(["36415", "81002", "93000"]);
const IHA_CPTS = new Set(["99341","99342","99344","99345","99347","99348","99349","99350","G0402","G0438","G0439"]);
const VALID_POS = new Set(["11","12","19","22","23","31","32","34","49","50","53","57","61"]);
const POS_FIX_MAP = { "00":"11", "99":"11", "":"11" };
const CPT_AMPUTATION = new Set(["27880","27882","27590","27592"]);
const CPT_TRANSPLANT = new Set(["50360","50365"]);

function isPharmacyLikeCPT(cpt) {
  return /^J\d{4}$/.test(cpt || "") || ["J3490","J3590","J9999"].includes(cpt);
}

export function splitSegs(x12) {
  return (x12 || "").split("~").map((s) => s.trim()).filter(Boolean);
}

export function joinSegs(segs) {
  return segs.join("~\n") + "~\n";
}

export function getSubscriberId(segs) {
  for (const s of segs) {
    if (s.startsWith("NM1*IL*")) {
      const p = s.split("*");
      if ((p[8] || "") === "MI") return (p[9] || "").trim();
    }
  }
  return "";
}

export function getRenderingNPI(segs) {
  for (const s of segs) {
    if (s.startsWith("NM1*82*")) {
      const p = s.split("*");
      if ((p[8] || "") === "XX") return (p[9] || "").trim();
    }
  }
  return "";
}

export function getDOS(segs) {
  for (const s of segs) {
    if (s.startsWith("DTP*472*D8*")) return (s.split("*")[3] || "").trim();
  }
  return "";
}

function isYYYYMMDD(s) {
  if (!/^\d{8}$/.test(s || "")) return false;
  const y = +s.slice(0, 4);
  const m = +s.slice(4, 6);
  const d = +s.slice(6, 8);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && (dt.getUTCMonth() + 1) === m && dt.getUTCDate() === d;
}

export function getClaimPOS(segs) {
  for (const s of segs) {
    if (s.startsWith("CLM*")) {
      const parts = s.split("*");
      const clm05 = parts[5] || "";
      return (clm05.split(":")[0] || "").trim();
    }
  }
  return "";
}

export function getCPTs(segs) {
  const out = [];
  for (const s of segs) {
    if (s.startsWith("SV1*") && s.includes("HC:")) {
      const p = s.split("*");
      const proc = p[1] || "";
      if (proc.startsWith("HC:")) {
        const code = (proc.split(":")[1] || "").trim();
        if (code) out.push(code);
      }
    }
  }
  return out;
}

export function getICDs(segs) {
  const out = [];
  for (const s of segs) {
    if (s.startsWith("HI*")) {
      const parts = s.split("*").slice(1);
      for (const c of parts) {
        const idx = c.indexOf(":");
        if (idx > 0) {
          const qual = c.slice(0, idx);
          const code = c.slice(idx + 1).trim();
          if (qual === "ABK" && code) out.push(code);
        }
      }
    }
  }
  return out;
}

function titleCase(str) {
  const t = (str || "").toLowerCase();
  return t.replace(/\b[a-z]/g, (m) => m.toUpperCase());
}

function isValidICD10Demo(dx) {
  return /^[A-TV-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/.test(dx || "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseComposite(segmentValue) {
  const raw = String(segmentValue || "").trim();
  if (!raw) return { qualifier: "", code: "", raw };
  const parts = raw.split(":");
  if (parts.length < 2) return { qualifier: "", code: normalizeCode(raw), raw };
  return {
    qualifier: normalizeCode(parts[0]),
    code: normalizeCode(parts[1]),
    raw
  };
}

function parseSv1Procedure(segmentValue) {
  const raw = String(segmentValue || "").trim();
  if (!raw) return { qualifier: "", code: "", modifiers: [], raw };
  const parts = raw.split(":").map((p) => normalizeCode(p));
  return {
    qualifier: parts[0] || "",
    code: parts[1] || "",
    modifiers: parts.slice(2).filter(Boolean),
    raw
  };
}

function map837SegsToInternalModel(segs) {
  const model = {
    memberId: getSubscriberId(segs),
    dos: getDOS(segs),
    renderingNpi: getRenderingNPI(segs),
    pos: getClaimPOS(segs),
    hiEntries: [],
    diagnoses: [],
    procedures: [],
    serviceLines: [],
    revenueCodes: [],
    ndcCodes: []
  };

  let currentServiceLine = null;
  for (const seg of segs) {
    if (seg.startsWith("HI*")) {
      const composites = seg.split("*").slice(1);
      for (const composite of composites) {
        const parsed = parseComposite(composite);
        if (!parsed.qualifier || !parsed.code) continue;
        model.hiEntries.push(parsed);
        if (CODE_QUALIFIERS.HI_DIAGNOSIS.has(parsed.qualifier)) model.diagnoses.push(parsed.code);
        if (CODE_QUALIFIERS.HI_PROCEDURE.has(parsed.qualifier)) model.procedures.push(parsed.code);
      }
      continue;
    }

    if (seg.startsWith("SV1*")) {
      const parts = seg.split("*");
      const proc = parseSv1Procedure(parts[1] || "");
      currentServiceLine = {
        segment: "SV1",
        procedureQualifier: proc.qualifier,
        procedureCode: proc.code,
        modifiers: proc.modifiers
      };
      model.serviceLines.push(currentServiceLine);
      continue;
    }

    if (seg.startsWith("SV2*")) {
      const parts = seg.split("*");
      const revenueCode = normalizeCode(parts[1] || "");
      const proc = parseComposite(parts[2] || "");
      currentServiceLine = {
        segment: "SV2",
        procedureQualifier: proc.qualifier,
        procedureCode: proc.code,
        revenueCode
      };
      model.serviceLines.push(currentServiceLine);
      if (revenueCode) model.revenueCodes.push(revenueCode);
      continue;
    }

    if (seg.startsWith("LIN*")) {
      const parts = seg.split("*");
      const qualifier = normalizeCode(parts[2] || "");
      const code = String(parts[3] || "").trim();
      const ndcEntry = { qualifier, code };
      model.ndcCodes.push(ndcEntry);
      if (currentServiceLine) currentServiceLine.ndc = ndcEntry;
      continue;
    }
  }

  return model;
}

export function map837ToInternalModel(x12) {
  return map837SegsToInternalModel(splitSegs(x12));
}

function runSnipValidation(segs, model, findings) {
  if (!segs.some((s) => s.startsWith("ST*837*"))) {
    findings.push({ level: "FATAL", type: "SNIP_LEVEL1", code: "SNIP_L1_MISSING_ST_837", msg: "Missing ST*837 transaction set header." });
  }
  if (!segs.some((s) => s.startsWith("CLM*"))) {
    findings.push({ level: "FATAL", type: "SNIP_LEVEL1", code: "SNIP_L1_MISSING_CLM", msg: "Missing CLM claim segment." });
  }
  if (!model.serviceLines.length) {
    findings.push({ level: "FATAL", type: "SNIP_LEVEL1", code: "SNIP_L1_MISSING_SERVICE_LINES", msg: "No service lines found (SV1/SV2)." });
  }

  const invalidHiQualifiers = unique(model.hiEntries
    .filter((entry) => !CODE_QUALIFIERS.HI_DIAGNOSIS.has(entry.qualifier) && !CODE_QUALIFIERS.HI_PROCEDURE.has(entry.qualifier))
    .map((entry) => entry.qualifier));
  if (invalidHiQualifiers.length) {
    findings.push({
      level: "WARN",
      type: "SNIP_LEVEL2",
      code: "SNIP_L2_INVALID_HI_QUALIFIER",
      msg: `Unsupported HI code qualifier(s): ${invalidHiQualifiers.join(", ")}.`
    });
  }

  const missingServiceLineQualifiers = model.serviceLines.filter((line) => !line.procedureQualifier).length;
  if (missingServiceLineQualifiers) {
    findings.push({
      level: "WARN",
      type: "SNIP_LEVEL2",
      code: "SNIP_L2_MISSING_SV_QUALIFIER",
      msg: `Missing service-line procedure qualifier on ${missingServiceLineQualifiers} line(s).`
    });
  }

  const invalidSv1Qualifiers = unique(model.serviceLines
    .filter((line) => line.segment === "SV1")
    .map((line) => line.procedureQualifier)
    .filter((qualifier) => qualifier && !CODE_QUALIFIERS.SV1_PROCEDURE.has(qualifier)));
  if (invalidSv1Qualifiers.length) {
    findings.push({
      level: "WARN",
      type: "SNIP_LEVEL2",
      code: "SNIP_L2_INVALID_SV1_QUALIFIER",
      msg: `Unsupported SV1 code qualifier(s): ${invalidSv1Qualifiers.join(", ")}.`
    });
  }

  const invalidSv2Qualifiers = unique(model.serviceLines
    .filter((line) => line.segment === "SV2")
    .map((line) => line.procedureQualifier)
    .filter((qualifier) => qualifier && !CODE_QUALIFIERS.SV2_PROCEDURE.has(qualifier)));
  if (invalidSv2Qualifiers.length) {
    findings.push({
      level: "WARN",
      type: "SNIP_LEVEL2",
      code: "SNIP_L2_INVALID_SV2_QUALIFIER",
      msg: `Unsupported SV2 code qualifier(s): ${invalidSv2Qualifiers.join(", ")}.`
    });
  }

  const invalidSvQualifiers = unique([
    ...invalidSv1Qualifiers,
    ...invalidSv2Qualifiers
  ]);
  if (invalidSvQualifiers.length) {
    findings.push({
      level: "WARN",
      type: "SNIP_LEVEL2",
      code: "SNIP_L2_INVALID_SV_QUALIFIER",
      msg: `Unsupported service-line code qualifier(s): ${invalidSvQualifiers.join(", ")}.`
    });
  }

  const invalidSv1Modifiers = [];
  for (const line of model.serviceLines) {
    if (line.segment !== "SV1") continue;
    const mods = line.modifiers || [];
    for (const mod of mods) {
      if (!CODESET_TABLES.HCPCS_CPT_MODIFIERS.has(mod)) invalidSv1Modifiers.push(mod);
    }
  }
  if (invalidSv1Modifiers.length) {
    findings.push({
      level: "WARN",
      type: "SNIP_LEVEL4_CODESET",
      code: "SNIP_L4_INVALID_CPT_HCPCS_MODIFIER",
      msg: `SV1 modifier(s) not found in CPT/HCPCS modifier table: ${unique(invalidSv1Modifiers).join(", ")}.`
    });
  }

  const invalidNdcQualifiers = unique(model.ndcCodes
    .map((entry) => entry.qualifier)
    .filter((qualifier) => qualifier && !CODE_QUALIFIERS.NDC_PRODUCT_ID.has(qualifier)));
  if (invalidNdcQualifiers.length) {
    findings.push({
      level: "WARN",
      type: "SNIP_LEVEL2",
      code: "SNIP_L2_INVALID_NDC_QUALIFIER",
      msg: `Unsupported NDC qualifier(s): ${invalidNdcQualifiers.join(", ")}.`
    });
  }

  const invalidIcd10 = unique(model.diagnoses.filter((dx) => !CODESET_TABLES.ICD10_CM.has(normalizeCode(dx))));
  if (invalidIcd10.length) {
    findings.push({
      level: "WARN",
      type: "SNIP_LEVEL4_CODESET",
      code: "SNIP_L4_INVALID_ICD10_CM",
      msg: `Diagnosis code(s) not found in ICD-10 table: ${invalidIcd10.join(", ")}.`
    });
  }

  const invalidIcd10Pcs = unique(model.procedures.filter((px) => !CODESET_TABLES.ICD10_PCS.has(normalizeCode(px))));
  if (invalidIcd10Pcs.length) {
    findings.push({
      level: "WARN",
      type: "SNIP_LEVEL4_CODESET",
      code: "SNIP_L4_INVALID_ICD10_PCS",
      msg: `Procedure code(s) not found in ICD-10-PCS table: ${invalidIcd10Pcs.join(", ")}.`
    });
  }

  const invalidRevenue = unique(model.revenueCodes.filter((rev) => !CODESET_TABLES.REVENUE.has(normalizeCode(rev))));
  if (invalidRevenue.length) {
    findings.push({
      level: "WARN",
      type: "SNIP_LEVEL4_CODESET",
      code: "SNIP_L4_INVALID_REVENUE",
      msg: `Revenue code(s) not found in Revenue code table: ${invalidRevenue.join(", ")}.`
    });
  }

  const invalidHipps = [];
  const invalidHcBucket = [];
  for (const line of model.serviceLines) {
    const qualifier = line.procedureQualifier;
    const code = normalizeCode(line.procedureCode);
    if (!qualifier || !code) continue;

    if (qualifier === "HP") {
      if (!CODESET_TABLES.HIPPS.has(code)) invalidHipps.push(code);
      continue;
    }
    if (qualifier === "HC") {
      const isCpt = CODESET_TABLES.CPT.has(code);
      const isHcpcs = CODESET_TABLES.HCPCS.has(code);
      if (!isCpt && !isHcpcs) invalidHcBucket.push(code);
    }
  }

  if (invalidHipps.length) {
    findings.push({
      level: "WARN",
      type: "SNIP_LEVEL4_CODESET",
      code: "SNIP_L4_INVALID_HIPPS",
      msg: `HIPPS code(s) not found in HIPPS table: ${unique(invalidHipps).join(", ")}.`
    });
  }
  if (invalidHcBucket.length) {
    findings.push({
      level: "WARN",
      type: "SNIP_LEVEL4_CODESET",
      code: "SNIP_L4_INVALID_CPT_HCPCS",
      msg: `Service code(s) not found in CPT/HCPCS tables: ${unique(invalidHcBucket).join(", ")}.`
    });
  }

  const invalidNdc = unique(model.ndcCodes
    .filter((entry) => entry.qualifier === "N4")
    .map((entry) => entry.code)
    .filter((code) => {
      const normalized = normalizeNdc(code);
      return normalized.length !== 11 || !CODESET_TABLES.NDC.has(normalized);
    }));
  if (invalidNdc.length) {
    findings.push({
      level: "WARN",
      type: "SNIP_LEVEL4_CODESET",
      code: "SNIP_L4_INVALID_NDC",
      msg: `NDC code(s) not found in NDC table (11-digit normalized): ${invalidNdc.join(", ")}.`
    });
  }
}

export function validate837(x12) {
  const segs = splitSegs(x12);
  const findings = [];
  const internalModel = map837SegsToInternalModel(segs);
  const memberId = internalModel.memberId;
  const dos = internalModel.dos;
  const npi = internalModel.renderingNpi;
  const pos = internalModel.pos;
  const cpts = getCPTs(segs);
  const icds = getICDs(segs);

  runSnipValidation(segs, internalModel, findings);

  if (!memberId) findings.push({ level:"FATAL", type:"837_REJECTION", code:"MISSING_SUBSCRIBER_ID", msg:"Subscriber ID missing in NM1*IL (MI qualifier not populated)." });
  if (!dos) findings.push({ level:"FATAL", type:"837_REJECTION", code:"MISSING_DOS", msg:"Missing Date of Service (DTP*472*D8)." });
  else if (!isYYYYMMDD(dos)) findings.push({ level:"FATAL", type:"837_REJECTION", code:"INVALID_DOS", msg:`Invalid DOS format/value: ${dos}` });
  if (!npi) findings.push({ level:"FATAL", type:"837_REJECTION", code:"MISSING_RENDERING_NPI", msg:"Rendering provider NPI missing in NM1*82*...*XX*NPI." });

  if (!pos || !VALID_POS.has(pos)) findings.push({ level:"WARN", type:"837_QUALITY", code:"INVALID_POS", msg:`Invalid or non-standard POS "${pos}".` });

  const nonEligible = cpts.filter((c) => NON_RISK_ELIGIBLE_CPTS.has(c));
  if (nonEligible.length) findings.push({ level:"RA_BLOCK", type:"RISK_ELIGIBILITY", code:"NON_RISK_ELIGIBLE_CPT", msg:`Non-risk-eligible CPT(s): ${nonEligible.join(", ")}.` });

  if (cpts.length && cpts.every(isPharmacyLikeCPT)) findings.push({ level:"RA_BLOCK", type:"RISK_ELIGIBILITY", code:"PHARMACY_ONLY_SERVICES", msg:"All service lines appear pharmacy/drug-only (J-code bucket)." });

  const ihaHit = cpts.some((c) => IHA_CPTS.has(c));
  if (ihaHit && icds.length) findings.push({ level:"WARN", type:"PROGRAM_RULE", code:"IHA_DIAGNOSES_PRESENT", msg:"IHA/AWV visit includes diagnosis codes. Demo rule: remove HI diagnosis segment(s)." });

  const invalid = icds.filter((dx) => !isValidICD10Demo(dx));
  if (invalid.length) findings.push({ level:"WARN", type:"DIAGNOSIS_QUALITY", code:"INVALID_DIAGNOSIS", msg:`Diagnosis code(s) look invalid (demo validator): ${invalid.join(", ")}.` });

  const hasAmputationCPT = cpts.some((c) => CPT_AMPUTATION.has(c));
  const hasTransplantCPT = cpts.some((c) => CPT_TRANSPLANT.has(c));
  const hasZ89 = icds.some((dx) => dx.startsWith("Z89"));
  const hasZ94 = icds.some((dx) => dx.startsWith("Z94"));
  const hasN186 = icds.includes("N18.6");
  const hasZ992 = icds.includes("Z99.2");

  if (hasAmputationCPT && !hasZ89) findings.push({ level:"SIGNAL", type:"PROSPECTIVE_GAP", code:"AMP_STATUS_MISSING_Z89", msg:"Amputation procedure present but Z89.* status not found." });
  if (hasTransplantCPT && !hasZ94) findings.push({ level:"SIGNAL", type:"PROSPECTIVE_GAP", code:"TX_STATUS_MISSING_Z94", msg:"Transplant procedure present but Z94.* status not found." });
  if (hasN186 && !hasZ992) findings.push({ level:"SIGNAL", type:"PROSPECTIVE_GAP", code:"ESRD_DEPENDENCE_MISSING_Z992", msg:"ESRD (N18.6) found but Z99.2 dialysis dependence not found." });

  return { segs, findings, memberId, internalModel };
}

export function applyRepairs(x12) {
  let segs = splitSegs(x12);
  const repairs = [];

  const pos = getClaimPOS(segs);
  if (!pos || !VALID_POS.has(pos)) {
    const replacement = POS_FIX_MAP[pos] || POS_FIX_MAP[""];
    const idx = segs.findIndex((s) => s.startsWith("CLM*"));
    if (idx >= 0) {
      const before = segs[idx];
      const parts = before.split("*");
      const clm05 = parts[5] || "";
      const rest = clm05.includes(":") ? clm05.split(":").slice(1).join(":") : "B:1";
      parts[5] = `${replacement}:${rest}`;
      segs[idx] = parts.join("*");
      repairs.push({ type:"FIX_POS", before, after:segs[idx], count:1, reason:`Mapped POS "${pos}" → "${replacement}".` });
    }
  }

  for (let i = 0; i < segs.length; i++) {
    if (segs[i].startsWith("NM1*82*")) {
      const before = segs[i];
      const p = before.split("*");
      const last = p[3] || "";
      const first = p[4] || "";
      const fixedLast = titleCase(last);
      const fixedFirst = titleCase(first);
      if ((last && fixedLast !== last) || (first && fixedFirst !== first)) {
        p[3] = fixedLast;
        p[4] = fixedFirst;
        segs[i] = p.join("*");
        repairs.push({ type:"NORMALIZE_PROVIDER_NAME", before, after:segs[i], count:1, reason:"Normalized provider name casing." });
      }
    }
  }

  const cpts = getCPTs(segs);
  const ihaHit = cpts.some((c) => IHA_CPTS.has(c));
  if (ihaHit) {
    const hiCount = segs.filter((s) => s.startsWith("HI*")).length;
    if (hiCount) {
      const beforeSample = segs.find((s) => s.startsWith("HI*")) || "";
      segs = segs.filter((s) => !s.startsWith("HI*"));
      repairs.push({ type:"REMOVE_DX_FROM_IHA", before:beforeSample, after:"(HI segment removed)", count:hiCount, reason:"Demo rule: remove diagnosis codes from IHA/AWV claim." });
    }
  }

  return { repaired: joinSegs(segs), repairs };
}

export function summarize(repairs, findings) {
  const repairsByType = {};
  let repairsTotal = 0;
  for (const r of repairs) {
    repairsByType[r.type] = (repairsByType[r.type] || 0) + (r.count || 1);
    repairsTotal += (r.count || 1);
  }
  const fatal = findings.filter((f) => f.level === "FATAL").length;
  const raBlocks = findings.filter((f) => f.level === "RA_BLOCK").length;
  const signals = findings.filter((f) => f.level === "SIGNAL").length;
  const warns = findings.filter((f) => f.level === "WARN").length;
  return { repairsTotal, repairsByType, fatal, raBlocks, signals, warns };
}

export function computeStatus(findings) {
  const hasFatal = findings.some((f) => f.level === "FATAL");
  const hasRABlock = findings.some((f) => f.level === "RA_BLOCK");
  if (hasFatal) return "FAIL";
  if (hasRABlock) return "RA_BLOCKED";
  return "PASS";
}
