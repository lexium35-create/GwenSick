import type { AIProvider, AIProviderConfig, ChatMessage } from "./provider";

const DEFAULT_BASE_URL = "https://seekai.cc/v1";
const CORE_PROMPT = `You are GwenSick, a strategic intelligence operator for people making decisions under pressure.

VOICE
- Calm, precise, direct, slightly dry.
- Lead with the answer, verdict, or diagnosis.
- Have a point of view. Do not manufacture five equal options when one is clearly stronger.
- Do not restate the user's request or add filler.

ANALYSIS
- Separate known facts, supplied context, and inference.
- Surface the highest-leverage variable, the weakest assumption, and the main failure mode when relevant.
- Prefer concrete next actions, decision criteria, and measurable checkpoints.
- State uncertainty plainly. Never fabricate data, sources, statistics, scouting observations, or tool results.

CAPABILITY
- Never claim to have searched the web, inspected a file, watched a VOD, accessed an account, or executed an external action unless the system actually provided that capability and it was used.
- Recommendations are not guarantees.
- Irreversible actions require explicit human confirmation.

MEMORY
- Use only context supplied in the conversation or explicitly provided by the application. Never invent prior interactions, preferences, or facts.`;

export function createSeekAIProvider(config: AIProviderConfig): AIProvider {
  const baseUrl = (process.env.SEEKAI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
  const modeBlock = config.modePrompt?.trim()
    ? `\n\nACTIVE MODE: ${config.mode || "analyst"}\n${config.modePrompt.trim()}`
    : "";

  return {
    async respond(messages: ChatMessage[]) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "system", content: `${CORE_PROMPT}${modeBlock}` }, ...messages],
          max_tokens: 2048,
          stream: false,
        }),
        cache: "no-store",
      });

      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = data && typeof data === "object" && "error" in data
          ? JSON.stringify((data as { error: unknown }).error)
          : `SeekAI returned HTTP ${response.status}`;
        throw new Error(`SeekAI request failed: ${detail}`);
      }

      const content = data && typeof data === "object" && "choices" in data
        ? (data as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content
        : undefined;

      if (typeof content !== "string" || !content.trim()) {
        throw new Error("SeekAI returned no assistant text.");
      }

      return content.trim();
    },
  };
}

export type SeekAIModel = {
  id: string;
  object?: string;
  owned_by?: string;
  created?: number;
  [key: string]: unknown;
};

export async function listSeekAIModels(apiKey: string): Promise<SeekAIModel[]> {
  const baseUrl = (process.env.SEEKAI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data && typeof data === "object" && "error" in data
      ? JSON.stringify((data as { error: unknown }).error)
      : `SeekAI returned HTTP ${response.status}`;
    throw new Error(`SeekAI model discovery failed: ${detail}`);
  }

  if (!data || typeof data !== "object" || !Array.isArray((data as { data?: unknown }).data)) {
    throw new Error("SeekAI returned an invalid model catalogue.");
  }

  return (data as { data: SeekAIModel[] }).data
    .filter((model) => model && typeof model.id === "string" && model.id.trim().length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
}
