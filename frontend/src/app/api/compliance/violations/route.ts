import { NextRequest, NextResponse } from "next/server";
import { callMLService } from "@/services/ml.service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parliament = searchParams.get("parliament") || "all";
  const financialYear = searchParams.get("financial_year") || "all";
  const severity = searchParams.get("severity") || "ALL";
  const ruleCode = searchParams.get("rule_code") || "ALL";
  const state = searchParams.get("state") || "ALL";
  const limit = searchParams.get("limit") || "100";

  try {
    const query = new URLSearchParams({
      parliament,
      financial_year: financialYear,
      severity,
      rule_code: ruleCode,
      state,
      limit,
    }).toString();

    const data = await callMLService(`/api/v1/compliance/violations?${query}`, {
      method: "GET",
    });
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: "Failed to fetch compliance violations", details: message },
      { status: 502 }
    );
  }
}

