"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Scale,
  ShieldCheck,
  Building,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Gavel,
  ShieldAlert,
} from "lucide-react";

interface LegalRule {
  code: string;
  title: string;
  mospiSection: string;
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  legalRequirement: string;
  procedureOnViolation: string;
  sanctionClause: string;
}

const STATUTORY_RULES: LegalRule[] = [
  {
    code: "EXP_BEFORE_SANCTION",
    title: "Expenditure Recorded Prior to Administrative Sanction",
    mospiSection: "MPLADS Guidelines Section 3.1 & 3.2",
    category: "Statutory Authority",
    severity: "CRITICAL",
    legalRequirement:
      "No financial expenditure, advance payment, or work commencement can take place before formal Administrative Sanction (AS) is issued by the District Authority and recorded on the Sakshi Portal.",
    procedureOnViolation:
      "Immediate freeze of fund disbursal. Nodal officer required to submit a show-cause explanation. Violation is referred to the State Nodal Department for audit inquiry under GFR Rule 211.",
    sanctionClause:
      "Works commenced without AS are deemed un-authorized. Disbursed funds must be recovered from the implementing agency.",
  },
  {
    code: "EXP_EXCEEDS_SANCTION",
    title: "Expenditure Exceeding Approved Sanction Limit",
    mospiSection: "MPLADS Guidelines Section 4.5",
    category: "Financial Control",
    severity: "HIGH",
    legalRequirement:
      "Total cumulative disbursal for any recommended work must not exceed the sanctioned ceiling amount approved in the official Administrative Sanction order.",
    procedureOnViolation:
      "Automatic block on further payment release. Re-sanction request must be submitted with revised technical estimates to the District Magistrate for formal approval.",
    sanctionClause:
      "Excess expenditure without prior re-sanction constitutes a financial irregularity under Public Finance Management System (PFMS) guidelines.",
  },
  {
    code: "EXCESSIVE_DELAY",
    title: "Project Execution Pending Beyond 365 Days",
    mospiSection: "MPLADS Guidelines Section 5.2",
    category: "Timeline Compliance",
    severity: "HIGH",
    legalRequirement:
      "Works sanctioned under MPLADS must be completed within 12 months (365 days) from the date of administrative sanction, unless an explicit extension is granted by the District Authority.",
    procedureOnViolation:
      "Project flagged for Time Overrun Review. District Authority conducts physical inspection and issues a show-cause notice to the implementing agency.",
    sanctionClause:
      "Failure to complete work within extended timelines results in penalty clauses under the contract and potential blacklisting of the executing agency.",
  },
  {
    code: "MISSING_COMPLETION_CERT",
    title: "100% Disbursal Without Physical Completion Certificate",
    mospiSection: "MPLADS Guidelines Section 6.1",
    category: "Physical Audit",
    severity: "HIGH",
    legalRequirement:
      "The final 10-20% fund release requires submission of a certified Physical Completion Certificate (CC) signed by an authorized engineer and uploaded with geo-tagged photographs.",
    procedureOnViolation:
      "Final payment voucher held in escrow. Physical verification audit dispatched by District Planning Unit.",
    sanctionClause:
      "Release of final funds without CC violates statutory audit guidelines and triggers CAG (Comptroller and Auditor General) audit observation.",
  },
  {
    code: "FINANCIAL_PHYSICAL_MISMATCH",
    title: "Disproportionate Financial Utilization vs Physical Progress",
    mospiSection: "MPLADS Guidelines Section 7.3",
    category: "Progress Audit",
    severity: "MEDIUM",
    legalRequirement:
      "Financial releases must strictly correspond to verified physical progress milestones (e.g., 50% funds for 50% physical completion).",
    procedureOnViolation:
      "Subsequent tranche release halted until physical progress inspection report reconciles with expenditure vouchers.",
    sanctionClause:
      "Unjustified advance fund release violates General Financial Rules (GFR) Rule 230(1).",
  },
  {
    code: "DUPLICATE_PAYMENT_PATTERN",
    title: "Duplicate Fund Allocation Across Matching Works",
    mospiSection: "MPLADS Guidelines Section 8.4",
    category: "Payment Audit",
    severity: "HIGH",
    legalRequirement:
      "MPLADS funds cannot be recommended or disbursed for asset creation already funded under state schemes, Central schemes, or existing MPLADS allocations.",
    procedureOnViolation:
      "Immediate cross-constituency database reconciliation audit. Payment paused pending clearance by Nodal Officer.",
    sanctionClause:
      "Duplicate allocation constitutes double-dipping and is subject to immediate recovery and legal inquiry.",
  },
  {
    code: "SINGLE_VENDOR_CONCENTRATION",
    title: "High Agency/Vendor Concentration Ratio",
    mospiSection: "MPLADS Guidelines Section 8.7",
    category: "Procurement Audit",
    severity: "MEDIUM",
    legalRequirement:
      "Works must be executed following transparent, competitive procurement procedures as prescribed by the State Government / GFR.",
    procedureOnViolation:
      "Procurement audit triggered to verify tender transparency and ensure non-monopolistic allocation.",
    sanctionClause:
      "Direct award of work without competitive bidding (except designated Panchayati Raj / Public Agencies) violates procurement guidelines.",
  },
];

export default function RulesAndLegalProcedure() {
  const [expandedCode, setExpandedCode] = useState<string | null>("EXP_BEFORE_SANCTION");

  return (
    <div className="space-y-8 font-body">
      {/* Overview Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Scale className="w-7 h-7 text-primary" />
              <h2 className="text-2xl font-black font-headline tracking-tight text-slate-900">
                Statutory Rules & Legal Procedure Framework
              </h2>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed font-medium">
              Governed by official statutory regulations issued by the{" "}
              <strong className="text-slate-900">
                Ministry of Statistics and Programme Implementation (MoSPI), Government of India
              </strong>
              , General Financial Rules (GFR), and Public Financial Management System (PFMS).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-extrabold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm">
              <BookOpen className="w-3.5 h-3.5" /> MoSPI Guidelines 2023
            </span>
          </div>
        </div>

        {/* Source & Regulatory Context Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Nodal Authority
            </div>
            <p className="text-xs text-slate-600 leading-normal font-medium">
              MoSPI & State Nodal Planning Department mandate strict administrative sanction workflows.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider">
              <Building className="w-4 h-4 text-blue-600" /> Executive Implementation
            </div>
            <p className="text-xs text-slate-600 leading-normal font-medium">
              District Magistrate / District Collector acts as the statutory sanctioning and verification authority.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider">
              <Gavel className="w-4 h-4 text-amber-600" /> Statutory Standards
            </div>
            <p className="text-xs text-slate-600 leading-normal font-medium">
              General Financial Rules (GFR 211 & 230) & CAG audit standards govern fund releases.
            </p>
          </div>
        </div>
      </div>

      {/* Rules Accordion Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black font-headline text-slate-900 uppercase tracking-wider">
            7 Statutory Compliance Clauses & Legal Procedures
          </h3>
          <span className="text-xs font-bold text-slate-500">Click to expand legal details</span>
        </div>

        <div className="space-y-3">
          {STATUTORY_RULES.map((rule) => {
            const isExpanded = expandedCode === rule.code;

            return (
              <div
                key={rule.code}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm transition-all hover:border-slate-300"
              >
                {/* Accordion Header */}
                <button
                  onClick={() => setExpandedCode(isExpanded ? null : rule.code)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`font-mono text-xs px-3 py-1 rounded-md font-black ${
                        rule.severity === "CRITICAL"
                          ? "bg-red-100 text-red-700 border border-red-200"
                          : rule.severity === "HIGH"
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-blue-100 text-blue-700 border border-blue-200"
                      }`}
                    >
                      {rule.code}
                    </span>

                    <div>
                      <h4 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
                        {rule.title}
                      </h4>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">
                        {rule.mospiSection}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 hidden sm:inline">
                      {rule.category}
                    </span>
                    <div className="p-1 rounded-lg bg-slate-100 text-slate-600">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="p-6 border-t border-slate-100 bg-slate-50/70 space-y-5 text-xs">
                    <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                      <span className="font-black text-slate-900 block mb-1 uppercase tracking-wider text-[11px] text-primary">
                        📜 Statutory Legal Requirement:
                      </span>
                      <p className="text-slate-700 text-xs leading-relaxed font-medium">
                        {rule.legalRequirement}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1 shadow-sm">
                        <span className="font-black text-amber-800 block uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Legal Procedure on Violation:
                        </span>
                        <p className="text-slate-800 text-xs leading-relaxed font-medium">
                          {rule.procedureOnViolation}
                        </p>
                      </div>

                      <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-1 shadow-sm">
                        <span className="font-black text-rose-800 block uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <Gavel className="w-3.5 h-3.5 text-rose-600" /> Penalty & Audit Clause:
                        </span>
                        <p className="text-slate-800 text-xs leading-relaxed font-medium">
                          {rule.sanctionClause}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Official Escalation Process Banner */}
      <div className="rounded-2xl bg-slate-900 p-6 sm:p-8 text-white space-y-5 shadow-lg border border-slate-800">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-rose-400" />
          <h4 className="font-black font-headline text-lg tracking-tight">
            Official Legal Audit & Escalation Framework
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-white/10 backdrop-blur border border-white/10 space-y-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase">
              Stage 1
            </span>
            <div className="font-extrabold text-sm text-white">System Detection</div>
            <p className="text-slate-300 leading-relaxed font-medium">
              Automated rule verification by NIRIKSHAK AI engine flags non-compliant disbursals on Sakshi Audit ledger.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/10 backdrop-blur border border-white/10 space-y-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-[10px] font-black uppercase">
              Stage 2
            </span>
            <div className="font-extrabold text-sm text-white">District Inquiry</div>
            <p className="text-slate-300 leading-relaxed font-medium">
              District Planning Unit dispatches physical audit team & issues formal show-cause notice within 15 days.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/10 backdrop-blur border border-white/10 space-y-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-black uppercase">
              Stage 3
            </span>
            <div className="font-extrabold text-sm text-white">CAG Statutory Audit</div>
            <p className="text-slate-300 leading-relaxed font-medium">
              Escalation to MoSPI Compliance Directorate & Comptroller and Auditor General for recovery proceedings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
