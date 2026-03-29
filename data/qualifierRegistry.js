/**
 * CMS Encounter Data — Qualifier Registry & Edit Configuration
 *
 * Configurable qualifier values, file-level field flags, and TA1/999/277CA
 * edit level mappings for 837P Professional (005010X222A1).
 *
 * Design principles:
 *  - Every qualifier with a single allowed value → auto-populated from config
 *  - Multi-value qualifiers → validation against allowed set
 *  - File-level fields (ISA/GS/ST envelope) flagged separately from claim data
 *  - TA1/999/277CA edit levels mapped with Accept/Reject disposition
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. QUALIFIER REGISTRY
//    Each entry: the 5010A1 mandatory value(s) per segment/element
//    autoPopulate=true means the system fills this — not data-dependent
//    source: "CMS" = CMS-specific, "TR3" = X12 standard, "CONFIG" = per-contract
// ═══════════════════════════════════════════════════════════════════════════

export const QUALIFIER_REGISTRY = [
  // ── ISA Segment (File-Level, Auto-Populated) ──
  { loop: "ISA", segment: "ISA", element: "ISA01", name: "Authorization Info Qualifier", usage: "R", values: ["00"], singleValue: true, autoPopulate: true, fileLevel: true, source: "TR3", desc: "00 = No Authorization Information Present" },
  { loop: "ISA", segment: "ISA", element: "ISA02", name: "Authorization Information", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "TR3", desc: "10 blank spaces when ISA01=00", defaultValue: "          " },
  { loop: "ISA", segment: "ISA", element: "ISA03", name: "Security Info Qualifier", usage: "R", values: ["00"], singleValue: true, autoPopulate: true, fileLevel: true, source: "TR3", desc: "00 = No Security Information Present" },
  { loop: "ISA", segment: "ISA", element: "ISA04", name: "Security Information", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "TR3", desc: "10 blank spaces when ISA03=00", defaultValue: "          " },
  { loop: "ISA", segment: "ISA", element: "ISA05", name: "Interchange ID Qualifier (Sender)", usage: "R", values: ["ZZ"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "ZZ = Mutually Defined" },
  { loop: "ISA", segment: "ISA", element: "ISA06", name: "Interchange Sender ID", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "CONFIG", desc: "EN + Contract ID (15 chars, right-padded)", pattern: "^EN[A-Z0-9]+" },
  { loop: "ISA", segment: "ISA", element: "ISA07", name: "Interchange ID Qualifier (Receiver)", usage: "R", values: ["ZZ"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "ZZ = Mutually Defined" },
  { loop: "ISA", segment: "ISA", element: "ISA08", name: "Interchange Receiver ID", usage: "R", values: ["80882"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "CMS Receiver ID (15 chars, right-padded)", defaultValue: "80882          " },
  { loop: "ISA", segment: "ISA", element: "ISA09", name: "Interchange Date", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "TR3", desc: "YYMMDD format, system-generated" },
  { loop: "ISA", segment: "ISA", element: "ISA10", name: "Interchange Time", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "TR3", desc: "HHMM format, system-generated" },
  { loop: "ISA", segment: "ISA", element: "ISA11", name: "Repetition Separator", usage: "R", values: ["^"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "^ (caret) for 5010" },
  { loop: "ISA", segment: "ISA", element: "ISA12", name: "Interchange Control Version", usage: "R", values: ["00501"], singleValue: true, autoPopulate: true, fileLevel: true, source: "TR3", desc: "00501 for 5010" },
  { loop: "ISA", segment: "ISA", element: "ISA13", name: "Interchange Control Number", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "CONFIG", desc: "9-digit, unique 12 months, part of duplicate key" },
  { loop: "ISA", segment: "ISA", element: "ISA14", name: "Acknowledgment Requested", usage: "R", values: ["1"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "1 = Interchange ACK Requested (TA1)" },
  { loop: "ISA", segment: "ISA", element: "ISA15", name: "Usage Indicator", usage: "R", values: ["T", "P"], singleValue: false, autoPopulate: true, fileLevel: true, source: "CONFIG", desc: "T = Test, P = Production" },
  { loop: "ISA", segment: "ISA", element: "ISA16", name: "Component Element Separator", usage: "R", values: [":"], singleValue: true, autoPopulate: true, fileLevel: true, source: "TR3", desc: ": (colon) sub-element separator" },

  // ── IEA Segment (File-Level) ──
  { loop: "IEA", segment: "IEA", element: "IEA01", name: "Number of Functional Groups", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "TR3", desc: "Count of GS/GE groups" },
  { loop: "IEA", segment: "IEA", element: "IEA02", name: "Interchange Control Number", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "TR3", desc: "Must match ISA13" },

  // ── GS Segment (File-Level, Auto-Populated) ──
  { loop: "GS", segment: "GS", element: "GS01", name: "Functional Identifier Code", usage: "R", values: ["HC"], singleValue: true, autoPopulate: true, fileLevel: true, source: "TR3", desc: "HC = Health Care" },
  { loop: "GS", segment: "GS", element: "GS02", name: "Application Sender's Code", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "CMS", desc: "Must match ISA06 (EN + Contract ID)" },
  { loop: "GS", segment: "GS", element: "GS03", name: "Application Receiver's Code", usage: "R", values: ["80882"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "Must match ISA08" },
  { loop: "GS", segment: "GS", element: "GS04", name: "Date", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "TR3", desc: "CCYYMMDD, system-generated" },
  { loop: "GS", segment: "GS", element: "GS05", name: "Time", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "TR3", desc: "HHMM, system-generated" },
  { loop: "GS", segment: "GS", element: "GS06", name: "Group Control Number", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "CONFIG", desc: "Unique, must match GE02, part of duplicate key" },
  { loop: "GS", segment: "GS", element: "GS07", name: "Responsible Agency Code", usage: "R", values: ["X"], singleValue: true, autoPopulate: true, fileLevel: true, source: "TR3", desc: "X = Accredited Standards Committee X12" },
  { loop: "GS", segment: "GS", element: "GS08", name: "Version/Release/Industry ID", usage: "R", values: ["005010X222A1"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "837P Professional. 837I uses 005010X223A2", claimTypeOverrides: { "837I": "005010X223A2", "DME": "005010X222A1" } },

  // ── GE Segment (File-Level) ──
  { loop: "GE", segment: "GE", element: "GE01", name: "Number of Transaction Sets", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "TR3", desc: "Count of ST/SE sets in this group" },
  { loop: "GE", segment: "GE", element: "GE02", name: "Group Control Number", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "TR3", desc: "Must match GS06" },

  // ── ST Segment (File-Level per Transaction) ──
  { loop: "ST", segment: "ST", element: "ST01", name: "Transaction Set Identifier Code", usage: "R", values: ["837"], singleValue: true, autoPopulate: true, fileLevel: true, source: "TR3", desc: "837 = Health Care Claim" },
  { loop: "ST", segment: "ST", element: "ST02", name: "Transaction Set Control Number", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "CONFIG", desc: "Unique within GS/GE, must match SE02, part of duplicate key" },
  { loop: "ST", segment: "ST", element: "ST03", name: "Implementation Convention Ref", usage: "R", values: ["005010X222A1"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "Must match GS08", claimTypeOverrides: { "837I": "005010X223A2" } },

  // ── SE Segment (File-Level) ──
  { loop: "SE", segment: "SE", element: "SE01", name: "Number of Included Segments", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "TR3", desc: "Actual count including ST and SE" },
  { loop: "SE", segment: "SE", element: "SE02", name: "Transaction Set Control Number", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "TR3", desc: "Must match ST02" },

  // ── BHT Segment (File-Level per Transaction) ──
  { loop: "BHT", segment: "BHT", element: "BHT01", name: "Hierarchical Structure Code", usage: "R", values: ["0019"], singleValue: true, autoPopulate: true, fileLevel: true, source: "TR3", desc: "0019 = Information Source, Subscriber, Dependent" },
  { loop: "BHT", segment: "BHT", element: "BHT02", name: "Transaction Set Purpose Code", usage: "R", values: ["00", "18"], singleValue: false, autoPopulate: true, fileLevel: true, source: "TR3", desc: "00 = Original, 18 = Reissue" },
  { loop: "BHT", segment: "BHT", element: "BHT03", name: "Originator Application Transaction ID", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "CONFIG", desc: "Unique across ALL files, part of duplicate key" },
  { loop: "BHT", segment: "BHT", element: "BHT04", name: "Transaction Set Creation Date", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "TR3", desc: "CCYYMMDD, system-generated" },
  { loop: "BHT", segment: "BHT", element: "BHT05", name: "Transaction Set Creation Time", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "TR3", desc: "HHMM, system-generated" },
  { loop: "BHT", segment: "BHT", element: "BHT06", name: "Claim or Encounter Identifier", usage: "R", values: ["CH"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "CH = Chargeable" },

  // ── Loop 1000A — Submitter Name (File-Level) ──
  { loop: "1000A", segment: "NM1", element: "NM101", name: "Entity Identifier Code", usage: "R", values: ["41"], singleValue: true, autoPopulate: true, fileLevel: true, source: "TR3", desc: "41 = Submitter" },
  { loop: "1000A", segment: "NM1", element: "NM102", name: "Entity Type Qualifier", usage: "R", values: ["2"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "2 = Non-Person Entity" },
  { loop: "1000A", segment: "NM1", element: "NM108", name: "Identification Code Qualifier", usage: "R", values: ["46"], singleValue: true, autoPopulate: true, fileLevel: true, source: "TR3", desc: "46 = ETIN" },
  { loop: "1000A", segment: "NM1", element: "NM109", name: "Submitter Identifier", usage: "R", values: null, singleValue: false, autoPopulate: true, fileLevel: true, source: "CONFIG", desc: "EN + Contract ID" },
  { loop: "1000A", segment: "PER", element: "PER01", name: "Contact Function Code", usage: "R", values: ["IC"], singleValue: true, autoPopulate: true, fileLevel: true, source: "TR3", desc: "IC = Information Contact" },
  { loop: "1000A", segment: "PER", element: "PER03", name: "Communication Number Qualifier", usage: "R", values: ["TE"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "TE = Telephone (recommended)" },
  { loop: "1000A", segment: "PER", element: "PER05", name: "Communication Number Qualifier 2", usage: "S", values: ["EM"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "EM = Email (recommended)" },
  { loop: "1000A", segment: "PER", element: "PER07", name: "Communication Number Qualifier 3", usage: "S", values: ["FX"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "FX = Fax (recommended)" },

  // ── Loop 1000B — Receiver Name (File-Level) ──
  { loop: "1000B", segment: "NM1", element: "NM101", name: "Entity Identifier Code", usage: "R", values: ["40"], singleValue: true, autoPopulate: true, fileLevel: true, source: "TR3", desc: "40 = Receiver" },
  { loop: "1000B", segment: "NM1", element: "NM102", name: "Entity Type Qualifier", usage: "R", values: ["2"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "2 = Non-Person Entity" },
  { loop: "1000B", segment: "NM1", element: "NM103", name: "Receiver Name", usage: "R", values: ["EDSCMS"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "EDSCMS" },
  { loop: "1000B", segment: "NM1", element: "NM108", name: "Identification Code Qualifier", usage: "R", values: ["46"], singleValue: true, autoPopulate: true, fileLevel: true, source: "TR3", desc: "46 = ETIN" },
  { loop: "1000B", segment: "NM1", element: "NM109", name: "Receiver Identifier", usage: "R", values: ["80882"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "CMS Receiver ID" },

  // ── Loop 2000A — Billing Provider HL (Data-Dependent) ──
  { loop: "2000A", segment: "HL", element: "HL03", name: "Hierarchical Level Code", usage: "R", values: ["20"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "20 = Information Source (Billing Provider)" },
  { loop: "2000A", segment: "HL", element: "HL04", name: "Hierarchical Child Code", usage: "R", values: ["1"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "1 = Additional Subordinate HL" },
  { loop: "2000A", segment: "PRV", element: "PRV01", name: "Provider Code", usage: "S", values: ["BI"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "BI = Billing" },
  { loop: "2000A", segment: "PRV", element: "PRV02", name: "Reference ID Qualifier", usage: "R", values: ["PXC"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "PXC = Health Care Provider Taxonomy Code" },

  // ── Loop 2010AA — Billing Provider Name (Data-Dependent) ──
  { loop: "2010AA", segment: "NM1", element: "NM101", name: "Entity Identifier Code", usage: "R", values: ["85"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "85 = Billing Provider" },
  { loop: "2010AA", segment: "NM1", element: "NM102", name: "Entity Type Qualifier", usage: "R", values: ["1", "2"], singleValue: false, autoPopulate: false, fileLevel: false, source: "TR3", desc: "1 = Person, 2 = Non-Person Entity" },
  { loop: "2010AA", segment: "NM1", element: "NM108", name: "Identification Code Qualifier", usage: "R", values: ["XX"], singleValue: true, autoPopulate: true, fileLevel: false, source: "CMS", desc: "XX = NPI" },
  { loop: "2010AA", segment: "REF", element: "REF01", name: "Reference ID Qualifier", usage: "R", values: ["EI"], singleValue: true, autoPopulate: true, fileLevel: false, source: "CMS", desc: "EI = Employer's Identification Number" },

  // ── Loop 2000B — Subscriber HL (Data-Dependent) ──
  { loop: "2000B", segment: "HL", element: "HL03", name: "Hierarchical Level Code", usage: "R", values: ["22"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "22 = Subscriber" },
  { loop: "2000B", segment: "HL", element: "HL04", name: "Hierarchical Child Code", usage: "R", values: ["0", "1"], singleValue: false, autoPopulate: false, fileLevel: false, source: "TR3", desc: "0 = No subordinate, 1 = Has subordinate" },
  { loop: "2000B", segment: "SBR", element: "SBR01", name: "Payer Responsibility Sequence", usage: "R", values: ["S"], singleValue: true, autoPopulate: true, fileLevel: false, source: "CMS", desc: "S = Secondary (CMS is secondary payer)" },
  { loop: "2000B", segment: "SBR", element: "SBR02", name: "Individual Relationship Code", usage: "S", values: ["18"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "18 = Self" },
  { loop: "2000B", segment: "SBR", element: "SBR09", name: "Claim Filing Indicator Code", usage: "R", values: ["MB"], singleValue: true, autoPopulate: true, fileLevel: false, source: "CMS", desc: "MB = Medicare Part B", claimTypeOverrides: { "837I": "MA" } },

  // ── Loop 2010BA — Subscriber Name (Data-Dependent) ──
  { loop: "2010BA", segment: "NM1", element: "NM101", name: "Entity Identifier Code", usage: "R", values: ["IL"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "IL = Insured or Subscriber" },
  { loop: "2010BA", segment: "NM1", element: "NM102", name: "Entity Type Qualifier", usage: "R", values: ["1"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "1 = Person" },
  { loop: "2010BA", segment: "NM1", element: "NM108", name: "ID Code Qualifier", usage: "R", values: ["MI"], singleValue: true, autoPopulate: true, fileLevel: false, source: "CMS", desc: "MI = Member Identification Number" },
  { loop: "2010BA", segment: "DMG", element: "DMG01", name: "Date Time Period Format Qualifier", usage: "R", values: ["D8"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "D8 = Date expressed as CCYYMMDD" },
  { loop: "2010BA", segment: "DMG", element: "DMG03", name: "Gender Code", usage: "S", values: ["F", "M", "U"], singleValue: false, autoPopulate: false, fileLevel: false, source: "TR3", desc: "F = Female, M = Male, U = Unknown" },

  // ── Loop 2010BB — Payer Name (File-Level CMS defaults) ──
  { loop: "2010BB", segment: "NM1", element: "NM101", name: "Entity Identifier Code", usage: "R", values: ["PR"], singleValue: true, autoPopulate: true, fileLevel: true, source: "TR3", desc: "PR = Payer" },
  { loop: "2010BB", segment: "NM1", element: "NM102", name: "Entity Type Qualifier", usage: "R", values: ["2"], singleValue: true, autoPopulate: true, fileLevel: true, source: "TR3", desc: "2 = Non-Person Entity" },
  { loop: "2010BB", segment: "NM1", element: "NM103", name: "Payer Name", usage: "R", values: ["EDSCMS"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "EDSCMS" },
  { loop: "2010BB", segment: "NM1", element: "NM108", name: "Payer ID Qualifier", usage: "R", values: ["PI"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "PI = Payor Identification" },
  { loop: "2010BB", segment: "NM1", element: "NM109", name: "Payer Identification", usage: "R", values: ["80882"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "CMS Payer ID" },
  { loop: "2010BB", segment: "N3", element: "N301", name: "Payer Address Line", usage: "R", values: ["7500 Security Blvd"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "CMS Address" },
  { loop: "2010BB", segment: "N4", element: "N401", name: "Payer City", usage: "R", values: ["Baltimore"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "CMS City" },
  { loop: "2010BB", segment: "N4", element: "N402", name: "Payer State", usage: "R", values: ["MD"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "CMS State" },
  { loop: "2010BB", segment: "N4", element: "N403", name: "Payer ZIP", usage: "R", values: ["212441850"], singleValue: true, autoPopulate: true, fileLevel: true, source: "CMS", desc: "CMS ZIP" },
  { loop: "2010BB", segment: "REF", element: "REF01", name: "Reference ID Qualifier", usage: "R", values: ["2U"], singleValue: true, autoPopulate: true, fileLevel: false, source: "CMS", desc: "2U = Payer ID Number" },

  // ── Loop 2300 — Claim Information (Data-Dependent) ──
  { loop: "2300", segment: "CLM", element: "CLM05-2", name: "Facility Code Qualifier", usage: "R", values: ["B"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "B = Place of Service (Prof)", claimTypeOverrides: { "837I": "A" } },
  { loop: "2300", segment: "CLM", element: "CLM05-3", name: "Claim Frequency Type Code", usage: "R", values: ["1", "7", "8"], singleValue: false, autoPopulate: false, fileLevel: false, source: "CMS", desc: "1=Original, 7=Replacement, 8=Void" },
  { loop: "2300", segment: "CLM", element: "CLM06", name: "Provider Signature Indicator", usage: "R", values: ["Y", "N"], singleValue: false, autoPopulate: false, fileLevel: false, source: "TR3", desc: "Y = Yes, N = No (837P only)" },
  { loop: "2300", segment: "CLM", element: "CLM07", name: "Assignment Participation Code", usage: "R", values: ["A", "B", "C"], singleValue: false, autoPopulate: false, fileLevel: false, source: "TR3", desc: "A = Assigned, B = Not Assigned, C = Patient Choice" },
  { loop: "2300", segment: "CLM", element: "CLM08", name: "Benefits Assignment Cert Indicator", usage: "R", values: ["W", "Y"], singleValue: false, autoPopulate: false, fileLevel: false, source: "TR3", desc: "W = Not Applicable, Y = Yes" },
  { loop: "2300", segment: "CLM", element: "CLM09", name: "Release of Info Code", usage: "R", values: ["I", "Y"], singleValue: false, autoPopulate: false, fileLevel: false, source: "TR3", desc: "I = Informed Consent, Y = Provider Signed Statement" },
  { loop: "2300", segment: "PWK", element: "PWK01", name: "Report Type Code", usage: "S", values: ["09", "OZ", "AM", "PY"], singleValue: false, autoPopulate: false, fileLevel: false, source: "CMS", desc: "09=Chart Review, OZ=Paper, AM=Ambulance, PY=4010" },
  { loop: "2300", segment: "PWK", element: "PWK02", name: "Attachment Transmission Code", usage: "S", values: ["AA"], singleValue: true, autoPopulate: true, fileLevel: false, source: "CMS", desc: "AA = Available on Request" },
  { loop: "2300", segment: "CN1", element: "CN101", name: "Contract Type Code", usage: "S", values: ["05"], singleValue: true, autoPopulate: true, fileLevel: false, source: "CMS", desc: "05 = Capitated" },
  { loop: "2300", segment: "REF", element: "REF01_F8", name: "Payer Claim Control Number Qualifier", usage: "S", values: ["F8"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "F8 = Original Reference Number (ICN)" },
  { loop: "2300", segment: "REF", element: "REF01_EA", name: "Medical Record Number Qualifier", usage: "S", values: ["EA"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "EA = Medical Record Number" },
  { loop: "2300", segment: "NTE", element: "NTE01", name: "Note Reference Code", usage: "S", values: ["ADD"], singleValue: true, autoPopulate: true, fileLevel: false, source: "CMS", desc: "ADD = Additional Information (for default data)" },
  { loop: "2300", segment: "DTP", element: "DTP01_472", name: "Date/Time Qualifier (Service)", usage: "R", values: ["472"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "472 = Service" },
  { loop: "2300", segment: "DTP", element: "DTP02", name: "Date Time Period Format Qualifier", usage: "R", values: ["D8", "RD8"], singleValue: false, autoPopulate: false, fileLevel: false, source: "TR3", desc: "D8 = Date, RD8 = Date Range" },
  { loop: "2300", segment: "HI", element: "HI01-1", name: "Diagnosis Type Code (Principal)", usage: "R", values: ["ABK", "BK"], singleValue: false, autoPopulate: false, fileLevel: false, source: "TR3", desc: "ABK = ICD-10-CM Principal, BK = ICD-9 Principal" },
  { loop: "2300", segment: "HI", element: "HI02-1", name: "Diagnosis Type Code (Other)", usage: "S", values: ["ABF", "BF"], singleValue: false, autoPopulate: false, fileLevel: false, source: "TR3", desc: "ABF = ICD-10-CM Other, BF = ICD-9 Other" },

  // ── Loop 2310B — Rendering Provider (Data-Dependent) ──
  { loop: "2310B", segment: "NM1", element: "NM101", name: "Entity Identifier Code", usage: "R", values: ["82"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "82 = Rendering Provider" },
  { loop: "2310B", segment: "NM1", element: "NM108", name: "ID Code Qualifier", usage: "R", values: ["XX"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "XX = NPI" },
  { loop: "2310B", segment: "PRV", element: "PRV01", name: "Provider Code", usage: "S", values: ["PE"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "PE = Performing" },
  { loop: "2310B", segment: "PRV", element: "PRV02", name: "Reference ID Qualifier", usage: "R", values: ["PXC"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "PXC = Taxonomy" },

  // ── Loop 2320 — Other Subscriber (Data-Dependent) ──
  { loop: "2320", segment: "SBR", element: "SBR01", name: "Payer Responsibility Sequence", usage: "R", values: ["P", "T"], singleValue: false, autoPopulate: false, fileLevel: false, source: "CMS", desc: "P=Primary, T=Tertiary" },
  { loop: "2320", segment: "SBR", element: "SBR09", name: "Claim Filing Indicator Code", usage: "R", values: ["16"], singleValue: true, autoPopulate: true, fileLevel: false, source: "CMS", desc: "16 = HMO Medicare Risk" },
  { loop: "2320", segment: "OI", element: "OI03", name: "Benefits Assignment Cert", usage: "R", values: null, singleValue: false, autoPopulate: false, fileLevel: false, source: "CMS", desc: "Must match Loop 2300 CLM08" },

  // ── Loop 2330A/B — Other Payer (Data-Dependent) ──
  { loop: "2330A", segment: "NM1", element: "NM108", name: "ID Code Qualifier", usage: "R", values: ["MI"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "MI = Member ID" },
  { loop: "2330B", segment: "NM1", element: "NM108", name: "ID Code Qualifier", usage: "R", values: ["XV"], singleValue: true, autoPopulate: true, fileLevel: false, source: "CMS", desc: "XV = Health Care Financing Admin Plan ID" },

  // ── Loop 2400 — Service Line (Data-Dependent) ──
  { loop: "2400", segment: "SV1", element: "SV101-1", name: "Procedure Code Qualifier", usage: "R", values: ["HC"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "HC = HCPCS/CPT" },
  { loop: "2400", segment: "SV1", element: "SV103", name: "Unit or Basis for Measurement", usage: "R", values: ["MJ", "UN", "DA"], singleValue: false, autoPopulate: false, fileLevel: false, source: "TR3", desc: "MJ=Minutes, UN=Unit, DA=Days" },
  { loop: "2400", segment: "DTP", element: "DTP01", name: "Date/Time Qualifier", usage: "R", values: ["472"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "472 = Service" },
  { loop: "2400", segment: "DTP", element: "DTP02", name: "Date Time Period Format", usage: "R", values: ["D8", "RD8"], singleValue: false, autoPopulate: false, fileLevel: false, source: "TR3", desc: "D8 = Date, RD8 = Range" },
  { loop: "2400", segment: "CN1", element: "CN101", name: "Contract Type Code (Line)", usage: "S", values: ["05"], singleValue: true, autoPopulate: true, fileLevel: false, source: "CMS", desc: "05 = Capitated line" },

  // ── Loop 2430 — Line Adjudication (Data-Dependent) ──
  { loop: "2430", segment: "DTP", element: "DTP01", name: "Date/Time Qualifier (Adj Date)", usage: "R", values: ["573"], singleValue: true, autoPopulate: true, fileLevel: false, source: "TR3", desc: "573 = Date Claim Paid" }
];


// ═══════════════════════════════════════════════════════════════════════════
// 2. EDIT LEVEL REGISTRY
//    TA1 / 999 / 277CA edit dispositions
//    R = Reject entire scope, A = Accept (informational)
// ═══════════════════════════════════════════════════════════════════════════

export const EDIT_LEVELS = {
  TA1: {
    scope: "INTERCHANGE",
    fileLevel: true,
    description: "ISA/IEA envelope syntax errors",
    disposition: "R",
    failureImpact: "Entire interchange rejected — no claims processed",
    reportField: "TA104",
    acceptValue: "A",
    rejectValue: "R",
    errorCodeField: "TA105",
    fields: ["ISA01","ISA02","ISA03","ISA04","ISA05","ISA06","ISA07","ISA08","ISA09","ISA10","ISA11","ISA12","ISA13","ISA14","ISA15","ISA16","IEA01","IEA02"]
  },
  "999": {
    scope: "FUNCTIONAL_GROUP",
    fileLevel: true,
    description: "GS/GE functional group + CEM segment syntax errors",
    disposition: "R",
    failureImpact: "Functional group rejected — other GS/GE groups continue",
    reportField: "AK9/IK5",
    acceptValue: "A",
    partialValue: "P",
    rejectValue: "R",
    errorLoopField: "IK3-03",
    errorElementField: "IK4-01",
    errorReasonField: "IK4-03",
    fields: ["GS01","GS02","GS03","GS04","GS05","GS06","GS07","GS08","GE01","GE02","ST01","ST02","ST03","SE01","SE02","BHT01","BHT02","BHT03","BHT04","BHT05","BHT06"]
  },
  "277CA": {
    scope: "CLAIM",
    fileLevel: false,
    description: "Transaction set / claim-level CEM + CCEM edits",
    disposition: "R",
    failureImpact: "Individual claim rejected — other claims continue",
    reportField: "STC03",
    acceptValue: "WQ",
    rejectValue: "U",
    errorCodeField: "STC01",
    icnField: "REF02 (REF01=IK)",
    hierarchyLevels: ["Information Source", "Information Receiver", "Billing Provider", "Patient"],
    fields: "All claim-level loops (2000A through 2430)"
  },
  "MAO-001": {
    scope: "ENCOUNTER",
    fileLevel: false,
    description: "Duplicate detection",
    disposition: "R",
    failureImpact: "Duplicate encounters rejected",
    editCodes: ["98315", "98320", "98325"]
  },
  "MAO-002": {
    scope: "ENCOUNTER_AND_LINE",
    fileLevel: false,
    description: "EDPPPS/EDPIPS detail processing and pricing edits",
    headerLine: "000",
    dispositions: {
      "ACCEPTED": "Encounter accepted",
      "ACCEPTED_WITH_INFO": "Accepted but has informational edits — review recommended",
      "REJECTED": "Must correct and resubmit"
    },
    failureImpact: "Header 000 rejected = entire encounter. Line rejected = that line only."
  }
};


// ═══════════════════════════════════════════════════════════════════════════
// 3. FILE-LEVEL vs DATA-DEPENDENT FIELD CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════

export function getFileLevelFields() {
  return QUALIFIER_REGISTRY.filter(q => q.fileLevel);
}

export function getDataDependentFields() {
  return QUALIFIER_REGISTRY.filter(q => !q.fileLevel);
}

export function getAutoPopulateFields() {
  return QUALIFIER_REGISTRY.filter(q => q.autoPopulate && q.singleValue);
}

export function getFieldsByLoop(loopId) {
  return QUALIFIER_REGISTRY.filter(q => q.loop === loopId);
}

export function getFieldsByUsage(usage) {
  return QUALIFIER_REGISTRY.filter(q => q.usage === usage);
}


// ═══════════════════════════════════════════════════════════════════════════
// 4. QUALIFIER VALIDATION ENGINE
//    Validates a value against the registry
// ═══════════════════════════════════════════════════════════════════════════

export function validateQualifier(loop, segment, element, value, claimType) {
  const reg = QUALIFIER_REGISTRY.find(q =>
    q.loop === loop && q.segment === segment && q.element === element
  );
  if (!reg) return { valid: true, message: "No qualifier rule found — pass-through" };

  if (reg.usage === "N/U") {
    return { valid: value == null || value === "", message: value ? `${element} is Not Used — must be empty` : "OK" };
  }

  if (reg.usage === "R" && (value == null || value === "")) {
    return { valid: false, message: `${element} is Required but empty`, severity: "REJECT" };
  }

  if (reg.values && reg.values.length > 0) {
    let allowedValues = [...reg.values];
    if (reg.claimTypeOverrides && reg.claimTypeOverrides[claimType]) {
      allowedValues = [reg.claimTypeOverrides[claimType]];
    }
    if (!allowedValues.includes(value)) {
      return {
        valid: false,
        message: `${element} value '${value}' not in allowed set: [${allowedValues.join(", ")}]`,
        severity: "REJECT",
        allowedValues
      };
    }
  }

  if (reg.pattern && value) {
    const regex = new RegExp(reg.pattern);
    if (!regex.test(value)) {
      return { valid: false, message: `${element} value '${value}' does not match pattern ${reg.pattern}`, severity: "REJECT" };
    }
  }

  return { valid: true, message: "OK" };
}


// ═══════════════════════════════════════════════════════════════════════════
// 5. AUTO-POPULATE ENGINE
//    Returns values that should be auto-filled from config
// ═══════════════════════════════════════════════════════════════════════════

export function getAutoPopulatedValues(config, claimType) {
  const result = {};
  for (const reg of QUALIFIER_REGISTRY) {
    if (!reg.autoPopulate) continue;
    const key = `${reg.loop}.${reg.segment}.${reg.element}`;

    if (reg.singleValue && reg.values && reg.values.length === 1) {
      let val = reg.values[0];
      if (reg.claimTypeOverrides && reg.claimTypeOverrides[claimType]) {
        val = reg.claimTypeOverrides[claimType];
      }
      result[key] = val;
    } else if (reg.defaultValue) {
      result[key] = reg.defaultValue;
    } else if (reg.source === "CONFIG") {
      const configKey = `${reg.loop}_${reg.element}`;
      if (config && config[configKey]) {
        result[key] = config[configKey];
      }
    }
  }
  return result;
}


// ═══════════════════════════════════════════════════════════════════════════
// 6. SUMMARY STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

export function getRegistryStats() {
  const total = QUALIFIER_REGISTRY.length;
  const fileLevelCount = QUALIFIER_REGISTRY.filter(q => q.fileLevel).length;
  const dataDepCount = total - fileLevelCount;
  const autoPopCount = QUALIFIER_REGISTRY.filter(q => q.autoPopulate && q.singleValue).length;
  const multiValueCount = QUALIFIER_REGISTRY.filter(q => q.values && q.values.length > 1).length;
  const cmsSpecific = QUALIFIER_REGISTRY.filter(q => q.source === "CMS").length;
  const configurable = QUALIFIER_REGISTRY.filter(q => q.source === "CONFIG").length;
  const required = QUALIFIER_REGISTRY.filter(q => q.usage === "R").length;
  const situational = QUALIFIER_REGISTRY.filter(q => q.usage === "S").length;

  return {
    total,
    fileLevelCount,
    dataDepCount,
    autoPopCount,
    multiValueCount,
    cmsSpecific,
    configurable,
    required,
    situational,
    editLevels: Object.keys(EDIT_LEVELS).length
  };
}
