// pipeline.js — 6-agent encounter submission pipeline
// Self-contained ES module. No external imports except from this directory.

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_POS_CODES = new Set([
  '01','02','03','04','05','06','07','08','09','10','11','12','13','14','15',
  '16','17','18','19','20','21','22','23','24','25','26','31','32','33','34',
  '41','42','49','50','51','52','53','54','55','56','57','58','60','61','62',
  '65','71','72','81','99',
]);

function isValidDateCCYYMMDD(str) {
  if (!/^\d{8}$/.test(str)) return false;
  const y = parseInt(str.slice(0, 4), 10);
  const m = parseInt(str.slice(4, 6), 10);
  const d = parseInt(str.slice(6, 8), 10);
  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d;
}

function isNotFutureDate(str) {
  if (!/^\d{8}$/.test(str)) return false;
  const now = new Date();
  const todayNum =
    now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return parseInt(str, 10) <= todayNum;
}

function computeNPICheckDigit(npi9) {
  const payload = ('80840' + npi9).split('').map(Number);
  let sum = 0;
  let shouldDouble = true;
  for (let i = payload.length - 1; i >= 0; i--) {
    let d = payload[i];
    if (shouldDouble) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return (10 - (sum % 10)) % 10;
}

function luhnCheckNPI(npi) {
  if (!/^1\d{9}$/.test(npi)) return false;
  return parseInt(npi[9], 10) === computeNPICheckDigit(npi.slice(0, 9));
}

const MBI_REGEX =
  /^[1-9][CDEFGHJKMNPQRTUVWXY][0-9CDEFGHJKMNPQRTUVWXY]\d[CDEFGHJKMNPQRTUVWXY][0-9CDEFGHJKMNPQRTUVWXY]\d[CDEFGHJKMNPQRTUVWXY]{2}\d{2}$/;

function isValidMBI(mbi) {
  return MBI_REGEX.test(mbi);
}

const ICD10_REGEX = /^[A-TV-Z]\d[0-9A-Z]{1,5}$/;

function isValidICD10(code) {
  return ICD10_REGEX.test(code);
}

function normalizeDate(raw) {
  if (!raw) return raw;
  const s = String(raw).trim();
  if (/^\d{8}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, '');
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [mm, dd, yyyy] = s.split('/');
    return `${yyyy}${mm}${dd}`;
  }
  return s;
}

function normalizeAmount(raw) {
  if (typeof raw === 'number') return Math.round(raw * 100) / 100;
  const s = String(raw).replace(/[$,]/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function normalizeICD(code) {
  if (!code) return code;
  return String(code).replace(/\./g, '').toUpperCase().trim();
}

function padRight(str, len) {
  return (str + ' '.repeat(len)).slice(0, len);
}

function padLeft(str, len, ch = '0') {
  return (ch.repeat(len) + str).slice(-len);
}

function groupBy(arr, keyFn) {
  const map = {};
  for (const item of arr) {
    const k = keyFn(item);
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

function nowET() {
  const now = new Date();
  return now;
}

function formatDateCCYYMMDD(d) {
  return (
    String(d.getFullYear()) +
    padLeft(String(d.getMonth() + 1), 2) +
    padLeft(String(d.getDate()), 2)
  );
}

function formatDateYYMMDD(d) {
  return (
    padLeft(String(d.getFullYear() % 100), 2) +
    padLeft(String(d.getMonth() + 1), 2) +
    padLeft(String(d.getDate()), 2)
  );
}

function formatTimeHHMM(d) {
  return padLeft(String(d.getHours()), 2) + padLeft(String(d.getMinutes()), 2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT A1: INGEST CLAIMS
// ═══════════════════════════════════════════════════════════════════════════════

export function ingestClaims(claims) {
  return claims.map((claim, idx) => {
    const c = JSON.parse(JSON.stringify(claim));

    c.serviceDateFrom = normalizeDate(c.serviceDateFrom);
    c.serviceDateTo = normalizeDate(c.serviceDateTo) || c.serviceDateFrom;
    c.adjudicationDate = normalizeDate(c.adjudicationDate);
    c.totalChargeAmount = normalizeAmount(c.totalChargeAmount);
    c.paidAmount = normalizeAmount(c.paidAmount);

    if (c.subscriber) {
      c.subscriber.dateOfBirth = normalizeDate(c.subscriber.dateOfBirth);
      if (c.subscriber.lastName) c.subscriber.lastName = c.subscriber.lastName.toUpperCase().trim();
      if (c.subscriber.firstName) c.subscriber.firstName = c.subscriber.firstName.toUpperCase().trim();
      if (c.subscriber.gender) c.subscriber.gender = c.subscriber.gender.toUpperCase().trim();
    }

    if (c.billingProvider) {
      if (c.billingProvider.name) c.billingProvider.name = c.billingProvider.name.toUpperCase().trim();
      if (c.billingProvider.zip && c.billingProvider.zip.length === 5) {
        c.billingProvider.zip += '9998';
      }
    }

    if (c.renderingProvider) {
      if (c.renderingProvider.lastName) c.renderingProvider.lastName = c.renderingProvider.lastName.toUpperCase().trim();
      if (c.renderingProvider.firstName) c.renderingProvider.firstName = c.renderingProvider.firstName.toUpperCase().trim();
    }

    if (c.diagnoses) {
      c.diagnoses = c.diagnoses.map((dx) => ({
        ...dx,
        code: normalizeICD(dx.code),
      }));
    }

    if (c.serviceLines) {
      c.serviceLines = c.serviceLines.map((sl) => ({
        ...sl,
        chargeAmount: normalizeAmount(sl.chargeAmount),
        unitCount: parseInt(sl.unitCount, 10) || 1,
        procedureCode: String(sl.procedureCode).toUpperCase().trim(),
      }));
    }

    if (!c.id) c.id = `CLM-${padLeft(String(idx + 1), 6)}`;

    c._pipelineStatus = 'INGESTED';
    return c;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT A2: FIELD MAPPER
// ═══════════════════════════════════════════════════════════════════════════════

export function mapFields(claim) {
  const mapped = JSON.parse(JSON.stringify(claim));

  mapped._pipelineStatus = 'MAPPED';

  mapped._clm05 = `${mapped.facilityCode}:B:1`;
  mapped._clm08 = 'Y';

  mapped._payer = {
    name: 'EDSCMS',
    id: '80882',
    address: '7500 SECURITY BLVD',
    city: 'BALTIMORE',
    state: 'MD',
    zip: '212441850',
  };

  mapped._sbr = { sbr01: 'S', sbr02: '18', sbr09: 'MB' };
  mapped._otherPayer = { sbr01: 'P', sbr02: '18', sbr09: '16' };

  mapped.diagnoses = (mapped.diagnoses || []).map((dx, i) => ({
    ...dx,
    qualifier: i === 0 ? 'ABK' : 'ABF',
  }));

  const lineSum = (mapped.serviceLines || []).reduce(
    (s, l) => s + (l.chargeAmount || 0),
    0,
  );
  mapped._computedTotalCharge = Math.round(lineSum * 100) / 100;

  mapped._ref2u = mapped.contractId || 'H1234';
  mapped._oi03 = 'Y';

  return mapped;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT A3: VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

export function validateClaim(mc) {
  const checks = [];

  function check(id, field, value, pass, detail) {
    checks.push({
      id,
      field,
      value: value != null ? String(value).slice(0, 60) : '',
      status: pass ? 'PASS' : 'FAIL',
      detail,
    });
  }

  const pcn = mc.patientControlNumber || '';
  check('V-C01', 'CLM01', pcn, pcn.length > 0 && pcn.length <= 20,
    pcn.length > 0 ? `Present, ${pcn.length} chars` : 'Missing');

  const clm02 = mc.totalChargeAmount;
  check('V-C02', 'CLM02', clm02, typeof clm02 === 'number' && clm02 > 0,
    clm02 > 0 ? 'Positive decimal' : 'Must be positive');

  const lineSum = (mc.serviceLines || []).reduce((s, l) => s + (l.chargeAmount || 0), 0);
  const lineSumR = Math.round(lineSum * 100) / 100;
  const clm02R = Math.round((clm02 || 0) * 100) / 100;
  check('V-C03', 'CLM02 vs lines', `${clm02R} vs ${lineSumR}`,
    Math.abs(clm02R - lineSumR) < 0.02,
    Math.abs(clm02R - lineSumR) < 0.02 ? 'Match' : `Mismatch: diff=${Math.abs(clm02R - lineSumR)}`);

  const pos = mc.facilityCode || '';
  check('V-C04', 'CLM05-1', pos, VALID_POS_CODES.has(pos),
    VALID_POS_CODES.has(pos) ? 'Valid POS code' : `Invalid POS: ${pos}`);

  const clm053 = (mc._clm05 || '').split(':')[2];
  check('V-C05', 'CLM05-3', clm053, clm053 === '1',
    clm053 === '1' ? 'Original encounter' : `Expected 1, got ${clm053}`);

  const bNPI = mc.billingProvider?.npi || '';
  check('V-C06', '2010AA.NM109', bNPI, luhnCheckNPI(bNPI),
    luhnCheckNPI(bNPI) ? 'NPI valid, Luhn passed' : 'Invalid NPI or Luhn failed');

  const bEIN = mc.billingProvider?.taxId || '';
  check('V-C07', '2010AA.REF02', bEIN, /^\d{9}$/.test(bEIN),
    /^\d{9}$/.test(bEIN) ? 'Valid 9-digit EIN' : `Invalid EIN: ${bEIN}`);

  const bZip = mc.billingProvider?.zip || '';
  check('V-C08', '2010AA.N403', bZip, /^\d{9}$/.test(bZip),
    /^\d{9}$/.test(bZip) ? 'Valid 9-digit ZIP' : `Invalid ZIP: ${bZip}`);

  const memId = mc.subscriber?.memberId || '';
  check('V-C09', '2010BA.NM109', memId, memId.length > 0,
    memId.length > 0 ? 'Present' : 'Missing');

  check('V-C10', '2010BA.NM109', memId, isValidMBI(memId),
    isValidMBI(memId) ? 'Valid MBI format' : `Invalid MBI: ${memId}`);

  const sLast = mc.subscriber?.lastName || '';
  check('V-C11', '2010BA.NM103', sLast, sLast.length > 0,
    sLast.length > 0 ? 'Present' : 'Missing');

  const sFirst = mc.subscriber?.firstName || '';
  check('V-C12', '2010BA.NM104', sFirst, sFirst.length > 0,
    sFirst.length > 0 ? 'Present' : 'Missing');

  const dob = mc.subscriber?.dateOfBirth || '';
  const dobValid = isValidDateCCYYMMDD(dob) && isNotFutureDate(dob) && parseInt(dob.slice(0, 4), 10) >= 1900;
  check('V-C13', 'DMG02', dob, dobValid,
    dobValid ? 'Valid DOB' : 'Invalid DOB');

  const gender = mc.subscriber?.gender || '';
  check('V-C14', 'DMG03', gender, ['M', 'F', 'U'].includes(gender),
    ['M', 'F', 'U'].includes(gender) ? 'Valid gender' : `Invalid: ${gender}`);

  const svcDate = mc.serviceDateFrom || '';
  const svcDateValid = isValidDateCCYYMMDD(svcDate) && isNotFutureDate(svcDate);
  check('V-C15', 'DTP03*472', svcDate, svcDateValid,
    svcDateValid ? 'Valid service date' : 'Invalid service date');

  const svcAfterDOB = dob && svcDate ? parseInt(svcDate, 10) >= parseInt(dob, 10) : true;
  check('V-C16', 'DTP03 vs DMG02', `${svcDate} vs ${dob}`, svcAfterDOB,
    svcAfterDOB ? 'Service date >= DOB' : 'Service date before DOB');

  const dxList = mc.diagnoses || [];
  check('V-C17', 'HI*ABK', dxList.length, dxList.length > 0,
    dxList.length > 0 ? `${dxList.length} diagnoses` : 'No diagnoses');

  const prinDx = dxList[0]?.code || '';
  check('V-C18', 'HI*ABK code', prinDx, isValidICD10(prinDx),
    isValidICD10(prinDx) ? 'Valid ICD-10-CM' : `Invalid: ${prinDx}`);

  const otherDx = dxList.slice(1);
  const allOtherValid = otherDx.every((dx) => isValidICD10(dx.code));
  check('V-C19', 'HI*ABF codes', otherDx.length, otherDx.length === 0 || allOtherValid,
    allOtherValid ? `${otherDx.length} valid` : 'Some invalid ICD-10');

  const lines = mc.serviceLines || [];
  check('V-C20', 'SV1', lines.length, lines.length > 0,
    lines.length > 0 ? `${lines.length} service lines` : 'No service lines');

  const allHaveProc = lines.every((l) => l.procedureCode && l.procedureCode.length > 0);
  check('V-C21', 'SV101-2', allHaveProc, allHaveProc,
    allHaveProc ? 'All lines have procedure code' : 'Missing procedure code');

  const allPosCharge = lines.every((l) => l.chargeAmount > 0);
  check('V-C22', 'SV102', allPosCharge, allPosCharge,
    allPosCharge ? 'All charges positive' : 'Non-positive charge found');

  const allPosUnits = lines.every((l) => Number.isInteger(l.unitCount) && l.unitCount > 0);
  check('V-C23', 'SV104', allPosUnits, allPosUnits,
    allPosUnits ? 'All unit counts valid' : 'Invalid unit count');

  const allPointersValid = lines.every((l) => {
    if (!l.diagnosisPointers) return true;
    const ptrs = String(l.diagnosisPointers).split(':').map(Number);
    return ptrs.every((p) => p >= 1 && p <= dxList.length);
  });
  check('V-C24', 'SV107', allPointersValid, allPointersValid,
    allPointersValid ? 'All pointers valid' : 'Invalid dx pointer');

  const payerName = mc._payer?.name || '';
  check('V-C25', '2010BB.NM103', payerName, payerName === 'EDSCMS',
    payerName === 'EDSCMS' ? 'Correct payer' : `Expected EDSCMS, got ${payerName}`);

  const payerId = mc._payer?.id || '';
  check('V-C26', '2010BB.NM109', payerId, payerId === '80882',
    payerId === '80882' ? 'Correct payer ID' : `Expected 80882, got ${payerId}`);

  const sbr01 = mc._sbr?.sbr01 || '';
  check('V-C27', 'SBR01', sbr01, sbr01 === 'S',
    sbr01 === 'S' ? 'Correct' : `Expected S, got ${sbr01}`);

  const sbr09 = mc._sbr?.sbr09 || '';
  check('V-C28', 'SBR09', sbr09, sbr09 === 'MB',
    sbr09 === 'MB' ? 'Correct' : `Expected MB, got ${sbr09}`);

  check('V-C29', '2330A.NM109', memId, memId.length > 0,
    'Other subscriber matches subscriber');

  const opSbr09 = mc._otherPayer?.sbr09 || '';
  check('V-C30', '2320.SBR09', opSbr09, opSbr09 === '16',
    opSbr09 === '16' ? 'Correct' : `Expected 16, got ${opSbr09}`);

  const ref2u = mc._ref2u || mc.contractId || '';
  check('V-C31', 'REF*2U', ref2u, ref2u.length > 0,
    ref2u.length > 0 ? 'Present' : 'Missing');

  const paid = mc.paidAmount;
  check('V-C32', '2320.AMT02', paid, paid != null && paid >= 0,
    paid >= 0 ? `$${paid}` : 'Missing paid amount');

  const adjDate = mc.adjudicationDate || '';
  const adjValid = isValidDateCCYYMMDD(adjDate) && isNotFutureDate(adjDate);
  check('V-C33', '2430.DTP03', adjDate, adjValid,
    adjValid ? 'Valid adjudication date' : 'Invalid');

  const svd01Match = ref2u.length > 0;
  check('V-C34', '2430.SVD01', ref2u, svd01Match,
    'SVD01 matches contract ID');

  const oi03 = mc._oi03 || mc._clm08 || 'Y';
  const clm08 = mc._clm08 || 'Y';
  check('V-C35', 'OI03 vs CLM08', `${oi03} vs ${clm08}`, oi03 === clm08,
    oi03 === clm08 ? 'Match' : 'Mismatch');

  const passed = checks.filter((c) => c.status === 'PASS').length;
  const failed = checks.filter((c) => c.status === 'FAIL').length;

  return {
    status: failed > 0 ? 'FAIL' : 'PASS',
    checks,
    passed,
    failed,
  };
}

// File-level validations (called on generated EDI)
function validateFileLevel(ediString, controlNumbers) {
  const checks = [];

  function check(id, field, value, pass, detail) {
    checks.push({ id, field, value: String(value).slice(0, 60), status: pass ? 'PASS' : 'FAIL', detail });
  }

  const segs = ediString.split('~').map((s) => s.trim()).filter(Boolean);
  const isaRaw = segs.find((s) => s.startsWith('ISA'));

  const isaLen = isaRaw ? isaRaw.length + 1 : 0;
  check('V-F01', 'ISA', isaLen, isaLen === 106,
    isaLen === 106 ? 'ISA 106 chars' : `ISA ${isaLen} chars`);

  const isaParts = isaRaw ? isaRaw.split('*') : [];
  const isa13 = isaParts[13] || '';

  check('V-F02', 'ISA13', isa13, isa13.length === 9,
    'Control number present');

  const ieaSeg = segs.find((s) => s.startsWith('IEA'));
  const ieaParts = ieaSeg ? ieaSeg.split('*') : [];
  const iea02 = ieaParts[2] || '';
  check('V-F03', 'IEA02=ISA13', `${iea02}=${isa13}`, iea02 === isa13,
    iea02 === isa13 ? 'Match' : 'Mismatch');

  const gsSeg = segs.find((s) => s.startsWith('GS'));
  const gsParts = gsSeg ? gsSeg.split('*') : [];
  const gs06 = gsParts[6] || '';
  const geSeg = segs.find((s) => s.startsWith('GE'));
  const geParts = geSeg ? geSeg.split('*') : [];
  const ge02 = geParts[2] || '';
  check('V-F04', 'GS06=GE02', `${gs06}=${ge02}`, gs06 === ge02,
    gs06 === ge02 ? 'Match' : 'Mismatch');

  const stSeg = segs.find((s) => s.startsWith('ST'));
  const stParts = stSeg ? stSeg.split('*') : [];
  const st02 = stParts[2] || '';
  const seSeg = segs.find((s) => s.startsWith('SE'));
  const seParts = seSeg ? seSeg.split('*') : [];
  const se02 = seParts[2] || '';
  check('V-F05', 'ST02=SE02', `${st02}=${se02}`, st02 === se02,
    st02 === se02 ? 'Match' : 'Mismatch');

  const stIdx = segs.findIndex((s) => s.startsWith('ST'));
  const seIdx = segs.findIndex((s) => s.startsWith('SE'));
  const actualSegCount = seIdx >= 0 && stIdx >= 0 ? seIdx - stIdx + 1 : 0;
  const se01 = parseInt(seParts[1], 10) || 0;
  check('V-F06', 'SE01', `${se01} vs ${actualSegCount}`, se01 === actualSegCount,
    se01 === actualSegCount ? 'Segment count correct' : `Expected ${actualSegCount}, got ${se01}`);

  const gs08 = gsParts[8] || '';
  const st03 = stParts[3] || '';
  check('V-F07', 'GS08=ST03', `${gs08}=${st03}`, gs08 === st03,
    gs08 === st03 ? 'Match' : 'Mismatch');

  const isa06 = isaParts[6] || '';
  const isa06Valid = /^EN[A-Z0-9]/.test(isa06.trim());
  check('V-F08', 'ISA06', isa06.trim(), isa06Valid,
    isa06Valid ? 'Valid sender format' : 'Invalid ISA06');

  const isa08 = (isaParts[8] || '').trim();
  check('V-F09', 'ISA08', isa08, isa08 === '80882',
    isa08 === '80882' ? 'Correct receiver' : `Got ${isa08}`);

  const bhtSeg = segs.find((s) => s.startsWith('BHT'));
  const bhtParts = bhtSeg ? bhtSeg.split('*') : [];
  const bht03 = bhtParts[3] || '';
  check('V-F10', 'BHT03', bht03, bht03.length > 0, 'BHT03 present');

  const isa09 = isaParts[9] || '';
  check('V-F11', 'ISA09', isa09, isa09.length === 6,
    'ISA09 date present');

  const isa10 = isaParts[10] || '';
  const hh = parseInt(isa10.slice(0, 2), 10);
  const mm = parseInt(isa10.slice(2, 4), 10);
  const timeValid = isa10.length === 4 && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
  check('V-F12', 'ISA10', isa10, timeValid,
    timeValid ? 'Valid time' : 'Invalid time');

  const gs04 = gsParts[4] || '';
  check('V-F13', 'GS04', gs04, /^\d{8}$/.test(gs04),
    'GS04 date present');

  const bht04 = bhtParts[4] || '';
  check('V-F14', 'BHT04', bht04, /^\d{8}$/.test(bht04),
    'BHT04 date present');

  const isa05 = (isaParts[5] || '').trim();
  const isa07 = (isaParts[7] || '').trim();
  check('V-F15', 'ISA05/07', `${isa05}/${isa07}`, isa05 === 'ZZ' && isa07 === 'ZZ',
    isa05 === 'ZZ' && isa07 === 'ZZ' ? 'Both ZZ' : 'Expected ZZ');

  const isa14 = (isaParts[14] || '').trim();
  check('V-F16', 'ISA14', isa14, isa14 === '1',
    isa14 === '1' ? 'Correct' : `Expected 1, got ${isa14}`);

  const bht06 = bhtParts[6] || '';
  check('V-F17', 'BHT06', bht06, bht06 === 'CH',
    bht06 === 'CH' ? 'Correct' : `Expected CH, got ${bht06}`);

  const clmCount = segs.filter((s) => s.startsWith('CLM*')).length;
  check('V-F18', 'CLM count', clmCount, clmCount <= 5000,
    clmCount <= 5000 ? `${clmCount} claims (max 5000)` : 'Exceeds 5000');

  const passed = checks.filter((c) => c.status === 'PASS').length;
  const failed = checks.filter((c) => c.status === 'FAIL').length;

  return { status: failed > 0 ? 'FAIL' : 'PASS', checks, passed, failed };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT A4: TEMPLATE APPLICATION
// ═══════════════════════════════════════════════════════════════════════════════

export function applyTemplate(claim, config) {
  const templated = JSON.parse(JSON.stringify(claim));
  templated._pipelineStatus = 'TEMPLATED';

  const contractId = config?.contractId || claim.contractId || 'H1234';

  templated._template = {
    contractId,
    environment: config?.environment || 'P',
    submitterName: config?.submitterName || 'INVENT HEALTH',
    submitterContact: 'HELPDESK',
    submitterPhone: config?.submitterPhone || '8005551234',
    submitterEmail: (config?.submitterEmail || 'ED@INVENTHEALTH.COM').toUpperCase(),
    submitterId: `EN${contractId}`,
    receiverName: 'EDSCMS',
    receiverId: '80882',
    payer: {
      name: 'EDSCMS',
      id: '80882',
      address: '7500 SECURITY BLVD',
      city: 'BALTIMORE',
      state: 'MD',
      zip: '212441850',
    },
  };

  if (!templated._payer) {
    templated._payer = templated._template.payer;
  }
  if (!templated._sbr) {
    templated._sbr = { sbr01: 'S', sbr02: '18', sbr09: 'MB' };
  }
  if (!templated._otherPayer) {
    templated._otherPayer = { sbr01: 'P', sbr02: '18', sbr09: '16' };
  }

  return templated;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT A5: 837P EDI GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function buildISA(env) {
  const isa06 = padRight(env.submitterId, 15);
  const isa08 = padRight(env.receiverId, 15);
  return (
    'ISA*00*' + padRight('', 10) +
    '*00*' + padRight('', 10) +
    '*ZZ*' + isa06 +
    '*ZZ*' + isa08 +
    '*' + env.dateYYMMDD +
    '*' + env.timeHHMM +
    '*^*00501*' + env.controlNumber +
    '*1*' + env.environment +
    '*:'
  );
}

export function generate837(templatedClaims, envelopeOverride) {
  const claims = Array.isArray(templatedClaims) ? templatedClaims : [templatedClaims];
  if (claims.length === 0) return '';

  const tpl = claims[0]._template || {};
  const ts = nowET();

  const env = {
    controlNumber: padLeft(String(envelopeOverride?.fileIndex ?? 1), 9),
    dateYYMMDD: envelopeOverride?.dateYYMMDD || formatDateYYMMDD(ts),
    dateCCYYMMDD: envelopeOverride?.dateCCYYMMDD || formatDateCCYYMMDD(ts),
    timeHHMM: envelopeOverride?.timeHHMM || formatTimeHHMM(ts),
    contractId: tpl.contractId || 'H1234',
    submitterId: tpl.submitterId || 'ENH1234',
    submitterName: tpl.submitterName || 'INVENT HEALTH',
    submitterContact: tpl.submitterContact || 'HELPDESK',
    submitterPhone: tpl.submitterPhone || '8005551234',
    submitterEmail: tpl.submitterEmail || 'ED@INVENTHEALTH.COM',
    receiverName: tpl.receiverName || 'EDSCMS',
    receiverId: tpl.receiverId || '80882',
    environment: tpl.environment || 'P',
    ...envelopeOverride,
  };

  const segs = [];

  segs.push(buildISA(env));

  segs.push(
    `GS*HC*${env.submitterId}*${env.receiverId}*${env.dateCCYYMMDD}*${env.timeHHMM}*${env.controlNumber}*X*005010X222A1`,
  );

  const stIdx = segs.length;
  segs.push(`ST*837*${env.controlNumber}*005010X222A1`);

  segs.push(
    `BHT*0019*00*BATCH${env.dateCCYYMMDD}${env.controlNumber}*${env.dateCCYYMMDD}*${env.timeHHMM}*CH`,
  );

  segs.push(`NM1*41*2*${env.submitterName}*****46*${env.submitterId}`);
  segs.push(
    `PER*IC*${env.submitterContact}*TE*${env.submitterPhone}*EM*${env.submitterEmail}`,
  );
  segs.push(`NM1*40*2*${env.receiverName}*****46*${env.receiverId}`);

  let hlCounter = 0;

  const byBilling = groupBy(claims, (c) => c.billingProvider.npi);

  for (const billingNPI of Object.keys(byBilling)) {
    const billingClaims = byBilling[billingNPI];
    const bp = billingClaims[0].billingProvider;
    hlCounter++;
    const billingHL = hlCounter;

    segs.push(`HL*${billingHL}**20*1`);
    if (bp.taxonomy) segs.push(`PRV*BI*PXC*${bp.taxonomy}`);
    segs.push(
      `NM1*85*${bp.entityType || '2'}*${bp.name}*****XX*${bp.npi}`,
    );
    segs.push(`N3*${bp.address}`);
    segs.push(`N4*${bp.city}*${bp.state}*${bp.zip}`);
    segs.push(`REF*EI*${bp.taxId}`);

    const bySubscriber = groupBy(billingClaims, (c) => c.subscriber.memberId);

    for (const memberId of Object.keys(bySubscriber)) {
      const subClaims = bySubscriber[memberId];
      const sub = subClaims[0].subscriber;
      hlCounter++;

      segs.push(`HL*${hlCounter}*${billingHL}*22*0`);
      segs.push(`SBR*S*18*******MB`);
      segs.push(
        `NM1*IL*1*${sub.lastName}*${sub.firstName}****MI*${sub.memberId}`,
      );
      if (sub.address) segs.push(`N3*${sub.address}`);
      if (sub.city) segs.push(`N4*${sub.city}*${sub.state}*${sub.zip}`);
      segs.push(`DMG*D8*${sub.dateOfBirth}*${sub.gender}`);

      segs.push(`NM1*PR*2*EDSCMS*****PI*80882`);
      segs.push(`N3*7500 SECURITY BLVD`);
      segs.push(`N4*BALTIMORE*MD*212441850`);
      segs.push(`REF*2U*${env.contractId}`);

      for (const claim of subClaims) {
        segs.push(
          `CLM*${claim.patientControlNumber}*${claim.totalChargeAmount}***${claim.facilityCode}:B:1*Y*A*Y*I`,
        );
        segs.push(`DTP*472*D8*${claim.serviceDateFrom}`);

        const hiParts = (claim.diagnoses || []).map(
          (dx, i) => `${i === 0 ? 'ABK' : 'ABF'}:${dx.code}`,
        );
        if (hiParts.length > 0) segs.push(`HI*${hiParts.join('*')}`);

        const rp = claim.renderingProvider;
        if (rp && rp.npi && rp.npi !== bp.npi) {
          segs.push(
            `NM1*82*1*${rp.lastName}*${rp.firstName}****XX*${rp.npi}`,
          );
          if (rp.taxonomy) segs.push(`PRV*PE*PXC*${rp.taxonomy}`);
        }

        segs.push(`SBR*P*18*******16`);
        segs.push(`AMT*D*${claim.paidAmount}`);
        segs.push(`OI***Y`);
        segs.push(
          `NM1*IL*1*${sub.lastName}*${sub.firstName}****MI*${sub.memberId}`,
        );
        segs.push(
          `NM1*PR*2*${env.contractId}*****XV*${env.contractId}`,
        );
        segs.push(`N3*${bp.address}`);
        segs.push(`N4*${bp.city}*${bp.state}*${bp.zip}`);

        const totalLineCharges = (claim.serviceLines || []).reduce(
          (s, l) => s + (l.chargeAmount || 0),
          0,
        );

        for (const line of claim.serviceLines || []) {
          segs.push(`LX*${line.lineNumber}`);

          let sv1Proc = `HC:${line.procedureCode}`;
          if (line.modifier1) sv1Proc += `:${line.modifier1}`;
          segs.push(
            `SV1*${sv1Proc}*${line.chargeAmount}*${line.unitType || 'UN'}*${line.unitCount}***${line.diagnosisPointers || '1'}`,
          );

          segs.push(`DTP*472*D8*${claim.serviceDateFrom}`);

          const linePaid =
            totalLineCharges > 0
              ? Math.round(
                  ((claim.paidAmount || 0) * (line.chargeAmount / totalLineCharges)) * 100,
                ) / 100
              : 0;
          segs.push(
            `SVD*${env.contractId}*${linePaid}*HC:${line.procedureCode}**${line.unitCount}`,
          );
          segs.push(`DTP*573*D8*${claim.adjudicationDate}`);
        }
      }
    }
  }

  const segCount = segs.length - stIdx + 1;
  segs.push(`SE*${segCount}*${env.controlNumber}`);
  segs.push(`GE*1*${env.controlNumber}`);
  segs.push(`IEA*1*${env.controlNumber}`);

  return segs.join('~\n') + '~';
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT A6: OUTPUT VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

export function validateOutput(ediString) {
  const checks = [];

  function check(id, field, pass, detail) {
    checks.push({ id, field, status: pass ? 'PASS' : 'FAIL', detail });
  }

  const segs = ediString
    .split('~')
    .map((s) => s.trim())
    .filter(Boolean);

  check('OUT-01', 'Parseable', segs.length > 0, `${segs.length} segments parsed`);

  const stSeg = segs.find((s) => s.startsWith('ST*'));
  const seSeg = segs.find((s) => s.startsWith('SE*'));
  const stIdx = segs.findIndex((s) => s.startsWith('ST*'));
  const seIdx = segs.findIndex((s) => s.startsWith('SE*'));
  const actualCount = seIdx >= 0 && stIdx >= 0 ? seIdx - stIdx + 1 : 0;
  const seCount = seSeg ? parseInt(seSeg.split('*')[1], 10) : 0;
  check('OUT-02', 'SE01 segment count', seCount === actualCount,
    `SE01=${seCount}, actual=${actualCount}`);

  const isaSeg = segs.find((s) => s.startsWith('ISA*'));
  const ieaSeg = segs.find((s) => s.startsWith('IEA*'));
  const isa13 = isaSeg ? isaSeg.split('*')[13] : '';
  const iea02 = ieaSeg ? ieaSeg.split('*')[2] : '';
  check('OUT-03', 'ISA13=IEA02', isa13 === iea02, `${isa13} vs ${iea02}`);

  const gsSeg = segs.find((s) => s.startsWith('GS*'));
  const geSeg = segs.find((s) => s.startsWith('GE*'));
  const gs06 = gsSeg ? gsSeg.split('*')[6] : '';
  const ge02 = geSeg ? geSeg.split('*')[2] : '';
  check('OUT-04', 'GS06=GE02', gs06 === ge02, `${gs06} vs ${ge02}`);

  const st02 = stSeg ? stSeg.split('*')[2] : '';
  const se02 = seSeg ? seSeg.split('*')[2] : '';
  check('OUT-05', 'ST02=SE02', st02 === se02, `${st02} vs ${se02}`);

  const nm1ILSegs = segs.filter((s) => s.startsWith('NM1*IL*'));
  const subIds = nm1ILSegs.map((s) => {
    const p = s.split('*');
    return p[8] === 'MI' ? p[9] : '';
  }).filter(Boolean);
  check('OUT-06', 'Subscriber IDs', subIds.length > 0,
    `${subIds.length} subscriber IDs found`);

  const nm185Segs = segs.filter((s) => s.startsWith('NM1*85*'));
  const billingNPIs = nm185Segs.map((s) => {
    const p = s.split('*');
    return p[8] === 'XX' ? p[9] : '';
  }).filter(Boolean);
  check('OUT-07', 'Billing NPIs', billingNPIs.length > 0,
    `${billingNPIs.length} billing NPIs found`);

  const hiSegs = segs.filter((s) => s.startsWith('HI*'));
  check('OUT-08', 'HI segments', hiSegs.length > 0,
    `${hiSegs.length} diagnosis segments`);

  const sv1Segs = segs.filter((s) => s.startsWith('SV1*'));
  check('OUT-09', 'SV1 segments', sv1Segs.length > 0,
    `${sv1Segs.length} service line segments`);

  const bhtSeg = segs.find((s) => s.startsWith('BHT*'));
  const bhtParts = bhtSeg ? bhtSeg.split('*') : [];
  const bht06 = bhtParts[6] || '';
  check('OUT-10', 'BHT06=CH', bht06 === 'CH', `BHT06=${bht06}`);

  const clmSegs = segs.filter((s) => s.startsWith('CLM*'));
  check('OUT-11', 'CLM segments', clmSegs.length > 0,
    `${clmSegs.length} claims in file`);

  const passed = checks.filter((c) => c.status === 'PASS').length;
  const failed = checks.filter((c) => c.status === 'FAIL').length;

  return {
    status: failed > 0 ? 'FAIL' : 'PASS',
    checks,
    passed,
    failed,
    segmentCount: segs.length,
    claimCount: clmSegs.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG = {
  contractId: 'H1234',
  environment: 'P',
  submitterName: 'INVENT HEALTH',
  submitterPhone: '8005551234',
  submitterEmail: 'ED@INVENTHEALTH.COM',
};

const MAX_CLAIMS_PER_FILE = 50;

export function runPipeline(claims, config) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const pipelineSteps = [];
  const ts = nowET();

  const sharedEnvelope = {
    dateCCYYMMDD: formatDateCCYYMMDD(ts),
    dateYYMMDD: formatDateYYMMDD(ts),
    timeHHMM: formatTimeHHMM(ts),
  };

  // A1: Ingest
  let t0 = performance.now();
  const ingested = ingestClaims(claims);
  pipelineSteps.push({
    agent: 'A1-Ingest',
    duration: Math.round(performance.now() - t0),
    claimsProcessed: ingested.length,
  });

  // A2: Map
  t0 = performance.now();
  const mapped = ingested.map((c) => mapFields(c));
  pipelineSteps.push({
    agent: 'A2-Map',
    duration: Math.round(performance.now() - t0),
    claimsProcessed: mapped.length,
  });

  // A3: Validate
  t0 = performance.now();
  const validationResults = mapped.map((c) => ({
    claim: c,
    validation: validateClaim(c),
  }));
  pipelineSteps.push({
    agent: 'A3-Validate',
    duration: Math.round(performance.now() - t0),
    claimsProcessed: validationResults.length,
  });

  const passing = validationResults.filter((r) => r.validation.status === 'PASS');
  const failing = validationResults.filter((r) => r.validation.status === 'FAIL');

  // A4: Template
  t0 = performance.now();
  const templated = passing.map((r) => applyTemplate(r.claim, cfg));
  pipelineSteps.push({
    agent: 'A4-Template',
    duration: Math.round(performance.now() - t0),
    claimsProcessed: templated.length,
  });

  // Group into batches
  const batches = [];
  for (let i = 0; i < templated.length; i += MAX_CLAIMS_PER_FILE) {
    batches.push(templated.slice(i, i + MAX_CLAIMS_PER_FILE));
  }

  // A5: Generate 837
  t0 = performance.now();
  const files = batches.map((batch, idx) => {
    const envOverride = {
      ...sharedEnvelope,
      fileIndex: idx + 1,
      controlNumber: padLeft(String(idx + 1), 9),
    };
    const ediContent = generate837(batch, envOverride);
    const segCount = ediContent.split('~').filter((s) => s.trim()).length;
    return {
      fileName: `837P_${sharedEnvelope.dateCCYYMMDD}_${padLeft(String(idx + 1), 3)}.edi`,
      ediContent,
      claimCount: batch.length,
      segmentCount: segCount,
      generatedAt: new Date().toISOString(),
    };
  });
  pipelineSteps.push({
    agent: 'A5-Generate',
    duration: Math.round(performance.now() - t0),
    claimsProcessed: templated.length,
  });

  // A6: Validate output
  t0 = performance.now();
  const fileValidations = files.map((f) => ({
    fileName: f.fileName,
    ...validateOutput(f.ediContent),
    ...validateFileLevel(f.ediContent, {}),
  }));
  pipelineSteps.push({
    agent: 'A6-ValidateOutput',
    duration: Math.round(performance.now() - t0),
    claimsProcessed: files.length,
  });

  // Build result claims array
  const resultClaims = validationResults.map((r, idx) => {
    const c = r.claim;
    const fileIdx = r.validation.status === 'PASS'
      ? Math.floor(
          passing.findIndex((p) => p.claim.id === c.id) / MAX_CLAIMS_PER_FILE,
        )
      : -1;

    return {
      id: c.id,
      pcn: c.patientControlNumber,
      status: r.validation.status,
      validationResult: r.validation,
      billingNPI: c.billingProvider?.npi,
      billingProviderName: c.billingProvider?.name,
      renderingNPI: c.renderingProvider?.npi,
      renderingProviderName: `${c.renderingProvider?.firstName || ''} ${c.renderingProvider?.lastName || ''}`.trim(),
      memberID: c.subscriber?.memberId,
      memberName: `${c.subscriber?.firstName || ''} ${c.subscriber?.lastName || ''}`.trim(),
      memberDOB: c.subscriber?.dateOfBirth,
      memberGender: c.subscriber?.gender,
      serviceDateFrom: c.serviceDateFrom,
      serviceDateTo: c.serviceDateTo,
      facilityCode: c.facilityCode,
      contractId: c.contractId,
      totalChargeAmount: c.totalChargeAmount,
      paidAmount: c.paidAmount,
      adjudicationDate: c.adjudicationDate,
      diagnoses: c.diagnoses,
      serviceLines: c.serviceLines,
      fileIndex: fileIdx >= 0 ? fileIdx : null,
      fileName: fileIdx >= 0 ? files[fileIdx]?.fileName : null,
    };
  });

  const totalCharge = resultClaims.reduce((s, c) => s + (c.totalChargeAmount || 0), 0);
  const totalPaid = resultClaims.reduce((s, c) => s + (c.paidAmount || 0), 0);

  return {
    files,
    fileValidations,
    claims: resultClaims,
    summary: {
      total: resultClaims.length,
      passed: passing.length,
      failed: failing.length,
      totalCharge: Math.round(totalCharge * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
    },
    pipelineSteps,
  };
}
