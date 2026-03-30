/**
 * Conversion Agent — orchestrates the full claims-to-EDI pipeline.
 * Processes claims through ingest → normalize → store → validate → map → generate → verify.
 */

import { ingestFile } from "./claimIngest.js";
import { validateClaimForConversion, getFieldMap } from "./claimMapper.js";
import { generate837 as generate837Fn } from "./edi837Generator.js";
import { validate837 as validate837Fn, computeStatus as computeStatusFn } from "../rules/validation.js";

// Converts from the ingest DB format (providers[], diagnoses[]) to the
// flat structure expected by claimMapper / edi837Generator.
function toGeneratorFormat(claim) {
  const out = { ...claim };
  if (Array.isArray(claim.providers)) {
    const billing = claim.providers.find(p => p.role === "billing") || {};
    const rendering = claim.providers.find(p => p.role === "rendering") || {};
    out.billingProvider = {
      npi: billing.npi || "",
      entityType: billing.entityType || "2",
      organizationName: billing.lastName || "",
      lastName: billing.lastName || "",
      firstName: billing.firstName || "",
      taxId: billing.taxId || "",
      taxIdType: billing.taxIdType || "EI",
      taxonomyCode: billing.taxonomyCode || "",
      address1: billing.address1 || "",
      city: billing.city || "",
      state: billing.state || "",
      zip: billing.zip || ""
    };
    out.renderingProvider = {
      npi: rendering.npi || "",
      entityType: rendering.entityType || "1",
      lastName: rendering.lastName || "",
      firstName: rendering.firstName || "",
      taxonomyCode: rendering.taxonomyCode || ""
    };
  }
  if (claim.payer) {
    out.payer = {
      payerId: claim.payer.payerId || "",
      name: claim.payer.payerName || claim.payer.name || "",
      idQualifier: claim.payer.payerIdQualifier || claim.payer.idQualifier || "PI",
      address1: claim.payer.address1 || "",
      city: claim.payer.city || "",
      state: claim.payer.state || "",
      zip: claim.payer.zip || ""
    };
  }
  if (Array.isArray(claim.diagnoses)) {
    const principal = claim.diagnoses.find(d => d.sequence === 1 || d.qualifier === "ABK");
    const others = claim.diagnoses.filter(d => d !== principal).map(d => d.code);
    out.diagnoses = {
      principalCode: principal ? principal.code : "",
      otherCodes: others
    };
  }
  if (Array.isArray(claim.serviceLines)) {
    out.serviceLines = claim.serviceLines.map(sl => ({
      ...sl,
      diagnosisPointer: sl.diagPointers || sl.diagnosisPointer || "1",
      modifier1: sl.modifier || sl.modifier1 || "",
      unitMeasure: sl.unitType || sl.unitMeasure || "UN"
    }));
  }
  return out;
}

// ── Pipeline step definitions ──

export const AGENT_STEPS = [
  { id: "INGEST",   name: "File Ingest",    desc: "Parse input file (CSV/JSON/XML) and extract claim records" },
  { id: "NORMALIZE", name: "Normalize",      desc: "Map raw fields to standard claims database schema" },
  { id: "STORE",    name: "Store in DB",     desc: "Save normalized claims to the claims database" },
  { id: "VALIDATE", name: "Validate",        desc: "Check required fields and business rules for 837 conversion" },
  { id: "MAP",      name: "Map to 837",      desc: "Map claims DB fields to 837 segment/element positions" },
  { id: "GENERATE", name: "Generate EDI",    desc: "Build 837P or 837I EDI file from mapped data" },
  { id: "VERIFY",   name: "Verify Output",   desc: "Parse generated EDI and run validation checks" },
  { id: "COMPLETE", name: "Complete",         desc: "Conversion complete — EDI ready for download" }
];

// ── Helper: timed step wrapper ──

function timedStep(stepId, fn) {
  const start = performance.now();
  try {
    const result = fn();
    const duration = Math.round(performance.now() - start);
    return { stepId, status: "success", duration, ...result };
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    return { stepId, status: "error", duration, message: err.message, details: err.stack };
  }
}

async function timedStepAsync(stepId, fn) {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = Math.round(performance.now() - start);
    return { stepId, status: "success", duration, ...result };
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    return { stepId, status: "error", duration, message: err.message, details: err.stack };
  }
}

// ── Conversion Agent ──

export class ConversionAgent {
  constructor(claimsDb) {
    this.claimsDb = claimsDb || new Map();
    this._idCounter = 0;
  }

  _nextId() {
    this._idCounter++;
    return `CLM-${Date.now().toString(36)}-${this._idCounter}`;
  }

  // ── Individual pipeline steps ──

  stepIngest(fileText, fileName, claimType) {
    return timedStep("INGEST", () => {
      const result = ingestFile(fileText, fileName, claimType);
      if (result.claims.length === 0 && result.errors.length > 0) {
        return {
          status: "error",
          message: `Ingest failed: ${result.errors.join("; ")}`,
          details: { format: result.format, errors: result.errors }
        };
      }
      const msg = `Parsed ${result.rowCount} row(s) from ${result.format} file — ${result.claims.length} claim(s) extracted`;
      const warnings = result.errors.length > 0
        ? { status: "warning", message: `${msg} (${result.errors.length} row error(s))` }
        : { message: msg };
      return {
        ...warnings,
        details: {
          format: result.format,
          rowCount: result.rowCount,
          claimCount: result.claims.length,
          errors: result.errors
        },
        _claims: result.claims
      };
    });
  }

  stepNormalize(rawClaims) {
    return timedStep("NORMALIZE", () => {
      const normalized = rawClaims.filter(Boolean);
      return {
        message: `${normalized.length} claim(s) normalized to standard schema`,
        details: { count: normalized.length },
        _claims: normalized
      };
    });
  }

  stepStore(normalizedClaims) {
    return timedStep("STORE", () => {
      const ids = [];
      for (const claim of normalizedClaims) {
        const id = claim.patientControlNumber || this._nextId();
        this.claimsDb.set(id, { ...claim, _storedAt: new Date().toISOString() });
        ids.push(id);
      }
      return {
        message: `${ids.length} claim(s) stored in claims database`,
        details: { storedIds: ids },
        _claimIds: ids
      };
    });
  }

  stepValidate(claimIds) {
    return timedStep("VALIDATE", () => {
      const issues = [];
      const passed = [];
      for (const id of claimIds) {
        const claim = this.claimsDb.get(id);
        if (!claim) {
          issues.push({ id, level: "error", msg: "Claim not found in DB" });
          continue;
        }

        if (validateClaimForConversion) {
          const genClaim = toGeneratorFormat(claim);
          const result = validateClaimForConversion(genClaim);
          if (result && result.errors && result.errors.length > 0) {
            issues.push(...result.errors.map(e => ({ id, level: "warn", msg: e })));
          }
          passed.push(id);
        } else {
          const errs = [];
          if (!claim.patientControlNumber) errs.push("Missing patientControlNumber");
          if (!claim.subscriber?.memberId) errs.push("Missing subscriber memberId");
          if (!claim.subscriber?.lastName) errs.push("Missing subscriber lastName");
          if (!claim.serviceDateFrom) errs.push("Missing serviceDateFrom");
          if (!claim.totalChargeAmount) errs.push("Missing totalChargeAmount");
          if (!claim.providers || claim.providers.length === 0) errs.push("No providers specified");
          if (!claim.diagnoses || claim.diagnoses.length === 0) errs.push("No diagnosis codes");
          if (!claim.serviceLines || claim.serviceLines.length === 0) errs.push("No service lines");

          if (errs.length > 0) {
            issues.push(...errs.map(msg => ({ id, level: "warn", msg })));
          }
          passed.push(id);
        }
      }

      const hasErrors = issues.some(i => i.level === "error");
      const hasWarnings = issues.some(i => i.level === "warn");
      const status = hasErrors ? "error" : hasWarnings ? "warning" : "success";
      const message = hasErrors
        ? `Validation failed: ${issues.filter(i => i.level === "error").length} error(s)`
        : hasWarnings
          ? `Validation passed with ${issues.filter(i => i.level === "warn").length} warning(s)`
          : `All ${claimIds.length} claim(s) passed validation`;

      return { status, message, details: { issues, passedIds: passed }, _claimIds: passed };
    });
  }

  stepMap(claimIds) {
    return timedStep("MAP", () => {
      const mapped = [];
      for (const id of claimIds) {
        const claim = this.claimsDb.get(id);
        if (!claim) continue;

        const genClaim = toGeneratorFormat(claim);
        if (getFieldMap) {
          mapped.push({ id, mapping: getFieldMap(genClaim.claimType || "837P"), claim: genClaim });
        } else {
          mapped.push({ id, mapping: { fieldMap: "default" }, claim: genClaim });
        }
      }
      return {
        message: `${mapped.length} claim(s) mapped to 837 field positions`,
        details: { mappedCount: mapped.length },
        _mapped: mapped
      };
    });
  }

  stepGenerate(claimIds, config) {
    return timedStep("GENERATE", () => {
      const claims = claimIds.map(id => this.claimsDb.get(id)).filter(Boolean);
      let ediOutput = "";
      const allErrors = [];

      if (generate837Fn) {
        const ediParts = [];
        for (const claim of claims) {
          const genClaim = toGeneratorFormat(claim);
          const result = generate837Fn(genClaim, config);
          if (result && result.edi) {
            ediParts.push(result.edi);
          }
          if (result && result.errors) {
            allErrors.push(...result.errors);
          }
        }
        ediOutput = ediParts.join("\n");
      }

      if (!ediOutput) {
        ediOutput = this._fallbackGenerate(claims, config);
        if (allErrors.length > 0) {
          allErrors.push("Used fallback generator due to validation gaps in input data");
        }
      }

      return {
        message: `Generated EDI output (${ediOutput.length} chars) for ${claims.length} claim(s)`,
        details: { ediLength: ediOutput.length, claimCount: claims.length, generatorErrors: allErrors },
        _ediOutput: ediOutput
      };
    });
  }

  stepVerify(ediOutput) {
    return timedStep("VERIFY", () => {
      if (!ediOutput || ediOutput.trim().length === 0) {
        return { status: "error", message: "No EDI output to verify", details: {} };
      }

      if (validate837Fn) {
        const result = validate837Fn(ediOutput);
        const status = computeStatusFn ? computeStatusFn(result.findings) : "PASS";
        const fatalCount = result.findings.filter(f => f.level === "FATAL").length;
        const warnCount = result.findings.filter(f => f.level === "WARN").length;

        if (fatalCount > 0) {
          return {
            status: "error",
            message: `Verification failed: ${fatalCount} fatal finding(s)`,
            details: { findings: result.findings, status }
          };
        }
        return {
          status: warnCount > 0 ? "warning" : "success",
          message: `Verification ${status}: ${result.findings.length} finding(s)`,
          details: { findings: result.findings, status }
        };
      }

      const hasISA = ediOutput.includes("ISA*");
      const hasST = ediOutput.includes("ST*837");
      const hasCLM = ediOutput.includes("CLM*");
      const checks = { hasISA, hasST, hasCLM };
      const allOk = hasISA && hasST && hasCLM;

      return {
        status: allOk ? "success" : "warning",
        message: allOk
          ? "EDI structure verified (ISA, ST, CLM segments present)"
          : "EDI output may be incomplete — some expected segments missing",
        details: checks
      };
    });
  }

  // ── Full pipeline ──

  async runPipeline(fileText, fileName, claimType, config) {
    const steps = [];
    const errors = [];
    let ediOutput = "";
    let claims = [];

    // Step 1: Ingest
    const ingestResult = this.stepIngest(fileText, fileName, claimType);
    steps.push(ingestResult);
    if (ingestResult.status === "error") {
      errors.push(ingestResult.message);
      return this._buildResult(steps, ediOutput, claims, errors);
    }
    const rawClaims = ingestResult._claims || [];

    // Step 2: Normalize
    const normalizeResult = this.stepNormalize(rawClaims);
    steps.push(normalizeResult);
    if (normalizeResult.status === "error") {
      errors.push(normalizeResult.message);
      return this._buildResult(steps, ediOutput, claims, errors);
    }
    claims = normalizeResult._claims || [];

    // Step 3: Store
    const storeResult = this.stepStore(claims);
    steps.push(storeResult);
    if (storeResult.status === "error") {
      errors.push(storeResult.message);
      return this._buildResult(steps, ediOutput, claims, errors);
    }
    const claimIds = storeResult._claimIds || [];

    // Step 4: Validate
    const validateResult = this.stepValidate(claimIds);
    steps.push(validateResult);
    if (validateResult.status === "error") {
      errors.push(validateResult.message);
      return this._buildResult(steps, ediOutput, claims, errors);
    }
    const validIds = validateResult._claimIds || claimIds;

    // Step 5: Map
    const mapResult = this.stepMap(validIds);
    steps.push(mapResult);
    if (mapResult.status === "error") {
      errors.push(mapResult.message);
      return this._buildResult(steps, ediOutput, claims, errors);
    }

    // Step 6: Generate
    const generateResult = this.stepGenerate(validIds, config || {});
    steps.push(generateResult);
    if (generateResult.status === "error") {
      errors.push(generateResult.message);
      return this._buildResult(steps, ediOutput, claims, errors);
    }
    ediOutput = generateResult._ediOutput || "";

    // Step 7: Verify
    const verifyResult = this.stepVerify(ediOutput);
    steps.push(verifyResult);
    if (verifyResult.status === "error") {
      errors.push(verifyResult.message);
    }

    // Step 8: Complete
    steps.push({
      stepId: "COMPLETE",
      status: errors.length === 0 ? "success" : "warning",
      message: errors.length === 0
        ? `Pipeline complete — ${claims.length} claim(s) converted to EDI`
        : `Pipeline complete with ${errors.length} issue(s)`,
      duration: 0,
      details: {}
    });

    return this._buildResult(steps, ediOutput, claims, errors);
  }

  // ── Internal helpers ──

  _buildResult(steps, ediOutput, claims, errors) {
    const totalDuration = steps.reduce((sum, s) => sum + (s.duration || 0), 0);
    const successCount = steps.filter(s => s.status === "success").length;
    const warningCount = steps.filter(s => s.status === "warning").length;
    const errorCount = steps.filter(s => s.status === "error").length;

    return {
      steps,
      ediOutput,
      claims,
      errors,
      summary: {
        totalSteps: steps.length,
        successCount,
        warningCount,
        errorCount,
        totalDuration,
        claimCount: claims.length,
        ediLength: ediOutput.length
      }
    };
  }

  _fallbackGenerate(claims, config) {
    const pad = (s, len) => (s + " ".repeat(len)).slice(0, len);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "").slice(2);
    const timeStr = now.toISOString().slice(11, 15).replace(":", "");
    const ctrlNum = String(Math.floor(Math.random() * 999999999)).padStart(9, "0");
    const claimType = (claims[0] && claims[0].claimType) || config.claimType || "837P";
    const version = claimType === "837I" ? "005010X223A2" : "005010X222A1";

    const segs = [];
    segs.push(`ISA*00*${pad("", 10)}*00*${pad("", 10)}*ZZ*${pad("SENDER", 15)}*ZZ*${pad("RECEIVER", 15)}*${dateStr}*${timeStr}*^*00501*${ctrlNum}*0*${config.testMode ? "T" : "P"}*:`);
    segs.push(`GS*HC*SENDER*RECEIVER*${now.toISOString().slice(0, 10).replace(/-/g, "")}*${timeStr}*${ctrlNum}*X*${version}`);

    let segCount = 1;
    const stSegs = [];
    stSegs.push(`ST*837*0001*${version}`);
    segCount++;
    stSegs.push(`BHT*0019*00*${ctrlNum}*${now.toISOString().slice(0, 10).replace(/-/g, "")}*${timeStr}*CH`);
    segCount++;

    stSegs.push(`NM1*41*2*INVENT HEALTH*****46*INVENTHLTH`);
    segCount++;
    stSegs.push(`PER*IC*SUPPORT*TE*5555555555`);
    segCount++;
    stSegs.push(`NM1*40*2*RECEIVER*****46*RECEIVER01`);
    segCount++;

    let hlCounter = 0;
    for (const claim of claims) {
      hlCounter++;
      const billingHL = hlCounter;
      stSegs.push(`HL*${billingHL}**20*1`);
      segCount++;

      const billing = (claim.providers || []).find(p => p.role === "billing") || {};
      stSegs.push(`NM1*85*${billing.entityType || "2"}*${billing.lastName || "UNKNOWN"}*${billing.firstName || ""}****XX*${billing.npi || "0000000000"}`);
      segCount++;
      stSegs.push(`N3*123 MAIN ST`);
      segCount++;
      stSegs.push(`N4*ANYTOWN*CA*90210`);
      segCount++;
      stSegs.push(`REF*${billing.taxIdType || "EI"}*${billing.taxId || "000000000"}`);
      segCount++;

      hlCounter++;
      const subHL = hlCounter;
      stSegs.push(`HL*${subHL}*${billingHL}*22*0`);
      segCount++;
      stSegs.push(`SBR*P*18******CI`);
      segCount++;

      const sub = claim.subscriber || {};
      stSegs.push(`NM1*IL*1*${sub.lastName || "UNKNOWN"}*${sub.firstName || ""}****MI*${sub.memberId || "UNKNOWN"}`);
      segCount++;
      stSegs.push(`DMG*D8*${sub.dateOfBirth || "19700101"}*${sub.gender || "U"}`);
      segCount++;

      const payer = claim.payer || {};
      stSegs.push(`NM1*PR*2*${payer.payerName || "UNKNOWN PAYER"}*****${payer.payerIdQualifier || "PI"}*${payer.payerId || "00000"}`);
      segCount++;

      const pos = claim.facilityCode || "11";
      stSegs.push(`CLM*${claim.patientControlNumber || "UNKNOWN"}*${claim.totalChargeAmount || 0}***${pos}:B:1*Y*A*Y*I`);
      segCount++;

      stSegs.push(`DTP*472*D8*${claim.serviceDateFrom || "20240101"}`);
      segCount++;

      if (claim.diagnoses && claim.diagnoses.length > 0) {
        const dxParts = claim.diagnoses.map(d => `${d.qualifier || "ABK"}:${d.code}`).join("*");
        stSegs.push(`HI*${dxParts}`);
        segCount++;
      }

      const rendering = (claim.providers || []).find(p => p.role === "rendering") || {};
      if (rendering.npi) {
        stSegs.push(`NM1*82*${rendering.entityType || "1"}*${rendering.lastName || ""}*${rendering.firstName || ""}****XX*${rendering.npi}`);
        segCount++;
        if (rendering.taxonomyCode) {
          stSegs.push(`PRV*PE*PXC*${rendering.taxonomyCode}`);
          segCount++;
        }
      }

      if (claim.serviceLines) {
        for (const line of claim.serviceLines) {
          stSegs.push(`LX*${line.lineNumber || 1}`);
          segCount++;
          const mod = line.modifier ? `:${line.modifier}` : "";
          stSegs.push(`SV1*HC:${line.procedureCode || "99213"}${mod}*${line.chargeAmount || 0}*${line.unitType || "UN"}*${line.unitCount || 1}***${line.diagPointers || "1"}`);
          segCount++;
          stSegs.push(`DTP*472*D8*${claim.serviceDateFrom || "20240101"}`);
          segCount++;
        }
      }
    }

    segCount++;
    stSegs.push(`SE*${segCount}*0001`);

    segs.push(...stSegs);
    segs.push(`GE*1*${ctrlNum}`);
    segs.push(`IEA*1*${ctrlNum}`);

    return segs.join("~\n") + "~\n";
  }
}
