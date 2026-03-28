export function summarizeFindingsForCoder(validationResult) {
  const findings = validationResult?.findings ?? [];
  if (!findings.length) {
    return {
      recommendation: "No action recommended.",
      severity: "NONE",
      rationale: "No deterministic findings were detected."
    };
  }

  const hasFatal = findings.some((f) => f.level === "FATAL");
  const hasRABlock = findings.some((f) => f.level === "RA_BLOCK");

  if (hasFatal) {
    return {
      recommendation: "Review critical coding and claim envelope errors before submission.",
      severity: "HIGH",
      rationale: "Fatal deterministic findings block clean submission."
    };
  }

  if (hasRABlock) {
    return {
      recommendation: "Add or fix risk-supporting diagnosis and eligibility signals.",
      severity: "MEDIUM",
      rationale: "Risk adjustment attribution may fail without these corrections."
    };
  }

  return {
    recommendation: "Address advisory warnings as part of coding QA.",
    severity: "LOW",
    rationale: "Warnings do not block processing but may reduce data quality."
  };
}
