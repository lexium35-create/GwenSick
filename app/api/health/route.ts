import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const configured = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  return NextResponse.json({
    status: configured ? "ready" : "configuration_required",
    provider: "anthropic",
    model: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5",
  }, { status: configured ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
