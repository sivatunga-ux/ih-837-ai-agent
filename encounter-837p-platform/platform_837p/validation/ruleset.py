from __future__ import annotations

from .rules.rule_diagnosis_alignment import DiagnosisPointerRule
from .rules.rule_ra_eligibility import RiskEligibleProcedureRule
from .rules.rule_required_identifiers import RequiredIdentifiersRule


def default_rules():
    return [
        RequiredIdentifiersRule(),
        RiskEligibleProcedureRule(),
        DiagnosisPointerRule(),
    ]

