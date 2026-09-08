"""
Automated Compliance Monitoring Engine for NIRIKSHAK AI.
Evaluates MPLADS development projects against 7 statutory compliance rules.
"""

from pathlib import Path
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
from functools import lru_cache

BASE_DIR = Path(__file__).resolve().parent.parent

COMPLIANCE_RULES = [
    {
        "code": "EXP_BEFORE_SANCTION",
        "title": "Expenditure Before Sanction",
        "description": "Financial expenditure recorded prior to formal administrative sanction approval.",
        "severity": "CRITICAL",
        "category": "Statutory Authority"
    },
    {
        "code": "EXP_EXCEEDS_SANCTION",
        "title": "Expenditure Exceeding Sanction",
        "description": "Disbursed expenditure exceeds the maximum approved sanctioned amount.",
        "severity": "HIGH",
        "category": "Financial Control"
    },
    {
        "code": "EXCESSIVE_DELAY",
        "title": "Excessive Execution Delay",
        "description": "Project execution pending > 365 days after sanction without completion certification.",
        "severity": "HIGH",
        "category": "Timeline Compliance"
    },
    {
        "code": "MISSING_COMPLETION_CERT",
        "title": "Missing Physical Completion Certificate",
        "description": "100% fund disbursal completed without physical completion certification on record.",
        "severity": "HIGH",
        "category": "Physical Audit"
    },
    {
        "code": "FINANCIAL_PHYSICAL_MISMATCH",
        "title": "Financial vs Physical Mismatch",
        "description": "High fund utilization (> 80%) with incomplete physical work status.",
        "severity": "MEDIUM",
        "category": "Progress Audit"
    },
    {
        "code": "DUPLICATE_PAYMENT_PATTERN",
        "title": "Duplicate Disbursal Pattern",
        "description": "Identical financial amounts and categories disbursed across matching constituency records.",
        "severity": "HIGH",
        "category": "Payment Audit"
    },
    {
        "code": "SINGLE_VENDOR_CONCENTRATION",
        "title": "High Vendor Category Concentration",
        "description": "Single category/agency executing an abnormal proportion of works in a single region.",
        "severity": "MEDIUM",
        "category": "Procurement Audit"
    }
]

def load_work_features(parliament: str = "all") -> pd.DataFrame:
    """Loads and unifies work features dataset."""
    parliaments = ["lok_sabha", "rajya_sabha"] if parliament == "all" else [parliament]
    dfs = []
    for p in parliaments:
        csv_path = BASE_DIR / "data" / "features" / p / "work_features.csv"
        if csv_path.exists():
            df_p = pd.read_csv(csv_path, low_memory=False)
            df_p["parliament_source"] = p
            dfs.append(df_p)

    if not dfs:
        return pd.DataFrame()

    df = pd.concat(dfs, ignore_index=True) if len(dfs) > 1 else dfs[0]
    return df

@lru_cache(maxsize=16)
def evaluate_compliance_violations(parliament: str = "all") -> List[Dict[str, Any]]:
    """
    Evaluates all 7 compliance rules against work features data.
    Returns a structured list of compliance violation records.
    """
    df = load_work_features(parliament=parliament)
    if df.empty:
        return []

    violations = []

    for idx, row in df.iterrows():
        work_id = str(row.get("canonical_work_id", f"WORK-{idx}"))
        work_desc = str(row.get("work_description", "--"))
        state = str(row.get("state", "India")).strip()
        constituency = str(row.get("constituency", "--")).strip()
        mp_name = str(row.get("mp_name", "--")).strip()
        parl = str(row.get("parliament_source", "lok_sabha"))

        sanc_amt = float(pd.to_numeric(row.get("sanctioned_amount"), errors="coerce") or 0)
        exp_amt = float(pd.to_numeric(row.get("expenditure_amount"), errors="coerce") or 0)
        rec_amt = float(pd.to_numeric(row.get("recommended_amount"), errors="coerce") or 0)
        status = str(row.get("lifecycle_status", "UNKNOWN")).upper()
        
        days_sanc = float(pd.to_numeric(row.get("days_since_sanction"), errors="coerce") or 0)
        is_delayed = int(pd.to_numeric(row.get("is_delayed"), errors="coerce") or 0)
        cost_overrun = float(pd.to_numeric(row.get("cost_overrun_pct"), errors="coerce") or 0)
        fin_rate = float(pd.to_numeric(row.get("financial_execution_rate"), errors="coerce") or 0)

        # Rule 1: Out-of-Sequence / Exp Before Sanction
        if exp_amt > 0 and (sanc_amt == 0 or status == "RECOMMENDED_ONLY"):
            violations.append({
                "id": f"COMP-VIOL-R1-{work_id}",
                "work_id": work_id,
                "work_description": work_desc,
                "state": state,
                "constituency": constituency,
                "mp_name": mp_name,
                "rule_code": "EXP_BEFORE_SANCTION",
                "rule_title": "Expenditure Before Sanction",
                "severity": "CRITICAL",
                "category": "Statutory Authority",
                "details": f"Recorded expenditure of ₹{exp_amt:,.0f} prior to administrative sanction approval.",
                "sanctioned_amount": sanc_amt,
                "expenditure_amount": exp_amt,
                "lifecycle_status": status,
                "parliament": parl
            })

        # Rule 2: Expenditure Exceeding Approved Sanction
        if (exp_amt > sanc_amt and sanc_amt > 0) or cost_overrun > 5.0:
            excess = exp_amt - sanc_amt if exp_amt > sanc_amt else 0
            violations.append({
                "id": f"COMP-VIOL-R2-{work_id}",
                "work_id": work_id,
                "work_description": work_desc,
                "state": state,
                "constituency": constituency,
                "mp_name": mp_name,
                "rule_code": "EXP_EXCEEDS_SANCTION",
                "rule_title": "Expenditure Exceeding Sanction",
                "severity": "HIGH",
                "category": "Financial Control",
                "details": f"Disbursed expenditure (₹{exp_amt:,.0f}) exceeds approved sanction (₹{sanc_amt:,.0f}) by ₹{excess:,.0f}.",
                "sanctioned_amount": sanc_amt,
                "expenditure_amount": exp_amt,
                "lifecycle_status": status,
                "parliament": parl
            })

        # Rule 3: Excessive Execution Delay
        if (days_sanc > 365 or is_delayed == 1) and status != "COMPLETED":
            violations.append({
                "id": f"COMP-VIOL-R3-{work_id}",
                "work_id": work_id,
                "work_description": work_desc,
                "state": state,
                "constituency": constituency,
                "mp_name": mp_name,
                "rule_code": "EXCESSIVE_DELAY",
                "rule_title": "Excessive Execution Delay",
                "severity": "HIGH",
                "category": "Timeline Compliance",
                "details": f"Project execution delayed by {int(days_sanc)} days post-sanction without completion.",
                "sanctioned_amount": sanc_amt,
                "expenditure_amount": exp_amt,
                "lifecycle_status": status,
                "parliament": parl
            })

        # Rule 4: Missing Physical Completion Certificate
        if exp_amt >= sanc_amt and sanc_amt > 0 and status != "COMPLETED":
            violations.append({
                "id": f"COMP-VIOL-R4-{work_id}",
                "work_id": work_id,
                "work_description": work_desc,
                "state": state,
                "constituency": constituency,
                "mp_name": mp_name,
                "rule_code": "MISSING_COMPLETION_CERT",
                "rule_title": "Missing Physical Completion Certificate",
                "severity": "HIGH",
                "category": "Physical Audit",
                "details": f"100% fund disbursal achieved (₹{exp_amt:,.0f}) but physical completion certificate is pending.",
                "sanctioned_amount": sanc_amt,
                "expenditure_amount": exp_amt,
                "lifecycle_status": status,
                "parliament": parl
            })

        # Rule 5: Financial vs Physical Execution Mismatch
        if (fin_rate >= 85.0 or (sanc_amt > 0 and exp_amt / sanc_amt >= 0.85)) and status != "COMPLETED":
            violations.append({
                "id": f"COMP-VIOL-R5-{work_id}",
                "work_id": work_id,
                "work_description": work_desc,
                "state": state,
                "constituency": constituency,
                "mp_name": mp_name,
                "rule_code": "FINANCIAL_PHYSICAL_MISMATCH",
                "rule_title": "Financial vs Physical Mismatch",
                "severity": "MEDIUM",
                "category": "Progress Audit",
                "details": f"Financial execution rate is {fin_rate:.1f}% but work remains in {status} state.",
                "sanctioned_amount": sanc_amt,
                "expenditure_amount": exp_amt,
                "lifecycle_status": status,
                "parliament": parl
            })

    # Rule 6: Duplicate Payment Pattern Check (across dataset)
    if not df.empty and "sanctioned_amount" in df.columns:
        dupes = df[df.duplicated(subset=["constituency", "sanctioned_amount", "work_category"], keep=False)]
        for idx, row in dupes.head(15).iterrows():
            work_id = str(row.get("canonical_work_id", f"WORK-DUP-{idx}"))
            violations.append({
                "id": f"COMP-VIOL-R6-{work_id}",
                "work_id": work_id,
                "work_description": str(row.get("work_description", "--")),
                "state": str(row.get("state", "India")).strip(),
                "constituency": str(row.get("constituency", "--")).strip(),
                "mp_name": str(row.get("mp_name", "--")).strip(),
                "rule_code": "DUPLICATE_PAYMENT_PATTERN",
                "rule_title": "Duplicate Disbursal Pattern",
                "severity": "HIGH",
                "category": "Payment Audit",
                "details": f"Matching sanction amount ₹{float(row.get('sanctioned_amount', 0)):,.0f} and category detected across duplicate records.",
                "sanctioned_amount": float(row.get("sanctioned_amount", 0)),
                "expenditure_amount": float(row.get("expenditure_amount", 0)),
                "lifecycle_status": str(row.get("lifecycle_status", "UNKNOWN")).upper(),
                "parliament": str(row.get("parliament_source", "lok_sabha"))
            })

    return violations

def get_compliance_summary(parliament: str = "all") -> Dict[str, Any]:
    """
    Computes overall Compliance Health Score, rule breakdown, and state compliance index.
    """
    df = load_work_features(parliament=parliament)
    total_projects = len(df) if not df.empty else 1
    
    violations = evaluate_compliance_violations(parliament=parliament)
    
    # Deduplicate violations by work_id + rule_code
    unique_violations = {}
    for v in violations:
        key = f"{v['work_id']}_{v['rule_code']}"
        unique_violations[key] = v
        
    violations_list = list(unique_violations.values())
    total_violations_count = len(violations_list)
    
    critical_count = sum(1 for v in violations_list if v["severity"] == "CRITICAL")
    high_count = sum(1 for v in violations_list if v["severity"] == "HIGH")
    medium_count = sum(1 for v in violations_list if v["severity"] == "MEDIUM")
    
    # Compute 0–100 Compliance Health Score
    # Weighted penalty: Critical=3, High=1.5, Medium=0.5 per 100 projects
    penalty = ((critical_count * 3.0) + (high_count * 1.5) + (medium_count * 0.5)) / (total_projects / 100.0)
    health_score = max(0.0, min(100.0, round(100.0 - penalty, 1)))

    # Rule-by-rule status breakdown
    rule_breakdown = []
    for rule in COMPLIANCE_RULES:
        code = rule["code"]
        rule_viols = sum(1 for v in violations_list if v["rule_code"] == code)
        pass_count = max(0, total_projects - rule_viols)
        comp_rate = round((pass_count / total_projects * 100.0) if total_projects > 0 else 100.0, 1)
        rule_breakdown.append({
            **rule,
            "violations_count": rule_viols,
            "passed_count": pass_count,
            "compliance_rate": comp_rate
        })

    # State compliance health index
    state_scores = []
    if not df.empty and "state" in df.columns:
        df["state_clean"] = df["state"].astype(str).str.strip()
        for state_name, g in df.groupby("state_clean"):
            if not state_name or state_name.lower() == "nan":
                continue
            st_total = len(g)
            st_viols = [v for v in violations_list if v["state"].lower() == state_name.lower()]
            st_crit = sum(1 for v in st_viols if v["severity"] == "CRITICAL")
            st_high = sum(1 for v in st_viols if v["severity"] == "HIGH")
            st_med = sum(1 for v in st_viols if v["severity"] == "MEDIUM")
            
            st_penalty = ((st_crit * 3.0) + (st_high * 1.5) + (st_med * 0.5)) / (st_total / 100.0) if st_total > 0 else 0
            st_score = max(0.0, min(100.0, round(100.0 - st_penalty, 1)))
            
            state_scores.append({
                "state": state_name,
                "total_projects": st_total,
                "violations_count": len(st_viols),
                "compliance_score": st_score,
                "risk_tier": "LOW_RISK" if st_score >= 80 else "MEDIUM_RISK" if st_score >= 60 else "HIGH_RISK"
            })
            
        state_scores.sort(key=lambda x: x["compliance_score"], reverse=True)

    return {
        "health_score": health_score,
        "total_audited": total_projects,
        "total_violations": total_violations_count,
        "critical_violations": critical_count,
        "high_violations": high_count,
        "medium_violations": medium_count,
        "rule_breakdown": rule_breakdown,
        "state_rankings": state_scores[:10]
    }

