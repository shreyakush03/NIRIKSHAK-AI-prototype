"""
FastAPI layer over the compliance engine with DB persistence & Human Review Workflow.
"""

from datetime import date
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models import (
    WorkRecommendation, FinancialYearLedger, MemberOfParliament,
    Society, WorkStatus, BeneficiaryCategory, ComplianceCheckLog
)
from rules_engine import ComplianceEngine, Severity
from db import init_db, get_db, seed_sample_data, log_compliance_check, update_ledger_on_sanction
from integrations import NGODarpanService, GISBoundaryService, PFMSIntegrationService

app = FastAPI(title="MPLADS Compliance & Review API", version="2.0.0")

# Initialize database tables on startup
@app.on_event("startup")
def startup_event():
    init_db()
    db = next(get_db())
    seed_sample_data(db)

engine = ComplianceEngine()
darpan_service = NGODarpanService()
gis_service = GISBoundaryService()
pfms_service = PFMSIntegrationService()


# --- Request Schemas ---

class WorkCreatePayload(BaseModel):
    mp_id: int
    financial_year: str = "2025-26"
    title: str
    description: str
    estimated_cost: float
    beneficiary_category: str = "general"
    is_repair_or_renovation: bool = False
    is_out_of_constituency: bool = False
    is_calamity_relief: bool = False
    work_location_district: str
    work_location_state: str
    recommendation_date: date
    darpan_id: Optional[str] = None
    written_justification: Optional[str] = None


class ReviewDecisionPayload(BaseModel):
    approved: bool
    reviewer_notes: str


# --- Endpoints ---

@app.post("/check-and-submit-work")
def check_and_submit_work(payload: WorkCreatePayload, db: Session = Depends(get_db)):
    """
    Submits a new work recommendation, performs full compliance evaluation,
    saves the work & audit logs to DB, and returns the verdict.
    """
    mp = db.query(MemberOfParliament).filter(MemberOfParliament.id == payload.mp_id).first()
    if not mp:
        raise HTTPException(status_code=404, detail="MP not found")

    ledger = db.query(FinancialYearLedger).filter(
        FinancialYearLedger.mp_id == payload.mp_id,
        FinancialYearLedger.financial_year == payload.financial_year
    ).first()

    if not ledger:
        raise HTTPException(status_code=404, detail="Financial Year Ledger not found")

    # Wire NGO Darpan Integration if society work
    society_obj = None
    if payload.darpan_id:
        ngo_info = darpan_service.verify_ngo(payload.darpan_id)
        if ngo_info.get("valid"):
            society_obj = Society(
                name=ngo_info.get("name", "Unknown NGO"),
                darpan_id=payload.darpan_id,
                active_since=date(2020, 1, 1),
                lifetime_sanctioned_total=0.0
            )

    cat_enum = BeneficiaryCategory.GENERAL
    if payload.beneficiary_category.lower() == "sc":
        cat_enum = BeneficiaryCategory.SC
    elif payload.beneficiary_category.lower() == "st":
        cat_enum = BeneficiaryCategory.ST

    work = WorkRecommendation(
        mp_id=payload.mp_id,
        fy_ledger_id=ledger.id,
        title=payload.title,
        description=payload.description,
        estimated_cost=payload.estimated_cost,
        beneficiary_category=cat_enum,
        is_repair_or_renovation=payload.is_repair_or_renovation,
        is_out_of_constituency=payload.is_out_of_constituency,
        is_calamity_relief=payload.is_calamity_relief,
        work_location_district=payload.work_location_district,
        work_location_state=payload.work_location_state,
        recommendation_date=payload.recommendation_date,
        status=WorkStatus.RECOMMENDED
    )

    db.add(work)
    db.commit()
    db.refresh(work)

    # Allowed districts via GIS Boundary service
    allowed_districts = gis_service._constituency_map.get(
        mp.constituency_name or "Gorakhpur", [payload.work_location_district]
    )

    context = {
        "mp_type": mp.mp_type.value,
        "mp_id": mp.id,
        "allowed_districts": allowed_districts,
        "is_calamity_declared": payload.is_calamity_relief,
        "society": society_obj,
        "years_active": 5 if society_obj else 0,
        "written_justification": payload.written_justification,
    }

    report = engine.evaluate(work, ledger, context)

    # Log audit results
    log_compliance_check(db, work.id, report.results)

    # Automatically update work status based on verdict
    if report.overall_status == "APPROVED":
        work.status = WorkStatus.SANCTIONED
        work.sanction_date = date.today()
        update_ledger_on_sanction(db, ledger.id, work)
    elif report.overall_status == "BLOCKED":
        work.status = WorkStatus.REJECTED
    elif report.overall_status == "NEEDS_REVIEW":
        work.status = WorkStatus.RECOMMENDED

    db.commit()

    return {
        "work_id": work.id,
        "overall_status": report.overall_status,
        "work_status": work.status.value,
        "results": [
            {
                "rule_id": r.rule_id,
                "para_reference": r.para_reference,
                "passed": r.passed,
                "severity": r.severity.value,
                "message": r.message,
            }
            for r in report.results
        ]
    }


@app.get("/review-queue")
def get_review_queue(db: Session = Depends(get_db)):
    """Fetch all recommended works that are pending human review (NEEDS_REVIEW)."""
    pending_works = db.query(WorkRecommendation).filter(
        WorkRecommendation.status == WorkStatus.RECOMMENDED
    ).all()

    queue = []
    for w in pending_works:
        logs = db.query(ComplianceCheckLog).filter(
            ComplianceCheckLog.work_id == w.id,
            ComplianceCheckLog.passed == False
        ).all()
        queue.append({
            "work_id": w.id,
            "title": w.title,
            "description": w.description,
            "estimated_cost": w.estimated_cost,
            "district": w.work_location_district,
            "flagged_rules": [
                {
                    "rule_id": l.rule_id,
                    "para_reference": l.para_reference,
                    "severity": l.severity,
                    "message": l.message
                }
                for l in logs
            ]
        })
    return {"pending_reviews_count": len(queue), "queue": queue}


@app.post("/review-queue/{work_id}/decide")
def decide_review_work(work_id: int, decision: ReviewDecisionPayload, db: Session = Depends(get_db)):
    """Human reviewer endpoint to approve or reject a flagged work with notes."""
    work = db.query(WorkRecommendation).filter(WorkRecommendation.id == work_id).first()
    if not work:
        raise HTTPException(status_code=404, detail="Work not found")

    if decision.approved:
        work.status = WorkStatus.SANCTIONED
        work.sanction_date = date.today()
        update_ledger_on_sanction(db, work.fy_ledger_id, work)
        action_msg = "Manually Approved by Human Reviewer: " + decision.reviewer_notes
    else:
        work.status = WorkStatus.REJECTED
        action_msg = "Manually Rejected by Human Reviewer: " + decision.reviewer_notes

    # Add audit entry
    log_entry = ComplianceCheckLog(
        work_id=work.id,
        rule_id="HUMAN_REVIEW_DECISION",
        para_reference="Workflow",
        passed=decision.approved,
        severity="REVIEW",
        message=action_msg,
        checked_at=date.today()
    )
    db.add(log_entry)
    db.commit()

    return {"work_id": work.id, "new_status": work.status.value, "notes": decision.reviewer_notes}
