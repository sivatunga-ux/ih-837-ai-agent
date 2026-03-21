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
      if (proc.startsWith("HC:")) out.push(proc.slice(3).trim());
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

export function validate837(x12) {
  const segs = splitSegs(x12);
  const findings = [];

  const memberId = getSubscriberId(segs);
  const dos = getDOS(segs);
  const npi = getRenderingNPI(segs);
  const pos = getClaimPOS(segs);
  const cpts = getCPTs(segs);
  const icds = getICDs(segs);

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

  return { segs, findings, memberId };
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
