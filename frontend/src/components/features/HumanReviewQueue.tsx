"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, AlertTriangle, FileText } from "lucide-react";

export default function HumanReviewQueue() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/review-queue");
      const json = await res.json();
      if (json.success && json.data?.queue) {
        setQueue(json.data.queue);
      }
    } catch (err) {
      console.error("Failed to fetch review queue:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (workId: number, approved: boolean) => {
    setProcessingId(workId);
    const notes = reviewerNotes[workId] || (approved ? "Approved upon manual inspection" : "Rejected due to statutory guidelines violation");

    try {
      const res = await fetch(`/api/compliance/review-queue/${workId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, reviewer_notes: notes }),
      });
      const json = await res.json();
      if (json.success) {
        setQueue((prev) => prev.filter((item) => item.work_id !== workId));
      } else {
        alert("Decision failed: " + json.error);
      }
    } catch (err: any) {
      alert("Error submitting decision: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center animate-pulse text-xs text-slate-500 font-medium">Loading Human Review Queue...</div>;
  }

  return (
    <div className="space-y-4 font-body">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black font-headline text-slate-900">
            Human-in-the-Loop Review Queue
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Works flagged with ambiguous keyword semantic matches requiring manual human approval
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-black">
          {queue.length} Pending Review
        </span>
      </div>

      {queue.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="text-sm font-black text-slate-900">Review Queue Cleared</h3>
          <p className="text-xs text-slate-500">There are currently no flagged works pending human review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {queue.map((item) => (
            <div key={item.work_id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-slate-400">Work #{item.work_id}</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-200 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> NEEDS_REVIEW
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900">{item.title}</h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">{item.description}</p>
                
                {/* Flagged Rules */}
                <div className="pt-2">
                  {item.flagged_rules?.map((rule: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-900 font-medium flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold font-mono">{rule.rule_id} ({rule.para_reference}): </span>
                        {rule.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex flex-col gap-3 min-w-[240px]">
                <textarea
                  rows={2}
                  placeholder="Optional reviewer notes..."
                  value={reviewerNotes[item.work_id] || ""}
                  onChange={(e) => setReviewerNotes({ ...reviewerNotes, [item.work_id]: e.target.value })}
                  className="w-full p-2 text-xs rounded-xl border border-slate-300 font-medium focus:ring-2 focus:ring-primary"
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => handleDecision(item.work_id, true)}
                    disabled={processingId === item.work_id}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => handleDecision(item.work_id, false)}
                    disabled={processingId === item.work_id}
                    className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

