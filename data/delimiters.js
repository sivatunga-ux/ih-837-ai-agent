/**
 * X12 837 Delimiter Configuration
 *
 * In the ANSI X12 standard, delimiters are NOT fixed characters — they are
 * defined by the ISA segment header itself. Every X12 file declares its own
 * delimiters in the first 106 characters (the ISA segment).
 *
 * Positions in the ISA segment that define delimiters:
 *   - Character at position 3   → Element Separator (typically *)
 *   - Character at position 104 → Sub-Element (Component) Separator (typically :)
 *   - Character at position 105 → Segment Terminator (typically ~)
 *   - ISA11 (position 82-83)    → Repetition Separator (typically ^ in 5010)
 *
 * The ISA segment is always EXACTLY 106 characters (including the segment
 * terminator). This fixed length allows parsers to extract delimiters before
 * parsing any data.
 */

export const DELIMITER_DEFAULTS = {
  element:     "*",
  subElement:  ":",
  segment:     "~",
  repetition:  "^"
};

export const DELIMITER_SPEC = [
  {
    id: "element",
    name: "Element Separator",
    symbol: "*",
    isaPosition: "ISA character position 3 (the character immediately after 'ISA')",
    purpose: "Separates data elements within a segment",
    example: "CLM*12345*500***11:B:1~",
    exampleHighlight: "CLM<mark>*</mark>12345<mark>*</mark>500<mark>*</mark><mark>*</mark><mark>*</mark>11:B:1~",
    notes: "Most common is asterisk (*). Some trading partners use | or ^ but these are rare in healthcare."
  },
  {
    id: "subElement",
    name: "Sub-Element (Component) Separator",
    symbol: ":",
    isaPosition: "ISA16 — character position 104 (the last character before the segment terminator)",
    purpose: "Separates components within a composite data element (sub-elements)",
    example: "CLM*12345*500***11:B:1~  and  SV1*HC:99213*150*UN*1~",
    exampleHighlight: "CLM*12345*500***11<mark>:</mark>B<mark>:</mark>1~  and  SV1*HC<mark>:</mark>99213*150*UN*1~",
    notes: "Colon (:) is standard in 5010. Used in CLM05 (facility:qualifier:frequency), SV1-01 (qualifier:code:modifier), HI composites (qualifier:code), etc."
  },
  {
    id: "segment",
    name: "Segment Terminator",
    symbol: "~",
    isaPosition: "Character position 105 (the very last character of the 106-character ISA segment)",
    purpose: "Marks the end of each segment (end-of-line for EDI segments)",
    example: "ST*837*0001~\\nBHT*0019*00*12345*20240101*1200*CH~",
    exampleHighlight: "ST*837*0001<mark>~</mark>\\nBHT*0019*00*12345*20240101*1200*CH<mark>~</mark>",
    notes: "Tilde (~) is the standard. In raw EDI, segments may or may not have a newline after ~. Parsers must split on ~ regardless of whitespace. Some legacy files use \\n or \\r\\n as the terminator."
  },
  {
    id: "repetition",
    name: "Repetition Separator",
    symbol: "^",
    isaPosition: "ISA11 — character position 82 (Repetition Separator element in the ISA header)",
    purpose: "Separates repeated occurrences of a data element or composite",
    example: "NM1*85*2*ACME HEALTH^DOING BUSINESS AS NAME****XX*1234567890~",
    exampleHighlight: "NM1*85*2*ACME HEALTH<mark>^</mark>DOING BUSINESS AS NAME****XX*1234567890~",
    notes: "Caret (^) is standard in 5010. In 4010, ISA11 was a 'U' placeholder (not a real repetition separator). Repetition separators are rarely used in 837 healthcare claims."
  }
];

export const ISA_LAYOUT = {
  description: "The ISA segment is always exactly 106 characters. Delimiters are self-describing.",
  totalLength: 106,
  positions: [
    { range: "1-3",     label: "ISA",   desc: "Segment identifier (always 'ISA')" },
    { range: "4",       label: "Element Sep", desc: "Element separator character — position 3 (0-indexed) defines it", delimiter: true, key: "element" },
    { range: "5-6",     label: "ISA01", desc: "Authorization Information Qualifier" },
    { range: "7",       label: "*",     desc: "Element separator" },
    { range: "8-17",    label: "ISA02", desc: "Authorization Information (10 chars, space-padded)" },
    { range: "18",      label: "*",     desc: "Element separator" },
    { range: "19-20",   label: "ISA03", desc: "Security Information Qualifier" },
    { range: "21",      label: "*",     desc: "Element separator" },
    { range: "22-31",   label: "ISA04", desc: "Security Information (10 chars)" },
    { range: "32",      label: "*",     desc: "Element separator" },
    { range: "33-34",   label: "ISA05", desc: "Interchange ID Qualifier (Sender)" },
    { range: "35",      label: "*",     desc: "Element separator" },
    { range: "36-50",   label: "ISA06", desc: "Interchange Sender ID (15 chars)" },
    { range: "51",      label: "*",     desc: "Element separator" },
    { range: "52-53",   label: "ISA07", desc: "Interchange ID Qualifier (Receiver)" },
    { range: "54",      label: "*",     desc: "Element separator" },
    { range: "55-69",   label: "ISA08", desc: "Interchange Receiver ID (15 chars)" },
    { range: "70",      label: "*",     desc: "Element separator" },
    { range: "71-76",   label: "ISA09", desc: "Interchange Date (YYMMDD)" },
    { range: "77",      label: "*",     desc: "Element separator" },
    { range: "78-81",   label: "ISA10", desc: "Interchange Time (HHMM)" },
    { range: "82",      label: "*",     desc: "Element separator" },
    { range: "83",      label: "ISA11", desc: "Repetition Separator (^ in 5010, U in 4010)", delimiter: true, key: "repetition" },
    { range: "84",      label: "*",     desc: "Element separator" },
    { range: "85-89",   label: "ISA12", desc: "Interchange Control Version (00501)" },
    { range: "90",      label: "*",     desc: "Element separator" },
    { range: "91-99",   label: "ISA13", desc: "Interchange Control Number (9 digits)" },
    { range: "100",     label: "*",     desc: "Element separator" },
    { range: "101",     label: "ISA14", desc: "Acknowledgment Requested (0 or 1)" },
    { range: "102",     label: "*",     desc: "Element separator" },
    { range: "103",     label: "ISA15", desc: "Usage Indicator (P=Production, T=Test)" },
    { range: "104",     label: "*",     desc: "Element separator" },
    { range: "105",     label: "ISA16", desc: "Component Element Separator (typically :)", delimiter: true, key: "subElement" },
    { range: "106",     label: "Seg Term", desc: "Segment Terminator (typically ~)", delimiter: true, key: "segment" }
  ]
};

/**
 * Auto-detect delimiters from raw X12 content by reading the ISA header.
 * Falls back to defaults if ISA is not present or too short.
 */
export function detectDelimiters(raw) {
  const text = (raw || "").trimStart();
  const result = { ...DELIMITER_DEFAULTS, detected: false, errors: [] };

  if (!text.startsWith("ISA")) {
    result.errors.push("Content does not start with ISA segment. Using default delimiters.");
    return result;
  }
  if (text.length < 106) {
    result.errors.push(`ISA segment requires 106 characters but only ${text.length} found. Using default delimiters.`);
    return result;
  }

  result.element    = text[3];
  result.repetition = text[82];
  result.subElement = text[104];
  result.segment    = text[105];
  result.detected   = true;

  if (result.element === result.subElement)    result.errors.push("Warning: Element separator and sub-element separator are the same character.");
  if (result.element === result.segment)       result.errors.push("Warning: Element separator and segment terminator are the same character.");
  if (result.subElement === result.segment)    result.errors.push("Warning: Sub-element separator and segment terminator are the same character.");
  if (!/[*|^!+]/.test(result.element))         result.errors.push(`Unusual element separator: '${result.element}' (expected * | ^ ! +)`);

  return result;
}

export const SAMPLE_ISA_RAW = `ISA*00*          *00*          *ZZ*SENDER_ID      *ZZ*RECEIVER_ID    *240101*1200*^*00501*000000001*0*P*:~`;
