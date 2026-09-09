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

