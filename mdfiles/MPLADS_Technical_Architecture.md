# MPLADS AI/ML Platform — Production Implementation Architecture

*Derived line-by-line from `MPLADS_AIML_Blueprint.md` (33 sections, 6 datasets). This document converts that blueprint into a buildable engineering spec: files, services, APIs, schemas, models. No hardcoded thresholds/entities anywhere below — every "threshold" is either a config value, a learned baseline, or an official rule, and is labelled as such.*

---

# 1. Architecture Verdict

The blueprint is correct that this is **not one model** — it's five decision layers (Rule → Statistics → Unsupervised ML → NLP → Predictive ML) fused into one score. The engineering job is to make each layer:

- **independently swappable** (a model upgrade never touches the frontend or the other layers)
- **independently explainable** (every layer emits a reason string + evidence, not just a number)
- **independently degradable** (insufficient data → `insufficient_data`, never a crash or a fabricated score)

The spine that makes this possible is a **canonical feature table** (Part 16) that every layer reads from, and a **Dynamic Baseline Engine** (Part 12) that every statistical/ML comparison reads its "normal" from — nothing compares against a number written directly in Python.

```
CSV → Ingest → Entity Resolution → PostgreSQL (raw+resolved)
                                        ↓
                              Feature Engineering Job
                                        ↓
                              Feature Table (canonical)
                    ┌──────────┬──────────┬──────────┬──────────┐
                Rule Engine  Baseline  Anomaly ML   NLP Dup     Predictive
                    │        Engine    (IForest/    (Embeddings) Delay/Cost
                    │           │       LOF)            │            │
                    └──────────┴──────────┴──────────┴──────────┘
                                        ↓
                              Risk Fusion Engine
                                        ↓
                              Alert Engine → DB
                                        ↓
                              FastAPI  →  React
```

---

# 2. Complete Problem → Model Mapping

Legend: **R**=Rule, **S**=Statistics, **U**=Unsupervised ML, **N**=NLP, **P**=Predictive ML.

| Problem | Dataset(s) | Key Fields | Engineered Feature | Type | Model | Training? | API | Screen |
|---|---|---|---|---|---|---|---|---|
| Increasing/decreasing expenditure | Expenditure | Date, Amount | `monthly_spend_by_group` | S | Rolling mean/slope + Mann-Kendall | No | `/trends/financial` | Financial Analytics |
| Spending spike | Expenditure | Date, Amount | `rolling_zscore_7/30d` | S | EWMA + rolling z-score | No | `/trends/financial` | Financial Analytics |
| Structural spend change | Expenditure | Date, Amount | `spend_series` | S | PELT change-point | No | `/trends/financial` | Financial Analytics |
| Spending concentration | Expenditure | Vendor/Category, Amount | `herfindahl_index` | S | HHI / Gini | No | `/trends/financial` | Financial Analytics |
| Fund under/rapid utilisation | Allocation+Expenditure | Allocated, Spent | `utilisation_pct`, `utilisation_velocity` | S | Percentile vs peer baseline | No | `/mp/{id}/overview` | MP Dashboard |
| Cost estimate deviation | Recommended+Sanctioned | Amounts | `estimate_variance_pct` | S | Peer-group percentile | No | `/works/{id}/financials` | Work 360° |
| Cost overrun | Sanctioned+Expenditure | Amounts | `overrun_pct` | S+ML | Peer baseline; IsolationForest for multivariate | No (S) / Yes (ML) | `/works/{id}/financials` | Work 360° |
| Expenditure above/before sanction | Expenditure+Sanctioned | Dates, Amounts | `days_since_sanction`, `expenditure_to_sanction_pct` | R | Deterministic rule table | No | `/compliance/violations` | Compliance Dashboard |
| Recommendation→sanction delay | Recommended+Sanctioned | Dates | `sanction_delay_days` | S | Peer percentile (category×state×size) | No | `/trends/operational` | Operational Analytics |
| Pending/stagnating works | Sanctioned+Expenditure | Dates | `inter_transaction_gap_days`, `status_age_days` | S+U | Percentile + IsolationForest | Yes (U) | `/early-warning` | Early Warning Dashboard |
| Delay prediction (before it happens) | All lifecycle | category, size, velocity | delay feature vector | P | Gradient-boosted survival (see Part 4) | Yes | `/predictions/delay/{work_id}` | Work 360° |
| State/constituency trend & peer benchmark | Allocation+all | geography | `peer_percentile_*` | S | Percentile ranking, no clustering needed at MVP | No | `/trends/geographical` | Geographical Analytics |
| Vendor concentration | Expenditure | Vendor, Amount | `vendor_concentration_pct`, `vendor_work_count` | S | HHI + percentile | No | `/vendors/risk` | Vendor Intelligence |
| Vendor anomalous behaviour | Expenditure | Vendor features | vendor feature vector | U | IsolationForest (shared model, vendor-grain) | Yes | `/vendors/risk` | Vendor Intelligence |
| Vendor network concentration (production only) | Expenditure | Vendor↔MP↔IDA↔Work | graph edges | U (graph) | NetworkX community/centrality | No (algorithmic) | `/vendors/{id}/network` | Vendor Intelligence |
| Exact duplicate payment | Expenditure | WorkID,Vendor,Amount,Date | composite key match | R | Deterministic dedup rule | No | `/payments/duplicates` | Compliance Dashboard |
| Near-duplicate/repeated payment | Expenditure | same, date window | `amount_repeat_count`, `same_day_vendor_count` | S | Frequency analysis, contextual gate | No | `/payments/duplicates` | Compliance Dashboard |
| Duplicate work | Recommended/Sanctioned/Completed | Description + context | embedding + context match | N | Sentence-Transformers + ANN + contextual gate | No (pretrained) | `/works/duplicates` | Duplicate Work Detector |
| Multivariate transaction anomaly | Expenditure feature vector | many | `expenditure_anomaly_score` | U | IsolationForest (primary), LOF (secondary) | Yes | `/works/{id}/risk` | Work 360° |
| Financial vs physical mismatch | Expenditure+Completed | Amount, Status | `financial_physical_mismatch_flag` | R | Deterministic rule | No | `/compliance/violations` | Compliance Dashboard |
| Missing sanction/fields/invalid dates | Any | required fields | `data_quality_score` | R | Schema + rule validation (Great Expectations) | No | `/data-quality` | Data Quality Dashboard |
| Composite risk / early warning | All layers | risk components | `composite_risk_score` | Fusion | Weighted sum (Phase 1) → calibrated/learned weights (Phase 3+) | Phased | `/alerts` | Early Warning Dashboard |
| Investigation Q&A / explanation | All | structured findings | context for LLM | GenAI | RAG over structured DB, function calling | No (uses frozen LLM) | `/assistant/ask` | any screen (side panel) |

---

# 3. Complete Data Pipeline

```
raw CSV (6 files)
  │
  ▼ [ingestion/loaders/*.py]           — pandas/Polars read, encoding detection
Schema Detection & Validation           — Great Expectations suite per dataset
  │
  ▼ [ingestion/cleaning/*.py]
Cleaning                                — currency parse, date parse, whitespace, header normalisation
  │
  ▼ [ingestion/entity_resolution/*.py]
Entity Resolution                       — work_id parser, mp_alias, vendor_alias, geography normalisation
  │
  ▼
Deduplication (row-level ingestion dupes only — NOT the payment-pattern detector)
  │
  ▼
Integration / Load                      — INSERT/UPSERT into PostgreSQL "resolved" tables, quarantine bad rows
  │
  ▼ [features/jobs/*.py]
Feature Store (canonical `features_work`, `features_transaction`, `features_vendor`, `features_mp` tables)
  │
  ├─► Rule Engine (compliance/rules/*.py) ─────────────┐
  ├─► Baseline Engine (baselines/*.py) ─────────────────┤
  ├─► Anomaly ML (ml/anomaly/*.py) ──────────────────────┤
  ├─► NLP Duplicate Engine (ml/nlp/*.py) ─────────────────┤──► Risk Fusion (risk/fusion.py)
  └─► Predictive ML (ml/prediction/*.py) ─────────────────┘
                                                           │
                                                           ▼
                                                    Alert Engine (alerts/*.py)
                                                           │
                                                           ▼
                                              PostgreSQL (scores, alerts, audit)
                                                           │
                                                           ▼
                                              FastAPI (api/v1/*) → React
```

Each stage: input = previous stage's DB table or file; output = a DB table or Parquet cache; failure handling = row-level quarantine table with a `reason` column (never silent drop, per blueprint §3 entity-resolution note); logging = structured JSON logs per pipeline run with a `run_id` that every downstream row references for traceability.

**Incremental processing (blueprint's core non-negotiable):** every ingestion run writes a `pipeline_run` record; every raw row carries `source_file_hash + row_hash`. On a new CSV, only rows whose `row_hash` is new/changed are pushed downstream — this determines the *affected Work IDs*, and only those Work IDs get their features, rules, anomaly scores, and risk fused recomputed (Part 15). Vendor- and category-level aggregates that include an affected row are recomputed for that vendor/category only, not globally.

---

# 4. Financial Trend Engine

**Recommended model → why → when → data need → limitation → fallback**

| Method | Recommended for | Why | Data need | Limitation | Fallback |
|---|---|---|---|---|---|
| Rolling mean/median (window from config) | Baseline smoothing for all series | Simple, transparent, no training | Any length | Lags real change | n/a — always first layer |
| Linear regression slope | "Is spend trending up/down" | One number, easy to explain in an alert sentence | ≥ 6–8 periods | Assumes linearity | Mann-Kendall |
| Mann-Kendall test | Confirming a trend is statistically real, not noise | Non-parametric, robust to outliers, standard in monitoring | ≥ 8 periods | Doesn't say magnitude | none needed, pairs with slope |
| EWMA / rolling z-score | Spending spikes | Reacts faster than plain rolling mean, still fully explainable | ≥ 10–15 periods | Sensitive to window choice (config, not hardcoded) | plain rolling z-score |
| PELT change-point detection | "Did the spending *regime* change" (structural shift) | Finds the point itself, not just direction — matches blueprint's "structurally changed" requirement | ≥ 20–30 points ideally | Needs enough history per group | CUSUM (simpler, faster, less precise) |
| STL / seasonal decomposition | Fiscal-year-end clustering | MPLADS spending is plausibly seasonal (year-end rush) | ≥ 2 fiscal years | Needs multi-year data — **explicitly flagged as "not yet available" per blueprint §29** until production history accumulates | skip seasonal adjustment, note it in the metadata |
| Prophet / ARIMA / SARIMA | **Not recommended at this stage** | Blueprint explicitly cautions against techniques needing volume the current data doesn't have; forecasting isn't a stated requirement — the ask is *classification* (increasing/decreasing/spiking), not point forecasts | High | Overkill, and unexplainable to auditors | n/a |
| XGBoost / LightGBM / TFT | **Not for trend detection.** Reserved for Delay/Cost *prediction* (Part on Operational Engine) where there's a genuine supervised target (did it get delayed) | Trend detection here is a statistics problem (blueprint §28 explicitly puts trend detection in the "Statistical: best fit" column), not a prediction problem | n/a | n/a | n/a |

**Which parts should NOT use ML:** trend direction, spikes, seasonal patterns, utilisation percentage — all classical statistics per the blueprint's own §28 table. **Which parts genuinely benefit from ML:** the multivariate anomaly score that *combines* an amount deviation with timing + vendor + category signals at once (that's a job no single statistic can do) — this is Part 7.

## Module design (financial trend, per group = MP / state / category / national)

| Step | Library | Function | Input schema | Output schema | DB table | Config |
|---|---|---|---|---|---|---|
| Aggregation | Polars/Pandas | `aggregate_spend(group_by, period)` | `features_transaction` | `(group_key, period, total_spend)` | `agg_spend_timeseries` | `trend.period` (month/quarter, config) |
| Time bucketing | Pandas `resample` | `bucket_periods()` | as above | same, gap-filled with 0 | same | `trend.min_periods` |
| Baseline | see Part 12 | `get_baseline(group_key)` | group id | median/IQR object | `baselines` | `baseline.window`, `baseline.hierarchy` |
| Trend model | `pymannkendall`, `scipy.stats.linregress` | `compute_trend(series)` | time series | `{slope, p_value, direction}` | `trend_scores` | `trend.significance_alpha` (config, e.g. 0.05) |
| Change-point | `ruptures` (PELT) | `detect_changepoints(series)` | time series | list of change indices + magnitude | `changepoints` | `ruptures.penalty` (config, calibrated not hardcoded) |
| Trend classification | Python | `classify(slope, cp, zscore)` → increasing/decreasing/stable/accelerating/spiking/structural-shift | trend outputs | label + confidence | `trend_scores` | classification rules live in a YAML decision table, not `if` chains |
| Risk contribution | `risk/fusion.py` | `financial_trend_risk()` | trend label + magnitude | 0–1 risk contribution | `risk_components` | weight from `risk_weights` config table |
| API | FastAPI | `GET /api/v1/trends/financial` | filters | JSON | reads `trend_scores` | — |
| Frontend | React/Recharts | `FinancialTrendChart` | API JSON | chart | — | — |

**How "increasing/decreasing/stable/accelerating/spiking/structural-shift" is decided without hardcoded thresholds:** direction comes from the Mann-Kendall sign + significance (`p < config.alpha`); "accelerating/decelerating" compares the slope of the last N periods against the slope of the prior N (both N's are config, defaulted from the baseline window); "spike" = z-score of the latest point against its own rolling distribution exceeding a **percentile calibrated from the group's own history** (not a fixed number); "structural change" = a PELT change-point was found in the last period, with penalty calibrated via the standard BIC-style rule PELT uses internally, exposed as a tunable config, not a magic constant in code.

---

# 5. Operational Trend Engine

| Signal | Type | Model |
|---|---|---|
| Sanction delay | S | Peer-percentile (category×state×size) — deterministic where an *official* processing-time rule exists (R) |
| Pending works count, increasing pending works | S | Rolling count + Mann-Kendall trend |
| Completion-rate decline | S | Rolling ratio + trend |
| Project duration | S | Peer-percentile, same hierarchy as Part 12 |
| Inactivity gaps / status ageing | S+U | Percentile flag first; feed into IsolationForest as one of the multivariate features |
| Workflow bottleneck (which stage delays most) | S | Stage-by-stage delay decomposition, no ML needed — it's a groupby |

**Delay-prediction model comparison** (predicting *before* a work becomes late):

| Model | Verdict | Why |
|---|---|---|
| Logistic Regression | Good MVP baseline | Fast, fully explainable coefficients, works with the modest feature set available (category, state, size, sanction delay, early expenditure velocity) |
| Random Forest / XGBoost / LightGBM | **Recommended production model** | Handles non-linear interactions (e.g., "small size + slow first-transaction" is worse than either alone), gives feature importances/SHAP for explainability, standard for tabular data at this scale |
| Survival Analysis / Cox PH | **Recommended alongside GBM, not instead of it** | The real question is "time-to-completion," not just a binary label — Cox PH / Random Survival Forest model the *hazard* of delay over time, which naturally supports "this work's on-time-completion probability is dropping" rather than a single yes/no, matching the blueprint's "stagnation alert before a hard deadline" requirement (§12) |
| Gradient Boosting Survival (e.g. `scikit-survival` GBSA) | Best of both, but adds complexity | Combines GBM's interaction-handling with survival's time-aware output |
| Temporal Fusion Transformer / deep sequence models | **Not recommended** | Needs far more history and per-work sequential granularity than production MPLADS volume will realistically offer; unexplainable to auditors; classic case of DL for its own sake (blueprint Part 36 principle) |

**Final recommendation:** ship Logistic Regression at MVP (zero training-data risk, fully interpretable), upgrade to **Random Survival Forest** once ≥ a few hundred completed works with known outcomes exist per category (config: `prediction.min_training_samples`). Output is not "delayed: yes/no" but **P(on-time completion | current trajectory)**, recomputed as new expenditure events arrive — this is exactly how the blueprint's Example 2 (§27) works: flagged *before* the category's median duration is even reached, because the survival curve is already dropping.

**If insufficient data:** return `insufficient_data` and fall back to the pure statistical percentile rule (duration > 90th percentile of peer group) — this always works because it needs no labels.

---

# 6. Geographical Trend Engine

```
State analytics → Constituency analytics → Category×geography → Peer groups → Spatial concentration → Geo anomaly → Geo risk
```

| Technique | Use it? | Why |
|---|---|---|
| Percentile ranking (state/constituency vs. national) | **Yes — primary method** | Directly answers "is this state's utilisation/delay/cost unusual" with zero training and full explainability |
| GeoPandas | Yes, for the map layer only | Needed to join state/constituency boundary shapes for the choropleth, not for analytics |
| DBSCAN/HDBSCAN on lat/long | **No** | MPLADS doesn't have point-coordinates of works — constituency/state are already the meaningful spatial unit; clustering points that don't exist is manufactured complexity |
| Moran's I / Local Moran's I / Getis-Ord Gi* | **No at MVP, optional in production only if constituency-adjacency data is added** | These need a spatial-adjacency matrix (which constituencies border which) that isn't in the current datasets; they'd answer "is this a hotspot *cluster* of neighbours," which is a nice-to-have, not a stated requirement |
| Graph-based (MP↔state↔category) | Only for the Vendor Intelligence engine (Part 7), not geography | Geography is a strict hierarchy, not a network |

**Frontend rendering without hardcoding geography:** the map component (`GeoRiskMap.tsx`) receives `GET /api/v1/trends/geographical?level=state` returning an array of `{geo_id, geo_name, metric_value, percentile, geometry_ref}` — `geo_id`s are **database rows** (a `geography` table populated from the ingested data, not a hardcoded state list), and the frontend joins `geometry_ref` to a static (India-standard, not MPLADS-specific) boundary GeoJSON purely for rendering shape, never for values.

---

# 7. Vendor Intelligence Engine

**Features (all computed in `features/jobs/vendor_features.py`, sourced from Expenditure):**
`vendor_transaction_count`, `vendor_total_value`, `vendor_work_count`, `vendor_constituency_count`, `vendor_state_count`, `vendor_concentration_pct` (this vendor's share of its category/state's total spend), `vendor_amount_cv` (coefficient of variation of amounts — flags a vendor with suspiciously uniform amounts), `same_day_multi_work_count`, `vendor_dependency` (share of a *constituency's* spend going to this one vendor — the inverse view).

| Approach | Hackathon (MVP) | Production |
|---|---|---|
| Statistical (concentration ratio, percentile) | **Yes — primary, ships first** | Yes, always the base layer |
| Isolation Forest on vendor feature vector | Yes, reuse the same IsolationForest artifact/training code as Part 7 anomaly engine, just a different feature set | Yes |
| LOF | Optional, only if IsolationForest under-performs in eval | Optional |
| Clustering (natural vendor-size peer groups) | No | Optional — KMeans/HDBSCAN to auto-derive "small/medium/large vendor" tiers instead of a hand-picked bucket |
| NetworkX (MP–vendor–IDA–work graph) | **No** — nice demo but not needed to answer the blueprint's stated vendor questions | **Yes** — build once volume justifies it; centrality/community-detection surfaces concentration patterns invisible in tables (blueprint §30 explicitly lists this as a *future* enhancement, not MVP) |
| Neo4j | No | Only if the NetworkX in-memory graph becomes too large for ad-hoc queries; until then, PostgreSQL recursive CTEs + NetworkX in a batch job are sufficient |
| GraphSAGE / GNN | **No, ever, at this project's scale** | Explicitly over-engineering per blueprint Part 36 principle — MPLADS vendor graphs are small enough (thousands of nodes) that classical graph algorithms fully answer the concentration/community questions without a trained embedding model |

---

# 8. Anomaly Detection Architecture (production-ready, not "just Isolation Forest")

**Primary model: Isolation Forest.** **Secondary/cross-check: LOF** (better for anomalies that are only unusual *relative to a nearby cluster*, per blueprint §8). One-Class SVM, DBSCAN-as-anomaly, and Autoencoders/VAE are **not recommended**: One-Class SVM scales poorly and needs careful kernel tuning for no accuracy gain over IsolationForest here; DBSCAN-as-anomaly is redundant with LOF; Autoencoders/VAE need far more rows than MPLADS will realistically produce per peer-group to learn a reliable reconstruction manifold, and they're materially less explainable than IsolationForest's per-feature-deviation story — deep anomaly detection is exactly the kind of complexity Part 36 says to avoid.

**Answers to the ten required questions:**

1. **What to use initially:** IsolationForest, unsupervised, no labels needed — this is precisely why it's the right first model (blueprint §19: "Statistics need no labels" applies equally here since IsolationForest requires none either).
2. **How to train it:** one model per feature-schema version, trained on the full current `features_transaction` table (or `features_work`/`features_vendor` for those grains), retrained on a schedule (config: `ml.anomaly.retrain_cron`) or triggered when drift is detected (#9 below).
3. **Features in:** the numeric engineered features from Part on Financial Trend Engine + Cost Overrun (amount z-score, amount percentile, expenditure/sanction ratio, vendor concentration, inactivity gap, duration percentile, transaction frequency) — **never** raw free text (that's the NLP engine's job) and never unresolved categorical strings.
4. **Categorical variables:** target/frequency-encode (category, state, IDA) computed from the training set itself and stored as part of the model artifact's preprocessing pipeline (a scikit-learn `ColumnTransformer`), never one-hot on high-cardinality vendor/MP names.
5. **Missing values:** median-impute per peer group (using the same Dynamic Baseline hierarchy as Part 12) and add a `was_missing` boolean flag feature — missingness itself can be a compliance signal (blueprint's own "missing field" rule), so it's preserved, not erased.
6. **Scale features:** yes — `RobustScaler` (median/IQR based), not `StandardScaler`, because financial data is heavy-tailed and a few genuine large transactions shouldn't compress the rest of the distribution.
7. **Contamination selection:** **not** a hardcoded `0.05`. Set from config default (`ml.anomaly.contamination_default`), but recalibrated per retrain using the **elbow of the anomaly-score distribution** or against the **reviewer-confirmed false-positive rate** once feedback exists (Phase 2+ of Risk Fusion, Part 13) — stored per model version, so it's reproducible.
8. **Retraining:** scheduled (config cron) **and** event-triggered by drift detection; every retrain produces a new versioned artifact (`isolation_forest_v{n}`), never overwrites the serving model until it passes the evaluation gate in the MLOps pipeline (Part 19).
9. **Drift detection:** Evidently AI computes population-stability / feature-drift reports comparing the current scoring batch's feature distribution against the training-time distribution; a drift score beyond config threshold triggers a retrain job and an ops alert (not a data alert).
10. **False-positive control:** (a) IsolationForest score is never shown alone — it's one component in Risk Fusion (Part 13), so a moderate anomaly score alone rarely reaches "High"; (b) the human-review outcome (`review_outcomes` table) is tracked as a first-class metric and used to recalibrate contamination and fusion weights; (c) multi-signal gating — the blueprint's own principle that convergent signals should raise priority faster than one strong signal (§9) is implemented directly in the fusion formula (Part 13).

---

# 9. Work/NLP Duplicate Detection

```
Work Description (Recommended/Sanctioned/Completed)
  → Cleaning (lowercase, strip boilerplate/punctuation)
  → Normalization (expand common Indian-govt abbreviations: CC road, PWD, etc. — config-driven abbreviation dictionary, not hardcoded in logic)
  → Embedding (Sentence-Transformers)
  → Vector DB (pgvector)
  → ANN search (top-k candidates)
  → Candidate retrieval
  → Contextual filter (constituency, category, amount tolerance band, date proximity)
  → Similarity score (cosine)
  → Duplicate probability (calibrated, see below)
  → Human review queue
```

**Embedding model recommendation:** `paraphrase-multilingual-MiniLM-L12-v2` (Sentence-Transformers) as the **primary** model — MPLADS descriptions plausibly mix English and transliterated/Hindi terms across states, and this multilingual model handles both without maintaining two pipelines. `all-MiniLM-L6-v2` (English-only, smaller/faster) is an acceptable **fallback** if production text turns out to be reliably English-only, to save inference cost. Larger models (BGE-large, E5-large) are **not** recommended at this scale — descriptions are short (one to two sentences), so a compact model captures the signal fine, and a bigger model mainly adds latency/infra cost, not accuracy, for short-text government boilerplate.

**Vector DB choice: pgvector — not FAISS/Qdrant/Weaviate/Milvus.** Why: everything else in this platform already lives in PostgreSQL (works, transactions, features, risk scores); pgvector lets a duplicate-candidate query join directly against `work_id`, `constituency_id`, `sanctioned_amount` in **one SQL statement** instead of round-tripping between a separate vector service and Postgres. At MPLADS's realistic production scale (tens of thousands, not tens of millions, of work descriptions), pgvector's IVFFlat/HNSW index is entirely sufficient — a dedicated vector database (Qdrant/Milvus) only earns its operational cost at a scale this project won't reach; FAISS would work but has no persistence/joins layer of its own, meaning you'd rebuild the Postgres-join logic anyway.

**No hardcoded similarity threshold — calibration:** ship with a config default (`nlp.duplicate.similarity_prior`, e.g. 0.80, explicitly labelled as a *starting prior*, not a rule). As auditors confirm/reject candidates in the review queue (`review_outcomes`), fit a simple logistic regression of `confirmed_duplicate ~ similarity + context_match_count` on the accumulating labels; once enough labelled pairs exist (config: `nlp.duplicate.min_labels_for_calibration`), the **operating threshold becomes the similarity value that hits the target precision/recall from that fitted curve**, stored as a versioned "calibration" record, re-fit periodically. Until that data exists, the contextual gate (constituency + category + amount tolerance + date proximity, all *also* config-driven, not hardcoded) does the false-positive control.

---

# 10. Duplicate Payment Detection

| Layer | Method | Type |
|---|---|---|
| Exact duplicate (WorkID+Vendor+Amount+Date identical) | Deterministic composite-key match | R — safe to auto-flag for a de-dup review, per blueprint §11 |
| Near duplicate (same WorkID+Vendor+Amount, date within N days) | Deterministic window rule, N from config | R |
| Repeated same-amount, different Work IDs | Frequency count + **contextual validation**, never risk-scored from count alone | S |
| Same-day same-vendor multi-transaction | Frequency aggregation | S |

**Avoiding false positives on legitimate repeated government payments (the blueprint's explicit ₹36,159-repeat example, §11):** never assign risk from repetition count alone. Contextual validation checks, computed as features and passed to Risk Fusion rather than a raw count: (a) are the payments against *distinct* sanctioned works (legitimate) vs. the same work twice (data issue — this alone becomes a High rule violation, separate from the "pattern" signal); (b) does a **rate-card baseline** exist for this category/unit (if the same amount recurs across many *different* vendors too, it's a standard rate, not vendor-specific behaviour — computed via the Dynamic Baseline Engine, Part 12); (c) is the payment-status workflow consistent (each instalment separately approved). Only when the pattern cannot be explained by a standard-rate baseline **and** coincides with another independent risk signal does it climb above Medium in the fused score — this directly encodes the blueprint's "contextual analysis, not automatic duplicate" instruction.

---

# 11. Cost Overrun Engine

```
Recommended Amount → Sanctioned Amount → cumulative (ongoing) / final (completed) Expenditure
```

- `estimate_variance_pct = (Sanctioned − Recommended) / Recommended × 100`
- `overrun_pct = (Expenditure − Sanctioned) / Sanctioned × 100` — **cumulative** for ongoing works, **final disbursed** for completed works, computed and *labelled* separately per blueprint §14 (never compared on the same axis without that label).

**Model for Normal / Significant / High-risk tiers — no fixed "10% = bad":** the tier boundary is the **peer group's own IQR fence and 90th percentile**, from the Dynamic Baseline Engine (Part 12), segmented by category × project-size bucket (and state/IDA if the group has enough observations). Concretely: `Normal` = within the peer group's IQR; `Significant deviation` = beyond the peer group's 90th percentile, single signal; `High-risk overrun` = beyond the 90th percentile **and** co-occurring with another independent risk component (vendor concentration, missing evidence, unusual timing) — this three-tier logic is the same convergent-signal principle used everywhere else, implemented as a lookup against the versioned baseline object, never a Python literal. The only place a fixed number is permitted is an **official government-mandated overrun ceiling**, if one exists in the actual scheme rules — and that must be tagged `source: official_rule` in the config, distinct from every learned baseline.

---

# 12. Dynamic Baseline / "Established Norms" Engine

This is the module every S/U/N layer above calls into — it must exist before anything else does meaningful comparisons.

**Hierarchy (fallback chain, exactly per the blueprint's own example):**

```
Category × State × Project-Size-Bucket
   ↓ (if group n < config.baseline.min_group_size)
Category × State
   ↓ (if still insufficient)
Category
   ↓ (if still insufficient)
National
```

`min_group_size` (config, e.g. 20) is the only "magic number" in this engine, and it's explicitly a **statistical sample-size floor**, not a business threshold — it governs whether a median is trustworthy, not whether an amount is "too high."

| Question | Design |
|---|---|
| How generated | Batch job (`baselines/compute_baselines.py`) computes median, IQR, 10th/25th/75th/90th/95th percentiles per group per metric (duration, cost variance, overrun %, vendor concentration, sanction delay, etc.) |
| How often updated | Scheduled (config: `baseline.recompute_cron`, e.g. quarterly, matching the blueprint's own recommendation §13) |
| Versioning | Every computation writes a new row to `baselines` with `baseline_version`, `computed_at`, `group_key`, `metric`, `n_obs`, percentile values — never overwritten, only superseded; every alert stores the `baseline_version` it was compared against |
| Old data handling | Rolling window (config: `baseline.lookback_periods`) so baselines reflect *current* normal, not all-time history — construction costs drift, per blueprint §13 |
| New data effect | Next scheduled run naturally incorporates it; no manual step |
| Sparse groups | Fallback hierarchy above |
| Insufficient group | `n_obs < min_group_size` → automatically falls back one level, logged in the baseline record as `fallback_level` so an alert can honestly say "compared against the State-level baseline (Category baseline had insufficient data)" |
| Baseline drift | Evidently AI (or a simple KS-test) compares consecutive `baseline_version`s' distributions; a large shift is logged as an ops event, not silently swallowed |

---

# 13. Compliance Engine

Three sub-engines, one contract:

| Engine | Examples | Input | Output contract |
|---|---|---|---|
| Rule Engine | Expenditure before sanction, expenditure without work, invalid dates, missing fields | raw + resolved fields | `{rule_id, passed: bool, severity, evidence}` |
| Statistical Engine | Abnormal delay/cost/vendor concentration | feature table + baseline | `{metric, value, peer_baseline_version, percentile, flagged: bool}` |
| ML/NLP/Predictive Engine | Multivariate anomaly, duplicate-work probability, predicted delay | feature table + model | `{model_name, model_version, score, top_contributing_features, insufficient_data: bool}` |

All three write into a common `signal` shape and are unioned into `risk_components` — this is the contract that lets Risk Fusion (Part 14) treat a deterministic rule and a gradient-boosted prediction identically at the fusion layer, while each remains independently explainable at its own layer.

```
Rule Engine + Statistical Engine + ML Engine + NLP Engine + Predictive Engine
                              ↓  (all emit the {signal} contract above)
                        Risk Fusion Engine
                              ↓
                        Alert Engine
```

---

# 14. Risk Fusion Engine

**Critical evaluation of the blueprint's proposed component list (Cost/Payment/Vendor/Delay/Duplicate/Compliance/Evidence Risk):** it's the right decomposition — each maps to an independently-explainable engine above — but a **flat weighted sum from day one is wrong** because there are no labels yet to justify any particular weight. The blueprint's own §19/§23 guidance (start unsupervised, add feedback, only then supervise) must govern the fusion layer too, not just individual detectors.

| Phase | Method | Why |
|---|---|---|
| **Phase 1** | Weighted sum of normalized (0–1) component scores, weights **set as reviewable config**, not learned | No labels exist yet; a transparent, auditable formula an SIH judge or a real auditor can verify by hand beats an opaque black box with fabricated confidence |
| **Phase 2** | Same formula, but `review_outcomes` (confirmed/dismissed) start accumulating | Human-in-the-loop feedback collection begins; no model change yet, just data collection |
| **Phase 3** | Weak-label risk model: use accumulated reviewer outcomes as noisy labels for a **calibrated logistic regression** over the same component scores | Logistic regression is chosen (not XGBoost) specifically because its coefficients ARE the new weights — the transition from Phase 1 to Phase 3 is legible ("the manually-set weights are now replaced by fitted ones"), and probabilities are naturally calibrated via `CalibratedClassifierCV` |
| **Phase 4** | Once weak-label volume is large and diverse enough (config: `risk.fusion.min_labels_for_gbm`), upgrade to XGBoost/LightGBM stacking over the component scores for non-linear interactions (e.g., cost+delay together is worse than either alone) | Only justified once there's enough signal to actually fit interactions without overfitting to a handful of reviewer clicks |
| **Phase 5** | Continuous recalibration: scheduled refit (same cadence as baseline recompute), `CalibratedClassifierCV`/Platt scaling kept current, model version stored against every historical alert for audit | Prevents the fusion model from becoming stale as `review_outcomes` grow and as the underlying detectors get retrained |

**Not recommended:** Bayesian risk fusion and full stacking ensembles from day one — both need either priors or held-out data this project doesn't have yet; they're Phase-4/5 upgrades at best, never the starting point.

---

# 15. Early Warning Engine

```
New CSV
  ↓ hash-diff against last ingested file → changed/new rows only
Identify affected Work IDs (+ affected Vendor IDs, MP IDs via the same rows)
  ↓
Recalculate only affected rows' features (features/jobs/*.py, scoped by work_id IN (...))
  ↓
Run compliance rules (scoped to affected Work IDs)
  ↓
Run anomaly model *inference* (no retraining) on affected feature vectors
  ↓
Run predictive models *inference* on affected works
  ↓
Update risk (Risk Fusion, scoped)
  ↓
Compare new composite score vs. previous stored score for that Work ID
  ↓
If severity band changed (e.g. Medium→High) → generate alert
  ↓
Store alert (`alerts` table) with full component breakdown + baseline/model versions used
  ↓
Notify frontend (poll `/alerts?since=` or a lightweight WebSocket/SSE channel)
```

**Avoiding full-database recompute:** the `row_hash` + affected-Work-ID scoping above is the mechanism — every job in the pipeline accepts a `work_id_filter` parameter; the nightly/triggered run only ever touches the delta. Vendor/category aggregates are the one exception that must recompute at the *group* level (not per-row) when any member row changes, but that's still a small, bounded group, not the whole table.

**Orchestration choice:**

| Stack | SIH Prototype | Production |
|---|---|---|
| Celery + Redis | **Yes — recommended for both** | **Yes**, remains sufficient — MPLADS ingestion is batch/periodic (new CSV drops), not high-frequency streaming, so Kafka's throughput guarantees solve a problem this project doesn't have |
| Kafka / RabbitMQ | No | Only if the platform later moves to true per-transaction streaming ingestion (blueprint §30 lists this as a *future* enhancement, not now) |
| Airflow / Prefect / Dagster | No at MVP (cron+Celery is enough for ~6 pipeline stages) | **Prefect** recommended once the pipeline has enough stages/branching to need retries, backfills, and a UI for pipeline observability — lighter operational footprint than Airflow for a team this size |
| Cron | Fine for baseline recompute + scheduled retrains only | Same, wrapped by Prefect's scheduler instead of raw cron once adopted |

---

# 16. Feature Engineering Architecture (Feature Store)

**Choice: database feature tables (PostgreSQL), not Feast.** Why: Feast earns its complexity when you need an *online* low-latency feature store serving a real-time model at request time; every model here is scored in a **batch/incremental job** and read at request time from a precomputed table — a plain indexed Postgres table (`features_work`, `features_transaction`, `features_vendor`, `features_mp`) already gives sub-100ms reads for the dashboard APIs. Add Feast only if a future real-time scoring requirement emerges.

```
raw resolved tables → features/jobs/{work,transaction,vendor,mp}_features.py → features_* tables → every model reads from here, never recomputes independently
```

This canonicalisation is what prevents (per blueprint's implicit requirement) three different models each reinventing "vendor concentration" slightly differently and disagreeing.

---

# 17. Database Architecture

**Stack decision:**

| Technology | Needed? | Why |
|---|---|---|
| PostgreSQL | **Yes — core of everything** | Relational integrity across the six-dataset lifecycle join is the whole point of the entity-resolution layer |
| pgvector extension | **Yes** | Duplicate-work embeddings (Part 9) |
| TimescaleDB | **No at MVP** | Trend queries here are monthly/quarterly aggregates over a few years — plain indexed Postgres handles this volume fine; Timescale earns its keep at true high-frequency time-series scale, which this isn't |
| Redis | **Yes** | Celery broker + short-lived dashboard cache |
| Neo4j | **No** (see Part 7) | NetworkX batch jobs over Postgres-stored edges are sufficient until vendor-graph scale genuinely outgrows in-memory analysis |

**Core schema (abbreviated — columns show type/PK/FK/notes):**

```sql
-- Master/dimension tables
mp_master(mp_id PK, canonical_name, state_id FK, constituency_id FK, created_at)
mp_alias(alias_id PK, mp_id FK, raw_name, source_file)
geography(geo_id PK, level ENUM('state','constituency'), name, parent_geo_id FK NULL)
vendor_master(vendor_id PK, canonical_name, created_at)
vendor_alias(alias_id PK, vendor_id FK, raw_name, match_confidence)
ida_master(ida_id PK, name, state_id FK)

-- Lifecycle tables (resolved)
allocations(allocation_id PK, mp_id FK, fiscal_year, allocated_amount, source_row_hash, created_at)
works_recommended(work_id PK, work_id_raw, mp_id FK, ida_id FK, category, description,
                   recommended_amount, recommendation_date, source_row_hash, created_at)
works_sanctioned(work_id PK FK→works_recommended, sanctioned_amount, sanction_date,
                  source_row_hash, created_at)
expenditure(txn_id PK, work_id FK, vendor_id FK, amount, txn_date, payment_status,
            source_row_hash, created_at)
works_completed(work_id PK FK, completion_date, status, has_completion_evidence,
                 source_row_hash, created_at)
calamity_consent(consent_id PK, mp_id FK, calamity_type, amount, consent_date,
                  work_id FK NULL, source_row_hash, created_at)

-- Feature layer
features_work(work_id PK FK, feature_version, sanction_delay_days, duration_percentile,
              estimate_variance_pct, overrun_pct, inactivity_gap_days, computed_at)
features_transaction(txn_id PK FK, feature_version, amount_zscore, amount_percentile,
                      expenditure_to_sanction_pct, computed_at)
features_vendor(vendor_id PK FK, feature_version, concentration_pct, work_count,
                constituency_count, computed_at)
features_mp(mp_id PK FK, feature_version, utilisation_pct, output_per_rupee, computed_at)

-- Baselines
baselines(baseline_id PK, baseline_version, group_key, metric, n_obs, fallback_level,
          median, p10,p25,p75,p90,p95, computed_at)

-- ML/MLOps
model_registry(model_id PK, model_name, model_version, training_dataset_version,
                feature_version, hyperparameters JSONB, trained_at, eval_metrics JSONB,
                artifact_path, code_version, status ENUM('staging','production','retired'))
predictions(prediction_id PK, work_id FK, model_id FK, prediction_type, value,
            top_contributing_features JSONB, predicted_at)
anomaly_scores(score_id PK, entity_type, entity_id, model_id FK, score, percentile, computed_at)
duplicate_candidates(pair_id PK, work_id_a FK, work_id_b FK, similarity_score,
                      context_match JSONB, status ENUM('pending','confirmed','rejected'))

-- Risk & alerts
risk_components(component_id PK, work_id FK, component_type, value, source_signal_id,
                 baseline_version, model_id FK NULL, computed_at)
risk_scores(risk_id PK, work_id FK, composite_score, fusion_model_version, computed_at)
alerts(alert_id PK, work_id FK, severity, previous_score, new_score, components JSONB,
       created_at, status ENUM('open','reviewing','closed'))
review_outcomes(review_id PK, alert_id FK, reviewer_id, decision, notes, reviewed_at)
audit_log(log_id PK, entity_type, entity_id, action, actor, payload JSONB, created_at)
pipeline_run(run_id PK, source_file, file_hash, rows_processed, rows_quarantined, started_at, finished_at)
quarantine(row_id PK, run_id FK, raw_payload JSONB, reason, created_at)
```

Every `*_id` gets a btree index automatically via PK; add composite indexes on `(work_id, computed_at)` for features/scores, `(group_key, metric)` on baselines, and an HNSW/IVFFlat index on the embedding column used by `duplicate_candidates`' source table.

---

# 18. ML Architecture (summary — detail in Parts 4–11)

| Layer | Library |
|---|---|
| Statistics | `scipy`, `pymannkendall`, `ruptures` |
| Unsupervised anomaly | `scikit-learn` (IsolationForest, LOF) |
| NLP | `sentence-transformers`, `pgvector` |
| Predictive | `scikit-learn` (LogisticRegression) → `scikit-survival` / `xgboost` |
| Risk fusion | `scikit-learn` (LogisticRegression → later XGBoost) |
| Graph (production) | `networkx` |

All models are wrapped in a common `ml/base.py` interface: `fit(X) -> artifact`, `predict(X, model_version) -> {value, contributing_features, insufficient_data}`, `explain(prediction) -> str`, so the inference service (Part 21) calls every model type identically.

---

# 19. MLOps Architecture

```
Data (versioned) → Training → Validation → Evaluation → Model version → Registry
  → Deployment (staging) → Shadow/eval gate → Deployment (production) → Inference
  → Monitoring → Drift detection → Retraining (loop back to Training)
```

**Minimum practical stack: MLflow + Evidently.** Not DVC, not Weights & Biases, not Feast, at this scale:

- **MLflow** — model registry (`model_registry` table above is effectively MLflow's own tracking store, or MLflow's tracking server is used directly and the Postgres table becomes a thin app-facing mirror) + experiment tracking during development.
- **Evidently** — drift and data-quality monitoring in production (Part 8 #9, Part 12 drift row).
- **DVC** — skip; the raw CSVs are small enough and infrequent enough (batch drops) that a `source_file_hash` + object storage (S3-compatible bucket, path-versioned by ingestion date) is sufficient data versioning without adding a second tool.
- **Weights & Biases** — skip; MLflow already covers experiment tracking for this project's model count (roughly 5–6 model types), and W&B's collaborative/visualization strength matters more at larger team/experiment scale than this project has.
- **Feast** — skip, per Part 16.

**Model version contract** (`isolation_forest_v3` example): `training_dataset_version` (the `pipeline_run.run_id` range used), `feature_version` (matches `features_*.feature_version`), `hyperparameters` (JSONB), `trained_at`, `eval_metrics` (JSONB — e.g. reconstruction/false-positive-rate proxies since there's no ground truth at MVP), `baseline_version` used for any threshold calibration, `artifact_path` (MLflow URI), `code_version` (git SHA of the training script) — every field in the `model_registry` table above, all populated automatically by the training job, never by hand.

---

# 20. GenAI/RAG Architecture

```
Structured ML outputs (risk_components, predictions, baselines, alerts — all already in Postgres)
   ↓
RAG / context retrieval — SQL agent + pgvector similarity, scoped to the specific work_id/vendor_id in question
   ↓
LLM (function-calling / structured-output mode)
   ↓
Investigation explanation (fluent narration of retrieved numbers ONLY)
   ↓
Human auditor
```

**Approach:** function calling + a constrained SQL agent, not free-form RAG over raw documents — because every fact the LLM needs already lives in structured tables (blueprint §25's own instruction: "GenAI should never be the source of the underlying numbers, only their narrator"). Concretely: the LLM is given a fixed toolset (`get_risk_breakdown(work_id)`, `get_peer_benchmark(work_id)`, `get_vendor_profile(vendor_id)`, `compare_constituencies(geo_id_a, geo_id_b)`) that execute parameterized, injection-safe SQL against the views above and return JSON; the LLM's *only* job is to phrase that JSON as prose, never to compute or invent a number itself. This directly satisfies "no LLM-generated numbers" and gives a safe answer to prompt-injection concerns (Part 32) since the LLM never gets raw SQL execution rights, only these fixed, parameterized functions.

**Features enabled:** "Why is this work high risk?" → `get_risk_breakdown`; "Compare this constituency with peers" → `compare_constituencies`; "Summarize vendor risk" → `get_vendor_profile`; "Generate investigation brief" → chains 2–3 tool calls then narrates; "Explain trend changes" → reads `trend_scores` + `baselines`. A general "Ask questions about MPLADS data" assistant is the **only** place a broader read-only SQL agent (schema-constrained, SELECT-only, row-limited) is justified, and even then it's scoped to a fixed allow-listed set of views, not the raw tables.

---

# 21. Backend Architecture / Frontend↔Backend↔ML Integration

```
React
  ↓ REST (fetch/axios)
FastAPI (api/v1/*.py — routing, request validation via Pydantic)
  ↓
Service Layer (services/*.py — business logic, orchestrates DB + inference calls)
  ↓
ML Inference Service (ml/inference/*.py — loads model_registry's "production" model, calls .predict())
  ↓
Model (artifact loaded from MLflow/registry)
  ↓
Database (reads/writes features, predictions, scores)
  ↓
Response (Pydantic schema) → React
```

The frontend **never** imports Python or calls a model path directly — it only ever calls a FastAPI route. Swapping `isolation_forest_v3` → `v4` in the registry changes zero frontend code, because the API response schema (Part 22) is versioned independently of the model.

## Sample API contracts

**`GET /api/v1/dashboard/overview`** — params: `fiscal_year?`, `state_id?` — service: `services/dashboard.py::get_overview()` — reads: `allocations`, `expenditure`, `risk_scores`, `alerts` — no model called (pure aggregation) — response:
```json
{"total_allocated": 0, "total_sanctioned": 0, "total_expenditure": 0,
 "national_utilisation_pct": 0, "completion_rate": 0, "high_risk_count": 0,
 "state_summary": [{"geo_id":"...","utilisation_pct":0,"risk_count":0}]}
```

**`GET /api/v1/trends/financial`** — params: `group_by` (mp|state|category|national), `period`, `geo_id?` — service: `services/trends.py::get_financial_trend()` — reads: `trend_scores`, `changepoints` — response:
```json
{"series": [{"period":"2025-Q1","value":0}],
 "trend": {"direction":"increasing","slope":0,"p_value":0,"significant":true},
 "changepoints": [{"period":"2025-Q2","magnitude":0}]}
```

**`GET /api/v1/works/{work_id}`** — service: `services/works.py::get_work_360()` — reads: `works_recommended/sanctioned/completed`, `expenditure`, `risk_components`, `predictions` — calls: inference service **only if** a live re-score is requested via `?rescore=true`, otherwise reads cached `risk_scores` — response includes lifecycle timeline, financial comparison, `risk_score_breakdown` (component list with baseline_version/model_version per component per Part 25's explainability requirement).

**`GET /api/v1/alerts`** — params: `severity?`, `state_id?`, `since?` — reads: `alerts` joined `risk_components` — no model call, pure read.

**`POST /api/v1/reviews`** — body: `{alert_id, decision, notes}` — service: `services/reviews.py::submit_review()` — writes: `review_outcomes`, `audit_log` — this is the write path that feeds Risk Fusion Phase 2/3 (Part 14).

**`GET /api/v1/models/status`** — reads: `model_registry` — response: current production model per type + last-trained/eval-metrics, for the Model Monitoring screen.

Error handling convention across all endpoints: insufficient underlying data → HTTP 200 with `"status":"insufficient_data","fallback_used":"statistical_baseline"` (never a 500) per the blueprint's graceful-degradation principle.

---

# 22. Frontend Architecture

| Page | Key components | Primary API(s) |
|---|---|---|
| Executive Dashboard | KPI cards, state choropleth, trend sparkline | `/dashboard/overview`, `/trends/geographical` |
| MP Dashboard | Allocation/utilisation cards, category mix chart, risk-flag count | `/mp/{id}/overview` |
| Constituency Dashboard | Same, peer-compared | `/constituency/{id}/overview` |
| Work 360° | Lifecycle timeline, financial comparison card, risk breakdown, similar-works panel | `/works/{id}`, `/works/{id}/duplicates` |
| Financial Analytics | Variance distribution, overrun leaderboard, utilisation trend | `/trends/financial`, `/works/overruns` |
| Operational Analytics | Delay distributions, bottleneck breakdown | `/trends/operational` |
| Geographical Analytics | Choropleth, state/constituency ranking | `/trends/geographical` |
| Vendor Intelligence | Concentration ranking, transaction profile, network view (prod) | `/vendors/risk`, `/vendors/{id}/network` |
| Duplicate Work Detector | Candidate list, side-by-side compare, confirm/reject | `/works/duplicates` |
| Compliance Dashboard | Rule-violation counts/trend | `/compliance/violations` |
| Early Warning Dashboard | Risk-ranked queue, severity distribution | `/alerts` |
| Calamity Dashboard | Consent trend, MP totals | `/calamity` |
| Model Monitoring | Model status, drift charts | `/models/status` |
| Data Quality Dashboard | Quarantine counts, DQ score trend | `/data-quality` |

Every page: loading skeleton while the API call is pending, an explicit empty-state (not a blank chart) when the API returns `insufficient_data`, an error-state toast on network failure, server-side pagination for list views (`/alerts`, `/works/duplicates`), and short-TTL client caching (React Query) so drill-down navigation doesn't re-fetch the same overview data. No numeric literal is ever written in a component — every figure is bound to an API response field.

---

# 23. Real-Time / Async Architecture

| Synchronous | Asynchronous (Celery task) |
|---|---|
| Dashboard queries, work details, alert list/detail, model status | CSV ingestion, entity resolution, feature computation, embedding generation, anomaly/predictive inference batches, baseline recomputation, model retraining |

Stack: **FastAPI + Celery + Redis**, for both SIH prototype and production (per Part 15's reasoning — batch cadence doesn't need Kafka). Production adds Prefect as the scheduler/orchestrator layer *above* Celery tasks once pipeline branching/retries need a UI.

---

# 24. Complete Directory Structure

```
backend/
├── app/
│   ├── api/v1/            # dashboard.py, trends.py, works.py, vendors.py, alerts.py, reviews.py, models.py, assistant.py
│   ├── services/          # dashboard.py, trends.py, works.py, vendors.py, reviews.py, compliance.py
│   ├── schemas/           # Pydantic request/response models, one file per domain
│   ├── core/               # config loader, db session, security/auth
│   └── main.py
ingestion/
├── loaders/                # csv_loader.py per dataset
├── cleaning/                # currency.py, dates.py, headers.py
├── entity_resolution/       # work_id_parser.py, mp_resolver.py, vendor_resolver.py, geo_resolver.py
├── validation/               # great_expectations suites
features/
├── jobs/                     # work_features.py, transaction_features.py, vendor_features.py, mp_features.py
baselines/
├── compute_baselines.py
├── hierarchy.py
compliance/
├── rules/                    # rule_definitions.yaml, rule_engine.py
ml/
├── base.py                   # common model interface
├── anomaly/                  # isolation_forest.py, lof.py, train.py, infer.py
├── trend/                    # mann_kendall.py, changepoint.py
├── prediction/                # delay_logreg.py, delay_survival.py, train.py, infer.py
├── nlp/                       # embed.py, duplicate_search.py, calibration.py
├── risk/                      # fusion.py, phases.py
├── registry/                  # mlflow_client.py
alerts/
├── engine.py, notifier.py
genai/
├── tools.py                   # get_risk_breakdown, get_vendor_profile, etc.
├── agent.py
db/
├── migrations/                 # Alembic
├── models.py                   # SQLAlchemy ORM mirroring Part 17 schema
config/
├── base.yaml, thresholds.yaml, risk_weights.yaml   # ALL tunables live here or in DB config table
workers/
├── celery_app.py, tasks.py
frontend/
├── src/pages/, src/components/, src/api/, src/hooks/
tests/
├── unit/, integration/, pipeline/, model/, api/, e2e/
docker/
├── Dockerfile.api, Dockerfile.worker, docker-compose.yml
docs/
```

---

# 25. File-by-File Responsibilities (core files)

**`ingestion/entity_resolution/work_id_parser.py`** — Purpose: extract canonical `work_id` from the composite raw field (blueprint §3's confirmed issue). Input: raw CSV row string. Output: `{work_id, work_id_raw}`. No model. Consumer: every downstream loader.

**`ml/anomaly/isolation_forest.py`** — Purpose: train/serve the multivariate anomaly model. Input: `features_transaction` (or `_work`/`_vendor`) rows, scaled. Output: `{anomaly_score, anomaly_percentile, top_contributing_features}`. Model: scikit-learn IsolationForest, versioned per Part 19. Training: scheduled/drift-triggered batch job. Inference: called by `services/works.py` via `ml/inference/`. Database: reads `features_*`, writes `anomaly_scores`. API consumer: `/works/{id}` risk breakdown. Frontend consumer: Work 360° risk panel.

**`ml/nlp/duplicate_search.py`** — Purpose: embed a description, ANN-search pgvector, apply contextual gate. Input: `work_id`. Output: ranked `duplicate_candidates` rows. Model: Sentence-Transformers (frozen, no training). Database: writes `duplicate_candidates`. API consumer: `/works/{id}/duplicates`. Frontend: Duplicate Work Detector.

**`ml/prediction/delay_survival.py`** — Purpose: estimate P(on-time completion) for ongoing works. Input: `features_work` (category, state, size, sanction delay, expenditure velocity). Output: `{survival_probability, predicted_at}`. Training: scheduled, only once `min_training_samples` completed works exist, else `insufficient_data`. Database: writes `predictions`. API: `/predictions/delay/{work_id}`. Frontend: Work 360° + Early Warning queue.

**`risk/fusion.py`** — Purpose: combine all `risk_components` into `composite_risk_score` per the active Phase (Part 14). Input: `risk_components` rows for a work_id. Output: `{composite_score, severity_band, component_breakdown}`. Database: reads `risk_components`, writes `risk_scores`. API: `/works/{id}`, `/alerts`. Frontend: everywhere a risk score displays.

**`baselines/compute_baselines.py`** — Purpose: implement the Part 12 hierarchy. Input: `features_*` tables grouped by category/state/size. Output: `baselines` rows, versioned. Consumer: every statistical/rule comparison in the codebase.

**`alerts/engine.py`** — Purpose: compare new vs. previous `risk_scores`, emit `alerts` on severity-band change. Input: `risk_scores` delta. Output: `alerts` row with full component snapshot. Consumer: `/alerts` API → Early Warning Dashboard.

---

# 26. Configuration Management

| Value type | Where it lives | Example |
|---|---|---|
| Environment/secrets | `.env` / environment variables | DB URL, MLflow URI, LLM API key |
| Statistical sample-size floors, calibration priors, rolling windows | `config/thresholds.yaml`, hot-reloadable | `baseline.min_group_size`, `nlp.duplicate.similarity_prior` |
| Risk fusion weights (Phase 1) | DB table `config_risk_weights` (editable via admin UI without a redeploy) | `cost_risk: 0.2` |
| Model hyperparameters | Model artifact itself (MLflow), not a shared config file | IsolationForest `n_estimators` |
| Official compliance rules with a real legal number | `compliance/rules/rule_definitions.yaml`, tagged `source: official_rule` | a legally mandated max processing time, if one exists |

Rule of thumb used throughout this document: **if a number can legitimately change as more data arrives, it's a learned baseline (DB, versioned)**; **if it can change per deployment/environment, it's an env var or YAML**; **if it never changes without a law changing, it's an `official_rule`-tagged config entry** — nothing else is permitted to be a bare literal in Python.

---

# 27. Testing

| Layer | What to test |
|---|---|
| Unit | `work_id_parser`, currency/date cleaners, baseline hierarchy fallback logic, rule engine individual rules |
| Integration | full ingestion→feature→DB path on a fixture CSV with known dirty rows |
| Data pipeline | schema validation (Great Expectations suites run in CI against fixture + production-shaped samples) |
| Model | IsolationForest scores a known synthetic outlier above a known synthetic normal point; survival model's `insufficient_data` fallback triggers correctly below `min_training_samples` |
| API | contract tests per endpoint in Part 21, including the `insufficient_data` response shape |
| Frontend | component tests for empty/loading/error states; no-hardcoded-value lint rule (custom ESLint rule flagging numeric literals in JSX outside test files) |
| E2E | one full worked example (Part 28) run through the live stack in CI |
| Regression | golden-file comparison of `baselines`/`risk_scores` outputs on a frozen fixture dataset after any pipeline change |
| Drift | Evidently report generation on a synthetic drifted batch, confirming the retrain trigger fires |

---

# 28. Security

| Concern | MVP | Production |
|---|---|---|
| AuthN | Simple JWT | JWT + SSO/OAuth against a government IdP if mandated |
| AuthZ / roles | `admin`, `auditor` (basic) | add `state-scoped auditor`, `MP-facing read-only` row-level access via Postgres RLS policies keyed to the user's assigned `geo_id`/`mp_id` |
| Audit logs | `audit_log` table, all writes (Part 17) | same, plus immutable/append-only storage |
| API security | rate limiting, input validation via Pydantic | + WAF, mTLS between services |
| Secrets | `.env` | secrets manager (Vault/cloud KMS) |
| DB security | least-privilege DB roles | + encryption at rest, network isolation |
| GenAI prompt-injection | N/A at MVP if GenAI deferred | fixed toolset only (Part 20), no free-text SQL execution, output scanned for any numeric value not traceable to a tool result before display |
| Data leakage | scope dashboard queries by role | same, enforced at the DB (RLS) layer, not just the API |

---

# 29. Observability

- **Data:** `pipeline_run`/`quarantine` counts, schema-change alerts from Great Expectations.
- **Pipeline:** Celery task success/failure/latency (Flower or Prometheus exporter).
- **Models:** Evidently drift reports, prediction/anomaly score distribution dashboards, `model_registry` eval-metric history.
- **API:** latency/error-rate via OpenTelemetry → Prometheus/Grafana.
- **Frontend:** failed-request logging (Sentry or similar).
- **Alerts:** alert volume over time, false-positive rate (`review_outcomes` "dismissed" ratio) as a first-class tracked metric per blueprint §24.

---

# 30–31. MVP vs. Production Tech Stack

| Layer | MVP (SIH) | Production | When to upgrade |
|---|---|---|---|
| Backend | FastAPI | FastAPI | Never needs to change |
| Data processing | Pandas | Polars for the heavier feature jobs | When row counts make Pandas jobs slow (config-measurable, not guessed) |
| Database | PostgreSQL | PostgreSQL (+ read replica) | Add replica at real concurrent-user load |
| Vector | pgvector | pgvector | Only reconsider Qdrant if description volume reaches millions |
| ML | scikit-learn, XGBoost | same | — |
| NLP | Sentence-Transformers (CPU) | same, GPU-served if embedding volume grows | batch embedding latency becomes a bottleneck |
| MLOps | MLflow local | MLflow server + Evidently | team size / need for shared registry |
| Workflow | Celery + cron | Celery + Prefect | pipeline branching/retry complexity grows |
| Async | Celery + Redis | same | Kafka only if true streaming ingestion is added |
| Frontend | React | React (+ Next.js if SSR/SEO becomes relevant — unlikely for an internal dashboard) | rarely |
| Viz | Recharts | Recharts / ECharts for heavier charts | — |
| Maps | Leaflet/MapLibre | same | — |
| Deployment | Docker Compose | Docker + Kubernetes | multi-service scaling/HA requirement |
| Observability | basic logs | Prometheus/Grafana/OpenTelemetry | — |
| GenAI | optional stretch goal, frozen tool-calling LLM | same, with stricter guardrails | — |

---

# 32. What NOT to Build for the SIH MVP

- **Kubernetes** — Docker Compose is enough for a demo and even early production; add K8s only at real multi-tenant/HA scale.
- **Kafka** — batch CSV ingestion has no streaming-throughput problem to solve.
- **Neo4j / GraphSAGE / GNN** — the vendor graph is small; NetworkX batch jobs answer every stated question; a trained graph embedding model is unjustifiable complexity here.
- **Transformers trained from scratch, Autoencoders/VAE** — pretrained Sentence-Transformers + classical IsolationForest fully cover the stated NLP/anomaly needs with far less risk and far more explainability.
- **Complex time-series DL (Prophet/ARIMA/TFT)** — the stated need is trend *classification*, not forecasting; classical statistics answer it transparently.
- **Feast feature store** — a plain Postgres feature table serves every batch-scored model here.
- **Distributed computing (Spark/Dask)** — MPLADS production volume (thousands of records) never approaches the scale where single-node Pandas/Polars becomes the bottleneck.
- **Moran's I / spatial autocorrelation** — no adjacency data exists yet; percentile ranking already answers the geographic-comparison questions asked.

Build these later, specifically when the data volume or a stated new requirement (not "it sounds impressive") justifies each one.

---

# 33. End-to-End Example (hypothetical, clearly labelled)

**Work ID `WRK-2027-04521`, Category "Community Infrastructure," State X.**

1. CSV ingested → `pipeline_run` records `row_hash` changes for this work's expenditure rows.
2. Entity resolution confirms `work_id`, resolves vendor "ABC Const. Pvt Ltd" → `vendor_id=118` via alias table.
3. Loaded into `works_sanctioned` (₹3,80,000) and three `expenditure` rows totalling ₹5,02,000.
4. `features/jobs/work_features.py` recomputes `overrun_pct = 32.1%`, `duration_percentile`, `vendor_concentration_pct` for this work only (scoped, Part 15).
5. Compliance rule engine: no rule violated (expenditure is after sanction, work exists) — no Critical flag.
6. Baseline engine: category "Community Infrastructure" × State X peer 90th percentile overrun = 14% (baseline_version `2027Q2-CommInfra-StateX`).
7. Statistical engine: `overrun_pct (32.1%) > 90th percentile (14%)` → Significant deviation signal.
8. IsolationForest inference (model `isolation_forest_v7`, no retrain needed) scores the transaction vector — anomaly_percentile 96.4, top contributing features: `overrun_pct`, `vendor_concentration_pct`.
9. NLP duplicate check: no high-similarity candidate found.
10. Risk Fusion (Phase 2, weighted sum + accumulating feedback): `cost_risk=0.78, vendor_risk=0.55, compliance_risk=0, duplicate_risk=0` → `composite_score=78` → **High**.
11. Alert Engine: previous score was 40 (Medium) → severity band changed → `alerts` row created with full component breakdown + `baseline_version` + `model_id`.
12. `GET /api/v1/works/WRK-2027-04521` returns the breakdown; Work 360° renders it with the exact peer-benchmark numbers (Part 25 explainability requirement).
13. Auditor reviews, confirms a valid revised sanction is on file → submits `POST /api/v1/reviews {"decision":"dismissed","notes":"revised sanction #REV-118 on file"}`.
14. `review_outcomes` row written → feeds the next scheduled Risk Fusion recalibration (Part 14, Phase 2→3 transition data).

---

# 34. Implementation Roadmap

| Phase | Build | Definition of done |
|---|---|---|
| 1 — Foundation | Postgres schema (Part 17), config system (Part 26), Docker Compose skeleton | `docker-compose up` gives a running empty DB + API stub |
| 2 — Data pipeline | Ingestion, cleaning, entity resolution (Part 3, 25) | All 6 sample CSVs load into resolved tables with a quarantine report |
| 3 — Analytics | Feature jobs, baseline engine, trend engine | `/trends/financial`, `/trends/operational`, `/trends/geographical` return real (if sample-scale, labelled) data |
| 4 — Compliance | Rule engine, cost overrun, duplicate payment | `/compliance/violations` populated, all rule-based, no ML yet |
| 5 — ML | IsolationForest anomaly, vendor risk | `/works/{id}` shows anomaly score + top features |
| 6 — NLP | Embedding pipeline, pgvector, contextual gate | `/works/duplicates` returns calibrated candidates |
| 7 — Risk engine | Fusion Phase 1, alert engine, early warning scoping | `/alerts` populated, severity-change-triggered |
| 8 — Frontend | All 14 screens wired to real APIs, no hardcoded numbers | Every screen passes the "no literal in JSX" lint rule |
| 9 — GenAI | Tool-calling assistant over fixed functions | "Why is this high risk?" returns a grounded, sourced answer |
| 10 — MLOps | MLflow registry, Evidently drift, scheduled retrain | model version visible on `/models/status`, drift triggers a real retrain in a test |

---

# 35. Final Master Table

| # | Problem | Detection | Algorithm | File | Service | API | DB Table | Frontend | Training | Dynamic? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Expenditure before/above sanction | R | rule table | `compliance/rules/rule_engine.py` | `services/compliance.py` | `/compliance/violations` | `risk_components` | Compliance | No | Rule set config-driven |
| 2 | Financial trend | S | Mann-Kendall + rolling z | `ml/trend/mann_kendall.py` | `services/trends.py` | `/trends/financial` | `trend_scores` | Financial Analytics | No | Fully data-driven |
| 3 | Structural spend change | S | PELT | `ml/trend/changepoint.py` | `services/trends.py` | `/trends/financial` | `changepoints` | Financial Analytics | No | Calibrated penalty |
| 4 | Multivariate anomaly | U | IsolationForest/LOF | `ml/anomaly/isolation_forest.py` | `services/works.py` | `/works/{id}` | `anomaly_scores` | Work 360° | Yes | Contamination recalibrated |
| 5 | Delay risk (future) | P | LogReg → Survival | `ml/prediction/delay_survival.py` | `services/works.py` | `/predictions/delay/{id}` | `predictions` | Work 360°, Early Warning | Yes | Peer hierarchy |
| 6 | Cost overrun tier | S | peer baseline | `baselines/compute_baselines.py` | `services/works.py` | `/works/{id}/financials` | `baselines` | Financial Analytics | No | Fully baseline-driven |
| 7 | Duplicate work | N | Sentence-Transformers + pgvector | `ml/nlp/duplicate_search.py` | `services/works.py` | `/works/{id}/duplicates` | `duplicate_candidates` | Duplicate Work Detector | No (calibrated threshold) | Threshold learned from feedback |
| 8 | Duplicate/repeated payment | R+S | composite key + frequency | `compliance/rules/*`, `ml/trend/*` | `services/compliance.py` | `/payments/duplicates` | `risk_components` | Compliance | No | Rate-card baseline |
| 9 | Vendor concentration/risk | S+U | HHI + IsolationForest | `features/jobs/vendor_features.py`, `ml/anomaly/isolation_forest.py` | `services/vendors.py` | `/vendors/risk` | `features_vendor`, `anomaly_scores` | Vendor Intelligence | Yes (U) | Peer baseline |
| 10 | Geographic peer benchmarking | S | percentile ranking | `baselines/compute_baselines.py` | `services/geography.py` | `/trends/geographical` | `baselines` | Geographical Analytics | No | Fully data-driven |
| 11 | Composite risk / alerting | Fusion | weighted sum → calibrated LogReg → GBM | `risk/fusion.py` | `services/works.py`, `alerts/engine.py` | `/alerts` | `risk_scores`, `alerts` | Early Warning | Phased | Weights become learned over time |
| 12 | Investigation explanation | GenAI | tool-calling LLM + RAG | `genai/agent.py`, `genai/tools.py` | `services/assistant.py` | `/assistant/ask` | reads all above | any screen | No | Grounded strictly in retrieved data |

---

# 36. SIH Judge Explanation

**30 seconds:** "We turned six MPLADS CSVs into one work-level lifecycle graph, and built five explainable detection layers — deterministic rules, statistical peer benchmarks, unsupervised anomaly detection, NLP duplicate-work matching, and predictive delay modelling — that fuse into one risk score. Every number an auditor sees traces back to the exact baseline and model version that produced it."

**Where we deliberately did NOT use ML:** trend direction, cost-overrun tiers, and geographic benchmarking are pure statistics — a percentile against a peer group is more explainable and more correct than a trained model here, and forcing ML onto them would only make the system harder to audit.

**Where ML genuinely earns its place:** IsolationForest for the multivariate "amount + timing + vendor" pattern no single rule can express; Sentence-Transformer embeddings because free-text duplicate detection has no rule-based equivalent; survival modelling because "will this become delayed" is a genuinely predictive question a percentile alone can't answer.

**On fraud:** the system never claims fraud. It ranks *risk indicators* for human review, and every alert carries its evidence, baseline, and model version so a human — not the model — makes the final call.
