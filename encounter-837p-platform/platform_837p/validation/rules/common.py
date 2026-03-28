from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ..models import Severity, ValidationIssue


@dataclass(frozen=True)
class RuleContext:
    claim: dict[str, Any]
    claim_lines: list[dict[str, Any]]
    diagnoses: list[dict[str, Any]]


def issue(
    *,
    rule_code: str,
    severity: Severity,
    message: str,
    field_path: str,
    is_blocking: bool,
) -> ValidationIssue:
    return ValidationIssue(
        rule_code=rule_code,
        severity=severity,
        message=message,
        field_path=field_path,
        is_blocking=is_blocking,
    )

