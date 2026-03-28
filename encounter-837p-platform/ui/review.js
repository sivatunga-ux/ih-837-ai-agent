function splitSegments(rawText = "") {
  return String(rawText)
    .replace(/\r\n/g, "\n")
    .split("~")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function parseName(segment) {
  const parts = segment.split("*");
  return {
    entity: parts[1] || "",
    entityType: parts[2] || "",
    last: parts[3] || "",
    first: parts[4] || "",
    idQualifier: parts[8] || "",
    id: parts[9] || "",
  };
}

function parseAmount(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function buildReviewModel(rawText) {
  const segments = splitSegments(rawText);
  const model = {
    totalSegments: segments.length,
    submitter: null,
    receiver: null,
    billingProvider: null,
    subscriber: null,
    patient: null,
    payer: null,
    claim: {
      claimId: "",
      totalCharge: "",
      placeOfService: "",
      clearinghouseTrace: "",
      diagnoses: [],
      serviceLines: [],
      computedLineTotal: 0,
    },
  };

  let currentLineNumber = "";

  for (const segment of segments) {
    if (segment.startsWith("NM1*41*")) {
      model.submitter = parseName(segment);
      continue;
    }
    if (segment.startsWith("NM1*40*")) {
      model.receiver = parseName(segment);
      continue;
    }
    if (segment.startsWith("NM1*85*")) {
      model.billingProvider = parseName(segment);
      continue;
    }
    if (segment.startsWith("NM1*IL*")) {
      model.subscriber = parseName(segment);
      continue;
    }
    if (segment.startsWith("NM1*QC*")) {
      model.patient = parseName(segment);
      continue;
    }
    if (segment.startsWith("NM1*PR*")) {
      model.payer = parseName(segment);
      continue;
    }
    if (segment.startsWith("CLM*")) {
      const parts = segment.split("*");
      model.claim.claimId = parts[1] || "";
      model.claim.totalCharge = parts[2] || "";
      const posComposite = parts[5] || "";
      model.claim.placeOfService = posComposite.split(":")[0] || "";
      continue;
    }
    if (segment.startsWith("REF*D9*")) {
      model.claim.clearinghouseTrace = segment.split("*")[2] || "";
      continue;
    }
    if (segment.startsWith("HI*")) {
      const parts = segment.split("*").slice(1);
      model.claim.diagnoses = parts
        .map((item) => item.split(":")[1] || "")
        .filter(Boolean);
      continue;
    }
    if (segment.startsWith("LX*")) {
      currentLineNumber = segment.split("*")[1] || "";
      continue;
    }
    if (segment.startsWith("SV1*")) {
      const parts = segment.split("*");
      const procedureComposite = parts[1] || "";
      const procedureCode = procedureComposite.split(":")[1] || procedureComposite;
      const charge = parts[2] || "";
      model.claim.serviceLines.push({
        lineNumber: currentLineNumber,
        procedureCode,
        charge,
        date: "",
      });
      continue;
    }
    if (segment.startsWith("DTP*472*") && model.claim.serviceLines.length > 0) {
      const parts = segment.split("*");
      const serviceDate = parts[3] || "";
      model.claim.serviceLines[model.claim.serviceLines.length - 1].date = serviceDate;
    }
  }

  model.claim.computedLineTotal = model.claim.serviceLines.reduce(
    (sum, line) => sum + parseAmount(line.charge),
    0,
  );

  return model;
}
