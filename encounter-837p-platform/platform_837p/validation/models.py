from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Mapping


class Severity(str, Enum):
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"
    FATAL = "FATAL"


@dataclass(frozen=True)
class ValidationFinding:
    rule_code: str
    severity: Severity
    message: str
    field_path: str | None = None
    is_blocking: bool = False


@dataclass(frozen=True)
class ClaimValidationContext:
    claim: Mapping[str, Any]
    lines: list[Mapping[str, Any]]
    diagnoses: list[Mapping[str, Any]]

