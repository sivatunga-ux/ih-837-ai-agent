/**
 * claimMapper.js — Bidirectional mapping between normalized claims DB fields
 * and 837 EDI segment/element positions.
 *
 * Supports both 837P (Professional, 005010X222A1) and
 * 837I (Institutional, 005010X223A2).
 */

// ---------------------------------------------------------------------------
// 837P  —  Professional Field Map
// ---------------------------------------------------------------------------
export const FIELD_MAP_837P = {
  claim: [
    { dbField: "patientControlNumber", ediSegment: "CLM", ediElement: "CLM01", direction: "both" },
    { dbField: "totalChargeAmount", ediSegment: "CLM", ediElement: "CLM02", direction: "both" },
    { dbField: "facilityCode", ediSegment: "CLM", ediElement: "CLM05-1", direction: "both" },
    { dbField: "facilityCodeQualifier", ediSegment: "CLM", ediElement: "CLM05-2", direction: "both", default: "B" },
    { dbField: "frequencyCode", ediSegment: "CLM", ediElement: "CLM05-3", direction: "both", default: "1" },
    { dbField: "providerSignatureIndicator", ediSegment: "CLM", ediElement: "CLM06", direction: "both", default: "Y" },
    { dbField: "assignmentCode", ediSegment: "CLM", ediElement: "CLM07", direction: "both", default: "A" },
    { dbField: "benefitsAssignment", ediSegment: "CLM", ediElement: "CLM08", direction: "both", default: "Y" },
    { dbField: "releaseOfInfo", ediSegment: "CLM", ediElement: "CLM09", direction: "both", default: "I" },
    { dbField: "serviceDateFrom", ediSegment: "DTP", ediElement: "DTP03", qualifier: "472", direction: "both" },
    { dbField: "priorAuthNumber", ediSegment: "REF", ediElement: "REF02", qualifier: "G1", direction: "both" },
    { dbField: "referralNumber", ediSegment: "REF", ediElement: "REF02", qualifier: "9F", direction: "both" },
    { dbField: "medicalRecordNumber", ediSegment: "REF", ediElement: "REF02", qualifier: "EA", direction: "both" }
  ],

  subscriber: [
    { dbField: "memberId", ediSegment: "NM1*IL", ediElement: "NM109", direction: "both" },
    { dbField: "lastName", ediSegment: "NM1*IL", ediElement: "NM103", direction: "both" },
    { dbField: "firstName", ediSegment: "NM1*IL", ediElement: "NM104", direction: "both" },
    { dbField: "middleName", ediSegment: "NM1*IL", ediElement: "NM105", direction: "both" },
    { dbField: "idQualifier", ediSegment: "NM1*IL", ediElement: "NM108", direction: "both", default: "MI" },
    { dbField: "dateOfBirth", ediSegment: "DMG", ediElement: "DMG02", direction: "both" },
    { dbField: "gender", ediSegment: "DMG", ediElement: "DMG03", direction: "both" },
    { dbField: "address1", ediSegment: "N3", ediElement: "N301", direction: "both" },
    { dbField: "address2", ediSegment: "N3", ediElement: "N302", direction: "both" },
    { dbField: "city", ediSegment: "N4", ediElement: "N401", direction: "both" },
    { dbField: "state", ediSegment: "N4", ediElement: "N402", direction: "both" },
    { dbField: "zip", ediSegment: "N4", ediElement: "N403", direction: "both" },
    { dbField: "payerResponsibility", ediSegment: "SBR", ediElement: "SBR01", direction: "both", default: "P" },
    { dbField: "relationshipCode", ediSegment: "SBR", ediElement: "SBR02", direction: "both", default: "18" },
    { dbField: "groupNumber", ediSegment: "SBR", ediElement: "SBR03", direction: "both" },
    { dbField: "claimFilingCode", ediSegment: "SBR", ediElement: "SBR09", direction: "both" }
  ],

  billingProvider: [
    { dbField: "npi", ediSegment: "NM1*85", ediElement: "NM109", direction: "both" },
    { dbField: "entityType", ediSegment: "NM1*85", ediElement: "NM102", direction: "both", default: "2" },
    { dbField: "organizationName", ediSegment: "NM1*85", ediElement: "NM103", direction: "both" },
    { dbField: "lastName", ediSegment: "NM1*85", ediElement: "NM103", direction: "both" },
    { dbField: "firstName", ediSegment: "NM1*85", ediElement: "NM104", direction: "both" },
    { dbField: "idQualifier", ediSegment: "NM1*85", ediElement: "NM108", direction: "both", default: "XX" },
    { dbField: "taxonomyCode", ediSegment: "PRV", ediElement: "PRV03", direction: "both" },
    { dbField: "address1", ediSegment: "N3", ediElement: "N301", direction: "both" },
    { dbField: "address2", ediSegment: "N3", ediElement: "N302", direction: "both" },
    { dbField: "city", ediSegment: "N4", ediElement: "N401", direction: "both" },
    { dbField: "state", ediSegment: "N4", ediElement: "N402", direction: "both" },
    { dbField: "zip", ediSegment: "N4", ediElement: "N403", direction: "both" },
    { dbField: "taxId", ediSegment: "REF", ediElement: "REF02", qualifier: "EI", direction: "both" }
  ],

  renderingProvider: [
    { dbField: "npi", ediSegment: "NM1*82", ediElement: "NM109", direction: "both" },
    { dbField: "entityType", ediSegment: "NM1*82", ediElement: "NM102", direction: "both", default: "1" },
    { dbField: "lastName", ediSegment: "NM1*82", ediElement: "NM103", direction: "both" },
    { dbField: "firstName", ediSegment: "NM1*82", ediElement: "NM104", direction: "both" },
    { dbField: "middleName", ediSegment: "NM1*82", ediElement: "NM105", direction: "both" },
    { dbField: "idQualifier", ediSegment: "NM1*82", ediElement: "NM108", direction: "both", default: "XX" },
    { dbField: "taxonomyCode", ediSegment: "PRV", ediElement: "PRV03", direction: "both" }
  ],

  referringProvider: [
    { dbField: "npi", ediSegment: "NM1*DN", ediElement: "NM109", direction: "both" },
    { dbField: "entityType", ediSegment: "NM1*DN", ediElement: "NM102", direction: "both", default: "1" },
    { dbField: "lastName", ediSegment: "NM1*DN", ediElement: "NM103", direction: "both" },
    { dbField: "firstName", ediSegment: "NM1*DN", ediElement: "NM104", direction: "both" },
    { dbField: "idQualifier", ediSegment: "NM1*DN", ediElement: "NM108", direction: "both", default: "XX" }
  ],

  payer: [
    { dbField: "payerId", ediSegment: "NM1*PR", ediElement: "NM109", direction: "both" },
    { dbField: "name", ediSegment: "NM1*PR", ediElement: "NM103", direction: "both" },
    { dbField: "idQualifier", ediSegment: "NM1*PR", ediElement: "NM108", direction: "both", default: "PI" },
    { dbField: "address1", ediSegment: "N3", ediElement: "N301", direction: "both" },
    { dbField: "city", ediSegment: "N4", ediElement: "N401", direction: "both" },
    { dbField: "state", ediSegment: "N4", ediElement: "N402", direction: "both" },
    { dbField: "zip", ediSegment: "N4", ediElement: "N403", direction: "both" }
  ],

  diagnoses: [
    { dbField: "principalCode", ediSegment: "HI", ediElement: "HI01-2", qualifier: "ABK", direction: "both" },
    { dbField: "otherCodes", ediSegment: "HI", ediElement: "HI02-2+", qualifier: "ABF", direction: "both" }
  ],

  serviceLines: [
    { dbField: "lineNumber", ediSegment: "LX", ediElement: "LX01", direction: "both" },
    { dbField: "procedureCode", ediSegment: "SV1", ediElement: "SV101-2", direction: "both" },
    { dbField: "procedureQualifier", ediSegment: "SV1", ediElement: "SV101-1", direction: "both", default: "HC" },
    { dbField: "modifier1", ediSegment: "SV1", ediElement: "SV101-3", direction: "both" },
    { dbField: "modifier2", ediSegment: "SV1", ediElement: "SV101-4", direction: "both" },
    { dbField: "modifier3", ediSegment: "SV1", ediElement: "SV101-5", direction: "both" },
    { dbField: "modifier4", ediSegment: "SV1", ediElement: "SV101-6", direction: "both" },
    { dbField: "chargeAmount", ediSegment: "SV1", ediElement: "SV102", direction: "both" },
    { dbField: "unitMeasure", ediSegment: "SV1", ediElement: "SV103", direction: "both", default: "UN" },
    { dbField: "unitCount", ediSegment: "SV1", ediElement: "SV104", direction: "both" },
    { dbField: "diagnosisPointer", ediSegment: "SV1", ediElement: "SV107", direction: "both" },
    { dbField: "serviceDateFrom", ediSegment: "DTP", ediElement: "DTP03", qualifier: "472", direction: "both" },
    { dbField: "serviceDateTo", ediSegment: "DTP", ediElement: "DTP03", qualifier: "472", direction: "both" }
  ]
};

// ---------------------------------------------------------------------------
// 837I  —  Institutional Field Map
// ---------------------------------------------------------------------------
export const FIELD_MAP_837I = {
  claim: [
    { dbField: "patientControlNumber", ediSegment: "CLM", ediElement: "CLM01", direction: "both" },
    { dbField: "totalChargeAmount", ediSegment: "CLM", ediElement: "CLM02", direction: "both" },
    { dbField: "facilityCode", ediSegment: "CLM", ediElement: "CLM05-1", direction: "both" },
    { dbField: "facilityCodeQualifier", ediSegment: "CLM", ediElement: "CLM05-2", direction: "both", default: "A" },
    { dbField: "frequencyCode", ediSegment: "CLM", ediElement: "CLM05-3", direction: "both", default: "1" },
    // 837I has no CLM06 (providerSignatureIndicator)
    { dbField: "assignmentCode", ediSegment: "CLM", ediElement: "CLM07", direction: "both", default: "A" },
    { dbField: "benefitsAssignment", ediSegment: "CLM", ediElement: "CLM08", direction: "both", default: "Y" },
    { dbField: "releaseOfInfo", ediSegment: "CLM", ediElement: "CLM09", direction: "both", default: "I" },
    { dbField: "statementFromDate", ediSegment: "DTP", ediElement: "DTP03", qualifier: "434", direction: "both" },
    { dbField: "admissionDate", ediSegment: "DTP", ediElement: "DTP03", qualifier: "435", direction: "both" },
    { dbField: "dischargeDate", ediSegment: "DTP", ediElement: "DTP03", qualifier: "096", direction: "both" },
    { dbField: "priorAuthNumber", ediSegment: "REF", ediElement: "REF02", qualifier: "G1", direction: "both" },
    { dbField: "referralNumber", ediSegment: "REF", ediElement: "REF02", qualifier: "9F", direction: "both" },
    { dbField: "medicalRecordNumber", ediSegment: "REF", ediElement: "REF02", qualifier: "EA", direction: "both" },
    { dbField: "admissionTypeCode", ediSegment: "CL1", ediElement: "CL101", direction: "both" },
    { dbField: "admissionSourceCode", ediSegment: "CL1", ediElement: "CL102", direction: "both" },
    { dbField: "patientStatusCode", ediSegment: "CL1", ediElement: "CL103", direction: "both" }
  ],

  subscriber: [
    { dbField: "memberId", ediSegment: "NM1*IL", ediElement: "NM109", direction: "both" },
    { dbField: "lastName", ediSegment: "NM1*IL", ediElement: "NM103", direction: "both" },
    { dbField: "firstName", ediSegment: "NM1*IL", ediElement: "NM104", direction: "both" },
    { dbField: "middleName", ediSegment: "NM1*IL", ediElement: "NM105", direction: "both" },
    { dbField: "idQualifier", ediSegment: "NM1*IL", ediElement: "NM108", direction: "both", default: "MI" },
    { dbField: "dateOfBirth", ediSegment: "DMG", ediElement: "DMG02", direction: "both" },
    { dbField: "gender", ediSegment: "DMG", ediElement: "DMG03", direction: "both" },
    { dbField: "address1", ediSegment: "N3", ediElement: "N301", direction: "both" },
    { dbField: "address2", ediSegment: "N3", ediElement: "N302", direction: "both" },
    { dbField: "city", ediSegment: "N4", ediElement: "N401", direction: "both" },
    { dbField: "state", ediSegment: "N4", ediElement: "N402", direction: "both" },
    { dbField: "zip", ediSegment: "N4", ediElement: "N403", direction: "both" },
    { dbField: "payerResponsibility", ediSegment: "SBR", ediElement: "SBR01", direction: "both", default: "P" },
    { dbField: "relationshipCode", ediSegment: "SBR", ediElement: "SBR02", direction: "both", default: "18" },
    { dbField: "groupNumber", ediSegment: "SBR", ediElement: "SBR03", direction: "both" },
    { dbField: "claimFilingCode", ediSegment: "SBR", ediElement: "SBR09", direction: "both" }
  ],

  billingProvider: [
    { dbField: "npi", ediSegment: "NM1*85", ediElement: "NM109", direction: "both" },
    { dbField: "entityType", ediSegment: "NM1*85", ediElement: "NM102", direction: "both", default: "2" },
    { dbField: "organizationName", ediSegment: "NM1*85", ediElement: "NM103", direction: "both" },
    { dbField: "lastName", ediSegment: "NM1*85", ediElement: "NM103", direction: "both" },
    { dbField: "firstName", ediSegment: "NM1*85", ediElement: "NM104", direction: "both" },
    { dbField: "idQualifier", ediSegment: "NM1*85", ediElement: "NM108", direction: "both", default: "XX" },
    { dbField: "taxonomyCode", ediSegment: "PRV", ediElement: "PRV03", direction: "both" },
    { dbField: "address1", ediSegment: "N3", ediElement: "N301", direction: "both" },
    { dbField: "address2", ediSegment: "N3", ediElement: "N302", direction: "both" },
    { dbField: "city", ediSegment: "N4", ediElement: "N401", direction: "both" },
    { dbField: "state", ediSegment: "N4", ediElement: "N402", direction: "both" },
    { dbField: "zip", ediSegment: "N4", ediElement: "N403", direction: "both" },
    { dbField: "taxId", ediSegment: "REF", ediElement: "REF02", qualifier: "EI", direction: "both" }
  ],

  renderingProvider: [
    { dbField: "npi", ediSegment: "NM1*82", ediElement: "NM109", direction: "both" },
    { dbField: "entityType", ediSegment: "NM1*82", ediElement: "NM102", direction: "both", default: "1" },
    { dbField: "lastName", ediSegment: "NM1*82", ediElement: "NM103", direction: "both" },
    { dbField: "firstName", ediSegment: "NM1*82", ediElement: "NM104", direction: "both" },
    { dbField: "middleName", ediSegment: "NM1*82", ediElement: "NM105", direction: "both" },
    { dbField: "idQualifier", ediSegment: "NM1*82", ediElement: "NM108", direction: "both", default: "XX" },
    { dbField: "taxonomyCode", ediSegment: "PRV", ediElement: "PRV03", direction: "both" }
  ],

  attendingProvider: [
    { dbField: "npi", ediSegment: "NM1*71", ediElement: "NM109", direction: "both" },
    { dbField: "entityType", ediSegment: "NM1*71", ediElement: "NM102", direction: "both", default: "1" },
    { dbField: "lastName", ediSegment: "NM1*71", ediElement: "NM103", direction: "both" },
    { dbField: "firstName", ediSegment: "NM1*71", ediElement: "NM104", direction: "both" },
    { dbField: "middleName", ediSegment: "NM1*71", ediElement: "NM105", direction: "both" },
    { dbField: "idQualifier", ediSegment: "NM1*71", ediElement: "NM108", direction: "both", default: "XX" },
    { dbField: "taxonomyCode", ediSegment: "PRV", ediElement: "PRV03", direction: "both" }
  ],

  referringProvider: [
    { dbField: "npi", ediSegment: "NM1*DN", ediElement: "NM109", direction: "both" },
    { dbField: "entityType", ediSegment: "NM1*DN", ediElement: "NM102", direction: "both", default: "1" },
    { dbField: "lastName", ediSegment: "NM1*DN", ediElement: "NM103", direction: "both" },
    { dbField: "firstName", ediSegment: "NM1*DN", ediElement: "NM104", direction: "both" },
    { dbField: "idQualifier", ediSegment: "NM1*DN", ediElement: "NM108", direction: "both", default: "XX" }
  ],

  payer: [
    { dbField: "payerId", ediSegment: "NM1*PR", ediElement: "NM109", direction: "both" },
    { dbField: "name", ediSegment: "NM1*PR", ediElement: "NM103", direction: "both" },
    { dbField: "idQualifier", ediSegment: "NM1*PR", ediElement: "NM108", direction: "both", default: "PI" },
    { dbField: "address1", ediSegment: "N3", ediElement: "N301", direction: "both" },
    { dbField: "city", ediSegment: "N4", ediElement: "N401", direction: "both" },
    { dbField: "state", ediSegment: "N4", ediElement: "N402", direction: "both" },
    { dbField: "zip", ediSegment: "N4", ediElement: "N403", direction: "both" }
  ],

  diagnoses: [
    { dbField: "principalCode", ediSegment: "HI", ediElement: "HI01-2", qualifier: "ABK", direction: "both" },
    { dbField: "admittingDiagnosis", ediSegment: "HI", ediElement: "HI01-2", qualifier: "ABJ", direction: "both" },
    { dbField: "otherCodes", ediSegment: "HI", ediElement: "HI02-2+", qualifier: "ABF", direction: "both" },
    { dbField: "externalCauseCodes", ediSegment: "HI", ediElement: "HI01-2", qualifier: "ABN", direction: "both" },
    { dbField: "principalProcedure", ediSegment: "HI", ediElement: "HI01-2", qualifier: "BBR", direction: "both" },
    { dbField: "otherProcedures", ediSegment: "HI", ediElement: "HI01-2", qualifier: "BBQ", direction: "both" }
  ],

  serviceLines: [
    { dbField: "revenueCode", ediSegment: "SV2", ediElement: "SV201", direction: "both" },
    { dbField: "procedureCode", ediSegment: "SV2", ediElement: "SV202-2", direction: "both" },
    { dbField: "procedureQualifier", ediSegment: "SV2", ediElement: "SV202-1", direction: "both", default: "HC" },
    { dbField: "modifier1", ediSegment: "SV2", ediElement: "SV202-3", direction: "both" },
    { dbField: "modifier2", ediSegment: "SV2", ediElement: "SV202-4", direction: "both" },
    { dbField: "modifier3", ediSegment: "SV2", ediElement: "SV202-5", direction: "both" },
    { dbField: "modifier4", ediSegment: "SV2", ediElement: "SV202-6", direction: "both" },
    { dbField: "chargeAmount", ediSegment: "SV2", ediElement: "SV203", direction: "both" },
    { dbField: "unitMeasure", ediSegment: "SV2", ediElement: "SV204", direction: "both", default: "UN" },
    { dbField: "unitCount", ediSegment: "SV2", ediElement: "SV205", direction: "both" },
    { dbField: "serviceDateFrom", ediSegment: "DTP", ediElement: "DTP03", qualifier: "472", direction: "both" },
    { dbField: "serviceDateTo", ediSegment: "DTP", ediElement: "DTP03", qualifier: "472", direction: "both" }
  ]
};

// ---------------------------------------------------------------------------
// getFieldMap — returns the appropriate field map by claim type
// ---------------------------------------------------------------------------
export function getFieldMap(claimType) {
  const key = String(claimType).toUpperCase();
  if (key === "837P" || key === "PROFESSIONAL" || key === "P") return FIELD_MAP_837P;
  if (key === "837I" || key === "INSTITUTIONAL" || key === "I") return FIELD_MAP_837I;
  return null;
}

// ---------------------------------------------------------------------------
// validateClaimForConversion — checks if a claim has all required fields
// ---------------------------------------------------------------------------
const REQUIRED_CLAIM_FIELDS = ["patientControlNumber", "totalChargeAmount", "facilityCode"];
const REQUIRED_SUBSCRIBER_FIELDS = ["memberId", "lastName", "firstName"];
const REQUIRED_BILLING_PROVIDER_FIELDS = ["npi", "address1", "city", "state", "zip"];
const REQUIRED_PAYER_FIELDS = ["payerId", "name"];
const REQUIRED_DIAGNOSIS_FIELDS = ["principalCode"];

function checkSection(obj, fields, sectionLabel) {
  const errors = [];
  if (!obj) {
    errors.push(`Missing required section: ${sectionLabel}`);
    return errors;
  }
  for (const f of fields) {
    const val = obj[f];
    if (val === undefined || val === null || val === "") {
      errors.push(`${sectionLabel}.${f} is required but missing or empty`);
    }
  }
  return errors;
}

export function validateClaimForConversion(fullClaim) {
  const errors = [];

  if (!fullClaim) {
    return { valid: false, errors: ["Claim object is null or undefined"] };
  }

  const claimType = String(fullClaim.claimType || "").toUpperCase();
  if (!claimType) {
    errors.push("claimType is required (837P or 837I)");
  } else if (!["837P", "837I", "P", "I", "PROFESSIONAL", "INSTITUTIONAL"].includes(claimType)) {
    errors.push(`Unsupported claimType: ${fullClaim.claimType}`);
  }

  errors.push(...checkSection(fullClaim, REQUIRED_CLAIM_FIELDS, "claim"));
  errors.push(...checkSection(fullClaim.subscriber, REQUIRED_SUBSCRIBER_FIELDS, "subscriber"));
  errors.push(...checkSection(fullClaim.billingProvider, REQUIRED_BILLING_PROVIDER_FIELDS, "billingProvider"));
  errors.push(...checkSection(fullClaim.payer, REQUIRED_PAYER_FIELDS, "payer"));
  errors.push(...checkSection(fullClaim.diagnoses, REQUIRED_DIAGNOSIS_FIELDS, "diagnoses"));

  if (!fullClaim.serviceLines || !Array.isArray(fullClaim.serviceLines) || fullClaim.serviceLines.length === 0) {
    errors.push("At least one service line is required");
  } else {
    const isInst = ["837I", "I", "INSTITUTIONAL"].includes(claimType);
    fullClaim.serviceLines.forEach((line, i) => {
      if (!line.chargeAmount && line.chargeAmount !== 0) {
        errors.push(`serviceLines[${i}].chargeAmount is required`);
      }
      if (!line.unitCount && line.unitCount !== 0) {
        errors.push(`serviceLines[${i}].unitCount is required`);
      }
      if (isInst) {
        if (!line.revenueCode) errors.push(`serviceLines[${i}].revenueCode is required for 837I`);
      } else {
        if (!line.procedureCode) errors.push(`serviceLines[${i}].procedureCode is required for 837P`);
      }
    });
  }

  if (["837I", "I", "INSTITUTIONAL"].includes(claimType)) {
    if (!fullClaim.patientStatusCode && !(fullClaim.claim && fullClaim.claim.patientStatusCode)) {
      if (!fullClaim.patientStatusCode) {
        errors.push("patientStatusCode (CL103) is required for 837I claims");
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
