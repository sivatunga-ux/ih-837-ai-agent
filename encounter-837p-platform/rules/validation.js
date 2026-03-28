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

function getMemberIdFromSegments(segments) {
  for (const segment of segments) {
    if (!segment.startsWith("NM1*IL*")) continue;
    const parts = segment.split("*");
    const miIndex = parts.findIndex((part) => part === "MI");
    if (miIndex >= 0 && parts[miIndex + 1]) {
      return parts[miIndex + 1];
    }
  }
  return null;
}

export function computeStatus(findings = []) {
  if (findings.some((finding) => finding.level === FINDING_LEVEL.RA_BLOCK)) {
    return "RA_BLOCKED";
  }
  if (findings.some((finding) => finding.level === FINDING_LEVEL.FATAL)) {
    return "FAIL";
  }
  if (findings.some((finding) => finding.level === FINDING_LEVEL.WARN || finding.level === FINDING_LEVEL.SIGNAL)) {
    return "WARN";
  }
  return "PASS";
}

export function summarize(findings = []) {
  const fatal = findings.filter((finding) => finding.level === FINDING_LEVEL.FATAL).length;
  const raBlocks = findings.filter((finding) => finding.level === FINDING_LEVEL.RA_BLOCK).length;
  const warns = findings.filter((finding) => finding.level === FINDING_LEVEL.WARN || finding.level === FINDING_LEVEL.SIGNAL).length;

  return {
    status: computeStatus(findings),
    fatal,
    raBlocks,
    warns,
  };
}

export function validate837(rawClaim) {
  const segments = splitSegments(rawClaim);
  const findings = [];
  const memberId = getMemberIdFromSegments(segments);

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

  return { memberId, findings };
}
