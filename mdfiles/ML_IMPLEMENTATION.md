# NIRIKSHAK-AI: Machine Learning (ML) & Data Intelligence Implementation

This document provides a comprehensive, end-to-end breakdown of everything implemented across the **Machine Learning Service**, **Data Pipelines**, **Entity Resolution Engine**, **Dynamic Feature Engineering**, **Risk Scoring Models**, and their **Frontend Integrations**.

---

## 1. End-to-End System Architecture

```text
Raw MPLADS Datasets (Lok Sabha & Rajya Sabha)
  │  (Allocation, Calamity, Recommended, Sanctioned, Expenditure, Completed)
  ▼
Stage 1: Ingestion & Discovery (`ml-service/ingestion/`)
  ▼
Stage 2: Preprocessing & Standardization (`ml-service/preprocessing/`)
  ▼
Stage 3: Data Profiling & Quality Auditing (`ml-service/profiling/`)
  ▼
Stage 4: Entity Resolution & Canonical Work ID Generation (`ml-service/entity_resolution/`)
  ▼
Stage 5: 118-Feature Engineering & Leakage Prevention (`ml-service/features/`)
  ▼
Stage 6: Risk Prediction, Anomaly Detection & Anomaly Ensembles (`ml-service/prediction/`, `ml-service/anomaly/`)
  ▼
Stage 7: FastAPI Backend Gateway (`backend/main.py`, `backend/dataset_aggregator.py`)
  ▼
Stage 8: Next.js Platform Frontend (`/overview`, `/projects`, `FeatureWorkTable`, `ProjectCard`)
```

---

## 2. Stage-by-Stage Implementation Details

### Stage 1: Ingestion & Discovery
- **Module:** [`ml-service/ingestion/loader.py`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/ingestion/loader.py), [`data_loader.py`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/ingestion/data_loader.py)
- **What was done:**
  - Auto-discovers and categorizes all raw CSV files across both Lok Sabha and Rajya Sabha.
  - Automatically identifies dataset types based on filename heuristics and schema inspection (*Allocation*, *Calamity*, *Recommended*, *Sanctioned*, *Expenditure*, *Completed*).
  - Handles dirty headers, BOM encodings, and missing column scenarios gracefully.

---

### Stage 2: Data Preprocessing & Standardization
- **Module:** [`ml-service/preprocessing/standardization/`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/preprocessing/standardization/)
- **What was done:**
  - **Column Normalization:** Standardizes disparate government headers (`Hon'ble Members of Parliament`, `Date of Sanction`, `Sanction Amount (₹)`) into standardized snake_case schemas (`mp_name`, `sanction_date`, `sanction_amount`).
  - **Amount Cleaning:** [`amounts.py`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/preprocessing/amounts.py) cleans dirty currency symbols (`₹`, `,`, spaces), handling Lakh/Crore conversions and enforcing positive floats.
  - **Date Normalization:** [`dates.py`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/preprocessing/dates.py) converts mixed date formats (`DD/MM/YYYY`, `YYYY-MM-DD`, `DD-Mon-YYYY`) into ISO `YYYY-MM-DD`.
  - **Text Cleaning:** [`text.py`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/preprocessing/text.py) eliminates whitespace noise, non-printable characters, and standardizes agency and MP names.

---

### Stage 3: Data Profiling & Quality Auditing
- **Module:** [`ml-service/profiling/`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/profiling/)
- **What was done:**
  - **Schema & Type Detection:** [`type_detector.py`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/profiling/type_detector.py) infers actual column semantic types (Currency, Date, Text, ID, Categorical).
  - **Missingness Auditing:** Outputs `missing_values.csv` classifying missingness tiers (*Complete*, *Low*, *Moderate*, *High*).
  - **Duplicate Detection:** Outputs `duplicate_report.csv` checking exact and fuzzy duplicate rows.
  - **Quality Scoring:** Assigns dynamic quality scores (e.g., 90% Sanctioned, 89% Recommended, 100% Calamity, overall 87.8%) based on null rates, outlier frequencies, and schema adherence.

---

### Stage 4: Multi-Field Entity Resolution (Record Linkage)
- **Module:** [`ml-service/entity_resolution/`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/entity_resolution/)
- **What was done:**
  - Because public works across the 6 datasets do not share a single unified foreign key across departments, an **Entity Resolution Engine** resolves records across datasets.
  - **Candidate Generation:** [`candidate_generator.py`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/entity_resolution/candidate_generator.py) blocks records by State + MP + Category to avoid combinatorial explosion.
  - **Exact & Fuzzy Matching:** [`exact_matcher.py`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/entity_resolution/exact_matcher.py), [`fuzzy_matcher.py`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/entity_resolution/fuzzy_matcher.py) computes Levenshtein/Jaro-Winkler description similarity, date proximity, and financial gap thresholds.
  - **Canonical Work ID Generation:** Creates unique, immutable keys (e.g., `CW_LS_00001`, `CW_RS_00042`) uniting a project's recommended proposal, sanction, payment disbursements, and completion into a single canonical lifecycle record.
  - **Total Resolved Canonical Works:**
    - **Lok Sabha:** 59,653 canonical works
    - **Rajya Sabha:** 15,848 canonical works
    - **Total Active Master:** **75,501 works**

---

### Stage 5: Dynamic 118-Feature Engineering & Anti-Leakage
- **Module:** [`ml-service/features/`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/features/)
- **What was done:**
  - Designed and generated **118 distinct features** grouped across 31 domains:
    1. **Entity Identifiers:** `canonical_work_id`, `mp_name`, `constituency`, `state`, `ida_agency`.
    2. **Financial Dynamics:** `sanctioned_amount`, `recommended_amount`, `expenditure_amount`, `financial_gap_rec_sanc`, `financial_utilization_ratio`, `sanction_cost_escalation`.
    3. **Temporal & Lifecycle Durations:** `days_rec_to_sanction`, `days_sanction_to_first_payment`, `days_since_sanction`, `estimated_project_velocity`.
    4. **Text Complexity:** `work_desc_char_count`, `work_desc_word_count`, `text_entropy`, `lexical_density`.
    5. **Aggregated Historical Risk Signals:**
       - **MP-level:** `mp_total_works`, `mp_avg_delay_days`, `mp_unspent_ratio`.
       - **Agency-level:** `agency_work_load`, `agency_completion_rate`, `agency_avg_sanction_cost`.
       - **Constituency-level:** `constituency_total_sanctioned`, `constituency_utilization_rate`.
  - **Strict Target Leakage Prevention:** [`leakage_checker.py`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/features/leakage_checker.py) audits features and classifies them into `AVAILABLE_AT_PREDICTION` vs `POST_PREDICTION`. Any feature containing post-completion information is excluded from baseline risk prediction models to prevent data leakage.

---

### Stage 6: Machine Learning Risk Prediction & Anomaly Detection
- **Module:** [`ml-service/prediction/`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/prediction/), [`ml-service/anomaly/`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/anomaly/)
- **What was done:**
  - **Delay Prediction:** Tree-based regression & classification models predicting probability of milestone delay and expected delay in days.
  - **Cost Overrun Risk:** Evaluates variance between sanction amounts, disbursed milestones, and final expenditure.
  - **Anomaly Detection Ensemble:**
    - **Isolation Forest:** Multi-dimensional outlier detection on financial-to-duration ratios.
    - **Local Outlier Factor (LOF):** Detects density deviations in vendor allocations.
    - **Statistical Z-Scores:** Flags extreme values in cost per square unit or cost vs. peer work categories.
  - **Explainability (XAI):** Feature importance weighting explaining *why* a project is flagged (e.g., high days-since-sanction without first payment, historical agency backlog).

---

### Stage 7: Unified FastAPI Backend Services
- **Module:** [`backend/main.py`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/backend/main.py), [`backend/dataset_aggregator.py`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/backend/dataset_aggregator.py)
- **Active Endpoints:**
  - `GET /api/v1/dashboard/overview`: Dynamic 6-dataset aggregated intelligence across both Parliaments.
  - `GET /api/v1/features/catalog`: Schema metadata, groups, and types for all 118 engineered features.
  - `GET /api/v1/features/works`: Paginated, filterable canonical project store (supports query by search, MP, state, category, parliament).
  - `GET /api/v1/features/works/{id}`: Single canonical project lookup returning all 118 feature values.
  - `GET /api/v1/features/aggregations`: Multi-level aggregations by MP, Constituency, State, and Agency.
  - `GET /api/v1/features/quality`: Quality and leakage reports.
  - `POST /api/v1/predict`: Live risk inference endpoint predicting risk score, risk probability, and recommended mitigations.
  - `GET /api/v1/entities/matches`: Entity resolution match confidence logs.

---

### Stage 8: Next.js Frontend Integration
- **Module:** `frontend/src/app/`, `frontend/src/components/`
- **What was connected:**
  - **Overview Page ([`/overview`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/frontend/src/app/overview/page.tsx)):**
    - High-level KPIs: Total Sanctioned Amount, Total Records (378k), Total Datasets (6/6), Total Features (118), Data Quality (87.8%).
    - Financial Lifecycle overview distinguishing MP limits from project disbursements.
    - Real-time dataset distribution and state representation charts.
  - **Projects Store ([`/projects`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/frontend/src/app/projects/page.tsx)):**
    - Features 75,501 real development projects with live search, state filtering, and parliament switching.
    - **Project Cards ([`ProjectCard.tsx`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/frontend/src/components/features/ProjectCard.tsx)):** Displays work description, sanction capital, MP, constituency, work status, delay risk badge, and entity resolution confidence.
    - **118-Feature Inspector Modal ([`FeatureDetailModal.tsx`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/frontend/src/components/features/FeatureDetailModal.tsx)):** Drill-down modal rendering all 118 calculated ML features per work item grouped by category.
  - **Live ML Control Center ([`MLControlCenter.tsx`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/frontend/src/components/MLControlCenter.tsx)):** Form to execute live risk predictions on the ML model.

---

## 3. Automated Test Verification
- All 21 test suites in `tests/` pass with **100% success rate**:
  - `test_entity_resolution.py` (8 tests)
  - `test_feature_engineering.py` (7 tests)
  - `test_loader.py` (3 tests)
  - `test_pipeline.py` (1 test)
  - `test_profiler.py` (2 tests)
- **Result:** `21 passed in 49.5s`
