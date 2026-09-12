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
              <Link
                key={mp.mp_name}
                href={`/mps/${encodeURIComponent(mp.mp_name)}?parliament=${parliament}`}
                className="group p-3.5 bg-slate-50 hover:bg-blue-50/80 hover:border-blue-300 rounded-2xl border border-slate-200/80 transition-all flex flex-col justify-between cursor-pointer shadow-xs hover:shadow-subtle"
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
                  <h4 className="font-bold text-gray-900 group-hover:text-primary transition-colors text-sm line-clamp-1" title={mp.mp_name}>
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
                  <span className="text-primary font-bold font-mono group-hover:underline flex items-center gap-1">
                    View Works →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Constituencies in State Section */}
      {!loadingMps && mpsPerformance.length > 0 && (
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-indigo-100 shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">
                <MapPin className="w-4 h-4 text-indigo-600" />
                Constituencies Overview
              </div>
              <h2 className="font-headline font-bold text-2xl text-gray-900">
                Constituencies in {stateSummary.name} ({Array.from(new Set(mpsPerformance.map(m => m.constituency).filter(Boolean))).length})
              </h2>
              <p className="text-xs text-gray-500">
                List of parliamentary constituencies in {stateSummary.name} with assigned representative and work completion details.
              </p>
            </div>
            <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl self-start sm:self-auto">
              Total Constituencies: {Array.from(new Set(mpsPerformance.map(m => m.constituency).filter(Boolean))).length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
            {Array.from(new Set(mpsPerformance.map(m => m.constituency).filter(Boolean)))
              .sort()
              .map((constituencyName) => {
                const mpRecord = mpsPerformance.find(m => m.constituency === constituencyName);
                return (
                  <div
                    key={constituencyName}
                    className="p-4 bg-slate-50 hover:bg-indigo-50/60 rounded-2xl border border-slate-200/80 transition-all flex flex-col justify-between shadow-xs hover:shadow-subtle"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Constituency
                        </span>
                        {mpRecord && (
                          <span className="text-[10px] font-mono font-bold text-emerald-700">
                            {mpRecord.completion_rate}% Comp.
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm line-clamp-1" title={constituencyName}>
                        {constituencyName}
                      </h4>
                      {mpRecord ? (
                        <div className="mt-1">
                          <p className="text-xs text-gray-500">
                            MP: <Link href={`/mps/${encodeURIComponent(mpRecord.mp_name)}?parliament=${parliament}`} className="text-primary font-semibold hover:underline">{mpRecord.mp_name}</Link>
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic mt-1">MP details unavailable</p>
                      )}
                    </div>

                    {mpRecord && (
                      <div className="mt-3 pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px]">
                        <span className="text-gray-500">
                          Total Works: <strong className="text-gray-900 font-mono">{mpRecord.total_works}</strong>
                        </span>
                        <Link
                          href={`/mps/${encodeURIComponent(mpRecord.mp_name)}?parliament=${parliament}`}
                          className="text-indigo-600 font-bold font-mono hover:underline flex items-center gap-0.5"
                        >
                          View Details →
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      )}



      {/* MP Performance Profile & Graph Visualization */}
      {!loadingMps && mpsPerformance.length > 0 && (
        <MPPerformanceSection
          mps={mpsPerformance}
          stateName={stateSummary.name}
        />
      )}


    </div>
  );
}
