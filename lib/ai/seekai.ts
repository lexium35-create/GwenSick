import type { AIProvider, AIProviderConfig, ChatMessage } from "./provider";

const DEFAULT_BASE_URL = "https://seekai.cc/v1";
const REQUEST_TIMEOUT_MS = 75_000;
const MODEL_TIMEOUT_MS = 20_000;
const ANTHROPIC_VERSION = "2023-06-01";

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

function isClaudeModel(model: string) {
  return /^claude[-_]/i.test(model.trim()) || /(^|[/:-])claude[-_]/i.test(model.trim());
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorDetail(status: number, data: unknown) {
  if (typeof data === "string" && data.trim()) return data.trim().slice(0, 1200);
  if (data && typeof data === "object" && "error" in data) {
    const value = (data as { error: unknown }).error;
    if (typeof value === "string") return value.slice(0, 1200);
    try {
      return JSON.stringify(value).slice(0, 1200);
    } catch {
      return "Unknown upstream error.";
    }
  }
  return `SeekAI returned HTTP ${status}.`;
}

function extractChatCompletion(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("choices" in data)) return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return null;
  const content = (choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((part) => (part && typeof part === "object" && "text" in part ? (part as { text?: unknown }).text : ""))
      .filter((part): part is string => typeof part === "string")
      .join("")
      .trim();
    if (text) return text;
  }
  return null;
}

function extractAnthropicMessage(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("content" in data)) return null;
  const content = (data as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  const text = content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const type = "type" in block ? (block as { type?: unknown }).type : undefined;
      const value = "text" in block ? (block as { text?: unknown }).text : undefined;
      return type === "text" && typeof value === "string" ? value : "";
    })
    .join("")
    .trim();
  return text || null;
}

function shouldTryAlternateProtocol(status: number, data: unknown) {
  if (status === 404 || status === 405 || status === 415) return true;
  const detail = errorDetail(status, data).toLowerCase();
  return detail.includes("not supported") || detail.includes("unsupported") || detail.includes("endpoint");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestChatCompletions(apiKey: string, model: string, messages: ChatMessage[]) {
  const response = await fetchWithTimeout(`${getBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
      stream: false,
    }),
  }, REQUEST_TIMEOUT_MS);

  const data = await readBody(response);
  return { response, data, content: extractChatCompletion(data) };
}

async function requestAnthropicMessages(apiKey: string, model: string, messages: ChatMessage[]) {
  const system = messages.find((message) => message.role === "system")?.content;
  const conversation = messages.filter((message) => message.role !== "system");

  const response = await fetchWithTimeout(`${getBaseUrl()}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model,
      ...(system ? { system } : {}),
      messages: conversation,
      max_tokens: 2048,
      stream: false,
    }),
  }, REQUEST_TIMEOUT_MS);

  const data = await readBody(response);
  return { response, data, content: extractAnthropicMessage(data) };
}

export function createSeekAIProvider(config: AIProviderConfig): AIProvider {
  const modeBlock = config.modePrompt?.trim()
    ? `\n\nACTIVE MODE: ${config.mode || "analyst"}\n${config.modePrompt.trim()}`
    : "";
  const systemPrompt = `${CORE_PROMPT}${modeBlock}`;

  return {
    async respond(messages: ChatMessage[]) {
      const normalizedMessages: ChatMessage[] = [
        { role: "user", content: systemPrompt },
        ...messages,
      ];

      try {
        if (isClaudeModel(config.model)) {
          const anthropicMessages = await requestAnthropicMessages(config.apiKey, config.model, [
            { role: "system", content: systemPrompt },
            ...messages,
          ]);
          if (anthropicMessages.response.ok && anthropicMessages.content) return anthropicMessages.content;

          if (!anthropicMessages.response.ok && !shouldTryAlternateProtocol(anthropicMessages.response.status, anthropicMessages.data)) {
            throw new Error(`SeekAI Claude request failed: ${errorDetail(anthropicMessages.response.status, anthropicMessages.data)}`);
          }

          const fallback = await requestChatCompletions(config.apiKey, config.model, normalizedMessages);
          if (fallback.response.ok && fallback.content) return fallback.content;
          throw new Error(`SeekAI request failed for ${config.model}: ${errorDetail(fallback.response.status, fallback.data)}`);
        }

        const chat = await requestChatCompletions(config.apiKey, config.model, [
          { role: "system", content: systemPrompt },
          ...messages,
        ]);
        if (chat.response.ok && chat.content) return chat.content;

        if (chat.response.ok) {
          throw new Error(`SeekAI returned an empty assistant response for ${config.model}.`);
        }

        if (shouldTryAlternateProtocol(chat.response.status, chat.data)) {
          const fallback = await requestAnthropicMessages(config.apiKey, config.model, messages);
          if (fallback.response.ok && fallback.content) return fallback.content;
        }

        throw new Error(`SeekAI request failed: ${errorDetail(chat.response.status, chat.data)}`);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(`SeekAI request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds for ${config.model}.`);
        }
        if (error instanceof TypeError) {
          throw new Error(`Could not reach SeekAI at ${getBaseUrl()}. Check SEEKAI_BASE_URL, DNS/network access, and the API key.`);
        }
        throw error;
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
  try {
    const response = await fetchWithTimeout(`${getBaseUrl()}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    }, MODEL_TIMEOUT_MS);
    const data = await readBody(response);
    if (!response.ok) throw new Error(`SeekAI model discovery failed: ${errorDetail(response.status, data)}`);
    if (!data || typeof data !== "object" || !Array.isArray((data as { data?: unknown }).data)) {
      throw new Error("SeekAI returned an invalid model catalogue.");
    }
    return (data as { data: SeekAIModel[] }).data
      .filter((model) => model && typeof model.id === "string" && model.id.trim().length > 0)
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("SeekAI model discovery timed out.");
    if (error instanceof TypeError) throw new Error(`Could not reach SeekAI at ${getBaseUrl()}.`);
    throw error;
  }
}
