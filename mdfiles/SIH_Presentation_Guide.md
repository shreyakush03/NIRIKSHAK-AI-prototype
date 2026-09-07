# NIRIKSHAK-AI: Comprehensive Presentation Guide for SIH 2026 Judges

Use this guide as your detailed cheat sheet when presenting the Nirikshak-AI prototype to the Smart India Hackathon judges. It provides a deep dive into the architecture, the machine learning models, the engineered features, and a breakdown of exactly what is on each page of the frontend prototype.

## 1. The Core Pitch
> "Nirikshak-AI is an automated risk intelligence and anomaly detection platform built for the Member of Parliament Local Area Development Scheme (MPLADS). Our goal is to monitor fund utilization, detect administrative delays, prevent budget leakage, and identify systemic irregularities across all 543 Lok Sabha constituencies in real-time."

---

## 2. Frontend Application: Page-by-Page Breakdown
When giving a demo, navigate through the platform and explain these key pages:

### 📍 Landing Page / Main Dashboard (`/`)
*The executive summary view of the entire nation.*
- **Top Metrics Strip**: Live aggregated statistics showing total funds tracked (₹875+ Cr), total works, and critical flags. This data is pulled dynamically from the DuckDB backend.
- **Dynamic India Choropleth Map**: An interactive map powered by D3/TopoJSON. The state colors (Green, Yellow, Orange, Red) are autonomously driven by the backend ML pipeline based on the exact number of anomalies detected in each state.
- **Highest-Risk Constituencies List**: A live leaderboard of the Top 10 works flagged by the ML model with a risk score near 100%. Shows the primary reason for the flag (e.g., "Cost Outlier", "Delay Risk").
- **Anomaly Distribution Chart**: A horizontal bar chart summarizing the frequency of different anomaly types (e.g., Cost Benchmark Outliers, Missing Evidence) across the dataset.

### 📍 ML Diagnostics Dashboard (`/ml-dashboard`)
*The "under-the-hood" view for auditors and data scientists.*
- Displays the health and status of the ML models.
- Visualizes data distributions, pipeline execution times, and feature importance (showing which features the AI relies on most to flag fraud).

### 📍 Project / Work 360 View (`/projects/[id]`)
*The deep dive into a specific MPLADS project.*
- Shows a comprehensive "Work 360" profile.
- Displays the exact 118 feature values for the project.
- Explains the Risk Score using peer-benchmark comparisons (e.g., comparing this project's cost to the median cost of similar projects in the same district).

### 📍 State & Constituency Overviews (`/states` & `/overview`)
*The geographical drill-down.*
- Allows users to click into a specific state (e.g., Uttar Pradesh) to see regional utilization rates, pending project ratios, and state-specific anomaly trends.

---

## 3. Machine Learning Architecture (The "Brain")
Impress the judges by explaining exactly how the AI works. We built a robust pipeline that processes **378,621 raw records**, standardizes them into **75,501 unique canonical projects**, and engineers **118 unique features** for every single project.

### The 118 Engineered Features
Instead of just looking at raw numbers, the pipeline computes advanced features:
- **Financial Gaps**: Sanction vs. Recommended cost, Disbursement vs. Expenditure.
- **Velocity & Temporal Deltas**: Time taken from recommendation to sanction, execution duration against category medians.
- **Text Complexity**: NLP metrics on project descriptions to detect suspiciously vague justifications.
- **Historical Aggregates**: Vendor concentration metrics and MP past performance.

### The ML Models
| Algorithm / Model | Technical Purpose | Business Value |
|-------------------|-------------------|----------------|
| **Isolation Forest (Unsupervised ML)** | Multivariate anomaly detection. Evaluates the 118 features simultaneously to find multi-dimensional outliers. | Automatically identifies the "Highest-Risk" works (e.g., Cost Outliers) and assigns a 0-100 Risk Score without needing manual human rules. |
| **Sentence-Transformers (NLP)** | Generates vector embeddings of project descriptions, performing Approximate Nearest Neighbor (pgvector/ANN) search. | Detects **Ghost Works / Duplicates**. Prevents double-funding for the exact same project described using slightly different words. |
| **Calibrated Logistic Regression / XGBoost** | Risk Fusion. | Stacks multiple anomaly signals together to output a single, highly calibrated probability of fraud or severe delay. |
| **Fuzzy Entity Resolution** | Uses Levenshtein distance and financial matching algorithms to clean messy government data. | Merges scattered, messy CSV rows into canonical, tracked Work IDs. |

---

## 4. Software & Tech Stack
If they ask about your engineering stack, this is what you are running:
- **Frontend**: Next.js (React) + Tailwind CSS. Hosted on **Vercel** for edge-optimized delivery.
- **Backend**: FastAPI (Python). Containerized via Docker and hosted on **Railway**.
- **Database / Analytics**: **DuckDB** (OLAP engine). *Crucial talking point:* Mention that DuckDB allows you to run massive analytical queries across hundreds of thousands of rows in milliseconds, entirely in-memory, without needing a bulky traditional database cluster.
- **Geospatial UI**: D3.js / TopoJSON powering the dynamic map.

---

## 5. Future Roadmap (The "What's Next")
Judges love to hear how the project scales into production. Tell them:
> "Currently, the ML pipeline processes a static snapshot of the MPLADS dataset to ensure a stable testing environment for the prototype. For production, the architecture is designed around **Celery + Cron / Prefect**. We will deploy a Python-based web scraper that automatically downloads the latest dataset from `mplads.gov.in` on a schedule, re-runs the Isolation Forest model, updates DuckDB, and instantly reflects the new risks on the dashboard without human intervention."
