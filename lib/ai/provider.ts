export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AIProvider = {
  respond(messages: ChatMessage[]): Promise<string>;
};

export type AIProviderConfig = {
  apiKey: string;
  model: string;
  mode?: string;
  modePrompt?: string;
};
