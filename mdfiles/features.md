Feature List — MPLADS Sentinel
🔴 Detection Layers (the core engine)

1. Rule Engine (deterministic, no ML)

Expenditure before/after sanction validation
Expenditure exceeding sanctioned amount
Missing sanction / missing completion record
Invalid or impossible dates
Data completeness checks

2. Statistical Baseline Engine

Peer-group norms (category × state × project-size)
Cost/duration percentile ranking
Trend detection (Mann-Kendall, rolling averages)
Spending spike detection (rolling z-score)
Structural change-point detection (PELT)

3. Unsupervised ML — Anomaly Detection

Isolation Forest — multivariate expenditure/timing/vendor anomalies
Local Outlier Factor — cluster-local anomalies

4. NLP — Duplicate Work Detection

Sentence-embedding similarity search (pgvector ANN)
3-stage funnel: exact match → fuzzy match → semantic similarity
Contextual gating (location + category + amount + date match)

5. Predictive ML (stretch)

Delay-risk prediction (logistic regression / survival model)
"Will complete on time?" probability, before deadline breach

6. Risk Fusion

Weighted composite risk score (Cost, Payment, Vendor, Delay, Duplicate, Compliance, Evidence)
Severity bands: Low / Medium / High / Critical
Every score traceable to baseline + model version
🟢 Platform Features (what the user sees/does)
Role-based dashboards — MP, District, State, Ministry views
Work 360° view — full lifecycle timeline per work
Early Warning queue — risk-ranked case list
Duplicate Work Detector — side-by-side comparison, confirm/reject
Vendor Intelligence — concentration ranking, network view
Compliance Dashboard — rule violations by type/severity
Financial/Operational/Geographical Analytics — trends, benchmarks, heatmaps
Explainable alerts — plain-language "flagged because…" for every score
Review workflow — Confirm / Dismiss / Escalate, feeds back into recalibration
Data Quality Dashboard — quarantined rows, ingestion issues
Natural-language query / GenAI assistant (stretch) — "why is this flagged?"
Model Monitoring — active model versions, drift status