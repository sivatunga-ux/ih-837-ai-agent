"""External codeset ingestion and validation support."""

from .catalog import (
    CATALOG,
    PURPOSE_CLAIM_837P_DIAGNOSIS,
    PURPOSE_CLAIM_837P_PROCEDURE,
    PURPOSE_CLAIM_STATUS,
    all_codesets,
    codeset_purpose,
)
from .validator import (
    CodeValidationInput,
    CodeValidationResult,
    CodesetRelease,
    InMemoryCodesetRepository,
    ValidationSeverity,
    validate_codes,
)


