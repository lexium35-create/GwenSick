"use client";

import { FormEvent, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

const starterPrompts = [
  "What can you help me with?",
  "Explain something difficult simply.",
  "Help me plan a project.",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok || !data.message) throw new Error(data.error || "The AI request failed.");

      setMessages((current) => [...current, { role: "assistant", content: data.message! }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="chat-card" aria-label="GwenSick AI chat">
        <header className="header">
          <div className="brand"><span className="status-dot" /> <span>GWENSICK</span></div>
          <span className="badge">AI CHAT</span>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty">
              <div className="orb">G</div>
              <h1>What are we building?</h1>
              <p>Ask GwenSick anything. Ideas, code, research, planning — start anywhere.</p>
              <div className="prompts">
                {starterPrompts.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => setInput(prompt)}>{prompt}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <span className="label">{message.role === "user" ? "YOU" : "GWENSICK"}</span>
                <div className="bubble">{message.content}</div>
              </div>
            ))
          )}
          {loading && <div className="message assistant"><span className="label">GWENSICK</span><div className="bubble typing">Thinking<span>.</span><span>.</span><span>.</span></div></div>}
        </div>

        {error && <div className="error" role="alert">{error}</div>}

        <form className="composer" onSubmit={sendMessage}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }}
            placeholder="Message GwenSick..."
            rows={1}
            maxLength={12000}
            disabled={loading}
            aria-label="Message GwenSick"
          />
          <button className="send" type="submit" disabled={!input.trim() || loading} aria-label="Send message">↑</button>
        </form>
        <footer>AI responses may be inaccurate. Verify important information.</footer>
      </section>
    </main>
  );
}
