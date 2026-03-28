from __future__ import annotations

from typing import List

from ..models import ClaimContext, ValidationFinding, ValidationSeverity
from .common import as_set, map_by_line_number

RISK_ELIGIBLE_CPT_CODES = {
    "99212",
    "99213",
    "99214",
    "99215",
}


def evaluate(context: ClaimContext) -> List[ValidationFinding]:
    lines_by_number = map_by_line_number(context.claim_lines)
    procedure_codes = as_set(line.procedure_code for line in context.claim_lines)

    if procedure_codes.intersection(RISK_ELIGIBLE_CPT_CODES):
        return []

    field_path = "claim_lines"
    if lines_by_number:
        field_path = f"claim_lines[{next(iter(lines_by_number.keys()))}].procedure_code"

    return [
        ValidationFinding(
            rule_code="RA-ELIG-001",
            severity=ValidationSeverity.ERROR,
            message="No risk-eligible professional E/M CPT found on claim lines.",
            field_path=field_path,
            is_blocking=True,
        )
    ]

