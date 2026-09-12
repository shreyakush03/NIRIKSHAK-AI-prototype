"use client";

import { useState } from "react";
import {
  Bell,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronRight,
  Filter,
  X,
  ShieldAlert,
  Clock,
  IndianRupee,
} from "lucide-react";

export interface ComplianceAlert {
  alert_id: string;
  work_id: string;
  work_description: string;
  state: string;
  constituency: string;
  mp_name: string;
  rule_code: string;
  rule_title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  risk_score: number;
  sla: string;
  timestamp: string;
  explainability: {
    rule_code: string;
    category: string;
    sanctioned_amount: number;
    expenditure_amount: number;
    lifecycle_status: string;
    trigger_condition: string;
  };
  status: string;
}

interface Props {
  alerts: ComplianceAlert[];
  summaryCounts?: { critical: number; high: number; medium: number; total: number };
  onFeedbackAction?: (alertId: string, action: string) => void;
}

export default function ComplianceNotificationCenter({
  alerts,
  summaryCounts,
  onFeedbackAction,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [selectedAlert, setSelectedAlert] = useState<ComplianceAlert | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const activeAlerts = alerts.filter(
    (a) => !dismissedIds.has(a.alert_id) && (selectedSeverity === "ALL" || a.severity === selectedSeverity)
  );

  const criticalCount = summaryCounts?.critical ?? alerts.filter((a) => a.severity === "CRITICAL").length;
  const totalCount = activeAlerts.length;

  const handleAction = (alertId: string, action: string) => {
    setDismissedIds((prev) => new Set(prev).add(alertId));
    if (onFeedbackAction) {
      onFeedbackAction(alertId, action);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[10px] font-black border border-rose-200">
            <AlertOctagon className="w-3 h-3 text-rose-600" /> CRITICAL
          </span>
        );
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-black border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> HIGH
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-black border border-blue-200">
            <Info className="w-3 h-3 text-blue-600" /> MEDIUM
          </span>
        );
    }
  };

  return (
    <div className="relative inline-block text-left font-body">
      {/* Top Notification Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-sm font-bold text-xs"
      >
        <Bell className="w-4 h-4 text-amber-400 animate-pulse" />
        <span>Compliance Alerts</span>
        {criticalCount > 0 ? (
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
            {criticalCount} CRITICAL
          </span>
        ) : (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black bg-slate-700 text-slate-200">
            {totalCount}
          </span>
        )}
      </button>

      {/* Slide-over Notification Center Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
            
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h2 className="text-sm font-black font-headline tracking-tight">AI Compliance Alert Center</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-1.5 text-slate-600">
                <Filter className="w-3.5 h-3.5" />
                <span>Severity:</span>
              </div>
              <div className="flex items-center gap-1">
                {["ALL", "CRITICAL", "HIGH", "MEDIUM"].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSelectedSeverity(sev)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                      selectedSeverity === sev
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Alert List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeAlerts.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
                  <p className="text-xs font-bold">No active compliance alerts for this filter.</p>
                </div>
              ) : (
                activeAlerts.map((alert) => (
                  <div
                    key={alert.alert_id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      alert.severity === "CRITICAL"
                        ? "bg-rose-50/40 border-rose-200/80 hover:border-rose-300"
                        : alert.severity === "HIGH"
                        ? "bg-amber-50/40 border-amber-200/80 hover:border-amber-300"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      {getSeverityBadge(alert.severity)}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono font-black text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          Score: {alert.risk_score}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5">
                          <Clock className="w-3 h-3" /> SLA: {alert.sla}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-xs font-black text-slate-900 font-headline leading-snug">
                      {alert.rule_title}
                    </h4>
                    
                    {/* Target MP Alert Routing Badge */}
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] font-black">
                        👤 Target MP: {alert.mp_name && alert.mp_name !== "nan" ? alert.mp_name : "Hon. Member of Parliament"}
                      </span>
                    </div>

                    <p className="text-[11px] font-medium text-slate-600 line-clamp-2 mt-1">
                      {alert.work_description}
                    </p>

                    <div className="mt-2 text-[10px] font-bold text-slate-500 flex items-center justify-between border-t border-slate-200/60 pt-2">
                      <span>{alert.constituency}, {alert.state}</span>
                      <span className="font-mono text-slate-900 font-extrabold">
                        ₹{alert.explainability.expenditure_amount.toLocaleString("en-IN")}
                      </span>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                      <button
                        onClick={() => setSelectedAlert(alert)}
                        className="text-[10px] font-extrabold text-primary hover:underline flex items-center gap-0.5"
                      >
                        Explainability <ChevronRight className="w-3 h-3" />
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleAction(alert.alert_id, "DISMISSED")}
                          className="px-2 py-1 rounded bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 text-[10px] font-bold"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => handleAction(alert.alert_id, "ACKNOWLEDGED")}
                          className="px-2 py-1 rounded bg-slate-900 text-white hover:bg-slate-800 text-[10px] font-bold"
                        >
                          Acknowledge
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      )}

      {/* Explainability Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-black font-headline text-slate-900">Alert Explainability Metadata</h3>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px]">Rule Triggered</span>
                <p className="font-bold text-slate-900">{selectedAlert.rule_title} ({selectedAlert.rule_code})</p>
              </div>

              <div>
                <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px]">Trigger Condition / Reason</span>
                <p className="p-2.5 rounded-lg bg-rose-50 text-rose-900 border border-rose-100 font-medium leading-relaxed mt-1">
                  {selectedAlert.explainability.trigger_condition}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500">Sanctioned Amount</span>
                  <p className="font-mono font-black text-slate-900 text-sm mt-0.5">
                    ₹{selectedAlert.explainability.sanctioned_amount.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500">Expenditure Disbursed</span>
                  <p className="font-mono font-black text-slate-900 text-sm mt-0.5">
                    ₹{selectedAlert.explainability.expenditure_amount.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              <div>
                <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px]">Project Entity Details</span>
                <p className="font-semibold text-slate-800 mt-0.5">{selectedAlert.work_description}</p>
                <p className="text-slate-500 text-[11px] font-medium">{selectedAlert.mp_name} ({selectedAlert.constituency}, {selectedAlert.state})</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={() => setSelectedAlert(null)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold"
              >
                Close
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      const mpName = selectedAlert.mp_name && selectedAlert.mp_name !== "nan" ? selectedAlert.mp_name : "Hon. Member of Parliament";
                      await fetch(`/api/compliance/alerts/notify-mp`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ alert_id: selectedAlert.alert_id, mp_name: mpName }),
                      });
                      alert(`Direct Alert Dispatched to MP ${mpName} via NIC SMS & Email Gateway!`);
                      handleAction(selectedAlert.alert_id, "MP_NOTIFIED");
                      setSelectedAlert(null);
                    } catch (err) {
                      console.error("Failed to notify MP:", err);
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-black shadow-sm flex items-center gap-1"
                >
                  <span>📲 Alert Specific MP ({selectedAlert.mp_name && selectedAlert.mp_name !== "nan" ? selectedAlert.mp_name : "MP"})</span>
                </button>

                <button
                  onClick={() => {
                    handleAction(selectedAlert.alert_id, "ESCALATED");
                    setSelectedAlert(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-black shadow-sm"
                >
                  Escalate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

