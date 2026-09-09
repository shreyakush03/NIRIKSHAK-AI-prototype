"""
Run this to see the compliance engine in action:
    python example_check.py

It builds an in-memory SQLite DB, inserts one MP + ledger + two sample
works (one clean, one that should trip several rules), and prints the
compliance report for each.
"""

from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import (
    Base, MemberOfParliament, MPType, FinancialYearLedger,
    WorkRecommendation, WorkStatus, BeneficiaryCategory
)
from rules_engine import ComplianceEngine

engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
session = Session()

# --- Set up one MP and their FY ledger ---
mp = MemberOfParliament(
    name="Sample MP",
    mp_type=MPType.LOK_SABHA,
    constituency_name="Sample Constituency",
    state="Uttar Pradesh",
    term_start_date=date(2024, 6, 1),
)
session.add(mp)
session.commit()

ledger = FinancialYearLedger(
    mp_id=mp.id,
    financial_year="2025-26",
    base_entitlement=50_000_000,
    tenure_multiplier=1.0,
    prorated_entitlement=50_000_000,
    cumulative_sanctioned=48_000_000,   # already close to the ceiling, on purpose
    repair_renovation_sanctioned=4_800_000,
)
session.add(ledger)
session.commit()

context = {
    "mp_type": "lok_sabha",
    "mp_id": mp.id,
    "allowed_districts": ["Gorakhpur", "Deoria"],
    "is_calamity_declared": False,
    "society": None,
    "written_justification": None,
}

engine_obj = ComplianceEngine()

# --- Work 1: a clean, compliant work ---
work_clean = WorkRecommendation(
    mp_id=mp.id,
    fy_ledger_id=ledger.id,
    title="Drinking water supply pipeline",
    description="Installation of a public drinking water pipeline in ward 4.",
    estimated_cost=1_000_000,
    beneficiary_category=BeneficiaryCategory.GENERAL,
    work_location_district="Gorakhpur",
    work_location_state="Uttar Pradesh",
    recommendation_date=date(2025, 4, 1),
    sanction_date=date(2025, 5, 10),
    status=WorkStatus.SANCTIONED,
)
session.add(work_clean)
session.commit()

report1 = engine_obj.evaluate(work_clean, ledger, context)
print(report1.summary())
print()

# --- Work 2: a problem work — pushes past entitlement AND hits negative list ---
work_bad = WorkRecommendation(
    mp_id=mp.id,
    fy_ledger_id=ledger.id,
    title="Temple road repair and welcome gate",
    description="Repair of the road leading to the temple and construction of a swagat dwar.",
    estimated_cost=3_500_000,  # pushes cumulative past ₹50 Cr entitlement
    is_repair_or_renovation=True,
    work_location_district="Gorakhpur",
    work_location_state="Uttar Pradesh",
    recommendation_date=date(2025, 4, 1),
    status=WorkStatus.RECOMMENDED,
)
session.add(work_bad)
session.commit()

report2 = engine_obj.evaluate(work_bad, ledger, context)
print(report2.summary())
