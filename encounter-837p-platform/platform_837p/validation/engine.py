from __future__ import annotations

from .models import ValidationFinding, ValidationReport


class ValidationEngine:
    def __init__(self, rules):
        self._rules = list(rules)

    def validate(self, claim: dict) -> ValidationReport:
        findings: list[ValidationFinding] = []
        for rule in self._rules:
            findings.extend(rule(claim))

        if any(item.is_blocking for item in findings):
            if any(item.rule_code == "RA-ELIG-001" for item in findings):
                status = "RA_BLOCKED"
            else:
                status = "FAIL"
        else:
            status = "PASS"

        return ValidationReport(status=status, findings=findings)

