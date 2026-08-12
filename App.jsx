import { useState, useRef, useEffect } from "react";

// ── Help My Tech Pensacola owner info ──
const OWNER = {
  name: "Help My Tech Pensacola",
  tagline: "Pensacola's friendly neighborhood tech pro",
  phone: "(448) 234-5860",
  email: "helpmytechpensacola@gmail.com",
  booking: "https://helpmytechpensacola.com/book",
  area: "Pensacola, FL",
  remote: true,
  onsite: true,
  hours: "Mon–Sat, 8am–7pm",
};

const CARRIERS = [
  { id: "cox",     label: "Cox",      color: "#e05c1a", statusUrl: "https://downdetector.com/status/cox-communications/" },
  { id: "att",     label: "AT&T",     color: "#00a8e0", statusUrl: "https://downdetector.com/status/att/" },
  { id: "tmobile", label: "T-Mobile", color: "#e20074", statusUrl: "https://downdetector.com/status/t-mobile/" },
];

const CATEGORIES = [
  { id: "internet",  label: "Internet / WiFi",   icon: "📡" },
  { id: "computer",  label: "Computer / Laptop", icon: "💻" },
  { id: "phone",     label: "Phone / Tablet",    icon: "📱" },
  { id: "smarthome", label: "Smart Home / TV",   icon: "🏠" },
  { id: "virus",     label: "Virus / Security",  icon: "🛡️" },
  { id: "other",     label: "Something Else",    icon: "🔧" },
];

export default function App() {
  const [screen, setScreen]           = useState("home");
  const [category, setCategory]       = useState(null);
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [outageLoading, setOutageLoading] = useState(false);
  const [outageData, setOutageData]       = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Spinner keyframe injection ──
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // ── Outage check ──
  const checkOutages = async () => {
    setScreen("outages");
    if (outageData) return;
    setOutageLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          system: `You check current internet/carrier outage status for Pensacola, Florida.
Search for current outage reports for Cox Communications, AT&T, and T-Mobile in Pensacola FL.
Respond ONLY with valid JSON — no markdown, no backticks, no preamble — exactly:
{"cox":{"status":"ok"|"issues"|"outage","summary":"one short sentence"},"att":{"status":"ok"|"issues"|"outage","summary":"one short sentence"},"tmobile":{"status":"ok"|"issues"|"outage","summary":"one short sentence"}}`,
          messages: [{ role: "user", content: "Check current outage status for Cox, AT&T, and T-Mobile in Pensacola FL right now." }],
        }),
      });
      const data = await res.json();
      const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      setOutageData(JSON.parse(clean));
    } catch {
      setOutageData({
        cox:     { status: "unknown", summary: "Could not fetch status — visit cox.com/outage to check." },
        att:     { status: "unknown", summary: "Could not fetch status — visit att.com/support to check." },
        tmobile: { status: "unknown", summary: "Could not fetch status — visit t-mobile.com/support to check." },
      });
    }
    setOutageLoading(false);
  };

  // ── AI chat ──
  const buildSystem = (label) =>
    `You are the Help My Tech Pensacola assistant, a friendly tech support helper for residents of Pensacola, Florida.
Help troubleshoot in plain, jargon-free language. Keep answers to 3–5 practical steps max per reply.
After 2–3 exchanges, if the issue still seems unresolved or complex, end your message with exactly the token: SUGGEST_HELPMYTECH
The user's issue category: ${label}.
Start by warmly greeting them and asking them to describe their problem in 1–2 sentences.`;

  const startChat = async (cat) => {
    setCategory(cat);
    setScreen("chat");
    setMessages([]);
    setShowContact(false);
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildSystem(cat.label),
          messages: [{ role: "user", content: "Hello, I need help." }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "Hey! What's going on with your tech today?";
      setMessages([{ role: "assistant", content: text }]);
    } catch {
      setMessages([{ role: "assistant", content: "Hey! I'm here to help. What tech issue can I help with today?" }]);
    }
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildSystem(category?.label),
          messages: newMessages,
        }),
      });
      const data = await res.json();
      let text = data.content?.map(b => b.text || "").join("") || "Let me look into that…";
      if (text.includes("SUGGEST_HELPMYTECH")) {
        text = text.replace("SUGGEST_HELPMYTECH", "").trim();
        setShowContact(true);
      }
      setMessages([...newMessages, { role: "assistant", content: text }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Sorry, hit a snag! Try rephrasing." }]);
    }
    setLoading(false);
  };

  const statusColor = (s) => ({ ok: "#22c55e", issues: "#f59e0b", outage: "#ef4444", unknown: "#6b7280" }[s] || "#6b7280");
  const statusLabel = (s) => ({ ok: "✅ All Clear", issues: "⚠️ Some Issues", outage: "🔴 Outage Detected", unknown: "❓ Unknown" }[s] || "❓");

  // ══════════════════ HOME ══════════════════
  if (screen === "home") return (
    <div style={c.root}>
      <div style={c.bg} />
      <div style={c.container}>
        <header style={c.header}>
          <div style={c.badge}>🌊 Pensacola, FL</div>
          <h1 style={c.title}>Help My Tech</h1>
          <p style={c.subtitle}>Pensacola, FL — your local tech pro</p>
        </header>

        <section style={c.stepCard}>
          <div style={c.stepLabel}><span style={c.stepNum}>1</span> Diagnose your problem</div>
          <div style={c.grid}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} style={c.catBtn}
                onClick={() => startChat(cat)}
                onMouseEnter={e => e.currentTarget.style.background = "#1a3a5c"}
                onMouseLeave={e => e.currentTarget.style.background = "#0f2640"}>
                <span style={c.catIcon}>{cat.icon}</span>
                <span style={c.catLabel}>{cat.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section style={c.stepCard}>
          <div style={c.stepLabel}><span style={c.stepNum}>2</span> Check carrier outages</div>
          <button style={c.outageBtn} onClick={checkOutages}>
            📡 Check Cox · AT&amp;T · T-Mobile Status
          </button>
        </section>

        <section style={c.stepCard}>
          <div style={c.stepLabel}><span style={c.stepNum}>3</span> Book a local tech</div>
          <button style={c.bookBigBtn} onClick={() => setScreen("contact")}>
            🖥️ Get Help from Help My Tech Pensacola
          </button>
        </section>

        <p style={c.footer}>Serving Pensacola · Escambia County</p>
      </div>
    </div>
  );

  // ══════════════════ OUTAGES ══════════════════
  if (screen === "outages") return (
    <div style={c.root}>
      <div style={c.bg} />
      <div style={c.container}>
        <button style={c.backBtn} onClick={() => setScreen("home")}>← Back</button>
        <h2 style={c.pageTitle}>Carrier Outage Status</h2>
        <p style={c.pageSub}>Live check for Pensacola, FL</p>

        {outageLoading ? (
          <div style={c.loadingBox}>
            <div style={c.spinner} />
            <p style={{ color: "#7ecfef", marginTop: 14, fontSize: "0.88rem" }}>Checking live outage reports…</p>
          </div>
        ) : outageData ? (
          <>
            <div style={c.outageList}>
              {CARRIERS.map(carrier => {
                const d = outageData[carrier.id];
                const col = statusColor(d?.status);
                return (
                  <div key={carrier.id} style={c.outageCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ ...c.carrierName, color: carrier.color }}>{carrier.label}</span>
                      <span style={{ background: col + "22", color: col, border: `1px solid ${col}55`, borderRadius: 20, padding: "3px 12px", fontSize: "0.73rem", fontWeight: "bold" }}>
                        {statusLabel(d?.status)}
                      </span>
                    </div>
                    <p style={c.outageSummary}>{d?.summary}</p>
                    <a href={carrier.statusUrl} target="_blank" rel="noreferrer" style={c.outageLink}>View full report ↗</a>
                  </div>
                );
              })}
            </div>
            <div style={c.outageFooter}>
              <p style={{ margin: "0 0 0.5rem", color: "rgba(200,232,245,0.5)", fontSize: "0.82rem" }}>Still having issues?</p>
              <button style={c.bookSmallBtn} onClick={() => setScreen("contact")}>Book Help My Tech →</button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );

  // ══════════════════ CONTACT ══════════════════
  if (screen === "contact") return (
    <div style={c.root}>
      <div style={c.bg} />
      <div style={c.container}>
        <button style={c.backBtn} onClick={() => setScreen("home")}>← Back</button>
        <h2 style={c.pageTitle}>Book Help My Tech Pensacola</h2>
        <p style={c.pageSub}>Local Pensacola tech — real person, real help</p>

        <div style={c.ownerCard}>
          <div style={{ fontSize: "2.8rem", marginBottom: 8 }}>🏖️</div>
          <div style={c.ownerName}>{OWNER.name}</div>
          <div style={c.ownerTagline}>{OWNER.tagline}</div>
          <div style={c.ownerMeta}>
            <span>📍 {OWNER.area}</span>
            <span>🕐 {OWNER.hours}</span>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {OWNER.remote && <span style={c.tag}>Remote</span>}
            {OWNER.onsite && <span style={c.tag}>On-site</span>}
          </div>
        </div>

        <div style={c.contactList}>
          {[
            { href: `tel:${OWNER.phone}`,       icon: "📞", label: "Call",        val: OWNER.phone,   highlight: false },
            { href: `sms:${OWNER.phone}`,        icon: "💬", label: "Text",        val: OWNER.phone,   highlight: false },
            { href: `mailto:${OWNER.email}`,     icon: "✉️", label: "Email",       val: OWNER.email,   highlight: false },
            { href: OWNER.booking, target: "_blank", icon: "📅", label: "Book Online", val: "Schedule an appointment →", highlight: true },
          ].map((item, i) => (
            <a key={i} href={item.href} target={item.target} rel={item.target ? "noreferrer" : undefined}
              style={{ ...c.contactRow, ...(item.highlight ? c.contactRowHL : {}) }}>
              <span style={{ fontSize: "1.4rem" }}>{item.icon}</span>
              <div>
                <div style={c.contactLabel}>{item.label}</div>
                <div style={c.contactVal}>{item.val}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );

  // ══════════════════ CHAT ══════════════════
  return (
    <div style={c.root}>
      <div style={c.bg} />
      <div style={c.chatWrap}>
        <div style={c.chatHeader}>
          <button style={c.backBtn} onClick={() => setScreen("home")}>← Home</button>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span>{category?.icon}</span>
            <span style={{ color: "#c8e8f5", fontSize: "0.86rem", fontStyle: "italic" }}>{category?.label}</span>
          </div>
          <button style={c.techLinkBtn} onClick={() => setScreen("contact")}>Book a Tech</button>
        </div>

        <div style={c.messages}>
          {messages.map((m, i) => (
            <div key={i} style={m.role === "user" ? c.userBubble : c.botBubble}>
              {m.role === "assistant" && (
                <div style={c.botAvatar}>🤖</div>
              )}
              <div style={m.role === "user" ? c.userText : c.botText}>
                {m.content.split("\n").map((line, j) => <span key={j}>{line}<br /></span>)}
              </div>
            </div>
          ))}

          {loading && (
            <div style={c.botBubble}>
              <div style={c.botAvatar}>🤖</div>
              <div style={c.botText}><span style={{ color: "#7ecfef", letterSpacing: 6 }}>● ● ●</span></div>
            </div>
          )}

          {showContact && (
            <div style={c.suggestBox}>
              <p style={c.suggestTitle}>🏖️ Sounds like you need a real tech!</p>
              <p style={c.suggestBody}>
                <strong>Help My Tech Pensacola</strong> — your local tech expert.<br />
                Available {OWNER.hours}.
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {[
                  { href: `tel:${OWNER.phone}`, label: "📞 Call" },
                  { href: `sms:${OWNER.phone}`, label: "💬 Text" },
                  { href: `mailto:${OWNER.email}`, label: "✉️ Email" },
                ].map((btn, i) => (
                  <a key={i} href={btn.href} style={c.suggestBtn}>{btn.label}</a>
                ))}
                <button style={{ ...c.suggestBtn, cursor: "pointer", border: "1px solid rgba(126,207,239,0.4)", background: "rgba(13,110,160,0.4)", fontFamily: "inherit" }}
                  onClick={() => setScreen("contact")}>📅 Book</button>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div style={c.inputRow}>
          <input
            style={c.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Describe your tech problem…"
          />
          <button style={c.sendBtn} onClick={sendMessage} disabled={loading}>
            {loading ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

const c = {
  root: { minHeight: "100vh", fontFamily: "'Georgia', serif", position: "relative", overflowX: "hidden" },
  bg:   { position: "fixed", inset: 0, background: "linear-gradient(160deg, #051824 0%, #0a3052 45%, #0d5c7a 100%)", zIndex: 0 },
  container: { position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto", padding: "2rem 1.25rem 3rem", display: "flex", flexDirection: "column", gap: "1.25rem" },

  header:   { textAlign: "center", paddingTop: "0.5rem" },
  badge:    { display: "inline-block", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#7ecfef", borderRadius: 20, padding: "4px 14px", fontSize: "0.73rem", letterSpacing: "0.08em", marginBottom: "0.6rem" },
  title:    { color: "#fff", fontSize: "2.8rem", fontWeight: "bold", margin: 0, letterSpacing: "-0.02em", textShadow: "0 2px 20px rgba(0,150,220,0.4)" },
  subtitle: { color: "#7ecfef", fontSize: "0.88rem", margin: "0.2rem 0 0", fontStyle: "italic" },

  stepCard:  { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "1.2rem" },
  stepLabel: { color: "#c8e8f5", fontSize: "0.8rem", fontWeight: "bold", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.9rem", display: "flex", alignItems: "center", gap: 10 },
  stepNum:   { background: "#0d6ea0", color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: "bold", flexShrink: 0 },

  grid:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" },
  catBtn:  { background: "#0f2640", border: "1px solid rgba(126,207,239,0.25)", borderRadius: 12, padding: "0.85rem 0.5rem", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem", transition: "background 0.15s" },
  catIcon: { fontSize: "1.45rem" },
  catLabel:{ color: "#c8e8f5", fontSize: "0.76rem", textAlign: "center" },

  outageBtn:  { width: "100%", background: "rgba(13,110,160,0.2)", border: "1px solid rgba(126,207,239,0.3)", borderRadius: 12, padding: "0.85rem", color: "#7ecfef", fontSize: "0.88rem", cursor: "pointer", fontFamily: "inherit" },
  bookBigBtn: { width: "100%", background: "linear-gradient(135deg, #0d6ea0, #0a4a72)", border: "1px solid rgba(126,207,239,0.4)", borderRadius: 12, padding: "0.95rem", color: "#fff", fontSize: "1rem", cursor: "pointer", fontFamily: "inherit", fontWeight: "bold" },
  footer:     { color: "rgba(200,232,245,0.3)", fontSize: "0.7rem", textAlign: "center", margin: 0 },

  backBtn:   { background: "transparent", border: "none", color: "#7ecfef", cursor: "pointer", fontSize: "0.88rem", padding: 0, fontFamily: "inherit", marginBottom: "0.15rem" },
  pageTitle: { color: "#fff", margin: "0 0 0.15rem", fontSize: "1.55rem" },
  pageSub:   { color: "#7ecfef", margin: "0 0 1.1rem", fontStyle: "italic", fontSize: "0.85rem" },

  loadingBox: { display: "flex", flexDirection: "column", alignItems: "center", padding: "2.5rem 0" },
  spinner:    { width: 34, height: 34, border: "3px solid rgba(126,207,239,0.2)", borderTop: "3px solid #7ecfef", borderRadius: "50%", animation: "spin 0.9s linear infinite" },

  outageList:    { display: "flex", flexDirection: "column", gap: "0.8rem" },
  outageCard:    { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "0.95rem 1.1rem" },
  carrierName:   { fontWeight: "bold", fontSize: "1.05rem" },
  outageSummary: { color: "#c8e8f5", fontSize: "0.81rem", margin: "0 0 0.4rem", lineHeight: 1.55 },
  outageLink:    { color: "#7ecfef", fontSize: "0.76rem", textDecoration: "none" },
  outageFooter:  { textAlign: "center", marginTop: "0.75rem" },
  bookSmallBtn:  { background: "rgba(13,110,160,0.3)", border: "1px solid rgba(126,207,239,0.4)", borderRadius: 20, color: "#7ecfef", fontSize: "0.8rem", padding: "5px 16px", cursor: "pointer", fontFamily: "inherit" },

  ownerCard:    { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "1.4rem", textAlign: "center", marginBottom: "0.15rem" },
  ownerName:    { color: "#fff", fontSize: "1.4rem", fontWeight: "bold", marginBottom: 4 },
  ownerTagline: { color: "#7ecfef", fontStyle: "italic", fontSize: "0.85rem", marginBottom: "0.7rem" },
  ownerMeta:    { display: "flex", justifyContent: "center", gap: 14, color: "rgba(200,232,245,0.55)", fontSize: "0.76rem", marginBottom: "0.7rem", flexWrap: "wrap" },
  tag:          { background: "rgba(126,207,239,0.15)", border: "1px solid rgba(126,207,239,0.3)", color: "#7ecfef", borderRadius: 20, padding: "2px 12px", fontSize: "0.7rem" },

  contactList:   { display: "flex", flexDirection: "column", gap: "0.65rem" },
  contactRow:    { display: "flex", alignItems: "center", gap: "1rem", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "0.85rem 1.1rem", textDecoration: "none" },
  contactRowHL:  { background: "rgba(13,110,160,0.25)", border: "1px solid rgba(126,207,239,0.3)" },
  contactLabel:  { color: "rgba(200,232,245,0.5)", fontSize: "0.7rem", marginBottom: 2 },
  contactVal:    { color: "#e0f0fa", fontSize: "0.9rem" },

  chatWrap:    { position: "relative", zIndex: 1, maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", height: "100vh" },
  chatHeader:  { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem 0.75rem", borderBottom: "1px solid rgba(255,255,255,0.1)" },
  techLinkBtn: { background: "rgba(126,207,239,0.15)", border: "1px solid rgba(126,207,239,0.3)", borderRadius: 20, color: "#7ecfef", fontSize: "0.73rem", padding: "4px 11px", cursor: "pointer", fontFamily: "inherit" },
  messages:    { flex: 1, overflowY: "auto", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.9rem" },
  botBubble:   { display: "flex", gap: 9, alignItems: "flex-start", maxWidth: "85%" },
  userBubble:  { display: "flex", justifyContent: "flex-end" },
  botAvatar:   { fontSize: "1.2rem", background: "rgba(126,207,239,0.15)", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  botText:     { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "4px 14px 14px 14px", padding: "0.65rem 0.95rem", color: "#e0f0fa", fontSize: "0.86rem", lineHeight: 1.6 },
  userText:    { background: "rgba(126,207,239,0.2)", border: "1px solid rgba(126,207,239,0.3)", borderRadius: "14px 4px 14px 14px", padding: "0.65rem 0.95rem", color: "#fff", fontSize: "0.86rem", lineHeight: 1.6, maxWidth: "80%" },

  suggestBox:  { background: "rgba(13,110,160,0.14)", border: "1px solid rgba(126,207,239,0.32)", borderRadius: 14, padding: "0.95rem 1.1rem" },
  suggestTitle:{ color: "#7ecfef", fontWeight: "bold", margin: "0 0 0.35rem", fontSize: "0.88rem" },
  suggestBody: { color: "#c8e8f5", fontSize: "0.81rem", margin: "0 0 0.7rem", lineHeight: 1.55 },
  suggestBtn:  { flex: 1, background: "rgba(13,110,160,0.4)", border: "1px solid rgba(126,207,239,0.4)", borderRadius: 10, color: "#7ecfef", fontSize: "0.76rem", padding: "6px 0", textAlign: "center", textDecoration: "none", fontFamily: "inherit" },

  inputRow: { display: "flex", gap: "0.5rem", padding: "0.75rem 1.25rem 1.2rem", borderTop: "1px solid rgba(255,255,255,0.1)" },
  input:    { flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "0.65rem 1rem", color: "#fff", fontSize: "0.86rem", outline: "none", fontFamily: "inherit" },
  sendBtn:  { background: "#0d6ea0", border: "none", borderRadius: 12, color: "#fff", fontSize: "0.86rem", padding: "0 1.15rem", cursor: "pointer", fontFamily: "inherit", fontWeight: "bold" },
};
