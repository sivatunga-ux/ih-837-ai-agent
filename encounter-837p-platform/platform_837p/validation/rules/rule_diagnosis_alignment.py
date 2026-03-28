from __future__ import annotations

from typing import List

from ..models import ClaimContext, ValidationFinding

RULE_CODE = "RA-DX-010"


def run(context: ClaimContext) -> List[ValidationFinding]:
    findings: List[ValidationFinding] = []
    encounter_dx = {dx.upper() for dx in context.encounter_diagnosis_codes}

    if "N186" in encounter_dx and "Z992" not in encounter_dx:
        findings.append(
            ValidationFinding(
                rule_code=RULE_CODE,
                severity="WARN",
                message="ESRD identified without dialysis dependence status (Z99.2).",
                field_path="HI",
                is_blocking=False,
            )
        )

    return findings

