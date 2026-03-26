from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Sequence

from .models import ClaimContext, RuleResult, RuleSeverity


@dataclass(frozen=True)
class ValidationSummary:
    total: int
    blocking: int
    info: int
    warn: int
    error: int
    fatal: int


class ValidationRule:
    code: str
    description: str

    def evaluate(self, context: ClaimContext) -> RuleResult | None:
        raise NotImplementedError


class ValidationEngine:
    def __init__(self, rules: Sequence[ValidationRule]):
        self._rules = list(rules)

    @property
    def rules(self) -> Sequence[ValidationRule]:
        return self._rules

    def run(self, context: ClaimContext) -> List[RuleResult]:
        results: List[RuleResult] = []
        for rule in self._rules:
            result = rule.evaluate(context)
            if result is not None:
                results.append(result)
        return results

    @staticmethod
    def summarize(results: Iterable[RuleResult]) -> ValidationSummary:
        info = warn = error = fatal = blocking = total = 0
        for result in results:
            total += 1
            if result.is_blocking:
                blocking += 1
            if result.severity == RuleSeverity.INFO:
                info += 1
            elif result.severity == RuleSeverity.WARN:
                warn += 1
            elif result.severity == RuleSeverity.ERROR:
                error += 1
            elif result.severity == RuleSeverity.FATAL:
                fatal += 1
        return ValidationSummary(
            total=total,
            blocking=blocking,
            info=info,
            warn=warn,
            error=error,
            fatal=fatal,
        )

