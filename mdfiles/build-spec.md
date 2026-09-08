# BUILD SPEC v2 — MPLADS Sentinel
## Agent-Executable Spec for Antigravity (SIH 2026, PS 26102)

> **This supersedes `BUILD_SPEC_MPLADS_Sentinel_Antigravity.md` (v1).** v1 was based on generic assumptions about MPLADS data. This version is derived directly from two source documents grounded in the actual eSAKSHI dataset structure:
> - `MPLADS_AIML_Blueprint.md` — dataset-by-dataset analysis, detection logic, worked examples, judge Q&A prep
> - `MPLADS_Technical_Architecture.md` — buildable engineering spec: schema, services, APIs, phased MLOps
>
> Read both alongside this file — this file sequences them into agent-executable tasks and fills in only the frontend-framework decision (Next.js, per team preference) and repo layout. Where this file is silent on a design decision, defer to the two source documents; do not re-derive from general MPLADS knowledge.

---

## 0. Core Design Principles (non-negotiable — read before writing any code)

1. **Five independent, swappable detection layers**, not one model: Rule Engine → Statistical Baseline Engine → Unsupervised ML (anomaly) → NLP (duplicate detection) → Predictive ML (delay/cost risk). Each is independently explainable and independently degradable (`insufficient_data`, never a crash or a fabricated score).
2. **Never claim fraud.** Every output is a *risk indicator for human review*. All UI copy, alert text, and LLM narration must reflect this — see Blueprint §9, §25, §32.
3. **No bare literals.** Every threshold is either a config value (`config/thresholds.yaml`), a DB-stored versioned baseline (`baselines` table), or an `official_rule`-tagged config entry. Nothing is hardcoded in Python or JSX. See Blueprint §13, Architecture Part 26.
4. **Peer-group baselines, not fixed numbers.** "Normal" cost/duration/vendor-concentration is always computed per category × state × project-size-bucket, versioned, and recomputed on schedule (Architecture Part 12).
5. **Multiple reference frames per comparison** — same category, same state, same vendor, same work's own history — never a single global threshold.
6. **Contextual gating before flagging.** Duplicate-work and repeated-payment detection require semantic/pattern match **AND** matching context (location, category, amount tolerance, date proximity) before elevating risk (Blueprint §10, §11).
7. **Multi-signal convergence raises priority faster than any single strong signal** — this is why Risk Fusion is a weighted sum of components, not a max().
8. **Phased ML, not day-one supervised learning.** No fraud labels exist. Start unsupervised + statistical + rule-based. Reviewer outcomes (`review_outcomes`) become weak labels only after volume accumulates (Architecture Part 14, Blueprint §23).
9. **Incremental, not full-recompute.** Every pipeline stage is scoped to affected `work_id`s via `row_hash` diffing (Architecture Part 3, Part 15) — critical for the scalability story in judge Q&A.
10. **GenAI/LLM is a narrator, never a source of numbers.** Fixed tool-calling functions only, reading from structured DB views (Architecture Part 20). No free-text SQL execution.
11. **Explainability is mandatory, not optional.** Every alert shows: top contributing indicators, the peer-benchmark it was compared against, baseline version, model version, timestamp (Blueprint §25, Architecture Part 17 `risk_components`).

---

## 1. Stack (frontend adapted to Next.js; backend/ML per source docs)

| Layer | Technology | Source |
|---|---|---|
| Frontend | **Next.js 15 (App Router) + TypeScript**, Tailwind, shadcn/ui | Team preference — source doc default is plain React (internal dashboard, no SSR/SEO need); Next.js is a superset choice, no conflict |
| Data viz | Recharts (primary), consider ECharts for heavier charts later | Architecture Part 30–31 |
| Maps | Leaflet / MapLibre | Architecture Part 30–31 |
| State/data fetching | React Query (short-TTL client caching for drill-downs) | Architecture Part 22 |
| Backend/API | FastAPI (Python 3.11, async), Pydantic schemas | Architecture Part 21 |
| Data processing | Pandas (prototype) → Polars only if batch jobs measurably slow | Architecture Part 30–31 |
| Database | PostgreSQL 16 + **pgvector** extension | Architecture Part 17 |
| Async/queue | **Celery + Redis** (not Kafka — batch CSV drops, not streaming) | Architecture Part 15, 23 |
| Statistics | `scipy`, `pymannkendall`, `ruptures` (PELT change-point) | Architecture Part 4, 18 |
| Unsupervised ML | scikit-learn `IsolationForest`, `LocalOutlierFactor` | Blueprint §8, Architecture Part 18 |
| NLP | `sentence-transformers` (e.g. `all-MiniLM-L6-v2` or multilingual variant), pgvector for ANN search | Blueprint §10, Architecture Part 18 |
| Predictive | `scikit-learn LogisticRegression` (MVP) → `scikit-survival` / `xgboost` (production-grade delay risk) | Architecture Part 5 |
| Risk fusion | Weighted sum (Phase 1) → calibrated `LogisticRegression` (Phase 3) → XGBoost stacking (Phase 4, only if labeled volume justifies it) | Architecture Part 14 |
| Data validation | Great Expectations (schema/type/date checks on ingestion) | Architecture Part 3 |
| MLOps | MLflow (registry + experiment tracking), Evidently (drift) | Architecture Part 19 |
| Graph (if used) | NetworkX batch jobs over Postgres-stored edges — **not Neo4j** | Architecture Part 7, 17 |
| Orchestration | Celery + cron (MVP) — **not Airflow/Prefect/Kafka at SIH scale** | Architecture Part 15 |
| Deployment | Docker Compose | Architecture Part 30–31 |
| GenAI (stretch) | Claude API, fixed tool-calling functions only, no free-text SQL agent except a scoped SELECT-only allow-listed fallback | Architecture Part 20 |

**Explicitly excluded at SIH/MVP scale** (Architecture Part 32) — do not introduce these unless a stated new requirement justifies it: Kubernetes, Kafka, Neo4j/GraphSAGE/GNN, Transformers-trained-from-scratch, Autoencoders/VAE, Prophet/ARIMA/TFT, Feast, Spark/Dask, spatial autocorrelation models.

---

## 2. Repo Structure

```
mplads-sentinel/
├── frontend/                          # Next.js 15 App Router
│   ├── app/
│   │   ├── (dashboards)/
│   │   │   ├── executive/page.tsx
│   │   │   ├── mp/[id]/page.tsx
│   │   │   ├── constituency/[id]/page.tsx
│   │   │   ├── work/[id]/page.tsx             # "Work 360°"
│   │   │   ├── financial-analytics/page.tsx
│   │   │   ├── operational-analytics/page.tsx
│   │   │   ├── geographical-analytics/page.tsx
│   │   │   ├── vendor-intelligence/page.tsx
│   │   │   ├── duplicate-work-detector/page.tsx
│   │   │   ├── compliance/page.tsx
│   │   │   ├── early-warning/page.tsx
│   │   │   ├── calamity/page.tsx
│   │   │   ├── model-monitoring/page.tsx
│   │   │   └── data-quality/page.tsx
│   │   ├── api/                        # BFF routes proxying FastAPI, session/role checks
│   │   ├── layout.tsx
│   │   └── page.tsx                    # landing/login
│   ├── components/
│   │   ├── ui/                         # shadcn primitives
│   │   ├── dashboard/
│   │   │   ├── RiskScoreBadge.tsx
│   │   │   ├── RiskBreakdownPanel.tsx  # component list + baseline_version + model_version
│   │   │   ├── LifecycleTimeline.tsx   # recommendation→sanction→expenditure txns→completion
│   │   │   ├── PeerBenchmarkChart.tsx
│   │   │   ├── DuplicateCompareCard.tsx # side-by-side description + similarity score
│   │   │   ├── TrendChart.tsx
│   │   │   ├── Choropleth.tsx
│   │   │   └── AlertQueueTable.tsx
│   │   └── layout/
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── auth.ts
│   │   └── types.ts                    # mirrors backend Pydantic schemas exactly
│   └── package.json
│
├── backend/
│   └── app/
│       ├── api/v1/                     # dashboard.py, trends.py, works.py, vendors.py,
│       │                                #   alerts.py, reviews.py, models.py, assistant.py
│       ├── services/                   # dashboard.py, trends.py, works.py, vendors.py,
│       │                                #   reviews.py, compliance.py
│       ├── schemas/                    # Pydantic, one file per domain
│       ├── core/                       # config loader, db session, security/auth
│       └── main.py
│
├── ingestion/
│   ├── loaders/                        # csv_loader.py per dataset (6 files)
│   ├── cleaning/                       # currency.py, dates.py, headers.py
│   ├── entity_resolution/              # work_id_parser.py, mp_resolver.py, vendor_resolver.py, geo_resolver.py
│   └── validation/                     # Great Expectations suites
│
├── features/
│   └── jobs/                           # work_features.py, transaction_features.py,
│                                        #   vendor_features.py, mp_features.py
│
├── baselines/
│   ├── compute_baselines.py
│   └── hierarchy.py
│
├── compliance/
│   └── rules/                          # rule_definitions.yaml, rule_engine.py
│
├── ml/
│   ├── base.py                         # common interface: fit/predict/explain
│   ├── anomaly/                        # isolation_forest.py, lof.py, train.py, infer.py
│   ├── trend/                          # mann_kendall.py, changepoint.py
│   ├── prediction/                     # delay_logreg.py, delay_survival.py, train.py, infer.py
│   ├── nlp/                            # embed.py, duplicate_search.py, calibration.py
│   ├── risk/                           # fusion.py, phases.py
│   └── registry/                       # mlflow_client.py
│
├── alerts/
│   └── engine.py, notifier.py
│
├── genai/                              # stretch goal
│   ├── tools.py                        # get_risk_breakdown, get_vendor_profile, etc.
│   └── agent.py
│
├── db/
│   ├── migrations/                     # Alembic
│   └── models.py                       # SQLAlchemy ORM mirroring §5 schema below
│
├── config/
│   ├── base.yaml
│   ├── thresholds.yaml
│   └── risk_weights.yaml
│
├── workers/
│   └── celery_app.py, tasks.py
│
├── tests/
│   ├── unit/, integration/, pipeline/, model/, api/, e2e/
│
├── data/
│   └── synthetic/                      # generator + labeled ground truth (see §4)
│
├── docker/
│   ├── Dockerfile.api, Dockerfile.worker, Dockerfile.web
│   └── docker-compose.yml
│
└── docs/
    ├── MPLADS_AIML_Blueprint.md
    ├── MPLADS_Technical_Architecture.md
    └── BUILD_SPEC_MPLADS_Sentinel_Antigravity_v2.md
```

---

## 3. Database Schema (authoritative — copy verbatim from Architecture Part 17)

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
          median, p10, p25, p75, p90, p95, computed_at)

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

Indexes: btree PK auto-index on every `*_id`; composite `(work_id, computed_at)` on features/scores tables; composite `(group_key, metric)` on `baselines`; HNSW/IVFFlat on the embedding column backing `duplicate_candidates`.

---

## 4. Synthetic Data Requirement

The blueprint is explicit: the six sample CSVs (9–13 rows each) only prove the schema/join design — not enough volume for percentiles, z-scores, or ML baselines to be meaningful (Blueprint §31).

**Task:** build `data/synthetic/generate.py` producing ≥2,000 works across all six datasets, matching the schema in §3 exactly, including:
- The specific data-quality issues the blueprint confirms exist in the real data: composite Work ID field bundled with category text, inconsistent headers, blank trailing rows, MP/vendor name spelling variants — inject these so the entity-resolution layer (work_id parser, alias tables) has something real to prove itself against
- Labeled ground-truth anomalies (kept in a separate table, **never read by any detection model** — eval-only, per §0.3): cost overruns beyond peer norms, expenditure-before-sanction violations, duplicate/paraphrased work descriptions, vendor concentration rings, delayed/stagnating works, financial-physical mismatches
- Realistic non-anomalous edge cases (legitimate repeated payments from standard rate cards, legitimately large multi-phase projects) so the system doesn't just learn to flag "big numbers"

**Acceptance:** reproducible via fixed seed; ≥10% of works carry at least one labeled anomaly; ground truth table is schema-isolated from anything the detection pipeline queries.

---

## 5. Task Breakdown (Antigravity execution order)

Phases below map directly to Architecture Part 34's roadmap. Each phase's "Definition of done" is copied from the source doc where given.

### Phase 0 — Foundation
- [ ] Repo scaffold per §2
- [ ] Postgres schema (§3) via Alembic migrations, pgvector extension enabled
- [ ] `config/` system (base.yaml, thresholds.yaml, risk_weights.yaml) — establish the "no bare literals" convention from commit 1
- [ ] Docker Compose: postgres, redis, api, worker (celery), web (Next.js)
- **Done when:** `docker-compose up` gives a running empty DB + API stub + Next.js dev server

### Phase 1 — Synthetic Data
- [ ] Build `data/synthetic/generate.py` per §4
- [ ] Seed script loads into Postgres
- **Done when:** all 6 synthetic "CSVs" load into resolved tables with a quarantine report showing intentionally-injected dirty rows caught

### Phase 2 — Data Pipeline (Ingestion → Entity Resolution)
- [ ] `ingestion/loaders/` — one loader per dataset
- [ ] `ingestion/cleaning/` — currency parsing, date parsing, header normalization
- [ ] `ingestion/entity_resolution/work_id_parser.py` — regex-based canonical `work_id` extraction from the composite raw field, storing `work_id_raw` alongside
- [ ] `mp_resolver.py`, `vendor_resolver.py` — alias-table resolution with fuzzy-match confidence, 80–95% similarity routed to a human-confirmation queue rather than auto-merged
- [ ] `ingestion/validation/` — Great Expectations suites per dataset
- [ ] `pipeline_run` + `row_hash` diffing so re-ingestion only pushes changed rows downstream (this is the mechanism Phase 7's incremental scoring depends on — do not skip)
- **Done when:** all 6 synthetic CSVs load into resolved tables; a re-run with 1 changed row only touches that row's downstream Work ID

### Phase 3 — Feature Engineering & Baselines
- [ ] `features/jobs/` — work, transaction, vendor, mp feature jobs writing to `features_*` tables (canonical — every downstream model/rule reads from here only)
- [ ] `baselines/compute_baselines.py` + `hierarchy.py` — category × state × project-size-bucket baselines (median, IQR, percentiles), versioned
- [ ] Statistical/trend engine: `ml/trend/mann_kendall.py`, `ml/trend/changepoint.py` (PELT via `ruptures`)
- **Done when:** `/trends/financial`, `/trends/operational`, `/trends/geographical` return real (sample-scale, explicitly labeled as such) data

### Phase 4 — Compliance (Rule Engine, no ML)
- [ ] `compliance/rules/rule_definitions.yaml` + `rule_engine.py` — implement every rule in Blueprint §16's table (expenditure-before-sanction, expenditure-exceeding-sanction, missing sanction, excessive delay, missing completion, financial/physical mismatch, duplicate payment patterns, unusual vendor concentration, missing evidence, invalid dates, inconsistent amounts, incomplete records)
- [ ] Severity mapping per rule (Critical/High/Medium/Low per Blueprint §16 table)
- **Done when:** `/compliance/violations` populated, all rule-based, zero ML dependency

### Phase 5 — Unsupervised ML (Anomaly Detection)
- [ ] `ml/base.py` — common interface (`fit`, `predict` → `{value, contributing_features, insufficient_data}`, `explain`)
- [ ] `ml/anomaly/isolation_forest.py` — trained per work category on the Step-1 feature vector from Blueprint §8 (amount, amount_zscore_within_category, days_since_sanction, inter_transaction_gap_days, vendor_concentration_pct, same_day_same_vendor_txn_count, payment_status, expenditure_to_sanction_pct_after_this_txn)
- [ ] `ml/anomaly/lof.py` — Local Outlier Factor as secondary, catches cluster-local anomalies IF catches missed
- [ ] Register in `model_registry` with full version contract (training_dataset_version, feature_version, hyperparameters, eval_metrics, artifact_path, code_version)
- **Done when:** `/works/{id}` shows anomaly score + top contributing features; a synthetic outlier scores clearly above a synthetic normal point (unit test)

### Phase 6 — NLP (Duplicate Work Detection)
- [ ] `ml/nlp/embed.py` — Sentence-Transformers embedding pipeline (frozen, pretrained, no training)
- [ ] `ml/nlp/duplicate_search.py` — pgvector ANN search + the 3-level funnel from Blueprint §10: exact Work ID match → fuzzy string match (token-sort ratio) → semantic cosine similarity
- [ ] Contextual gate: elevate to duplicate candidate only when similarity ≥ threshold **AND** matching location/category/amount-tolerance/date-proximity (Blueprint §10 worked example)
- [ ] `ml/nlp/calibration.py` — precision/recall sensitivity curve at 0.80/0.85/0.90 cosine thresholds to justify the chosen cutoff
- **Done when:** `/works/duplicates` returns calibrated candidates; injected paraphrased-duplicate test pairs from Phase 1 are correctly surfaced

### Phase 7 — Risk Fusion & Alerts
- [ ] `ml/risk/fusion.py` — **Phase 1 only for SIH**: weighted sum of normalized (0–1) component scores (cost/payment/vendor/delay/duplicate/compliance/evidence risk), weights from `config_risk_weights`, reviewable/editable, not learned yet (Architecture Part 14 — do not skip ahead to a learned model without labels)
- [ ] `alerts/engine.py` — compares new vs. previous `risk_scores` per work_id; emits `alerts` row on severity-band change (🟢0–39 / 🟡40–64 / 🟠65–84 / 🔴85–100), scoped incrementally per §5 Phase 2's row_hash mechanism
- [ ] `POST /api/v1/reviews` — writes `review_outcomes` + `audit_log`; this is the write path that will feed Phase 3 fusion recalibration post-SIH
- **Done when:** `/alerts` populated, alert generation is severity-change-triggered (not a blind recompute-everything job); the worked example in Blueprint §27 / Architecture §33 reproduces end-to-end with synthetic data

### Phase 8 — Predictive (Delay Risk) — stretch if time allows
- [ ] `ml/prediction/delay_logreg.py` — MVP baseline: logistic regression on category/state/size/sanction-delay/early-expenditure-velocity
- [ ] `ml/prediction/delay_survival.py` — if time allows: Cox PH / survival model for "P(on-time completion) is dropping" rather than a binary label
- [ ] `insufficient_data` fallback if `min_training_samples` not met
- **Done when:** `/predictions/delay/{work_id}` returns a probability + `insufficient_data` fallback tested explicitly

### Phase 9 — API Layer (full contract)
Implement per Architecture Part 21/2 mapping table:
```
GET  /api/v1/dashboard/overview
GET  /api/v1/trends/financial
GET  /api/v1/trends/operational
GET  /api/v1/trends/geographical
GET  /api/v1/mp/{id}/overview
GET  /api/v1/constituency/{id}/overview
GET  /api/v1/works/{work_id}
GET  /api/v1/works/{work_id}/duplicates
GET  /api/v1/works/overruns
GET  /api/v1/vendors/risk
GET  /api/v1/vendors/{id}/network
GET  /api/v1/compliance/violations
GET  /api/v1/payments/duplicates
GET  /api/v1/alerts
POST /api/v1/reviews
GET  /api/v1/models/status
GET  /api/v1/data-quality
GET  /api/v1/calamity
POST /api/v1/assistant/ask          # stretch, GenAI
```
- [ ] Every response follows the graceful-degradation convention: insufficient data → HTTP 200 `{"status":"insufficient_data","fallback_used":"..."}`, never a 500
- **Done when:** contract tests pass for every route including the `insufficient_data` shape

### Phase 10 — Frontend (Next.js)
- [ ] Auth: NextAuth/Auth.js credentials provider, roles: `mp`, `district`/`ida`, `state`, `ministry`/`admin`
- [ ] Build all 14 dashboard routes per §2 — reuse `RiskBreakdownPanel`, `LifecycleTimeline`, `PeerBenchmarkChart`, `DuplicateCompareCard` across pages rather than duplicating logic per page
- [ ] Every page: loading skeleton, explicit empty-state for `insufficient_data` (not a blank chart), error toast on failure, server-side pagination for list views, React Query short-TTL caching
- [ ] **Lint rule**: no numeric literal in JSX outside test files — every figure must be bound to an API response field (Architecture Part 22 — this is a real ESLint rule to add, not just a guideline)
- **Done when:** all pages wired to real APIs, zero hardcoded numbers, `Work 360°` view reproduces the Blueprint §27 worked example live

### Phase 11 — GenAI Assistant (stretch)
- [ ] `genai/tools.py` — fixed functions only: `get_risk_breakdown(work_id)`, `get_peer_benchmark(work_id)`, `get_vendor_profile(vendor_id)`, `compare_constituencies(geo_id_a, geo_id_b)`
- [ ] `genai/agent.py` — Claude API, tool-calling mode, LLM narrates retrieved JSON only, never computes/invents a number
- **Done when:** "Why is this work high risk?" returns a grounded answer traceable entirely to `get_risk_breakdown` output

### Phase 12 — Polish & Demo Prep
- [ ] Curate a demo storyline: hand-pick 5–8 flagged synthetic works reproducing the Blueprint §27 examples (cost overrun, delayed project, duplicate work) for pitch reliability
- [ ] README with setup + architecture diagram (reuse Architecture Part 1 diagram)
- [ ] Prepare judge Q&A talking points verbatim from Blueprint §32 — the team should be able to recite the "why not just rules" and "how do you prevent false positives" answers
- **Done when:** `docker compose up` → seed → pipeline run → browse all dashboards works with zero manual DB edits; limitations table (Blueprint §29) is ready to show unprompted

---

## 6. Non-Negotiable Constraints for the Agent

1. Do NOT run ML inference (IsolationForest/LOF/sentence-transformers/survival models) inside Next.js — Python services only, called via FastAPI.
2. Every alert must carry: contributing indicators, the exact peer-benchmark baseline compared against, `baseline_version`, `model_id`/`model_version` — never a bare score.
3. Ground-truth synthetic labels (§4) must never be read by any detection model — eval-only.
4. All dates ISO8601. All money values as integers (paise) to avoid float rounding bugs.
5. Every threshold that could change as data accumulates goes in `baselines` (DB, versioned) — not Python, not JSX. Every environment-dependent value goes in `.env`/YAML. Every value that only changes with an actual law/rule change is `official_rule`-tagged config.
6. No "fraud" language anywhere in UI copy, alert text, or API response fields — "risk indicator," "flagged for review," "requires investigation."
7. Do not build Kafka, Neo4j, Kubernetes, Feast, Prophet/ARIMA, or trained-from-scratch transformer/autoencoder models — see §1 exclusion list. If a task seems to need one of these, re-read Architecture Part 32 before proceeding; the source doc has already reasoned through why each is unjustified at this scale.
8. Keep every `ml/*/train.py` and `infer.py` runnable standalone in addition to being importable by the API layer, for independent testing.

---

## 7. Definition of Done (Prototype)

- [ ] `docker compose up` brings up full stack with one command
- [ ] Synthetic dataset seeded with labeled anomalies (ground truth isolated from detection pipeline)
- [ ] Incremental pipeline verified: a single-row change only recomputes that Work ID's downstream features/rules/scores
- [ ] All five detection layers (Rule, Statistical, Unsupervised ML, NLP, Predictive) running and feeding Risk Fusion Phase 1
- [ ] All 14 dashboard pages functional against live API data, zero hardcoded numbers
- [ ] Precision/recall/false-positive-rate against synthetic ground truth documented in README, including the NLP similarity-threshold sensitivity curve
- [ ] Demo storyline curated and reproducible for the pitch
- [ ] Judge Q&A talking points (Blueprint §32) rehearsed

---

*Companion documents: `docs/MPLADS_AIML_Blueprint.md` (product/detection logic, 33 sections) and `docs/MPLADS_Technical_Architecture.md` (engineering spec, 36 sections). This file only sequences and adapts them — all detection logic, schema, and architectural reasoning should be pulled from those two documents, not re-derived.*