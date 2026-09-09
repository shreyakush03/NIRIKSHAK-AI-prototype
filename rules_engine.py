"""
MPLADS Compliance Rules Engine
--------------------------------
Design pattern: each statutory rule is an independent class implementing
`check(work, ledger, context) -> RuleResult`. The engine runs every
applicable rule and returns an aggregated report. This is deliberately
NOT one giant if/else function — you want to be able to:
  1. add/modify a single rule when a guideline is amended, without
     touching the others
  2. unit-test each rule in isolation
  3. know exactly which Para number caused a rejection

Severity levels:
  BLOCK  -> sanction cannot proceed until fixed (unambiguous statutory breach)
  WARN   -> proceeds, but flagged in ledger/reporting (e.g. approaching an SLA)
  REVIEW -> ambiguous, needs a human decision (e.g. negative-list semantic match)
"""

from dataclasses import dataclass
from datetime import date
from enum import Enum
from typing import List

from models import (
    WorkRecommendation, FinancialYearLedger, Society, BeneficiaryCategory
)


class Severity(Enum):
    BLOCK = "BLOCK"
    WARN = "WARN"
    REVIEW = "REVIEW"


@dataclass
class RuleResult:
    rule_id: str
    para_reference: str
    passed: bool
    severity: Severity
    message: str


class Rule:
    """Base class every statutory rule implements."""
    rule_id: str = "BASE"
    para_reference: str = ""
    severity: Severity = Severity.BLOCK

    def check(self, work: WorkRecommendation, ledger: FinancialYearLedger,
              context: dict) -> RuleResult:
        raise NotImplementedError


# ---------------------------------------------------------------------
# 1. FINANCIAL / NUMERIC RULES
# ---------------------------------------------------------------------

class EntitlementCeilingRule(Rule):
    rule_id = "FIN_ENTITLEMENT_CEILING"
    para_reference = "Para 3.2.5"
    severity = Severity.BLOCK

    def check(self, work, ledger, context):
        projected_total = ledger.cumulative_sanctioned + work.estimated_cost
        passed = projected_total <= ledger.total_available
        msg = (
            f"Projected sanctioned total Rs.{projected_total:,.0f} "
            f"{'within' if passed else 'EXCEEDS'} available entitlement "
            f"Rs.{ledger.total_available:,.0f}."
        )
        return RuleResult(self.rule_id, self.para_reference, passed, self.severity, msg)


class MinimumWorkAmountRule(Rule):
    rule_id = "FIN_MIN_WORK_AMOUNT"
    para_reference = "Para 3.2.9"
    severity = Severity.REVIEW  # allowed with written justification, so not a hard block

    MIN_AMOUNT = 250_000  # Rs.2.5 Lakh

    def check(self, work, ledger, context):
        if work.estimated_cost >= self.MIN_AMOUNT:
            return RuleResult(self.rule_id, self.para_reference, True, self.severity,
                               "Work cost meets minimum threshold.")
        has_justification = bool(context.get("written_justification"))
        passed = has_justification
        msg = (
            f"Work cost Rs.{work.estimated_cost:,.0f} is below Rs.2.5 Lakh minimum. "
            + ("Written justification present." if has_justification
               else "NO written justification recorded — required before sanction.")
        )
        return RuleResult(self.rule_id, self.para_reference, passed, self.severity, msg)


class RepairRenovationCeilingRule(Rule):
    rule_id = "FIN_REPAIR_CEILING"
    para_reference = "Para 5.1.9"
    severity = Severity.BLOCK
    CEILING = 5_000_000  # Rs.50 Lakh

    def check(self, work, ledger, context):
        if not work.is_repair_or_renovation:
            return RuleResult(self.rule_id, self.para_reference, True, self.severity,
                               "Not a repair/renovation work — rule not applicable.")
        projected = ledger.repair_renovation_sanctioned + work.estimated_cost
        passed = projected <= self.CEILING
        msg = f"Repair/renovation total Rs.{projected:,.0f} vs Rs.50 Lakh annual ceiling."
        return RuleResult(self.rule_id, self.para_reference, passed, self.severity, msg)


class OutOfConstituencyCeilingRule(Rule):
    rule_id = "FIN_OUT_OF_CONSTITUENCY"
    para_reference = "Para 3.1.2.1"
    severity = Severity.BLOCK
    CEILING = 2_500_000  # Rs.25 Lakh, LS MPs only

    def check(self, work, ledger, context):
        if not work.is_out_of_constituency:
            return RuleResult(self.rule_id, self.para_reference, True, self.severity,
                               "Work is within constituency — rule not applicable.")
        if context.get("is_calamity_declared"):
            return RuleResult(self.rule_id, self.para_reference, True, self.severity,
                               "Exempted: declared natural calamity in effect.")
        projected = ledger.out_of_constituency_sanctioned + work.estimated_cost
        passed = projected <= self.CEILING
        msg = f"Out-of-constituency total Rs.{projected:,.0f} vs Rs.25 Lakh annual cap."
        return RuleResult(self.rule_id, self.para_reference, passed, self.severity, msg)


class SCSTQuotaRule(Rule):
    """
    This one is inherently a WARN, not a per-work BLOCK — the 15%/7.5%
    quota is measured against the MP's ANNUAL entitlement, so a single
    early-year work can't "fail" it. Track it and warn as the FY
    progresses if the running percentage is falling behind schedule.
    """
    rule_id = "FIN_SC_ST_QUOTA_TRACKING"
    para_reference = "Para 5.4.1"
    severity = Severity.WARN

    def check(self, work, ledger, context):
        total = ledger.total_available or 1
        sc_pct = (ledger.sc_area_sanctioned or 0.0) / total * 100
        st_pct = (ledger.st_area_sanctioned or 0.0) / total * 100
        msg = (f"Running SC allocation: {sc_pct:.1f}% (target >= 15%). "
               f"Running ST allocation: {st_pct:.1f}% (target >= 7.5%).")
        # Only meaningfully evaluated late in the FY; always "passes" as a
        # per-work check but the message is surfaced for dashboard tracking.
        return RuleResult(self.rule_id, self.para_reference, True, self.severity, msg)


# ---------------------------------------------------------------------
# 2. GEOSPATIAL / JURISDICTION RULES
# ---------------------------------------------------------------------

class JurisdictionRule(Rule):
    rule_id = "GEO_JURISDICTION"
    para_reference = "Para 3.1.1"
    severity = Severity.BLOCK

    def check(self, work, ledger, context):
        mp_type = context.get("mp_type")
        allowed_districts = context.get("allowed_districts", [])

        if mp_type == "rajya_sabha_nominated":
            return RuleResult(self.rule_id, self.para_reference, True, self.severity,
                               "Nominated RS MP has nationwide jurisdiction.")

        if work.is_out_of_constituency:
            # governed separately by OutOfConstituencyCeilingRule
            return RuleResult(self.rule_id, self.para_reference, True, self.severity,
                               "Flagged as out-of-constituency; ceiling rule applies separately.")

        passed = work.work_location_district in allowed_districts
        msg = (f"Work location '{work.work_location_district}' "
               f"{'is' if passed else 'is NOT'} within MP's jurisdiction.")
        return RuleResult(self.rule_id, self.para_reference, passed, self.severity, msg)


# ---------------------------------------------------------------------
# 3. NEGATIVE LIST / SEMANTIC RULES
# ---------------------------------------------------------------------

class NegativeListRule(Rule):
    """
    Two-tier filter: fast keyword pass first. Anything with zero keyword
    hits is auto-passed. Anything WITH a hit goes to REVIEW, never
    auto-BLOCK — false positives on keywords are common ("war memorial"
    contains no bad keyword but "temple road repair" might).
    In production, replace/augment `_keyword_hits` with an LLM
    classifier call for the REVIEW-worthy cases.
    """
    rule_id = "NEG_LIST_SEMANTIC"
    para_reference = "Para 5.2"
    severity = Severity.REVIEW

    KEYWORDS = [
        "temple", "mosque", "church", "gurudwara", "religious",
        "swagat dwar", "welcome gate",
        "residential quarters", "government housing",
        "reimbursement", "reimburse",
        "donation to fund", "relief fund",
        "named after", "memorial to",  # naming convention checks
        "commercial complex", "private business",
    ]

    def _keyword_hits(self, text: str) -> List[str]:
        text_lower = text.lower()
        return [kw for kw in self.KEYWORDS if kw in text_lower]

    def check(self, work, ledger, context):
        hits = self._keyword_hits(work.description) + self._keyword_hits(work.title)
        if not hits:
            return RuleResult(self.rule_id, self.para_reference, True, self.severity,
                               "No negative-list keyword matches.")
        msg = f"Potential negative-list match on: {', '.join(set(hits))}. Route to human review."
        return RuleResult(self.rule_id, self.para_reference, False, self.severity, msg)


# ---------------------------------------------------------------------
# 4. SOCIETY / TRUST RULES (Chapter 6)
# ---------------------------------------------------------------------

class SocietyEligibilityRule(Rule):
    rule_id = "SOC_ELIGIBILITY"
    para_reference = "Paras 6.2.1-6.2.6"
    severity = Severity.BLOCK
    ANNUAL_CAP_PER_MP = 5_000_000    # Rs.50 Lakh
    LIFETIME_CAP_PER_SOCIETY = 10_000_000  # Rs.1 Cr

    def check(self, work, ledger, context):
        society: Society = context.get("society")
        if society is None:
            return RuleResult(self.rule_id, self.para_reference, True, self.severity,
                               "Not a society-directed work — rule not applicable.")

        problems = []

        if not society.darpan_id:
            problems.append("missing NGO Darpan registration")

        years_active = context.get("years_active", 0)
        if years_active < 3:
            problems.append(f"only {years_active} years active (needs 3+)")

        mp_id_str = str(context.get("mp_id"))
        conflicted = (society.conflicted_mp_ids or "").split(",")
        if mp_id_str in conflicted:
            problems.append("recommending MP has a conflict of interest with this society")

        lifetime_projected = society.lifetime_sanctioned_total + work.estimated_cost
        if lifetime_projected > self.LIFETIME_CAP_PER_SOCIETY:
            problems.append(
                f"lifetime total Rs.{lifetime_projected:,.0f} exceeds Rs.1 Cr cap"
            )

        passed = len(problems) == 0
        msg = "OK" if passed else "; ".join(problems)
        return RuleResult(self.rule_id, self.para_reference, passed, self.severity, msg)


# ---------------------------------------------------------------------
# 5. SLA / TEMPORAL RULES
# ---------------------------------------------------------------------

class SanctionSLARule(Rule):
    rule_id = "SLA_SANCTION_45_DAYS"
    para_reference = "Para 3.2.4"
    severity = Severity.WARN

    def check(self, work, ledger, context):
        if work.sanction_date is None:
            days_pending = (date.today() - work.recommendation_date).days
            passed = days_pending <= 45
            msg = f"{days_pending} days since recommendation, still unsanctioned (limit 45)."
            return RuleResult(self.rule_id, self.para_reference, passed, self.severity, msg)
        days_taken = (work.sanction_date - work.recommendation_date).days
        passed = days_taken <= 45
        msg = f"Sanctioned in {days_taken} days (limit 45)."
        return RuleResult(self.rule_id, self.para_reference, passed, self.severity, msg)


class CompletionSLARule(Rule):
    rule_id = "SLA_COMPLETION_18_MONTHS"
    para_reference = "Para 8.12.1 / 10.6.1"
    severity = Severity.WARN

    def check(self, work, ledger, context):
        if work.sanction_date is None:
            return RuleResult(self.rule_id, self.para_reference, True, self.severity,
                               "Not yet sanctioned — SLA clock not started.")
        deadline = work.completion_deadline
        if deadline is None:
            return RuleResult(self.rule_id, self.para_reference, True, self.severity,
                               "No completion deadline set.")
        reference_date = work.actual_completion_date or date.today()
        passed = reference_date <= deadline
        msg = (f"{'Completed' if work.actual_completion_date else 'Currently'} "
               f"{'on' if passed else 'PAST'} the {deadline} deadline.")
        return RuleResult(self.rule_id, self.para_reference, passed, self.severity, msg)


# ---------------------------------------------------------------------
# 6. ADMINISTRATIVE & OTHER GUIDELINE RULES
# ---------------------------------------------------------------------

class AdminCostCapRule(Rule):
    rule_id = "FIN_ADMIN_COST_CAP"
    para_reference = "Para 4.1"
    severity = Severity.BLOCK
    ADMIN_PERCENTAGE_CAP = 2.0  # 2% max administrative expenditure

    def check(self, work, ledger, context):
        if not context.get("is_administrative_expense"):
            return RuleResult(self.rule_id, self.para_reference, True, self.severity,
                               "Not an administrative cost item — rule not applicable.")
        admin_sanctioned = context.get("admin_expenses_sanctioned", 0.0)
        projected = admin_sanctioned + work.estimated_cost
        max_allowed = ledger.total_available * (self.ADMIN_PERCENTAGE_CAP / 100.0)
        passed = projected <= max_allowed
        msg = f"Administrative cost Rs.{projected:,.0f} vs 2% entitlement limit Rs.{max_allowed:,.0f}."
        return RuleResult(self.rule_id, self.para_reference, passed, self.severity, msg)


# ---------------------------------------------------------------------
# ENGINE — orchestrates all rules and produces one report
# ---------------------------------------------------------------------

DEFAULT_RULES: List[Rule] = [
    EntitlementCeilingRule(),
    MinimumWorkAmountRule(),
    RepairRenovationCeilingRule(),
    OutOfConstituencyCeilingRule(),
    SCSTQuotaRule(),
    JurisdictionRule(),
    NegativeListRule(),
    SocietyEligibilityRule(),
    SanctionSLARule(),
    CompletionSLARule(),
    AdminCostCapRule(),
]


@dataclass
class ComplianceReport:
    work_id: int
    overall_status: str  # "APPROVED" / "BLOCKED" / "NEEDS_REVIEW"
    results: List[RuleResult]

    def summary(self) -> str:
        lines = [f"Compliance report for work #{self.work_id}: {self.overall_status}"]
        for r in self.results:
            flag = "[PASS]" if r.passed else ("" if r.severity == Severity.BLOCK else "[WARN]")
            if not r.passed and r.severity == Severity.BLOCK:
                flag = "[BLOCK]"
            elif not r.passed and r.severity == Severity.REVIEW:
                flag = "[REVIEW]"
            lines.append(f"  {flag} [{r.rule_id} | {r.para_reference}] {r.message}")
        return "\n".join(lines)


class ComplianceEngine:
    def __init__(self, rules: List[Rule] = None):
        self.rules = rules if rules is not None else DEFAULT_RULES

    def evaluate(self, work: WorkRecommendation, ledger: FinancialYearLedger,
                 context: dict) -> ComplianceReport:
        results = [rule.check(work, ledger, context) for rule in self.rules]

        has_block_failure = any(
            not r.passed and r.severity == Severity.BLOCK for r in results
        )
        has_review_failure = any(
            not r.passed and r.severity == Severity.REVIEW for r in results
        )

        if has_block_failure:
            overall = "BLOCKED"
        elif has_review_failure:
            overall = "NEEDS_REVIEW"
        else:
            overall = "APPROVED"

        return ComplianceReport(work_id=work.id or -1, overall_status=overall, results=results)
