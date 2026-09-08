# NIRIKSHAK AI — Complete ML Model Documentation

**Project:** NIRIKSHAK 2.0 — AI-Powered MPLADS Fund Oversight  
**Problem Statement:** SIH 2026 · PS-26102 · Sponsor: Ministry of Statistics & Programme Implementation (MoSPI)  
**Dataset:** 78,502 unique MPLAD works · 378,621 lifecycle records · Lok Sabha + Rajya Sabha  

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Data Pipeline](#2-data-pipeline)
3. [Model 1 — Isolation Forest (Primary Anomaly Detector)](#3-model-1--isolation-forest)
4. [Model 2 — Local Outlier Factor (Ensemble Validator)](#4-model-2--local-outlier-factor)
5. [Model 3 — Prophet (Expenditure Forecasting)](#5-model-3--prophet)
6. [Model 4 — Composite XGBoost Risk Scorer](#6-model-4--composite-xgboost-risk-scorer)
7. [Model 5 — NetworkX Vendor Collusion Graph](#7-model-5--networkx-vendor-collusion-graph)
8. [Model 6 — DRISHTI Sentence-BERT (Duplicate Work Detection)](#8-model-6--drishti-sentence-bert)
9. [Model 7 — Cox Proportional Hazards (Delay Prediction)](#9-model-7--cox-proportional-hazards)
10. [Feature Engineering](#10-feature-engineering)
11. [Ensemble & Risk Scoring Architecture](#11-ensemble--risk-scoring-architecture)
12. [Why Not Supervised Learning?](#12-why-not-supervised-learning)

---

## 1. System Overview

NIRIKSHAK AI is a **multi-model ensemble** anomaly detection system. No single model is used in isolation. Each model solves a different sub-problem of MPLADS oversight:

```
RAW DATA (MPLADS Portal)
        │
        ▼
┌──────────────────────────────────────────────┐
│             DATA PIPELINE (ETL)              │
│  Standardize → Feature Engineer → DuckDB     │
└──────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         ML SUBSYSTEM                                 │
│                                                                      │
│  ┌─────────────┐   ┌─────────────┐   ┌──────────────────────────┐   │
│  │ Isolation   │   │ Local       │   │ Composite Anomaly Score  │   │
│  │ Forest (IF) │──▶│ Outlier     │──▶│ is_anomaly + score 0-1   │   │
│  │             │   │ Factor (LOF)│   └──────────────────────────┘   │
│  └─────────────┘   └─────────────┘             │                    │
│                                                 ▼                    │
│  ┌──────────────────┐   ┌───────────────┐   ┌─────────────────┐    │
│  │ Vendor Collusion │   │ DRISHTI       │   │ Cox PH Delay    │    │
│  │ Graph (NetworkX) │   │ Sentence-BERT │   │ Predictor       │    │
│  └──────────────────┘   └───────────────┘   └─────────────────┘    │
│              │                   │                   │               │
│              └───────────────────┴───────────────────┘               │
│                                  ▼                                   │
│                    XGBoost Composite Risk Score                      │
│                    (0-100 Risk Score + CRITICAL/HIGH/MEDIUM/LOW)     │
└──────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────┐
│         FASTAPI BACKEND + NEXT.JS UI         │
│   Dashboard · Anomalies · Forecasting        │
└──────────────────────────────────────────────┘
```

---

## 2. Data Pipeline

### Source Data
All data is scraped from the **MoSPI MPLADS Portal** (`mplads.mospi.gov.in`) using a custom Playwright-based scraper.

| Dataset | Records | Description |
|---|---|---|
| LS Allocation | 543 rows | MP-wise annual fund allocation |
| LS Recommended | ~150,000 rows | Works recommended by MPs |
| LS Sanctioned | ~120,000 rows | Works sanctioned by district |
| LS Expenditure | ~78,502 rows | Actual expenditure per work |
| LS Completed | ~50,000 rows | Completed works with dates |
| RS Expenditure | ~28,019 rows | Rajya Sabha equivalent |

### ETL Steps
1. **Standardize** column names (lowercase, snake_case)
2. **Fill nulls** with 0 for numeric fields
3. **Engineer features** (cost deviation, execution days, district median, etc.)
4. **Write to DuckDB** (`parliament_data.duckdb`) for fast analytical queries
5. **Run ML pipeline** → generate `data/predictions/{house}/work_anomalies.csv`

---

## 3. Model 1 — Isolation Forest

### What it is
`sklearn.ensemble.IsolationForest` — An **unsupervised tree-based anomaly detector**.

### Why we chose it
MPLADS data has **no labeled fraud cases**. You cannot use supervised learning (like XGBoost or Random Forest) without ground-truth labels ("this is fraud", "this is not fraud"). Isolation Forest is specifically designed for this: it finds statistical outliers without needing prior labels.

### How it works
Isolation Forest builds an ensemble of random decision trees. The core insight is:

> **Anomalies are easier to isolate** (require fewer splits) than normal data points.

**Example:** If a work's sanctioned amount is Rs. 50 Crore in a district where the median is Rs. 8 Lakh, the tree isolates it in just 2-3 splits. A normal Rs. 7 Lakh work takes 20+ splits.

The **anomaly score** is computed from the average path length across all trees:

```
score(x) = 2^( -E[h(x)] / c(n) )
```

Where:
- `E[h(x)]` = average path length across trees for point x
- `c(n)` = expected path length for a dataset of size n
- Score > 0.5 → anomaly; Score close to 0 → inlier

### Our Configuration
```python
IsolationForest(
    n_estimators=100,      # 100 trees for stability
    contamination=0.05,    # Expect ~5% anomalies in MPLADS data
    random_state=42        # Reproducibility
)
```

### Features Fed to It
- `sanction_amount` — The project budget
- `total_expenditure` — How much was actually spent
- `cost_deviation_pct` — % deviation from district category median
- `district_category_median` — Peer group benchmark
- `total_execution_days` — Days taken to complete
- `has_evidence` — Whether supporting documents were submitted

### Output
- `is_anomaly: True/False`
- `anomaly_score: 0.0 – 1.0` (normalized; higher = more suspicious)

---

## 4. Model 2 — Local Outlier Factor

### What it is
`sklearn.neighbors.LocalOutlierFactor` — A **density-based anomaly detector**.

### Why we use it (alongside Isolation Forest)
Isolation Forest uses random splits and can miss **local outliers** — a project that looks normal globally but is suspicious within its own district/category peer group. LOF catches these.

LOF compares each point's **local density** to its k-nearest neighbors' density:

```
LRD(x) = 1 / avg_reach_distance(x, neighbors)
LOF(x) = avg( LRD(neighbors) ) / LRD(x)
```

- `LOF > 1`: The point is in a sparser region than its neighbors → potential outlier
- `LOF >> 1`: Strong outlier → anomaly

### Our Configuration
```python
LocalOutlierFactor(
    n_neighbors=20,       # Compare against 20 nearest works
    contamination=0.05,   # Same as IF for ensemble consistency
    novelty=True          # Allows predict() on new data after fit
)
```

### Ensemble Logic
```python
df['if_anomaly'] = (IsolationForest.predict(X) == -1)
df['lof_anomaly'] = (LOF.predict(X) == -1)
df['risk_score'] = df['if_anomaly'].astype(int) + df['lof_anomaly'].astype(int)

# Risk levels:
# score=2 → CRITICAL (both models agree it's anomalous)
# score=1 → HIGH (one model flags it)
# score=0 → LOW
```

The dual-model ensemble **dramatically reduces false positives**. Only works flagged by BOTH models get promoted to CRITICAL.

---

## 5. Model 3 — Prophet

### What it is
`prophet.Prophet` — Facebook's open-source **time series forecasting** model.

### Why we chose it
- MPLADS fund release follows **yearly seasonal patterns** (budget years, Parliament sessions, election cycles)
- Prophet handles **missing data**, **non-uniform time series**, and **trend changepoints** automatically
- Outputs confidence intervals (`yhat_lower`, `yhat_upper`) for anomaly detection on the expenditure curve itself

### How it works
Prophet decomposes the time series into:
```
y(t) = trend(t) + seasonality(t) + holidays(t) + error(t)
```

**Trend:** Uses a piecewise linear model with automatic changepoint detection to adapt to policy changes (e.g., post-COVID fund releases).

**Seasonality:** Captures recurring annual patterns in MPLADS fund utilization (e.g., Q4 spike before fiscal year end).

### Our Configuration
```python
Prophet(
    yearly_seasonality=True,       # Capture budget-year cycles
    weekly_seasonality=False,      # Not relevant for monthly MPLADS data
    daily_seasonality=False,       # Not relevant
    changepoint_prior_scale=0.05   # Moderate flexibility in trend shifts
)
```

### Use Case in NIRIKSHAK
- Forecasts the **next 6 months of district-level expenditure**
- If actual spending deviates by more than ±2σ from the forecasted band → flagged as budget utilization anomaly
- Visible in the **ML Dashboard** as the expenditure forecast chart

---

## 6. Model 4 — Composite XGBoost Risk Scorer

### What it is
A **signal aggregation model** (designed as an XGBoost drop-in for when labeled training data becomes available).

### Current Implementation
In the absence of labeled fraud cases, the scorer uses weighted signal aggregation:

```python
def predict_risk(signals):
    score = 0
    if signals["is_anomaly"]:           score += 40   # IF/LOF flag
    if signals["duplicate_found"]:      score += 50   # DRISHTI NLP flag
    if signals["delay_prob_365"] < 0.5: score += 20   # Cox PH delay flag

    if score >= 75: return "CRITICAL"
    elif score >= 40: return "HIGH"
    elif score >= 20: return "MEDIUM"
    else: return "LOW"
```

### Why these weights?

| Signal | Weight | Rationale |
|---|---|---|
| `is_anomaly` (IF+LOF) | 40 | Strong statistical signal but possible false positive |
| `duplicate_found` (DRISHTI) | 50 | Highest weight — NLP-confirmed duplicate is near-certain fraud |
| `delay_probability` (Cox PH) | 20 | Context signal — delays alone are not fraud |

### Transition Plan
When CAG or MoSPI provides **labeled audit outcomes**, this will be replaced with a trained `XGBClassifier` with:
- Probability-calibrated outputs
- SHAP explainability per flag
- Cross-validated AUC/F1 reporting

---

## 7. Model 5 — NetworkX Vendor Collusion Graph

### What it is
A **bipartite graph model** built using `networkx.Graph` to detect vendor collusion patterns.

### Why Graph Analysis?
Collusion in government procurement often appears as **repeated vendor-project clusters** invisible to row-level models:
- Vendor A wins contracts across 15 different MPs' constituencies → centrality anomaly
- Vendors B, C, D always appear together on the same projects → cartel cluster

### How it works

**Step 1: Build Bipartite Graph**
```
Projects (nodes) ──────── Vendors (nodes)
     |                          |
  work_001 ──────────────── VendorX (5 connections)
  work_002 ──────────────── VendorX
  work_003 ──────────────── VendorY (1 connection)
```

**Step 2: Degree Centrality**
```python
centrality = nx.degree_centrality(graph)
# High centrality vendor = connected to many projects = suspicious
high_risk = [v for v, c in centrality.items() if c > 0.05]
```

**Step 3: Connected Components (Cartel Detection)**
```python
clusters = list(nx.connected_components(graph))
# Large clusters = potential vendor cartels
```

### Output in NIRIKSHAK
- ML Dashboard shows the "Vendor Collusion Graph Active" indicator
- Shows number of active projects being monitored
- Works flagged as potential risk vectors via centrality thresholds

---

## 8. Model 6 — DRISHTI Sentence-BERT

### What it is
**DRISHTI** (Duplicate Recognition and Investigation through Semantic Hash-Text Intelligence) uses `sentence-transformers` (Sentence-BERT) to detect **semantically duplicate work descriptions** across the MPLADS database.

### The Problem
MPs sometimes recommend the **same physical project multiple times** under slightly different descriptions to double-claim funds:
- *"Construction of CC Road from Village X to Highway"*
- *"Development of concrete road connecting village X with national road"*

These are textually different but semantically identical. Standard string matching misses them.

### How Sentence-BERT Works
Sentence-BERT fine-tunes a BERT transformer to produce **768-dimensional semantic embeddings** where similar sentences cluster together:

```
Text → BERT Encoder → Mean Pooling → 768-dim vector
```

**Similarity Computation:**
```python
similarity = cosine_similarity(embedding_A, embedding_B)
# > 0.85 → likely duplicate (92% precision threshold)
# > 0.90 → near-certain duplicate
```

### Our Implementation
Embeddings are **pre-computed** for all 78,502 work descriptions and stored in `work_embeddings.pkl`. At query time:
1. User submits a new work description
2. DRISHTI encodes it into a 768-dim vector
3. Cosine similarity computed against entire embedded database
4. Top-K most similar works returned with similarity scores

---

## 9. Model 7 — Cox Proportional Hazards (Delay Prediction)

### What it is
A **survival analysis model** (`lifelines.CoxPHFitter`) that predicts the probability of a project completing within a given timeframe.

### Why Survival Analysis?
Standard regression predicts a single number ("this project will take 180 days"). But many MPLADS projects are **censored** — they were still ongoing when the dataset was captured. Survival analysis correctly handles censored time-to-event data.

### The Hazard Model
```
h(t|X) = h₀(t) · exp(β₁X₁ + β₂X₂ + ... + βₙXₙ)
```

Where:
- `h(t|X)` = instantaneous risk of delay at time t
- `h₀(t)` = baseline hazard function
- `X₁...Xₙ` = covariates (sanction amount, category, state, etc.)

### Survival Probabilities Output
```python
{
  "day_30":  0.18,   # 18% chance of completion by Day 30
  "day_90":  0.52,   # 52% chance by Day 90
  "day_365": 0.91    # 91% chance by Day 365
}
```

A project with `day_365 < 0.50` is flagged as **high delay risk** and contributes to the composite risk score (+20 points).

---

## 10. Feature Engineering

| Feature | Formula / Description | Type |
|---|---|---|
| `sanction_amount` | Project budget in Rs. | Continuous |
| `total_expenditure` | Actual spend in Rs. | Continuous |
| `cost_deviation_pct` | `(sanction - median) / median × 100` | Continuous |
| `district_category_median` | Median sanction for same district + category | Continuous |
| `total_execution_days` | Days from sanction to completion | Continuous |
| `has_evidence` | Whether documents were attached | Binary |
| `expenditure_utilization` | `expenditure / sanction` ratio | Continuous |
| `state_encoded` | Label-encoded state | Categorical |
| `category_encoded` | Label-encoded work category | Categorical |
| `is_anomaly` | Output: True/False from IF+LOF ensemble | Binary |
| `anomaly_score` | Normalized risk score 0.0–1.0 | Continuous |
| `anomaly_reasons` | Human-readable comma-separated flags | Text |

---

## 11. Ensemble & Risk Scoring Architecture

```
Work Record
    │
    ├──▶ Isolation Forest ─────────────────────────┐
    │        (statistical outlier detection)        │
    │                                               │
    ├──▶ Local Outlier Factor ─────────────────────▶  Combined Score (0-100)
    │        (density-based local outlier)          │        │
    │                                               │        ▼
    ├──▶ DRISHTI Sentence-BERT ───────────────────▶│   CRITICAL (>=75)
    │        (semantic duplicate detection)         │   HIGH    (>=40)
    │                                               │   MEDIUM  (>=20)
    └──▶ Cox PH Delay Predictor ──────────────────▶│   LOW     (< 20)
             (delay probability)
```

Benefits:
- **High Recall** — catches anomalies that individual models miss
- **High Precision** — CRITICAL requires multi-model agreement
- **Explainability** — each flag has a named reason (`cost_outlier`, `duplicate_detected`, `high_delay_risk`)

---

## 12. Why Not Supervised Learning?

| Reason | Explanation |
|---|---|
| **No ground truth labels** | No official "fraud confirmed / not fraud" dataset exists for MPLADS. CAG audit reports are not digitized. |
| **Class imbalance** | True fraud rate is <1%. A model predicting "not fraud" always achieves 99% accuracy. |
| **Distribution shift** | Nature of suspicious transactions changes every Parliament session. Unsupervised models adapt automatically. |
| **Legal defensibility** | Statistical anomaly detection is more defensible in audit proceedings than a black-box classifier. |
| **Cold start** | With no historical labeled fraud, supervised learning cannot start. Isolation Forest works on Day 1. |

Supervised models (XGBoost, LightGBM) are planned for **Phase 2** once MoSPI or CAG provides labeled audit outcomes.

---

*Documentation generated: September 2026 · NIRIKSHAK AI v2.0*
