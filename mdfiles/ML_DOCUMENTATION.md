# NIRIKSHAK-AI: Machine Learning Architecture, Training Methodology & Technical Specifications

**Document Version:** 1.0.0  
**Target Platform:** NIRIKSHAK-AI Smart Governance & Risk Intelligence Prototype (SIH 2026)  
**Dataset Scope:** 6 Datasets Across Lok Sabha & Rajya Sabha (378,621 lifecycle records, 75,501 unique development works)

---

## Executive Summary

NIRIKSHAK-AI is an automated risk intelligence platform designed to monitor fund utilization, identify execution delays, prevent budget leakage, and detect administrative anomalies across the Member of Parliament Local Area Development Scheme (**MPLADS**).

This technical document details:
1. **The current operational state of the ML subsystem.**
2. **The 118-feature engineering taxonomy.**
3. **The target leakage prevention framework.**
4. **The model training blueprint (Algorithms, Target Definitions, Train/Test Split, Hyperparameters).**
5. **The transition roadmap from heuristic inference to production Gradient Boosted & Ensemble inference.**

---

## 1. Machine Learning System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 1. INGESTION & STANDARDIZATION                              │
│   6 Standardized Datasets: Allocation, Calamity, Recommended, Sanctioned, Expenditure, Done │
│   Records: 299,229 (Lok Sabha) + 79,392 (Rajya Sabha) = 378,621 Total Rows                  │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            2. MULTI-FIELD ENTITY RESOLUTION                                 │
│   Candidate Blocking (State + MP + Category) ──> Fuzzy Distance (Levenshtein + Financial)   │
│   Outputs: 75,501 Canonical Work IDs (CW_LS_00001, CW_RS_00001)                             │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            3. DYNAMIC 118-FEATURE ENGINEERING                               │
│   31 Feature Domains: Financial Gaps, Velocity, Temporal Deltas, Text Complexity, History    │
│   Leakage Filtering: Separated into AVAILABLE_AT_PREDICTION vs POST_PREDICTION              │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                         4. PREDICTIVE MODELING & INFERENCE (CURRENT)                        │
│   A. Feature Store: Serves all 118 features dynamically for 75,501 works                    │
│   B. Current Endpoint: Rule-based Heuristic Scoring in /api/v1/predict                      │
│   C. Model Training Target: LightGBM / XGBoost / Random Forest Classifier & Regressor       │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Current State vs. Trained Model Reality

To ensure transparency and rigorous engineering standards, here is the exact audit of the ML subsystem:

| Component | Status | Implementation Details |
|---|---|---|
| **Data Ingestion & Discovery** |  **100% Operational** | Fully automated across all 6 raw CSVs in both houses. |
| **Data Cleaning & Standardization** |  **100% Operational** | Standardized headers, currency parsing, ISO dates. |
| **Data Profiling & Quality Scores** |  **100% Operational** | Missingness tiers, duplicate audits, quality score: **87.8%**. |
| **Entity Resolution Master** |  **100% Operational** | **75,501** resolved canonical works mapped end-to-end. |
| **118 Feature Matrix Calculation** |  **100% Operational** | Precomputed in `data/features/{parliament}/work_features.csv`. |
| **Feature Leakage Prevention** |  **100% Operational** | Audited in `feature_leakage_report.csv`. |
| **Active Prediction API (`/api/v1/predict`)** |  **Heuristic Active** | Uses parameterized heuristic weights based on elapsed days and cost. |
| **Trained Binary Model Artifacts (`.pkl`/`.joblib`)** |  **Pending Training** | Models in `ml-service/prediction/delay/` are structured stubs ready for fitting. |

---

## 3. The 118-Feature Engineering Taxonomy

The feature store extracts **118 continuous and categorical signals** per canonical project. These are organized into 31 distinct categories:

### A. Core Entity Identifiers (5 Features)
- `canonical_work_id`: Unique identifier across departments.
- `mp_name`, `constituency`, `state`: Geographic and political jurisdiction.
- `ida_agency`: Implementing District Authority agency assigned to execute the work.

### B. Financial Dynamics & Gaps (18 Features)
- `recommended_amount`: Capital proposed by the MP.
- `sanction_amount`: Capital administratively approved by District Authority.
- `expenditure_amount`: Total funds disbursed to date.
- `financial_gap_rec_sanc`: Discrepancy between proposal and approval (`recommended_amount - sanction_amount`).
- `financial_utilization_ratio`: Capital efficiency metric (`expenditure_amount / sanction_amount`).
- `sanction_cost_escalation`: Ratio of sanction cost compared to district peer category medians.

### C. Temporal & Lifecycle Milestones (22 Features)
- `days_rec_to_sanction`: Bureaucratic processing latency before administrative sanction.
- `days_since_sanction`: Calendar days elapsed since official administrative approval.
- `execution_duration_percentile`: Standardized duration rank compared to similar civil works.
- `duration_z_score`: Statistical deviation of project duration from the national mean.
- `duration_iqr_outlier_flag`: Flag indicating if duration exceeds the 75th percentile + 1.5 * IQR.

### D. Text & Linguistic Complexity (12 Features)
- `work_desc_char_count`, `work_desc_word_count`: Length of proposal scope.
- `text_entropy`: Information density of the work description.
- `lexical_density`: Ratio of content words to structural noise in government records.

### E. Historical & Relational Risk Aggregations (35 Features)
- **MP Historical Execution:**
  - `mp_total_works`: Volume of works recommended by this MP.
  - `mp_completion_rate`: Fraction of MP's works that have achieved physical completion.
  - `mp_avg_delay_days`: Historical average overrun for this representative.
- **Implementing Agency Operational Health:**
  - `agency_work_load`: Number of active concurrent projects assigned to this agency.
  - `agency_completion_rate`: Reliability score based on past projects completed within schedule.
  - `agency_cost_variance_ratio`: Tendency of this agency to exceed approved budgets.
- **Constituency & State Level Aggregates:**
  - `constituency_utilization_rate`: Macro fund absorption efficiency of the district.
  - `state_fund_utilization_percentile`: State performance relative to national median.

---

## 4. Feature Leakage Prevention Framework

A major challenge in public finance ML is **Target Leakage** (training a model on features that could only be known *after* the project is already delayed or completed).

To eliminate leakage, all 118 features are classified using [`leakage_checker.py`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/features/leakage_checker.py):

| Classification Tier | Count | Examples | Eligible for Training? |
|---|---|---|---|
| **`AVAILABLE_AT_PREDICTION`** | **82 Features** | `recommended_amount`, `sanction_amount`, `days_rec_to_sanction`, `ida_agency`, `mp_completion_rate`, `work_desc_word_count` |  **YES (Model Inputs)** |
| **`POST_PREDICTION`** | **36 Features** | `completion_date`, `completion_amount`, `final_expenditure_date`, `image_verified_flag` |  **EXCLUDED from Feature Matrix** |

> [!IMPORTANT]
> Any model trained on the NIRIKSHAK-AI platform must strictly restrict its input vector `X` to the 82 `AVAILABLE_AT_PREDICTION` features to guarantee valid real-world generalization.

---

## 5. Machine Learning Model Training Blueprint

Below is the concrete training pipeline designed for the **Milestone Delay & Abandonment Prediction** task:

### 5.1 Formulation of the Machine Learning Problem
- **Problem Type:** Multi-Class Classification & Continuous Regression.
- **Task A (Classification):** Predict **Project Risk Tier** (`LOW`, `MEDIUM`, `HIGH`).
- **Task B (Regression):** Predict **Expected Delay in Days** (`predicted_delay_days`).

### 5.2 Ground Truth Target Formulation
For completed projects:
$$\text{Actual Delay} = \text{Actual Completion Duration} - \text{Expected Category Benchmark Duration}$$
- If $\text{Actual Delay} \le 30\text{ days}$: **`LOW RISK`** (Class 0)
- If $30 < \text{Actual Delay} \le 180\text{ days}$: **`MEDIUM RISK`** (Class 1)
- If $\text{Actual Delay} > 180\text{ days}$ or project inactive for $> 365\text{ days}$: **`HIGH RISK`** (Class 2)

### 5.3 Model Architectures to Train
1. **LightGBM Classifier (Primary):**
   - Handles mixed continuous and categorical features with native support for high-cardinality categories (`ida_agency`, `constituency`).
   - Fast inference (< 5ms) suitable for real-time dashboard responsiveness.
2. **Random Forest Classifier (Baseline):**
   - Ensemble of 300 decision trees to provide robust benchmark performance.
3. **XGBoost Regressor (Delay Magnitude):**
   - Gradient boosted trees optimized using RMSE with Huber loss to resist outlier resilience.
4. **Isolation Forest (Anomaly Subsystem):**
   - Unsupervised outlier scoring detecting unprecedented disbursement patterns or ghost vendors.

### 5.4 Train/Validation/Test Split Strategy
- **Temporal Splitting (Recommended):**
  - Train set: Projects sanctioned between 2019 and 2022 (70%).
  - Validation set: Projects sanctioned in 2023 (15%).
  - Out-of-Time Test set: Projects sanctioned in 2024–2026 (15%).
- **Cross-Validation:** 5-Fold Stratified Group K-Fold grouped by `constituency` to prevent geographical data leakage.

### 5.5 Target Evaluation Metrics
- **Classification:** Macro F1-Score, ROC-AUC, Precision at Recall=80% (prioritizing high-risk detection without excessive false alarms).
- **Regression:** Mean Absolute Error (MAE), Root Mean Squared Error (RMSE).
- **Explainability:** SHAP (SHapley Additive exPlanations) values to output top 3 causal drivers per prediction.

---

## 6. Current Heuristic Model in `/api/v1/predict`

While the machine learning models are queued for fitting, the active prototype uses an interpretable, domain-calibrated heuristic scoring engine:

$$\text{Risk Score} = w_{\text{base}} + w_{\text{cost}} + w_{\text{duration}} + w_{\text{status}}$$

Where:
- $w_{\text{base}} = 0.15$
- $w_{\text{cost}} = +0.20$ if cost $> \text{₹20 Lakhs}$; $+0.10$ if cost $> \text{₹10 Lakhs}$
- $w_{\text{duration}} = +0.45$ if days elapsed $> 730$; $+0.25$ if days $> 365$; $+0.10$ if days $> 180$
- $w_{\text{status}} = 0.05$ (Completed); $0.95$ (Cancelled / Stalled)

This ensures the user interface, API contracts, and client-side visualization components function seamlessly before loading trained weights.

---

## 7. Step-by-Step Training Execution Plan

To train and deploy the real machine learning model into the NIRIKSHAK-AI prototype, the execution sequence is:

```bash
# Step 1: Execute Model Training Pipeline
python ml-service/prediction/delay/train.py --parliament all --algorithm lightgbm

# Step 2: Validate Model Metrics & Confusion Matrix
python ml-service/prediction/delay/evaluate.py

# Step 3: Serialize Model Artifact
# Saves model to ml-service/models/delay_classifier_v1.joblib

# Step 4: Hot-Swap Heuristic Endpoint in backend/main.py
# Replaces main.py's heuristic logic with joblib.load('ml-service/models/delay_classifier_v1.joblib').predict_proba()
```

---

## 8. Summary Table of Files & Artifacts

| File Path | Description |
|---|---|
| [`data/features/lok_sabha/work_features.csv`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/data/features/lok_sabha/work_features.csv) | 59,653 canonical works with all 118 engineered features. |
| [`data/features/rajya_sabha/work_features.csv`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/data/features/rajya_sabha/work_features.csv) | 15,848 canonical works with all 118 engineered features. |
| [`data/features/lok_sabha/feature_dictionary.csv`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/data/features/lok_sabha/feature_dictionary.csv) | Metadata, min, max, mean, and data types for every feature. |
| [`data/features/lok_sabha/feature_leakage_report.csv`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/data/features/lok_sabha/feature_leakage_report.csv) | Complete audit log classifying prediction vs. post-outcome features. |
| [`backend/main.py`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/backend/main.py#L210) | Live FastAPI prediction endpoint. |
| [`frontend/src/components/MLControlCenter.tsx`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/frontend/src/components/MLControlCenter.tsx) | Live interactive UI for testing prediction payloads. |
| [`ml-service/prediction/delay/train.py`](file:///c:/Users/ASUS/Desktop/nirikshak/NIRIKSHAK-AI-prototype/ml-service/prediction/delay/train.py) | Training pipeline entrypoint for fitting scikit-learn/LightGBM models. |
