# NIRIKSHAK-AI: Complete Datasets, Feature Dictionary & Training Tables Catalog

**Document Scope:** Full listing of all dataset files, precomputed ML training tables, and the complete 118-feature engineering catalog with target leakage audit status.

---

# 1. Complete Dataset Inventory

The NIRIKSHAK-AI platform integrates **6 core datasets** across both Houses of Parliament (**378,621 total standardized records**):

### Lok Sabha Standardized Datasets (`data/standardized/lok_sabha/`)
| # | Dataset Name | Standardized File Name | Rows | Columns | Purpose / Scope |
|---|---|---|---:|---:|---|
| **1** | **Allocation Master** | `allocation_standardized.csv` | **544** | 5 | MP-level entitlement allocation limits |
| **2** | **Calamity Consents** | `calamity_standardized.csv` | **13** | 6 | Disaster relief emergency financial consents by MPs |
| **3** | **Recommended Works** | `recommended_standardized.csv` | **103,393** | 11 | Initial development work proposals recommended by MPs |
| **4** | **Sanctioned Works** | `sanctioned_standardized.csv` | **78,287** | 12 | Administratively approved works & sanction budgets |
| **5** | **Expenditure Transactions** | `expenditure_standardized.csv` | **83,016** | 11 | Multi-stage payment disbursements & vendor transactions |
| **6** | **Completed Works** | `completed_standardized.csv` | **33,976** | 11 | Physically completed & site-verified works |

### Rajya Sabha Standardized Datasets (`data/standardized/rajya_sabha/`)
| # | Dataset Name | Standardized File Name | Rows | Columns | Purpose / Scope |
|---|---|---|---:|---:|---|
| **1** | **Allocation Master** | `Allocated Limit for Honble MPs (4)_standardized.csv` | **232** | 5 | MP-level allocation ceiling limits |
| **2** | **Calamity Consents** | `Amount consented for Calamity (3)_standardized.csv` | **21** | 6 | Disaster relief emergency financial consents |
| **3** | **Recommended Works** | `Works Recommended (2)_standardized.csv` | **24,948** | 11 | Initial proposals submitted by Hon'ble MPs |
| **4** | **Sanctioned Works** | `Works Sanctioned (7)_standardized.csv` | **19,312** | 12 | Approved works & sanction budgets |
| **5** | **Expenditures** | `Expenditure on Completed and On-going Works as on Date (2)_standardized.csv` | **24,967** | 11 | Multi-stage payment disbursements |
| **6** | **Completed Works** | `Works Completed (8)_standardized.csv` | **9,912** | 11 | Physically completed & site-verified works |

---

# 2. Precomputed Training Feature Tables

The feature engineering pipeline computes and persists training tables under `data/features/{house}/`:

| Training Table File | Granularity / Entity | Lok Sabha Rows | Rajya Sabha Rows | Features / Columns | Description |
|---|---|---:|---:|---:|---|
| **`work_features.csv`** | **Canonical Work Level** | **59,653** | **15,848** | **118 features** | Primary ML matrix linking proposal, sanction, transactions, and status |
| **`mp_features.csv`** | MP Level | 540 | 230 | 18 features | MP historical completion rate, total recommendations, average duration |
| **`constituency_features.csv`** | District Level | 539 | 230 | 14 features | Constituency fund absorption rate, sanction backlogs |
| **`state_features.csv`** | State Level | 37 | 36 | 12 features | Macro-level state execution percentiles |
| **`transaction_features.csv`** | Payment Level | 83,016 | 24,967 | 15 features | Granular transaction velocity and vendor payment patterns |
| **`vendor_features.csv`** | Vendor Level | 12 | 8 | 10 features | Contracting agency load and completion records |
| **`feature_dictionary.csv`** | Feature Metadata | 118 | 118 | 11 columns | Data types, distribution min/max/mean, and descriptions |
| **`feature_leakage_report.csv`** | Leakage Audit | 118 | 118 | 6 columns | Audit classification separating training signals from post-outcome features |

---

# 3. Exhaustive 118-Feature Catalog & Leakage Status

All 118 features present in `work_features.csv` are audited and classified into:
* **`AVAILABLE_AT_PREDICTION` (88 Features):** Valid features known *prior* to project outcome; safe for machine learning model training vectors.
* **`POST_PREDICTION` (30 Features):** Post-outcome features (e.g., actual completion dates/costs); strictly excluded from baseline inputs to prevent data leakage.

| # | Feature Name | Domain Group | Data Type | Model Training Status |
|---|---|---|---|---|
| 001 | `canonical_work_id` | Entity Identifier | `string` | Unique Primary Key |
| 002 | `official_work_id` | Entity Identifier | `string` | Departmental Work Key |
| 003 | `parliament` | Entity Identifier | `string` | House Categorical (`lok_sabha`/`rajya_sabha`) |
| 004 | `state` | Geographic | `string` | Categorical |
| 005 | `constituency` | Geographic | `string` | Categorical |
| 006 | `mp_name` | Historical Aggregation | `string` | Categorical |
| 007 | `work_category` | General Category | `string` | Categorical (Sector) |
| 008 | `work_description` | Text Complexity | `string` | Raw Description Text |
| 009 | `recommended_date` | Temporal Lifecycle | `string` | Date Feature |
| 010 | `recommended_amount` | Financial Dynamics | `float64` |  **Training Feature** |
| 011 | `sanction_date` | Temporal Lifecycle | `string` | Date Feature |
| 012 | `sanction_amount` | Financial Dynamics | `float64` |  **Training Feature** |
| 013 | `completion_date` | Temporal Lifecycle | `string` | ❌ *POST_PREDICTION (Target Horizon)* |
| 014 | `completion_amount` | Financial Dynamics | `float64` | ❌ *POST_PREDICTION (Target Cost)* |
| 015 | `expenditure_amount` | Financial Dynamics | `float64` |  **Training Feature** |
| 016 | `expenditure_transaction_count` | Financial Dynamics | `int64` |  **Training Feature** |
| 017 | `first_expenditure_date` | Financial Dynamics | `string` | Date Feature |
| 018 | `last_expenditure_date` | Financial Dynamics | `string` | ❌ *POST_PREDICTION* |
| 019 | `vendor_name` | Historical Aggregation | `string` | Categorical |
| 020 | `ida_agency` | Entity Identifier | `string` | Categorical (Implementing Authority) |
| 021 | `work_status` | General Status | `string` |  **Training Feature** |
| 022 | `er_match_score` | Entity Resolution | `float64` |  **Training Feature** |
| 023 | `er_confidence` | Entity Resolution | `string` | Categorical (`HIGH`/`MEDIUM`/`LOW`) |
| 024 | `er_method` | Entity Resolution | `string` | Categorical (`exact`/`fuzzy`) |
| 025 | `has_recommendation` | General Indicator | `int64` |  **Training Feature** |
| 026 | `has_sanction` | General Indicator | `int64` |  **Training Feature** |
| 027 | `has_expenditure` | Financial Indicator | `int64` |  **Training Feature** |
| 028 | `has_completion` | General Indicator | `int64` | ❌ *POST_PREDICTION (Target)* |
| 029 | `has_official_work_id` | Entity Indicator | `int64` |  **Training Feature** |
| 030 | `has_canonical_work_id` | Entity Indicator | `int64` |  **Training Feature** |
| 031 | `entity_resolution_score` | Entity Resolution | `float64` |  **Training Feature** |
| 032 | `entity_resolution_confidence`| Entity Resolution | `string` | Categorical |
| 033 | `entity_resolution_method` | Entity Resolution | `string` | Categorical |
| 034 | `entity_resolution_uncertain` | Entity Resolution | `int64` |  **Training Feature** |
| 035 | `entity_resolution_review_required`| Entity Resolution | `int64` |  **Training Feature** |
| 036 | `recommendation_sanction_amount_difference` | Financial Gap | `float64` |  **Training Feature** |
| 037 | `sanction_expenditure_amount_difference` | Financial Gap | `float64` |  **Training Feature** |
| 038 | `sanction_completion_amount_difference` | Financial Gap | `float64` | ❌ *POST_PREDICTION* |
| 039 | `recommended_expenditure_difference` | Financial Gap | `float64` |  **Training Feature** |
| 040 | `recommendation_to_sanction_amount_change_pct`| Financial Gap | `float64` |  **Training Feature** |
| 041 | `sanction_to_expenditure_amount_change_pct` | Financial Gap | `float64` |  **Training Feature** |
| 042 | `sanction_to_completion_amount_change_pct` | Financial Gap | `float64` | ❌ *POST_PREDICTION* |
| 043 | `expenditure_to_sanction_ratio` | Financial Gap | `float64` |  **Training Feature** |
| 044 | `expenditure_utilization_percentage` | Financial Gap | `float64` |  **Training Feature** |
| 045 | `completion_to_sanction_ratio` | Financial Gap | `float64` | ❌ *POST_PREDICTION* |
| 046 | `completion_amount_percentage` | Financial Gap | `float64` | ❌ *POST_PREDICTION* |
| 047 | `recommended_to_sanction_ratio` | Financial Gap | `float64` |  **Training Feature** |
| 048 | `unspent_amount` | Financial Dynamics | `float64` | ❌ *POST_PREDICTION* |
| 049 | `remaining_sanctioned_amount` | Financial Dynamics | `float64` |  **Training Feature** |
| 050 | `expenditure_gap` | Financial Dynamics | `float64` |  **Training Feature** |
| 051 | `completion_financial_gap` | Financial Dynamics | `float64` | ❌ *POST_PREDICTION* |
| 052 | `expenditure_exceeds_sanction_flag` | Financial Anomaly | `int64` |  **Training Feature** |
| 053 | `negative_expenditure_flag` | Financial Anomaly | `int64` |  **Training Feature** |
| 054 | `negative_sanction_flag` | Financial Anomaly | `int64` |  **Training Feature** |
| 055 | `zero_sanction_flag` | Financial Anomaly | `int64` |  **Training Feature** |
| 056 | `zero_expenditure_flag` | Financial Anomaly | `int64` |  **Training Feature** |
| 057 | `large_amount_change_flag` | Financial Anomaly | `int64` |  **Training Feature** |
| 058 | `unusually_high_expenditure_ratio` | Financial Anomaly | `int64` |  **Training Feature** |
| 059 | `sanction_year` | Temporal Lifecycle | `float64` |  **Training Feature** |
| 060 | `sanction_month` | Temporal Lifecycle | `float64` |  **Training Feature** |
| 061 | `sanction_quarter` | Temporal Lifecycle | `float64` |  **Training Feature** |
| 062 | `sanction_financial_year` | Temporal Lifecycle | `string` | Categorical |
| 063 | `sanction_day_of_week` | Temporal Lifecycle | `float64` |  **Training Feature** |
| 064 | `recommendation_year` | Temporal Lifecycle | `float64` |  **Training Feature** |
| 065 | `recommendation_month` | Temporal Lifecycle | `float64` |  **Training Feature** |
| 066 | `recommendation_quarter` | Temporal Lifecycle | `float64` |  **Training Feature** |
| 067 | `completion_year` | Temporal Lifecycle | `float64` | ❌ *POST_PREDICTION* |
| 068 | `completion_month` | Temporal Lifecycle | `float64` | ❌ *POST_PREDICTION* |
| 069 | `completion_quarter` | Temporal Lifecycle | `float64` | ❌ *POST_PREDICTION* |
| 070 | `recommendation_to_sanction_days` | Lifecycle Duration | `float64` |  **Training Feature** |
| 071 | `sanction_to_first_expenditure_days` | Lifecycle Duration | `float64` |  **Training Feature** |
| 072 | `sanction_to_last_expenditure_days` | Lifecycle Duration | `float64` | ❌ *POST_PREDICTION* |
| 073 | `sanction_to_completion_days` | Lifecycle Duration | `float64` | ❌ *POST_PREDICTION (Target Horizon)* |
| 074 | `first_expenditure_to_completion_days` | Lifecycle Duration | `float64` | ❌ *POST_PREDICTION* |
| 075 | `recommendation_to_completion_days` | Lifecycle Duration | `float64` | ❌ *POST_PREDICTION* |
| 076 | `expenditure_span_days` | Lifecycle Duration | `float64` |  **Training Feature** |
| 077 | `total_execution_days` | Lifecycle Duration | `float64` |  **Training Feature** |
| 078 | `recommendation_before_sanction` | Chronology | `int64` |  **Training Feature** |
| 079 | `sanction_before_expenditure` | Chronology | `int64` |  **Training Feature** |
| 080 | `expenditure_before_completion` | Chronology | `int64` | ❌ *POST_PREDICTION* |
| 081 | `sanction_before_completion` | Chronology | `int64` | ❌ *POST_PREDICTION* |
| 082 | `recommendation_sanction_chronology_issue`| Chronology Anomaly | `int64` |  **Training Feature** |
| 083 | `sanction_expenditure_chronology_issue` | Chronology Anomaly | `int64` |  **Training Feature** |
| 084 | `sanction_completion_chronology_issue` | Chronology Anomaly | `int64` | ❌ *POST_PREDICTION* |
| 085 | `expenditure_completion_chronology_issue` | Chronology Anomaly | `int64` | ❌ *POST_PREDICTION* |
| 086 | `valid_lifecycle_sequence` | Chronology | `int64` |  **Training Feature** |
| 087 | `lifecycle_stage_count` | Chronology | `int64` |  **Training Feature** |
| 088 | `lifecycle_completion_percentage` | Chronology | `float64` | ❌ *POST_PREDICTION* |
| 089 | `lifecycle_missing_stage_count` | Chronology | `int64` |  **Training Feature** |
| 090 | `lifecycle_status` | General Status | `string` | Categorical |
| 091 | `work_description_length` | Text Complexity | `int64` |  **Training Feature** |
| 092 | `work_description_word_count` | Text Complexity | `int64` |  **Training Feature** |
| 093 | `has_work_description` | Text Complexity | `int64` |  **Training Feature** |
| 094 | `work_description_missing` | Text Complexity | `int64` |  **Training Feature** |
| 095 | `unique_word_count` | Text Complexity | `int64` |  **Training Feature** |
| 096 | `average_word_length` | Text Complexity | `float64` |  **Training Feature** |
| 097 | `uppercase_ratio` | Text Complexity | `float64` |  **Training Feature** |
| 098 | `digit_ratio` | Text Complexity | `float64` |  **Training Feature** |
| 099 | `punctuation_ratio` | Text Complexity | `float64` |  **Training Feature** |
| 100 | `very_short_text_flag` | Text Anomaly | `int64` |  **Training Feature** |
| 101 | `very_long_text_flag` | Text Anomaly | `int64` |  **Training Feature** |
| 102 | `mp_historical_work_count` | MP Performance | `int64` |  **Training Feature** |
| 103 | `mp_historical_completed_count` | MP Performance | `float64` |  **Training Feature** |
| 104 | `mp_historical_completion_rate` | MP Performance | `float64` | ❌ *POST_PREDICTION* |
| 105 | `state_historical_work_count` | State Performance | `int64` |  **Training Feature** |
| 106 | `state_historical_completion_rate` | State Performance | `float64` | ❌ *POST_PREDICTION* |
| 107 | `constituency_historical_work_count` | District Performance| `int64` |  **Training Feature** |
| 108 | `constituency_historical_completion_rate`| District Performance| `float64`| ❌ *POST_PREDICTION* |
| 109 | `vendor_historical_work_count` | Vendor Performance | `int64` |  **Training Feature** |
| 110 | `vendor_historical_completion_rate` | Vendor Performance | `float64` | ❌ *POST_PREDICTION* |
| 111 | `log_sanctioned_amount` | Statistical | `float64` |  **Training Feature** |
| 112 | `log_execution_days` | Statistical | `float64` |  **Training Feature** |
| 113 | `amount_percentile` | Statistical | `float64` |  **Training Feature** |
| 114 | `amount_z_score` | Statistical | `float64` |  **Training Feature** |
| 115 | `amount_iqr_outlier_flag` | Outlier Anomaly | `int64` |  **Training Feature** |
| 116 | `execution_duration_percentile` | Statistical | `float64` |  **Training Feature** |
| 117 | `duration_z_score` | Statistical | `float64` |  **Training Feature** |
| 118 | `duration_iqr_outlier_flag` | Outlier Anomaly | `int64` |  **Training Feature** |
