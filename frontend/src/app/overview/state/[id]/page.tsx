"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { StateSummary } from "@/types/overview";
import { WorkFeature } from "@/types/features";
import { getSingleStateDetails } from "@/lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  IndianRupee,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  ExternalLink,
  ShieldCheck,
  MapPin,
  Building2,
  FileSpreadsheet,
  LayoutGrid,
  List,
  Calendar,
  User,
  Tag
} from "lucide-react";
import MPPerformanceSection, { MPPerformanceRecord } from "@/components/features/MPPerformanceSection";

interface RawCompletedRecord {
  work_id: string;
  description: string;
  state: string;
  constituency: string;
  mp_name: string;
  amount: number;
  completion_date: string;
  ida_agency: string;
  category: string;
  parliament: string;
}

export default function StateDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawId = params?.id;
  const stateId = Array.isArray(rawId) ? rawId[0] : typeof rawId === "string" ? rawId : "";
  const parliament = searchParams.get("parliament") || "all";

  // State Summary Metrics
  const [stateSummary, setStateSummary] = useState<StateSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Projects State
  const [projects, setProjects] = useState<WorkFeature[]>([]);
  const [totalProjectsCount, setTotalProjectsCount] = useState<number>(0);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  // Raw Completed Projects State
  const [rawCompleted, setRawCompleted] = useState<RawCompletedRecord[]>([]);
  const [rawCompletedTotal, setRawCompletedTotal] = useState<number>(0);
  const [rawCompletedAmount, setRawCompletedAmount] = useState<number>(0);
  const [loadingRawCompleted, setLoadingRawCompleted] = useState<boolean>(true);
  const [completedViewMode, setCompletedViewMode] = useState<"cards" | "table">("cards");
  const [completedPage, setCompletedPage] = useState<number>(1);
  const completedLimit = 9;

  // MP Performance Graph State
  const [mpsPerformance, setMpsPerformance] = useState<MPPerformanceRecord[]>([]);
  const [loadingMps, setLoadingMps] = useState<boolean>(true);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);
  const limit = 20;

  // Helper to parse cluttered work ID strings into clean ID & Title
  const parseWorkInfo = (rawWork: string) => {
    if (!rawWork) return { id: "--", title: "--" };
    const dashIdx = rawWork.indexOf("-");
    if (dashIdx !== -1 && rawWork.startsWith("WS/")) {
      return {
        id: rawWork.substring(0, dashIdx).trim(),
        title: rawWork.substring(dashIdx + 1).trim()
      };
    }
    return { id: rawWork, title: "" };
  };

  // 1. Fetch State Aggregated Summary
  useEffect(() => {
    if (!stateId || stateId === "undefined") return;
    async function loadStateSummary() {
      setLoadingSummary(true);
      setSummaryError(null);
      try {
        const res = await getSingleStateDetails(stateId, parliament);
        if (res && res.success && res.data) {
          setStateSummary(res.data);
        } else if (res && res.id) {
          setStateSummary(res);
        } else {
          throw new Error("State details not found.");
        }
      } catch (err: unknown) {
        setSummaryError(err instanceof Error ? err.message : "Failed to load state summary");
      } finally {
        setLoadingSummary(false);
      }
    }
    loadStateSummary();
  }, [stateId, parliament]);

  // 2. Fetch Completed Projects from RAW completed dataset
  useEffect(() => {
    if (!stateId || stateId === "undefined") return;
    async function loadRawCompleted() {
      setLoadingRawCompleted(true);
      try {
        const offset = (completedPage - 1) * completedLimit;
        const qParams = new URLSearchParams({
          parliament,
          state: stateId,
          limit: String(completedLimit),
          offset: String(offset)
        });
        const res = await fetch(`/api/raw/completed?${qParams.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setRawCompleted(json.data.records || []);
            setRawCompletedTotal(json.data.total_count || 0);
            setRawCompletedAmount(json.data.total_amount || 0);
          }
        }
      } catch (err) {
        console.error("Error loading raw completed works:", err);
      } finally {
        setLoadingRawCompleted(false);
      }
    }
    loadRawCompleted();
  }, [stateId, parliament, completedPage]);

  // 3. Fetch MP Performance for this State (for the graph & roster)
  useEffect(() => {
    if (!stateId || stateId === "undefined") return;
    async function loadMpsPerformance() {
      setLoadingMps(true);
      try {
        const res = await fetch(`/api/overview/states/${encodeURIComponent(stateId)}/mps?parliament=${parliament}`);
        if (res && res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.data)) {
            setMpsPerformance(json.data);
          } else if (Array.isArray(json)) {
            setMpsPerformance(json);
          } else if (json && Array.isArray(json.data)) {
            setMpsPerformance(json.data);
          }
        }
      } catch (err) {
        console.error("Error loading MP performance:", err);
      } finally {
        setLoadingMps(false);
      }
    }
    loadMpsPerformance();
  }, [stateId, parliament]);

  // 4. Fetch Filtered Projects for this State
  useEffect(() => {
    if (!stateId || stateId === "undefined") return;
    async function loadProjects() {
      setLoadingProjects(true);
      setProjectsError(null);
      try {
        const offset = (page - 1) * limit;
        const qParams = new URLSearchParams({
          parliament,
          state: stateId,
          limit: String(limit),
          offset: String(offset)
        });

        if (statusFilter !== "ALL") {
          qParams.set("lifecycle_status", statusFilter);
        }
        if (searchQuery.trim()) {
          qParams.set("search", searchQuery.trim());
        }

        const res = await fetch(`/api/features/works?${qParams.toString()}`);
        if (!res.ok) throw new Error(`Failed to load projects (${res.statusText})`);
        const json = await res.json();
        if (json.success && json.data) {
          setProjects(json.data.records || []);
          setTotalProjectsCount(json.data.total_count || 0);
        } else {
          throw new Error(json.error || "No projects data returned");
        }
      } catch (err: unknown) {
        setProjectsError(err instanceof Error ? err.message : "Error loading projects");
      } finally {
        setLoadingProjects(false);
      }
    }
    loadProjects();
  }, [stateId, parliament, page, statusFilter, searchQuery]);

  const formatINR = (val?: number) => {
    if (!val || isNaN(val)) return "₹0";
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString()}`;
  };

  const totalPages = Math.ceil(totalProjectsCount / limit) || 1;

  if (loadingSummary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-body">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-lg font-headline font-bold text-gray-800">Loading State Overview...</h2>
          <p className="text-xs text-gray-500">Retrieving dataset aggregations for {stateId}</p>
        </div>
      </div>
    );
  }

  if (summaryError || !stateSummary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-body">
        <div className="bg-white p-8 rounded-2xl border max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-headline font-bold text-gray-900">State Not Found</h2>
          <p className="text-xs text-gray-600">{summaryError || "Could not retrieve records for this State/UT."}</p>
          <Link
            href="/states"
            className="inline-block px-5 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800"
          >
            ← Back to States Directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 font-body pb-24">
      {/* Top Header Breadcrumb */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/states"
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" /> Back to States
          </Link>
          <div className="h-4 w-px bg-gray-200" />
          <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
            {stateSummary.id}
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
            {stateSummary.type}
          </span>
        </div>

        <span className="text-xs text-gray-500 font-medium">
          Parliament Scope: <strong className="capitalize">{parliament.replace("_", " ")}</strong>
        </span>
      </div>

      {/* State Overview Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-primary/10 text-primary">
              {stateSummary.type === "UT" ? "Union Territory Overview" : "State Overview"}
            </span>
          </div>
          <h1 className="font-headline font-extrabold text-3xl sm:text-4xl text-gray-900 tracking-tight">
            {stateSummary.name}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            <strong>{stateSummary.totalProjects.toLocaleString()} Canonical Projects</strong> &bull; Total Sanctioned: <strong>{formatINR(stateSummary.sanctionedAmount)}</strong>
          </p>
        </div>

        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 shrink-0">
          <div className="text-center px-3">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Completion Rate</span>
            <span className="font-headline font-bold text-2xl text-emerald-700 block mt-0.5">
              {stateSummary.completionRate}%
            </span>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="text-center px-3">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Utilization Rate</span>
            <span className="font-headline font-bold text-2xl text-primary block mt-0.5">
              {stateSummary.utilizationRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl shadow-subtle border border-gray-100">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            Total Projects
          </span>
          <h3 className="font-headline font-bold text-2xl md:text-3xl text-gray-900 mt-1">
            {stateSummary.totalProjects.toLocaleString()}
          </h3>
          <p className="text-[11px] text-gray-500 mt-1">In {stateSummary.name}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-subtle border border-emerald-100">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            Completed Projects
          </span>
          <h3 className="font-headline font-bold text-2xl md:text-3xl text-emerald-700 mt-1">
            {stateSummary.completedProjects.toLocaleString()}
          </h3>
          <p className="text-[11px] text-gray-500 mt-1">{stateSummary.completionRate}% completed</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-subtle border border-gray-100">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            Ongoing Projects
          </span>
          <h3 className="font-headline font-bold text-2xl md:text-3xl text-primary mt-1">
            {stateSummary.ongoingProjects.toLocaleString()}
          </h3>
          <p className="text-[11px] text-gray-500 mt-1">Under execution</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-subtle border border-gray-100">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            Pending Projects
          </span>
          <h3 className="font-headline font-bold text-2xl md:text-3xl text-amber-700 mt-1">
            {stateSummary.pendingProjects.toLocaleString()}
          </h3>
          <p className="text-[11px] text-gray-500 mt-1">Recommended status</p>
        </div>
      </section>

      {/* Members of Parliament (MPs) Roster Section */}
      {!loadingMps && mpsPerformance.length > 0 && (
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-blue-100 shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider mb-1">
                <User className="w-4 h-4 text-primary" />
                State Representative Roster
              </div>
              <h2 className="font-headline font-bold text-2xl text-gray-900">
                Members of Parliament (MPs) in {stateSummary.name} ({mpsPerformance.length})
              </h2>
              <p className="text-xs text-gray-500">
                Complete list of all elected MPs representing {stateSummary.name}.
              </p>
            </div>
            <span className="px-3 py-1.5 bg-primary/10 text-primary font-bold text-xs rounded-xl self-start sm:self-auto">
              Total MPs: {mpsPerformance.length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
            {mpsPerformance.map((mp) => (
              <div
                key={mp.mp_name}
                className="p-3.5 bg-slate-50 hover:bg-blue-50/60 rounded-2xl border border-slate-200/80 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {mp.parliament.replace("_", " ")}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-700">
                      {mp.completion_rate}% Comp.
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm line-clamp-1" title={mp.mp_name}>
                    {mp.mp_name}
                  </h4>
                  {mp.constituency && (
                    <p className="text-xs text-gray-500 font-medium truncate mt-0.5" title={mp.constituency}>
                      Constituency: <strong className="text-gray-700">{mp.constituency}</strong>
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-gray-500">
                    Works: <strong className="text-gray-900 font-mono">{mp.total_works}</strong>
                  </span>
                  <span className="text-primary font-bold font-mono">
                    {formatINR(mp.sanctioned_amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Clean & Understandable Completed Work Section */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-emerald-100 shadow-subtle space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
              <CheckCircle2 className="w-4 h-4" />
              Verified Completed Works
            </div>
            <h2 className="font-headline font-bold text-2xl text-gray-900">
              Completed Works in {stateSummary.name}
            </h2>
            <p className="text-xs text-gray-500">
              Verified physical completion certificates from the official MoSPI registers.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200 shrink-0">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Completed</span>
              <span className="font-bold text-lg text-emerald-950 font-mono">
                {rawCompletedTotal > 0 ? rawCompletedTotal.toLocaleString() : stateSummary.completedProjects.toLocaleString()}
              </span>
            </div>
            <div className="h-7 w-px bg-emerald-300/60" />
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Disbursed</span>
              <span className="font-bold text-lg text-emerald-950 font-mono">
                {rawCompletedAmount > 0 ? formatINR(rawCompletedAmount) : formatINR(stateSummary.completedAmount)}
              </span>
            </div>
            <div className="h-7 w-px bg-emerald-300/60" />
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Rate</span>
              <span className="font-bold text-lg text-emerald-950 font-mono">{stateSummary.completionRate}%</span>
            </div>
          </div>
        </div>

        {/* View Mode Switcher (Cards vs Table) */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">
            Showing <strong className="text-gray-900">{rawCompleted.length}</strong> works &bull; Page{" "}
            <strong className="text-gray-900">{completedPage}</strong> of{" "}
            <strong className="text-gray-900">{Math.ceil(rawCompletedTotal / completedLimit) || 1}</strong>
          </span>

          <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 shadow-inner">
            <button
              onClick={() => setCompletedViewMode("cards")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                completedViewMode === "cards"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setCompletedViewMode("table")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                completedViewMode === "table"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>

        {/* Clean, Readable Card Layout */}
        {loadingRawCompleted ? (
          <div className="py-16 text-center text-xs text-gray-400">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading completed works...
          </div>
        ) : rawCompleted.length > 0 ? (
          completedViewMode === "cards" ? (
            /* Clean Card View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {rawCompleted.map((rc, idx) => {
                const { id: cleanWorkId, title: cleanWorkTitle } = parseWorkInfo(rc.work_id);
                return (
                  <div
                    key={`${rc.work_id}-${idx}`}
                    className="bg-white rounded-2xl p-5 border border-gray-100 shadow-subtle hover:shadow-medium hover:border-emerald-300 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3.5">
                      {/* Top Header Pill Row */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Completed
                        </span>
                        <span className="uppercase text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 tracking-wider">
                          {rc.parliament.replace("_", " ")}
                        </span>
                      </div>

                      {/* Work Title & ID */}
                      <div>
                        <span className="font-mono text-[11px] text-gray-400 block tracking-tight">
                          {cleanWorkId}
                        </span>
                        {cleanWorkTitle && (
                          <span className="text-xs font-bold text-primary block mt-0.5">
                            {cleanWorkTitle}
                          </span>
                        )}
                        <h4
                          className="text-sm font-bold text-gray-900 mt-1 line-clamp-2 leading-snug"
                          title={rc.description || cleanWorkTitle}
                        >
                          {rc.description || cleanWorkTitle || "--"}
                        </h4>
                      </div>

                      {/* Clean Details Key-Value Box */}
                      <div className="bg-gray-50/80 rounded-xl p-3 space-y-1.5 text-xs border border-gray-100">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-400 font-medium">MP</span>
                          <span className="font-bold text-gray-800 text-right truncate max-w-[180px]">
                            {rc.mp_name || "--"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-400 font-medium">Constituency</span>
                          <span className="text-gray-700 font-medium text-right truncate max-w-[180px]">
                            {rc.constituency || "--"}
                          </span>
                        </div>
                        {rc.ida_agency && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-gray-400 font-medium">Agency</span>
                            <span className="text-gray-600 text-right truncate max-w-[180px]">
                              {rc.ida_agency}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Financial & Completion Date Strip */}
                    <div className="pt-3.5 border-t border-gray-100 mt-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
                          Disbursed Amount
                        </span>
                        <span className="font-headline font-extrabold text-xl text-emerald-700 font-mono block mt-0.5">
                          {formatINR(rc.amount)}
                        </span>
                      </div>

                      {rc.completion_date && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
                            Completion Date
                          </span>
                          <span className="text-xs font-mono font-bold text-gray-700 block mt-0.5">
                            {rc.completion_date}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 uppercase font-bold text-gray-500 border-b">
                  <tr>
                    <th className="p-3">Work ID</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Constituency</th>
                    <th className="p-3">MP Name</th>
                    <th className="p-3 text-right">Disbursed</th>
                    <th className="p-3 text-center">Chamber</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rawCompleted.map((rc, idx) => (
                    <tr key={`${rc.work_id}-${idx}`} className="hover:bg-gray-50/60 transition-colors">
                      <td className="p-3 font-mono font-bold text-primary max-w-xs truncate" title={rc.work_id}>
                        {rc.work_id}
                      </td>
                      <td className="p-3 font-medium text-gray-800 max-w-sm truncate" title={rc.description}>
                        {rc.description || "--"}
                      </td>
                      <td className="p-3 text-gray-600">{rc.constituency || "--"}</td>
                      <td className="p-3 text-gray-600 font-medium">{rc.mp_name}</td>
                      <td className="p-3 text-right font-mono font-bold text-gray-900">
                        {formatINR(rc.amount)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="uppercase text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                          {rc.parliament.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <p className="text-xs text-gray-400 italic">No completed records returned for this State/UT.</p>
        )}

        {/* Pagination Bar for Completed Works */}
        {rawCompletedTotal > completedLimit && (
          <div className="flex items-center justify-between pt-4 border-t text-xs text-gray-600">
            <span>
              Page <strong className="font-mono text-gray-900">{completedPage}</strong> of{" "}
              <strong className="font-mono text-gray-900">{Math.ceil(rawCompletedTotal / completedLimit)}</strong> ({rawCompletedTotal.toLocaleString()} verified completed works)
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCompletedPage((p) => Math.max(1, p - 1))}
                disabled={completedPage === 1}
                className="p-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCompletedPage((p) => Math.min(Math.ceil(rawCompletedTotal / completedLimit), p + 1))}
                disabled={completedPage >= Math.ceil(rawCompletedTotal / completedLimit)}
                className="p-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* MP Performance Profile & Graph Visualization */}
      {!loadingMps && mpsPerformance.length > 0 && (
        <MPPerformanceSection
          mps={mpsPerformance}
          stateName={stateSummary.name}
        />
      )}

      {/* Full Paginated & Filterable Project Table */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-subtle space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <h2 className="font-headline font-bold text-2xl text-gray-900">
              Projects in {stateSummary.name}
            </h2>
            <p className="text-xs text-gray-500">
              Showing {totalProjectsCount.toLocaleString()} works belonging to {stateSummary.name}
            </p>
          </div>

          {/* Search and Status Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search works, MP, constituency..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9 pr-3 py-2 text-xs border rounded-xl w-60 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="py-2 px-3 text-xs border rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-primary font-bold text-gray-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="SANCTIONED">Sanctioned</option>
              <option value="RECOMMENDED_ONLY">Pending</option>
            </select>
          </div>
        </div>

        {/* Projects Table */}
        {loadingProjects ? (
          <div className="py-16 text-center text-gray-400">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading projects for {stateSummary.name}...</p>
          </div>
        ) : projectsError ? (
          <div className="p-8 text-center text-red-600 bg-red-50 rounded-2xl text-xs">
            {projectsError}
          </div>
        ) : projects.length === 0 ? (
          <div className="py-16 text-center bg-gray-50 rounded-2xl border text-gray-500 space-y-2">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto" />
            <h3 className="font-headline font-bold text-base text-gray-800">No projects found</h3>
            <p className="text-xs text-gray-400">
              There are currently no project records matching the selected filters for {stateSummary.name}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 uppercase font-bold text-gray-500 border-b">
                <tr>
                  <th className="p-3">Project ID</th>
                  <th className="p-3">Project Description</th>
                  <th className="p-3">Constituency</th>
                  <th className="p-3">MP Name</th>
                  <th className="p-3 text-right">Sanctioned</th>
                  <th className="p-3 text-right">Disbursed</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projects.map((proj) => (
                  <tr
                    key={proj.canonical_work_id}
                    onClick={() => router.push(`/projects/${encodeURIComponent(proj.canonical_work_id)}?parliament=${proj.parliament}`)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  >
                    <td className="p-3 font-mono font-bold text-primary">{proj.canonical_work_id}</td>
                    <td className="p-3 font-medium text-gray-900 max-w-sm truncate" title={proj.work_description}>
                      {proj.work_description || "--"}
                    </td>
                    <td className="p-3 text-gray-600">{proj.constituency || "--"}</td>
                    <td className="p-3 text-gray-700 font-medium">{proj.mp_name}</td>
                    <td className="p-3 text-right font-mono font-bold text-gray-900">
                      {formatINR(Number(proj.sanctioned_amount))}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-secondary">
                      {formatINR(Number(proj.expenditure_amount))}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          proj.lifecycle_status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : proj.lifecycle_status === "SANCTIONED"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {proj.lifecycle_status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <Link
                        href={`/projects/${encodeURIComponent(proj.canonical_work_id)}?parliament=${proj.parliament}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1 bg-gray-900 hover:bg-primary text-white text-[11px] font-bold rounded-lg transition-colors inline-flex items-center gap-1"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalProjectsCount > limit && (
          <div className="flex items-center justify-between pt-4 border-t text-xs text-gray-600">
            <span>
              Showing {Math.min(totalProjectsCount, (page - 1) * limit + 1)}–
              {Math.min(totalProjectsCount, page * limit)} of {totalProjectsCount.toLocaleString()} projects
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono font-bold text-gray-900">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
