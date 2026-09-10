"""
Database manager and persistence helper for NIRIKSHAK AI.
Handles connection, initialization, seed data creation, transactional ledger updates,
and compliance log persistence.
"""

from datetime import date
from typing import Tuple

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from models import (
    Base, MemberOfParliament, MPType, FinancialYearLedger, WorkRecommendation,
    WorkStatus, BeneficiaryCategory, ComplianceCheckLog
)

DB_URL = "sqlite:///mplads_nirikshak.db"

engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Create all tables in the SQLite/Postgres database."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency / generator for acquiring database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_sample_data(db: Session) -> Tuple[MemberOfParliament, FinancialYearLedger]:
    """Seed sample MP and Ledger if none exists."""
    mp = db.query(MemberOfParliament).first()
    if not mp:
        mp = MemberOfParliament(
            id=1,
            name="Gorakhpur Representative MP",
            mp_type=MPType.LOK_SABHA,
            constituency_name="Gorakhpur",
            state="Uttar Pradesh",
            term_start_date=date(2024, 6, 1),
        )
        db.add(mp)
        db.commit()
        db.refresh(mp)

    ledger = db.query(FinancialYearLedger).filter(
        FinancialYearLedger.mp_id == mp.id,
        FinancialYearLedger.financial_year == "2025-26"
    ).first()

    if not ledger:
        ledger = FinancialYearLedger(
            id=1,
            mp_id=mp.id,
            financial_year="2025-26",
            base_entitlement=50_000_000,
            tenure_multiplier=1.0,
            prorated_entitlement=50_000_000,
            cumulative_sanctioned=10_000_000,
            cumulative_disbursed=5_000_000,
            sc_area_sanctioned=2_000_000,
            st_area_sanctioned=1_000_000,
            repair_renovation_sanctioned=1_500_000,
            out_of_constituency_sanctioned=0.0,
        )
        db.add(ledger)
        db.commit()
        db.refresh(ledger)

    # Seed ongoing, completed, and recommended works if database is fresh
    if db.query(WorkRecommendation).count() == 0:
        sample_works = [
            WorkRecommendation(
                id=1,
                mp_id=mp.id,
                fy_ledger_id=ledger.id,
                title="Community Drinking Water Pipeline",
                description="Installation of public drinking water pipeline in ward 4.",
                estimated_cost=1_500_000,
                beneficiary_category=BeneficiaryCategory.GENERAL,
                work_location_district="Gorakhpur",
                work_location_state="Uttar Pradesh",
                recommendation_date=date(2024, 10, 1),
                sanction_date=date(2024, 11, 5),
                completion_deadline=date(2025, 11, 5),
                status=WorkStatus.EXECUTING  # Ongoing
            ),
            WorkRecommendation(
                id=2,
                mp_id=mp.id,
                fy_ledger_id=ledger.id,
                title="Government Primary School Solar Roof",
                description="Installation of 10kW rooftop solar power system for primary school.",
                estimated_cost=850_000,
                beneficiary_category=BeneficiaryCategory.SC,
                work_location_district="Gorakhpur",
                work_location_state="Uttar Pradesh",
                recommendation_date=date(2024, 4, 1),
                sanction_date=date(2024, 4, 25),
                completion_deadline=date(2024, 12, 31),
                actual_completion_date=date(2024, 11, 20),
                status=WorkStatus.COMPLETED  # Completed
            ),
            WorkRecommendation(
                id=3,
                mp_id=mp.id,
                fy_ledger_id=ledger.id,
                title="Public Health Centre Ambulatory Ward",
                description="Construction of emergency patient ward at Community Health Centre.",
                estimated_cost=3_200_000,
                beneficiary_category=BeneficiaryCategory.ST,
                work_location_district="Gorakhpur",
                work_location_state="Uttar Pradesh",
                recommendation_date=date(2023, 1, 15),
                sanction_date=date(2023, 3, 1),
                completion_deadline=date(2024, 3, 1),
                actual_completion_date=date(2024, 6, 15),  # Completed delayed (SLA warning)
                status=WorkStatus.COMPLETED  # Completed (with SLA warning)
            ),
            WorkRecommendation(
                id=4,
                mp_id=mp.id,
                fy_ledger_id=ledger.id,
                title="Temple Road Repair & Swagat Dwar",
                description="Repair of road near temple and construction of swagat dwar.",
                estimated_cost=2_800_000,
                is_repair_or_renovation=True,
                beneficiary_category=BeneficiaryCategory.GENERAL,
                work_location_district="Gorakhpur",
                work_location_state="Uttar Pradesh",
                recommendation_date=date(2025, 1, 10),
                status=WorkStatus.RECOMMENDED  # Flagged/Needs Review
            )
        ]
        for w in sample_works:
            db.add(w)
        db.commit()

        # Run compliance engine on seeded works and log check results
        from rules_engine import ComplianceEngine
        engine = ComplianceEngine()
        context = {
            "mp_type": mp.mp_type.value,
            "mp_id": mp.id,
            "allowed_districts": ["Gorakhpur", "Deoria"],
            "is_calamity_declared": False,
            "society": None,
        }
        for w in sample_works:
            report = engine.evaluate(w, ledger, context)
            log_compliance_check(db, w.id, report.results)

    return mp, ledger


def log_compliance_check(db: Session, work_id: int, results: list):
    """Persist compliance check results to ComplianceCheckLog audit table."""
    for r in results:
        log_entry = ComplianceCheckLog(
            work_id=work_id,
            rule_id=r.rule_id,
            para_reference=r.para_reference,
            passed=r.passed,
            severity=r.severity.value,
            message=r.message,
            checked_at=date.today()
        )
        db.add(log_entry)
    db.commit()


def update_ledger_on_sanction(db: Session, ledger_id: int, work: WorkRecommendation):
    """
    Transactionally update the FinancialYearLedger running totals
    when a work is officially sanctioned.
    """
    ledger = db.query(FinancialYearLedger).filter(FinancialYearLedger.id == ledger_id).first()
    if not ledger:
        return

    ledger.cumulative_sanctioned += work.estimated_cost

    if work.is_repair_or_renovation:
        ledger.repair_renovation_sanctioned += work.estimated_cost

    if work.is_out_of_constituency:
        ledger.out_of_constituency_sanctioned += work.estimated_cost

    if work.beneficiary_category == BeneficiaryCategory.SC:
        ledger.sc_area_sanctioned += work.estimated_cost
    elif work.beneficiary_category == BeneficiaryCategory.ST:
        ledger.st_area_sanctioned += work.estimated_cost

    db.commit()
    db.refresh(ledger)

