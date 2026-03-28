from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import Enum


class CodeSetType(str, Enum):
    ICD10CM = "ICD10CM"
    ICD10PCS = "ICD10PCS"
    CPT = "CPT"
    HCPCS = "HCPCS"
    NDC = "NDC"
    UB04 = "UB04"
    CLAIM_ADJUSTMENT_REASON_CODE = "CLAIM_ADJUSTMENT_REASON_CODE"
    REMITTANCE_ADVICE_REMARK_CODE = "REMITTANCE_ADVICE_REMARK_CODE"
    CLAIM_STATUS_CODE = "CLAIM_STATUS_CODE"
    PROVIDER_TAXONOMY = "PROVIDER_TAXONOMY"


@dataclass(frozen=True)
class CodesetWindow:
    fiscal_year: int
    period_label: str
    release_phase: str
    effective_start: date
    effective_end: date


@dataclass(frozen=True)
class CmsZipRef:
    year: int
    code_system: CodeSetType
    period_label: str
    release_phase: str
    url: str


@dataclass(frozen=True)
class ParsedCodeEntry:
    code: str
    description: str | None


# Backward-compatible aliases.
FiscalYearPeriod = CodesetWindow
CmsZipTarget = CmsZipRef

