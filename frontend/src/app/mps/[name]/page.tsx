"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { WorkFeature } from "@/types/features";
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
  User,
  TrendingUp,
  Award
} from "lucide-react";

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

export default function MPDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawName = params?.name;
  const mpName = decodeURIComponent(
    Array.isArray(rawName) ? rawName[0] : typeof rawName === "string" ? rawName : ""
  );
  const parliament = searchParams.get("parliament") || "all";

  // Completed Works State
  const [completedWorks, setCompletedWorks] = useState<RawCompletedRecord[]>([]);
  const [loadingCompleted, setLoadingCompleted] = useState<boolean>(true);
  const [completedError, setCompletedError] = useState<string | null>(null);

  // All Works State
  const [allWorks, setAllWorks] = useState<WorkFeature[]>([]);
  const [loadingAllWorks, setLoadingAllWorks] = useState<boolean>(true);

  // Filters & Pagination
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [completedPage, setCompletedPage] = useState<number>(1);
  const limit = 9;

  // 1. Fetch Completed Works for this MP
  useEffect(() => {
    if (!mpName || mpName === "undefined") return;
    async function loadCompletedWorks() {
      setLoadingCompleted(true);
      setCompletedError(null);
      try {
        const qParams = new URLSearchParams({
          parliament,
          mp_name: mpName,
          limit: "500",
          offset: "0"
        });
        const res = await fetch(`/api/raw/completed?${qParams.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setCompletedWorks(json.data.records || []);
          } else if (Array.isArray(json)) {
            setCompletedWorks(json);
          }
        } else {
          throw new Error("Failed to load completed works for this MP.");
        }
      } catch (err: unknown) {
        setCompletedError(err instanceof Error ? err.message : "Error loading completed works");
      } finally {
        setLoadingCompleted(false);
      }
    }
    loadCompletedWorks();
  }, [mpName, parliament]);

  // 2. Fetch All Works for this MP (for total counts & overall stats)
  useEffect(() => {
    if (!mpName || mpName === "undefined") return;
    async function loadAllWorks() {
      setLoadingAllWorks(true);
      try {
        const qParams = new URLSearchParams({
          parliament,
          mp_name: mpName,
          limit: "500",
          offset: "0"
        });
        const res = await fetch(`/api/features/works?${qParams.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setAllWorks(json.data.records || []);
          }
        }
      } catch (err) {
        console.error("Error loading MP works:", err);
      } finally {
        setLoadingAllWorks(false);
      }
    }
    loadAllWorks();
  }, [mpName, parliament]);

  // Currency & Metric Helper
  const formatINR = (val?: number) => {
    if (!val || isNaN(val) || val <= 0) return "₹0";
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString()}`;
  };

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

  // Derived MP Metadata
  const sampleRecord = completedWorks[0] || allWorks[0];
  const mpState = sampleRecord?.state || "India";
  const mpConstituency = sampleRecord?.constituency || "Parliamentary Constituency";
  const mpChamber = sampleRecord?.parliament ? sampleRecord.parliament.replace("_", " ").toUpperCase() : "LOK SABHA";

  // Financial & Performance Metrics
  const totalWorksCount = allWorks.length || completedWorks.length;
  const totalCompletedCount = completedWorks.length;
  const completionRate = totalWorksCount > 0 ? Number(((totalCompletedCount / totalWorksCount) * 100).toFixed(1)) : 100;

  const totalSanctioned = allWorks.reduce((acc, w) => acc + (Number(w.sanctioned_amount) || 0), 0);
  const totalDisbursed = completedWorks.reduce((acc, w) => acc + (Number(w.amount) || 0), 0) ||
                          allWorks.reduce((acc, w) => acc + (Number(w.expenditure_amount) || 0), 0);

  // Filtered Completed Works by Search Query
  const filteredCompletedWorks = useMemo(() => {
    return completedWorks.filter((w) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        w.work_id.toLowerCase().includes(q) ||
        (w.description && w.description.toLowerCase().includes(q)) ||
        (w.category && w.category.toLowerCase().includes(q)) ||
        (w.constituency && w.constituency.toLowerCase().includes(q))
      );
    });
  }, [completedWorks, searchQuery]);

  // Paginated Completed Works
  const totalPages = Math.ceil(filteredCompletedWorks.length / limit) || 1;
  const paginatedCompleted = useMemo(() => {
    const start = (completedPage - 1) * limit;
    return filteredCompletedWorks.slice(start, start + limit);
  }, [filteredCompletedWorks, completedPage, limit]);

  return (
    <div className="flex flex-col gap-8 font-body pb-24 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Top Header Breadcrumb */}
      <div className="flex items-center justify-between border-b pb-4 mt-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md">
            MP Portfolio & Execution Profile
          </span>
        </div>

        <span className="text-xs text-gray-500 font-medium hidden sm:inline-block">
          Parliament Scope: <strong className="capitalize">{parliament.replace("_", " ")}</strong>
        </span>
      </div>

      {/* MP Profile Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <User className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800">
                {mpChamber}
              </span>
              {mpState && (
                <span className="px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-gray-100 text-gray-700 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-gray-500" /> {mpState}
                </span>
              )}
            </div>
            <h1 className="font-headline font-extrabold text-3xl sm:text-4xl text-gray-900 tracking-tight">
              {mpName}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Member of Parliament for <strong>{mpConstituency}</strong> ({mpState})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 shrink-0">
          <div className="text-center px-3">
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Completed Works</span>
            <span className="font-headline font-bold text-2xl text-emerald-700 block mt-0.5 font-mono">
              {totalCompletedCount.toLocaleString()}
            </span>
          </div>
          <div className="h-8 w-px bg-emerald-200" />
          <div className="text-center px-3">
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Total Disbursed</span>
            <span className="font-headline font-bold text-2xl text-primary block mt-0.5 font-mono">
              {formatINR(totalDisbursed)}
            </span>
          </div>
        </div>
      </div>

      {/* MP High-Level Metrics Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-subtle border border-gray-100">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            Total Works
          </span>
          <h3 className="font-headline font-bold text-2xl md:text-3xl text-gray-900 mt-1 font-mono">
            {totalWorksCount.toLocaleString()}
          </h3>
          <p className="text-[11px] text-gray-500 mt-1">Under MP Recommendation</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-subtle border border-emerald-100">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed Works
          </span>
          <h3 className="font-headline font-bold text-2xl md:text-3xl text-emerald-700 mt-1 font-mono">
            {totalCompletedCount.toLocaleString()}
          </h3>
          <p className="text-[11px] text-gray-500 mt-1">{completionRate}% Completion Rate</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-subtle border border-gray-100">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            Sanctioned Amount
          </span>
          <h3 className="font-headline font-bold text-xl md:text-2xl text-gray-900 mt-1 font-mono">
            {formatINR(totalSanctioned)}
          </h3>
          <p className="text-[11px] text-gray-500 mt-1">Total Funds Sanctioned</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-subtle border border-blue-100">
          <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
            Recorded Expenditure
          </span>
          <h3 className="font-headline font-bold text-xl md:text-2xl text-primary mt-1 font-mono">
            {formatINR(totalDisbursed)}
          </h3>
          <p className="text-[11px] text-gray-500 mt-1">Verified Physical Disbursal</p>
        </div>
      </section>

      {/* ─── COMPLETED WORKS SECTION IN CARD FORM ─────────────────────────── */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-emerald-100 shadow-subtle space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
              <CheckCircle2 className="w-4 h-4" />
              Verified Execution Cards
            </div>
            <h2 className="font-headline font-bold text-2xl text-gray-900">
              Completed Works by {mpName} ({filteredCompletedWorks.length})
            </h2>
            <p className="text-xs text-gray-500">
              Verified ground completion certificates registered under {mpName}&apos;s MPLADS fund allocation.
            </p>
          </div>

          {/* Search & View Mode Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search completed works..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCompletedPage(1);
                }}
                className="pl-9 pr-3 py-2 text-xs border rounded-xl w-56 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 shadow-inner">
              <button
                onClick={() => setViewMode("cards")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "cards"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "table"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loadingCompleted ? (
          <div className="py-16 text-center text-xs text-gray-400">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Retrieving completed works for {mpName}...
          </div>
        ) : completedError ? (
          <div className="p-8 text-center text-red-600 bg-red-50 rounded-2xl text-xs font-bold">
            {completedError}
          </div>
        ) : filteredCompletedWorks.length === 0 ? (
          <div className="py-16 text-center bg-gray-50 rounded-2xl border text-gray-500 space-y-2">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto" />
            <h3 className="font-headline font-bold text-base text-gray-800">No completed works found</h3>
            <p className="text-xs text-gray-400">
              No completed records matched your query for {mpName}.
            </p>
          </div>
        ) : viewMode === "cards" ? (
          /* Cards View Mode for MP Completed Works */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedCompleted.map((rc, idx) => {
              const { id: cleanWorkId, title: cleanWorkTitle } = parseWorkInfo(rc.work_id);
              return (
                <div
                  key={`${rc.work_id}-${idx}`}
                  className="bg-white rounded-2xl p-5 border border-gray-100 shadow-subtle hover:shadow-medium hover:border-emerald-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3.5">
                    {/* Header Status & Chamber */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Completed
                      </span>
                      <span className="uppercase text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 tracking-wider">
                        {rc.parliament ? rc.parliament.replace("_", " ") : "LOK SABHA"}
                      </span>
                    </div>

                    {/* Work ID & Title / Description */}
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

                    {/* Details Box */}
                    <div className="bg-gray-50/80 rounded-xl p-3 space-y-1.5 text-xs border border-gray-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-400 font-medium">MP Name</span>
                        <span className="font-bold text-gray-800 text-right truncate max-w-[180px]">
                          {rc.mp_name || mpName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-400 font-medium">Constituency</span>
                        <span className="text-gray-700 font-medium text-right truncate max-w-[180px]">
                          {rc.constituency || mpConstituency}
                        </span>
                      </div>
                      {rc.category && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-400 font-medium">Category</span>
                          <span className="text-gray-600 text-right truncate max-w-[180px]">
                            {rc.category}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial & Action Footer */}
                  <div className="pt-3.5 border-t border-gray-100 mt-4 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
                        Disbursed Amount
                      </span>
                      <span className="font-headline font-extrabold text-xl text-emerald-700 font-mono block mt-0.5">
                        {formatINR(rc.amount)}
                      </span>
                    </div>

                    <Link
                      href={`/projects/${encodeURIComponent(cleanWorkId)}?parliament=${rc.parliament || parliament}`}
                      className="px-3 py-1.5 bg-gray-900 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                    >
                      <span>Details</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View Mode */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 uppercase font-bold text-gray-500 border-b">
                <tr>
                  <th className="p-3">Work ID</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Constituency</th>
                  <th className="p-3 text-right">Disbursed Amount</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedCompleted.map((rc, idx) => (
                  <tr key={`${rc.work_id}-${idx}`} className="hover:bg-gray-50/60 transition-colors">
                    <td className="p-3 font-mono font-bold text-primary max-w-xs truncate">{rc.work_id}</td>
                    <td className="p-3 font-medium text-gray-800 max-w-sm truncate" title={rc.description}>
                      {rc.description || "--"}
                    </td>
                    <td className="p-3 text-gray-600">{rc.constituency || mpConstituency}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">
                      {formatINR(rc.amount)}
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" /> Completed
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <Link
                        href={`/projects/${encodeURIComponent(rc.work_id)}?parliament=${rc.parliament || parliament}`}
                        className="px-2.5 py-1 bg-gray-900 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors inline-flex items-center gap-1"
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
        {filteredCompletedWorks.length > limit && (
          <div className="flex items-center justify-between pt-4 border-t text-xs text-gray-600">
            <span>
              Page <strong className="font-mono text-gray-900">{completedPage}</strong> of{" "}
              <strong className="font-mono text-gray-900">{totalPages}</strong> ({filteredCompletedWorks.length.toLocaleString()} completed works)
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
                onClick={() => setCompletedPage((p) => Math.min(totalPages, p + 1))}
                disabled={completedPage >= totalPages}
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

