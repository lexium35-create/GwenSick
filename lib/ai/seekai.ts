import type { AIProvider, AIProviderConfig, ChatMessage } from "./provider";

const DEFAULT_BASE_URL = "https://seekai.cc/v1";
const REQUEST_TIMEOUT_MS = 60_000;
const MODEL_TIMEOUT_MS = 20_000;

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

function getBaseUrl() {
  return (process.env.SEEKAI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

function errorDetail(status: number, data: unknown) {
  if (typeof data === "string" && data.trim()) return data.trim().slice(0, 1000);
  if (data && typeof data === "object" && "error" in data) {
    const value = (data as { error: unknown }).error;
    if (typeof value === "string") return value.slice(0, 1000);
    try { return JSON.stringify(value).slice(0, 1000); } catch { return "Unknown upstream error."; }
  }
  return `SeekAI returned HTTP ${status}.`;
}

export function createSeekAIProvider(config: AIProviderConfig): AIProvider {
  const modeBlock = config.modePrompt?.trim()
    ? `\n\nACTIVE MODE: ${config.mode || "analyst"}\n${config.modePrompt.trim()}`
    : "";

  return {
    async respond(messages: ChatMessage[]) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(`${getBaseUrl()}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            model: config.model,
            messages: [{ role: "system", content: `${CORE_PROMPT}${modeBlock}` }, ...messages],
            max_tokens: 2048,
            stream: false,
          }),
          cache: "no-store",
          signal: controller.signal,
        });

        const data = await readBody(response);
        if (!response.ok) throw new Error(`SeekAI request failed: ${errorDetail(response.status, data)}`);

        const content = data && typeof data === "object" && "choices" in data
          ? (data as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content
          : undefined;
        if (typeof content !== "string" || !content.trim()) {
          throw new Error("SeekAI returned no assistant text. Check the selected model and API compatibility.");
        }
        return content.trim();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error("SeekAI request timed out after 60 seconds.");
        }
        if (error instanceof TypeError) {
          throw new Error(`Could not reach SeekAI at ${getBaseUrl()}. Check SEEKAI_BASE_URL and network access.`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const response = await fetch(`${getBaseUrl()}/models`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await readBody(response);
    if (!response.ok) throw new Error(`SeekAI model discovery failed: ${errorDetail(response.status, data)}`);
    if (!data || typeof data !== "object" || !Array.isArray((data as { data?: unknown }).data)) {
      throw new Error("SeekAI returned an invalid model catalogue.");
    }
    return (data as { data: SeekAIModel[] }).data
      .filter((model) => model && typeof model.id === "string" && model.id.trim().length > 0)
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("SeekAI model discovery timed out.");
    if (error instanceof TypeError) throw new Error(`Could not reach SeekAI at ${getBaseUrl()}.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
