from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class RuleSeverity(str, Enum):
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"
    FATAL = "FATAL"


@dataclass(frozen=True)
class RuleResult:
    rule_code: str
    severity: RuleSeverity
    message: str
    field_path: str | None = None
    is_blocking: bool = False


@dataclass(frozen=True)
class ValidationReport:
    status: str
    findings: list[RuleResult]


# Backward compatible aliases.
Severity = RuleSeverity
ValidationFinding = RuleResult

