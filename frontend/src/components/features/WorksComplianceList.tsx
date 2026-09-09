"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle,
  AlertOctagon,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Building2,
  MapPin,
  Calendar,
  IndianRupee,
} from "lucide-react";

export default function WorksComplianceList() {
  const [works, setWorks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWorkId, setExpandedWorkId] = useState<number | null>(null);

  useEffect(() => {
    fetchWorks();
  }, []);

  const fetchWorks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/works");
      const json = await res.json();
      if (json.success && json.data?.works) {
        setWorks(json.data.works);
      }
    } catch (err) {
      console.error("Failed to load works:", err);
    } finally {
      setLoading(false);
    }
  };

  const getVerdictBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> COMPLIANT (APPROVED)
          </span>
        );
      case "BLOCKED":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-black border border-rose-200">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-600" /> VIOLATED (BLOCKED)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-black border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> FLAG (NEEDS REVIEW)
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 animate-pulse text-xs text-slate-500 font-medium">
        Loading MPLADS Works Compliance Ledger...
      </div>
    );
  }

  return (
    <div className="space-y-6 font-body">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black font-headline text-slate-900 tracking-tight">
            MPLADS Project Compliance Status
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Live compliance evaluation of development works against statutory MPLADS 2023 Guidelines
          </p>
        </div>
        <span className="px-3.5 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-extrabold self-start sm:self-auto">
          {works.length} Total Projects Monitored
        </span>
      </div>

      <div className="space-y-4">
        {works.map((w) => {
          const isExpanded = expandedWorkId === w.work_id;
          const passedCount = w.rule_checks?.filter((r: any) => r.passed).length || 0;
          const totalChecks = w.rule_checks?.length || 0;

          return (
            <div
              key={w.work_id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md"
            >
              {/* Card Header */}
              <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-extrabold text-xs text-slate-400">
                      Work #{w.work_id}
                    </span>
                    {getVerdictBadge(w.overall_status)}
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                      Status: {w.status.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 font-headline leading-snug">
                    {w.title}
                  </h3>

                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {w.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" /> {w.mp_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> {w.district}, {w.state}
                    </span>
                    <span className="flex items-center gap-1 font-mono font-bold text-slate-900">
                      <IndianRupee className="w-3.5 h-3.5 text-emerald-600" /> ₹{w.estimated_cost?.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Score & Expand Action */}
                <div className="flex items-center justify-between md:flex-col md:items-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-left md:text-right">
                    <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Statutory Rule Pass Rate
                    </div>
                    <div className="text-lg font-black text-slate-900">
                      {passedCount} / {totalChecks} Rules Passed
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedWorkId(isExpanded ? null : w.work_id)}
                    className="px-4 py-2 text-xs font-extrabold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    {isExpanded ? "Hide Breakdown" : "View Rule Checks"}
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Accordion Content: Detailed Per-Rule Breakdown */}
              {isExpanded && (
                <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-primary" /> Statutory Evaluation Log for Work #{w.work_id}
                    </h4>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-black tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Rule Code & Statutory Para</th>
                          <th className="py-3 px-4">Result</th>
                          <th className="py-3 px-4">Audit Evaluation Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {w.rule_checks?.map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-3.5 px-4 font-mono font-bold max-w-xs">
                              <div className="text-slate-900">{r.rule_id}</div>
                              <div className="text-[10px] text-slate-400 font-semibold">
                                {r.para_reference}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                                  r.passed
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                    : r.severity === "BLOCK"
                                    ? "bg-rose-100 text-rose-800 border-rose-200"
                                    : "bg-amber-100 text-amber-800 border-amber-200"
                                }`}
                              >
                                {r.passed ? "✓ PASS" : `✕ ${r.severity}`}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-slate-700 font-medium leading-relaxed">
                              {r.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

