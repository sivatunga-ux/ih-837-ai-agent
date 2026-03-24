const asUpperSet = (codes) => new Set(codes.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean));
const asNdcSet = (codes) => new Set(
  codes
    .map((code) => String(code || "").replace(/[^0-9]/g, ""))
    .filter((code) => code.length === 11)
);

// Demo-friendly seed tables. In production, hydrate these from full code masters.
export const CODESET_TABLES = {
  ICD10_CM: asUpperSet([
    "E11.9",
    "I12.0",
    "N18.6",
    "Z89.9",
    "Z94.0",
    "Z99.2"
  ]),
  CPT: asUpperSet([
    "27880",
    "27882",
    "27590",
    "27592",
    "36415",
    "50360",
    "50365",
    "81002",
    "93000",
    "99213",
    "99341",
    "99342",
    "99344",
    "99345",
    "99347",
    "99348",
    "99349",
    "99350"
  ]),
  ICD10_PCS: asUpperSet([
    "0TY00Z0",
    "30243N1",
    "0Y6J0Z0"
  ]),
  HCPCS: asUpperSet([
    "G0402",
    "G0438",
    "G0439",
    "J3490",
    "J3590",
    "J9999"
  ]),
  HCPCS_CPT_MODIFIERS: asUpperSet([
    "25",
    "26",
    "59",
    "76",
    "77",
    "91",
    "95",
    "GT",
    "TC"
  ]),
  HIPPS: asUpperSet([
    "HHAA1",
    "HHRB2",
    "NKTA1"
  ]),
  REVENUE: asUpperSet([
    "0250",
    "0300",
    "0360",
    "0450",
    "0510",
    "0521",
    "0636"
  ]),
  NDC: asNdcSet([
    "00002-0003-01",
    "00054-0018-13",
    "54868-4335-00"
  ])
};

export const CODE_QUALIFIERS = {
  HI_DIAGNOSIS: new Set(["ABK", "ABF", "ABJ", "ABN", "APR"]),
  HI_PROCEDURE: new Set(["BBR", "BBQ", "BBP"]),
  SV1_PROCEDURE: new Set(["HC"]),
  SV2_PROCEDURE: new Set(["HC", "HP"]),
  NDC_PRODUCT_ID: new Set(["N4"])
};

export function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

export function normalizeNdc(code) {
  return String(code || "").replace(/[^0-9]/g, "");
}
