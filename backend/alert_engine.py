import pandas as pd
from typing import List, Dict, Any
from pathlib import Path
from backend.compliance_engine import evaluate_compliance_violations, load_work_features

BASE_DIR = Path(__file__).parent.parent

# In-memory store for analyst feedback
FEEDBACK_STORE: List[Dict[str, Any]] = []

def get_compliance_alerts(parliament: str = "all", financial_year: str = "all", mp_name: str = None, limit: int = 50) -> Dict[str, Any]:
    """
    Evaluates violations, runs priority risk scoring, deduplicates alerts,
    and returns prioritized alerts with explainability metadata.
    """
    violations = evaluate_compliance_violations(parliament=parliament, financial_year=financial_year)
    
    if mp_name and mp_name.strip() and mp_name.lower() != "all":
        target = mp_name.strip().lower()
        violations = [v for v in violations if target in v.get("mp_name", "").lower()]

    alerts = []
    seen_keys = set()

    for v in violations:
        dedup_key = f"{v['work_id']}_{v['rule_code']}"
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)

        sev = v["severity"]
        # Score calculation: Priority Score = f(Severity, Financial Exposure)
        exposure = float(v.get("expenditure_amount", 0.0))
        
        if sev == "CRITICAL":
            base_score = 90
            sla = "15 mins"
        elif sev == "HIGH":
            base_score = 75
            sla = "1 hour"
        else:
            base_score = 50
            sla = "24 hours"

        # Financial exposure boost (up to +10 points for exposure > 10 Lakhs)
        exposure_boost = min(10.0, exposure / 100000.0)
        risk_score = round(min(99.0, base_score + exposure_boost), 1)

        # Feature explainability metadata
        explainability = {
            "rule_code": v["rule_code"],
            "category": v["category"],
            "sanctioned_amount": v.get("sanctioned_amount", 0),
            "expenditure_amount": exposure,
            "lifecycle_status": v.get("lifecycle_status", "UNKNOWN"),
            "trigger_condition": v["details"]
        }

        alerts.append({
            "alert_id": f"ALT-{v['id']}",
            "work_id": v["work_id"],
            "work_description": v["work_description"],
            "state": v["state"],
            "constituency": v["constituency"],
            "mp_name": v["mp_name"],
            "rule_code": v["rule_code"],
            "rule_title": v["rule_title"],
            "severity": sev,
            "risk_score": risk_score,
            "sla": sla,
            "timestamp": "Just now",
            "explainability": explainability,
            "status": "ACTIVE"
        })

    # Sort alerts by Risk Score descending
    alerts.sort(key=lambda x: x["risk_score"], reverse=True)

    counts = {
        "critical": sum(1 for a in alerts if a["severity"] == "CRITICAL"),
        "high": sum(1 for a in alerts if a["severity"] == "HIGH"),
        "medium": sum(1 for a in alerts if a["severity"] == "MEDIUM"),
        "total": len(alerts)
    }

    return {
        "summary": counts,
        "alerts": alerts[:limit]
    }

def dispatch_mp_alert(alert_id: str, mp_name: str, channel: str = "ALL") -> Dict[str, Any]:
    """
    Simulates sending targeted alerts directly to the specific Member of Parliament (MP)
    via SMS, Email, and Official Nodal Portal Notification.
    """
    notification_log = {
        "dispatch_id": f"DISPATCH-{pd.Timestamp.now().strftime('%Y%m%d%H%M%S')}",
        "alert_id": alert_id,
        "target_mp": mp_name,
        "channels_notified": ["SMS (NIC Gateway)", "Official Email", "MP Nodal Dashboard"] if channel == "ALL" else [channel],
        "dispatch_timestamp": pd.Timestamp.now().isoformat(),
        "status": "DELIVERED",
        "message": f"Official Compliance Warning issued to MP '{mp_name}' for Alert {alert_id}."
    }
    FEEDBACK_STORE.append(notification_log)
    return {"status": "SUCCESS", "dispatch": notification_log}


