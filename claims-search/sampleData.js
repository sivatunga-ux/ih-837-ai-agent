// Deterministic pseudo-random number generator (mulberry32)
function createRng(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Data pools ──

const LAST_NAMES = [
  "SMITH", "JOHNSON", "WILLIAMS", "BROWN", "JONES", "GARCIA", "MILLER", "DAVIS",
  "RODRIGUEZ", "MARTINEZ", "HERNANDEZ", "LOPEZ", "GONZALEZ", "WILSON", "ANDERSON",
  "THOMAS", "TAYLOR", "MOORE", "JACKSON", "MARTIN", "LEE", "PEREZ", "THOMPSON",
  "WHITE", "HARRIS", "SANCHEZ", "CLARK", "RAMIREZ", "LEWIS", "ROBINSON", "WALKER",
  "YOUNG", "ALLEN", "KING", "WRIGHT", "SCOTT", "TORRES", "NGUYEN", "HILL", "FLORES",
  "GREEN", "ADAMS", "NELSON", "BAKER", "HALL", "RIVERA", "CAMPBELL", "MITCHELL",
  "CARTER", "ROBERTS"
];

const FIRST_NAMES = [
  "JOHN", "JAMES", "ROBERT", "MICHAEL", "DAVID", "WILLIAM", "RICHARD", "JOSEPH",
  "THOMAS", "CHARLES", "MARY", "PATRICIA", "JENNIFER", "LINDA", "ELIZABETH",
  "BARBARA", "SUSAN", "JESSICA", "SARAH", "KAREN", "MARIA", "NANCY", "BETTY",
  "HELEN", "SANDRA", "DONNA", "CAROL", "RUTH", "SHARON", "MICHELLE", "LAURA",
  "KIMBERLY", "DEBORAH", "DOROTHY", "LISA"
];

const MIDDLE_INITIALS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const CITIES = [
  "Los Angeles", "New York", "Chicago", "Houston", "Phoenix", "Philadelphia",
  "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
  "Fort Worth", "Columbus", "Charlotte", "Indianapolis", "San Francisco",
  "Seattle", "Denver", "Washington", "Nashville", "Oklahoma City", "El Paso",
  "Boston", "Portland", "Memphis", "Louisville", "Baltimore", "Milwaukee",
  "Albuquerque"
];

const STATES = [
  "CA", "NY", "IL", "TX", "AZ", "PA", "FL", "OH", "NC", "IN",
  "WA", "CO", "DC", "TN", "OK", "MA", "OR", "MD", "WI", "NM"
];

const PAYER_NAMES = [
  "BLUE CROSS BLUE SHIELD", "AETNA", "UNITED HEALTHCARE", "CIGNA", "HUMANA",
  "KAISER PERMANENTE", "ANTHEM", "MOLINA HEALTHCARE", "CENTENE", "WELLCARE",
  "MEDICARE ADVANTAGE", "MEDICAID MANAGED CARE"
];

const PROVIDER_ORGS = [
  "ACME MEDICAL GROUP", "VALLEY HEALTH CENTER", "CITY MEDICAL ASSOCIATES",
  "PREMIER HEALTHCARE", "NORTHWEST MEDICAL", "SUNRISE HEALTH CLINIC",
  "COASTAL CARE PHYSICIANS", "MOUNTAIN VIEW MEDICAL", "RIVERSIDE HEALTH GROUP",
  "CENTRAL CLINIC"
];

const DIAGNOSIS_CODES = [
  "E11.9", "I10", "J44.1", "E78.5", "N18.6", "K21.0", "M79.3", "F32.9",
  "G47.33", "Z87.891", "E11.65", "I25.10", "J06.9", "M54.5", "E03.9",
  "R10.9", "J18.9", "N39.0", "L70.0", "Z23"
];

const CPT_CODES = [
  "99213", "99214", "99215", "99203", "99204", "99212", "36415", "81002",
  "93000", "99232", "99233", "99291", "71046", "74177", "80053", "85025",
  "90471", "90686", "99395", "99385"
];

const REVENUE_CODES = ["0120", "0250", "0260", "0270", "0300", "0301", "0320", "0450", "0636"];

const POS_CODES = ["11", "12", "22", "23", "31", "32", "49", "50"];

const DX_QUALIFIERS = ["ABK", "ABF", "ABJ", "ABN"];

const TAXONOMIES = [
  "207Q00000X", "207R00000X", "208D00000X", "207X00000X", "208600000X",
  "363L00000X", "207V00000X", "208000000X", "2084N0400X", "207Y00000X"
];

const STREET_NAMES = [
  "Main St", "Oak Ave", "Elm Dr", "Maple Ln", "Pine Rd", "Cedar Blvd",
  "Walnut Way", "Cherry Ct", "Birch Pl", "Spruce Ter", "Willow St",
  "Ash Ave", "Poplar Dr", "Hickory Ln", "Cypress Rd"
];

// ── Helpers ──

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function pickWeighted(rng, items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function padNum(n, len) {
  return String(n).padStart(len, "0");
}

function formatDate(d) {
  return `${d.getFullYear()}-${padNum(d.getMonth() + 1, 2)}-${padNum(d.getDate(), 2)}`;
}

function generateNPI(rng) {
  let npi = "1";
  for (let i = 1; i < 10; i++) npi += Math.floor(rng() * 10);
  return npi;
}

function generateTaxId(rng) {
  let a = padNum(Math.floor(rng() * 100), 2);
  let b = padNum(Math.floor(rng() * 10000000), 7);
  return `${a}-${b}`;
}

function generateZip(rng) {
  return padNum(Math.floor(rng() * 90000) + 10000, 5);
}

function randomDate(rng, startMs, endMs) {
  const ms = startMs + Math.floor(rng() * (endMs - startMs));
  return new Date(ms);
}

function randomCharge(rng, min, max) {
  return Math.round((min + rng() * (max - min)) * 100) / 100;
}

// ── Generation ──

const SERVICE_DATE_START = new Date("2023-01-01").getTime();
const SERVICE_DATE_END = new Date("2025-03-23").getTime();

const CLAIM_STATUSES = ["SUBMITTED", "ACCEPTED", "READY", "CONVERTED", "DRAFT", "REJECTED"];
const STATUS_WEIGHTS = [40, 25, 15, 10, 5, 5];

function generateClaim(index) {
  const rng = createRng(index * 7919 + 42);

  const id = `CLM-${padNum(index + 1, 6)}`;
  const pcn = `PCN-${padNum(index + 1, 6)}`;

  const claimType = rng() < 0.7 ? "837P" : "837I";
  const claimStatus = pickWeighted(rng, CLAIM_STATUSES, STATUS_WEIGHTS);

  const serviceFrom = randomDate(rng, SERVICE_DATE_START, SERVICE_DATE_END);
  const daysSpan = claimType === "837I" ? Math.floor(rng() * 5) : 0;
  const serviceTo = new Date(serviceFrom.getTime() + daysSpan * 86400000);

  const facilityCode = pick(rng, POS_CODES);

  const lastName = pick(rng, LAST_NAMES);
  const firstName = pick(rng, FIRST_NAMES);
  const middleName = pick(rng, MIDDLE_INITIALS);
  const gender = firstName === "MARY" || firstName === "PATRICIA" || firstName === "JENNIFER" ||
    firstName === "LINDA" || firstName === "ELIZABETH" || firstName === "BARBARA" ||
    firstName === "SUSAN" || firstName === "JESSICA" || firstName === "SARAH" ||
    firstName === "KAREN" || firstName === "MARIA" || firstName === "NANCY" ||
    firstName === "BETTY" || firstName === "HELEN" || firstName === "SANDRA" ||
    firstName === "DONNA" || firstName === "CAROL" || firstName === "RUTH" ||
    firstName === "SHARON" || firstName === "MICHELLE" || firstName === "LAURA" ||
    firstName === "KIMBERLY" || firstName === "DEBORAH" || firstName === "DOROTHY" ||
    firstName === "LISA" ? "F" : "M";

  const dobYear = 1940 + Math.floor(rng() * 60);
  const dobMonth = Math.floor(rng() * 12);
  const dobDay = 1 + Math.floor(rng() * 28);
  const dob = new Date(dobYear, dobMonth, dobDay);

  const cityIdx = Math.floor(rng() * CITIES.length);
  const city = CITIES[cityIdx];
  const state = STATES[cityIdx % STATES.length];
  const zipCode = generateZip(rng);
  const streetNum = 100 + Math.floor(rng() * 9900);
  const streetName = pick(rng, STREET_NAMES);

  const memberId = `W${padNum(100000001 + index, 9)}`;

  const billingOrg = pick(rng, PROVIDER_ORGS);
  const billingNpi = generateNPI(rng);
  const billingTaxId = generateTaxId(rng);
  const billingCityIdx = Math.floor(rng() * CITIES.length);

  const rendLastName = pick(rng, LAST_NAMES);
  const rendFirstName = pick(rng, FIRST_NAMES);
  const rendNpi = generateNPI(rng);
  const rendTaxonomy = pick(rng, TAXONOMIES);

  const payer = pick(rng, PAYER_NAMES);
  const payerIdNum = padNum(10000 + Math.floor(rng() * 90000), 5);

  const diagCount = 1 + Math.floor(rng() * 5);
  const usedDx = new Set();
  const diagnoses = [];
  for (let d = 0; d < diagCount; d++) {
    let code;
    let attempts = 0;
    do {
      code = pick(rng, DIAGNOSIS_CODES);
      attempts++;
    } while (usedDx.has(code) && attempts < 20);
    usedDx.add(code);
    diagnoses.push({
      sequence: d + 1,
      code,
      qualifier: pick(rng, DX_QUALIFIERS)
    });
  }

  const lineCount = 1 + Math.floor(rng() * 4);
  const serviceLines = [];
  let totalCharge = 0;
  for (let l = 0; l < lineCount; l++) {
    const chargeAmount = randomCharge(rng, 50, 5000);
    totalCharge += chargeAmount;
    const unitCount = 1 + Math.floor(rng() * 4);
    serviceLines.push({
      lineNumber: l + 1,
      procedureCode: pick(rng, CPT_CODES),
      chargeAmount,
      unitCount,
      unitType: "UN",
      revenueCode: claimType === "837I" ? pick(rng, REVENUE_CODES) : ""
    });
  }
  totalCharge = Math.round(totalCharge * 100) / 100;

  return {
    id,
    claimType,
    claimStatus,
    patientControlNumber: pcn,
    totalChargeAmount: totalCharge,
    facilityCode,
    serviceDateFrom: formatDate(serviceFrom),
    serviceDateTo: formatDate(serviceTo),
    subscriber: {
      memberId,
      lastName,
      firstName,
      middleName,
      dateOfBirth: formatDate(dob),
      gender,
      addressLine1: `${streetNum} ${streetName}`,
      city,
      state,
      zipCode
    },
    billingProvider: {
      npi: billingNpi,
      name: billingOrg,
      taxId: billingTaxId,
      entityType: "2",
      city: CITIES[billingCityIdx],
      state: STATES[billingCityIdx % STATES.length]
    },
    renderingProvider: {
      npi: rendNpi,
      name: `Dr. ${rendFirstName.charAt(0)}${rendFirstName.slice(1).toLowerCase()} ${rendLastName.charAt(0)}${rendLastName.slice(1).toLowerCase()}`,
      firstName: rendFirstName,
      lastName: rendLastName,
      taxonomy: rendTaxonomy,
      entityType: "1"
    },
    payer: {
      id: payerIdNum,
      name: payer
    },
    diagnoses,
    serviceLines
  };
}

export const TOTAL_CLAIM_COUNT = 250;

export const SAMPLE_CLAIMS = Array.from({ length: TOTAL_CLAIM_COUNT }, (_, i) => generateClaim(i));
