"use client";

import React, { useState } from "react";
import { User, CheckCircle2, TrendingUp, IndianRupee, BarChart3, Trophy, ChevronRight } from "lucide-react";

export interface MPPerformanceRecord {
  mp_name: string;
  constituency: string;
  parliament: string;
  total_works: number;
  completed_works: number;
  ongoing_works: number;
  pending_works: number;
  completion_rate: number;
  sanctioned_amount: number;
  expenditure_amount: number;
  utilization_rate: number;
}

interface MPPerformanceSectionProps {
  mps: MPPerformanceRecord[];
  stateName: string;
}

export default function MPPerformanceSection({ mps, stateName }: MPPerformanceSectionProps) {
  const [metric, setMetric] = useState<"works" | "rate" | "finance">("works");
  const [mpSearchQuery, setMpSearchQuery] = useState<string>("");
  const [displayCount, setDisplayCount] = useState<number>(mps?.length || 100);

  if (!mps || mps.length === 0) return null;

  const formatINR = (val?: number) => {
    if (!val || isNaN(val)) return "₹0";
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString()}`;
  };

  const filteredMps = mps.filter((mp) => {
    const query = mpSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      mp.mp_name.toLowerCase().includes(query) ||
      mp.constituency.toLowerCase().includes(query)
    );
  });

  // Sort according to active metric
  const sortedMps = [...filteredMps].sort((a, b) => {
    if (metric === "works") return b.total_works - a.total_works;
    if (metric === "rate") return b.completion_rate - a.completion_rate;
    if (metric === "finance") return b.sanctioned_amount - a.sanctioned_amount;
    return 0;
  });

  const displayedList = sortedMps.slice(0, displayCount);
  const maxWorks = Math.max(...mps.map((m) => m.total_works), 1);
  const maxSanction = Math.max(...mps.map((m) => m.sanctioned_amount), 1);

  return (
    <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-subtle space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider mb-1">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            Elected Representative Roster
          </div>
          <h2 className="font-headline font-bold text-2xl text-gray-900">
            Members of Parliament (MPs) in {stateName} ({mps.length})
          </h2>
          <p className="text-xs text-gray-500">
            All {mps.length} MPs present in {stateName} along with their physical ground completions and fund utilization.
          </p>
        </div>

        {/* Metric Selector Toggle */}
        <div className="bg-gray-100 p-1.5 rounded-2xl flex text-xs font-bold self-start md:self-auto shadow-inner">
          <button
            onClick={() => setMetric("works")}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              metric === "works" ? "bg-white text-primary shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Total Works
          </button>
          <button
            onClick={() => setMetric("rate")}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              metric === "rate" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completion Rate (%)
          </button>
          <button
            onClick={() => setMetric("finance")}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              metric === "finance" ? "bg-white text-secondary shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <IndianRupee className="w-3.5 h-3.5" />
            Sanctioned Funds
          </button>
        </div>
      </div>

      {/* Visual Graphical Horizontal Bar Chart */}
      <div className="space-y-4 pt-2">
        {displayedList.map((mp, index) => {
          let barPct = 0;
          if (metric === "works") barPct = Math.round((mp.total_works / maxWorks) * 100);
          else if (metric === "rate") barPct = Math.min(100, Math.round(mp.completion_rate));
          else if (metric === "finance") barPct = Math.round((mp.sanctioned_amount / maxSanction) * 100);

          return (
            <div key={mp.mp_name} className="group p-3.5 bg-gray-50/70 hover:bg-gray-100/80 rounded-2xl border border-gray-100/80 transition-all space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                    index === 0 ? "bg-amber-100 text-amber-800" : index === 1 ? "bg-gray-200 text-gray-800" : index === 2 ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-600"
                  }`}>
                    {index + 1}
                  </span>
                  <span className="font-bold text-gray-900 text-sm">{mp.mp_name}</span>
                  {mp.constituency && (
                    <span className="text-[11px] text-gray-500 font-medium">({mp.constituency})</span>
                  )}
                  <span className="text-[10px] uppercase font-bold text-gray-400 bg-white px-2 py-0.5 rounded border">
                    {mp.parliament.replace("_", " ")}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                  <span className="text-gray-600">
                    Works: <strong className="text-gray-900">{mp.total_works.toLocaleString()}</strong> ({mp.completed_works.toLocaleString()} completed)
                  </span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {mp.completion_rate}% Comp.
                  </span>
                  <span className="text-primary font-bold">
                    {formatINR(mp.sanctioned_amount)}
                  </span>
                </div>
              </div>

              {/* Progress Bar Representation of the Graph */}
              <div className="w-full bg-white h-3 rounded-full overflow-hidden border border-gray-200/60 p-0.5 shadow-inner">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    metric === "rate"
                      ? mp.completion_rate > 70 ? "bg-emerald-500" : mp.completion_rate > 40 ? "bg-amber-400" : "bg-red-400"
                      : metric === "finance"
                      ? "bg-secondary"
                      : "bg-primary"
                  }`}
                  style={{ width: `${Math.max(3, barPct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more toggle */}
      {mps.length > 10 && (
        <div className="pt-2 text-center">
          <button
            onClick={() => setDisplayCount(prev => prev === 10 ? mps.length : 10)}
            className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
          >
            {displayCount === 10 ? `View all ${mps.length} MPs in ${stateName}` : "Show top 10 MPs"}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </section>
  );
}
