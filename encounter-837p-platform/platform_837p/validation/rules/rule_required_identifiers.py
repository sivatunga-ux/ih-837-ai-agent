from __future__ import annotations

from typing import List

from ..models import (
    ClaimValidationContext,
    RuleOutcome,
    Severity,
    ValidationFinding,
)


def run(context: ClaimValidationContext) -> RuleOutcome:
    findings: List[ValidationFinding] = []

    if not context.claim_control_number:
        findings.append(
            ValidationFinding(
                rule_code="REQ-ID-001",
                severity=Severity.ERROR,
                message="Claim control number is required.",
                field_path="claim.claim_control_number",
                is_blocking=True,
            )
        )

    if not context.member_payer_id:
        findings.append(
            ValidationFinding(
                rule_code="REQ-ID-002",
                severity=Severity.ERROR,
                message="Member payer identifier is required.",
                field_path="member.payer_member_id",
                is_blocking=True,
            )
        )

    return RuleOutcome(rule_name="required_identifiers", findings=findings)

