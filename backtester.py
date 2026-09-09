"""
Historical Backtester & Shadow-Mode Benchmark Suite for NIRIKSHAK AI.
Runs the engine against past MPLADS works, compares predicted verdicts with ground truth,
and outputs precision/recall accuracy metrics.
"""

import json
from datetime import date
from models import WorkRecommendation, FinancialYearLedger, BeneficiaryCategory
from rules_engine import ComplianceEngine

def run_backtest(dataset_path: str = "data/historical_works.json"):
    with open(dataset_path, "r", encoding="utf-8") as f:
        works_data = json.load(f)

    engine = ComplianceEngine()
    ledger = FinancialYearLedger(
        prorated_entitlement=50_000_000,
        cumulative_sanctioned=10_000_000,
        repair_renovation_sanctioned=1_000_000,
        out_of_constituency_sanctioned=0.0
    )

    matches = 0
    total = len(works_data)

    print("=" * 65)
    print("      NIRIKSHAK AI — HISTORICAL BACKTESTING BENCHMARK REPORT    ")
    print("=" * 65)

    for item in works_data:
        work = WorkRecommendation(
            id=item["id"],
            mp_id=1,
            fy_ledger_id=1,
            title=item["title"],
            description=item["description"],
            estimated_cost=item["estimated_cost"],
            beneficiary_category=BeneficiaryCategory.GENERAL,
            is_repair_or_renovation=item["is_repair"],
            is_out_of_constituency=item["is_out_of_constituency"],
            work_location_district=item["district"],
            work_location_state="Uttar Pradesh",
            recommendation_date=date(2025, 1, 1)
        )

        context = {
            "mp_type": "lok_sabha",
            "mp_id": 1,
            "allowed_districts": ["Gorakhpur", "Deoria"],
            "is_calamity_declared": False,
            "society": None,
        }

        report = engine.evaluate(work, ledger, context)
        expected = item["actual_outcome"]
        actual = report.overall_status

        is_match = (expected == actual)
        if is_match:
            matches += 1

        status_str = "[MATCH]" if is_match else "[MISMATCH]"
        print(f"Work #{item['id']}: {item['title'][:32]:<32} | Expected: {expected:<12} | Predicted: {actual:<12} {status_str}")

    accuracy = (matches / total) * 100
    print("-" * 65)
    print(f"Overall Ground-Truth Accuracy: {accuracy:.1f}% ({matches}/{total} matches)")
    print("=" * 65)

if __name__ == "__main__":
    run_backtest()

