from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import Enum


class ValidationSeverity(str, Enum):
    WARN = "WARN"
    ERROR = "ERROR"


@dataclass(frozen=True)
class CodeValidationInput:
    code_system: str
    code: str
    field_path: str


@dataclass(frozen=True)
class CodesetRelease:
    codeset_name: str
    release_year: int
    release_phase: str
    effective_start: date
    effective_end: date
    codes: set[str]

    @property
    def version_label(self) -> str:
        return f"FY{self.release_year}_{self.release_phase}"


@dataclass(frozen=True)
class CodeValidationResult:
    code_system: str
    code: str
    field_path: str
    severity: ValidationSeverity
    reason: str
    codeset_version_label: str


class InMemoryCodesetRepository:
    def __init__(self) -> None:
        self._releases: dict[str, list[CodesetRelease]] = {}

    def add_release(self, release: CodesetRelease) -> None:
        self._releases.setdefault(release.codeset_name, []).append(release)
        self._releases[release.codeset_name].sort(
            key=lambda r: (r.release_year, 2 if r.release_phase == "APRIL_UPDATE" else 1),
            reverse=True,
        )

    def resolve_release(self, codeset_name: str, service_date: date) -> CodesetRelease | None:
        for release in self._releases.get(codeset_name, []):
            if release.effective_start <= service_date <= release.effective_end:
                return release
        return None


def validate_code(*, repo: InMemoryCodesetRepository, check: CodeValidationInput, service_date: date) -> CodeValidationResult | None:
    release = repo.resolve_release(check.code_system, service_date)
    version_label = "NONE"
    reason = "NO_ACTIVE_RELEASE"
    severity = ValidationSeverity.ERROR
    if release is not None:
        version_label = release.version_label
        if check.code.strip().upper() in release.codes:
            return None
        reason = "CODE_NOT_FOUND"
    return CodeValidationResult(
        code_system=check.code_system,
        code=check.code.strip().upper(),
        field_path=check.field_path,
        severity=severity,
        reason=reason,
        codeset_version_label=version_label,
    )


def validate_codes(*, repo: InMemoryCodesetRepository, checks: list[CodeValidationInput], service_date: date) -> list[CodeValidationResult]:
    findings: list[CodeValidationResult] = []
    for check in checks:
        result = validate_code(repo=repo, check=check, service_date=service_date)
        if result is not None:
            findings.append(result)
    return findings

