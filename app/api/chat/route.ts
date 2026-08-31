import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 12000;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 500 });
  }

  try {
    const body = await request.json();
    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "messages must be a non-empty array." }, { status: 400 });
    }

    const messages = body.messages.slice(-MAX_MESSAGES).map((message: unknown) => {
      if (!message || typeof message !== "object") throw new Error("Invalid message.");
      const item = message as { role?: unknown; content?: unknown };
      if (item.role !== "user" && item.role !== "assistant") throw new Error("Invalid message role.");
      if (typeof item.content !== "string" || item.content.trim().length === 0 || item.content.length > MAX_MESSAGE_LENGTH) {
        throw new Error("Invalid message content.");
      }
      return { role: item.role, content: item.content.trim() } as const;
    });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      instructions: "You are GwenSick, a concise, capable, honest AI assistant. Give useful answers, state uncertainty when relevant, and never claim to have performed actions you did not perform.",
      input: messages,
    });

    return NextResponse.json({ message: response.output_text });
  } catch (error) {
    console.error("Chat API error:", error);
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
