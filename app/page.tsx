"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };
type Session = { id: string; title: string; mode: string; updated: number; messages: Message[] };
type Mode = { id: string; name: string; description: string; prompt: string };
type Model = { id: string; owned_by?: string; created?: number; [key: string]: unknown };

const MODES: Mode[] = [
  { id: "analyst", name: "ANALYST", description: "Pressure-test decisions and find the real leverage point.", prompt: "Act as a rigorous strategic analyst. Challenge assumptions, identify leverage, and give a clear verdict." },
  { id: "coach", name: "COACH", description: "Turn a messy objective into an executable improvement loop.", prompt: "Act as a demanding but constructive performance coach. Diagnose the bottleneck and give concrete drills, habits, and checkpoints." },
  { id: "planner", name: "PLANNER", description: "Convert an objective into priorities, dependencies, and next actions.", prompt: "Act as an execution planner. Sequence the work, expose dependencies, identify risks, and make the next actions unambiguous." },
  { id: "scout", name: "SCOUT", description: "Compare options, surface evidence gaps, and map the field.", prompt: "Act as a scouting and research analyst. Separate known facts from inference, compare alternatives, and identify what must be verified." },
];

const STARTERS = [
  ["01", "PRESSURE TEST", "Find the weakest assumption in a decision."],
  ["02", "BUILD A PLAN", "Turn an objective into the next three moves."],
  ["03", "FIND THE BOTTLENECK", "Diagnose what is actually holding progress back."],
  ["04", "SCOUT THE FIELD", "Compare options and expose evidence gaps."],
];

const FALLBACK_MODELS: Model[] = [
  { id: "claude-opus-4-7" },
  { id: "claude-sonnet-4-6" },
  { id: "gpt-5.6-terra" },
  { id: "claude-opus-4-6" },
  { id: "claude-opus-4-8" },
  { id: "claude-sonnet-5" },
  { id: "gpt-5.6-sol" },
];

const STORAGE_KEY = "gwensick.sessions.v1";
const MODE_KEY = "gwensick.mode.v1";
const MODEL_KEY = "gwensick.model.v1";

function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function makeTitle(text: string) { return text.trim().replace(/\s+/g, " ").slice(0, 46) || "Untitled session"; }
function modelLabel(id: string) { return id.replace(/^models\//, ""); }

function Icon({ name }: { name: "menu" | "plus" | "search" | "copy" | "download" | "trash" | "close" | "spark" | "send" | "stop" | "chevron" | "refresh" | "sliders" }) {
  const paths: Record<string, React.ReactNode> = {
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="1.5" /><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" /></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></>,
    trash: <><path d="M4 7h16M9 11v5M15 11v5M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
    close: <><path d="m5 5 14 14M19 5 5 19" /></>,
    spark: <><path d="m12 3 1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3Z" /></>,
    send: <><path d="M4 4.5 20 12 4 19.5l3-7.5-3-7.5Z" /><path d="M7 12h13" /></>,
    stop: <><rect x="6" y="6" width="12" height="12" rx="2" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    refresh: <><path d="M20 11a8 8 0 0 0-14.7-4L4 9" /><path d="M4 5v4h4M4 13a8 8 0 0 0 14.7 4L20 15" /><path d="M20 19v-4h-4" /></>,
    sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState("");
  const [modeId, setModeId] = useState("analyst");
  const [models, setModels] = useState<Model[]>(FALLBACK_MODELS);
  const [modelId, setModelId] = useState(FALLBACK_MODELS[0].id);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const mode = MODES.find((item) => item.id === modeId) ?? MODES[0];
  const active = sessions.find((session) => session.id === activeId);
  const messages = active?.messages ?? [];
  const selectedModel = models.find((item) => item.id === modelId) ?? { id: modelId };

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as Session[];
      setSessions(Array.isArray(stored) ? stored : []);
      setActiveId(stored[0]?.id || "");
      const savedMode = localStorage.getItem(MODE_KEY);
      if (savedMode && MODES.some((item) => item.id === savedMode)) setModeId(savedMode);
      const savedModel = localStorage.getItem(MODEL_KEY);
      if (savedModel) setModelId(savedModel);
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setModelsLoading(true);
    fetch("/api/models", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { models?: Model[]; error?: string };
        if (!response.ok || !Array.isArray(data.models) || data.models.length === 0) throw new Error(data.error || "Model catalogue unavailable.");
        return data.models;
      })
      .then((catalogue) => {
        setModels(catalogue);
        const saved = localStorage.getItem(MODEL_KEY);
        const next = saved && catalogue.some((item) => item.id === saved) ? saved : catalogue[0].id;
        setModelId(next);
        localStorage.setItem(MODEL_KEY, next);
        setModelsError("");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setModelsError(err instanceof Error ? err.message : "Unable to load live model catalogue.");
      })
      .finally(() => setModelsLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (sessions.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 30)));
    else localStorage.removeItem(STORAGE_KEY);
  }, [sessions]);
  useEffect(() => { localStorage.setItem(MODE_KEY, modeId); }, [modeId]);
  useEffect(() => { localStorage.setItem(MODEL_KEY, modelId); }, [modelId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModeOpen(false);
        setModelOpen(false);
        setSettingsOpen(false);
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, messages[messages.length - 1]?.content, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 190)}px`;
  }, [input]);

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => !q || s.title.toLowerCase().includes(q) || s.mode.toLowerCase().includes(q));
  }, [sessions, search]);

  const filteredModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    return models.filter((item) => !q || item.id.toLowerCase().includes(q) || String(item.owned_by || "").toLowerCase().includes(q));
  }, [models, modelSearch]);

  function persistSession(next: Session) {
    setSessions((current) => [next, ...current.filter((s) => s.id !== next.id)].sort((a, b) => b.updated - a.updated).slice(0, 30));
  }

  function newSession() {
    if (loading) return;
    const session: Session = { id: makeId(), title: "New strategic session", mode: mode.name, updated: Date.now(), messages: [] };
    persistSession(session);
    setActiveId(session.id);
    setInput("");
    setError("");
    setNotice("");
    setSidebarOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function ensureSession(text: string) {
    if (active) return active;
    const session: Session = { id: makeId(), title: makeTitle(text), mode: mode.name, updated: Date.now(), messages: [] };
    persistSession(session);
    setActiveId(session.id);
    return session;
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || loading || !modelId) return;
    const session = ensureSession(text);
    const nextMessages = [...session.messages, { role: "user" as const, content: text }];
    const nextSession = { ...session, title: session.messages.length ? session.title : makeTitle(text), mode: mode.name, updated: Date.now(), messages: nextMessages };
    persistSession(nextSession);
    setActiveId(nextSession.id);
    setInput("");
    setError("");
    setNotice("");
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ messages: nextMessages, mode: mode.id, model: modelId }),
      });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok || !data.message) throw new Error(data.error || "The intelligence engine is unavailable.");
      persistSession({ ...nextSession, updated: Date.now(), messages: [...nextMessages, { role: "assistant", content: data.message }] });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      abortRef.current = null;
      setLoading(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  function stopGeneration() { abortRef.current?.abort(); setLoading(false); }

  function clearAllSessions() {
    if (loading || !window.confirm("Delete all local GwenSick sessions? This cannot be undone.")) return;
    localStorage.removeItem(STORAGE_KEY);
    setSessions([]);
    setActiveId("");
    setSettingsOpen(false);
  }

  async function copyMessage(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1200);
    } catch {
      setNotice("Clipboard access unavailable.");
    }
  }

  function exportSession() {
    if (!active) return;
    const content = `GWENSICK / ${active.title}\nMODE: ${active.mode}\nMODEL: ${modelId}\n${new Date(active.updated).toISOString()}\n\n${active.messages.map((m) => `${m.role.toUpperCase()}\n${m.content}`).join("\n\n")}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "gwensick-session"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function chooseStarter(text: string) {
    setInput(text);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function chooseModel(id: string) {
    setModelId(id);
    setModelOpen(false);
    setModelSearch("");
    setNotice(`Model switched to ${modelLabel(id)}.`);
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <div className={`shell ${sidebarOpen ? "sidebar-visible" : ""}`}>
        <aside className="sidebar">
          <div className="sidebar-brand"><div className="brand-mark"><span>G</span></div><div><b>GWENSICK</b><small>STRATEGIC INTELLIGENCE</small></div></div>
          <button className="new-session" onClick={newSession}><Icon name="plus" /> NEW SESSION</button>
          <div className="side-section">
            <div className="side-label">WORKSPACE</div>
            <button className="side-item active"><span className="side-dot" /> Analyst desk <kbd>01</kbd></button>
            <button className="side-item" onClick={() => setSettingsOpen(true)}><Icon name="sliders" /> System settings</button>
          </div>
          <div className="history-head"><span>LOCAL SESSIONS</span><span>{sessions.length}</span></div>
          <label className="session-search"><Icon name="search" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sessions" aria-label="Search sessions" /></label>
          <div className="session-list">
            {filteredSessions.length ? filteredSessions.map((session) => (
              <button className={`session-item ${session.id === activeId ? "selected" : ""}`} key={session.id} onClick={() => { setActiveId(session.id); setSidebarOpen(false); }}><span className="session-title">{session.title}</span><span className="session-meta">{session.messages.length} entries · {session.mode}</span></button>
            )) : <div className="empty-history">No matching sessions.</div>}
          </div>
          <div className="sidebar-bottom"><div className="local-badge"><span /> LOCAL STORAGE</div><small>Sessions stay on this device. AI requests use your configured SeekAI server connection.</small></div>
        </aside>
        {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}

        <section className="main-panel">
          <header className="topbar">
            <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>
            <div className="session-heading"><span>{active ? "SESSION / ACTIVE" : "ANALYST DESK / 01"}</span><strong>{active?.title || "Strategic intelligence workspace"}</strong></div>
            <div className="top-actions">
              <div className="online"><span /> SEEKAI ONLINE</div>
              <div className="control-wrap">
                <button className="model-button" onClick={() => { setModelOpen((v) => !v); setModeOpen(false); }} aria-expanded={modelOpen} title="Change AI model"><span className="control-label">MODEL</span><strong>{modelLabel(selectedModel.id)}</strong><Icon name="chevron" /></button>
                {modelOpen && <div className="model-menu" role="menu">
                  <div className="menu-heading"><div><span>AI ROUTING</span><b>Choose model</b></div><small>{models.length} available</small></div>
                  <label className="model-search"><Icon name="search" /><input autoFocus value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} placeholder="Filter models..." aria-label="Filter models" /></label>
                  <div className="model-list">{filteredModels.map((item) => <button key={item.id} className={item.id === modelId ? "chosen" : ""} onClick={() => chooseModel(item.id)}><span className="model-check">{item.id === modelId ? "●" : "○"}</span><span><b>{modelLabel(item.id)}</b><small>{item.owned_by || "SeekAI model"}</small></span></button>)}{!filteredModels.length && <div className="empty-models">No matching models.</div>}</div>
                  <div className="model-menu-foot"><span>{modelsLoading ? "SYNCING CATALOGUE" : modelsError ? "FALLBACK CATALOGUE" : "LIVE CATALOGUE"}</span><button onClick={() => window.location.reload()} aria-label="Refresh model catalogue"><Icon name="refresh" /></button></div>
                </div>}
              </div>
              <div className="control-wrap mode-wrap">
                <button className="mode-button" onClick={() => { setModeOpen((v) => !v); setModelOpen(false); }} aria-expanded={modeOpen}><span className="control-label">MODE</span>{mode.name}<Icon name="chevron" /></button>
                {modeOpen && <div className="mode-menu">{MODES.map((item) => <button key={item.id} className={item.id === modeId ? "chosen" : ""} onClick={() => { setModeId(item.id); setModeOpen(false); }}><b>{item.name}</b><small>{item.description}</small></button>)}</div>}
              </div>
              <button className="icon-button settings-trigger" onClick={() => setSettingsOpen(true)} aria-label="Open system settings"><Icon name="sliders" /></button>
              <button className="icon-button" onClick={newSession} aria-label="New session"><Icon name="plus" /></button>
            </div>
          </header>

          <div className="conversation">
            {messages.length === 0 ? (
              <div className="welcome-expanded">
                <div className="hero-kicker"><span /> GWENSICK CORE / {mode.name} MODE</div>
                <h1>Think sharper.<br /><em>Move sooner.</em></h1>
                <p>Strategic intelligence for decisions, execution, analysis, and competitive thinking. GwenSick is built to challenge the plan—not just applaud it.</p>
                <div className="active-stack">
                  <button onClick={() => { setModelOpen(true); setModeOpen(false); }}><span>MODEL</span><b>{modelLabel(modelId)}</b><small>{models.length} available · tap to change</small><Icon name="chevron" /></button>
                  <button onClick={() => { setModeOpen(true); setModelOpen(false); }}><span>MODE</span><b>{mode.name}</b><small>{mode.description}</small><Icon name="chevron" /></button>
                </div>
                <div className="starter-grid">{STARTERS.map(([num, title, description]) => <button key={num} onClick={() => chooseStarter(description)}><span>{num}</span><b>{title}</b><small>{description}</small><i>↗</i></button>)}</div>
                <div className="system-strip"><span><i /> {modelLabel(modelId)}</span><span>{mode.name} MODE</span><span>PRIVATE / LOCAL SESSION</span><span>CONTEXT / 40 ENTRIES</span></div>
              </div>
            ) : (
              <div className="thread">
                <div className="thread-intro"><div><span>MODEL / {modelLabel(modelId)}</span><b>{mode.name} — {mode.description}</b></div><button onClick={exportSession}><Icon name="download" /> EXPORT</button></div>
                {messages.map((message, index) => <article className={`message ${message.role}`} key={`${index}-${message.role}`}><div className="message-rail"><span>{message.role === "user" ? "OPERATOR" : "GWENSICK"}</span><small>{String(index + 1).padStart(2, "0")}</small></div><div className="message-body"><div className="message-text">{message.content}</div>{message.role === "assistant" && <div className="message-actions"><button onClick={() => copyMessage(message.content, index)}><Icon name="copy" /> {copiedIndex === index ? "COPIED" : "COPY"}</button>{index === messages.length - 1 && !loading && <button onClick={() => chooseStarter("Reconsider your last answer. Find the strongest counterargument, then give me the corrected verdict.")}><Icon name="spark" /> CHALLENGE</button>}</div>}</div></article>)}
                {loading && <article className="message assistant"><div className="message-rail"><span>GWENSICK</span><small>•••</small></div><div className="message-body"><div className="analysis-state"><span /><span /><span /><b>ANALYZING {modelLabel(modelId)}</b></div></div></article>}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <div className="composer-zone">
            {error && <div className="error" role="alert"><span>!</span><div><b>REQUEST FAILED</b><small>{error}</small></div></div>}
            {notice && <div className="notice">{notice}</div>}
            <form className="composer" onSubmit={sendMessage}>
              <div className="composer-top"><span>INPUT / {mode.name}</span><span>{modelLabel(modelId)} · {input.length.toLocaleString()} / 12,000</span></div>
              <div className="composer-row"><textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} placeholder={mode.id === "analyst" ? "Bring me the decision." : `What are we solving in ${mode.name.toLowerCase()} mode?`} maxLength={12000} rows={1} disabled={loading} aria-label="Message GwenSick" /><button type={loading ? "button" : "submit"} className="send-button" onClick={loading ? stopGeneration : undefined} disabled={(!input.trim() && !loading) || modelsLoading}><span>{loading ? "STOP" : "SEND"}</span><Icon name={loading ? "stop" : "send"} /></button></div>
              <div className="composer-bottom"><span>SHIFT + ENTER / NEW LINE</span><span>{modelsLoading ? "SYNCING MODELS" : `ROUTED THROUGH ${modelLabel(modelId)}`}</span></div>
            </form>
          </div>
        </section>
      </div>

      {settingsOpen && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="GwenSick system settings"><div className="settings-modal"><div className="modal-head"><div><span>SYSTEM / CONFIGURATION</span><h2>Workspace controls</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><Icon name="close" /></button></div><div className="settings-section"><div className="settings-section-head"><span>AI ROUTING</span><strong>{modelsError ? "FALLBACK" : "LIVE"}</strong></div><button className="routing-card" onClick={() => { setSettingsOpen(false); setModelOpen(true); }}><div><small>ACTIVE MODEL</small><b>{modelLabel(modelId)}</b><span>{models.length} models available from SeekAI</span></div><Icon name="chevron" /></button>{modelsError && <div className="settings-warning">Live model catalogue could not be refreshed. The last known model catalogue remains available.</div>}</div><div className="setting-row"><div><b>Intelligence mode</b><small>{mode.name} — {mode.description}</small></div><strong>ACTIVE</strong></div><div className="setting-row"><div><b>Storage</b><small>Sessions are persisted only in this browser's localStorage.</small></div><strong>LOCAL</strong></div><div className="settings-actions"><button className="danger-button" onClick={clearAllSessions}><Icon name="trash" /> DELETE ALL LOCAL SESSIONS</button></div></div></div>}
    </main>
  );
}
