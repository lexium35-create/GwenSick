import { NextResponse } from "next/server";
import { createClaudeProvider } from "@/lib/ai/claude";
import type { ChatMessage } from "@/lib/ai/provider";

export const runtime = "nodejs";

const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 12000;
const DEFAULT_MODEL = "claude-sonnet-4-5";

const MODE_PROMPTS: Record<string, string> = {
  analyst: "Act as a rigorous strategic analyst. Challenge assumptions, identify leverage, and give a clear verdict.",
  coach: "Act as a demanding but constructive performance coach. Diagnose the bottleneck and give concrete drills, habits, and checkpoints.",
  planner: "Act as an execution planner. Sequence the work, expose dependencies, identify risks, and make the next actions unambiguous.",
  scout: "Act as a scouting and research analyst. Separate known facts from inference, compare alternatives, and identify what must be verified.",
};

function isValidMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as { role?: unknown; content?: unknown };
  return (message.role === "user" || message.role === "assistant") && typeof message.content === "string" && message.content.trim().length > 0 && message.content.length <= MAX_MESSAGE_LENGTH;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "GwenSick is not configured yet. Set ANTHROPIC_API_KEY on the server." }, { status: 503 });

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    const payload = body as { messages?: unknown; mode?: unknown };
    if (!Array.isArray(payload.messages) || payload.messages.length === 0) return NextResponse.json({ error: "messages must be a non-empty array." }, { status: 400 });

    const selectedMessages = payload.messages.slice(-MAX_MESSAGES);
    if (!selectedMessages.every(isValidMessage)) return NextResponse.json({ error: "Each message must have a valid role and non-empty content within the size limit." }, { status: 400 });

    const requestedMode = typeof payload.mode === "string" ? payload.mode : "analyst";
    const mode = MODE_PROMPTS[requestedMode] ? requestedMode : "analyst";
    const messages = selectedMessages.map((message) => ({ role: message.role, content: message.content.trim() }));
    const provider = createClaudeProvider({ apiKey, model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL, mode, modePrompt: MODE_PROMPTS[mode] });
    const response = await provider.respond(messages);
    return NextResponse.json({ message: response, mode });
  } catch (error) {
    console.error("Chat API error:", error);
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
