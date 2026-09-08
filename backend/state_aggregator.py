"""
State and Union Territory Data Aggregator for NIRIKSHAK-AI.
Calculates dynamic State/UT summary metrics, project breakdowns, completed work details,
and financial allocations directly from canonical work features.
"""

from pathlib import Path
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
from functools import lru_cache

BASE_DIR = Path(__file__).resolve().parent.parent

UNION_TERRITORIES = {
    "andaman and nicobar islands",
    "chandigarh",
    "dadra and nagar haveli and daman and diu",
    "delhi",
    "jammu and kashmir",
    "ladakh",
    "lakshadweep",
    "puducherry"
}

def clean_state_id(state_name: str) -> str:
    """Generates a stable URL slug for a state or UT name."""
    s = str(state_name).strip().lower()
    s = s.replace(" & ", "-and-").replace("&", "-and-")
    s = s.replace(" ", "-")
    return "".join(c for c in s if c.isalnum() or c == "-")

@lru_cache(maxsize=4)
def get_aggregated_states(parliament: str = "all") -> List[Dict[str, Any]]:
    """
    Groups canonical work features by State/UT and computes metrics dynamically.
    Returns a sorted list of State/UT summary objects.
    """
    parliaments = ["lok_sabha", "rajya_sabha"] if parliament == "all" else [parliament]
    dfs = []
    for p in parliaments:
        csv_path = BASE_DIR / "data" / "features" / p / "work_features.csv"
        if csv_path.exists():
            dfs.append(pd.read_csv(csv_path, low_memory=False))

    if not dfs:
        return []

    df = pd.concat(dfs, ignore_index=True) if len(dfs) > 1 else dfs[0]
    
    # Filter valid states
    df["state_clean"] = df["state"].astype(str).str.strip()
    df["mp_clean"] = df["mp_name"].astype(str).str.strip()
    df = df[(df["state_clean"] != "") & (df["state_clean"].str.lower() != "nan")]

    state_results = []

    for state_name, g in df.groupby("state_clean"):
        total_projects = len(g)
        
        # Categorize by standardized lifecycle status
        completed_mask = g["lifecycle_status"].astype(str).str.upper() == "COMPLETED"
        ongoing_mask = g["lifecycle_status"].astype(str).str.upper().isin(["EXPENDITURE_STARTED", "SANCTIONED"])
        pending_mask = g["lifecycle_status"].astype(str).str.upper() == "RECOMMENDED_ONLY"

        completed_count = int(completed_mask.sum())
        ongoing_count = int(ongoing_mask.sum())
        pending_count = int(pending_mask.sum())

        # Amounts
        rec_amt = float(pd.to_numeric(g["recommended_amount"], errors="coerce").fillna(0).sum())
        sanc_amt = float(pd.to_numeric(g["sanctioned_amount"], errors="coerce").fillna(0).sum())
        exp_amt = float(pd.to_numeric(g["expenditure_amount"], errors="coerce").fillna(0).sum())
        comp_amt = float(pd.to_numeric(g["completion_amount"], errors="coerce").fillna(0).sum())

        # If comp_amt is present on completed works but exp_amt is 0, use comp_amt
        if comp_amt > exp_amt:
            exp_amt = comp_amt

        utilization_rate = round((exp_amt / sanc_amt * 100.0) if sanc_amt > 0 else 0.0, 2)
        completion_rate = round((completed_count / total_projects * 100.0) if total_projects > 0 else 0.0, 2)

        # Count unique MPs in this state
        mp_count = int(g["mp_clean"].nunique()) if "mp_clean" in g.columns else 1
        if mp_count == 0:
            mp_count = 1

        slug = clean_state_id(state_name)
        state_type = "UT" if state_name.lower() in UNION_TERRITORIES else "STATE"

        state_results.append({
            "id": slug,
            "name": state_name,
            "type": state_type,
            "mpCount": mp_count,
            "totalProjects": total_projects,
            "completedProjects": completed_count,
            "worksCompleted": completed_count,
            "ongoingProjects": ongoing_count,
            "pendingProjects": pending_count,
            "recommendedAmount": rec_amt,
            "sanctionedAmount": sanc_amt,
            "allocated": sanc_amt,
            "expenditureAmount": exp_amt,
            "recordedExpenditure": exp_amt,
            "completedAmount": comp_amt,
            "utilizationRate": utilization_rate,
            "expenditureRate": utilization_rate,
            "completionRate": completion_rate
        })

    # Sort descending by expenditureRate/utilizationRate to compute performance ranking dynamically
    state_results.sort(key=lambda x: (x["expenditureRate"], x["totalProjects"]), reverse=True)
    total_states_count = len(state_results)

    for rank_idx, s_obj in enumerate(state_results, start=1):
        s_obj["rank"] = rank_idx
        s_obj["totalStates"] = total_states_count

    return state_results

@lru_cache(maxsize=128)
def get_single_state_details(state_id: str, parliament: str = "all") -> Optional[Dict[str, Any]]:
    """
    Returns aggregated details for a single State or Union Territory by slug.
    """
    all_states = get_aggregated_states(parliament=parliament)
    for s in all_states:
        if s["id"] == state_id:
            return s
    return None

@lru_cache(maxsize=128)
def get_state_mp_performance(state_id: str, parliament: str = "all") -> List[Dict[str, Any]]:
    """
    Returns per-MP performance breakdown for a given State/UT slug.
    Groups by mp_name and computes total_works, completed_works, ongoing_works,
    pending_works, completion_rate, sanctioned_amount, expenditure_amount, utilization_rate.
    """
    parliaments = ["lok_sabha", "rajya_sabha"] if parliament == "all" else [parliament]
    dfs = []
    for p in parliaments:
        csv_path = BASE_DIR / "data" / "features" / p / "work_features.csv"
        if csv_path.exists():
            df_p = pd.read_csv(csv_path, low_memory=False)
            df_p["parliament_source"] = p
            dfs.append(df_p)

    if not dfs:
        return []

    df = pd.concat(dfs, ignore_index=True) if len(dfs) > 1 else dfs[0]
    df["state_clean"] = df["state"].astype(str).str.strip()
    df["slug"] = df["state_clean"].apply(clean_state_id)

    state_id_clean = state_id.lower().strip()
    state_df = df[(df["slug"] == state_id_clean) | (df["state_clean"].str.lower() == state_id_clean)]

    if state_df.empty:
        normalized_target = state_id_clean.replace("-", " ")
        state_df = df[df["state_clean"].str.lower().str.replace("-", " ") == normalized_target]

    if state_df.empty:
        return []

    mp_results = []
    for mp_name, g in state_df.groupby("mp_name"):
        if not str(mp_name).strip() or str(mp_name).lower() == "nan":
            continue

        total_works = len(g)
        completed_count = int((g["lifecycle_status"].astype(str).str.upper() == "COMPLETED").sum())
        ongoing_count = int((g["lifecycle_status"].astype(str).str.upper().isin(["EXPENDITURE_STARTED", "SANCTIONED"])).sum())
        pending_count = int((g["lifecycle_status"].astype(str).str.upper() == "RECOMMENDED_ONLY").sum())

        sanc_amt = float(pd.to_numeric(g["sanctioned_amount"], errors="coerce").fillna(0).sum())
        exp_amt = float(pd.to_numeric(g["expenditure_amount"], errors="coerce").fillna(0).sum())

        constituency = str(g["constituency"].iloc[0]) if "constituency" in g.columns and pd.notna(g["constituency"].iloc[0]) else ""
        parl_source = str(g["parliament_source"].iloc[0]) if "parliament_source" in g.columns else "lok_sabha"

        comp_rate = round((completed_count / total_works * 100.0) if total_works > 0 else 0.0, 1)
        util_rate = round((exp_amt / sanc_amt * 100.0) if sanc_amt > 0 else 0.0, 1)

        mp_results.append({
            "mp_name": str(mp_name).strip(),
            "constituency": constituency,
            "parliament": parl_source,
            "total_works": total_works,
            "completed_works": completed_count,
            "ongoing_works": ongoing_count,
            "pending_works": pending_count,
            "completion_rate": comp_rate,
            "sanctioned_amount": sanc_amt,
            "expenditure_amount": exp_amt,
            "utilization_rate": util_rate,
        })

    mp_results.sort(key=lambda x: x["total_works"], reverse=True)
    return mp_results
