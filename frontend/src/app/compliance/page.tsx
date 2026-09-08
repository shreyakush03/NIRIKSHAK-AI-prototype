"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  Search,
  ArrowUpRight,
  Info,
  Scale,
  RefreshCw,
  Award,
} from "lucide-react";
import Link from "next/link";
import RulesAndLegalProcedure from "@/components/features/RulesAndLegalProcedure";
import ComplianceHealthGauge from "@/components/features/ComplianceHealthGauge";

interface RuleBreakdown {
  code: string;
  title: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  category: string;
  violations_count: number;
  passed_count: number;
  compliance_rate: number;
}

interface StateRanking {
  state: string;
  total_projects: number;
  violations_count: number;
  compliance_score: number;
  risk_tier: string;
}

interface ComplianceSummary {
  health_score: number;
  total_audited: number;
  total_violations: number;
  critical_violations: number;
  high_violations: number;
  medium_violations: number;
  rule_breakdown: RuleBreakdown[];
  state_rankings: StateRanking[];
}

interface ViolationItem {
  id: string;
  work_id: string;
  work_description: string;
  state: string;
  constituency: string;
  mp_name: string;
  rule_code: string;
  rule_title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  category: string;
  details: string;
  sanctioned_amount: number;
  expenditure_amount: number;
  lifecycle_status: string;
  parliament: string;
}

export default function CompliancePage() {
  const [parliament, setParliament] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"dashboard" | "legal_procedure">("dashboard");
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [violations, setViolations] = useState<ViolationItem[]>([]);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [loadingViolations, setLoadingViolations] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [ruleFilter, setRuleFilter] = useState<string>("ALL");

  useEffect(() => {
    fetchSummary();
    fetchViolations();
  }, [parliament]);

  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch(`/api/compliance/summary?parliament=${parliament}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSummary(json.data);
      }
    } catch (err) {
      console.error("Failed to load compliance summary:", err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchViolations = async () => {
    setLoadingViolations(true);
    try {
      const res = await fetch(`/api/compliance/violations?parliament=${parliament}&limit=200`);
      const json = await res.json();
      if (json.success && json.data?.violations) {
        setViolations(json.data.violations);
      }
    } catch (err) {
      console.error("Failed to load compliance violations:", err);
    } finally {
      setLoadingViolations(false);
    }
  };

  // Filtered violations
  const filteredViolations = violations.filter((v) => {
    const matchesSearch =
      searchQuery === "" ||
      v.work_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.work_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.mp_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.state.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity = severityFilter === "ALL" || v.severity === severityFilter;
    const matchesRule = ruleFilter === "ALL" || v.rule_code === ruleFilter;

    return matchesSearch && matchesSeverity && matchesRule;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-xs font-black border border-red-200 shadow-sm">
            <AlertOctagon className="w-3.5 h-3.5 text-red-600" /> CRITICAL
          </span>
        );
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-xs font-black border border-amber-200 shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> HIGH
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-xs font-black border border-blue-200 shadow-sm">
            <Info className="w-3.5 h-3.5 text-blue-600" /> MEDIUM
          </span>
        );
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSeverityFilter("ALL");
    setRuleFilter("ALL");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-8 px-4 sm:px-6 lg:px-8 font-body">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Page Header */}
        <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-extrabold tracking-wider uppercase border border-indigo-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> MoSPI Statutory Compliance Audit
            </div>
            <h1 className="text-3xl sm:text-4xl font-black font-headline tracking-tight text-slate-900">
              Automated Compliance Monitoring
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl font-medium leading-relaxed">
              Continuous verification of MPLADS development projects against 7 statutory compliance rules, General Financial Rules (GFR), and PFMS guidelines.
            </p>
          </div>

          {/* Parliament Filter Pills */}
          <div className="inline-flex p-1.5 rounded-xl bg-slate-100 border border-slate-200 self-start md:self-auto shadow-inner">
            <button
              onClick={() => setParliament("all")}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${
                parliament === "all"
                  ? "bg-primary text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Parliaments
            </button>
            <button
              onClick={() => setParliament("lok_sabha")}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${
                parliament === "lok_sabha"
                  ? "bg-primary text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Lok Sabha
            </button>
            <button
              onClick={() => setParliament("rajya_sabha")}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${
                parliament === "rajya_sabha"
                  ? "bg-primary text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Rajya Sabha
            </button>
          </div>
        </div>

        {/* Top Tab Bar */}
        <div className="flex border-b border-slate-200 gap-8">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`pb-4 text-sm font-black flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "dashboard"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Audit Dashboard & Log
          </button>

          <button
            onClick={() => setActiveTab("legal_procedure")}
            className={`pb-4 text-sm font-black flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "legal_procedure"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Scale className="w-4 h-4" /> Statutory Rules & Legal Framework
          </button>
        </div>

        {/* Tab 2: Legal Procedure View */}
        {activeTab === "legal_procedure" ? (
          <RulesAndLegalProcedure />
        ) : (
          /* Tab 1: Dashboard View */
          <>
            {/* Health Score SVG Gauge Banner */}
            {loadingSummary ? (
              <div className="h-48 bg-white border border-slate-200 rounded-2xl animate-pulse" />
            ) : summary ? (
              <ComplianceHealthGauge
                score={summary.health_score}
                totalAudited={summary.total_audited}
                totalViolations={summary.total_violations}
                criticalCount={summary.critical_violations}
                highCount={summary.high_violations}
              />
            ) : null}

            {/* Quick Metrics Bar */}
            {summary && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                      Critical Violations
                    </span>
                    <div className="text-2xl font-black text-rose-600 mt-1">
                      {summary.critical_violations}
                    </div>
                  </div>
                  <div className="p-3 rounded-full bg-rose-50 border border-rose-100 text-rose-600">
                    <AlertOctagon className="w-6 h-6" />
                  </div>
                </div>

                <div className="p-4.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                      High Severity Violations
                    </span>
                    <div className="text-2xl font-black text-amber-600 mt-1">
                      {summary.high_violations}
                    </div>
                  </div>
                  <div className="p-3 rounded-full bg-amber-50 border border-amber-100 text-amber-600">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>

                <div className="p-4.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                      Medium Severity Violations
                    </span>
                    <div className="text-2xl font-black text-blue-600 mt-1">
                      {summary.medium_violations}
                    </div>
                  </div>
                  <div className="p-3 rounded-full bg-blue-50 border border-blue-100 text-blue-600">
                    <Info className="w-6 h-6" />
                  </div>
                </div>
              </div>
            )}

            {/* Statutory Rules Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black font-headline tracking-tight text-slate-900">
                    Statutory Rules Compliance Breakdown
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Click any rule card to filter the audit log table below
                  </p>
                </div>
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  7 Rules Monitored
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {summary?.rule_breakdown.map((rule) => {
                  const isSelected = ruleFilter === rule.code;

                  return (
                    <div
                      key={rule.code}
                      onClick={() => setRuleFilter(isSelected ? "ALL" : rule.code)}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer bg-white shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md hover:-translate-y-0.5 ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-slate-200 hover:border-indigo-200"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-mono font-bold text-slate-400">
                            {rule.code}
                          </span>
                          {getSeverityBadge(rule.severity)}
                        </div>

                        <h3 className="mt-3 font-extrabold text-slate-900 text-sm leading-snug">
                          {rule.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2 font-medium">
                          {rule.description}
                        </p>
                      </div>

                      <div className="space-y-2 pt-3 border-t border-slate-100">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-semibold">Compliance Pass Rate</span>
                          <span className="font-black text-slate-900">
                            {rule.compliance_rate}%
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              rule.compliance_rate >= 90
                                ? "bg-emerald-500"
                                : rule.compliance_rate >= 75
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                            style={{ width: `${rule.compliance_rate}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-[11px] pt-1 font-bold">
                          <span className="text-emerald-700">
                            Passed: {rule.passed_count.toLocaleString()}
                          </span>
                          <span className="text-rose-600">
                            Violations: {rule.violations_count.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* State Compliance Leaderboard */}
            {summary?.state_rankings && summary.state_rankings.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <div>
                      <h2 className="text-lg font-black font-headline text-slate-900">
                        State Compliance Leaderboard
                      </h2>
                      <p className="text-xs text-slate-500 font-medium">
                        Top states ranked by statutory compliance health score
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-mono font-bold">Top 10 States</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  {summary.state_rankings.map((st, i) => (
                    <div
                      key={st.state}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between transition-all hover:bg-white hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-slate-400">
                          {i === 0 ? "🥇 #1" : i === 1 ? "🥈 #2" : i === 2 ? "🥉 #3" : `#${i + 1}`}
                        </span>
                        <span
                          className={`font-black text-xs px-2.5 py-0.5 rounded-full border ${
                            st.compliance_score >= 80
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : st.compliance_score >= 60
                              ? "bg-amber-100 text-amber-800 border-amber-200"
                              : "bg-rose-100 text-rose-800 border-rose-200"
                          }`}
                        >
                          {st.compliance_score}%
                        </span>
                      </div>
                      <div className="mt-2.5 font-extrabold text-sm truncate text-slate-900">
                        {st.state}
                      </div>
                      <div className="mt-1.5 text-[11px] text-slate-500 flex justify-between font-semibold">
                        <span>{st.total_projects} works</span>
                        <span className="text-rose-600 font-extrabold">{st.violations_count} viols</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Violations Table Section */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black font-headline tracking-tight text-slate-900">
                    Statutory Violation Audit Log
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Displaying {filteredViolations.length} matching statutory non-compliance records
                  </p>
                </div>

                {/* Filter Bar */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search Input */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search MP, state, description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                    />
                  </div>

                  {/* Severity Filter */}
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="py-2 px-3 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
                  >
                    <option value="ALL">All Severities</option>
                    <option value="CRITICAL">CRITICAL Only</option>
                    <option value="HIGH">HIGH Only</option>
                    <option value="MEDIUM">MEDIUM Only</option>
                  </select>

                  {/* Rule Filter */}
                  <select
                    value={ruleFilter}
                    onChange={(e) => setRuleFilter(e.target.value)}
                    className="py-2 px-3 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
                  >
                    <option value="ALL">All Statutory Rules</option>
                    {summary?.rule_breakdown.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.title}
                      </option>
                    ))}
                  </select>

                  {/* Reset Filters */}
                  {(searchQuery || severityFilter !== "ALL" || ruleFilter !== "ALL") && (
                    <button
                      onClick={clearFilters}
                      className="p-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
                      title="Reset filters"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Table Container */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loadingViolations ? (
                  <div className="p-12 text-center text-sm text-slate-500 animate-pulse font-medium">
                    Running statutory compliance audit rules...
                  </div>
                ) : filteredViolations.length === 0 ? (
                  <div className="p-16 text-center text-sm text-slate-500 space-y-3">
                    <p className="font-medium">No statutory compliance violations found matching your filter criteria.</p>
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-white"
                    >
                      Clear Search Filters
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider font-black border-b border-slate-200">
                        <tr>
                          <th className="py-4 px-4">Severity</th>
                          <th className="py-4 px-4">Work ID & Description</th>
                          <th className="py-4 px-4">MP / Location</th>
                          <th className="py-4 px-4">Statutory Violation</th>
                          <th className="py-4 px-4">Audit Details</th>
                          <th className="py-4 px-4 text-right">Sanction / Exp</th>
                          <th className="py-4 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredViolations.map((v) => (
                          <tr
                            key={v.id}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="py-4 px-4 whitespace-nowrap">
                              {getSeverityBadge(v.severity)}
                            </td>

                            <td className="py-4 px-4 max-w-xs">
                              <div className="font-mono font-bold text-slate-900">
                                {v.work_id}
                              </div>
                              <div className="text-slate-600 font-medium line-clamp-2 mt-0.5">
                                {v.work_description}
                              </div>
                            </td>

                            <td className="py-4 px-4 whitespace-nowrap">
                              <div className="font-extrabold text-slate-900">
                                {v.mp_name}
                              </div>
                              <div className="text-slate-500 font-medium text-[11px]">
                                {v.constituency}, {v.state}
                              </div>
                            </td>

                            <td className="py-4 px-4 whitespace-nowrap">
                              <div className="font-extrabold text-slate-900">
                                {v.rule_title}
                              </div>
                              <div className="text-slate-400 font-mono text-[10px]">
                                {v.category}
                              </div>
                            </td>

                            <td className="py-4 px-4 max-w-sm">
                              <p className="text-slate-700 text-xs leading-relaxed font-medium">
                                {v.details}
                              </p>
                              <span className="inline-block mt-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                Status: {v.lifecycle_status}
                              </span>
                            </td>

                            <td className="py-4 px-4 text-right whitespace-nowrap">
                              <div className="font-mono font-bold text-slate-900">
                                ₹{v.expenditure_amount.toLocaleString("en-IN")}
                              </div>
                              <div className="text-slate-500 font-mono text-[11px]">
                                of ₹{v.sanctioned_amount.toLocaleString("en-IN")}
                              </div>
                            </td>

                            <td className="py-4 px-4 text-center whitespace-nowrap">
                              <Link
                                href={`/projects/${encodeURIComponent(v.work_id)}?parliament=${v.parliament}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-extrabold text-primary bg-primary/10 rounded-lg hover:bg-primary hover:text-white transition-all shadow-sm"
                              >
                                Inspect <ArrowUpRight className="w-3.5 h-3.5" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
