from __future__ import annotations

from dataclasses import dataclass

PURPOSE_CLAIM_837P_DIAGNOSIS = "CLAIM_837P_DIAGNOSIS"
PURPOSE_CLAIM_837P_PROCEDURE = "CLAIM_837P_PROCEDURE"
PURPOSE_CLAIM_837P_BILLING = "CLAIM_837P_BILLING"
PURPOSE_CLAIM_STATUS = "CLAIM_STATUS"
PURPOSE_REMITTANCE = "REMITTANCE"
PURPOSE_PROVIDER = "PROVIDER"
PURPOSE_PHARMACY = "PHARMACY"


@dataclass(frozen=True)
class CodesetDef:
    code_system: str
    display_name: str
    authority: str
    purpose: str
    description: str
    active_for_validation: bool = True

    # Compatibility aliases for older call sites.
    @property
    def name(self) -> str:
        return self.code_system

    @property
    def codeset_name(self) -> str:
        return self.code_system


class CodesetCatalog(list):
    def by_purpose(self, purpose: str) -> list[CodesetDef]:
        return [item for item in self if item.purpose == purpose]


CATALOG = CodesetCatalog(
    [
        CodesetDef(
            code_system="ICD10CM",
            display_name="ICD-10-CM",
            authority="CMS/NCHS",
            purpose=PURPOSE_CLAIM_837P_DIAGNOSIS,
            description="Diagnosis codes for professional/institutional claim diagnosis validation.",
        ),
        CodesetDef(
            code_system="ICD10PCS",
            display_name="ICD-10-PCS",
            authority="CMS",
            purpose=PURPOSE_CLAIM_837P_PROCEDURE,
            description="Institutional procedure codes; retained for cross-claim procedure validation support.",
        ),
        CodesetDef(
            code_system="CPT",
            display_name="CPT",
            authority="AMA",
            purpose=PURPOSE_CLAIM_837P_PROCEDURE,
            description="Primary procedure code system for 837P service lines.",
        ),
        CodesetDef(
            code_system="HCPCS",
            display_name="HCPCS Level II",
            authority="CMS",
            purpose=PURPOSE_CLAIM_837P_PROCEDURE,
            description="Procedure/supply codes used with professional claim lines.",
        ),
        CodesetDef(
            code_system="POS",
            display_name="Place of Service",
            authority="CMS",
            purpose=PURPOSE_CLAIM_837P_BILLING,
            description="Place of service codes used on claim-level and line-level billing context.",
        ),
        CodesetDef(
            code_system="NDC",
            display_name="National Drug Code",
            authority="FDA",
            purpose=PURPOSE_PHARMACY,
            description="Drug code validation for pharmacy and medication-related claim content.",
        ),
        CodesetDef(
            code_system="CLAIM_STATUS_CODE",
            display_name="Claim Status Code",
            authority="X12",
            purpose=PURPOSE_CLAIM_STATUS,
            description="Claim status and adjudication lifecycle status code validation.",
        ),
        CodesetDef(
            code_system="CLAIM_ADJUSTMENT_REASON_CODE",
            display_name="Claim Adjustment Reason Code",
            authority="X12",
            purpose=PURPOSE_REMITTANCE,
            description="CARC validation for remittance and adjustment logic.",
        ),
        CodesetDef(
            code_system="REMITTANCE_ADVICE_REMARK_CODE",
            display_name="Remittance Advice Remark Code",
            authority="X12",
            purpose=PURPOSE_REMITTANCE,
            description="RARC validation for remittance remark details.",
        ),
        CodesetDef(
            code_system="PROVIDER_TAXONOMY",
            display_name="Provider Taxonomy",
            authority="NUCC",
            purpose=PURPOSE_PROVIDER,
            description="Provider taxonomy validation for rendering/billing provider attributes.",
        ),
    ]
)


def all_codesets() -> list[CodesetDef]:
    return list(CATALOG)


def codeset_purpose(code_system: str) -> str:
    normalized = code_system.upper().strip()
    for item in CATALOG:
        if item.code_system == normalized:
            return item.description
    return "Unknown codeset purpose."


def load_default_codeset_catalog() -> list[CodesetDef]:
    return all_codesets()

