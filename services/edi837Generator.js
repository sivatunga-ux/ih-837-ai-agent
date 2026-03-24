/**
 * edi837Generator.js — Generates compliant 837 EDI output (Professional & Institutional)
 * from a full claim record.
 *
 * Supports 837P (005010X222A1) and 837I (005010X223A2).
 * Element separator: *   Sub-element separator: :   Segment terminator: ~
 */

import { validateClaimForConversion } from "./claimMapper.js";

const ELEMENT_SEP = "*";
const SUB_SEP = ":";
const SEG_TERM = "~";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function padRight(str, len) {
  const s = String(str ?? "");
  if (s.length >= len) return s.slice(0, len);
  return s + " ".repeat(len - s.length);
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  const clean = String(dateStr).replace(/[-/]/g, "");
  if (/^\d{8}$/.test(clean)) return clean;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return clean;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function nowDateCompact() {
  const d = new Date();
  return formatDate(d.toISOString().slice(0, 10));
}

function nowTimeCompact() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0");
}

function seg(...elements) {
  let line = elements.join(ELEMENT_SEP);
  line = line.replace(/\*+$/, "");
  return line + SEG_TERM;
}

function val(v, fallback) {
  if (v !== undefined && v !== null && v !== "") return String(v);
  if (fallback !== undefined) return String(fallback);
  return "";
}

function isInstitutional(claimType) {
  const t = String(claimType).toUpperCase();
  return t === "837I" || t === "I" || t === "INSTITUTIONAL";
}

// ---------------------------------------------------------------------------
// ISA Builder — exactly 106 characters
// ---------------------------------------------------------------------------

export function buildISA(config) {
  const isa = [
    "ISA",
    padRight(val(config.authInfoQualifier, "00"), 2),
    padRight(val(config.authInfo, ""), 10),
    padRight(val(config.securityInfoQualifier, "00"), 2),
    padRight(val(config.securityInfo, ""), 10),
    padRight(val(config.senderIdQualifier, "ZZ"), 2),
    padRight(val(config.senderId, "SENDER_ID"), 15),
    padRight(val(config.receiverIdQualifier, "ZZ"), 2),
    padRight(val(config.receiverId, "RECEIVER_ID"), 15),
    val(config.interchangeDate, nowDateCompact().slice(2)),  // YYMMDD
    val(config.interchangeTime, nowTimeCompact()),
    "^",
    "00501",
    padRight(val(config.controlNumber, "000000001"), 9).replace(/ /g, "0"),
    val(config.ackRequested, "0"),
    val(config.usageIndicator, "T"),
    SUB_SEP
  ];
  return isa.join(ELEMENT_SEP) + SEG_TERM;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  senderIdQualifier: "ZZ",
  senderId: "SENDER_ID",
  receiverIdQualifier: "ZZ",
  receiverId: "RECEIVER_ID",
  controlNumber: "000000001",
  usageIndicator: "T",
  submitterName: "INVENT HEALTH",
  submitterId: "INVENTHLTH",
  submitterPhone: "5555551234"
};

export function generate837(fullClaim, config) {
  const cfg = { ...DEFAULT_CONFIG, ...(config || {}) };
  const errors = [];

  const validation = validateClaimForConversion(fullClaim);
  if (!validation.valid) {
    return { edi: "", segments: 0, errors: validation.errors };
  }

  const inst = isInstitutional(fullClaim.claimType);
  const implRef = inst ? "005010X223A2" : "005010X222A1";
  const gsVersion = implRef;

  const sub = fullClaim.subscriber || {};
  const bp = fullClaim.billingProvider || {};
  const rp = fullClaim.renderingProvider || {};
  const refProv = fullClaim.referringProvider || null;
  const attProv = fullClaim.attendingProvider || null;
  const payer = fullClaim.payer || {};
  const dx = fullClaim.diagnoses || {};
  const lines = fullClaim.serviceLines || [];

  const ctlNum = padRight(val(cfg.controlNumber, "000000001"), 9).replace(/ /g, "0");
  const today = nowDateCompact();
  const time = nowTimeCompact();

  const segments = [];

  // ── ISA ──
  segments.push(buildISA(cfg));

  // ── GS ──
  segments.push(seg(
    "GS", "HC",
    val(cfg.senderId, "SENDER_ID"),
    val(cfg.receiverId, "RECEIVER_ID"),
    today,
    time,
    ctlNum,
    "X",
    gsVersion
  ));

  // Track segments inside the transaction set (ST through SE)
  const txSegments = [];

  // ── ST ──
  txSegments.push(seg("ST", "837", ctlNum, implRef));

  // ── BHT ──
  txSegments.push(seg("BHT", "0019", "00", ctlNum, today, time, "CH"));

  // ── 1000A Submitter ──
  txSegments.push(seg(
    "NM1", "41", "2",
    val(cfg.submitterName, "INVENT HEALTH"),
    "", "", "", "",
    "46",
    val(cfg.submitterId, "INVENTHLTH")
  ));
  txSegments.push(seg(
    "PER", "IC",
    val(cfg.submitterContactName, cfg.submitterName),
    "TE",
    val(cfg.submitterPhone, "5555551234")
  ));

  // ── 1000B Receiver ──
  txSegments.push(seg(
    "NM1", "40", "2",
    val(cfg.receiverName, cfg.receiverId),
    "", "", "", "",
    "46",
    val(cfg.receiverId, "RECEIVER_ID")
  ));

  // ── 2000A Billing Provider HL ──
  txSegments.push(seg("HL", "1", "", "20", "1"));

  // PRV (billing provider taxonomy)
  if (bp.taxonomyCode) {
    txSegments.push(seg("PRV", "BI", "PXC", bp.taxonomyCode));
  }

  // ── 2010AA Billing Provider Name ──
  const bpEntityType = val(bp.entityType, "2");
  const bpName = bpEntityType === "2"
    ? val(bp.organizationName, bp.lastName)
    : val(bp.lastName, "");
  txSegments.push(seg(
    "NM1", "85", bpEntityType,
    bpName,
    bpEntityType === "1" ? val(bp.firstName, "") : "",
    bpEntityType === "1" ? val(bp.middleName, "") : "",
    "", "",
    val(bp.idQualifier, "XX"),
    val(bp.npi, "")
  ));

  // N3 — billing provider address
  txSegments.push(seg("N3", val(bp.address1, ""), val(bp.address2, "")));

  // N4 — billing provider city/state/zip
  txSegments.push(seg("N4", val(bp.city, ""), val(bp.state, ""), val(bp.zip, "")));

  // REF — billing provider tax ID
  if (bp.taxId) {
    txSegments.push(seg("REF", val(bp.taxIdQualifier, "EI"), bp.taxId));
  }

  // ── 2000B Subscriber HL ──
  txSegments.push(seg("HL", "2", "1", "22", "0"));

  // SBR
  txSegments.push(seg(
    "SBR",
    val(sub.payerResponsibility, "P"),
    val(sub.relationshipCode, "18"),
    val(sub.groupNumber, ""),
    "", "", "", "", "",
    val(sub.claimFilingCode, "")
  ));

  // ── 2010BA Subscriber Name ──
  txSegments.push(seg(
    "NM1", "IL", "1",
    val(sub.lastName, ""),
    val(sub.firstName, ""),
    val(sub.middleName, ""),
    "", "",
    val(sub.idQualifier, "MI"),
    val(sub.memberId, "")
  ));

  // N3 — subscriber address
  if (sub.address1) {
    txSegments.push(seg("N3", val(sub.address1, ""), val(sub.address2, "")));
  }

  // N4 — subscriber city/state/zip
  if (sub.city || sub.state || sub.zip) {
    txSegments.push(seg("N4", val(sub.city, ""), val(sub.state, ""), val(sub.zip, "")));
  }

  // DMG — subscriber demographics
  if (sub.dateOfBirth || sub.gender) {
    txSegments.push(seg("DMG", "D8", formatDate(sub.dateOfBirth), val(sub.gender, "")));
  }

  // ── 2010BB Payer Name ──
  txSegments.push(seg(
    "NM1", "PR", "2",
    val(payer.name, ""),
    "", "", "", "",
    val(payer.idQualifier, "PI"),
    val(payer.payerId, "")
  ));

  if (payer.address1) {
    txSegments.push(seg("N3", val(payer.address1, ""), val(payer.address2, "")));
  }
  if (payer.city || payer.state || payer.zip) {
    txSegments.push(seg("N4", val(payer.city, ""), val(payer.state, ""), val(payer.zip, "")));
  }

  // ── 2300 Claim Information ──
  if (inst) {
    txSegments.push(seg(
      "CLM",
      val(fullClaim.patientControlNumber, ""),
      val(fullClaim.totalChargeAmount, "0"),
      "", "",
      `${val(fullClaim.facilityCode, "")}${SUB_SEP}${val(fullClaim.facilityCodeQualifier, "A")}${SUB_SEP}${val(fullClaim.frequencyCode, "1")}`,
      "",
      val(fullClaim.assignmentCode, "A"),
      val(fullClaim.benefitsAssignment, "Y"),
      val(fullClaim.releaseOfInfo, "I")
    ));
  } else {
    txSegments.push(seg(
      "CLM",
      val(fullClaim.patientControlNumber, ""),
      val(fullClaim.totalChargeAmount, "0"),
      "", "",
      `${val(fullClaim.facilityCode, "")}${SUB_SEP}${val(fullClaim.facilityCodeQualifier, "B")}${SUB_SEP}${val(fullClaim.frequencyCode, "1")}`,
      val(fullClaim.providerSignatureIndicator, "Y"),
      val(fullClaim.assignmentCode, "A"),
      val(fullClaim.benefitsAssignment, "Y"),
      val(fullClaim.releaseOfInfo, "I")
    ));
  }

  // ── DTP — Dates ──
  if (inst) {
    if (fullClaim.statementFromDate) {
      const toDate = fullClaim.statementToDate || fullClaim.statementFromDate;
      txSegments.push(seg("DTP", "434", "RD8", `${formatDate(fullClaim.statementFromDate)}-${formatDate(toDate)}`));
    }
    if (fullClaim.admissionDate) {
      txSegments.push(seg("DTP", "435", "DT", formatDate(fullClaim.admissionDate)));
    }
    if (fullClaim.dischargeDate) {
      txSegments.push(seg("DTP", "096", "DT", formatDate(fullClaim.dischargeDate)));
    }
  } else {
    if (fullClaim.serviceDateFrom) {
      txSegments.push(seg("DTP", "472", "D8", formatDate(fullClaim.serviceDateFrom)));
    }
  }

  // ── REF — References ──
  if (fullClaim.priorAuthNumber) {
    txSegments.push(seg("REF", "G1", fullClaim.priorAuthNumber));
  }
  if (fullClaim.referralNumber) {
    txSegments.push(seg("REF", "9F", fullClaim.referralNumber));
  }
  if (fullClaim.medicalRecordNumber) {
    txSegments.push(seg("REF", "EA", fullClaim.medicalRecordNumber));
  }

  // ── CL1 — Institutional only ──
  if (inst) {
    txSegments.push(seg(
      "CL1",
      val(fullClaim.admissionTypeCode, ""),
      val(fullClaim.admissionSourceCode, ""),
      val(fullClaim.patientStatusCode, "01")
    ));
  }

  // ── HI — Diagnosis codes ──
  if (dx.principalCode) {
    const hiParts = [`ABK${SUB_SEP}${dx.principalCode}`];
    const others = dx.otherCodes || [];
    for (let i = 0; i < others.length && i < 11; i++) {
      hiParts.push(`ABF${SUB_SEP}${others[i]}`);
    }
    txSegments.push(seg("HI", ...hiParts));
  }

  // HI — admitting diagnosis (837I only)
  if (inst && dx.admittingDiagnosis) {
    txSegments.push(seg("HI", `ABJ${SUB_SEP}${dx.admittingDiagnosis}`));
  }

  // HI — external cause codes (837I only)
  if (inst && dx.externalCauseCodes && dx.externalCauseCodes.length > 0) {
    const eciParts = dx.externalCauseCodes.map(c => `ABN${SUB_SEP}${c}`);
    txSegments.push(seg("HI", ...eciParts));
  }

  // HI — principal procedure (837I only)
  if (inst && dx.principalProcedure) {
    const procDate = dx.principalProcedureDate ? formatDate(dx.principalProcedureDate) : "";
    txSegments.push(seg("HI", `BBR${SUB_SEP}${dx.principalProcedure}${SUB_SEP}${SUB_SEP}${procDate}`));
  }

  // ── 2310B/D Rendering Provider ──
  if (rp.npi) {
    const rpEntityType = val(rp.entityType, "1");
    txSegments.push(seg(
      "NM1", "82", rpEntityType,
      val(rp.lastName, ""),
      rpEntityType === "1" ? val(rp.firstName, "") : "",
      rpEntityType === "1" ? val(rp.middleName, "") : "",
      "", "",
      val(rp.idQualifier, "XX"),
      rp.npi
    ));
    if (rp.taxonomyCode) {
      txSegments.push(seg("PRV", "PE", "PXC", rp.taxonomyCode));
    }
  }

  // ── 2310A Referring Provider (if present) ──
  if (refProv && refProv.npi) {
    txSegments.push(seg(
      "NM1", "DN", "1",
      val(refProv.lastName, ""),
      val(refProv.firstName, ""),
      "", "", "",
      val(refProv.idQualifier, "XX"),
      refProv.npi
    ));
  }

  // ── 2310A Attending Provider (837I only, if present) ──
  if (inst && attProv && attProv.npi) {
    txSegments.push(seg(
      "NM1", "71", "1",
      val(attProv.lastName, ""),
      val(attProv.firstName, ""),
      val(attProv.middleName, ""),
      "", "",
      val(attProv.idQualifier, "XX"),
      attProv.npi
    ));
    if (attProv.taxonomyCode) {
      txSegments.push(seg("PRV", "AT", "PXC", attProv.taxonomyCode));
    }
  }

  // ── 2400 Service Lines ──
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    if (inst) {
      // SV2 — institutional service line
      const procComposite = line.procedureCode
        ? [val(line.procedureQualifier, "HC"), line.procedureCode,
           val(line.modifier1, ""), val(line.modifier2, ""),
           val(line.modifier3, ""), val(line.modifier4, "")].join(SUB_SEP).replace(/:+$/, "")
        : "";

      txSegments.push(seg(
        "SV2",
        val(line.revenueCode, ""),
        procComposite,
        val(line.chargeAmount, "0"),
        val(line.unitMeasure, "UN"),
        val(line.unitCount, "1")
      ));
    } else {
      // LX — line number (837P)
      txSegments.push(seg("LX", String(lineNum)));

      // SV1 — professional service line
      const procComposite = [
        val(line.procedureQualifier, "HC"),
        val(line.procedureCode, ""),
        val(line.modifier1, ""),
        val(line.modifier2, ""),
        val(line.modifier3, ""),
        val(line.modifier4, "")
      ].join(SUB_SEP).replace(/:+$/, "");

      txSegments.push(seg(
        "SV1",
        procComposite,
        val(line.chargeAmount, "0"),
        val(line.unitMeasure, "UN"),
        val(line.unitCount, "1"),
        "",
        "",
        val(line.diagnosisPointer, "1")
      ));
    }

    // DTP — line-level service date
    const lineDate = line.serviceDateFrom || fullClaim.serviceDateFrom || "";
    if (lineDate) {
      const lineDateTo = line.serviceDateTo || lineDate;
      if (lineDateTo !== lineDate) {
        txSegments.push(seg("DTP", "472", "RD8", `${formatDate(lineDate)}-${formatDate(lineDateTo)}`));
      } else {
        txSegments.push(seg("DTP", "472", "D8", formatDate(lineDate)));
      }
    }
  });

  // ── SE — segment count (includes ST and SE themselves) ──
  const seCount = txSegments.length + 1; // +1 for the SE segment itself
  txSegments.push(seg("SE", String(seCount), ctlNum));

  // ── GE ──
  const geSegment = seg("GE", "1", ctlNum);

  // ── IEA ──
  const ieaSegment = seg("IEA", "1", ctlNum);

  // Assemble all segments
  const allSegments = [
    ...segments,
    ...txSegments,
    geSegment,
    ieaSegment
  ];

  const totalSegmentCount = allSegments.length;
  const edi = allSegments.join("\n");

  return { edi, segments: totalSegmentCount, errors };
}
