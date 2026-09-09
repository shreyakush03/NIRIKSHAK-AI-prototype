# MPLADS Compliance Checker — Prototype

## What's here
- `models.py` — SQLAlchemy data model (MPs, FY ledgers, works, societies, inspections)
- `rules_engine.py` — the compliance rules engine (10 rules covering financial,
  geospatial, negative-list, society, and SLA checks from the guidelines)
- `example_check.py` — standalone runnable demo (no server needed)
- `api.py` — FastAPI wrapper exposing `POST /check-compliance`
- `requirements.txt`

## Quick start

```bash
pip install -r requirements.txt

# Option A: run the standalone demo
python example_check.py

# Option B: run the API
uvicorn api:app --reload
# then POST to http://localhost:8000/check-compliance
# see `example_payload` at the bottom of api.py for the request shape
# interactive docs auto-generated at http://localhost:8000/docs
```

## How to integrate this into YOUR project

1. **Start with the API as a microservice.** Don't try to merge this logic
   into your main app's codebase directly. Run it as a separate FastAPI
   service. Your main app (whatever manages work recommendations) calls
   `POST /check-compliance` whenever a work is created or edited, and
   gets back `APPROVED` / `NEEDS_REVIEW` / `BLOCKED` plus the per-rule
   breakdown. This keeps the compliance logic swappable and testable
   independent of your UI/main app.

2. **Persist real ledgers, not in-memory ones.** `api.py` currently takes
   a ledger *snapshot* in the request body so you can test without a DB.
   For real use: point it at a real Postgres/SQLite DB using `models.py`,
   look up the MP's actual `FinancialYearLedger` row by `mp_id` +
   `financial_year`, and update it transactionally the moment a work is
   sanctioned (increment `cumulative_sanctioned`, `repair_renovation_sanctioned`,
   etc. — see the `models.py` docstring on why this ledger must hold running
   totals rather than being recomputed from scratch each time).

3. **Add rules incrementally, don't try to cover every para on day one.**
   Start with the ~10 rules already implemented (they cover the highest-
   frequency checks: entitlement ceiling, minimum work amount, repair
   ceiling, out-of-constituency cap, jurisdiction, negative list, society
   eligibility, and two SLA timers). Add SC/ST hard quota enforcement,
   calamity relief timelines, and admin expenditure caps next — each is
   a new `Rule` subclass in `rules_engine.py`, nothing else needs to change.

4. **Never auto-reject on the negative-list rule alone.** It's marked
   `REVIEW` severity on purpose. Route anything it flags to a human
   reviewer queue in your UI. If you want to reduce false positives,
   replace `NegativeListRule._keyword_hits` with a call to an LLM
   classifier that reasons about the actual work description instead
   of raw keyword matching — the rest of the engine doesn't need to change.

5. **Log every check.** Use the `ComplianceCheckLog` table in `models.py`
   to persist every `RuleResult` against the work — this becomes your
   audit trail when the CAG/State auditors ask "how was this work checked."

## How a single project gets checked, step by step

1. Work recommendation comes in (title, description, cost, location, etc.)
2. Look up the MP's current FY ledger
3. Build the `context` dict (MP type, allowed districts, calamity flag,
   any linked society, written justification if under ₹2.5L)
4. Call `ComplianceEngine().evaluate(work, ledger, context)`
5. Inspect `report.overall_status`:
   - `APPROVED` → proceed to sanction, update the ledger
   - `NEEDS_REVIEW` → hold, route to human reviewer with the flagged rules
   - `BLOCKED` → reject automatically, return the failing rule messages
     to whoever submitted the recommendation
