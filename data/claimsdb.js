/*************************
 * Claims Database — client-side localStorage persistence
 * for normalized healthcare claim data (837P / 837I).
 *
 * Stores claims, subscribers, providers, payers, diagnoses,
 * and service lines in a flat table structure linked by claimId.
 *************************/

/* ---------- localStorage key constants ---------- */
export const CLAIMS_STORE = {
  claims:       "ih_claims_db_v1_claims",
  subscribers:  "ih_claims_db_v1_subscribers",
  providers:    "ih_claims_db_v1_providers",
  payers:       "ih_claims_db_v1_payers",
  diagnoses:    "ih_claims_db_v1_diagnoses",
  serviceLines: "ih_claims_db_v1_serviceLines"
};

/* ---------- ID generator ---------- */
function generateId() {
  return Math.random().toString(16).slice(2, 10) + "_" + Date.now().toString(16);
}

/* ---------- localStorage helpers ---------- */
function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

/* ---------- ClaimsDB class ---------- */
export class ClaimsDB {
  constructor() {
    this.claims       = loadJSON(CLAIMS_STORE.claims, []);
    this.subscribers  = loadJSON(CLAIMS_STORE.subscribers, []);
    this.providers    = loadJSON(CLAIMS_STORE.providers, []);
    this.payers       = loadJSON(CLAIMS_STORE.payers, []);
    this.diagnoses    = loadJSON(CLAIMS_STORE.diagnoses, []);
    this.serviceLines = loadJSON(CLAIMS_STORE.serviceLines, []);
  }

  save() {
    saveJSON(CLAIMS_STORE.claims,       this.claims);
    saveJSON(CLAIMS_STORE.subscribers,  this.subscribers);
    saveJSON(CLAIMS_STORE.providers,    this.providers);
    saveJSON(CLAIMS_STORE.payers,       this.payers);
    saveJSON(CLAIMS_STORE.diagnoses,    this.diagnoses);
    saveJSON(CLAIMS_STORE.serviceLines, this.serviceLines);
  }

  addClaim(claim) {
    const claimId = generateId();
    const now = new Date().toISOString();

    const claimRecord = {
      id:                        claimId,
      claimType:                 claim.claimType || "837P",
      patientControlNumber:      claim.patientControlNumber || "",
      totalChargeAmount:         claim.totalChargeAmount || 0,
      facilityCode:              claim.facilityCode || "",
      facilityCodeQualifier:     claim.facilityCodeQualifier || "",
      frequencyCode:             claim.frequencyCode || "1",
      providerSignatureIndicator: claim.providerSignatureIndicator || "",
      assignmentCode:            claim.assignmentCode || "",
      benefitsAssignment:        claim.benefitsAssignment || "",
      releaseOfInfo:             claim.releaseOfInfo || "",
      serviceDateFrom:           claim.serviceDateFrom || "",
      serviceDateTo:             claim.serviceDateTo || "",
      admissionTypeCode:         claim.admissionTypeCode || "",
      admissionSourceCode:       claim.admissionSourceCode || "",
      patientStatusCode:         claim.patientStatusCode || "",
      statementDateFrom:         claim.statementDateFrom || "",
      statementDateTo:           claim.statementDateTo || "",
      priorAuthNumber:           claim.priorAuthNumber || "",
      referralNumber:            claim.referralNumber || "",
      medicalRecordNumber:       claim.medicalRecordNumber || "",
      status:                    claim.status || "DRAFT",
      createdAt:                 now,
      convertedAt:               claim.convertedAt || "",
      sourceFormat:              claim.sourceFormat || "MANUAL",
      sourceFileName:            claim.sourceFileName || ""
    };
    this.claims.push(claimRecord);

    if (claim.subscriber) {
      this.subscribers.push({
        id:                  generateId(),
        claimId,
        memberId:            claim.subscriber.memberId || "",
        lastName:            claim.subscriber.lastName || "",
        firstName:           claim.subscriber.firstName || "",
        middleName:          claim.subscriber.middleName || "",
        suffix:              claim.subscriber.suffix || "",
        idQualifier:         claim.subscriber.idQualifier || "MI",
        dateOfBirth:         claim.subscriber.dateOfBirth || "",
        gender:              claim.subscriber.gender || "U",
        addressLine1:        claim.subscriber.addressLine1 || "",
        addressLine2:        claim.subscriber.addressLine2 || "",
        city:                claim.subscriber.city || "",
        state:               claim.subscriber.state || "",
        zipCode:             claim.subscriber.zipCode || "",
        payerResponsibility: claim.subscriber.payerResponsibility || "P",
        relationshipCode:    claim.subscriber.relationshipCode || "18",
        groupNumber:         claim.subscriber.groupNumber || "",
        claimFilingCode:     claim.subscriber.claimFilingCode || ""
      });
    }

    if (Array.isArray(claim.providers)) {
      for (const prov of claim.providers) {
        this.providers.push({
          id:           generateId(),
          claimId,
          role:         prov.role || "billing",
          npi:          prov.npi || "",
          lastName:     prov.lastName || "",
          firstName:    prov.firstName || "",
          middleName:   prov.middleName || "",
          entityType:   prov.entityType || "1",
          taxonomyCode: prov.taxonomyCode || "",
          taxId:        prov.taxId || "",
          taxIdType:    prov.taxIdType || "EI",
          addressLine1: prov.addressLine1 || "",
          city:         prov.city || "",
          state:        prov.state || "",
          zipCode:      prov.zipCode || ""
        });
      }
    }

    if (claim.payer) {
      this.payers.push({
        id:               generateId(),
        claimId,
        payerName:        claim.payer.payerName || "",
        payerId:          claim.payer.payerId || "",
        payerIdQualifier: claim.payer.payerIdQualifier || "PI",
        addressLine1:     claim.payer.addressLine1 || "",
        city:             claim.payer.city || "",
        state:            claim.payer.state || "",
        zipCode:          claim.payer.zipCode || ""
      });
    }

    if (Array.isArray(claim.diagnoses)) {
      for (const dx of claim.diagnoses) {
        this.diagnoses.push({
          id:           generateId(),
          claimId,
          sequence:     dx.sequence || 1,
          code:         dx.code || "",
          qualifier:    dx.qualifier || "ABK",
          poaIndicator: dx.poaIndicator || ""
        });
      }
    }

    if (Array.isArray(claim.serviceLines)) {
      for (const sl of claim.serviceLines) {
        this.serviceLines.push({
          id:                 generateId(),
          claimId,
          lineNumber:         sl.lineNumber || 1,
          procedureCode:      sl.procedureCode || "",
          procedureQualifier: sl.procedureQualifier || "HC",
          modifier1:          sl.modifier1 || "",
          modifier2:          sl.modifier2 || "",
          modifier3:          sl.modifier3 || "",
          modifier4:          sl.modifier4 || "",
          chargeAmount:       sl.chargeAmount || 0,
          unitType:           sl.unitType || "UN",
          unitCount:          sl.unitCount || 1,
          placeOfService:     sl.placeOfService || "",
          diagPointers:       sl.diagPointers || "",
          revenueCode:        sl.revenueCode || "",
          serviceDateFrom:    sl.serviceDateFrom || "",
          serviceDateTo:      sl.serviceDateTo || "",
          ndcCode:            sl.ndcCode || "",
          drugQuantity:       sl.drugQuantity || 0,
          drugUnitType:       sl.drugUnitType || ""
        });
      }
    }

    this.save();
    return claimRecord;
  }

  getClaim(id) {
    return this.claims.find(c => c.id === id) || null;
  }

  getAllClaims() {
    return [...this.claims];
  }

  deleteClaim(id) {
    this.claims       = this.claims.filter(c => c.id !== id);
    this.subscribers  = this.subscribers.filter(s => s.claimId !== id);
    this.providers    = this.providers.filter(p => p.claimId !== id);
    this.payers       = this.payers.filter(p => p.claimId !== id);
    this.diagnoses    = this.diagnoses.filter(d => d.claimId !== id);
    this.serviceLines = this.serviceLines.filter(sl => sl.claimId !== id);
    this.save();
  }

  clearAll() {
    this.claims       = [];
    this.subscribers  = [];
    this.providers    = [];
    this.payers       = [];
    this.diagnoses    = [];
    this.serviceLines = [];
    this.save();
  }

  getStats() {
    return {
      claims:       this.claims.length,
      subscribers:  this.subscribers.length,
      providers:    this.providers.length,
      payers:       this.payers.length,
      diagnoses:    this.diagnoses.length,
      serviceLines: this.serviceLines.length
    };
  }

  search(query) {
    if (!query || !query.trim()) return [...this.claims];
    const q = query.toLowerCase().trim();
    return this.claims.filter(c => {
      if ((c.patientControlNumber || "").toLowerCase().includes(q)) return true;
      if ((c.claimType || "").toLowerCase().includes(q)) return true;
      if ((c.status || "").toLowerCase().includes(q)) return true;
      if ((c.sourceFileName || "").toLowerCase().includes(q)) return true;

      const subs = this.subscribers.filter(s => s.claimId === c.id);
      for (const s of subs) {
        if ((s.memberId || "").toLowerCase().includes(q)) return true;
        if ((s.lastName || "").toLowerCase().includes(q)) return true;
        if ((s.firstName || "").toLowerCase().includes(q)) return true;
      }

      const provs = this.providers.filter(p => p.claimId === c.id);
      for (const p of provs) {
        if ((p.npi || "").toLowerCase().includes(q)) return true;
        if ((p.lastName || "").toLowerCase().includes(q)) return true;
        if ((p.firstName || "").toLowerCase().includes(q)) return true;
      }

      const payers = this.payers.filter(p => p.claimId === c.id);
      for (const py of payers) {
        if ((py.payerName || "").toLowerCase().includes(q)) return true;
        if ((py.payerId || "").toLowerCase().includes(q)) return true;
      }

      const dxs = this.diagnoses.filter(d => d.claimId === c.id);
      for (const dx of dxs) {
        if ((dx.code || "").toLowerCase().includes(q)) return true;
      }

      const sls = this.serviceLines.filter(sl => sl.claimId === c.id);
      for (const sl of sls) {
        if ((sl.procedureCode || "").toLowerCase().includes(q)) return true;
        if ((sl.revenueCode || "").toLowerCase().includes(q)) return true;
      }

      return false;
    });
  }

  getFullClaim(id) {
    const claim = this.getClaim(id);
    if (!claim) return null;
    return {
      ...claim,
      subscriber:   this.subscribers.find(s => s.claimId === id) || null,
      providers:    this.providers.filter(p => p.claimId === id),
      payer:        this.payers.find(p => p.claimId === id) || null,
      diagnoses:    this.diagnoses.filter(d => d.claimId === id),
      serviceLines: this.serviceLines.filter(sl => sl.claimId === id)
    };
  }
}

/* ---------- Schema constants ---------- */
export const CLAIMS_DB_SCHEMA = {
  tables: {
    claims: {
      fields: [
        { name: "id", type: "string", desc: "Internal claim ID (auto-generated)" },
        { name: "claimType", type: "enum", values: ["837P", "837I"], desc: "Professional or Institutional" },
        { name: "patientControlNumber", type: "string", edi: "CLM01", desc: "Patient control number" },
        { name: "totalChargeAmount", type: "number", edi: "CLM02", desc: "Total claim charge" },
        { name: "facilityCode", type: "string", edi: "CLM05-1", desc: "Place of service (POS) for 837P, facility type for 837I" },
        { name: "facilityCodeQualifier", type: "string", edi: "CLM05-2", desc: "B=POS for Prof, A=UB for Inst" },
        { name: "frequencyCode", type: "string", edi: "CLM05-3", desc: "1=Original, 7=Replacement, 8=Void" },
        { name: "providerSignatureIndicator", type: "string", edi: "CLM06", desc: "Y/N (837P only)" },
        { name: "assignmentCode", type: "string", edi: "CLM07", desc: "A=Assigned, B=Not Assigned" },
        { name: "benefitsAssignment", type: "string", edi: "CLM08", desc: "W=Not Applicable, Y=Yes" },
        { name: "releaseOfInfo", type: "string", edi: "CLM09", desc: "I=Informed, Y=Yes" },
        { name: "serviceDateFrom", type: "date", edi: "DTP*472", desc: "Service date start (CCYYMMDD)" },
        { name: "serviceDateTo", type: "date", edi: "DTP*472", desc: "Service date end (CCYYMMDD)" },
        { name: "admissionTypeCode", type: "string", edi: "CL101", desc: "Admission type (837I only)" },
        { name: "admissionSourceCode", type: "string", edi: "CL102", desc: "Admission source (837I only)" },
        { name: "patientStatusCode", type: "string", edi: "CL103", desc: "Patient status (837I only)" },
        { name: "statementDateFrom", type: "date", edi: "DTP*434", desc: "Statement from (837I)" },
        { name: "statementDateTo", type: "date", edi: "DTP*434", desc: "Statement to (837I)" },
        { name: "priorAuthNumber", type: "string", edi: "REF*G1", desc: "Prior authorization" },
        { name: "referralNumber", type: "string", edi: "REF*9F", desc: "Referral number" },
        { name: "medicalRecordNumber", type: "string", edi: "REF*EA", desc: "Medical record number" },
        { name: "status", type: "enum", values: ["DRAFT", "READY", "CONVERTED", "ERROR"], desc: "Claim lifecycle status" },
        { name: "createdAt", type: "datetime", desc: "Creation timestamp" },
        { name: "convertedAt", type: "datetime", desc: "When 837 was generated" },
        { name: "sourceFormat", type: "enum", values: ["CSV", "JSON", "XML", "MANUAL"], desc: "How the claim was ingested" },
        { name: "sourceFileName", type: "string", desc: "Original file name" }
      ]
    },
    subscribers: {
      fields: [
        { name: "id", type: "string", desc: "Internal ID" },
        { name: "claimId", type: "string", desc: "FK to claims" },
        { name: "memberId", type: "string", edi: "NM1*IL NM109", desc: "Subscriber member ID" },
        { name: "lastName", type: "string", edi: "NM1*IL NM103", desc: "Last name" },
        { name: "firstName", type: "string", edi: "NM1*IL NM104", desc: "First name" },
        { name: "middleName", type: "string", edi: "NM1*IL NM105", desc: "Middle name" },
        { name: "suffix", type: "string", edi: "NM1*IL NM107", desc: "Name suffix" },
        { name: "idQualifier", type: "string", edi: "NM1*IL NM108", desc: "MI=Member ID" },
        { name: "dateOfBirth", type: "date", edi: "DMG02", desc: "DOB (CCYYMMDD)" },
        { name: "gender", type: "enum", values: ["M", "F", "U"], edi: "DMG03", desc: "Gender" },
        { name: "addressLine1", type: "string", edi: "N301", desc: "Address line 1" },
        { name: "addressLine2", type: "string", edi: "N302", desc: "Address line 2" },
        { name: "city", type: "string", edi: "N401", desc: "City" },
        { name: "state", type: "string", edi: "N402", desc: "State code" },
        { name: "zipCode", type: "string", edi: "N403", desc: "ZIP code" },
        { name: "payerResponsibility", type: "string", edi: "SBR01", desc: "P=Primary, S=Secondary, T=Tertiary" },
        { name: "relationshipCode", type: "string", edi: "SBR02", desc: "18=Self, 01=Spouse, 19=Child" },
        { name: "groupNumber", type: "string", edi: "SBR03", desc: "Group/policy number" },
        { name: "claimFilingCode", type: "string", edi: "SBR09", desc: "CI, MB, MC, BL, etc." }
      ]
    },
    providers: {
      fields: [
        { name: "id", type: "string", desc: "Internal ID" },
        { name: "claimId", type: "string", desc: "FK to claims" },
        { name: "role", type: "enum", values: ["billing", "rendering", "referring", "attending", "operating", "supervising", "facility"], desc: "Provider role" },
        { name: "npi", type: "string", edi: "NM109 (XX qualifier)", desc: "NPI (10 digits)" },
        { name: "lastName", type: "string", edi: "NM103", desc: "Last name or org name" },
        { name: "firstName", type: "string", edi: "NM104", desc: "First name" },
        { name: "middleName", type: "string", edi: "NM105", desc: "Middle name" },
        { name: "entityType", type: "enum", values: ["1", "2"], edi: "NM102", desc: "1=Person, 2=Organization" },
        { name: "taxonomyCode", type: "string", edi: "PRV03", desc: "Provider taxonomy" },
        { name: "taxId", type: "string", edi: "REF*EI/SY", desc: "EIN or SSN" },
        { name: "taxIdType", type: "enum", values: ["EI", "SY"], desc: "EI=EIN, SY=SSN" },
        { name: "addressLine1", type: "string", edi: "N301", desc: "Address" },
        { name: "city", type: "string", edi: "N401", desc: "City" },
        { name: "state", type: "string", edi: "N402", desc: "State" },
        { name: "zipCode", type: "string", edi: "N403", desc: "ZIP" }
      ]
    },
    payers: {
      fields: [
        { name: "id", type: "string", desc: "Internal ID" },
        { name: "claimId", type: "string", desc: "FK to claims" },
        { name: "payerName", type: "string", edi: "NM1*PR NM103", desc: "Payer organization name" },
        { name: "payerId", type: "string", edi: "NM1*PR NM109", desc: "Payer identifier" },
        { name: "payerIdQualifier", type: "string", edi: "NM1*PR NM108", desc: "PI=Payor ID" },
        { name: "addressLine1", type: "string", edi: "N301", desc: "Address" },
        { name: "city", type: "string", edi: "N401", desc: "City" },
        { name: "state", type: "string", edi: "N402", desc: "State" },
        { name: "zipCode", type: "string", edi: "N403", desc: "ZIP" }
      ]
    },
    diagnoses: {
      fields: [
        { name: "id", type: "string", desc: "Internal ID" },
        { name: "claimId", type: "string", desc: "FK to claims" },
        { name: "sequence", type: "number", desc: "Order (1=principal)" },
        { name: "code", type: "string", edi: "HI*ABK/ABF", desc: "ICD-10-CM code" },
        { name: "qualifier", type: "string", edi: "HI qualifier", desc: "ABK=Principal, ABF=Other" },
        { name: "poaIndicator", type: "string", edi: "HI01-9", desc: "Present on admission (837I only)" }
      ]
    },
    serviceLines: {
      fields: [
        { name: "id", type: "string", desc: "Internal ID" },
        { name: "claimId", type: "string", desc: "FK to claims" },
        { name: "lineNumber", type: "number", edi: "LX01", desc: "Line sequence number" },
        { name: "procedureCode", type: "string", edi: "SV101-2 / SV202", desc: "CPT/HCPCS code" },
        { name: "procedureQualifier", type: "string", edi: "SV101-1 / SV202-1", desc: "HC=HCPCS/CPT" },
        { name: "modifier1", type: "string", edi: "SV101-3", desc: "Modifier 1" },
        { name: "modifier2", type: "string", edi: "SV101-4", desc: "Modifier 2" },
        { name: "modifier3", type: "string", edi: "SV101-5", desc: "Modifier 3" },
        { name: "modifier4", type: "string", edi: "SV101-6", desc: "Modifier 4" },
        { name: "chargeAmount", type: "number", edi: "SV102 / SV203", desc: "Line charge amount" },
        { name: "unitType", type: "string", edi: "SV103 / SV204", desc: "UN=Unit, MJ=Minutes, DA=Days" },
        { name: "unitCount", type: "number", edi: "SV104 / SV205", desc: "Number of units" },
        { name: "placeOfService", type: "string", edi: "SV105", desc: "Line-level POS (837P)" },
        { name: "diagPointers", type: "string", edi: "SV107", desc: "Colon-separated diagnosis pointers (837P)" },
        { name: "revenueCode", type: "string", edi: "SV201", desc: "Revenue code (837I only)" },
        { name: "serviceDateFrom", type: "date", edi: "DTP*472", desc: "Line service date start" },
        { name: "serviceDateTo", type: "date", edi: "DTP*472", desc: "Line service date end" },
        { name: "ndcCode", type: "string", edi: "LIN03", desc: "National Drug Code" },
        { name: "drugQuantity", type: "number", edi: "CTP04", desc: "Drug quantity" },
        { name: "drugUnitType", type: "string", edi: "CTP05-1", desc: "Drug unit (UN, ML, GR)" }
      ]
    }
  }
};

/* ---------- Sample claims ---------- */
export const SAMPLE_CLAIMS = [
  {
    claimType: "837P",
    patientControlNumber: "PRO-CLM-20240115-001",
    totalChargeAmount: 225.00,
    facilityCode: "11",
    facilityCodeQualifier: "B",
    frequencyCode: "1",
    providerSignatureIndicator: "Y",
    assignmentCode: "A",
    benefitsAssignment: "Y",
    releaseOfInfo: "I",
    serviceDateFrom: "20240115",
    serviceDateTo: "20240115",
    priorAuthNumber: "",
    referralNumber: "REF-2024-44821",
    medicalRecordNumber: "MRN-88341",
    status: "READY",
    sourceFormat: "MANUAL",
    sourceFileName: "sample_pro_diabetes.txt",
    subscriber: {
      memberId: "W100234567",
      lastName: "MARTINEZ",
      firstName: "ELENA",
      middleName: "R",
      suffix: "",
      idQualifier: "MI",
      dateOfBirth: "19720308",
      gender: "F",
      addressLine1: "1420 Oak Valley Drive",
      addressLine2: "Apt 204",
      city: "AUSTIN",
      state: "TX",
      zipCode: "78745",
      payerResponsibility: "P",
      relationshipCode: "18",
      groupNumber: "GRP-TX-88214",
      claimFilingCode: "CI"
    },
    providers: [
      {
        role: "billing",
        npi: "1234567890",
        lastName: "CENTRAL TEXAS MEDICAL GROUP",
        firstName: "",
        middleName: "",
        entityType: "2",
        taxonomyCode: "207Q00000X",
        taxId: "741234567",
        taxIdType: "EI",
        addressLine1: "500 W 35th Street Suite 100",
        city: "AUSTIN",
        state: "TX",
        zipCode: "78705"
      },
      {
        role: "rendering",
        npi: "1987654321",
        lastName: "NGUYEN",
        firstName: "DAVID",
        middleName: "T",
        entityType: "1",
        taxonomyCode: "207R00000X",
        taxId: "",
        taxIdType: "EI",
        addressLine1: "500 W 35th Street Suite 100",
        city: "AUSTIN",
        state: "TX",
        zipCode: "78705"
      }
    ],
    payer: {
      payerName: "BLUE CROSS BLUE SHIELD OF TEXAS",
      payerId: "84980",
      payerIdQualifier: "PI",
      addressLine1: "1001 E Lookout Drive",
      city: "RICHARDSON",
      state: "TX",
      zipCode: "75082"
    },
    diagnoses: [
      { sequence: 1, code: "E11.9",  qualifier: "ABK", poaIndicator: "" },
      { sequence: 2, code: "E78.5",  qualifier: "ABF", poaIndicator: "" }
    ],
    serviceLines: [
      {
        lineNumber: 1,
        procedureCode: "99213",
        procedureQualifier: "HC",
        modifier1: "25",
        modifier2: "",
        modifier3: "",
        modifier4: "",
        chargeAmount: 175.00,
        unitType: "UN",
        unitCount: 1,
        placeOfService: "11",
        diagPointers: "1:2",
        revenueCode: "",
        serviceDateFrom: "20240115",
        serviceDateTo: "20240115",
        ndcCode: "",
        drugQuantity: 0,
        drugUnitType: ""
      },
      {
        lineNumber: 2,
        procedureCode: "36415",
        procedureQualifier: "HC",
        modifier1: "",
        modifier2: "",
        modifier3: "",
        modifier4: "",
        chargeAmount: 50.00,
        unitType: "UN",
        unitCount: 1,
        placeOfService: "11",
        diagPointers: "1",
        revenueCode: "",
        serviceDateFrom: "20240115",
        serviceDateTo: "20240115",
        ndcCode: "",
        drugQuantity: 0,
        drugUnitType: ""
      }
    ]
  },

  {
    claimType: "837I",
    patientControlNumber: "INST-CLM-20240220-003",
    totalChargeAmount: 8750.00,
    facilityCode: "0111",
    facilityCodeQualifier: "A",
    frequencyCode: "1",
    providerSignatureIndicator: "",
    assignmentCode: "A",
    benefitsAssignment: "Y",
    releaseOfInfo: "Y",
    serviceDateFrom: "20240218",
    serviceDateTo: "20240220",
    admissionTypeCode: "1",
    admissionSourceCode: "7",
    patientStatusCode: "01",
    statementDateFrom: "20240218",
    statementDateTo: "20240220",
    priorAuthNumber: "AUTH-2024-99210",
    referralNumber: "",
    medicalRecordNumber: "MRN-55123",
    status: "READY",
    sourceFormat: "MANUAL",
    sourceFileName: "sample_inst_copd.txt",
    subscriber: {
      memberId: "W200876543",
      lastName: "JOHNSON",
      firstName: "ROBERT",
      middleName: "A",
      suffix: "JR",
      idQualifier: "MI",
      dateOfBirth: "19580614",
      gender: "M",
      addressLine1: "782 Maple Ridge Road",
      addressLine2: "",
      city: "HOUSTON",
      state: "TX",
      zipCode: "77024",
      payerResponsibility: "P",
      relationshipCode: "18",
      groupNumber: "GRP-HOU-55100",
      claimFilingCode: "MB"
    },
    providers: [
      {
        role: "billing",
        npi: "1122334455",
        lastName: "HOUSTON METHODIST HOSPITAL",
        firstName: "",
        middleName: "",
        entityType: "2",
        taxonomyCode: "282N00000X",
        taxId: "760987654",
        taxIdType: "EI",
        addressLine1: "6565 Fannin Street",
        city: "HOUSTON",
        state: "TX",
        zipCode: "77030"
      },
      {
        role: "attending",
        npi: "1567890123",
        lastName: "PATEL",
        firstName: "ANITA",
        middleName: "K",
        entityType: "1",
        taxonomyCode: "207RP1001X",
        taxId: "",
        taxIdType: "EI",
        addressLine1: "6565 Fannin Street",
        city: "HOUSTON",
        state: "TX",
        zipCode: "77030"
      }
    ],
    payer: {
      payerName: "MEDICARE PART A",
      payerId: "00112",
      payerIdQualifier: "PI",
      addressLine1: "7500 Security Boulevard",
      city: "BALTIMORE",
      state: "MD",
      zipCode: "21244"
    },
    diagnoses: [
      { sequence: 1, code: "J44.1",  qualifier: "ABK", poaIndicator: "Y" },
      { sequence: 2, code: "J96.00", qualifier: "ABF", poaIndicator: "Y" },
      { sequence: 3, code: "R06.00", qualifier: "ABF", poaIndicator: "Y" }
    ],
    serviceLines: [
      {
        lineNumber: 1,
        procedureCode: "99223",
        procedureQualifier: "HC",
        modifier1: "",
        modifier2: "",
        modifier3: "",
        modifier4: "",
        chargeAmount: 8750.00,
        unitType: "DA",
        unitCount: 3,
        placeOfService: "",
        diagPointers: "",
        revenueCode: "0120",
        serviceDateFrom: "20240218",
        serviceDateTo: "20240220",
        ndcCode: "",
        drugQuantity: 0,
        drugUnitType: ""
      }
    ]
  }
];
