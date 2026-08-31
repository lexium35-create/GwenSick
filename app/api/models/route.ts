import { NextResponse } from "next/server";
import { listSeekAIModels } from "@/lib/ai/seekai";

export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.SEEKAI_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      { error: "SEEKAI_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  try {
    const models = await listSeekAIModels(apiKey);
    return NextResponse.json({ models });
  } catch (error) {
    console.error("SeekAI model discovery error:", error);
    const message = error instanceof Error ? error.message : "Unable to load SeekAI models.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
