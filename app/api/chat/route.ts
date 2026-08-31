import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 12000;
const DEFAULT_MODEL = "gpt-5-mini";

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  return apiKey ? new OpenAI({ apiKey }) : null;
}

function isValidMessage(value: unknown): value is { role: "user" | "assistant"; content: string } {
  if (!value || typeof value !== "object") return false;
  const message = value as { role?: unknown; content?: unknown };
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0 &&
    message.content.length <= MAX_MESSAGE_LENGTH
  );
}

export async function POST(request: Request) {
  const client = getClient();

  if (!client) {
    return NextResponse.json(
      { error: "GwenSick is not configured yet. Set OPENAI_API_KEY on the server." },
      { status: 503 },
    );
  }

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }

    const rawMessages = (body as { messages?: unknown }).messages;

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return NextResponse.json({ error: "messages must be a non-empty array." }, { status: 400 });
    }

    const selectedMessages = rawMessages.slice(-MAX_MESSAGES);

    if (!selectedMessages.every(isValidMessage)) {
      return NextResponse.json(
        { error: "Each message must have a valid role and non-empty content within the size limit." },
        { status: 400 },
      );
    }

    const messages = selectedMessages.map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
      instructions:
        "You are GwenSick, a concise, capable, honest AI assistant. Give useful answers, state uncertainty when relevant, and never claim to have performed actions you did not perform.",
      input: messages,
    });

    return NextResponse.json({ message: response.output_text });
  } catch (error) {
    console.error("Chat API error:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
