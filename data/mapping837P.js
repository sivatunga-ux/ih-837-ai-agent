/**
 * 837P (Professional) — Complete Segment & Data-Element Mapping
 * Based on ASC X12N 005010X222A1 Implementation Guide
 * Reference: Healthcare Data Insight open-source schema documentation
 */

export const MAPPING_837P = {
  id: "837P",
  name: "837 Professional (005010X222A1)",
  description: "Health Care Claim: Professional — used by physicians, therapists, outpatient clinics, and other non-institutional providers.",
  loops: [
    /* ── Interchange / Functional-Group Envelope ── */
    {
      id: "ISA_IEA",
      name: "Interchange Envelope",
      repeat: "1",
      segments: [
        {
          id: "ISA",
          name: "Interchange Control Header",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "ISA01", name: "Authorization Information Qualifier", req: "R", type: "ID", length: "2", desc: "Code identifying the type of authorization information (e.g., 00 = No Authorization)" },
            { pos: "ISA02", name: "Authorization Information", req: "R", type: "AN", length: "10", desc: "Authorization information as determined by ISA01" },
            { pos: "ISA03", name: "Security Information Qualifier", req: "R", type: "ID", length: "2", desc: "Code identifying the type of security information (e.g., 00 = No Security)" },
            { pos: "ISA04", name: "Security Information", req: "R", type: "AN", length: "10", desc: "Security information as determined by ISA03" },
            { pos: "ISA05", name: "Interchange ID Qualifier (Sender)", req: "R", type: "ID", length: "2", desc: "Qualifier for the sender interchange ID (e.g., ZZ = Mutually Defined)" },
            { pos: "ISA06", name: "Interchange Sender ID", req: "R", type: "AN", length: "15", desc: "Sender identification" },
            { pos: "ISA07", name: "Interchange ID Qualifier (Receiver)", req: "R", type: "ID", length: "2", desc: "Qualifier for the receiver interchange ID" },
            { pos: "ISA08", name: "Interchange Receiver ID", req: "R", type: "AN", length: "15", desc: "Receiver identification" },
            { pos: "ISA09", name: "Interchange Date", req: "R", type: "DT", length: "6", desc: "Date of the interchange (YYMMDD)" },
            { pos: "ISA10", name: "Interchange Time", req: "R", type: "TM", length: "4", desc: "Time of the interchange (HHMM)" },
            { pos: "ISA11", name: "Repetition Separator", req: "R", type: "ID", length: "1", desc: "Repetition separator (^ in 5010)" },
            { pos: "ISA12", name: "Interchange Control Version Number", req: "R", type: "ID", length: "5", desc: "Version number (00501 for 5010)" },
            { pos: "ISA13", name: "Interchange Control Number", req: "R", type: "N0", length: "9", desc: "Unique control number assigned by the sender" },
            { pos: "ISA14", name: "Acknowledgment Requested", req: "R", type: "ID", length: "1", desc: "0 = No Acknowledgment, 1 = Acknowledgment Requested" },
            { pos: "ISA15", name: "Interchange Usage Indicator", req: "R", type: "ID", length: "1", desc: "P = Production, T = Test" },
            { pos: "ISA16", name: "Component Element Separator", req: "R", type: "AN", length: "1", desc: "Component element separator (typically : )" }
          ]
        },
        {
          id: "IEA",
          name: "Interchange Control Trailer",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "IEA01", name: "Number of Included Functional Groups", req: "R", type: "N0", length: "1-5", desc: "Count of functional groups in this interchange" },
            { pos: "IEA02", name: "Interchange Control Number", req: "R", type: "N0", length: "9", desc: "Must match ISA13" }
          ]
        }
      ]
    },
    {
      id: "GS_GE",
      name: "Functional Group",
      repeat: ">1",
      segments: [
        {
          id: "GS",
          name: "Functional Group Header",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "GS01", name: "Functional Identifier Code", req: "R", type: "ID", length: "2", desc: "HC = Health Care Claim" },
            { pos: "GS02", name: "Application Sender's Code", req: "R", type: "AN", length: "2-15", desc: "Sender's application code" },
            { pos: "GS03", name: "Application Receiver's Code", req: "R", type: "AN", length: "2-15", desc: "Receiver's application code" },
            { pos: "GS04", name: "Date", req: "R", type: "DT", length: "8", desc: "Date (CCYYMMDD)" },
            { pos: "GS05", name: "Time", req: "R", type: "TM", length: "4-8", desc: "Time (HHMM or HHMMSSDD)" },
            { pos: "GS06", name: "Group Control Number", req: "R", type: "N0", length: "1-9", desc: "Unique group control number" },
            { pos: "GS07", name: "Responsible Agency Code", req: "R", type: "ID", length: "1-2", desc: "X = Accredited Standards Committee X12" },
            { pos: "GS08", name: "Version / Release / Industry Identifier Code", req: "R", type: "AN", length: "1-12", desc: "005010X222A1 for 837P" }
          ]
        },
        {
          id: "GE",
          name: "Functional Group Trailer",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "GE01", name: "Number of Transaction Sets Included", req: "R", type: "N0", length: "1-6", desc: "Count of transaction sets in this group" },
            { pos: "GE02", name: "Group Control Number", req: "R", type: "N0", length: "1-9", desc: "Must match GS06" }
          ]
        }
      ]
    },
    /* ── Transaction Set Header ── */
    {
      id: "ST_SE",
      name: "Transaction Set Header / Trailer",
      repeat: ">1",
      segments: [
        {
          id: "ST",
          name: "Transaction Set Header",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "ST01", name: "Transaction Set Identifier Code", req: "R", type: "ID", length: "3", desc: "837 = Health Care Claim" },
            { pos: "ST02", name: "Transaction Set Control Number", req: "R", type: "AN", length: "4-9", desc: "Unique within the functional group" },
            { pos: "ST03", name: "Implementation Convention Reference", req: "R", type: "AN", length: "1-35", desc: "005010X222A1 for 837P" }
          ]
        },
        {
          id: "BHT",
          name: "Beginning of Hierarchical Transaction",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "BHT01", name: "Hierarchical Structure Code", req: "R", type: "ID", length: "4", desc: "0019 = Information Source, Subscriber, Patient" },
            { pos: "BHT02", name: "Transaction Set Purpose Code", req: "R", type: "ID", length: "2", desc: "00 = Original, 18 = Reissue" },
            { pos: "BHT03", name: "Originator Application Transaction ID", req: "R", type: "AN", length: "1-50", desc: "Reference assigned by the originator" },
            { pos: "BHT04", name: "Transaction Set Creation Date", req: "R", type: "DT", length: "8", desc: "CCYYMMDD" },
            { pos: "BHT05", name: "Transaction Set Creation Time", req: "R", type: "TM", length: "4-8", desc: "HHMM" },
            { pos: "BHT06", name: "Claim or Encounter Identifier", req: "R", type: "ID", length: "2", desc: "CH = Chargeable, RP = Reporting" }
          ]
        },
        {
          id: "SE",
          name: "Transaction Set Trailer",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "SE01", name: "Number of Included Segments", req: "R", type: "N0", length: "1-10", desc: "Total segment count including ST and SE" },
            { pos: "SE02", name: "Transaction Set Control Number", req: "R", type: "AN", length: "4-9", desc: "Must match ST02" }
          ]
        }
      ]
    },
    /* ── 1000A — Submitter ── */
    {
      id: "1000A",
      name: "Submitter Name",
      repeat: "1",
      segments: [
        {
          id: "NM1",
          name: "Submitter Name (NM1*41)",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "NM101", name: "Entity Identifier Code", req: "R", type: "ID", length: "2-3", desc: "41 = Submitter" },
            { pos: "NM102", name: "Entity Type Qualifier", req: "R", type: "ID", length: "1", desc: "1 = Person, 2 = Non-Person Entity" },
            { pos: "NM103", name: "Last Name or Organization Name", req: "R", type: "AN", length: "1-60", desc: "Submitter last name or organization name" },
            { pos: "NM104", name: "First Name", req: "S", type: "AN", length: "1-35", desc: "Submitter first name (if individual)" },
            { pos: "NM105", name: "Middle Name or Initial", req: "S", type: "AN", length: "1-25", desc: "Middle name or initial" },
            { pos: "NM106", name: "Name Prefix", req: "N", type: "AN", length: "1-10", desc: "Not used" },
            { pos: "NM107", name: "Name Suffix", req: "S", type: "AN", length: "1-10", desc: "Name suffix (e.g., Jr, Sr)" },
            { pos: "NM108", name: "Identification Code Qualifier", req: "R", type: "ID", length: "1-2", desc: "46 = ETIN" },
            { pos: "NM109", name: "Identification Code", req: "R", type: "AN", length: "2-80", desc: "Submitter identifier (ETIN)" }
          ]
        },
        {
          id: "PER",
          name: "Submitter EDI Contact Information",
          usage: "Required",
          repeat: "2",
          elements: [
            { pos: "PER01", name: "Contact Function Code", req: "R", type: "ID", length: "2", desc: "IC = Information Contact" },
            { pos: "PER02", name: "Contact Name", req: "S", type: "AN", length: "1-60", desc: "Name of the contact person" },
            { pos: "PER03", name: "Communication Number Qualifier 1", req: "R", type: "ID", length: "2", desc: "TE = Telephone, EM = Email, FX = Fax" },
            { pos: "PER04", name: "Communication Number 1", req: "R", type: "AN", length: "1-256", desc: "Phone / email / fax number" },
            { pos: "PER05", name: "Communication Number Qualifier 2", req: "S", type: "ID", length: "2", desc: "Additional contact type" },
            { pos: "PER06", name: "Communication Number 2", req: "S", type: "AN", length: "1-256", desc: "Additional contact number" },
            { pos: "PER07", name: "Communication Number Qualifier 3", req: "S", type: "ID", length: "2", desc: "Additional contact type" },
            { pos: "PER08", name: "Communication Number 3", req: "S", type: "AN", length: "1-256", desc: "Additional contact number" }
          ]
        }
      ]
    },
    /* ── 1000B — Receiver ── */
    {
      id: "1000B",
      name: "Receiver Name",
      repeat: "1",
      segments: [
        {
          id: "NM1",
          name: "Receiver Name (NM1*40)",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "NM101", name: "Entity Identifier Code", req: "R", type: "ID", length: "2-3", desc: "40 = Receiver" },
            { pos: "NM102", name: "Entity Type Qualifier", req: "R", type: "ID", length: "1", desc: "2 = Non-Person Entity" },
            { pos: "NM103", name: "Last Name or Organization Name", req: "R", type: "AN", length: "1-60", desc: "Receiver name" },
            { pos: "NM104", name: "First Name", req: "N", type: "AN", length: "1-35", desc: "Not used" },
            { pos: "NM105", name: "Middle Name or Initial", req: "N", type: "AN", length: "1-25", desc: "Not used" },
            { pos: "NM106", name: "Name Prefix", req: "N", type: "AN", length: "1-10", desc: "Not used" },
            { pos: "NM107", name: "Name Suffix", req: "N", type: "AN", length: "1-10", desc: "Not used" },
            { pos: "NM108", name: "Identification Code Qualifier", req: "R", type: "ID", length: "1-2", desc: "46 = ETIN" },
            { pos: "NM109", name: "Identification Code", req: "R", type: "AN", length: "2-80", desc: "Receiver identifier (ETIN)" }
          ]
        }
      ]
    },
    /* ── 2000A — Billing Provider Hierarchical Level ── */
    {
      id: "2000A",
      name: "Billing Provider Hierarchical Level",
      repeat: ">1",
      segments: [
        {
          id: "HL",
          name: "Billing Provider Hierarchical Level",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "HL01", name: "Hierarchical ID Number", req: "R", type: "AN", length: "1-12", desc: "Unique hierarchical ID within transaction" },
            { pos: "HL02", name: "Hierarchical Parent ID Number", req: "N", type: "AN", length: "1-12", desc: "Not used at billing provider level" },
            { pos: "HL03", name: "Hierarchical Level Code", req: "R", type: "ID", length: "1-2", desc: "20 = Information Source (Billing Provider)" },
            { pos: "HL04", name: "Hierarchical Child Code", req: "R", type: "ID", length: "1", desc: "1 = Additional Subordinate HL Data Segment" }
          ]
        },
        {
          id: "PRV",
          name: "Billing Provider Specialty Information",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "PRV01", name: "Provider Code", req: "R", type: "ID", length: "1-3", desc: "BI = Billing" },
            { pos: "PRV02", name: "Reference Identification Qualifier", req: "R", type: "ID", length: "1-3", desc: "PXC = Health Care Provider Taxonomy Code" },
            { pos: "PRV03", name: "Reference Identification (Taxonomy)", req: "R", type: "AN", length: "1-50", desc: "Provider taxonomy code" }
          ]
        },
        {
          id: "CUR",
          name: "Foreign Currency Information",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "CUR01", name: "Entity Identifier Code", req: "R", type: "ID", length: "2-3", desc: "85 = Billing Provider" },
            { pos: "CUR02", name: "Currency Code", req: "R", type: "ID", length: "3", desc: "ISO 4217 currency code" }
          ]
        }
      ]
    },
    /* ── 2010AA — Billing Provider Name ── */
    {
      id: "2010AA",
      name: "Billing Provider Name",
      repeat: "1",
      segments: [
        {
          id: "NM1",
          name: "Billing Provider Name (NM1*85)",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "NM101", name: "Entity Identifier Code", req: "R", type: "ID", length: "2-3", desc: "85 = Billing Provider" },
            { pos: "NM102", name: "Entity Type Qualifier", req: "R", type: "ID", length: "1", desc: "1 = Person, 2 = Non-Person Entity" },
            { pos: "NM103", name: "Last Name or Organization Name", req: "R", type: "AN", length: "1-60", desc: "Billing provider last name or org name" },
            { pos: "NM104", name: "First Name", req: "S", type: "AN", length: "1-35", desc: "First name (if person)" },
            { pos: "NM105", name: "Middle Name or Initial", req: "S", type: "AN", length: "1-25", desc: "Middle name" },
            { pos: "NM106", name: "Name Prefix", req: "N", type: "AN", length: "1-10", desc: "Not used" },
            { pos: "NM107", name: "Name Suffix", req: "S", type: "AN", length: "1-10", desc: "Suffix (Jr, Sr, etc.)" },
            { pos: "NM108", name: "Identification Code Qualifier", req: "R", type: "ID", length: "1-2", desc: "XX = NPI" },
            { pos: "NM109", name: "Identification Code (NPI)", req: "R", type: "AN", length: "2-80", desc: "Billing provider NPI" }
          ]
        },
        {
          id: "N3",
          name: "Billing Provider Address",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "N301", name: "Address Line 1", req: "R", type: "AN", length: "1-55", desc: "Street address line 1" },
            { pos: "N302", name: "Address Line 2", req: "S", type: "AN", length: "1-55", desc: "Street address line 2" }
          ]
        },
        {
          id: "N4",
          name: "Billing Provider City, State, ZIP",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "N401", name: "City Name", req: "R", type: "AN", length: "2-30", desc: "City" },
            { pos: "N402", name: "State or Province Code", req: "S", type: "ID", length: "2", desc: "State code" },
            { pos: "N403", name: "Postal Code", req: "S", type: "ID", length: "3-15", desc: "ZIP code" },
            { pos: "N404", name: "Country Code", req: "S", type: "ID", length: "2-3", desc: "Country code (if not US)" }
          ]
        },
        {
          id: "REF",
          name: "Billing Provider Tax Identification",
          usage: "Required",
          repeat: "2",
          elements: [
            { pos: "REF01", name: "Reference Identification Qualifier", req: "R", type: "ID", length: "2-3", desc: "EI = Employer ID Number, SY = SSN" },
            { pos: "REF02", name: "Reference Identification", req: "R", type: "AN", length: "1-50", desc: "Tax ID (EIN or SSN)" }
          ]
        }
      ]
    },
    /* ── 2010AB — Pay-To Address ── */
    {
      id: "2010AB",
      name: "Pay-To Address Name",
      repeat: "1",
      segments: [
        {
          id: "NM1",
          name: "Pay-To Address Name (NM1*87)",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "NM101", name: "Entity Identifier Code", req: "R", type: "ID", length: "2-3", desc: "87 = Pay-To Provider" },
            { pos: "NM102", name: "Entity Type Qualifier", req: "R", type: "ID", length: "1", desc: "1 = Person, 2 = Non-Person Entity" },
            { pos: "NM103", name: "Last Name or Organization Name", req: "R", type: "AN", length: "1-60", desc: "Pay-to provider name" },
            { pos: "NM108", name: "Identification Code Qualifier", req: "S", type: "ID", length: "1-2", desc: "XX = NPI" },
            { pos: "NM109", name: "Identification Code (NPI)", req: "S", type: "AN", length: "2-80", desc: "Pay-to provider NPI" }
          ]
        },
        { id: "N3", name: "Pay-To Address", usage: "Required", repeat: "1", elements: [
            { pos: "N301", name: "Address Line 1", req: "R", type: "AN", length: "1-55", desc: "Street address" },
            { pos: "N302", name: "Address Line 2", req: "S", type: "AN", length: "1-55", desc: "Street address line 2" }
        ]},
        { id: "N4", name: "Pay-To City, State, ZIP", usage: "Required", repeat: "1", elements: [
            { pos: "N401", name: "City Name", req: "R", type: "AN", length: "2-30", desc: "City" },
            { pos: "N402", name: "State or Province Code", req: "S", type: "ID", length: "2", desc: "State" },
            { pos: "N403", name: "Postal Code", req: "S", type: "ID", length: "3-15", desc: "ZIP" },
            { pos: "N404", name: "Country Code", req: "S", type: "ID", length: "2-3", desc: "Country (if not US)" }
        ]}
      ]
    },
    /* ── 2010AC — Pay-To Plan Name ── */
    {
      id: "2010AC",
      name: "Pay-To Plan Name",
      repeat: "1",
      segments: [
        {
          id: "NM1",
          name: "Pay-To Plan Name (NM1*PE)",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "NM101", name: "Entity Identifier Code", req: "R", type: "ID", length: "2-3", desc: "PE = Payee" },
            { pos: "NM102", name: "Entity Type Qualifier", req: "R", type: "ID", length: "1", desc: "2 = Non-Person Entity" },
            { pos: "NM103", name: "Organization Name", req: "R", type: "AN", length: "1-60", desc: "Plan name" },
            { pos: "NM108", name: "Identification Code Qualifier", req: "R", type: "ID", length: "1-2", desc: "PI = Payor ID, XV = CMS Plan ID" },
            { pos: "NM109", name: "Identification Code", req: "R", type: "AN", length: "2-80", desc: "Plan identifier" }
          ]
        },
        { id: "N3", name: "Pay-To Plan Address", usage: "Required", repeat: "1", elements: [
            { pos: "N301", name: "Address Line 1", req: "R", type: "AN", length: "1-55", desc: "Street address" },
            { pos: "N302", name: "Address Line 2", req: "S", type: "AN", length: "1-55", desc: "Street address line 2" }
        ]},
        { id: "N4", name: "Pay-To Plan City, State, ZIP", usage: "Required", repeat: "1", elements: [
            { pos: "N401", name: "City", req: "R", type: "AN", length: "2-30", desc: "City" },
            { pos: "N402", name: "State", req: "S", type: "ID", length: "2", desc: "State" },
            { pos: "N403", name: "Postal Code", req: "S", type: "ID", length: "3-15", desc: "ZIP" }
        ]},
        { id: "REF", name: "Pay-To Plan Tax ID", usage: "Required", repeat: "1", elements: [
            { pos: "REF01", name: "Reference Identification Qualifier", req: "R", type: "ID", length: "2-3", desc: "2U = Payer ID, EI = EIN" },
            { pos: "REF02", name: "Reference Identification", req: "R", type: "AN", length: "1-50", desc: "Tax identification number" }
        ]}
      ]
    },
    /* ── 2000B — Subscriber Hierarchical Level ── */
    {
      id: "2000B",
      name: "Subscriber Hierarchical Level",
      repeat: ">1",
      segments: [
        {
          id: "HL",
          name: "Subscriber Hierarchical Level",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "HL01", name: "Hierarchical ID Number", req: "R", type: "AN", length: "1-12", desc: "Unique hierarchical ID" },
            { pos: "HL02", name: "Hierarchical Parent ID Number", req: "R", type: "AN", length: "1-12", desc: "ID of parent (billing provider) HL" },
            { pos: "HL03", name: "Hierarchical Level Code", req: "R", type: "ID", length: "1-2", desc: "22 = Subscriber" },
            { pos: "HL04", name: "Hierarchical Child Code", req: "R", type: "ID", length: "1", desc: "0 = No subordinate, 1 = Additional subordinate" }
          ]
        },
        {
          id: "SBR",
          name: "Subscriber Information",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "SBR01", name: "Payer Responsibility Sequence Number Code", req: "R", type: "ID", length: "1", desc: "P = Primary, S = Secondary, T = Tertiary" },
            { pos: "SBR02", name: "Individual Relationship Code", req: "S", type: "ID", length: "2", desc: "18 = Self" },
            { pos: "SBR03", name: "Insured Group or Policy Number", req: "S", type: "AN", length: "1-50", desc: "Group or policy number" },
            { pos: "SBR04", name: "Group Name", req: "S", type: "AN", length: "1-60", desc: "Group name" },
            { pos: "SBR05", name: "Insurance Type Code", req: "S", type: "ID", length: "1-3", desc: "Insurance type" },
            { pos: "SBR06", name: "Coordination of Benefits Code", req: "N", type: "ID", length: "1", desc: "Not used" },
            { pos: "SBR07", name: "Yes/No Condition or Response Code", req: "N", type: "ID", length: "1", desc: "Not used" },
            { pos: "SBR08", name: "Employment Status Code", req: "N", type: "ID", length: "1-2", desc: "Not used" },
            { pos: "SBR09", name: "Claim Filing Indicator Code", req: "S", type: "ID", length: "1-2", desc: "Claim filing indicator (e.g., CI, MB, MC, BL)" }
          ]
        },
        {
          id: "PAT",
          name: "Patient Information",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "PAT01", name: "Individual Relationship Code", req: "S", type: "ID", length: "2", desc: "Relationship to subscriber" },
            { pos: "PAT05", name: "Date Time Period Format Qualifier", req: "S", type: "ID", length: "2-3", desc: "D8 = Date (CCYYMMDD)" },
            { pos: "PAT06", name: "Date of Death", req: "S", type: "DT", length: "1-35", desc: "Patient date of death" },
            { pos: "PAT07", name: "Unit or Basis for Measurement Code", req: "S", type: "ID", length: "1-2", desc: "01 = Pounds" },
            { pos: "PAT08", name: "Patient Weight", req: "S", type: "R", length: "1-10", desc: "Patient weight in pounds" },
            { pos: "PAT09", name: "Pregnancy Indicator", req: "S", type: "ID", length: "1", desc: "Y = Yes" }
          ]
        }
      ]
    },
    /* ── 2010BA — Subscriber Name ── */
    {
      id: "2010BA",
      name: "Subscriber Name",
      repeat: "1",
      segments: [
        {
          id: "NM1",
          name: "Subscriber Name (NM1*IL)",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "NM101", name: "Entity Identifier Code", req: "R", type: "ID", length: "2-3", desc: "IL = Insured or Subscriber" },
            { pos: "NM102", name: "Entity Type Qualifier", req: "R", type: "ID", length: "1", desc: "1 = Person, 2 = Non-Person" },
            { pos: "NM103", name: "Last Name", req: "R", type: "AN", length: "1-60", desc: "Subscriber last name" },
            { pos: "NM104", name: "First Name", req: "S", type: "AN", length: "1-35", desc: "Subscriber first name" },
            { pos: "NM105", name: "Middle Name or Initial", req: "S", type: "AN", length: "1-25", desc: "Middle name" },
            { pos: "NM106", name: "Name Prefix", req: "N", type: "AN", length: "1-10", desc: "Not used" },
            { pos: "NM107", name: "Name Suffix", req: "S", type: "AN", length: "1-10", desc: "Suffix" },
            { pos: "NM108", name: "Identification Code Qualifier", req: "R", type: "ID", length: "1-2", desc: "MI = Member ID, II = Standard Unique Health ID" },
            { pos: "NM109", name: "Identification Code (Member ID)", req: "R", type: "AN", length: "2-80", desc: "Subscriber member ID" }
          ]
        },
        { id: "N3", name: "Subscriber Address", usage: "Situational", repeat: "1", elements: [
            { pos: "N301", name: "Address Line 1", req: "R", type: "AN", length: "1-55", desc: "Street address" },
            { pos: "N302", name: "Address Line 2", req: "S", type: "AN", length: "1-55", desc: "Street address line 2" }
        ]},
        { id: "N4", name: "Subscriber City, State, ZIP", usage: "Situational", repeat: "1", elements: [
            { pos: "N401", name: "City", req: "R", type: "AN", length: "2-30", desc: "City" },
            { pos: "N402", name: "State", req: "S", type: "ID", length: "2", desc: "State" },
            { pos: "N403", name: "Postal Code", req: "S", type: "ID", length: "3-15", desc: "ZIP" },
            { pos: "N404", name: "Country Code", req: "S", type: "ID", length: "2-3", desc: "Country" }
        ]},
        {
          id: "DMG",
          name: "Subscriber Demographic Information",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "DMG01", name: "Date Time Period Format Qualifier", req: "R", type: "ID", length: "2-3", desc: "D8 = Date expressed as CCYYMMDD" },
            { pos: "DMG02", name: "Date of Birth", req: "R", type: "DT", length: "1-35", desc: "Subscriber date of birth (CCYYMMDD)" },
            { pos: "DMG03", name: "Gender Code", req: "S", type: "ID", length: "1", desc: "F = Female, M = Male, U = Unknown" }
          ]
        },
        { id: "REF", name: "Subscriber Secondary Identification", usage: "Situational", repeat: "4", elements: [
            { pos: "REF01", name: "Reference Identification Qualifier", req: "R", type: "ID", length: "2-3", desc: "SY = SSN, Y4 = Property Casualty Claim Number" },
            { pos: "REF02", name: "Reference Identification", req: "R", type: "AN", length: "1-50", desc: "Secondary identification value" }
        ]}
      ]
    },
    /* ── 2010BB — Payer Name ── */
    {
      id: "2010BB",
      name: "Payer Name",
      repeat: "1",
      segments: [
        {
          id: "NM1",
          name: "Payer Name (NM1*PR)",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "NM101", name: "Entity Identifier Code", req: "R", type: "ID", length: "2-3", desc: "PR = Payer" },
            { pos: "NM102", name: "Entity Type Qualifier", req: "R", type: "ID", length: "1", desc: "2 = Non-Person Entity" },
            { pos: "NM103", name: "Organization Name", req: "R", type: "AN", length: "1-60", desc: "Payer name" },
            { pos: "NM108", name: "Identification Code Qualifier", req: "R", type: "ID", length: "1-2", desc: "PI = Payor Identification, XV = CMS Plan ID" },
            { pos: "NM109", name: "Identification Code", req: "R", type: "AN", length: "2-80", desc: "Payer identifier" }
          ]
        },
        { id: "N3", name: "Payer Address", usage: "Situational", repeat: "1", elements: [
            { pos: "N301", name: "Address Line 1", req: "R", type: "AN", length: "1-55", desc: "Street address" },
            { pos: "N302", name: "Address Line 2", req: "S", type: "AN", length: "1-55", desc: "Address line 2" }
        ]},
        { id: "N4", name: "Payer City, State, ZIP", usage: "Situational", repeat: "1", elements: [
            { pos: "N401", name: "City", req: "R", type: "AN", length: "2-30", desc: "City" },
            { pos: "N402", name: "State", req: "S", type: "ID", length: "2", desc: "State" },
            { pos: "N403", name: "Postal Code", req: "S", type: "ID", length: "3-15", desc: "ZIP" }
        ]},
        { id: "REF", name: "Payer Secondary Identification", usage: "Situational", repeat: "3", elements: [
            { pos: "REF01", name: "Reference Identification Qualifier", req: "R", type: "ID", length: "2-3", desc: "2U = Payer ID, FY = Claim Office Number, NF = NAIC Code" },
            { pos: "REF02", name: "Reference Identification", req: "R", type: "AN", length: "1-50", desc: "Secondary ID value" }
        ]}
      ]
    },
    /* ── 2000C — Patient Hierarchical Level ── */
    {
      id: "2000C",
      name: "Patient Hierarchical Level",
      repeat: ">1",
      segments: [
        {
          id: "HL",
          name: "Patient Hierarchical Level",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "HL01", name: "Hierarchical ID Number", req: "R", type: "AN", length: "1-12", desc: "Unique ID" },
            { pos: "HL02", name: "Hierarchical Parent ID Number", req: "R", type: "AN", length: "1-12", desc: "ID of parent (subscriber) HL" },
            { pos: "HL03", name: "Hierarchical Level Code", req: "R", type: "ID", length: "1-2", desc: "23 = Dependent" },
            { pos: "HL04", name: "Hierarchical Child Code", req: "R", type: "ID", length: "1", desc: "0 = No subordinate" }
          ]
        },
        {
          id: "PAT",
          name: "Patient Information",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "PAT01", name: "Individual Relationship Code", req: "R", type: "ID", length: "2", desc: "01 = Spouse, 19 = Child, etc." },
            { pos: "PAT05", name: "Date Time Period Format Qualifier", req: "S", type: "ID", length: "2-3", desc: "D8" },
            { pos: "PAT06", name: "Date of Death", req: "S", type: "DT", length: "1-35", desc: "Patient death date" },
            { pos: "PAT07", name: "Unit or Basis for Measurement Code", req: "S", type: "ID", length: "1-2", desc: "01 = Pounds" },
            { pos: "PAT08", name: "Patient Weight", req: "S", type: "R", length: "1-10", desc: "Weight" },
            { pos: "PAT09", name: "Pregnancy Indicator", req: "S", type: "ID", length: "1", desc: "Y" }
          ]
        }
      ]
    },
    /* ── 2010CA — Patient Name ── */
    {
      id: "2010CA",
      name: "Patient Name",
      repeat: "1",
      segments: [
        {
          id: "NM1",
          name: "Patient Name (NM1*QC)",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "NM101", name: "Entity Identifier Code", req: "R", type: "ID", length: "2-3", desc: "QC = Patient" },
            { pos: "NM102", name: "Entity Type Qualifier", req: "R", type: "ID", length: "1", desc: "1 = Person" },
            { pos: "NM103", name: "Patient Last Name", req: "R", type: "AN", length: "1-60", desc: "Patient last name" },
            { pos: "NM104", name: "Patient First Name", req: "S", type: "AN", length: "1-35", desc: "Patient first name" },
            { pos: "NM105", name: "Patient Middle Name", req: "S", type: "AN", length: "1-25", desc: "Middle name" },
            { pos: "NM107", name: "Name Suffix", req: "S", type: "AN", length: "1-10", desc: "Suffix" }
          ]
        },
        { id: "N3", name: "Patient Address", usage: "Required", repeat: "1", elements: [
            { pos: "N301", name: "Address Line 1", req: "R", type: "AN", length: "1-55", desc: "Address" },
            { pos: "N302", name: "Address Line 2", req: "S", type: "AN", length: "1-55", desc: "Address line 2" }
        ]},
        { id: "N4", name: "Patient City, State, ZIP", usage: "Required", repeat: "1", elements: [
            { pos: "N401", name: "City", req: "R", type: "AN", length: "2-30", desc: "City" },
            { pos: "N402", name: "State", req: "S", type: "ID", length: "2", desc: "State" },
            { pos: "N403", name: "Postal Code", req: "S", type: "ID", length: "3-15", desc: "ZIP" }
        ]},
        {
          id: "DMG",
          name: "Patient Demographic Information",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "DMG01", name: "Date Time Period Format Qualifier", req: "R", type: "ID", length: "2-3", desc: "D8" },
            { pos: "DMG02", name: "Date of Birth", req: "R", type: "DT", length: "1-35", desc: "CCYYMMDD" },
            { pos: "DMG03", name: "Gender Code", req: "S", type: "ID", length: "1", desc: "F, M, U" }
          ]
        },
        { id: "REF", name: "Patient Secondary Identification", usage: "Situational", repeat: "1", elements: [
            { pos: "REF01", name: "Reference Identification Qualifier", req: "R", type: "ID", length: "2-3", desc: "Y4 = Property Casualty Claim Number, SY = SSN" },
            { pos: "REF02", name: "Reference Identification", req: "R", type: "AN", length: "1-50", desc: "Secondary ID" }
        ]}
      ]
    },
    /* ── 2300 — Claim Information ── */
    {
      id: "2300",
      name: "Claim Information",
      repeat: "100",
      segments: [
        {
          id: "CLM",
          name: "Claim Information",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "CLM01", name: "Patient Control Number", req: "R", type: "AN", length: "1-38", desc: "Unique claim/patient control number" },
            { pos: "CLM02", name: "Total Claim Charge Amount", req: "R", type: "R", length: "1-18", desc: "Total charge amount" },
            { pos: "CLM05-1", name: "Place of Service Code", req: "R", type: "ID", length: "1-2", desc: "Facility code (CMS-1500 POS code)" },
            { pos: "CLM05-2", name: "Facility Code Qualifier", req: "R", type: "ID", length: "1-2", desc: "B = Place of Service" },
            { pos: "CLM05-3", name: "Claim Frequency Type Code", req: "R", type: "ID", length: "1", desc: "1 = Original, 7 = Replacement, 8 = Void" },
            { pos: "CLM06", name: "Provider or Supplier Signature Indicator", req: "R", type: "ID", length: "1", desc: "Y = Yes, N = No" },
            { pos: "CLM07", name: "Assignment or Plan Participation Code", req: "R", type: "ID", length: "1", desc: "A = Assigned, B = Not Assigned, C = Patient Choice" },
            { pos: "CLM08", name: "Benefits Assignment Certification Indicator", req: "R", type: "ID", length: "1", desc: "W = Not Applicable, Y = Yes" },
            { pos: "CLM09", name: "Release of Information Code", req: "R", type: "ID", length: "1", desc: "I = Informed Consent, Y = Yes" },
            { pos: "CLM10", name: "Patient Signature Source Code", req: "S", type: "ID", length: "1", desc: "P = Signature on file" },
            { pos: "CLM11-1", name: "Related Causes Code 1", req: "S", type: "ID", length: "2-3", desc: "AA = Auto Accident, EM = Employment, OA = Other Accident" },
            { pos: "CLM11-2", name: "Related Causes Code 2", req: "S", type: "ID", length: "2-3", desc: "Additional related cause code" },
            { pos: "CLM11-4", name: "Auto Accident State Code", req: "S", type: "ID", length: "2", desc: "State where auto accident occurred" },
            { pos: "CLM11-5", name: "Country Code", req: "S", type: "ID", length: "2-3", desc: "Country code" },
            { pos: "CLM12", name: "Special Program Code", req: "S", type: "ID", length: "2-3", desc: "Special program code" },
            { pos: "CLM20", name: "Delay Reason Code", req: "S", type: "ID", length: "1-2", desc: "Delay reason code" }
          ]
        },
        {
          id: "DTP",
          name: "Claim Dates",
          usage: "Situational",
          repeat: "16",
          elements: [
            { pos: "DTP01", name: "Date/Time Qualifier", req: "R", type: "ID", length: "3", desc: "431 = Onset, 454 = Initial Treatment, 304 = Last Seen, 453 = Acute Manifestation, 439 = Accident, 484 = Last Menstrual Period, 455 = Last X-ray, 471 = Prescription, 090 = Assumed Care, 091 = Relinquished Care, 435 = Admission, 096 = Discharge, 314 = Disability From, 361 = Disability To, 297 = Last Worked, 296 = Authorized Return to Work" },
            { pos: "DTP02", name: "Date Time Period Format Qualifier", req: "R", type: "ID", length: "2-3", desc: "D8 = Date (CCYYMMDD), RD8 = Date Range" },
            { pos: "DTP03", name: "Date Time Period", req: "R", type: "AN", length: "1-35", desc: "Date value (CCYYMMDD or range)" }
          ]
        },
        {
          id: "PWK",
          name: "Claim Supplemental Information",
          usage: "Situational",
          repeat: "10",
          elements: [
            { pos: "PWK01", name: "Report Type Code", req: "R", type: "ID", length: "2", desc: "OZ = Support Data, 77 = Attestation Statement, etc." },
            { pos: "PWK02", name: "Report Transmission Code", req: "R", type: "ID", length: "1-2", desc: "AA = Available on Request, EL = Electronic, BM = By Mail" },
            { pos: "PWK05", name: "Identification Code Qualifier", req: "S", type: "ID", length: "1-2", desc: "AC = Attachment Control Number" },
            { pos: "PWK06", name: "Identification Code", req: "S", type: "AN", length: "2-80", desc: "Attachment control number" }
          ]
        },
        {
          id: "CN1",
          name: "Contract Information",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "CN101", name: "Contract Type Code", req: "R", type: "ID", length: "2", desc: "01 = Diagnosis Related Group, 02 = Per Diem, 03 = Variable, 04 = Flat, 05 = Capitated, 06 = Percent, 09 = Other" },
            { pos: "CN102", name: "Monetary Amount", req: "S", type: "R", length: "1-18", desc: "Contract amount" },
            { pos: "CN103", name: "Percent", req: "S", type: "R", length: "1-6", desc: "Contract percentage" },
            { pos: "CN104", name: "Reference Identification", req: "S", type: "AN", length: "1-50", desc: "Contract code" },
            { pos: "CN105", name: "Terms Discount Percent", req: "S", type: "R", length: "1-6", desc: "Discount percentage" },
            { pos: "CN106", name: "Version Identifier", req: "S", type: "AN", length: "1-30", desc: "Contract version" }
          ]
        },
        {
          id: "AMT",
          name: "Patient Amount Paid",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "AMT01", name: "Amount Qualifier Code", req: "R", type: "ID", length: "1-3", desc: "F5 = Patient Amount Paid" },
            { pos: "AMT02", name: "Monetary Amount", req: "R", type: "R", length: "1-18", desc: "Amount paid by patient" }
          ]
        },
        {
          id: "REF",
          name: "Claim Reference Identification",
          usage: "Situational",
          repeat: "14",
          elements: [
            { pos: "REF01", name: "Reference Identification Qualifier", req: "R", type: "ID", length: "2-3", desc: "4N = Service Authorization Exception, 9F = Referral Number, G1 = Prior Authorization, F8 = Payer Claim Control Number, D9 = Clearinghouse Trace, 9A = Repriced Ref, 9C = Adjusted Repriced Ref, EA = Medical Record Number, P4 = Demonstration Project" },
            { pos: "REF02", name: "Reference Identification", req: "R", type: "AN", length: "1-50", desc: "Reference identification value" }
          ]
        },
        {
          id: "NTE",
          name: "Claim Note",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "NTE01", name: "Note Reference Code", req: "R", type: "ID", length: "3", desc: "ADD = Additional Information, CER = Certification Narrative, DCP = Goals/Rehab/Discharge Plans, DGN = Diagnosis Description, PMT = Payment" },
            { pos: "NTE02", name: "Description", req: "R", type: "AN", length: "1-80", desc: "Free-form claim note" }
          ]
        },
        {
          id: "CR1",
          name: "Ambulance Transport Information",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "CR101", name: "Unit or Basis for Measurement", req: "S", type: "ID", length: "1-2", desc: "LB = Pounds" },
            { pos: "CR102", name: "Patient Weight", req: "S", type: "R", length: "1-10", desc: "Patient weight" },
            { pos: "CR104", name: "Ambulance Transport Reason Code", req: "R", type: "ID", length: "1", desc: "A = Nearest Facility, B = Physician, C = Family, D = Specialist, E = Rehab" },
            { pos: "CR106", name: "Transport Distance", req: "R", type: "R", length: "1-15", desc: "Transport distance in miles" },
            { pos: "CR109", name: "Round Trip Purpose Description", req: "S", type: "AN", length: "1-80", desc: "Round trip purpose" },
            { pos: "CR110", name: "Stretcher Purpose Description", req: "S", type: "AN", length: "1-80", desc: "Stretcher purpose" }
          ]
        },
        {
          id: "CR2",
          name: "Spinal Manipulation Service Information",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "CR208", name: "Patient Condition Code", req: "R", type: "ID", length: "1", desc: "Condition code (A-L)" },
            { pos: "CR210", name: "Patient Condition Description", req: "S", type: "AN", length: "1-80", desc: "Condition description" },
            { pos: "CR211", name: "Patient Condition Description 2", req: "S", type: "AN", length: "1-80", desc: "Additional description" }
          ]
        },
        {
          id: "CRC",
          name: "Conditions Indicator",
          usage: "Situational",
          repeat: "8",
          elements: [
            { pos: "CRC01", name: "Code Category", req: "R", type: "ID", length: "2", desc: "07 = Ambulance Certification, E1 = Spectacle Lenses, E2 = Contact Lenses, E3 = Spectacle Frames, 75 = Homebound, ZZ = EPSDT" },
            { pos: "CRC02", name: "Yes/No Condition Response Code", req: "R", type: "ID", length: "1", desc: "Y = Yes, N = No" },
            { pos: "CRC03", name: "Condition Indicator 1", req: "R", type: "ID", length: "2-3", desc: "Condition code" },
            { pos: "CRC04", name: "Condition Indicator 2", req: "S", type: "ID", length: "2-3", desc: "Condition code" },
            { pos: "CRC05", name: "Condition Indicator 3", req: "S", type: "ID", length: "2-3", desc: "Condition code" }
          ]
        },
        {
          id: "HI",
          name: "Health Care Diagnosis Codes",
          usage: "Required",
          repeat: "12",
          elements: [
            { pos: "HI01-1", name: "Diagnosis Type Code (Principal)", req: "R", type: "ID", length: "1-3", desc: "ABK = ICD-10-CM Principal, BK = ICD-9 Principal" },
            { pos: "HI01-2", name: "Diagnosis Code (Principal)", req: "R", type: "AN", length: "1-30", desc: "ICD-10-CM diagnosis code" },
            { pos: "HI02-1", name: "Diagnosis Type Code (Other)", req: "S", type: "ID", length: "1-3", desc: "ABF = ICD-10-CM, BF = ICD-9" },
            { pos: "HI02-2", name: "Diagnosis Code (Other)", req: "S", type: "AN", length: "1-30", desc: "Additional diagnosis code" },
            { pos: "HI03-12", name: "Additional Diagnosis Codes", req: "S", type: "AN", length: "1-30", desc: "Up to 12 diagnosis code composites per HI segment" }
          ]
        },
        {
          id: "HCP",
          name: "Claim Pricing / Repricing Information",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "HCP01", name: "Pricing Methodology", req: "R", type: "ID", length: "2", desc: "00 = Zero Pricing, 01 = Priced as Billed, etc." },
            { pos: "HCP02", name: "Repriced Allowed Amount", req: "R", type: "R", length: "1-18", desc: "Repriced amount" },
            { pos: "HCP03", name: "Repriced Saving Amount", req: "S", type: "R", length: "1-18", desc: "Savings amount" },
            { pos: "HCP04", name: "Repricing Organization Identifier", req: "S", type: "AN", length: "1-50", desc: "Org identifier" },
            { pos: "HCP05", name: "Repricing Per Diem or Flat Rate Amount", req: "S", type: "R", length: "1-9", desc: "Per diem/flat rate" },
            { pos: "HCP13", name: "Reject Reason Code", req: "S", type: "ID", length: "2", desc: "Reject reason code" },
            { pos: "HCP14", name: "Policy Compliance Code", req: "S", type: "ID", length: "1-2", desc: "Policy compliance" },
            { pos: "HCP15", name: "Exception Code", req: "S", type: "ID", length: "1-2", desc: "Exception code" }
          ]
        }
      ]
    },
    /* ── 2310A — Referring Provider ── */
    {
      id: "2310A",
      name: "Referring Provider Name",
      repeat: "2",
      segments: [
        {
          id: "NM1",
          name: "Referring Provider (NM1*DN)",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "NM101", name: "Entity Identifier Code", req: "R", type: "ID", length: "2-3", desc: "DN = Referring Provider" },
            { pos: "NM102", name: "Entity Type Qualifier", req: "R", type: "ID", length: "1", desc: "1 = Person" },
            { pos: "NM103", name: "Last Name", req: "R", type: "AN", length: "1-60", desc: "Referring provider last name" },
            { pos: "NM104", name: "First Name", req: "S", type: "AN", length: "1-35", desc: "First name" },
            { pos: "NM105", name: "Middle Name", req: "S", type: "AN", length: "1-25", desc: "Middle name" },
            { pos: "NM108", name: "Identification Code Qualifier", req: "R", type: "ID", length: "1-2", desc: "XX = NPI" },
            { pos: "NM109", name: "Referring Provider NPI", req: "R", type: "AN", length: "2-80", desc: "NPI" }
          ]
        },
        { id: "REF", name: "Referring Provider Secondary ID", usage: "Situational", repeat: "3", elements: [
            { pos: "REF01", name: "Reference ID Qualifier", req: "R", type: "ID", length: "2-3", desc: "0B = State License, 1G = Provider UPIN, G2 = Provider Commercial" },
            { pos: "REF02", name: "Reference Identification", req: "R", type: "AN", length: "1-50", desc: "Secondary ID" }
        ]}
      ]
    },
    /* ── 2310B — Rendering Provider ── */
    {
      id: "2310B",
      name: "Rendering Provider Name",
      repeat: "1",
      segments: [
        {
          id: "NM1",
          name: "Rendering Provider (NM1*82)",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "NM101", name: "Entity Identifier Code", req: "R", type: "ID", length: "2-3", desc: "82 = Rendering Provider" },
            { pos: "NM102", name: "Entity Type Qualifier", req: "R", type: "ID", length: "1", desc: "1 = Person, 2 = Non-Person" },
            { pos: "NM103", name: "Last Name or Organization Name", req: "R", type: "AN", length: "1-60", desc: "Rendering provider last name" },
            { pos: "NM104", name: "First Name", req: "S", type: "AN", length: "1-35", desc: "First name" },
            { pos: "NM105", name: "Middle Name", req: "S", type: "AN", length: "1-25", desc: "Middle name" },
            { pos: "NM107", name: "Name Suffix", req: "S", type: "AN", length: "1-10", desc: "Suffix" },
            { pos: "NM108", name: "Identification Code Qualifier", req: "R", type: "ID", length: "1-2", desc: "XX = NPI" },
            { pos: "NM109", name: "Rendering Provider NPI", req: "R", type: "AN", length: "2-80", desc: "NPI" }
          ]
        },
        {
          id: "PRV",
          name: "Rendering Provider Specialty",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "PRV01", name: "Provider Code", req: "R", type: "ID", length: "1-3", desc: "PE = Performing" },
            { pos: "PRV02", name: "Reference ID Qualifier", req: "R", type: "ID", length: "1-3", desc: "PXC = Health Care Provider Taxonomy" },
            { pos: "PRV03", name: "Taxonomy Code", req: "R", type: "AN", length: "1-50", desc: "Provider taxonomy code" }
          ]
        },
        { id: "REF", name: "Rendering Provider Secondary ID", usage: "Situational", repeat: "4", elements: [
            { pos: "REF01", name: "Reference ID Qualifier", req: "R", type: "ID", length: "2-3", desc: "0B = State License, 1G = UPIN, G2 = Commercial" },
            { pos: "REF02", name: "Reference Identification", req: "R", type: "AN", length: "1-50", desc: "Secondary ID" }
        ]}
      ]
    },
    /* ── 2310C — Service Facility Location ── */
    {
      id: "2310C",
      name: "Service Facility Location Name",
      repeat: "1",
      segments: [
        {
          id: "NM1",
          name: "Service Facility (NM1*77)",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "NM101", name: "Entity Identifier Code", req: "R", type: "ID", length: "2-3", desc: "77 = Service Location" },
            { pos: "NM102", name: "Entity Type Qualifier", req: "R", type: "ID", length: "1", desc: "2 = Non-Person" },
            { pos: "NM103", name: "Facility Name", req: "S", type: "AN", length: "1-60", desc: "Facility name" },
            { pos: "NM108", name: "Identification Code Qualifier", req: "S", type: "ID", length: "1-2", desc: "XX = NPI" },
            { pos: "NM109", name: "Facility NPI", req: "S", type: "AN", length: "2-80", desc: "NPI" }
          ]
        },
        { id: "N3", name: "Service Facility Address", usage: "Required", repeat: "1", elements: [
            { pos: "N301", name: "Address Line 1", req: "R", type: "AN", length: "1-55", desc: "Address" }
        ]},
        { id: "N4", name: "Service Facility City, State, ZIP", usage: "Required", repeat: "1", elements: [
            { pos: "N401", name: "City", req: "R", type: "AN", length: "2-30", desc: "City" },
            { pos: "N402", name: "State", req: "S", type: "ID", length: "2", desc: "State" },
            { pos: "N403", name: "Postal Code", req: "S", type: "ID", length: "3-15", desc: "ZIP" }
        ]},
        { id: "REF", name: "Service Facility Secondary ID", usage: "Situational", repeat: "3", elements: [
            { pos: "REF01", name: "Reference ID Qualifier", req: "R", type: "ID", length: "2-3", desc: "0B, G2, LU" },
            { pos: "REF02", name: "Reference Identification", req: "R", type: "AN", length: "1-50", desc: "Secondary ID" }
        ]}
      ]
    },
    /* ── 2310D — Supervising Provider ── */
    {
      id: "2310D",
      name: "Supervising Provider Name",
      repeat: "1",
      segments: [
        { id: "NM1", name: "Supervising Provider (NM1*DQ)", usage: "Situational", repeat: "1", elements: [
            { pos: "NM101", name: "Entity Identifier Code", req: "R", type: "ID", length: "2-3", desc: "DQ = Supervising Provider" },
            { pos: "NM102", name: "Entity Type Qualifier", req: "R", type: "ID", length: "1", desc: "1 = Person" },
            { pos: "NM103", name: "Last Name", req: "R", type: "AN", length: "1-60", desc: "Last name" },
            { pos: "NM104", name: "First Name", req: "S", type: "AN", length: "1-35", desc: "First name" },
            { pos: "NM108", name: "Identification Code Qualifier", req: "R", type: "ID", length: "1-2", desc: "XX = NPI" },
            { pos: "NM109", name: "NPI", req: "R", type: "AN", length: "2-80", desc: "NPI" }
        ]},
        { id: "REF", name: "Supervising Provider Secondary ID", usage: "Situational", repeat: "4", elements: [
            { pos: "REF01", name: "Reference ID Qualifier", req: "R", type: "ID", length: "2-3", desc: "0B, 1G, G2" },
            { pos: "REF02", name: "Reference Identification", req: "R", type: "AN", length: "1-50", desc: "Secondary ID" }
        ]}
      ]
    },
    /* ── 2310E/F — Ambulance Pick-Up / Drop-Off ── */
    {
      id: "2310E",
      name: "Ambulance Pick-Up Location",
      repeat: "1",
      segments: [
        { id: "NM1", name: "Ambulance Pick-Up (NM1*PW)", usage: "Situational", repeat: "1", elements: [
            { pos: "NM101", name: "Entity Identifier Code", req: "R", type: "ID", length: "2-3", desc: "PW = Ambulance Pick-Up" },
            { pos: "NM102", name: "Entity Type Qualifier", req: "R", type: "ID", length: "1", desc: "2 = Non-Person" }
        ]},
        { id: "N3", name: "Ambulance Pick-Up Address", usage: "Required", repeat: "1", elements: [
            { pos: "N301", name: "Address Line", req: "R", type: "AN", length: "1-55", desc: "Address" }
        ]},
        { id: "N4", name: "Ambulance Pick-Up City, State, ZIP", usage: "Required", repeat: "1", elements: [
            { pos: "N401", name: "City", req: "R", type: "AN", length: "2-30", desc: "City" },
            { pos: "N402", name: "State", req: "S", type: "ID", length: "2", desc: "State" },
            { pos: "N403", name: "ZIP", req: "S", type: "ID", length: "3-15", desc: "ZIP" }
        ]}
      ]
    },
    {
      id: "2310F",
      name: "Ambulance Drop-Off Location",
      repeat: "1",
      segments: [
        { id: "NM1", name: "Ambulance Drop-Off (NM1*45)", usage: "Situational", repeat: "1", elements: [
            { pos: "NM101", name: "Entity Identifier Code", req: "R", type: "ID", length: "2-3", desc: "45 = Ambulance Drop-Off" },
            { pos: "NM102", name: "Entity Type Qualifier", req: "R", type: "ID", length: "1", desc: "2 = Non-Person" }
        ]},
        { id: "N3", name: "Ambulance Drop-Off Address", usage: "Required", repeat: "1", elements: [
            { pos: "N301", name: "Address Line", req: "R", type: "AN", length: "1-55", desc: "Address" }
        ]},
        { id: "N4", name: "Ambulance Drop-Off City, State, ZIP", usage: "Required", repeat: "1", elements: [
            { pos: "N401", name: "City", req: "R", type: "AN", length: "2-30", desc: "City" },
            { pos: "N402", name: "State", req: "S", type: "ID", length: "2", desc: "State" },
            { pos: "N403", name: "ZIP", req: "S", type: "ID", length: "3-15", desc: "ZIP" }
        ]}
      ]
    },
    /* ── 2320 — Other Subscriber Information ── */
    {
      id: "2320",
      name: "Other Subscriber Information",
      repeat: "10",
      segments: [
        {
          id: "SBR",
          name: "Other Subscriber Information",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "SBR01", name: "Payer Responsibility Sequence", req: "R", type: "ID", length: "1", desc: "P, S, T" },
            { pos: "SBR02", name: "Individual Relationship Code", req: "R", type: "ID", length: "2", desc: "Relationship" },
            { pos: "SBR03", name: "Group or Policy Number", req: "S", type: "AN", length: "1-50", desc: "Policy number" },
            { pos: "SBR04", name: "Group Name", req: "S", type: "AN", length: "1-60", desc: "Group name" },
            { pos: "SBR09", name: "Claim Filing Indicator Code", req: "R", type: "ID", length: "1-2", desc: "Claim filing code" }
          ]
        },
        { id: "CAS", name: "Claim Level Adjustments", usage: "Situational", repeat: "5", elements: [
            { pos: "CAS01", name: "Claim Adjustment Group Code", req: "R", type: "ID", length: "1-2", desc: "CO = Contractual, PR = Patient Responsibility, OA = Other, PI = Payor Initiated, CR = Correction" },
            { pos: "CAS02", name: "Adjustment Reason Code", req: "R", type: "AN", length: "1-5", desc: "CARC reason code" },
            { pos: "CAS03", name: "Adjustment Amount", req: "R", type: "R", length: "1-18", desc: "Monetary adjustment" },
            { pos: "CAS04", name: "Adjustment Quantity", req: "S", type: "R", length: "1-15", desc: "Quantity" }
        ]},
        { id: "AMT", name: "COB Payer Paid Amount", usage: "Situational", repeat: "3", elements: [
            { pos: "AMT01", name: "Amount Qualifier", req: "R", type: "ID", length: "1-3", desc: "D = Payor Amount Paid, A8 = Non-Covered, EAF = Remaining Patient Liability" },
            { pos: "AMT02", name: "Amount", req: "R", type: "R", length: "1-18", desc: "Monetary amount" }
        ]},
        { id: "MOA", name: "Outpatient Adjudication Information", usage: "Situational", repeat: "1", elements: [
            { pos: "MOA01", name: "Reimbursement Rate", req: "S", type: "R", length: "1-10", desc: "Reimbursement rate" },
            { pos: "MOA02", name: "HCPCS Payable Amount", req: "S", type: "R", length: "1-18", desc: "Claim HCPCS payable" },
            { pos: "MOA08", name: "ESRD Payment Amount", req: "S", type: "R", length: "1-18", desc: "ESRD payment" },
            { pos: "MOA09", name: "Non-Payable Professional Component", req: "S", type: "R", length: "1-18", desc: "Non-payable professional component" }
        ]}
      ]
    },
    /* ── 2400 — Service Line ── */
    {
      id: "2400",
      name: "Service Line Number / Professional Service",
      repeat: "50",
      segments: [
        {
          id: "LX",
          name: "Service Line Number",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "LX01", name: "Assigned Number", req: "R", type: "N0", length: "1-6", desc: "Line number (sequential within claim)" }
          ]
        },
        {
          id: "SV1",
          name: "Professional Service",
          usage: "Required",
          repeat: "1",
          elements: [
            { pos: "SV101-1", name: "Product/Service ID Qualifier", req: "R", type: "ID", length: "2", desc: "HC = HCPCS / CPT, AD = American Dental (CDT), IV = HIPPS" },
            { pos: "SV101-2", name: "Procedure Code", req: "R", type: "AN", length: "1-48", desc: "CPT/HCPCS procedure code" },
            { pos: "SV101-3", name: "Modifier 1", req: "S", type: "AN", length: "2", desc: "Procedure modifier 1" },
            { pos: "SV101-4", name: "Modifier 2", req: "S", type: "AN", length: "2", desc: "Procedure modifier 2" },
            { pos: "SV101-5", name: "Modifier 3", req: "S", type: "AN", length: "2", desc: "Procedure modifier 3" },
            { pos: "SV101-6", name: "Modifier 4", req: "S", type: "AN", length: "2", desc: "Procedure modifier 4" },
            { pos: "SV101-7", name: "Description", req: "S", type: "AN", length: "1-80", desc: "Procedure description" },
            { pos: "SV102", name: "Line Item Charge Amount", req: "R", type: "R", length: "1-18", desc: "Charge amount for line" },
            { pos: "SV103", name: "Unit or Basis for Measurement Code", req: "R", type: "ID", length: "1-2", desc: "MJ = Minutes, UN = Unit, DA = Days" },
            { pos: "SV104", name: "Service Unit Count", req: "R", type: "R", length: "1-15", desc: "Number of units" },
            { pos: "SV105", name: "Place of Service Code", req: "S", type: "ID", length: "1-2", desc: "Line-level POS override" },
            { pos: "SV107", name: "Diagnosis Code Pointer", req: "R", type: "AN", length: "1-12", desc: "Colon-separated pointers to HI diagnosis codes (e.g., 1:2:3:4)" },
            { pos: "SV109", name: "Emergency Indicator", req: "S", type: "ID", length: "1", desc: "Y = Emergency" },
            { pos: "SV111", name: "EPSDT Indicator", req: "S", type: "ID", length: "1", desc: "Y = EPSDT" },
            { pos: "SV112", name: "Family Planning Indicator", req: "S", type: "ID", length: "1", desc: "Y = Family Planning" },
            { pos: "SV115", name: "Copay Status Code", req: "S", type: "ID", length: "1", desc: "0 = No Copay" }
          ]
        },
        {
          id: "DTP",
          name: "Service Line Dates",
          usage: "Required",
          repeat: "10",
          elements: [
            { pos: "DTP01", name: "Date/Time Qualifier", req: "R", type: "ID", length: "3", desc: "472 = Service Date, 150 = Service Period Start, 151 = Service Period End, 471 = Prescription, 463 = Begin Therapy, 304 = Last Seen, 738/739 = Test Date, 455 = Last X-ray, 454 = Initial Treatment" },
            { pos: "DTP02", name: "Date Time Period Format Qualifier", req: "R", type: "ID", length: "2-3", desc: "D8 = Date, RD8 = Date Range" },
            { pos: "DTP03", name: "Date Time Period", req: "R", type: "AN", length: "1-35", desc: "Date value" }
          ]
        },
        { id: "REF", name: "Line Item Reference IDs", usage: "Situational", repeat: "8", elements: [
            { pos: "REF01", name: "Reference ID Qualifier", req: "R", type: "ID", length: "2-3", desc: "6R = Line Item Control Number, 9B = Repriced Line Item Ref, 9D = Adjusted Repriced Line Item Ref, G1 = Prior Authorization, 9F = Referral, XZ = Prescription Number" },
            { pos: "REF02", name: "Reference Identification", req: "R", type: "AN", length: "1-50", desc: "Reference ID value" }
        ]},
        { id: "AMT", name: "Line Item Amounts", usage: "Situational", repeat: "2", elements: [
            { pos: "AMT01", name: "Amount Qualifier Code", req: "R", type: "ID", length: "1-3", desc: "T = Sales Tax, GT = Gross Tax" },
            { pos: "AMT02", name: "Amount", req: "R", type: "R", length: "1-18", desc: "Amount" }
        ]},
        { id: "NTE", name: "Line Note", usage: "Situational", repeat: "2", elements: [
            { pos: "NTE01", name: "Note Reference Code", req: "R", type: "ID", length: "3", desc: "ADD = Additional Information, DCP = Goals/Rehab/Discharge, TPO = Third Party" },
            { pos: "NTE02", name: "Description", req: "R", type: "AN", length: "1-80", desc: "Free-form line note" }
        ]},
        {
          id: "PWK",
          name: "Line Supplemental Information",
          usage: "Situational",
          repeat: "10",
          elements: [
            { pos: "PWK01", name: "Report Type Code", req: "R", type: "ID", length: "2", desc: "Report type" },
            { pos: "PWK02", name: "Report Transmission Code", req: "R", type: "ID", length: "1-2", desc: "Transmission code" }
          ]
        },
        {
          id: "LIN",
          name: "Drug Identification (NDC)",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "LIN02", name: "Product/Service ID Qualifier", req: "R", type: "ID", length: "2", desc: "N4 = National Drug Code (NDC)" },
            { pos: "LIN03", name: "National Drug Code", req: "R", type: "AN", length: "1-48", desc: "NDC code" }
          ]
        },
        {
          id: "CTP",
          name: "Drug Quantity",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "CTP04", name: "Quantity", req: "R", type: "R", length: "1-15", desc: "Drug quantity" },
            { pos: "CTP05-1", name: "Unit or Basis for Measurement Code", req: "R", type: "ID", length: "1-2", desc: "F2 = International Unit, GR = Gram, ML = Milliliter, UN = Unit" }
          ]
        },
        {
          id: "SV5",
          name: "Durable Medical Equipment Service",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "SV501", name: "Procedure Code", req: "R", type: "AN", length: "1-48", desc: "HCPCS code (composite)" },
            { pos: "SV502", name: "Unit of Measurement", req: "R", type: "ID", length: "1-2", desc: "DA = Days" },
            { pos: "SV503", name: "Length of Medical Necessity", req: "R", type: "R", length: "1-15", desc: "Duration" },
            { pos: "SV504", name: "Rental Price", req: "R", type: "R", length: "1-18", desc: "Rental price" },
            { pos: "SV505", name: "Purchase Price", req: "R", type: "R", length: "1-18", desc: "Purchase price" },
            { pos: "SV506", name: "Frequency Code", req: "R", type: "ID", length: "1", desc: "1 = Weekly, 4 = Monthly, 6 = Daily" }
          ]
        }
      ]
    },
    /* ── 2420A-F — Line-Level Provider Names ── */
    {
      id: "2420A",
      name: "Rendering Provider (Line Level)",
      repeat: "1",
      segments: [
        { id: "NM1", name: "Rendering Provider (NM1*82)", usage: "Situational", repeat: "1", elements: [
            { pos: "NM101", name: "Entity ID Code", req: "R", type: "ID", length: "2-3", desc: "82 = Rendering Provider" },
            { pos: "NM102", name: "Entity Type", req: "R", type: "ID", length: "1", desc: "1 or 2" },
            { pos: "NM103", name: "Last Name / Org Name", req: "R", type: "AN", length: "1-60", desc: "Name" },
            { pos: "NM104", name: "First Name", req: "S", type: "AN", length: "1-35", desc: "First name" },
            { pos: "NM108", name: "ID Code Qualifier", req: "R", type: "ID", length: "1-2", desc: "XX = NPI" },
            { pos: "NM109", name: "NPI", req: "R", type: "AN", length: "2-80", desc: "NPI" }
        ]},
        { id: "PRV", name: "Rendering Provider Specialty (Line)", usage: "Situational", repeat: "1", elements: [
            { pos: "PRV01", name: "Provider Code", req: "R", type: "ID", length: "1-3", desc: "PE = Performing" },
            { pos: "PRV02", name: "Reference ID Qualifier", req: "R", type: "ID", length: "1-3", desc: "PXC" },
            { pos: "PRV03", name: "Taxonomy Code", req: "R", type: "AN", length: "1-50", desc: "Taxonomy" }
        ]}
      ]
    },
    {
      id: "2420B",
      name: "Purchased Service Provider (Line Level)",
      repeat: "1",
      segments: [
        { id: "NM1", name: "Purchased Service Provider (NM1*QB)", usage: "Situational", repeat: "1", elements: [
            { pos: "NM101", name: "Entity ID Code", req: "R", type: "ID", length: "2-3", desc: "QB = Purchased Service Provider" },
            { pos: "NM103", name: "Last Name / Org Name", req: "R", type: "AN", length: "1-60", desc: "Name" },
            { pos: "NM108", name: "ID Code Qualifier", req: "S", type: "ID", length: "1-2", desc: "XX = NPI" },
            { pos: "NM109", name: "NPI", req: "S", type: "AN", length: "2-80", desc: "NPI" }
        ]}
      ]
    },
    {
      id: "2420C",
      name: "Service Facility (Line Level)",
      repeat: "1",
      segments: [
        { id: "NM1", name: "Service Facility (NM1*77)", usage: "Situational", repeat: "1", elements: [
            { pos: "NM101", name: "Entity ID Code", req: "R", type: "ID", length: "2-3", desc: "77" },
            { pos: "NM103", name: "Facility Name", req: "S", type: "AN", length: "1-60", desc: "Facility name" },
            { pos: "NM108", name: "ID Code Qualifier", req: "S", type: "ID", length: "1-2", desc: "XX" },
            { pos: "NM109", name: "NPI", req: "S", type: "AN", length: "2-80", desc: "NPI" }
        ]},
        { id: "N3", name: "Service Facility Address (Line)", usage: "Required", repeat: "1", elements: [
            { pos: "N301", name: "Address", req: "R", type: "AN", length: "1-55", desc: "Address" }
        ]},
        { id: "N4", name: "Service Facility City/State/ZIP (Line)", usage: "Required", repeat: "1", elements: [
            { pos: "N401", name: "City", req: "R", type: "AN", length: "2-30", desc: "City" },
            { pos: "N402", name: "State", req: "S", type: "ID", length: "2", desc: "State" },
            { pos: "N403", name: "ZIP", req: "S", type: "ID", length: "3-15", desc: "ZIP" }
        ]}
      ]
    },
    {
      id: "2420D",
      name: "Supervising Provider (Line Level)",
      repeat: "1",
      segments: [
        { id: "NM1", name: "Supervising Provider (NM1*DQ)", usage: "Situational", repeat: "1", elements: [
            { pos: "NM101", name: "Entity ID Code", req: "R", type: "ID", length: "2-3", desc: "DQ" },
            { pos: "NM103", name: "Last Name", req: "R", type: "AN", length: "1-60", desc: "Last name" },
            { pos: "NM104", name: "First Name", req: "S", type: "AN", length: "1-35", desc: "First name" },
            { pos: "NM108", name: "ID Code Qualifier", req: "R", type: "ID", length: "1-2", desc: "XX" },
            { pos: "NM109", name: "NPI", req: "R", type: "AN", length: "2-80", desc: "NPI" }
        ]}
      ]
    },
    {
      id: "2420E",
      name: "Ordering Provider (Line Level)",
      repeat: "1",
      segments: [
        { id: "NM1", name: "Ordering Provider (NM1*DK)", usage: "Situational", repeat: "1", elements: [
            { pos: "NM101", name: "Entity ID Code", req: "R", type: "ID", length: "2-3", desc: "DK = Ordering Provider" },
            { pos: "NM103", name: "Last Name", req: "R", type: "AN", length: "1-60", desc: "Last name" },
            { pos: "NM104", name: "First Name", req: "S", type: "AN", length: "1-35", desc: "First name" },
            { pos: "NM108", name: "ID Code Qualifier", req: "R", type: "ID", length: "1-2", desc: "XX" },
            { pos: "NM109", name: "NPI", req: "R", type: "AN", length: "2-80", desc: "NPI" }
        ]}
      ]
    },
    /* ── 2430 — Line Adjudication ── */
    {
      id: "2430",
      name: "Line Adjudication Information",
      repeat: "15",
      segments: [
        {
          id: "SVD",
          name: "Line Adjudication Information",
          usage: "Situational",
          repeat: "1",
          elements: [
            { pos: "SVD01", name: "Other Payer Primary Identifier", req: "R", type: "AN", length: "1-80", desc: "Payer identifier" },
            { pos: "SVD02", name: "Service Line Paid Amount", req: "R", type: "R", length: "1-18", desc: "Paid amount" },
            { pos: "SVD03", name: "Composite Medical Procedure", req: "R", type: "AN", length: "1-48", desc: "Procedure composite" },
            { pos: "SVD05", name: "Paid Service Unit Count", req: "R", type: "R", length: "1-15", desc: "Units paid" },
            { pos: "SVD06", name: "Bundled/Unbundled Line Number", req: "S", type: "N0", length: "1-6", desc: "Line number" }
          ]
        },
        { id: "CAS", name: "Line Adjustment", usage: "Situational", repeat: "5", elements: [
            { pos: "CAS01", name: "Claim Adjustment Group Code", req: "R", type: "ID", length: "1-2", desc: "CO, PR, OA, PI, CR" },
            { pos: "CAS02", name: "Reason Code", req: "R", type: "AN", length: "1-5", desc: "CARC" },
            { pos: "CAS03", name: "Amount", req: "R", type: "R", length: "1-18", desc: "Amount" },
            { pos: "CAS04", name: "Quantity", req: "S", type: "R", length: "1-15", desc: "Quantity" }
        ]},
        { id: "DTP", name: "Adjudication Date", usage: "Required", repeat: "1", elements: [
            { pos: "DTP01", name: "Date/Time Qualifier", req: "R", type: "ID", length: "3", desc: "573 = Date Claim Paid" },
            { pos: "DTP02", name: "Date Format", req: "R", type: "ID", length: "2-3", desc: "D8" },
            { pos: "DTP03", name: "Adjudication/Payment Date", req: "R", type: "AN", length: "1-35", desc: "Date" }
        ]},
        { id: "AMT", name: "Remaining Patient Liability", usage: "Situational", repeat: "1", elements: [
            { pos: "AMT01", name: "Amount Qualifier", req: "R", type: "ID", length: "1-3", desc: "EAF = Remaining Patient Liability" },
            { pos: "AMT02", name: "Amount", req: "R", type: "R", length: "1-18", desc: "Amount" }
        ]}
      ]
    }
  ]
};
