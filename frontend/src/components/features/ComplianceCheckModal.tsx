"use client";

import { useState } from "react";
import { ShieldCheck, AlertOctagon, AlertTriangle, CheckCircle, Send, FileText } from "lucide-react";

interface ComplianceCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function ComplianceCheckModal({ isOpen, onClose, onSubmitted }: ComplianceCheckModalProps) {
  const [formData, setFormData] = useState({
    mp_id: 1,
    financial_year: "2025-26",
    title: "",
    description: "",
    estimated_cost: 1000000,
    beneficiary_category: "general",
    is_repair_or_renovation: false,
    is_out_of_constituency: false,
    is_calamity_relief: false,
    work_location_district: "Gorakhpur",
    work_location_state: "Uttar Pradesh",
    recommendation_date: new Date().toISOString().split("T")[0],
    darpan_id: "",
    written_justification: "",
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/compliance/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          estimated_cost: Number(formData.estimated_cost),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        if (onSubmitted) onSubmitted();
      } else {
        alert("Evaluation failed: " + (json.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error evaluating compliance: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto font-body">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/20 text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black font-headline tracking-tight">
                Submit & Check MPLADS Work Compliance
              </h2>
              <p className="text-xs text-slate-400">
                Statutory evaluation against 11 MPLADS guidelines rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white font-black text-lg px-2 py-1"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {result ? (
            /* Results View */
            <div className="space-y-6">
              <div
                className={`p-6 rounded-2xl border flex items-center gap-4 ${
                  result.overall_status === "APPROVED"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : result.overall_status === "BLOCKED"
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
              >
                {result.overall_status === "APPROVED" ? (
                  <CheckCircle className="w-10 h-10 text-emerald-600 shrink-0" />
                ) : result.overall_status === "BLOCKED" ? (
                  <AlertOctagon className="w-10 h-10 text-rose-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-10 h-10 text-amber-600 shrink-0" />
                )}
                <div>
                  <div className="text-xs font-black uppercase tracking-wider opacity-75">
                    Statutory Verdict
                  </div>
                  <div className="text-2xl font-black">{result.overall_status}</div>
                  <p className="text-xs mt-1 font-medium">
                    Work Status: <span className="font-bold uppercase">{result.work_status}</span>
                  </p>
                </div>
              </div>

              {/* Rule Breakdown Table */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Per-Rule Evaluation Breakdown
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 font-black text-slate-700 uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-3">Rule ID & Para</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {result.results.map((r: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold">
                            <div>{r.rule_id}</div>
                            <div className="text-[10px] text-slate-400">{r.para_reference}</div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                r.passed
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : r.severity === "BLOCK"
                                  ? "bg-rose-100 text-rose-800 border-rose-200"
                                  : "bg-amber-100 text-amber-800 border-amber-200"
                              }`}
                            >
                              {r.passed ? "PASS" : r.severity}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-slate-700">{r.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setResult(null)}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Test Another Work
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* Input Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Work Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Drinking Water Pipeline Installation"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estimated Cost (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.estimated_cost}
                    onChange={(e) => setFormData({ ...formData, estimated_cost: Number(e.target.value) })}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Work Description *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detailed description of the proposed development work..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    District
                  </label>
                  <input
                    type="text"
                    value={formData.work_location_district}
                    onChange={(e) => setFormData({ ...formData, work_location_district: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={formData.work_location_state}
                    onChange={(e) => setFormData({ ...formData, work_location_state: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Beneficiary Category
                  </label>
                  <select
                    value={formData.beneficiary_category}
                    onChange={(e) => setFormData({ ...formData, beneficiary_category: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 font-semibold"
                  >
                    <option value="general">General Area</option>
                    <option value="sc">SC Area (≥15% quota)</option>
                    <option value="st">ST Area (≥7.5% quota)</option>
                  </select>
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={formData.is_repair_or_renovation}
                    onChange={(e) => setFormData({ ...formData, is_repair_or_renovation: e.target.checked })}
                    className="rounded text-primary focus:ring-primary"
                  />
                  Repair / Renovation Work
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={formData.is_out_of_constituency}
                    onChange={(e) => setFormData({ ...formData, is_out_of_constituency: e.target.checked })}
                    className="rounded text-primary focus:ring-primary"
                  />
                  Out of Constituency
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={formData.is_calamity_relief}
                    onChange={(e) => setFormData({ ...formData, is_calamity_relief: e.target.checked })}
                    className="rounded text-primary focus:ring-primary"
                  />
                  Calamity Relief Work
                </label>
              </div>

              {/* NGO Darpan ID */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  NGO Darpan ID (If Society / Trust Work)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UP/2023/0012345"
                  value={formData.darpan_id}
                  onChange={(e) => setFormData({ ...formData, darpan_id: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary/90 flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {loading ? "Evaluating Engine..." : "Evaluate Work Compliance"} <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

