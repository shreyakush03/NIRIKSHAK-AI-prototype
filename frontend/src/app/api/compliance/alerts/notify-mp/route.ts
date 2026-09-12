import { NextRequest, NextResponse } from "next/server";
import { callMLService } from "@/services/ml.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await callMLService(
      `/api/v1/compliance/alerts/notify-mp`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: "Failed to dispatch MP notification", details: message },
      { status: 502 }
    );
  }
}

