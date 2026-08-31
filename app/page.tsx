"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

const starterPrompts = [
  { title: "Review a decision", text: "Pressure-test a decision I'm making. Find the weak assumption and give me your verdict." },
  { title: "Build a plan", text: "Turn this idea into a concrete plan with priorities, risks, and the next three moves." },
  { title: "Analyze a problem", text: "Help me break down a difficult problem and identify the highest-leverage move." },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [input]);

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
      if (!response.ok || !data.message) throw new Error(data.error || "The analyst is unavailable.");
      setMessages((current) => [...current, { role: "assistant", content: data.message! }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function clearChat() {
    if (loading) return;
    setMessages([]);
    setError("");
    setInput("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className="workspace" aria-label="GwenSick strategic AI workspace">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true"><span>G</span></div>
            <div>
              <div className="brand-name">GWENSICK</div>
              <div className="brand-subtitle">STRATEGIC INTELLIGENCE</div>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="system-status"><span className="status-pulse" /> SYSTEM ONLINE</div>
            {messages.length > 0 && (
              <button className="clear-button" type="button" onClick={clearChat} disabled={loading}>NEW SESSION</button>
            )}
          </div>
        </header>

        <div className={`conversation ${messages.length > 0 ? "has-messages" : ""}`}>
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="eyebrow"><span /> ANALYST DESK / 01</div>
              <h1>Make the <em>next</em><br />move count.</h1>
              <p className="welcome-copy">GwenSick is a strategic AI for competitive players, team staff, and operators. Bring a decision, a problem, or an idea. Leave with a clearer read.</p>

              <div className="prompt-grid">
                {starterPrompts.map((prompt, index) => (
                  <button className="prompt-card" key={prompt.title} type="button" onClick={() => { setInput(prompt.text); textareaRef.current?.focus(); }}>
                    <span className="prompt-index">0{index + 1}</span>
                    <span className="prompt-title">{prompt.title}</span>
                    <span className="prompt-arrow">↗</span>
                  </button>
                ))}
              </div>

              <div className="capability-row">
                <span>DECISION SUPPORT</span><i />
                <span>STRATEGY</span><i />
                <span>ANALYSIS</span><i />
                <span>PLANNING</span>
              </div>
            </div>
          ) : (
            <div className="thread">
              <div className="thread-head"><span>SESSION / ACTIVE</span><span>{messages.length} {messages.length === 1 ? "ENTRY" : "ENTRIES"}</span></div>
              {messages.map((message, index) => (
                <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                  <div className="message-meta">
                    <span className="message-role">{message.role === "user" ? "OPERATOR" : "GWENSICK"}</span>
                    <span className="message-number">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="message-content">{message.content}</div>
                </article>
              ))}
              {loading && (
                <article className="message assistant">
                  <div className="message-meta"><span className="message-role">GWENSICK</span><span className="message-number">•••</span></div>
                  <div className="thinking"><span /><span /><span /><b>ANALYZING</b></div>
                </article>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="input-zone">
          {error && <div className="error" role="alert"><span>!</span>{error}</div>}
          <form className="composer" onSubmit={sendMessage}>
            <div className="composer-label">MESSAGE / <span>SHIFT + ENTER FOR NEW LINE</span></div>
            <div className="composer-row">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="What are we solving?"
                rows={1}
                maxLength={12000}
                disabled={loading}
                aria-label="Message GwenSick"
              />
              <button className="send-button" type="submit" disabled={!input.trim() || loading} aria-label="Send message">
                <span>{loading ? "…" : "SEND"}</span><b>↗</b>
              </button>
            </div>
            <div className="composer-foot"><span>GWENSICK / PRIVATE ANALYST SESSION</span><span>{input.length.toLocaleString()} / 12,000</span></div>
          </form>
          <footer>AI analysis can be wrong. Verify consequential information before acting.</footer>
        </div>
      </section>
    </main>
  );
}
