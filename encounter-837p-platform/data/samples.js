export const SAMPLE_ENCOUNTERS = [
  {
    name: "clean-encounter-001.txt",
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
    text: [
      "CLM*67890",
      "NM1*IL*1*SMITH*JOHN",
      "DX*",
      "CPT*",
      "SE*4*0002"
    ].join("\n")
  }
];
