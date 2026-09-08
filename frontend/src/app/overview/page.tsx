"use client";

import React, { useState, useEffect } from "react";
import { OverviewData, DatasetSummary, StateSummary } from "@/types/overview";
import { getDashboardOverview, getStateAggregations } from "@/lib/api";
import StateCard from "@/components/features/StateCard";
import {
  Database,
  Layers,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  IndianRupee,
  Activity,
  BarChart3,
  MapPin,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Clock,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
const StatusDonut       = dynamic(() => import("@/components/charts/StatusDonut"),       { ssr: false });
const OverviewFinancial = dynamic(() => import("@/components/charts/OverviewFinancial"), { ssr: false });

export default function OverviewPage() {
  const [parliament, setParliament] = useState<string>("all");
  const [data, setData] = useState<OverviewData | null>(null);
  const [states, setStates] = useState<StateSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, statesRes] = await Promise.all([
        getDashboardOverview(parliament),
        getStateAggregations(parliament)
      ]);

      if (overviewRes && overviewRes.success && overviewRes.data && overviewRes.data.datasets) {
        setData(overviewRes.data);
      } else {
        throw new Error("Invalid response received from backend Overview API.");
      }

      if (statesRes && statesRes.success && Array.isArray(statesRes.data)) {
        setStates(statesRes.data);
      } else if (Array.isArray(statesRes)) {
        setStates(statesRes);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load overview data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [parliament]);

  const formatINR = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return "₹0";
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString()}`;
  };

  // Compute completed projects metrics directly from backend projectStatusMetrics or aggregated state totals
  const totalWorks = data?.projectStatusMetrics?.totalWorks ?? states.reduce((acc, s) => acc + s.totalProjects, 0);
  const completedWorks = data?.projectStatusMetrics?.completedWorks ?? states.reduce((acc, s) => acc + s.completedProjects, 0);
  const ongoingWorks = data?.projectStatusMetrics?.ongoingWorks ?? states.reduce((acc, s) => acc + s.ongoingProjects, 0);
  const pendingWorks = data?.projectStatusMetrics?.pendingWorks ?? states.reduce((acc, s) => acc + s.pendingProjects, 0);
  const completedAmount = data?.projectStatusMetrics?.completedAmount ?? states.reduce((acc, s) => acc + s.completedAmount, 0);
  const completionPercentage = totalWorks > 0 ? ((completedWorks / totalWorks) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex flex-col font-body pb-24">
      {/* Alert Bar for Last Scraped Data */}
      {data?.pipeline?.lastUpdated && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center justify-center gap-2 mb-6">
          <Database className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            Last Synced Data: <span className="font-bold">{data.pipeline.lastUpdated}</span> (Simulated MOSPI Scrape)
          </span>
        </div>
      )}
      
      <div className="flex flex-col gap-10">
      {/* Header & Parliament Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-2 border border-primary/20">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Centralized 6-Dataset Integration
          </div>
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl text-gray-900 tracking-tight">
            MPLADS Ecosystem Overview
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Dynamic data calculated across 75,501 works, 36 States/UTs, and 6 core datasets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-gray-100 p-1.5 rounded-xl flex text-xs font-bold shadow-inner">
            <button
              onClick={() => setParliament("all")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                parliament === "all" ? "bg-white text-primary shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All Parliaments
            </button>
            <button
              onClick={() => setParliament("lok_sabha")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                parliament === "lok_sabha" ? "bg-white text-primary shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Lok Sabha
            </button>
            <button
              onClick={() => setParliament("rajya_sabha")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                parliament === "rajya_sabha" ? "bg-white text-primary shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Rajya Sabha
            </button>
          </div>

          <button
            onClick={fetchOverview}
            disabled={loading}
            className="p-2 rounded-xl border hover:bg-gray-50 text-gray-600 transition-colors"
            title="Refresh Overview Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="py-24 text-center text-gray-400 bg-white rounded-3xl border border-gray-100 shadow-subtle">
          <RefreshCw className="w-10 h-10 animate-spin mx-auto mb-3 text-primary opacity-50" />
          <p className="text-base font-bold text-gray-700">Loading Overview...</p>
          <p className="text-xs text-gray-400 mt-1">
            Aggregating 75,501 works and 36 States/UTs directly from canonical datasets.
          </p>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-red-900 text-sm">Overview Data Load Warning</span>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
          <button
            onClick={fetchOverview}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-900 text-xs font-bold rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {data && (
        <>
          {/* Section 1: Dynamic High-Level Project Status Cards (Section 2 & 3 in spec) */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Completed Work Card - Requirement 2 */}
            <div className="bg-white p-5 rounded-2xl shadow-subtle border border-emerald-100 hover:shadow-medium transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Completed Work
              </span>
              <h3 className="font-headline font-bold text-2xl md:text-3xl text-emerald-700 mt-1">
                {completedWorks.toLocaleString()} Projects
              </h3>
              <p className="text-xs font-bold text-gray-700 mt-1">
                {formatINR(completedAmount)} <span className="text-[11px] text-gray-400 font-normal">({completionPercentage}% completed)</span>
              </p>
            </div>

            {/* Total Canonical Works */}
            <div className="bg-white p-5 rounded-2xl shadow-subtle border border-gray-100 hover:shadow-medium transition-all">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-3">
                <Database className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Total Projects
              </span>
              <h3 className="font-headline font-bold text-2xl md:text-3xl text-gray-900 mt-1">
                {totalWorks.toLocaleString()}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                Canonical development works
              </p>
            </div>

            {/* Ongoing Projects */}
            <div className="bg-white p-5 rounded-2xl shadow-subtle border border-gray-100 hover:shadow-medium transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-primary mb-3">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Ongoing Projects
              </span>
              <h3 className="font-headline font-bold text-2xl md:text-3xl text-primary mt-1">
                {ongoingWorks.toLocaleString()}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                Sanctioned & in execution
              </p>
            </div>

            {/* Pending Projects */}
            <div className="bg-white p-5 rounded-2xl shadow-subtle border border-gray-100 hover:shadow-medium transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mb-3">
                <AlertCircle className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Pending Projects
              </span>
              <h3 className="font-headline font-bold text-2xl md:text-3xl text-amber-700 mt-1">
                {pendingWorks.toLocaleString()}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                Awaiting administrative sanction
              </p>
            </div>
          </section>

          {/* Project Status Donut Chart */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-subtle">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b mb-4 gap-2">
              <div>
                <h3 className="font-headline font-bold text-xl text-gray-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Project Status Distribution
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Breakdown of Completed, Ongoing, and Pending works</p>
              </div>
              <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-3 py-1 rounded-xl">
                {totalWorks.toLocaleString()} Total
              </span>
            </div>
            <StatusDonut completed={completedWorks} ongoing={ongoingWorks} pending={pendingWorks} />
          </section>

          {/* Section 2: Financial Aggregations Breakdown */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-subtle space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b gap-2">
              <div>
                <h3 className="font-headline font-bold text-xl text-gray-900 flex items-center gap-2">
                  <IndianRupee className="w-5 h-5 text-emerald-600" />
                  Consolidated Financial Lifecycle & Budget Flow
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Dynamic calculations from MoSPI central accounts and work allocation ledgers
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                Active Treasury Balance: {formatINR(data.analytics.unspentBalance)}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">
                  Total Allocated Amount
                </span>
                <span className="font-headline font-bold text-xl text-gray-900 block mt-1">
                  {formatINR(data.analytics.totalAllocatedAmount)}
                </span>
                <span className="text-[11px] text-gray-500 mt-0.5 block">Central MoSPI Grants</span>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">
                  Total Sanctioned Amount
                </span>
                <span className="font-headline font-bold text-xl text-primary block mt-1">
                  {formatINR(data.analytics.totalSanctionedAmount)}
                </span>
                <span className="text-[11px] text-gray-500 mt-0.5 block">District Collector Approved</span>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">
                  Total Expenditure
                </span>
                <span className="font-headline font-bold text-xl text-secondary block mt-1">
                  {formatINR(data.analytics.totalExpenditureAmount)}
                </span>
                <span className="text-[11px] text-gray-500 mt-0.5 block">Disbursed for Works</span>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">
                  Calamity Relief
                </span>
                <span className="font-headline font-bold text-xl text-amber-700 block mt-1">
                  {formatINR(data.analytics.totalCalamityAmount)}
                </span>
                <span className="text-[11px] text-gray-500 mt-0.5 block">Disaster Relief Relocations</span>
              </div>
            </div>

            {/* Visual Budget Comparison Chart */}
            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Visual Budget Comparison</h4>
              <OverviewFinancial
                allocated={data.analytics.totalAllocatedAmount}
                sanctioned={data.analytics.totalSanctionedAmount}
                expenditure={data.analytics.totalExpenditureAmount}
                calamity={data.analytics.totalCalamityAmount}
              />
            </div>
          </section>

          {/* Section 3: Geographic Distribution Banner to Browse States */}
          <section className="bg-gradient-to-r from-blue-900 via-primary to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-medium flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-200 bg-white/10 px-3 py-1 rounded-full backdrop-blur">
                <MapPin className="w-3.5 h-3.5" />
                All India Geographic Coverage
              </div>
              <h3 className="font-headline font-bold text-2xl sm:text-3xl tracking-tight">
                State & Union Territory Performance Cards
              </h3>
              <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed">
                Inspect localized completed work track records, completion rates, and fund allocations across all 36 States and UTs.
              </p>
            </div>

            <Link
              href="/states"
              className="px-6 py-3.5 bg-white hover:bg-gray-100 text-primary font-headline font-bold text-xs rounded-2xl transition-all shadow-md flex items-center gap-2 shrink-0 active:scale-95"
            >
              <span>View All in Full Directory</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </section>



          {/* Section 4: Six-Dataset Inventory Breakdown */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-subtle p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b mb-4 gap-2">
              <div>
                <h3 className="font-headline font-bold text-xl text-gray-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  Six-Dataset Inventory & Quality Breakdown
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Dynamic records, columns, and quality scores across raw and feature data stores
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-3 py-1 rounded-xl">
                {data.records.total.toLocaleString()} Total Rows
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/80 text-xs font-bold uppercase text-gray-500 border-b">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Dataset Name</th>
                    <th className="p-3">Scope / Purpose</th>
                    <th className="p-3 text-right">Records</th>
                    <th className="p-3 text-right">Columns</th>
                    <th className="p-3 text-right">Tracked Amount</th>
                    <th className="p-3 text-center">Quality Score</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.datasets.summaries.map((ds: DatasetSummary, idx: number) => (
                    <tr key={ds.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="p-3 text-xs font-mono font-bold text-gray-400">0{idx + 1}</td>
                      <td className="p-3 font-bold text-gray-900 text-sm">
                        {ds.name}
                      </td>
                      <td className="p-3 text-xs text-gray-500 max-w-xs">{ds.description}</td>
                      <td className="p-3 text-right font-mono font-bold text-gray-900 text-xs">
                        {ds.records.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono text-gray-600 text-xs">{ds.columns}</td>
                      <td className="p-3 text-right font-mono font-bold text-gray-800 text-xs">
                        {formatINR(ds.amount)}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-xs px-2.5 py-0.5 rounded-full ${
                            ds.qualityScore >= 85
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {ds.qualityScore}%
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {ds.status === "loaded" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3" /> Loaded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-800" title={ds.error || "Failed"}>
                            <AlertTriangle className="w-3 h-3" /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      </div>
    </div>
  );
}
