import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const configured = Boolean(process.env.SEEKAI_API_KEY?.trim());
  return NextResponse.json(
    {
      status: configured ? "ready" : "configuration_required",
      provider: "seekai",
      baseUrl: process.env.SEEKAI_BASE_URL?.trim() || "https://seekai.cc/v1",
    },
    {
      status: configured ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
