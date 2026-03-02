import { useState, useRef, useCallback, createContext, useContext, useReducer, useEffect, useMemo } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

// ━━━ UTILS ━━━
function hexToRgba(hex, op) {
  const b = parseInt(hex.slice(1), 16);
  return `rgba(${(b >> 16) & 255},${(b >> 8) & 255},${b & 255},${op / 100})`;
}
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ━━━ COLOR PRESETS ━━━
const COLOR_PRESETS = {
  blau_gelb: { name: "Blau/Gelb", colA: "#3B82F6", colB: "#EAB308", colAText: "#FFF", colBText: "#000", title: "#000000", titleBg: "#FFFFFF" },
  gruen_rot: { name: "Grün/Rot", colA: "#22C55E", colB: "#E50914", colAText: "#000", colBText: "#FFF", title: "#FFFFFF", titleBg: "#000000" },
  gelb_schwarz: { name: "Gelb/Schwarz", colA: "#EAB308", colB: "#000000", colAText: "#000", colBText: "#FFF", title: "#FFFFFF", titleBg: "#000000" },
  rot_weiss: { name: "Rot/Weiß", colA: "#E50914", colB: "#FFFFFF", colAText: "#FFF", colBText: "#000", title: "#000000", titleBg: "#FFFFFF" },
  schwarz_weiss: { name: "Schwarz/Weiß", colA: "#000000", colB: "#FFFFFF", colAText: "#FFF", colBText: "#000", title: "#000000", titleBg: "#FFFFFF" },
  gelb_rot: { name: "Gelb/Rot", colA: "#EAB308", colB: "#E50914", colAText: "#000", colBText: "#FFF", title: "#FFFFFF", titleBg: "#FFFFFF" },
  blau_rot: { name: "Blau/Rot", colA: "#3B82F6", colB: "#E50914", colAText: "#FFF", colBText: "#FFF", title: "#000000", titleBg: "#FFFFFF" },
  gruen_blau: { name: "Grün/Blau", colA: "#22C55E", colB: "#3B82F6", colAText: "#000", colBText: "#FFF", title: "#FFFFFF", titleBg: "#000000" },
  orange_schwarz: { name: "Orange/Schwarz", colA: "#F97316", colB: "#000000", colAText: "#000", colBText: "#FFF", title: "#FFFFFF", titleBg: "#F97316" },
  lila_gelb: { name: "Lila/Gelb", colA: "#8B5CF6", colB: "#EAB308", colAText: "#FFF", colBText: "#000", title: "#FFFFFF", titleBg: "#8B5CF6" },
};

// ━━━ TEXT PARSER ━━━
function parseInput(text) {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { type: "empty", title: "", rows: [] };
  const title = lines[0];
  let subtitle = "";
  let type = "list";
  let colALabel = "";
  let colBLabel = "";
  const rows = [];
  let startIdx = 1;
  if (lines.length > 1 && /\bvs\.?\b/i.test(lines[1])) {
    const parts = lines[1].split(/\s+vs\.?\s+/i);
    if (parts.length === 2) { colALabel = parts[0].trim(); colBLabel = parts[1].trim(); type = "compare"; startIdx = 2; }
  }
  if (type === "list" && lines.length > 1 && !lines[1].includes("|") && !lines[1].includes(":")) { subtitle = lines[1]; startIdx = 2; }
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (type === "compare" && line.includes("|")) {
      const [labelPart, ...rest] = line.split(":");
      if (rest.length > 0) {
        const values = rest.join(":").split("|").map(s => s.trim());
        rows.push({ center: labelPart.trim(), left: values[0] || "", right: values[1] || "" });
      } else {
        const [l, r] = line.split("|").map(s => s.trim());
        rows.push({ center: "", left: l, right: r });
      }
    } else if (type === "compare" && line.split("|").length === 3) {
      const [l, c, r] = line.split("|").map(s => s.trim());
      rows.push({ left: l, center: c, right: r });
    } else if (line.includes(":") || line.includes("|")) {
      const sep = line.includes("|") ? "|" : ":";
      const [label, ...valueParts] = line.split(sep);
      rows.push({ label: label.trim(), value: valueParts.join(sep).trim() });
      if (type !== "compare") type = "list";
    } else {
      rows.push({ label: line, value: "" });
    }
  }
  return { type, title, subtitle, colALabel, colBLabel, rows };
}

// ━━━ EXAMPLES ━━━
const EXAMPLES = [
  { name: "⚔️ Berufsvergleich", color: "blau_gelb", text: "Berufsvergleich\nApotheker vs Facharzt\nEinkommen: 5.300€ | 9.500€\nSteuern: 1.010€ | 2.450€\nKrankenversicherung: 450€ GKV | 450€ PKV\nSozialabgaben: 610€ | 890€\nArbeitszeit: 42Std | 55Std\nNetto: 3.230€ | 5.710€" },
  { name: "🇸🇪🇩🇪 Rente", color: "gelb_rot", text: "Wo ist die Rente besser?\nSchweden vs Deutschland\nEinkommen: 4.800€ | 4.000€\nBeitragsjahre: 45 | 45\nBeitragssatz AN: 0% | 9,6%\nBeitragssatz AG: 23% | 9,6%\nRentenniveau: ~75% | 48%\nRente: 3.600€ | 1.850€" },
  { name: "👫 Brüder BU", color: "gruen_rot", text: "Zwei Brüder\nSchlauer Bruder vs Dummer Bruder\nBU abgeschlossen: Ja ✅ | Nein ❌\nBeiträge: Zahlt brav | Gibt für Konsum aus\nBerufsunfähig: Rente nach 6 Mon. | Nur Krankengeld\nErgebnis: 2.500€ BU-Rente | 1.400€ Grundsicherung\nStatus: UNABHÄNGIG ✅ | ABHÄNGIG ❌" },
  { name: "👨‍👩‍👧 Familie", color: "gelb_rot", text: "Andere Zeiten, Andere Realität?!\nFamilie 2026 vs Familie 1980\nArbeit: Beide Vollzeit | Ein Gehalt reicht\nEinkommen: Zwei Gehälter Pflicht | Ein Gehalt reicht\nWohnen: Kaum erreichbar | Eigenheim\nAuto: 2x Leasing | Eins gekauft\nFazit: Trotzdem knapp | Stabiles Leben ✅" },
  { name: "🏥 Krank Vergleich", color: "gelb_schwarz", text: "Das gibt's vom Staat\nBeamter vs Selbständiger\nEinkommen: 5.000€ | 5.000€\n0-6 Wochen: 5.000€ | 0€\n7-72 Wochen: 5.000€ | 0€ (ohne KG)\n+72 Wochen: 5.000€ | 850-1.700€\nAb 10 J.: 2.000€ | 850-1.700€" },
  { name: "🏠 Mieten vs Kaufen", color: "rot_weiss", text: "Mieten oder Kaufen?\nMieter vs Käufer\nMonatlich: 1.200€ Miete | 1.400€ Rate\nNach 10 J.: 0€ Vermögen | 80.000€ Equity\nNach 30 J.: 0€ Vermögen | 350.000€ Eigentum\nFlexibilität: Hoch ✅ | Gering ❌\nSteuerlich: Keine Vorteile | AfA + Zinsen absetzbar\nFazit: Bequem, aber teuer | Vermögen aufgebaut ✅" },
  { name: "💰 Investment Start", color: "schwarz_weiss", text: "01.01.2025\nWenn du 10.000€ investiert hättest\n🥇 Gold: 10.000€\n📈 S&P 500: 10.000€\n🏦 Commerzbank: 10.000€\n📕 Sparbuch: 10.000€\n🎯 NVIDIA: 10.000€" },
  { name: "📊 Investment Ergebnis", color: "gelb_rot", text: "2026\nWenn meine Eltern 100€/Monat investiert hätten\n🪙 Silber: 112.600€\n📕 Sparbuch: 34.900€\n📱 Nokia: 23.800€\n📈 S&P 500: 116.800€\n🎯 NVIDIA: 2,55 Mio.€" },
  { name: "💎 Vermögen Alter", color: "rot_weiss", text: "Vermögen in 🇩🇪\nTop 10% deiner Altersklasse?\n18 J.: 25.000€\n25 J.: 80.000€\n30 J.: 160.000€\n35 J.: 260.000€\n40 J.: 350.000€\n50 J.: 480.000€\nTop 10% 💸: 550.000€" },
  { name: "🏠 Cash-Flow Rechner", color: "gelb_schwarz", text: "Cash-Flow einer Immobilie\nBeispiel: 3-Zimmer Leipzig\n💰 Kaltmiete: 750€\n➖ Hausgeld: -180€\n➖ Rücklage: -50€\n➖ Zinsen: -320€\n➖ Tilgung: -150€\n➖ Steuervorteil: +80€\n✅ Cash-Flow: +130€/Monat" },
  { name: "📱 Abo-Check", color: "lila_gelb", text: "Deine monatlichen Abos\nWas du wirklich brauchst\n📺 Netflix: 13,99€\n🎵 Spotify: 10,99€\n☁️ iCloud: 2,99€\n📰 News App: 9,99€\n💪 Gym: 29,99€\n📱 Handy: 39,99€\n💸 Gesamt: 107,94€/Monat" },
  { name: "🇩🇪 Steuerlast", color: "rot_weiss", text: "So viel zahlst du wirklich\nSteuerlast in Deutschland\n💰 Brutto: 5.000€\n📉 Lohnsteuer: -850€\n📉 Soli: -47€\n📉 KV: -375€\n📉 RV: -465€\n📉 AV: -65€\n📉 PV: -85€\n✅ Netto: 3.113€" },
];

// ━━━ AI SYSTEM PROMPT ━━━
const AI_SYSTEM_PROMPT = `Du bist ein Assistent für einen Social-Media Reel/Story-Editor für ein deutsches Finanz-Investmentunternehmen (NeoCore Assets). Der Nutzer gibt dir einen freien Prompt auf Deutsch, und du generierst daraus strukturierten Text in einem spezifischen Format.

FORMAT REGELN:
- Erste Zeile: Titel/Headline (kurz, prägnant, max 35 Zeichen)
- Für VERGLEICHE (2 Spalten):
  - Zweite Zeile: "LinkerName vs RechterName"
  - Weitere Zeilen: "Label: WertLinks | WertRechts"
  - Max 7-8 Vergleichszeilen
- Für LISTEN:
  - Zweite Zeile: Untertitel (optional, wenn sinnvoll)
  - Weitere Zeilen: "Emoji Label: Wert" oder nur "Emoji Label"
  - Max 7-8 Listeneinträge

WICHTIG:
- Nutze Emojis passend zum Kontext
- Zahlen und Fakten müssen stimmen (nutze dein Wissen)
- Kurze, prägnante Texte – keine langen Sätze in Zellen
- ✅ und ❌ für Gut/Schlecht
- Themen: Finanzen, Steuern, Immobilien, Renten, Investments, Karriere etc.
- Antworte NUR mit dem formatierten Text, KEIN Erklärungstext davor oder danach`;

// ━━━ DEFAULT CREATIVE STATE ━━━
function createCreative(overrides = {}) {
  const ex = overrides.text ? null : pickRandom(EXAMPLES);
  return {
    id: uid(),
    inputText: overrides.text || ex?.text || EXAMPLES[0].text,
    colorPreset: overrides.color || ex?.color || "blau_gelb",
    bgImage: overrides.bgImage || null,
    bgIsVideo: overrides.bgIsVideo || false,
    overlay: { enabled: true, hex: "#0B1222", opacity: 55 },
    textScale: 100,
    textOffsetY: 0,
    animateType: "none",
    colorOverrides: {},
    showBoxBackgrounds: true,
    selected: true,
    ...overrides,
  };
}

// ━━━ CONTEXT ━━━
const Ctx = createContext(null);
const useEditor = () => useContext(Ctx);

// ━━━ SHARED STYLE TOKENS ━━━
const COLORS = {
  bg: "#0B0D12",
  panel: "#0D0F14",
  card: "rgba(255,255,255,0.025)",
  border: "rgba(255,255,255,0.06)",
  borderActive: "#6C63FF",
  accent: "#6C63FF",
  accentBg: "rgba(108,99,255,0.12)",
  accentText: "#A9A3FF",
  text: "#fff",
  textDim: "rgba(255,255,255,0.4)",
  textMuted: "rgba(255,255,255,0.2)",
  danger: "#E50914",
  success: "#22C55E",
};

const sec = { marginBottom: "10px", padding: "10px", background: COLORS.card, borderRadius: "8px", border: `1px solid ${COLORS.border}` };
const lab = { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: COLORS.textDim, marginBottom: "4px", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.5px" };
const rng = { width: "100%", accentColor: COLORS.accent, cursor: "pointer", height: "3px" };
const abtn = { padding: "5px 10px", fontSize: "10px", background: COLORS.accentBg, border: `1px solid rgba(108,99,255,0.2)`, borderRadius: "5px", color: COLORS.accentText, cursor: "pointer", fontFamily: "monospace" };

// ━━━ LABEL BOX COMPONENT ━━━
const LB = ({ children, bg, color, size = 28, bold = true, style = {}, showBoxBg = true }) => (
  <div style={{
    display: "inline-block", padding: "10px 22px", borderRadius: "12px",
    backgroundColor: showBoxBg ? bg : "transparent", color,
    fontSize: `${size}px`, fontWeight: bold ? 800 : 600,
    fontFamily: "'SF Pro Display',system-ui,sans-serif", lineHeight: 1.3,
    textAlign: "center", whiteSpace: "pre-line",
    boxShadow: showBoxBg ? "0 3px 12px rgba(0,0,0,0.2)" : "none",
    ...style,
  }}>{children}</div>
);

// ━━━ RENDERERS ━━━
function RenderCompare({ creative }) {
  const { colorPreset, colorOverrides, showBoxBackgrounds } = creative;
  const parsed = parseInput(creative.inputText);
  const c = COLOR_PRESETS[colorPreset];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", padding: "50px 30px", gap: "14px", boxSizing: "border-box" }}>
      <LB bg={c.titleBg} color={c.title} size={44} showBoxBg={showBoxBackgrounds} style={{ marginBottom: "10px" }}>{parsed.title}</LB>
      <div style={{ display: "flex", width: "92%", justifyContent: "space-between", alignItems: "center" }}>
        <LB bg={c.colA} color={c.colAText} size={30} showBoxBg={showBoxBackgrounds}>{parsed.colALabel}</LB>
        <LB bg="rgba(255,255,255,0.9)" color="#000" size={24} bold={false} showBoxBg={showBoxBackgrounds}>vs.</LB>
        <LB bg={c.colB} color={c.colBText} size={30} showBoxBg={showBoxBackgrounds}>{parsed.colBLabel}</LB>
      </div>
      <div style={{ height: "20px" }} />
      {parsed.rows.map((r, i) => {
        const o = colorOverrides[i];
        return (
          <div key={i} style={{ display: "flex", width: "96%", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <LB bg={o?.bgA || c.colA} color={o?.textA || c.colAText} size={28} showBoxBg={showBoxBackgrounds} style={{ flex: "1 1 28%", minWidth: 0 }}>{r.left}</LB>
            <LB bg="rgba(255,255,255,0.92)" color="#000" size={24} showBoxBg={showBoxBackgrounds} style={{ flex: "1 1 36%", minWidth: 0 }}>{r.center}</LB>
            <LB bg={o?.bgB || c.colB} color={o?.textB || c.colBText} size={28} showBoxBg={showBoxBackgrounds} style={{ flex: "1 1 28%", minWidth: 0 }}>{r.right}</LB>
          </div>
        );
      })}
      <div style={{ marginTop: "20px" }}>
        <LB bg="rgba(255,255,255,0.85)" color="#000" size={20} bold={false} showBoxBg={showBoxBackgrounds}>Infos in der Caption ⬇️</LB>
      </div>
    </div>
  );
}

function RenderList({ creative }) {
  const { colorPreset, colorOverrides, showBoxBackgrounds } = creative;
  const parsed = parseInput(creative.inputText);
  const c = COLOR_PRESETS[colorPreset];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", padding: "50px 30px", gap: "14px", boxSizing: "border-box" }}>
      <LB bg={c.titleBg} color={c.title} size={48} showBoxBg={showBoxBackgrounds} style={{ marginBottom: "4px" }}>{parsed.title}</LB>
      {parsed.subtitle && <LB bg={c.colA} color={c.colAText} size={28} showBoxBg={showBoxBackgrounds} style={{ marginBottom: "20px" }}>{parsed.subtitle}</LB>}
      {!parsed.subtitle && <div style={{ height: "20px" }} />}
      {parsed.rows.map((r, i) => {
        const isLast = i === parsed.rows.length - 1;
        const o = colorOverrides[i];
        return (
          <div key={i} style={{ display: "flex", width: "90%", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
            <LB bg={o?.bgA || c.colA} color={o?.textA || c.colAText} size={32} showBoxBg={showBoxBackgrounds} style={{ flex: "1 1 50%", textAlign: "left" }}>{r.label}</LB>
            {r.value && <LB bg={o?.bgB || (isLast ? c.colB : "#FFFFFF")} color={o?.textB || (isLast ? c.colBText : "#000")} size={32} showBoxBg={showBoxBackgrounds} style={{ flex: "1 1 45%", textAlign: "right" }}>{r.value}</LB>}
          </div>
        );
      })}
    </div>
  );
}

function AutoRenderer({ creative }) {
  const parsed = parseInput(creative.inputText);
  if (parsed.type === "compare") return <RenderCompare creative={creative} />;
  return <RenderList creative={creative} />;
}

// ━━━ MINI CANVAS (for thumbnails & export) ━━━
function MiniCanvas({ creative, scale = 0.12, exportRef, onClick, isActive }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        cursor: "pointer",
        border: isActive ? `3px solid ${COLORS.accent}` : `2px solid ${COLORS.border}`,
        borderRadius: "10px",
        overflow: "hidden",
        flexShrink: 0,
        transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
        transform: isActive ? "scale(1.02)" : "scale(1)",
        boxShadow: isActive ? `0 0 20px rgba(108,99,255,0.3)` : "0 4px 20px rgba(0,0,0,0.3)",
      }}
    >
      <div
        ref={exportRef}
        style={{
          width: "1080px", height: "1920px",
          background: creative.bgImage ? "transparent" : "#000",
          overflow: "hidden",
          transformOrigin: "top left",
          transform: `scale(${scale})`,
        }}
      >
        {creative.bgImage && (
          creative.bgIsVideo ? (
            <video src={creative.bgImage} crossOrigin="anonymous" autoPlay loop muted playsInline
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
          ) : (
            <img src={creative.bgImage} crossOrigin="anonymous"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} alt="" />
          )
        )}
        {creative.overlay.enabled && (
          <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
            backgroundColor: hexToRgba(creative.overlay.hex, creative.overlay.opacity) }} />
        )}
        <div style={{
          position: "relative", zIndex: 2, width: "100%", height: "100%",
          display: "flex", flexDirection: "column", justifyContent: "center",
          transform: `scale(${creative.textScale / 100}) translateY(${creative.textOffsetY}px)`,
          transformOrigin: "center center",
        }}>
          <AutoRenderer creative={creative} />
        </div>
      </div>
    </div>
  );
}

// ━━━ FULL CANVAS (for main editing view) ━━━
function FullCanvas({ creative, zoom = 0.38, exportRef }) {
  return (
    <div
      ref={exportRef}
      style={{
        position: "relative",
        width: "1080px", height: "1920px",
        background: creative.bgImage ? "transparent" : "#000",
        overflow: "hidden",
        transformOrigin: "top left",
        transform: `scale(${zoom})`,
      }}
    >
      {creative.bgImage && (
        creative.bgIsVideo ? (
          <video src={creative.bgImage} crossOrigin="anonymous" autoPlay loop muted playsInline
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
        ) : (
          <img src={creative.bgImage} crossOrigin="anonymous"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} alt="" />
        )
      )}
      {creative.overlay.enabled && (
        <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
          backgroundColor: hexToRgba(creative.overlay.hex, creative.overlay.opacity) }} />
      )}
      <div style={{
        position: "relative", zIndex: 2, width: "100%", height: "100%",
        display: "flex", flexDirection: "column", justifyContent: "center",
        transform: `scale(${creative.textScale / 100}) translateY(${creative.textOffsetY}px)`,
        transformOrigin: "center center",
      }}>
        <AutoRenderer creative={creative} />
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 1: IMPORT PANEL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ImportPanel({ creatives, setCreatives, setActiveId, setStep }) {
  const fileRef = useRef(null);
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("openai_key") || "");
  const [prompt, setPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCount, setAiCount] = useState(5);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => { if (apiKey) localStorage.setItem("openai_key", apiKey); }, [apiKey]);

  // Add single from template
  const addFromTemplate = (ex) => {
    const c = createCreative({ text: ex.text, color: ex.color });
    setCreatives(prev => [...prev, c]);
    setActiveId(c.id);
  };

  // Add multiple from bulk text
  const addBulk = () => {
    const parts = bulkText.split("---").map(p => p.trim()).filter(Boolean);
    const newCreatives = parts.map(text => createCreative({ text }));
    setCreatives(prev => [...prev, ...newCreatives]);
    if (newCreatives.length > 0) setActiveId(newCreatives[0].id);
    setBulkText("");
    setShowBulk(false);
  };

  // Add from files
  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(f => {
      const isVideo = f.type.startsWith('video/');
      const r = new FileReader();
      r.onload = (ev) => {
        const c = createCreative({ bgImage: ev.target.result, bgIsVideo: isVideo });
        setCreatives(prev => [...prev, c]);
        setActiveId(c.id);
      };
      r.readAsDataURL(f);
    });
  };

  // AI Bulk Generate
  const handleAiGenerate = async () => {
    if (!apiKey.trim() || !prompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.trim()}` },
        body: JSON.stringify({
          model: "gpt-4o-mini", temperature: 0.8, max_tokens: 2000,
          messages: [
            { role: "system", content: AI_SYSTEM_PROMPT + `\n\nWICHTIG: Generiere genau ${aiCount} verschiedene Posts. Trenne sie mit --- (drei Bindestriche auf einer eigenen Zeile). Jeder Post hat sein eigenes Format.` },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) throw new Error("API Fehler");
      const data = await res.json();
      const generated = data.choices?.[0]?.message?.content?.trim();
      if (generated) {
        const parts = generated.split("---").map(p => p.trim()).filter(Boolean);
        const colorKeys = Object.keys(COLOR_PRESETS);
        const newCreatives = parts.map(text => createCreative({ text, color: pickRandom(colorKeys) }));
        setCreatives(prev => [...prev, ...newCreatives]);
        if (newCreatives.length > 0) setActiveId(newCreatives[0].id);
      }
    } catch (e) { alert("KI-Fehler: " + e.message); }
    finally { setAiLoading(false); }
  };

  // Add empty
  const addEmpty = () => {
    const c = createCreative({ text: "Neuer Titel\nUntertitel\nLabel: Wert" });
    setCreatives(prev => [...prev, c]);
    setActiveId(c.id);
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ color: "#fff", fontSize: "22px", fontWeight: 700, margin: 0, fontFamily: "system-ui" }}>
            📥 Creatives importieren
          </h2>
          <p style={{ color: COLORS.textDim, fontSize: "13px", marginTop: "6px", fontFamily: "system-ui" }}>
            Füge Hintergrundbilder/Videos hinzu, nutze Vorlagen, oder generiere Content mit KI
          </p>
        </div>

        {/* Counter */}
        <div style={{ ...sec, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px" }}>
          <span style={{ color: COLORS.accentText, fontSize: "14px", fontWeight: 700, fontFamily: "system-ui" }}>
            {creatives.length} Creative{creatives.length !== 1 ? "s" : ""} geladen
          </span>
          {creatives.length > 0 && (
            <button onClick={() => setStep("edit")} style={{
              padding: "8px 20px", fontSize: "12px", fontWeight: 700,
              background: `linear-gradient(135deg, ${COLORS.accent}, #4F46E5)`,
              border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer", fontFamily: "system-ui",
            }}>
              Weiter zum Bearbeiten ▶
            </button>
          )}
        </div>

        {/* Upload Area */}
        <div style={{ ...sec, padding: "20px", textAlign: "center", border: `2px dashed ${COLORS.border}` }}>
          <input ref={fileRef} type="file" accept="image/*,video/mp4" multiple onChange={handleFiles} style={{ display: "none" }} />
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>📤</div>
          <div style={{ color: COLORS.textDim, fontSize: "13px", marginBottom: "12px", fontFamily: "system-ui" }}>
            Bilder & Videos hochladen (mehrere gleichzeitig möglich)
          </div>
          <button onClick={() => fileRef.current?.click()} style={{
            ...abtn, padding: "10px 24px", fontSize: "13px", fontWeight: 600,
          }}>Dateien auswählen</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          {/* Templates */}
          <div style={{ ...sec, padding: "14px" }}>
            <div style={{ ...lab, marginBottom: "8px" }}><span>📂 Vorlagen</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxHeight: "200px", overflowY: "auto" }}>
              {EXAMPLES.map((ex, i) => (
                <button key={i} onClick={() => addFromTemplate(ex)} style={{
                  padding: "5px 8px", fontSize: "11px", fontFamily: "system-ui",
                  background: COLORS.card, border: `1px solid ${COLORS.border}`,
                  borderRadius: "5px", color: COLORS.textDim, cursor: "pointer",
                }}>{ex.name}</button>
              ))}
            </div>
            <button onClick={addEmpty} style={{ ...abtn, width: "100%", marginTop: "8px" }}>+ Leeres Creative</button>
          </div>

          {/* KI Generator */}
          <div style={{ ...sec, padding: "14px", border: `1px solid rgba(108,99,255,0.2)`, background: "rgba(108,99,255,0.03)" }}>
            <div style={{ ...lab, marginBottom: "8px" }}><span>✨ KI Bulk-Generator</span></div>
            {!showKey ? (
              <button onClick={() => setShowKey(true)} style={{ ...abtn, width: "100%", marginBottom: "8px" }}>🔑 API Key eingeben</button>
            ) : (
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..."
                style={{ width: "100%", padding: "6px 8px", fontSize: "11px", fontFamily: "monospace",
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${COLORS.border}`,
                  borderRadius: "5px", color: "#fff", outline: "none", boxSizing: "border-box", marginBottom: "8px" }} />
            )}
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder={`z.B. "Erstelle Posts über verschiedene Steuer-Spar-Tipps, Immobilien-Renditen und ETF-Vergleiche"`}
              style={{ width: "100%", minHeight: "70px", padding: "8px", background: "rgba(255,255,255,0.04)",
                border: `1px solid rgba(108,99,255,0.15)`, borderRadius: "6px", color: "#fff",
                fontSize: "12px", fontFamily: "system-ui", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" }}>
              <span style={{ color: COLORS.textDim, fontSize: "11px", fontFamily: "system-ui" }}>Anzahl:</span>
              <select value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}
                style={{ padding: "4px 8px", fontSize: "11px", background: "rgba(255,255,255,0.05)", color: "#fff",
                  border: `1px solid ${COLORS.border}`, borderRadius: "4px", outline: "none" }}>
                {[3, 5, 8, 10, 15].map(n => <option key={n} value={n}>{n} Posts</option>)}
              </select>
              <button onClick={handleAiGenerate} disabled={aiLoading} style={{
                ...abtn, flex: 1, fontWeight: 600,
                background: aiLoading ? "rgba(108,99,255,0.1)" : "linear-gradient(135deg, rgba(108,99,255,0.8), rgba(79,70,229,0.9))",
                color: "#fff", opacity: aiLoading ? 0.7 : 1,
              }}>
                {aiLoading ? "⟳ Generiere..." : `✨ ${aiCount}x generieren`}
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Text Import */}
        <div style={sec}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...lab.fontSize, color: COLORS.textDim, fontSize: "10px", fontFamily: "monospace", textTransform: "uppercase" }}>📝 Text Bulk-Import</span>
            <button onClick={() => setShowBulk(p => !p)} style={{ ...abtn, fontSize: "9px", padding: "3px 8px" }}>
              {showBulk ? "Schließen" : "Öffnen"}
            </button>
          </div>
          {showBulk && (
            <div style={{ marginTop: "8px" }}>
              <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)}
                placeholder="Mehrere Posts einfügen, getrennt durch ---\n\nPost 1\n...\n---\nPost 2\n..."
                style={{ width: "100%", minHeight: "120px", padding: "10px", background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${COLORS.border}`, borderRadius: "6px", color: "#fff",
                  fontSize: "11px", fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              <button onClick={addBulk} style={{ ...abtn, width: "100%", marginTop: "6px", fontWeight: 600 }}>
                Alle importieren
              </button>
            </div>
          )}
        </div>

        {/* Preview of loaded creatives */}
        {creatives.length > 0 && (
          <div style={sec}>
            <div style={{ ...lab, marginBottom: "10px" }}><span>Geladene Creatives</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {creatives.map((c, i) => (
                <div key={c.id} style={{
                  width: "80px", height: "142px", borderRadius: "6px", overflow: "hidden",
                  border: `1px solid ${COLORS.border}`, position: "relative", flexShrink: 0,
                }}>
                  <div style={{ transform: "scale(0.074)", transformOrigin: "top left", width: "1080px", height: "1920px",
                    background: c.bgImage ? "transparent" : "#000", position: "relative" }}>
                    {c.bgImage && !c.bgIsVideo && <img src={c.bgImage} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} alt="" />}
                    {c.overlay.enabled && <div style={{ position: "absolute", inset: 0, backgroundColor: hexToRgba(c.overlay.hex, c.overlay.opacity) }} />}
                    <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
                      transform: `scale(${c.textScale / 100})`, transformOrigin: "center center" }}>
                      <AutoRenderer creative={c} />
                    </div>
                  </div>
                  <div style={{ position: "absolute", top: "3px", left: "3px", background: "rgba(0,0,0,0.7)",
                    color: "#fff", fontSize: "9px", padding: "1px 4px", borderRadius: "3px", fontWeight: 700 }}>{i + 1}</div>
                  <button onClick={() => setCreatives(prev => prev.filter(x => x.id !== c.id))} style={{
                    position: "absolute", top: "2px", right: "2px", background: "rgba(229,9,20,0.8)",
                    color: "#fff", border: "none", borderRadius: "50%", width: "16px", height: "16px",
                    fontSize: "9px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 2: EDIT PANEL — Horizontal Filmstrip Bulk Editor
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function EditPanel({ creatives, setCreatives, activeId, setActiveId, setStep }) {
  const active = creatives.find(c => c.id === activeId) || creatives[0];
  const activeIndex = creatives.findIndex(c => c.id === activeId);
  const fileRef = useRef(null);
  const exportRef = useRef(null);
  const filmstripRef = useRef(null);

  const updateActive = (updates) => {
    setCreatives(prev => prev.map(c => c.id === active.id ? { ...c, ...updates } : c));
  };

  // Apply current settings to ALL creatives
  const applyToAll = (field) => {
    const val = active[field];
    setCreatives(prev => prev.map(c => ({ ...c, [field]: val })));
  };

  // Navigate with keyboard
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const idx = creatives.findIndex(c => c.id === activeId);
        if (idx < creatives.length - 1) setActiveId(creatives[idx + 1].id);
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = creatives.findIndex(c => c.id === activeId);
        if (idx > 0) setActiveId(creatives[idx - 1].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeId, creatives, setActiveId]);

  if (!active) return <div style={{ color: "#fff", padding: "40px", textAlign: "center" }}>Keine Creatives geladen. Gehe zurück zum Import.</div>;

  const parsed = parseInput(active.inputText);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Top Bar: Navigation + Counter */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}`,
        background: "rgba(13,15,20,0.95)", backdropFilter: "blur(10px)", zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => { const idx = creatives.findIndex(c => c.id === activeId); if (idx > 0) setActiveId(creatives[idx - 1].id); }}
            disabled={activeIndex === 0}
            style={{ ...abtn, fontSize: "16px", padding: "4px 12px", opacity: activeIndex === 0 ? 0.3 : 1 }}>◀</button>
          <span style={{ color: COLORS.accentText, fontSize: "14px", fontWeight: 700, fontFamily: "system-ui" }}>
            Creative {activeIndex + 1} / {creatives.length}
          </span>
          <button onClick={() => { const idx = creatives.findIndex(c => c.id === activeId); if (idx < creatives.length - 1) setActiveId(creatives[idx + 1].id); }}
            disabled={activeIndex === creatives.length - 1}
            style={{ ...abtn, fontSize: "16px", padding: "4px 12px", opacity: activeIndex === creatives.length - 1 ? 0.3 : 1 }}>▶</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: COLORS.textMuted, fontSize: "10px", fontFamily: "monospace" }}>← → Pfeiltasten zum Navigieren</span>
          <button onClick={() => setStep("export")} style={{
            padding: "8px 20px", fontSize: "12px", fontWeight: 700,
            background: `linear-gradient(135deg, ${COLORS.success}, #16a34a)`,
            border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer", fontFamily: "system-ui",
          }}>Weiter zum Export ▶</button>
        </div>
      </div>

      {/* Main Area: Sidebar + Preview + Filmstrip */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left Sidebar: Edit Controls */}
        <div style={{
          width: "300px", flexShrink: 0, overflowY: "auto", padding: "12px",
          borderRight: `1px solid ${COLORS.border}`, background: COLORS.panel,
        }}>
          {/* Text Input */}
          <div style={sec}>
            <div style={{ ...lab, marginBottom: "6px" }}><span>📝 Text</span></div>
            <textarea value={active.inputText}
              onChange={(e) => updateActive({ inputText: e.target.value })}
              style={{ width: "100%", minHeight: "140px", padding: "8px", background: "rgba(255,255,255,0.04)",
                border: `1px solid ${COLORS.border}`, borderRadius: "6px", color: "#fff",
                fontSize: "11px", fontFamily: "'SF Mono',monospace", lineHeight: 1.6,
                outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ fontSize: "9px", color: COLORS.textMuted, marginTop: "4px", fontFamily: "monospace" }}>
              {parsed.type === "compare" ? `⚔️ Vergleich (${parsed.rows.length} Zeilen)` : `📋 Liste (${parsed.rows.length} Einträge)`}
            </div>
          </div>

          {/* Color Presets */}
          <div style={sec}>
            <div style={{ ...lab, marginBottom: "6px" }}>
              <span>🎨 Farben</span>
              <button onClick={() => applyToAll("colorPreset")} style={{ ...abtn, fontSize: "8px", padding: "2px 6px" }}>Auf alle</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
              {Object.entries(COLOR_PRESETS).map(([k, v]) => (
                <button key={k} onClick={() => updateActive({ colorPreset: k })} style={{
                  padding: "3px 6px", fontSize: "9px",
                  background: active.colorPreset === k ? COLORS.accentBg : "transparent",
                  border: `1px solid ${active.colorPreset === k ? COLORS.accent : COLORS.border}`,
                  borderRadius: "4px", cursor: "pointer", fontFamily: "system-ui",
                  color: active.colorPreset === k ? COLORS.accentText : COLORS.textDim,
                  display: "flex", alignItems: "center", gap: "3px",
                }}>
                  <div style={{ display: "flex", gap: "1px" }}>
                    <div style={{ width: "7px", height: "7px", borderRadius: "2px", background: v.colA }} />
                    <div style={{ width: "7px", height: "7px", borderRadius: "2px", background: v.colB }} />
                  </div>
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          {/* Text Scale + Position */}
          <div style={sec}>
            <div style={{ ...lab }}><span>📐 Textgröße</span><span>{active.textScale}%</span></div>
            <input type="range" min="40" max="150" value={active.textScale}
              onChange={(e) => updateActive({ textScale: Number(e.target.value) })} style={rng} />
            <div style={{ ...lab, marginTop: "8px" }}><span>↕️ Y-Position</span><span>{active.textOffsetY}px</span></div>
            <input type="range" min={-400} max={400} value={active.textOffsetY}
              onChange={(e) => updateActive({ textOffsetY: Number(e.target.value) })} style={rng} />
            <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
              <button onClick={() => applyToAll("textScale")} style={{ ...abtn, fontSize: "8px", padding: "2px 6px", flex: 1 }}>Größe auf alle</button>
              <button onClick={() => applyToAll("textOffsetY")} style={{ ...abtn, fontSize: "8px", padding: "2px 6px", flex: 1 }}>Position auf alle</button>
            </div>
          </div>

          {/* Background */}
          <div style={sec}>
            <div style={{ ...lab, marginBottom: "6px" }}>
              <span>🖼️ Hintergrund</span>
              <button onClick={() => applyToAll("bgImage")} style={{ ...abtn, fontSize: "8px", padding: "2px 6px" }}>Auf alle</button>
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/mp4" onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const isVideo = f.type.startsWith('video/');
              const r = new FileReader();
              r.onload = (ev) => updateActive({ bgImage: ev.target.result, bgIsVideo: isVideo });
              r.readAsDataURL(f);
            }} style={{ display: "none" }} />
            <div style={{ display: "flex", gap: "4px" }}>
              <button onClick={() => fileRef.current?.click()} style={abtn}>
                {active.bgImage ? "Ändern" : "📤 Upload"}
              </button>
              {active.bgImage && <button onClick={() => updateActive({ bgImage: null, bgIsVideo: false })}
                style={{ ...abtn, color: "#FF6B6B", borderColor: "rgba(229,9,20,0.2)" }}>✕</button>}
            </div>
          </div>

          {/* Overlay */}
          <div style={sec}>
            <div style={{ ...lab, marginBottom: "6px" }}>
              <span>Overlay</span>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button onClick={() => { applyToAll("overlay"); }} style={{ ...abtn, fontSize: "8px", padding: "2px 6px" }}>Auf alle</button>
                <input type="checkbox" checked={active.overlay.enabled}
                  onChange={() => updateActive({ overlay: { ...active.overlay, enabled: !active.overlay.enabled } })}
                  style={{ accentColor: COLORS.accent }} />
              </div>
            </div>
            {active.overlay.enabled && <>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input type="color" value={active.overlay.hex}
                  onChange={(e) => updateActive({ overlay: { ...active.overlay, hex: e.target.value } })}
                  style={{ width: "26px", height: "22px", border: "none", borderRadius: "4px", cursor: "pointer", background: "transparent", padding: 0 }} />
                <span style={{ fontSize: "10px", color: COLORS.textMuted, fontFamily: "monospace" }}>
                  {active.overlay.hex} · {active.overlay.opacity}%
                </span>
              </div>
              <input type="range" min="0" max="100" value={active.overlay.opacity}
                onChange={(e) => updateActive({ overlay: { ...active.overlay, opacity: Number(e.target.value) } })}
                style={{ ...rng, marginTop: "4px" }} />
            </>}
          </div>

          {/* Box Backgrounds */}
          <div style={sec}>
            <div style={{ ...lab }}>
              <span>🟩 Box-Hintergründe</span>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button onClick={() => applyToAll("showBoxBackgrounds")} style={{ ...abtn, fontSize: "8px", padding: "2px 6px" }}>Auf alle</button>
                <input type="checkbox" checked={active.showBoxBackgrounds}
                  onChange={() => updateActive({ showBoxBackgrounds: !active.showBoxBackgrounds })}
                  style={{ accentColor: COLORS.accent }} />
              </div>
            </div>
          </div>
        </div>

        {/* Center: Main Preview */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          background: "radial-gradient(ellipse at center, #1a1e2e 0%, #0f1119 70%)",
          overflow: "hidden",
        }}>
          {/* Main Preview */}
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", overflow: "auto", padding: "16px" }}>
            <div style={{
              width: 1080 * 0.38, height: 1920 * 0.38, flexShrink: 0,
              boxShadow: "0 16px 100px rgba(0,0,0,0.6)", borderRadius: "16px", overflow: "hidden",
            }}>
              <FullCanvas creative={active} zoom={0.38} exportRef={exportRef} />
            </div>
          </div>

          {/* Bottom Filmstrip */}
          <div ref={filmstripRef} style={{
            display: "flex", gap: "8px", padding: "12px 16px",
            overflowX: "auto", overflowY: "hidden",
            borderTop: `1px solid ${COLORS.border}`,
            background: "rgba(13,15,20,0.95)",
            minHeight: "160px",
          }}>
            {creatives.map((c, i) => (
              <div key={c.id} style={{
                flexShrink: 0, cursor: "pointer", position: "relative",
                border: c.id === activeId ? `3px solid ${COLORS.accent}` : `2px solid ${COLORS.border}`,
                borderRadius: "8px", overflow: "hidden",
                transition: "border-color 0.2s, transform 0.15s",
                transform: c.id === activeId ? "scale(1.05)" : "scale(1)",
                width: "75px", height: "133px",
              }} onClick={() => setActiveId(c.id)}>
                <div style={{
                  transform: "scale(0.069)", transformOrigin: "top left",
                  width: "1080px", height: "1920px",
                  background: c.bgImage ? "transparent" : "#000", position: "relative",
                }}>
                  {c.bgImage && !c.bgIsVideo && <img src={c.bgImage} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} alt="" />}
                  {c.overlay.enabled && <div style={{ position: "absolute", inset: 0, backgroundColor: hexToRgba(c.overlay.hex, c.overlay.opacity) }} />}
                  <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
                    transform: `scale(${c.textScale / 100})`, transformOrigin: "center center" }}>
                    <AutoRenderer creative={c} />
                  </div>
                </div>
                {/* Number badge */}
                <div style={{
                  position: "absolute", bottom: "3px", left: "50%", transform: "translateX(-50%)",
                  background: c.id === activeId ? COLORS.accent : "rgba(0,0,0,0.7)",
                  color: "#fff", fontSize: "10px", fontWeight: 700, padding: "1px 6px",
                  borderRadius: "4px", fontFamily: "system-ui",
                }}>{i + 1}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 3: EXPORT PANEL — Bulk Render & Download
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ExportPanel({ creatives, setCreatives, setStep, activeId, setActiveId }) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: "" });
  const [exportType, setExportType] = useState("png"); // png or mp4
  const exportRefs = useRef({});

  // Select/Deselect
  const toggleSelect = (id) => {
    setCreatives(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  };
  const selectAll = () => setCreatives(prev => prev.map(c => ({ ...c, selected: true })));
  const deselectAll = () => setCreatives(prev => prev.map(c => ({ ...c, selected: false })));

  const selectedCount = creatives.filter(c => c.selected).length;

  // Export single PNG
  const exportSinglePNG = async (creative, idx) => {
    const el = exportRefs.current[creative.id];
    if (!el) return;
    if (!window.html2canvas) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      document.head.appendChild(s);
      await new Promise(r => { s.onload = r; s.onerror = () => r(); });
    }
    const canvas = await window.html2canvas(el, { scale: 1, useCORS: true, allowTaint: true, backgroundColor: null });
    const link = document.createElement("a");
    const title = parseInput(creative.inputText).title.replace(/[^a-zA-Z0-9äöüÄÖÜ]/g, "_").slice(0, 30);
    link.download = `reel-${String(idx + 1).padStart(2, "0")}-${title}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    await new Promise(r => setTimeout(r, 300)); // prevent browser blocking
  };

  // Bulk Export
  const handleBulkExport = async () => {
    const selected = creatives.filter(c => c.selected);
    if (selected.length === 0) return;
    setExporting(true);
    setProgress({ current: 0, total: selected.length, status: "Starte Export..." });

    for (let i = 0; i < selected.length; i++) {
      setProgress({ current: i + 1, total: selected.length, status: `Exportiere ${i + 1}/${selected.length}...` });
      await exportSinglePNG(selected[i], creatives.indexOf(selected[i]));
    }

    setProgress({ current: selected.length, total: selected.length, status: "✅ Fertig!" });
    setTimeout(() => setExporting(false), 1500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Top Bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}`,
        background: "rgba(13,15,20,0.95)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: 700, margin: 0, fontFamily: "system-ui" }}>
            📦 Bulk Export
          </h3>
          <span style={{ color: COLORS.accentText, fontSize: "12px", fontFamily: "system-ui" }}>
            {selectedCount} von {creatives.length} ausgewählt
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button onClick={selectAll} style={abtn}>Alle auswählen</button>
          <button onClick={deselectAll} style={abtn}>Keine</button>
          <button onClick={handleBulkExport} disabled={exporting || selectedCount === 0} style={{
            padding: "10px 28px", fontSize: "13px", fontWeight: 700,
            background: exporting ? "#333" : `linear-gradient(135deg, ${COLORS.success}, #16a34a)`,
            border: "none", borderRadius: "8px", color: "#fff", cursor: exporting ? "wait" : "pointer",
            fontFamily: "system-ui", opacity: selectedCount === 0 ? 0.4 : 1,
          }}>
            {exporting ? progress.status : `↓ ${selectedCount} PNGs exportieren`}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {exporting && (
        <div style={{ padding: "0 20px", background: COLORS.panel }}>
          <div style={{ height: "4px", borderRadius: "2px", background: COLORS.card, marginTop: "8px", marginBottom: "8px" }}>
            <div style={{
              height: "100%", borderRadius: "2px",
              background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.success})`,
              width: `${(progress.current / progress.total) * 100}%`,
              transition: "width 0.3s",
            }} />
          </div>
        </div>
      )}

      {/* Grid of all creatives */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "20px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: "16px",
        alignContent: "start",
      }}>
        {creatives.map((c, i) => (
          <div key={c.id} style={{
            position: "relative", borderRadius: "12px", overflow: "hidden",
            border: c.selected ? `3px solid ${COLORS.success}` : `2px solid ${COLORS.border}`,
            background: COLORS.card,
            transition: "border-color 0.2s, transform 0.15s",
            cursor: "pointer",
          }}>
            {/* Checkbox */}
            <div style={{
              position: "absolute", top: "8px", left: "8px", zIndex: 10,
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              <input type="checkbox" checked={c.selected}
                onChange={() => toggleSelect(c.id)}
                style={{ accentColor: COLORS.success, width: "16px", height: "16px", cursor: "pointer" }} />
              <span style={{
                background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: "10px",
                fontWeight: 700, padding: "2px 6px", borderRadius: "4px",
              }}>{i + 1}</span>
            </div>

            {/* Edit button */}
            <button onClick={() => { setActiveId(c.id); setStep("edit"); }} style={{
              position: "absolute", top: "8px", right: "8px", zIndex: 10,
              background: "rgba(108,99,255,0.8)", color: "#fff", border: "none",
              borderRadius: "6px", padding: "3px 8px", fontSize: "9px", fontWeight: 600,
              cursor: "pointer", fontFamily: "system-ui",
            }}>✏️</button>

            {/* Preview */}
            <div style={{ width: "100%", aspectRatio: "9/16", overflow: "hidden", position: "relative" }}
              onClick={() => toggleSelect(c.id)}>
              <div
                ref={el => { if (el) exportRefs.current[c.id] = el; }}
                style={{
                  transform: "scale(0.148)", transformOrigin: "top left",
                  width: "1080px", height: "1920px",
                  background: c.bgImage ? "transparent" : "#000", position: "absolute", top: 0, left: 0,
                }}>
                {c.bgImage && !c.bgIsVideo && <img src={c.bgImage} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} alt="" />}
                {c.bgImage && c.bgIsVideo && <video src={c.bgImage} muted loop autoPlay playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                {c.overlay.enabled && <div style={{ position: "absolute", inset: 0, zIndex: 1, backgroundColor: hexToRgba(c.overlay.hex, c.overlay.opacity) }} />}
                <div style={{
                  position: "relative", zIndex: 2, width: "100%", height: "100%",
                  display: "flex", flexDirection: "column", justifyContent: "center",
                  transform: `scale(${c.textScale / 100}) translateY(${c.textOffsetY}px)`,
                  transformOrigin: "center center",
                }}>
                  <AutoRenderer creative={c} />
                </div>
              </div>
            </div>

            {/* Title preview */}
            <div style={{
              padding: "8px 10px", borderTop: `1px solid ${COLORS.border}`,
            }}>
              <div style={{
                fontSize: "10px", fontWeight: 600, color: c.selected ? COLORS.success : COLORS.textDim,
                fontFamily: "system-ui", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {c.selected ? "✅ " : ""}{parseInput(c.inputText).title}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN APP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function App() {
  const [step, setStep] = useState("import"); // import | edit | export
  const [creatives, setCreatives] = useState([]);
  const [activeId, setActiveId] = useState(null);

  // Set active to first if none selected
  useEffect(() => {
    if (!activeId && creatives.length > 0) setActiveId(creatives[0].id);
  }, [creatives, activeId]);

  const steps = [
    { key: "import", label: "📥 Import", num: "1" },
    { key: "edit", label: "✏️ Bearbeiten", num: "2" },
    { key: "export", label: "📦 Export", num: "3" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: COLORS.bg }}>
      {/* Top Navigation Bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", height: "48px", flexShrink: 0,
        background: COLORS.panel, borderBottom: `1px solid ${COLORS.border}`,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px", fontWeight: 800, color: "#fff", fontFamily: "system-ui", letterSpacing: "-0.5px" }}>
            ⚡ Reel Producer
          </span>
          <span style={{ fontSize: "10px", color: COLORS.accentText, fontFamily: "monospace", background: COLORS.accentBg,
            padding: "2px 8px", borderRadius: "4px" }}>BULK MODE</span>
        </div>

        {/* Step Navigation */}
        <div style={{ display: "flex", gap: "4px" }}>
          {steps.map((s, i) => {
            const isActive = step === s.key;
            const isCompleted = steps.findIndex(x => x.key === step) > i;
            const isDisabled = s.key === "edit" && creatives.length === 0 || s.key === "export" && creatives.length === 0;
            return (
              <button key={s.key} onClick={() => !isDisabled && setStep(s.key)}
                disabled={isDisabled}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "6px 16px", fontSize: "12px", fontWeight: isActive ? 700 : 500,
                  background: isActive ? COLORS.accentBg : "transparent",
                  border: `1px solid ${isActive ? COLORS.accent : isDisabled ? "transparent" : COLORS.border}`,
                  borderRadius: "8px", cursor: isDisabled ? "not-allowed" : "pointer",
                  fontFamily: "system-ui",
                  color: isActive ? COLORS.accentText : isDisabled ? "rgba(255,255,255,0.15)" : COLORS.textDim,
                  opacity: isDisabled ? 0.5 : 1,
                  transition: "all 0.2s",
                }}>
                <span style={{
                  width: "20px", height: "20px", borderRadius: "50%", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700,
                  background: isActive ? COLORS.accent : isCompleted ? COLORS.success : "rgba(255,255,255,0.05)",
                  color: (isActive || isCompleted) ? "#fff" : COLORS.textDim,
                }}>{isCompleted ? "✓" : s.num}</span>
                {s.label}
                {i < steps.length - 1 && (
                  <span style={{ color: COLORS.textMuted, marginLeft: "8px" }}>›</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Creative Counter */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: COLORS.textDim, fontFamily: "system-ui" }}>
            {creatives.length} Creative{creatives.length !== 1 ? "s" : ""}
          </span>
          {creatives.length > 0 && (
            <button onClick={() => { setCreatives([]); setActiveId(null); setStep("import"); }}
              style={{ ...abtn, fontSize: "9px", padding: "3px 8px", color: "#FF6B6B", borderColor: "rgba(229,9,20,0.2)" }}>
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {step === "import" && (
          <ImportPanel creatives={creatives} setCreatives={setCreatives}
            setActiveId={setActiveId} setStep={setStep} />
        )}
        {step === "edit" && (
          <EditPanel creatives={creatives} setCreatives={setCreatives}
            activeId={activeId} setActiveId={setActiveId} setStep={setStep} />
        )}
        {step === "export" && (
          <ExportPanel creatives={creatives} setCreatives={setCreatives}
            setStep={setStep} activeId={activeId} setActiveId={setActiveId} />
        )}
      </div>
    </div>
  );
}
