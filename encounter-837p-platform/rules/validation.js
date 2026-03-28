import { FINDING_LEVEL } from "../data/models.js";

function splitSegments(text) {
  return String(text || "")
    .split("~")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function hasRiskEligibleCpt(segment) {
  if (!segment.startsWith("SV1*")) return false;
  const normalized = segment.replace(/:/g, "*");
  return /\*992\d\d\*/.test(normalized);
}

function hasDiagnosis(segments, dxCode) {
  return segments.some(
    (segment) => segment.startsWith("HI*") && segment.includes(dxCode),
  );
}

export function validate837(rawClaim) {
  const segments = splitSegments(rawClaim);
  const findings = [];

  if (!segments.some((segment) => segment.startsWith("ST*837"))) {
    findings.push({
      level: FINDING_LEVEL.FATAL,
      code: "MISSING_ST_837",
      type: "format",
      msg: "Missing ST*837 transaction header.",
    });
  }

  if (!segments.some(hasRiskEligibleCpt)) {
    findings.push({
      level: FINDING_LEVEL.RA_BLOCK,
      code: "NON_RISK_ELIGIBLE_CPT",
      type: "eligibility",
      msg: "No risk-eligible E/M CPT detected.",
    });
  }

  const hasEsrd = hasDiagnosis(segments, "N186");
  const hasDialysis = hasDiagnosis(segments, "Z992");
  if (hasEsrd && !hasDialysis) {
    findings.push({
      level: FINDING_LEVEL.SIGNAL,
      code: "POTENTIAL_DIALYSIS_GAP",
      type: "prospective",
      msg: "ESRD present without dialysis dependence status.",
    });
  }

  return { findings };
}
