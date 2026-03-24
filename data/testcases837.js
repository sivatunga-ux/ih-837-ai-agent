/**
 * 837 Mapping Validation Test Cases
 *
 * Each test case provides raw EDI input, expected parsed values,
 * expected findings/codes, and expected repair outcomes.
 * Covers both 837P (Professional) and 837I (Institutional).
 */

import { splitSegs, getSubscriberId, getRenderingNPI, getDOS, getClaimPOS, getCPTs, getICDs, validate837, applyRepairs, computeStatus } from "../rules/validation.js";
import { detectDelimiters } from "./delimiters.js";

/* ─── Helper: run a single test case and return result object ─── */
function runCase(tc) {
  const result = { id: tc.id, name: tc.name, type: tc.type, checks: [], pass: true };

  const check = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    result.checks.push({ label, actual, expected, ok });
    if (!ok) result.pass = false;
  };

  const segs = splitSegs(tc.raw);
  check("splitSegs count", segs.length, tc.expect.segCount);

  if (tc.expect.memberId !== undefined)  check("getSubscriberId",  getSubscriberId(segs),  tc.expect.memberId);
  if (tc.expect.npi !== undefined)       check("getRenderingNPI",  getRenderingNPI(segs),   tc.expect.npi);
  if (tc.expect.dos !== undefined)       check("getDOS",           getDOS(segs),            tc.expect.dos);
  if (tc.expect.pos !== undefined)       check("getClaimPOS",      getClaimPOS(segs),       tc.expect.pos);
  if (tc.expect.cpts !== undefined)      check("getCPTs",          getCPTs(segs),           tc.expect.cpts);
  if (tc.expect.icds !== undefined)      check("getICDs",          getICDs(segs),           tc.expect.icds);

  const v = validate837(tc.raw);
  if (tc.expect.status !== undefined)    check("computeStatus",    computeStatus(v.findings), tc.expect.status);

  if (tc.expect.findingCodes !== undefined) {
    const codes = v.findings.map(f => f.code).sort();
    const expected = [...tc.expect.findingCodes].sort();
    check("finding codes", codes, expected);
  }

  if (tc.expect.findingLevels !== undefined) {
    const levels = v.findings.map(f => f.level).sort();
    const expected = [...tc.expect.findingLevels].sort();
    check("finding levels", levels, expected);
  }

  if (tc.expect.repairTypes !== undefined) {
    const rep = applyRepairs(tc.raw);
    const types = rep.repairs.map(r => r.type).sort();
    const expected = [...tc.expect.repairTypes].sort();
    check("repair types", types, expected);
  }

  if (tc.expect.repairedPOS !== undefined) {
    const rep = applyRepairs(tc.raw);
    const repairedSegs = splitSegs(rep.repaired);
    const newPOS = getClaimPOS(repairedSegs);
    check("repaired POS", newPOS, tc.expect.repairedPOS);
  }

  if (tc.expect.delimiterDetection !== undefined) {
    const d = detectDelimiters(tc.raw);
    for (const [key, val] of Object.entries(tc.expect.delimiterDetection)) {
      check(`delimiter.${key}`, d[key], val);
    }
  }

  return result;
}

/* ─── 837P Professional Test Cases ─── */
export const PRO_TEST_CASES = [
  {
    id: "P01",
    name: "Valid claim — all required fields present",
    type: "837P",
    raw: `ST*837*0001~\nNM1*IL*1*DOE*JOHN****MI*W111111111~\nDMG*D8*19800101*M~\nNM1*82*1*Smith*Jane****XX*1234567890~\nCLM*CLM001*250***11:B:1*Y*A*Y*I~\nDTP*472*D8*20240115~\nHI*ABK:E11.9~\nSV1*HC:99213*150*UN*1~`,
    expect: {
      segCount: 8,
      memberId: "W111111111",
      npi: "1234567890",
      dos: "20240115",
      pos: "11",
      cpts: ["99213"],
      icds: ["E11.9"],
      status: "PASS",
      findingCodes: [],
      repairTypes: []
    }
  },
  {
    id: "P02",
    name: "Missing subscriber ID (NM1*IL without MI qualifier)",
    type: "837P",
    raw: `ST*837*0002~\nNM1*IL*1*DOE*JOHN****ZZ*W222222222~\nNM1*82*1*Smith*Jane****XX*1234567890~\nCLM*CLM002*100***11:B:1*Y*A*Y*I~\nDTP*472*D8*20240201~\nHI*ABK:J44.1~\nSV1*HC:99213*100*UN*1~`,
    expect: {
      segCount: 7,
      memberId: "",
      npi: "1234567890",
      dos: "20240201",
      status: "FAIL",
      findingCodes: ["MISSING_SUBSCRIBER_ID"]
    }
  },
  {
    id: "P03",
    name: "Missing date of service (no DTP*472)",
    type: "837P",
    raw: `ST*837*0003~\nNM1*IL*1*DOE*JOHN****MI*W333333333~\nNM1*82*1*Smith*Jane****XX*1234567890~\nCLM*CLM003*200***11:B:1*Y*A*Y*I~\nHI*ABK:E11.9~\nSV1*HC:99213*200*UN*1~`,
    expect: {
      segCount: 6,
      memberId: "W333333333",
      dos: "",
      status: "FAIL",
      findingCodes: ["MISSING_DOS"]
    }
  },
  {
    id: "P04",
    name: "Invalid date of service format",
    type: "837P",
    raw: `ST*837*0004~\nNM1*IL*1*DOE*JOHN****MI*W444444444~\nNM1*82*1*Smith*Jane****XX*1234567890~\nCLM*CLM004*100***11:B:1*Y*A*Y*I~\nDTP*472*D8*20241301~\nHI*ABK:E11.9~\nSV1*HC:99213*100*UN*1~`,
    expect: {
      segCount: 7,
      dos: "20241301",
      status: "FAIL",
      findingCodes: ["INVALID_DOS"]
    }
  },
  {
    id: "P05",
    name: "Missing rendering provider NPI",
    type: "837P",
    raw: `ST*837*0005~\nNM1*IL*1*DOE*JOHN****MI*W555555555~\nCLM*CLM005*100***11:B:1*Y*A*Y*I~\nDTP*472*D8*20240301~\nHI*ABK:E11.9~\nSV1*HC:99213*100*UN*1~`,
    expect: {
      segCount: 6,
      npi: "",
      status: "FAIL",
      findingCodes: ["MISSING_RENDERING_NPI"]
    }
  },
  {
    id: "P06",
    name: "Non-risk-eligible CPT codes (lab/radiology) → RA_BLOCK",
    type: "837P",
    raw: `ST*837*0006~\nNM1*IL*1*DOE*JOHN****MI*W666666666~\nNM1*82*1*Smith*Jane****XX*1234567890~\nCLM*CLM006*50***11:B:1*Y*A*Y*I~\nDTP*472*D8*20240401~\nHI*ABK:E11.9~\nSV1*HC:36415*10*UN*1~\nSV1*HC:81002*20*UN*1~`,
    expect: {
      segCount: 8,
      cpts: ["36415", "81002"],
      status: "RA_BLOCKED",
      findingCodes: ["NON_RISK_ELIGIBLE_CPT"],
      findingLevels: ["RA_BLOCK"]
    }
  },
  {
    id: "P07",
    name: "Pharmacy-only services (J-codes only) → RA_BLOCK",
    type: "837P",
    raw: `ST*837*0007~\nNM1*IL*1*DOE*JOHN****MI*W777777777~\nNM1*82*1*Smith*Jane****XX*1234567890~\nCLM*CLM007*250***11:B:1*Y*A*Y*I~\nDTP*472*D8*20240501~\nHI*ABK:E11.9~\nSV1*HC:J3490*120*UN*1~\nSV1*HC:J9999*130*UN*1~`,
    expect: {
      segCount: 8,
      cpts: ["J3490", "J9999"],
      status: "RA_BLOCKED",
      findingCodes: ["PHARMACY_ONLY_SERVICES"],
      findingLevels: ["RA_BLOCK"]
    }
  },
  {
    id: "P08",
    name: "Amputation CPT present but Z89 status missing → SIGNAL",
    type: "837P",
    raw: `ST*837*0008~\nNM1*IL*1*DOE*JOHN****MI*W888888888~\nNM1*82*1*Smith*Jane****XX*1234567890~\nCLM*CLM008*500***11:B:1*Y*A*Y*I~\nDTP*472*D8*20240601~\nHI*ABK:E11.9~\nSV1*HC:27880*500*UN*1~`,
    expect: {
      segCount: 7,
      cpts: ["27880"],
      status: "PASS",
      findingCodes: ["AMP_STATUS_MISSING_Z89"]
    }
  },
  {
    id: "P09",
    name: "Transplant CPT present but Z94 status missing → SIGNAL",
    type: "837P",
    raw: `ST*837*0009~\nNM1*IL*1*DOE*JOHN****MI*W999999999~\nNM1*82*1*Smith*Jane****XX*1234567890~\nCLM*CLM009*800***11:B:1*Y*A*Y*I~\nDTP*472*D8*20240701~\nHI*ABK:I12.0~\nSV1*HC:50360*800*UN*1~`,
    expect: {
      segCount: 7,
      cpts: ["50360"],
      icds: ["I12.0"],
      status: "PASS",
      findingCodes: ["TX_STATUS_MISSING_Z94"]
    }
  },
  {
    id: "P10",
    name: "ESRD (N18.6) without dialysis dependence Z99.2 → SIGNAL",
    type: "837P",
    raw: `ST*837*0010~\nNM1*IL*1*DOE*JOHN****MI*W101010101~\nNM1*82*1*Smith*Jane****XX*1234567890~\nCLM*CLM010*200***11:B:1*Y*A*Y*I~\nDTP*472*D8*20240801~\nHI*ABK:N18.6~\nSV1*HC:99213*200*UN*1~`,
    expect: {
      segCount: 7,
      icds: ["N18.6"],
      status: "PASS",
      findingCodes: ["ESRD_DEPENDENCE_MISSING_Z992"]
    }
  },
  {
    id: "P11",
    name: "Invalid diagnosis code format → WARN",
    type: "837P",
    raw: `ST*837*0011~\nNM1*IL*1*DOE*JOHN****MI*W111111112~\nNM1*82*1*Smith*Jane****XX*1234567890~\nCLM*CLM011*120***11:B:1*Y*A*Y*I~\nDTP*472*D8*20240901~\nHI*ABK:E11.9X*ABK:N18.6~\nSV1*HC:99213*120*UN*1~`,
    expect: {
      segCount: 7,
      icds: ["E11.9X", "N18.6"],
      status: "PASS",
      findingCodes: ["INVALID_DIAGNOSIS", "ESRD_DEPENDENCE_MISSING_Z992"]
    }
  },
  {
    id: "P12",
    name: "Invalid POS code → WARN + auto-repair to 11",
    type: "837P",
    raw: `ST*837*0012~\nNM1*IL*1*DOE*JOHN****MI*W121212121~\nNM1*82*1*Smith*Jane****XX*1234567890~\nCLM*CLM012*100***99:B:1*Y*A*Y*I~\nDTP*472*D8*20241001~\nHI*ABK:E11.9~\nSV1*HC:99213*100*UN*1~`,
    expect: {
      segCount: 7,
      pos: "99",
      status: "PASS",
      findingCodes: ["INVALID_POS"],
      repairTypes: ["FIX_POS"],
      repairedPOS: "11"
    }
  },
  {
    id: "P13",
    name: "Provider name casing repair (UPPERCASE → Title Case)",
    type: "837P",
    raw: `ST*837*0013~\nNM1*IL*1*DOE*JOHN****MI*W131313131~\nNM1*82*1*JOHNSON*ROBERT****XX*1234567890~\nCLM*CLM013*100***11:B:1*Y*A*Y*I~\nDTP*472*D8*20241101~\nHI*ABK:E11.9~\nSV1*HC:99213*100*UN*1~`,
    expect: {
      segCount: 7,
      status: "PASS",
      repairTypes: ["NORMALIZE_PROVIDER_NAME"]
    }
  },
  {
    id: "P14",
    name: "Multiple fatal errors — missing subscriber, DOS, and NPI",
    type: "837P",
    raw: `ST*837*0014~\nCLM*CLM014*100***11:B:1*Y*A*Y*I~\nHI*ABK:E11.9~\nSV1*HC:99213*100*UN*1~`,
    expect: {
      segCount: 4,
      memberId: "",
      npi: "",
      dos: "",
      status: "FAIL",
      findingCodes: ["MISSING_SUBSCRIBER_ID", "MISSING_DOS", "MISSING_RENDERING_NPI"]
    }
  },
  {
    id: "P15",
    name: "Multiple HI composites in single segment",
    type: "837P",
    raw: `ST*837*0015~\nNM1*IL*1*DOE*JOHN****MI*W151515151~\nNM1*82*1*Smith*Jane****XX*1234567890~\nCLM*CLM015*300***11:B:1*Y*A*Y*I~\nDTP*472*D8*20241201~\nHI*ABK:E11.9*ABK:I10*ABK:J44.1~\nSV1*HC:99213*300*UN*1~`,
    expect: {
      segCount: 7,
      icds: ["E11.9", "I10", "J44.1"],
      status: "PASS",
      findingCodes: []
    }
  },
  {
    id: "P16",
    name: "Multiple SV1 service lines — mixed CPTs",
    type: "837P",
    raw: `ST*837*0016~\nNM1*IL*1*DOE*JOHN****MI*W161616161~\nNM1*82*1*Smith*Jane****XX*1234567890~\nCLM*CLM016*550***11:B:1*Y*A*Y*I~\nDTP*472*D8*20250101~\nHI*ABK:E11.9~\nSV1*HC:99213*150*UN*1~\nSV1*HC:36415*10*UN*1~\nSV1*HC:93000*390*UN*1~`,
    expect: {
      segCount: 9,
      cpts: ["99213", "36415", "93000"],
      status: "RA_BLOCKED",
      findingCodes: ["NON_RISK_ELIGIBLE_CPT"]
    }
  }
];

/* ─── 837I Institutional Test Cases ─── */
export const INST_TEST_CASES = [
  {
    id: "I01",
    name: "Valid institutional claim — all required fields",
    type: "837I",
    raw: `ST*837*1001~\nNM1*IL*1*DOE*JAMES****MI*W201010101~\nDMG*D8*19620202*F~\nNM1*82*1*GENERAL*HOSPITAL****XX*1999999999~\nCLM*INST001*2500***22:A:1*Y*A*Y*I~\nDTP*472*D8*20240501~\nHI*ABK:E11.9~\nSV1*HC:99213*2500*UN*1~`,
    expect: {
      segCount: 8,
      memberId: "W201010101",
      npi: "1999999999",
      dos: "20240501",
      pos: "22",
      cpts: ["99213"],
      icds: ["E11.9"],
      status: "PASS",
      findingCodes: []
    }
  },
  {
    id: "I02",
    name: "Institutional — non-risk-eligible CPTs (lab/radiology only)",
    type: "837I",
    raw: `ST*837*1002~\nNM1*IL*1*DOE*JAMES****MI*W202020202~\nDMG*D8*19620202*F~\nNM1*82*1*FACILITY*RAD****XX*1888888888~\nCLM*INST002*420***22:B:1*Y*A*Y*I~\nDTP*472*D8*20240410~\nHI*ABK:E11.9~\nSV1*HC:36415*20*UN*1~\nSV1*HC:93000*400*UN*1~`,
    expect: {
      segCount: 9,
      memberId: "W202020202",
      cpts: ["36415", "93000"],
      status: "RA_BLOCKED",
      findingCodes: ["NON_RISK_ELIGIBLE_CPT"]
    }
  },
  {
    id: "I03",
    name: "Institutional — missing subscriber ID",
    type: "837I",
    raw: `ST*837*1003~\nNM1*82*1*HOSPITAL*GEN****XX*1777777777~\nCLM*INST003*1000***22:B:1*Y*A*Y*I~\nDTP*472*D8*20240601~\nHI*ABK:J44.1~\nSV1*HC:99213*1000*UN*1~`,
    expect: {
      segCount: 6,
      memberId: "",
      status: "FAIL",
      findingCodes: ["MISSING_SUBSCRIBER_ID"]
    }
  },
  {
    id: "I04",
    name: "Institutional — pharmacy-only lines",
    type: "837I",
    raw: `ST*837*1004~\nNM1*IL*1*DOE*JANE****MI*W404040404~\nNM1*82*1*Hospital*Main****XX*1666666666~\nCLM*INST004*600***22:B:1*Y*A*Y*I~\nDTP*472*D8*20240801~\nHI*ABK:E11.9~\nSV1*HC:J3490*300*UN*1~\nSV1*HC:J3590*300*UN*1~`,
    expect: {
      segCount: 8,
      cpts: ["J3490", "J3590"],
      status: "RA_BLOCKED",
      findingCodes: ["PHARMACY_ONLY_SERVICES"]
    }
  },
  {
    id: "I05",
    name: "Institutional — invalid POS + provider name repair",
    type: "837I",
    raw: `ST*837*1005~\nNM1*IL*1*DOE*JAMES****MI*W505050505~\nNM1*82*1*CITYMED*CENTER****XX*1555555555~\nCLM*INST005*800***00:B:1*Y*A*Y*I~\nDTP*472*D8*20240901~\nHI*ABK:E11.9~\nSV1*HC:99213*800*UN*1~`,
    expect: {
      segCount: 7,
      pos: "00",
      status: "PASS",
      findingCodes: ["INVALID_POS"],
      repairTypes: ["FIX_POS"],
      repairedPOS: "11"
    }
  }
];

/* ─── Delimiter Detection Test Cases ─── */
export const DELIMITER_TEST_CASES = [
  {
    id: "D01",
    name: "Standard delimiters — * : ~ ^",
    type: "Delimiter",
    raw: "ISA*00*          *00*          *ZZ*SENDER_ID      *ZZ*RECEIVER_ID    *240101*1200*^*00501*000000001*0*P*:~GS*HC*SENDER*RECEIVER*20240101*1200*1*X*005010X222A1~",
    expect: {
      segCount: 2,
      delimiterDetection: {
        element: "*",
        subElement: ":",
        segment: "~",
        repetition: "^",
        detected: true
      }
    }
  },
  {
    id: "D02",
    name: "Pipe element separator — | : ~ ^",
    type: "Delimiter",
    raw: "ISA|00|          |00|          |ZZ|SENDER_ID      |ZZ|RECEIVER_ID    |240101|1200|^|00501|000000001|0|P|:~GS|HC|SENDER|RECEIVER|20240101|1200|1|X|005010X222A1~",
    expect: {
      segCount: 2,
      delimiterDetection: {
        element: "|",
        subElement: ":",
        segment: "~",
        repetition: "^",
        detected: true
      }
    }
  },
  {
    id: "D03",
    name: "No ISA header — fallback to defaults",
    type: "Delimiter",
    raw: "ST*837*0001~\nBHT*0019*00*12345*20240101*1200*CH~",
    expect: {
      segCount: 2,
      delimiterDetection: {
        element: "*",
        subElement: ":",
        segment: "~",
        repetition: "^",
        detected: false
      }
    }
  },
  {
    id: "D04",
    name: "Truncated ISA — too short for delimiter extraction",
    type: "Delimiter",
    raw: "ISA*00*   *00*   *ZZ*SHORT~",
    expect: {
      segCount: 1,
      delimiterDetection: {
        detected: false
      }
    }
  }
];

/* ─── Run all tests ─── */
export function runAllTests() {
  const all = [...PRO_TEST_CASES, ...INST_TEST_CASES, ...DELIMITER_TEST_CASES];
  return all.map(runCase);
}

export function runTestsByType(type) {
  let cases;
  if (type === "837P") cases = PRO_TEST_CASES;
  else if (type === "837I") cases = INST_TEST_CASES;
  else if (type === "Delimiter") cases = DELIMITER_TEST_CASES;
  else cases = [...PRO_TEST_CASES, ...INST_TEST_CASES, ...DELIMITER_TEST_CASES];
  return cases.map(runCase);
}
