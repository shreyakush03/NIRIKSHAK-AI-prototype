"use client";

import React from "react";
import { ShieldCheck, AlertTriangle, AlertOctagon, Sparkles } from "lucide-react";

interface GaugeProps {
  score: number;
  totalAudited: number;
  totalViolations: number;
  criticalCount: number;
  highCount: number;
}

export default function ComplianceHealthGauge({
  score,
  totalAudited,
  totalViolations,
  criticalCount,
  highCount,
}: GaugeProps) {
  // SVG Gauge calculations
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getGradientColors = (score: number) => {
    if (score >= 85) {
      return {
        stop1: "#10b981", // emerald-500
        stop2: "#059669", // emerald-600
        text: "text-emerald-600",
        bg: "bg-emerald-50/60 border-emerald-200",
        badge: "bg-emerald-100 text-emerald-800 border border-emerald-200",
        label: "High Statutory Compliance",
      };
    } else if (score >= 70) {
      return {
        stop1: "#f59e0b", // amber-500
        stop2: "#d97706", // amber-600
        text: "text-amber-600",
        bg: "bg-amber-50/60 border-amber-200",
        badge: "bg-amber-100 text-amber-800 border border-amber-200",
        label: "Moderate Exposure Risk",
      };
    } else {
      return {
        stop1: "#ef4444", // rose-500
        stop2: "#dc2626", // rose-600
        text: "text-rose-600",
        bg: "bg-rose-50/60 border-rose-200",
        badge: "bg-rose-100 text-rose-800 border border-rose-200",
        label: "High Audit Exposure",
      };
    }
  };

  const theme = getGradientColors(score);

  return (
    <div className={`rounded-2xl p-6 sm:p-8 border shadow-sm ${theme.bg} bg-white transition-all relative overflow-hidden`}>
      {/* Background Glow Accent */}
      <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
        {/* Left Info & Title */}
        <div className="space-y-3 text-center lg:text-left max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white shadow-sm border border-slate-200 text-slate-700">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Statutory Health Metric
          </div>

          <h2 className="text-2xl sm:text-3xl font-black font-headline tracking-tight text-slate-900">
            Compliance Health Index
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
            Evaluated using weighted severity thresholds across all 7 statutory MPLADS compliance rules. Target compliance score is 100%.
          </p>

          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 pt-1">
            <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${theme.badge}`}>
              {theme.label}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {totalAudited.toLocaleString()} Works Audited
            </span>
          </div>
        </div>

        {/* Center Circular Radial SVG Gauge */}
        <div className="relative flex items-center justify-center">
          <svg className="w-48 h-48 transform -rotate-90">
            <defs>
              <linearGradient id="gaugeGradientLight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={theme.stop1} />
                <stop offset="100%" stopColor={theme.stop2} />
              </linearGradient>
            </defs>

            {/* Background Track Circle */}
            <circle
              cx="96"
              cy="96"
              r={radius}
              className="stroke-slate-100"
              strokeWidth="12"
              fill="transparent"
            />

            {/* Value Progress Circle */}
            <circle
              cx="96"
              cy="96"
              r={radius}
              stroke="url(#gaugeGradientLight)"
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Center Text inside Radial Ring */}
          <div className="absolute flex flex-col items-center justify-center text-center space-y-0.5">
            <span className={`text-4xl font-black font-headline tracking-tighter ${theme.text}`}>
              {score}%
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              HEALTH SCORE
            </span>
          </div>
        </div>

        {/* Right Metric Summary Cards */}
        <div className="grid grid-cols-2 gap-3 w-full lg:w-auto">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-sm text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
              Flagged Violations
            </span>
            <span className="text-2xl font-black text-rose-600 mt-1 block">
              {totalViolations}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-sm text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
              Critical & High
            </span>
            <span className="text-2xl font-black text-amber-600 mt-1 block">
              {criticalCount + highCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
