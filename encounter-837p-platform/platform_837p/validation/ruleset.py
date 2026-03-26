from __future__ import annotations

from .models import RuleResult, RuleSeverity


def _required_identifiers(claim: dict) -> list[RuleResult]:
    findings: list[RuleResult] = []
    if not claim.get("member_id"):
        findings.append(
            RuleResult(
                rule_code="REQ-IDENT-001",
                severity=RuleSeverity.ERROR,
                message="Member ID is required.",
                field_path="claim.member_id",
                is_blocking=True,
            )
        )
    if not claim.get("servicing_provider_npi"):
        findings.append(
            RuleResult(
                rule_code="REQ-IDENT-002",
                severity=RuleSeverity.ERROR,
                message="Servicing provider NPI is required.",
                field_path="claim.servicing_provider_npi",
                is_blocking=True,
            )
        )
    return findings


def _risk_eligibility(claim: dict) -> list[RuleResult]:
    allowed = {"99212", "99213", "99214", "99215"}
    lines = claim.get("lines", [])
    has_risk_eligible = any((line or {}).get("procedure_code") in allowed for line in lines)
    if has_risk_eligible:
        return []
    return [
        RuleResult(
            rule_code="RA-ELIG-001",
            severity=RuleSeverity.ERROR,
            message="No risk-eligible CPT found in service lines.",
            field_path="claim.lines[].procedure_code",
            is_blocking=True,
        )
    ]


def _diagnosis_alignment(claim: dict) -> list[RuleResult]:
    diagnoses = {str(code).upper() for code in claim.get("diagnoses", [])}
    if "N186" in diagnoses and "Z992" not in diagnoses:
        return [
            RuleResult(
                rule_code="DX-ALIGN-001",
                severity=RuleSeverity.WARN,
                message="ESRD diagnosis present without dialysis status code Z992.",
                field_path="claim.diagnoses",
                is_blocking=False,
            )
        ]
    return []


def default_ruleset():
    return [_required_identifiers, _risk_eligibility, _diagnosis_alignment]

