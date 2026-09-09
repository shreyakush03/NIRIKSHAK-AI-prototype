import { NextResponse } from "next/server";

const BACKEND_API = process.env.BACKEND_API_URL || "http://127.0.0.1:8000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_API}/works`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ success: false, error: "Failed to fetch works" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

