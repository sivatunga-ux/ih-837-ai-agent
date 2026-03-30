/**
 * Multi-format claim ingest service.
 * Parses CSV, JSON, and XML files containing claim data and normalizes them
 * into the standard claims database format.
 */

// ── Field-name alias map ──
// Each key is a normalized target; value is a Set of lowercase aliases.
const FIELD_ALIASES = {
  patientControlNumber: new Set([
    "patient_control_number", "patientcontrolnumber", "pcn",
    "claim_id", "claimnumber", "claim_number", "claimid"
  ]),
  totalChargeAmount: new Set([
    "total_charge", "totalcharge", "charge_amount", "chargeamount",
    "total_amount", "totalamount", "totalchargeamount"
  ]),
  "subscriber.memberId": new Set([
    "member_id", "memberid", "subscriber_id", "subscriberid",
    "insured_id", "insuredid"
  ]),
  "subscriber.lastName": new Set([
    "last_name", "lastname", "patient_last_name", "patientlastname",
    "subscriberlastname", "subscriber_last_name"
  ]),
  "subscriber.firstName": new Set([
    "first_name", "firstname", "patient_first_name", "patientfirstname",
    "subscriberfirstname", "subscriber_first_name"
  ]),
  "subscriber.dateOfBirth": new Set([
    "dob", "date_of_birth", "dateofbirth", "birthdate", "birth_date"
  ]),
  "subscriber.gender": new Set([
    "gender", "sex"
  ]),
  renderingNPI: new Set([
    "npi", "rendering_npi", "renderingnpi", "provider_npi", "providernpi"
  ]),
  billingNPI: new Set([
    "billing_npi", "billingnpi"
  ]),
  renderingProviderName: new Set([
    "provider_name", "providername", "rendering_provider",
    "renderingprovider", "providerlastname", "provider_last_name"
  ]),
  billingProviderName: new Set([
    "billing_provider", "billingprovider", "billing_provider_name"
  ]),
  facilityCode: new Set([
    "pos", "place_of_service", "placeofservice", "facility_code", "facilitycode"
  ]),
  procedureCode: new Set([
    "cpt", "procedure_code", "procedurecode", "cpt_code", "cptcode", "hcpcs"
  ]),
  diagnosisCode: new Set([
    "icd", "diagnosis_code", "diagnosiscode", "icd10", "dx_code", "dxcode",
    "principal_dx", "principaldx"
  ]),
  serviceDateFrom: new Set([
    "dos", "service_date", "servicedate", "date_of_service", "dateofservice",
    "servicedatefrom"
  ]),
  unitCount: new Set([
    "units", "unit_count", "unitcount", "quantity"
  ]),
  lineCharge: new Set([
    "charge", "line_charge", "linecharge"
  ]),
  modifier: new Set([
    "modifier", "modifier1"
  ]),
  revenueCode: new Set([
    "revenue_code", "revenuecode", "rev_code", "revcode"
  ])
};

// Build a reverse lookup: lowercased alias → target
const ALIAS_LOOKUP = new Map();
for (const [target, aliases] of Object.entries(FIELD_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_LOOKUP.set(alias, target);
  }
}

function resolveFieldName(raw) {
  const lower = (raw || "").toLowerCase().trim();
  return ALIAS_LOOKUP.get(lower) || null;
}

// ── Format Detection ──

export function detectFormat(text, fileName) {
  const ext = ((fileName || "").split(".").pop() || "").toLowerCase();
  if (ext === "csv") return "CSV";
  if (ext === "json") return "JSON";
  if (ext === "xml") return "XML";

  const trimmed = (text || "").trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "JSON";
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) return "XML";
  if (trimmed.includes(",") && trimmed.includes("\n")) return "CSV";

  return "UNKNOWN";
}

// ── CSV Parser ──

export function parseCSV(text) {
  const lines = (text || "").split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { rows: [], headers: [] };

  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (values[j] || "").trim();
    }
    rows.push(obj);
  }
  return { rows, headers };
}

function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

// ── JSON Parser ──

export function parseJSON(text) {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return { rows: parsed };
  if (parsed && Array.isArray(parsed.claims)) return { rows: parsed.claims };
  if (parsed && typeof parsed === "object") return { rows: [parsed] };
  return { rows: [] };
}

// ── XML Parser ──

export function parseXML(text) {
  const rows = [];
  const claimPattern = /<[Cc]laim\b[^>]*>([\s\S]*?)<\/[Cc]laim>/g;
  let match;
  while ((match = claimPattern.exec(text)) !== null) {
    const body = match[1];
    const obj = {};
    const tagPattern = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let tagMatch;
    while ((tagMatch = tagPattern.exec(body)) !== null) {
      obj[tagMatch[1]] = tagMatch[2].trim();
    }
    rows.push(obj);
  }
  return { rows };
}

// ── Normalize a single row ──

export function normalizeClaimRow(row, format, claimType) {
  if (!row || typeof row !== "object") return null;

  // If the row is already in normalized form (e.g. from JSON with nested objects),
  // handle it directly; otherwise, do field-name matching.
  const isPreNormalized = row.subscriber && typeof row.subscriber === "object";

  const claim = {
    patientControlNumber: "",
    totalChargeAmount: 0,
    claimType: claimType || "837P",
    facilityCode: "",
    serviceDateFrom: "",
    subscriber: {
      memberId: "",
      lastName: "",
      firstName: "",
      dateOfBirth: "",
      gender: ""
    },
    providers: [],
    payer: row.payer || { payerName: "", payerId: "", payerIdQualifier: "PI" },
    diagnoses: [],
    serviceLines: []
  };

  if (isPreNormalized) {
    claim.patientControlNumber = row.patientControlNumber || "";
    claim.totalChargeAmount = parseFloat(row.totalChargeAmount) || 0;
    claim.claimType = row.claimType || claimType || "837P";
    claim.facilityCode = row.facilityCode || "";
    claim.serviceDateFrom = row.serviceDateFrom || "";

    claim.subscriber.memberId = row.subscriber.memberId || "";
    claim.subscriber.lastName = row.subscriber.lastName || "";
    claim.subscriber.firstName = row.subscriber.firstName || "";
    claim.subscriber.dateOfBirth = row.subscriber.dateOfBirth || "";
    claim.subscriber.gender = row.subscriber.gender || "";

    if (Array.isArray(row.providers)) claim.providers = row.providers;
    if (row.payer) claim.payer = row.payer;
    if (Array.isArray(row.diagnoses)) claim.diagnoses = row.diagnoses;
    if (Array.isArray(row.serviceLines)) claim.serviceLines = row.serviceLines;

    return claim;
  }

  // Flat row — use fuzzy field-name matching
  let renderingNPI = "";
  let billingNPI = "";
  let renderingProviderName = "";
  let billingProviderName = "";
  let procedureCode = "";
  let lineCharge = 0;
  let unitCount = 1;
  let modifier = "";
  let revenueCode = "";
  let diagnosisCode = "";

  for (const [key, value] of Object.entries(row)) {
    const target = resolveFieldName(key);
    if (!target) continue;

    const val = typeof value === "string" ? value.trim() : value;

    switch (target) {
      case "patientControlNumber":
        claim.patientControlNumber = String(val);
        break;
      case "totalChargeAmount":
        claim.totalChargeAmount = parseFloat(val) || 0;
        break;
      case "subscriber.memberId":
        claim.subscriber.memberId = String(val);
        break;
      case "subscriber.lastName":
        claim.subscriber.lastName = String(val);
        break;
      case "subscriber.firstName":
        claim.subscriber.firstName = String(val);
        break;
      case "subscriber.dateOfBirth":
        claim.subscriber.dateOfBirth = String(val);
        break;
      case "subscriber.gender":
        claim.subscriber.gender = String(val);
        break;
      case "renderingNPI":
        renderingNPI = String(val);
        break;
      case "billingNPI":
        billingNPI = String(val);
        break;
      case "renderingProviderName":
        renderingProviderName = String(val);
        break;
      case "billingProviderName":
        billingProviderName = String(val);
        break;
      case "facilityCode":
        claim.facilityCode = String(val);
        break;
      case "procedureCode":
        procedureCode = String(val);
        break;
      case "diagnosisCode":
        diagnosisCode = String(val);
        break;
      case "serviceDateFrom":
        claim.serviceDateFrom = String(val);
        break;
      case "unitCount":
        unitCount = parseInt(val, 10) || 1;
        break;
      case "lineCharge":
        lineCharge = parseFloat(val) || 0;
        break;
      case "modifier":
        modifier = String(val);
        break;
      case "revenueCode":
        revenueCode = String(val);
        break;
    }
  }

  // Build providers
  if (billingNPI || billingProviderName) {
    claim.providers.push({
      role: "billing",
      npi: billingNPI,
      lastName: billingProviderName,
      entityType: "2",
      taxId: "",
      taxIdType: "EI"
    });
  }
  if (renderingNPI || renderingProviderName) {
    const nameParts = (renderingProviderName || "").replace(/^Dr\.?\s*/i, "").split(/\s+/);
    const firstName = nameParts.length > 1 ? nameParts[0] : "";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0] || "";
    claim.providers.push({
      role: "rendering",
      npi: renderingNPI,
      lastName,
      firstName,
      entityType: "1",
      taxonomyCode: ""
    });
  }

  // Build diagnoses
  if (diagnosisCode) {
    const codes = diagnosisCode.split(/[;,|]/).map(c => c.trim()).filter(Boolean);
    codes.forEach((code, idx) => {
      claim.diagnoses.push({
        sequence: idx + 1,
        code,
        qualifier: idx === 0 ? "ABK" : "ABF"
      });
    });
  }

  // Build service line
  if (procedureCode || lineCharge) {
    const diagPointers = claim.diagnoses.length > 0
      ? claim.diagnoses.map(d => d.sequence).join(":")
      : "1";
    claim.serviceLines.push({
      lineNumber: 1,
      procedureCode: procedureCode || "",
      chargeAmount: lineCharge || claim.totalChargeAmount,
      unitType: "UN",
      unitCount,
      modifier: modifier || "",
      revenueCode: revenueCode || "",
      diagPointers
    });
  }

  return claim;
}

// ── Top-level ingest ──

export function ingestFile(text, fileName, claimType) {
  const errors = [];
  const format = detectFormat(text, fileName);

  if (format === "UNKNOWN") {
    return { claims: [], errors: ["Unable to detect file format"], format, rowCount: 0 };
  }

  let rawRows = [];
  try {
    if (format === "CSV") {
      const result = parseCSV(text);
      rawRows = result.rows;
    } else if (format === "JSON") {
      const result = parseJSON(text);
      rawRows = result.rows;
    } else if (format === "XML") {
      const result = parseXML(text);
      rawRows = result.rows;
    }
  } catch (err) {
    return { claims: [], errors: [`Parse error (${format}): ${err.message}`], format, rowCount: 0 };
  }

  const claims = [];
  for (let i = 0; i < rawRows.length; i++) {
    try {
      const normalized = normalizeClaimRow(rawRows[i], format, claimType);
      if (normalized) claims.push(normalized);
      else errors.push(`Row ${i + 1}: normalization returned null`);
    } catch (err) {
      errors.push(`Row ${i + 1}: ${err.message}`);
    }
  }

  return { claims, errors, format, rowCount: rawRows.length };
}

// ── Sample data ──

export const SAMPLE_CSV = `patient_control_number,total_charge,member_id,last_name,first_name,dob,gender,rendering_npi,rendering_provider,pos,dos,cpt,units,charge,icd,billing_npi,billing_provider
CLM-CSV-001,250.00,W100100100,SMITH,JOHN,19750315,M,1234567890,Dr. Jane Williams,11,20240515,99213,1,150.00,E11.9,9876543210,ACME MEDICAL GROUP
CLM-CSV-002,420.00,W200200200,JOHNSON,MARY,19680722,F,1234567890,Dr. Jane Williams,11,20240520,99214,1,220.00,J44.1,9876543210,ACME MEDICAL GROUP`;

export const SAMPLE_JSON = `{
  "claims": [
    {
      "patientControlNumber": "CLM-JSON-001",
      "totalChargeAmount": 350,
      "claimType": "837P",
      "serviceDateFrom": "20240601",
      "facilityCode": "11",
      "subscriber": {
        "memberId": "W300300300",
        "lastName": "WILLIAMS",
        "firstName": "ROBERT",
        "dateOfBirth": "19820410",
        "gender": "M"
      },
      "providers": [
        { "role": "billing", "npi": "9876543210", "lastName": "CITY MEDICAL", "entityType": "2", "taxId": "123456789", "taxIdType": "EI" },
        { "role": "rendering", "npi": "1234567890", "lastName": "CHEN", "firstName": "LISA", "entityType": "1", "taxonomyCode": "207Q00000X" }
      ],
      "payer": { "payerName": "BLUE CROSS", "payerId": "12345", "payerIdQualifier": "PI" },
      "diagnoses": [
        { "sequence": 1, "code": "E11.9", "qualifier": "ABK" },
        { "sequence": 2, "code": "I10", "qualifier": "ABF" }
      ],
      "serviceLines": [
        { "lineNumber": 1, "procedureCode": "99213", "chargeAmount": 150, "unitType": "UN", "unitCount": 1, "diagPointers": "1:2" },
        { "lineNumber": 2, "procedureCode": "36415", "chargeAmount": 200, "unitType": "UN", "unitCount": 1, "diagPointers": "1" }
      ]
    }
  ]
}`;

export const SAMPLE_XML = `<?xml version="1.0"?>
<claims>
  <claim>
    <patientControlNumber>CLM-XML-001</patientControlNumber>
    <totalChargeAmount>550</totalChargeAmount>
    <claimType>837P</claimType>
    <facilityCode>11</facilityCode>
    <serviceDateFrom>20240701</serviceDateFrom>
    <memberId>W400400400</memberId>
    <lastName>GARCIA</lastName>
    <firstName>MARIA</firstName>
    <dateOfBirth>19900525</dateOfBirth>
    <gender>F</gender>
    <renderingNPI>1234567890</renderingNPI>
    <renderingProvider>Dr. James Park</renderingProvider>
    <billingNPI>9876543210</billingNPI>
    <billingProvider>VALLEY HEALTH CENTER</billingProvider>
    <diagnosisCode>I10</diagnosisCode>
    <procedureCode>99214</procedureCode>
    <lineCharge>550</lineCharge>
    <units>1</units>
  </claim>
</claims>`;
