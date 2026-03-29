// sampleClaims.js — 500 deterministic professional encounter claims
// Self-contained ES module with seeded PRNG. No external dependencies.

// ── Deterministic PRNG (mulberry32) ──────────────────────────────────────────

function createRng(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  return String(n).padStart(len, '0');
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ── NPI generation with Luhn check digit ─────────────────────────────────────

function computeNPICheckDigit(npi9) {
  const payload = ('80840' + npi9).split('').map(Number);
  let sum = 0;
  let shouldDouble = true;
  for (let i = payload.length - 1; i >= 0; i--) {
    let d = payload[i];
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return (10 - (sum % 10)) % 10;
}

function generateValidNPI(rng) {
  let npi9 = '1';
  for (let i = 1; i < 9; i++) npi9 += Math.floor(rng() * 10);
  return npi9 + computeNPICheckDigit(npi9);
}

// ── MBI (Medicare Beneficiary Identifier) generation ─────────────────────────

const MBI_ALPHA = 'CDEFGHJKMNPQRTUVWXY'.split('');
const MBI_ALPHANUM = '0123456789CDEFGHJKMNPQRTUVWXY'.split('');

function generateMBI(rng) {
  return (
    String(1 + Math.floor(rng() * 9)) +
    pick(rng, MBI_ALPHA) +
    pick(rng, MBI_ALPHANUM) +
    String(Math.floor(rng() * 10)) +
    pick(rng, MBI_ALPHA) +
    pick(rng, MBI_ALPHANUM) +
    String(Math.floor(rng() * 10)) +
    pick(rng, MBI_ALPHA) +
    pick(rng, MBI_ALPHA) +
    String(Math.floor(rng() * 10)) +
    String(Math.floor(rng() * 10))
  );
}

// ── EIN generation (9 digits, no dash for 837) ──────────────────────────────

function generateEIN(rng) {
  return padNum(10 + Math.floor(rng() * 90), 2) + padNum(Math.floor(rng() * 10000000), 7);
}

// ── Data pools ───────────────────────────────────────────────────────────────

const LAST_NAMES = [
  'SMITH', 'JOHNSON', 'WILLIAMS', 'BROWN', 'JONES', 'GARCIA', 'MILLER', 'DAVIS',
  'RODRIGUEZ', 'MARTINEZ', 'HERNANDEZ', 'LOPEZ', 'GONZALEZ', 'WILSON', 'ANDERSON',
  'THOMAS', 'TAYLOR', 'MOORE', 'JACKSON', 'MARTIN', 'LEE', 'PEREZ', 'THOMPSON',
  'WHITE', 'HARRIS', 'SANCHEZ', 'CLARK', 'RAMIREZ', 'LEWIS', 'ROBINSON',
  'WALKER', 'YOUNG', 'ALLEN', 'KING', 'WRIGHT', 'SCOTT', 'TORRES', 'NGUYEN',
  'HILL', 'FLORES', 'GREEN', 'ADAMS', 'NELSON', 'BAKER', 'HALL', 'RIVERA',
  'CAMPBELL', 'MITCHELL', 'CARTER', 'ROBERTS',
];

const FIRST_NAMES_MALE = [
  'JAMES', 'JOHN', 'ROBERT', 'MICHAEL', 'DAVID', 'WILLIAM', 'RICHARD', 'JOSEPH',
  'THOMAS', 'CHARLES', 'DANIEL', 'MATTHEW', 'ANTHONY', 'MARK', 'DONALD',
  'STEVEN', 'PAUL', 'ANDREW', 'JOSHUA', 'KENNETH', 'KEVIN', 'BRIAN', 'GEORGE',
  'TIMOTHY', 'RONALD',
];

const FIRST_NAMES_FEMALE = [
  'MARY', 'PATRICIA', 'JENNIFER', 'LINDA', 'ELIZABETH', 'BARBARA', 'SUSAN',
  'JESSICA', 'SARAH', 'KAREN', 'MARIA', 'NANCY', 'BETTY', 'HELEN', 'SANDRA',
  'DONNA', 'CAROL', 'RUTH', 'SHARON', 'MICHELLE', 'LAURA', 'KIMBERLY',
  'DEBORAH', 'DOROTHY', 'LISA',
];

const PROVIDER_ORG_NAMES = [
  'PREMIER HEALTHCARE GROUP',
  'VALLEY MEDICAL ASSOCIATES',
  'COASTAL CARE PHYSICIANS',
  'MOUNTAIN VIEW MEDICAL CENTER',
  'SUNRISE HEALTH CLINIC',
  'CENTRAL MEDICAL GROUP',
  'NORTHWEST FAMILY MEDICINE',
  'LAKESIDE HEALTH PARTNERS',
];

const PROVIDER_LOCATIONS = [
  { city: 'LOS ANGELES', state: 'CA', zip: '900129998' },
  { city: 'CHICAGO', state: 'IL', zip: '606019998' },
  { city: 'HOUSTON', state: 'TX', zip: '770019998' },
  { city: 'PHOENIX', state: 'AZ', zip: '850019998' },
  { city: 'PHILADELPHIA', state: 'PA', zip: '191019998' },
  { city: 'SAN ANTONIO', state: 'TX', zip: '782019998' },
  { city: 'SAN DIEGO', state: 'CA', zip: '921019998' },
  { city: 'DALLAS', state: 'TX', zip: '752019998' },
];

const TAXONOMIES = [
  '207Q00000X', '207R00000X', '208D00000X', '207X00000X',
  '208600000X', '207V00000X', '207Y00000X', '2084N0400X',
];

const STREET_NAMES = [
  'MAIN ST', 'OAK AVE', 'MAPLE DR', 'PINE RD', 'CEDAR BLVD',
  'ELM ST', 'WALNUT WAY', 'CHERRY LN', 'BIRCH PL', 'SPRUCE TER',
  'WILLOW CT', 'ASH DR', 'POPLAR AVE', 'HICKORY LN', 'CYPRESS RD',
];

const MEMBER_LOCATIONS = [
  { city: 'LOS ANGELES', state: 'CA', zip: '90012' },
  { city: 'CHICAGO', state: 'IL', zip: '60601' },
  { city: 'HOUSTON', state: 'TX', zip: '77001' },
  { city: 'PHOENIX', state: 'AZ', zip: '85001' },
  { city: 'PHILADELPHIA', state: 'PA', zip: '19101' },
  { city: 'SAN DIEGO', state: 'CA', zip: '92101' },
  { city: 'DALLAS', state: 'TX', zip: '75201' },
  { city: 'SAN JOSE', state: 'CA', zip: '95101' },
  { city: 'AUSTIN', state: 'TX', zip: '73301' },
  { city: 'JACKSONVILLE', state: 'FL', zip: '32099' },
  { city: 'COLUMBUS', state: 'OH', zip: '43085' },
  { city: 'CHARLOTTE', state: 'NC', zip: '28201' },
  { city: 'SEATTLE', state: 'WA', zip: '98101' },
  { city: 'DENVER', state: 'CO', zip: '80201' },
  { city: 'BOSTON', state: 'MA', zip: '02101' },
];

const DIAGNOSIS_CODES = [
  'E119',  'I10',   'J449',  'E785',  'N189',
  'F329',  'I2510', 'E039',  'G4733', 'M179',
  'K219',  'J459',  'E669',  'I4891', 'N400',
];

const CPT_CODES = [
  '99213', '99214', '99215', '99203', '99204',
  '36415', '81001', '80053', '85025', '93000',
  '71046', '74177',
];

const CPT_MODIFIER_MAP = {
  '99213': '25', '99214': '25', '99215': '25',
  '99203': null, '99204': null,
  '36415': null, '81001': null, '80053': null, '85025': null,
  '93000': 'TC', '71046': 'TC', '74177': 'TC',
};

const MONTH_WEIGHTS = [
  { year: 2024, month: 4, weight: 7 },
  { year: 2024, month: 5, weight: 6 },
  { year: 2024, month: 6, weight: 5 },
  { year: 2024, month: 7, weight: 5 },
  { year: 2024, month: 8, weight: 5 },
  { year: 2024, month: 9, weight: 6 },
  { year: 2024, month: 10, weight: 8 },
  { year: 2024, month: 11, weight: 9 },
  { year: 2024, month: 12, weight: 12 },
  { year: 2025, month: 1, weight: 13 },
  { year: 2025, month: 2, weight: 11 },
  { year: 2025, month: 3, weight: 9 },
];

// ── Generate 8 billing providers ─────────────────────────────────────────────

export const BILLING_PROVIDERS = Array.from({ length: 8 }, (_, i) => {
  const rng = createRng(1000 + i * 31);
  const loc = PROVIDER_LOCATIONS[i];
  return {
    npi: generateValidNPI(rng),
    name: PROVIDER_ORG_NAMES[i],
    taxId: generateEIN(rng),
    address: `${100 + i * 200} ${STREET_NAMES[i]}`,
    city: loc.city,
    state: loc.state,
    zip: loc.zip,
    taxonomy: TAXONOMIES[i],
    entityType: '2',
  };
});

// ── Generate 25 rendering providers (distributed across billing providers) ───

export const RENDERING_PROVIDERS = Array.from({ length: 25 }, (_, i) => {
  const rng = createRng(2000 + i * 37);
  const billingIdx = i % 8;
  const gender = rng() < 0.5 ? 'M' : 'F';
  const firstName = gender === 'M' ? pick(rng, FIRST_NAMES_MALE) : pick(rng, FIRST_NAMES_FEMALE);
  return {
    npi: generateValidNPI(rng),
    lastName: pick(rng, LAST_NAMES),
    firstName,
    entityType: '1',
    taxonomy: TAXONOMIES[i % TAXONOMIES.length],
    billingProviderNPI: BILLING_PROVIDERS[billingIdx].npi,
  };
});

// ── Generate 150 members ─────────────────────────────────────────────────────

export const MEMBERS = Array.from({ length: 150 }, (_, i) => {
  const rng = createRng(3000 + i * 43);
  const gender = rng() < 0.5 ? 'M' : 'F';
  const firstName = gender === 'M' ? pick(rng, FIRST_NAMES_MALE) : pick(rng, FIRST_NAMES_FEMALE);
  const dobYear = 1935 + Math.floor(rng() * 50);
  const dobMonth = 1 + Math.floor(rng() * 12);
  const dobDay = 1 + Math.floor(rng() * 28);
  const loc = MEMBER_LOCATIONS[i % MEMBER_LOCATIONS.length];
  const streetNum = 100 + Math.floor(rng() * 9900);
  return {
    memberId: generateMBI(rng),
    lastName: pick(rng, LAST_NAMES),
    firstName,
    dateOfBirth: `${dobYear}${padNum(dobMonth, 2)}${padNum(dobDay, 2)}`,
    gender,
    address: `${streetNum} ${pick(rng, STREET_NAMES)}`,
    city: loc.city,
    state: loc.state,
    zip: loc.zip + padNum(Math.floor(rng() * 10000), 4),
  };
});

// ── Generate 500 claims ──────────────────────────────────────────────────────

function pickMonth(rng) {
  return pickWeighted(
    rng,
    MONTH_WEIGHTS,
    MONTH_WEIGHTS.map((m) => m.weight),
  );
}

function generateClaim(index) {
  const rng = createRng(5000 + index * 7919);

  const id = `CLM-${padNum(index + 1, 6)}`;

  const monthInfo = pickMonth(rng);
  const daysInMonth = new Date(monthInfo.year, monthInfo.month, 0).getDate();
  const day = 1 + Math.floor(rng() * daysInMonth);
  const serviceDateFrom = `${monthInfo.year}${padNum(monthInfo.month, 2)}${padNum(day, 2)}`;
  const serviceDateTo = serviceDateFrom;

  const pcn = `PCN-${serviceDateFrom}-${padNum(index + 1, 6)}`;

  const facilityCode = pickWeighted(rng, ['11', '22', '23'], [70, 20, 10]);

  const member = MEMBERS[Math.floor(rng() * MEMBERS.length)];
  const billingProvider = BILLING_PROVIDERS[Math.floor(rng() * BILLING_PROVIDERS.length)];

  const eligibleRendering = RENDERING_PROVIDERS.filter(
    (r) => r.billingProviderNPI === billingProvider.npi,
  );
  const renderingProvider =
    eligibleRendering.length > 0 ? pick(rng, eligibleRendering) : pick(rng, RENDERING_PROVIDERS);

  const diagCount = 1 + Math.floor(rng() * 4);
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
      code,
      sequence: d + 1,
      qualifier: d === 0 ? 'ABK' : 'ABF',
    });
  }

  const lineCount = 1 + Math.floor(rng() * 4);
  const serviceLines = [];
  let totalCharge = 0;
  for (let l = 0; l < lineCount; l++) {
    const procedureCode = pick(rng, CPT_CODES);
    const chargeAmount = round2(50 + rng() * 1950);
    totalCharge += chargeAmount;
    const unitCount = 1 + Math.floor(rng() * 4);
    const maxPointer = Math.min(diagCount, 4);
    const pointerCount = 1 + Math.floor(rng() * maxPointer);
    const pointers = [];
    for (let p = 0; p < pointerCount && p < diagCount; p++) pointers.push(p + 1);

    serviceLines.push({
      lineNumber: l + 1,
      procedureCode,
      chargeAmount: round2(chargeAmount),
      unitCount,
      unitType: 'UN',
      diagnosisPointers: pointers.join(':'),
      modifier1: CPT_MODIFIER_MAP[procedureCode] || null,
    });
  }
  totalCharge = round2(totalCharge);

  const paidPct = 0.4 + rng() * 0.4;
  const paidAmount = round2(totalCharge * paidPct);

  const adjDaysLater = 3 + Math.floor(rng() * 12);
  const svcDate = new Date(monthInfo.year, monthInfo.month - 1, day);
  const adjDate = new Date(svcDate.getTime() + adjDaysLater * 86400000);
  const adjudicationDate = `${adjDate.getFullYear()}${padNum(adjDate.getMonth() + 1, 2)}${padNum(adjDate.getDate(), 2)}`;

  return {
    id,
    patientControlNumber: pcn,
    totalChargeAmount: totalCharge,
    facilityCode,
    serviceDateFrom,
    serviceDateTo,
    contractId: 'H1234',
    subscriber: {
      memberId: member.memberId,
      lastName: member.lastName,
      firstName: member.firstName,
      dateOfBirth: member.dateOfBirth,
      gender: member.gender,
      address: member.address,
      city: member.city,
      state: member.state,
      zip: member.zip,
    },
    billingProvider: {
      npi: billingProvider.npi,
      name: billingProvider.name,
      taxId: billingProvider.taxId,
      address: billingProvider.address,
      city: billingProvider.city,
      state: billingProvider.state,
      zip: billingProvider.zip,
      taxonomy: billingProvider.taxonomy,
      entityType: '2',
    },
    renderingProvider: {
      npi: renderingProvider.npi,
      lastName: renderingProvider.lastName,
      firstName: renderingProvider.firstName,
      entityType: '1',
      taxonomy: renderingProvider.taxonomy,
    },
    diagnoses,
    serviceLines,
    paidAmount,
    adjudicationDate,
  };
}

export const SAMPLE_CLAIMS = Array.from({ length: 500 }, (_, i) => generateClaim(i));
