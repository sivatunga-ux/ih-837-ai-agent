from __future__ import annotations

from datetime import date

from platform_837p.codesets.catalog import (
    CATALOG,
    PURPOSE_CLAIM_837P_DIAGNOSIS,
    PURPOSE_CLAIM_837P_PROCEDURE,
)
from platform_837p.codesets.validator import CodeValidationInput, validate_code

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


def _purpose_driven_codeset_checks(claim: dict) -> list[RuleResult]:
    """
    Optional purpose-driven codeset validation.
    Enabled only when a codeset repository is supplied in claim["_codeset_repo"].
    This preserves existing tests and behavior for current call sites.
    """
    repo = claim.get("_codeset_repo")
    service_date_raw = claim.get("service_date")
    if repo is None or not service_date_raw:
        return []

    if isinstance(service_date_raw, date):
        service_date = service_date_raw
    else:
        service_date = date.fromisoformat(str(service_date_raw))

    findings: list[RuleResult] = []
    diag_systems = [item.code_system for item in CATALOG.by_purpose(PURPOSE_CLAIM_837P_DIAGNOSIS) if item.active_for_validation]
    proc_systems = [item.code_system for item in CATALOG.by_purpose(PURPOSE_CLAIM_837P_PROCEDURE) if item.active_for_validation]

    for idx, dx in enumerate(claim.get("diagnoses", [])):
        failed_result = None
        for code_system in diag_systems:
            result = validate_code(
                repo=repo,
                check=CodeValidationInput(
                    code_system=code_system,
                    code=str(dx),
                    field_path=f"claim.diagnoses[{idx}]",
                    purpose=PURPOSE_CLAIM_837P_DIAGNOSIS,
                ),
                service_date=service_date,
            )
            if result is None:
                failed_result = None
                break
            failed_result = result
        if failed_result is not None:
            findings.append(
                RuleResult(
                    rule_code="CODESET-DIAG-001",
                    severity=RuleSeverity.ERROR,
                    message=(
                        f"Diagnosis code {failed_result.code} failed codeset validation "
                        f"({failed_result.reason}) against {failed_result.codeset_version_label}"
                    ),
                    field_path=failed_result.field_path,
                    is_blocking=True,
                )
            )

    for idx, line in enumerate(claim.get("lines", [])):
        code = (line or {}).get("procedure_code")
        if not code:
            continue
        failed_result = None
        for code_system in proc_systems:
            result = validate_code(
                repo=repo,
                check=CodeValidationInput(
                    code_system=code_system,
                    code=str(code),
                    field_path=f"claim.lines[{idx}].procedure_code",
                    purpose=PURPOSE_CLAIM_837P_PROCEDURE,
                ),
                service_date=service_date,
            )
            if result is None:
                failed_result = None
                break
            failed_result = result
        if failed_result is not None:
            findings.append(
                RuleResult(
                    rule_code="CODESET-PROC-001",
                    severity=RuleSeverity.ERROR,
                    message=(
                        f"Procedure code {failed_result.code} failed codeset validation "
                        f"({failed_result.reason}) against {failed_result.codeset_version_label}"
                    ),
                    field_path=failed_result.field_path,
                    is_blocking=True,
                )
            )
    return findings


def default_ruleset(*, codeset_repo=None):
    """
    Return default rule functions.
    If `codeset_repo` is provided, purpose-driven external codeset checks are enabled.
    """
    def _codeset_rule(claim: dict) -> list[RuleResult]:
        claim_with_repo = dict(claim)
        if codeset_repo is not None:
            claim_with_repo["_codeset_repo"] = codeset_repo
        return _purpose_driven_codeset_checks(claim_with_repo)

    return [_required_identifiers, _risk_eligibility, _diagnosis_alignment, _codeset_rule]

