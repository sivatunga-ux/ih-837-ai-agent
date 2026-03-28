export const SAMPLE_ENCOUNTERS = [
  {
    name: "ihas-x12-005010x222-commercial-health-insurance.edi",
    label: "IHAS X12 Example 01 (Commercial Health Insurance)",
    source: "https://x12.org/examples/005010x222/example-01-commercial-health-insurance",
    text: [
      "ST*837*0021*005010X222",
      "BHT*0019*00*244579*20061015*1023*CH",
      "NM1*41*2*PREMIER BILLING SERVICE*****46*TGJ23",
      "PER*IC*JERRY*TE*3055552222*EX*231",
      "NM1*40*2*KEY INSURANCE COMPANY*****46*66783JJT",
      "HL*1**20*1",
      "PRV*BI*PXC*203BF0100Y",
      "NM1*85*2*BEN KILDARE SERVICE*****XX*9876543210",
      "N3*234 SEAWAY ST",
      "N4*MIAMI*FL*33111",
      "REF*EI*587654321",
      "NM1*87*2",
      "N3*2345 OCEAN BLVD",
      "N4*MIAMI*FL*33111",
      "HL*2*1*22*1",
      "SBR*P**2222-SJ******CI",
      "NM1*IL*1*SMITH*JANE****MI*JS00111223333",
      "DMG*D8*19430501*F",
      "NM1*PR*2*KEY INSURANCE COMPANY*****PI*999996666",
      "REF*G2*KA6663",
      "HL*3*2*23*0",
      "PAT*19",
      "NM1*QC*1*SMITH*TED",
      "N3*236 N MAIN ST",
      "N4*MIAMI*FL*33413",
      "DMG*D8*19730501*M",
      "CLM*26463774*100***11:B:1*Y*A*Y*I",
      "REF*D9*17312345600006351",
      "HI*BK:0340*BF:V7389",
      "LX*1",
      "SV1*HC:99213*40*UN*1***1",
      "DTP*472*D8*20061003",
      "LX*2",
      "SV1*HC:87070*15*UN*1***1",
      "DTP*472*D8*20061003",
      "LX*3",
      "SV1*HC:99214*35*UN*1***2",
      "DTP*472*D8*20061010",
      "LX*4",
      "SV1*HC:86663*10*UN*1***2",
      "DTP*472*D8*20061010",
      "SE*42*0021"
    ].join("~\n") + "~"
  },
  {
    name: "clean-encounter-001.txt",
    label: "Simple clean encounter",
    text: [
      "CLM*12345",
      "NM1*IL*1*DOE*JANE",
      "DX*E11.9",
      "CPT*99213",
      "SE*4*0001"
    ].join("\n")
  },
  {
    name: "needs-fix-encounter-002.txt",
    label: "Simple needs-fix encounter",
    text: [
      "CLM*67890",
      "NM1*IL*1*SMITH*JOHN",
      "DX*",
      "CPT*",
      "SE*4*0002"
    ].join("\n")
  }
];
