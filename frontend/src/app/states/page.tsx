"use client";

import React, { useState, useEffect, useMemo } from "react";
import { StateSummary } from "@/types/overview";
import { getStateAggregations } from "@/lib/api";
import StateCard from "@/components/features/StateCard";
import {
  MapPin,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

export default function BrowseStatesPage() {
  const [parliament, setParliament] = useState<string>("all");
  const [states, setStates] = useState<StateSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("rank_asc");

  const fetchStates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStateAggregations(parliament);
      if (res && res.success && Array.isArray(res.data)) {
        setStates(res.data);
      } else if (Array.isArray(res)) {
        setStates(res);
      } else {
        throw new Error("Failed to load State and Union Territory data.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading States/UTs";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStates();
  }, [parliament]);

  // Filtered and Sorted States
  const filteredStates = useMemo(() => {
    return states
      .filter((st) => {
        const matchesSearch = st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              st.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = typeFilter === "ALL" || st.type === typeFilter;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        if (sortBy === "rank_asc") return (a.rank ?? 999) - (b.rank ?? 999);
        if (sortBy === "rank_desc") return (b.rank ?? 0) - (a.rank ?? 0);
        if (sortBy === "projects_desc") return b.totalProjects - a.totalProjects;
        if (sortBy === "projects_asc") return a.totalProjects - b.totalProjects;
        if (sortBy === "completion_desc") return b.completionRate - a.completionRate;
        if (sortBy === "sanctioned_desc") return b.sanctionedAmount - a.sanctionedAmount;
        if (sortBy === "name_asc") return a.name.localeCompare(b.name);
        return 0;
      });
  }, [states, searchQuery, typeFilter, sortBy]);

  const totalWorks = states.reduce((acc, s) => acc + s.totalProjects, 0);
  const totalCompleted = states.reduce((acc, s) => acc + s.completedProjects, 0);

  return (
    <div className="flex flex-col gap-8 font-body pb-24">
      {/* Header & Chamber Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-2 border border-primary/20">
            <MapPin className="w-3.5 h-3.5" />
            Pan-India Geographic Directory
          </div>
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl text-gray-900 tracking-tight">
            Browse States & Union Territories
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Explore development works, fund utilization, and completion rates dynamically across all 36 States and UTs.
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
            onClick={fetchStates}
            disabled={loading}
            className="p-2 rounded-xl border hover:bg-gray-50 text-gray-600 transition-colors"
            title="Refresh State Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* High-Level Overview Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-subtle">
          <span className="text-[10px] uppercase font-bold text-gray-400 block">States Covered</span>
          <span className="font-headline font-bold text-xl text-gray-900 block mt-0.5">
            {states.filter((s) => s.type === "STATE").length} States
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-subtle">
          <span className="text-[10px] uppercase font-bold text-gray-400 block">UTs Covered</span>
          <span className="font-headline font-bold text-xl text-purple-700 block mt-0.5">
            {states.filter((s) => s.type === "UT").length} Union Territories
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-subtle">
          <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Works Represented</span>
          <span className="font-headline font-bold text-xl text-primary block mt-0.5">
            {totalWorks.toLocaleString()}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-subtle">
          <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Completed Works</span>
          <span className="font-headline font-bold text-xl text-emerald-700 block mt-0.5">
            {totalCompleted.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search State or Union Territory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="py-2 px-3 text-xs border rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-primary font-bold text-gray-700"
          >
            <option value="ALL">All Entities ({states.length})</option>
            <option value="STATE">States ({states.filter((s) => s.type === "STATE").length})</option>
            <option value="UT">Union Territories ({states.filter((s) => s.type === "UT").length})</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="py-2 px-3 text-xs border rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-primary font-bold text-gray-700"
          >
            <option value="rank_asc">Rank (#1 to #36)</option>
            <option value="rank_desc">Rank (#36 to #1)</option>
            <option value="projects_desc">Highest Works</option>
            <option value="projects_asc">Lowest Works</option>
            <option value="completion_desc">Best Completion %</option>
            <option value="sanctioned_desc">Highest Sanctioned Amount</option>
            <option value="name_asc">Alphabetical (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && states.length === 0 && (
        <div className="py-24 text-center text-gray-400 bg-white rounded-3xl border border-gray-100 shadow-subtle">
          <RefreshCw className="w-10 h-10 animate-spin mx-auto mb-3 text-primary opacity-50" />
          <p className="text-base font-bold text-gray-700">Loading States & Union Territories...</p>
          <p className="text-xs text-gray-400 mt-1">Aggregating 75,501 works across 36 geographic regions.</p>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="text-xs text-red-800 font-bold">{error}</span>
          </div>
          <button
            onClick={fetchStates}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-900 text-xs font-bold rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* States & UT Cards Grid */}
      {!loading && filteredStates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStates.map((st) => (
            <StateCard
              key={st.id}
              state={st}
              parliament={parliament}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredStates.length === 0 && (
        <div className="p-16 text-center bg-white rounded-2xl border text-gray-500 space-y-2">
          <MapPin className="w-8 h-8 text-gray-400 mx-auto" />
          <h3 className="font-headline font-bold text-base text-gray-800">No States or UTs found</h3>
          <p className="text-xs text-gray-400">
            No geographic entities matched your current search &quot;{searchQuery}&quot;.
          </p>
        </div>
      )}
    </div>
  );
}
