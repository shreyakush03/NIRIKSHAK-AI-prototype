"""
MPLADS Compliance System — Data Model
--------------------------------------
This models the core entities from the MPLADS 2023 Guidelines as a
relational schema. Use this with SQLAlchemy + any DB (SQLite for
prototyping, Postgres for production).

Design principle: every table that a RULE checks against should carry
enough state to answer that rule WITHOUT re-computation across the whole
history every time (i.e. keep running totals on the ledger, don't
recompute sums from scratch on every request once volumes grow).
"""

from datetime import date
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, Integer, String, Float, Date, Boolean, ForeignKey, Enum, Text
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


# ---------------------------------------------------------------------
# ENUMS — mirror the classifications used throughout the guidelines
# ---------------------------------------------------------------------

class MPType(PyEnum):
    LOK_SABHA = "lok_sabha"
    RAJYA_SABHA_ELECTED = "rajya_sabha_elected"
    RAJYA_SABHA_NOMINATED = "rajya_sabha_nominated"


class WorkStatus(PyEnum):
    RECOMMENDED = "recommended"
    SANCTIONED = "sanctioned"
    REJECTED = "rejected"
    EXECUTING = "executing"
    COMPLETED = "completed"
    UC_FILED = "uc_filed"
    AUDITED = "audited"
    ABANDONED = "abandoned"


class BeneficiaryCategory(PyEnum):
    GENERAL = "general"
    SC = "sc"
    ST = "st"


# ---------------------------------------------------------------------
# CORE ENTITIES
# ---------------------------------------------------------------------

class MemberOfParliament(Base):
    __tablename__ = "mps"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    mp_type = Column(Enum(MPType), nullable=False)
    constituency_name = Column(String)          # for LS MPs
    state = Column(String)                      # for LS / elected RS MPs
    term_start_date = Column(Date, nullable=False)
    term_end_date = Column(Date, nullable=True)  # null if currently serving

    ledgers = relationship("FinancialYearLedger", back_populates="mp")
    works = relationship("WorkRecommendation", back_populates="mp")


class ConstituencyBoundary(Base):
    """
    Geospatial reference. In a real system this stores a polygon
    (PostGIS geometry column). For a prototype, store a district/state
    list that approximates the constituency — good enough to validate
    "is this work location inside the MP's jurisdiction".
    """
    __tablename__ = "constituency_boundaries"

    id = Column(Integer, primary_key=True)
    constituency_name = Column(String, nullable=False)
    state = Column(String, nullable=False)
    districts_covered = Column(Text)  # comma-separated for prototype


class FinancialYearLedger(Base):
    """
    One row per MP per Financial Year. This is the single source of
    truth every financial rule checks against — never recompute totals
    by summing WorkRecommendation rows on every request; update this
    ledger transactionally whenever a work is sanctioned.
    """
    __tablename__ = "fy_ledgers"

    id = Column(Integer, primary_key=True)
    mp_id = Column(Integer, ForeignKey("mps.id"), nullable=False)
    financial_year = Column(String, nullable=False)  # e.g. "2025-26"

    base_entitlement = Column(Float, default=50_000_000)   # ₹5 Cr
    tenure_multiplier = Column(Float, default=1.0)         # 0 / 0.5 / 1.0
    prorated_entitlement = Column(Float)                   # computed

    redistributed_balance = Column(Float, default=0.0)     # ex-MP inflow
    interest_accrued = Column(Float, default=0.0)

    cumulative_sanctioned = Column(Float, default=0.0)
    cumulative_disbursed = Column(Float, default=0.0)

    sc_area_sanctioned = Column(Float, default=0.0)
    st_area_sanctioned = Column(Float, default=0.0)

    repair_renovation_sanctioned = Column(Float, default=0.0)
    out_of_constituency_sanctioned = Column(Float, default=0.0)

    mp = relationship("MemberOfParliament", back_populates="ledgers")

    @property
    def total_available(self) -> float:
        return (
            (self.prorated_entitlement or 0.0)
            + (self.redistributed_balance or 0.0)
            + (self.interest_accrued or 0.0)
        )


class Society(Base):
    """Registered societies/trusts/cooperatives — Chapter 6 entities."""
    __tablename__ = "societies"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    darpan_id = Column(String, unique=True)
    registration_date = Column(Date)
    registration_act = Column(String)  # Societies Act / Trusts Act / Co-op Act
    active_since = Column(Date)        # to check 3-year continuous operation

    lifetime_sanctioned_total = Column(Float, default=0.0)  # ₹1 Cr cap tracker

    # Conflict-of-interest: list of MP IDs who are trustees/office bearers
    conflicted_mp_ids = Column(Text)  # comma-separated MP ids for prototype


class WorkRecommendation(Base):
    """
    A single recommended/sanctioned work — the unit every compliance
    check ultimately runs against.
    """
    __tablename__ = "work_recommendations"

    id = Column(Integer, primary_key=True)
    mp_id = Column(Integer, ForeignKey("mps.id"), nullable=False)
    fy_ledger_id = Column(Integer, ForeignKey("fy_ledgers.id"), nullable=False)
    society_id = Column(Integer, ForeignKey("societies.id"), nullable=True)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)  # feeds the negative-list filter
    estimated_cost = Column(Float, nullable=False)

    beneficiary_category = Column(Enum(BeneficiaryCategory), default=BeneficiaryCategory.GENERAL)
    is_repair_or_renovation = Column(Boolean, default=False)
    is_out_of_constituency = Column(Boolean, default=False)
    is_calamity_relief = Column(Boolean, default=False)

    work_location_district = Column(String)
    work_location_state = Column(String)

    recommendation_date = Column(Date, nullable=False)
    sanction_date = Column(Date, nullable=True)
    completion_deadline = Column(Date, nullable=True)
    actual_completion_date = Column(Date, nullable=True)

    status = Column(Enum(WorkStatus), default=WorkStatus.RECOMMENDED)

    mp = relationship("MemberOfParliament", back_populates="works")


class InspectionRecord(Base):
    """Tracks IA / District / SNA inspection quota compliance."""
    __tablename__ = "inspection_records"

    id = Column(Integer, primary_key=True)
    work_id = Column(Integer, ForeignKey("work_recommendations.id"), nullable=False)
    inspecting_authority = Column(String)  # "IA" / "DISTRICT" / "SNA"
    inspection_date = Column(Date)
    passed = Column(Boolean)
    notes = Column(Text)


class ComplianceCheckLog(Base):
    """
    Audit trail: every automated check run against a work, with the
    rule id, outcome, and message. This is what you show an auditor
    later — "here's every rule this work was checked against and when".
    """
    __tablename__ = "compliance_check_logs"

    id = Column(Integer, primary_key=True)
    work_id = Column(Integer, ForeignKey("work_recommendations.id"), nullable=False)
    rule_id = Column(String, nullable=False)
    para_reference = Column(String)
    passed = Column(Boolean, nullable=False)
    severity = Column(String)  # "BLOCK" / "WARN" / "REVIEW"
    message = Column(Text)
    checked_at = Column(Date)
