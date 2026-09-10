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
    darpan_verification = None
    if payload.darpan_id:
        ngo_info = darpan_service.verify_ngo(payload.darpan_id)
        darpan_verification = ngo_info
        if ngo_info.get("valid"):
            society_obj = Society(
                name=ngo_info.get("name", "Unknown NGO"),
                darpan_id=payload.darpan_id,
                active_since=date(2020, 1, 1),
                lifetime_sanctioned_total=0.0
            )
        else:
            society_obj = Society(
                name="Unverified / Invalid NGO",
                darpan_id=None,
                active_since=date.today(),
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
        "raw_darpan_id": payload.darpan_id,
        "darpan_verification": darpan_verification,
        "years_active": 5 if (society_obj and society_obj.darpan_id) else 0,
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


@app.get("/works")
def get_all_evaluated_works(db: Session = Depends(get_db)):
    """Fetch all evaluated works with their compliance audit check logs."""
    works = db.query(WorkRecommendation).order_by(WorkRecommendation.id.desc()).all()
    results = []
    for w in works:
        mp = db.query(MemberOfParliament).filter(MemberOfParliament.id == w.mp_id).first()
        logs = db.query(ComplianceCheckLog).filter(ComplianceCheckLog.work_id == w.id).all()
        
        # Calculate verdict
        has_block = any(not l.passed and l.severity == "BLOCK" for l in logs)
        has_review = any(not l.passed and l.severity == "REVIEW" for l in logs)
        verdict = "BLOCKED" if has_block else ("NEEDS_REVIEW" if has_review else "APPROVED")
        
        results.append({
            "work_id": w.id,
            "title": w.title,
            "description": w.description,
            "estimated_cost": w.estimated_cost,
            "district": w.work_location_district,
            "state": w.work_location_state,
            "mp_name": mp.name if mp else "Gorakhpur Representative MP",
            "status": w.status.value,
            "overall_status": verdict,
            "recommendation_date": w.recommendation_date.isoformat() if w.recommendation_date else None,
            "rule_checks": [
                {
                    "rule_id": l.rule_id,
                    "para_reference": l.para_reference,
                    "passed": l.passed,
                    "severity": l.severity,
                    "message": l.message
                }
                for l in logs
            ]
        })
    return {"works_count": len(results), "works": results}




# --- Features Catalog & Works Endpoints ---

# --- Compliance 1.0 Real Dataset Audit Endpoints ---
@app.get("/api/v1/features/works")
def get_v1_features_works(
    parliament: str = "all",
    search: Optional[str] = None,
    state: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    try:
        import sys
        import pandas as pd
        from pathlib import Path
        sys.path.append(str(Path(__file__).parent / "backend"))
        from backend.compliance_engine import load_work_features, parse_num

        df = load_work_features(parliament=parliament)
        if df.empty:
            return {"total": 0, "works": []}

        if search:
            q = search.lower()
            mask = (
                df["canonical_work_id"].astype(str).str.lower().str.contains(q, na=False) |
                df["work_description"].astype(str).str.lower().str.contains(q, na=False) |
                df["mp_name"].astype(str).str.lower().str.contains(q, na=False) |
                df["state"].astype(str).str.lower().str.contains(q, na=False)
            )
            df = df[mask]

        if state and state.upper() != "ALL":
            df = df[df["state"].astype(str).str.lower() == state.lower()]

        if status and status.upper() != "ALL":
            df = df[df["lifecycle_status"].astype(str).str.upper() == status.upper()]

        total = len(df)
        paged_df = df.iloc[offset : offset + limit]

        works = []
        for idx, row in paged_df.iterrows():
            w_id = str(row.get("canonical_work_id", f"WORK-{idx}"))
            w_desc = str(row.get("work_description", "--"))
            w_state = str(row.get("state", "India")).strip()
            w_dist = str(row.get("constituency", "--")).strip()
            w_mp = str(row.get("mp_name", "--")).strip()
            sanc = parse_num(row.get("sanctioned_amount"), 0.0)
            exp = parse_num(row.get("expenditure_amount"), 0.0)
            st = str(row.get("lifecycle_status", "UNKNOWN")).upper()

            works.append({
                "work_id": w_id,
                "description": w_desc,
                "state": w_state,
                "constituency": w_dist,
                "mp_name": w_mp,
                "sanctioned_amount": sanc,
                "expenditure_amount": exp,
                "status": st,
            })

        return {"total": total, "works": works}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/compliance/summary")
def get_v1_compliance_summary(parliament: str = "all", financial_year: str = "all"):
    try:
        import sys
        from pathlib import Path
        sys.path.append(str(Path(__file__).parent / "backend"))
        from backend.compliance_engine import get_compliance_summary
        return get_compliance_summary(parliament=parliament, financial_year=financial_year)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/compliance/violations")
def get_v1_compliance_violations(
    parliament: str = "all",
    financial_year: str = "all",
    severity: Optional[str] = None,
    rule_code: Optional[str] = None,
    state: Optional[str] = None,
    limit: int = 100
):
    try:
        import sys
        from pathlib import Path
        sys.path.append(str(Path(__file__).parent / "backend"))
        from backend.compliance_engine import evaluate_compliance_violations
        violations = evaluate_compliance_violations(parliament=parliament, financial_year=financial_year)
        
        if severity and severity.upper() != "ALL":
            violations = [v for v in violations if v["severity"].upper() == severity.upper()]
            
        if rule_code and rule_code.upper() != "ALL":
            violations = [v for v in violations if v["rule_code"].upper() == rule_code.upper()]
            
        if state and state.upper() != "ALL":
            violations = [v for v in violations if v["state"].lower() == state.lower()]
            
        return {
            "total": len(violations),
            "violations": violations[:limit]
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))



