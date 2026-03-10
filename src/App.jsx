import { useState, useRef, useCallback, useEffect } from "react";

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
  { name: "Berufsvergleich", color: "blau_gelb", text: "Berufsvergleich\nApotheker vs Facharzt\nEinkommen: 5.300\u20AC | 9.500\u20AC\nSteuern: 1.010\u20AC | 2.450\u20AC\nKrankenversicherung: 450\u20AC GKV | 450\u20AC PKV\nSozialabgaben: 610\u20AC | 890\u20AC\nArbeitszeit: 42Std | 55Std\nNetto: 3.230\u20AC | 5.710\u20AC" },
  { name: "Rente Vergleich", color: "gelb_rot", text: "Wo ist die Rente besser?\nSchweden vs Deutschland\nEinkommen: 4.800\u20AC | 4.000\u20AC\nBeitragsjahre: 45 | 45\nBeitragssatz AN: 0% | 9,6%\nBeitragssatz AG: 23% | 9,6%\nRentenniveau: ~75% | 48%\nRente: 3.600\u20AC | 1.850\u20AC" },
  { name: "Familie Vergleich", color: "gelb_rot", text: "Andere Zeiten?!\nFamilie 2026 vs Familie 1980\nArbeit: Beide Vollzeit | Ein Gehalt reicht\nEinkommen: Zwei Gehaelter | Ein Gehalt reicht\nWohnen: Kaum erreichbar | Eigenheim\nAuto: 2x Leasing | Eins gekauft\nFazit: Trotzdem knapp | Stabiles Leben" },
  { name: "Investment Start", color: "schwarz_weiss", text: "01.01.2025\nWenn du 10.000\u20AC investiert haettest\nGold: 10.000\u20AC\nS&P 500: 10.000\u20AC\nCommerzbank: 10.000\u20AC\nSparbuch: 10.000\u20AC\nNVIDIA: 10.000\u20AC" },
  { name: "Vermoegen Alter", color: "rot_weiss", text: "Vermoegen in DE\nTop 10% deiner Altersklasse?\n18 J.: 25.000\u20AC\n25 J.: 80.000\u20AC\n30 J.: 160.000\u20AC\n35 J.: 260.000\u20AC\n40 J.: 350.000\u20AC\n50 J.: 480.000\u20AC" },
  { name: "Cash-Flow Rechner", color: "gelb_schwarz", text: "Cash-Flow einer Immobilie\nBeispiel: 3-Zimmer Leipzig\nKaltmiete: 750\u20AC\nHausgeld: -180\u20AC\nRuecklage: -50\u20AC\nZinsen: -320\u20AC\nTilgung: -150\u20AC\nSteuervorteil: +80\u20AC\nCash-Flow: +130\u20AC/Monat" },
  { name: "Abo-Check", color: "lila_gelb", text: "Deine monatlichen Abos\nWas du wirklich brauchst\nNetflix: 13,99\u20AC\nSpotify: 10,99\u20AC\niCloud: 2,99\u20AC\nNews App: 9,99\u20AC\nGym: 29,99\u20AC\nHandy: 39,99\u20AC\nGesamt: 107,94\u20AC/Monat" },
  { name: "Steuerlast", color: "rot_weiss", text: "So viel zahlst du wirklich\nSteuerlast in Deutschland\nBrutto: 5.000\u20AC\nLohnsteuer: -850\u20AC\nSoli: -47\u20AC\nKV: -375\u20AC\nRV: -465\u20AC\nAV: -65\u20AC\nPV: -85\u20AC\nNetto: 3.113\u20AC" },
  { name: "Mieten vs Kaufen", color: "rot_weiss", text: "Mieten oder Kaufen?\nMieter vs Kaeufer\nMonatlich: 1.200\u20AC Miete | 1.400\u20AC Rate\nNach 10 J.: 0\u20AC | 80.000\u20AC Equity\nNach 30 J.: 0\u20AC | 350.000\u20AC Eigentum\nFlexibilitaet: Hoch | Gering\nFazit: Bequem aber teuer | Vermoegen aufgebaut" },
  { name: "GmbH vs Einzelunt.", color: "blau_rot", text: "Rechtsform Vergleich\nGmbH vs Einzelunternehmer\nHaftung: Beschraenkt | Unbeschraenkt\nGruendungskosten: ~1.000\u20AC | 0\u20AC\nSteuerlast: ~30% | bis 45%\nBuchhaltung: Doppelt | Einfach\nImage: Professionell | Weniger serioes\nVerkauf moeglich: Ja | Schwierig" },
];

// ━━━ AI SYSTEM PROMPT ━━━
const AI_SYSTEM_PROMPT = "Du bist ein Assistent fuer einen Social-Media Reel/Story-Editor. Generiere strukturierten Text. Erste Zeile: Titel. Fuer Vergleiche: Zweite Zeile: A vs B, dann Label: WertA | WertB. Fuer Listen: Label: Wert. Max 7-8 Zeilen. Kurze Texte. Antworte NUR mit formatiertem Text.";

// ━━━ HELPER: Create Creative ━━━
function createCreative(overrides) {
  const ex = overrides && overrides.text ? null : pickRandom(EXAMPLES);
  return {
    id: uid(),
    inputText: (overrides && overrides.text) || (ex ? ex.text : EXAMPLES[0].text),
    colorPreset: (overrides && overrides.color) || (ex ? ex.color : "blau_gelb"),
    bgImage: (overrides && overrides.bgImage) || null,
    bgIsVideo: (overrides && overrides.bgIsVideo) || false,
    overlay: { enabled: true, hex: "#0B1222", opacity: 55 },
    textScale: 100,
    textOffsetY: 0,
    colorOverrides: {},
    showBoxBackgrounds: true,
    selected: true,
  };
}

// ━━━ STYLE TOKENS ━━━
const C = {
  bg: "#0B0D12", panel: "#0D0F14", card: "rgba(255,255,255,0.025)",
  border: "rgba(255,255,255,0.06)", accent: "#6C63FF",
  accentBg: "rgba(108,99,255,0.12)", accentText: "#A9A3FF",
  text: "#fff", dim: "rgba(255,255,255,0.4)", muted: "rgba(255,255,255,0.2)",
  danger: "#E50914", success: "#22C55E",
};
const sec = { marginBottom: "10px", padding: "10px", background: C.card, borderRadius: "8px", border: "1px solid " + C.border };
const lab = { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: C.dim, marginBottom: "4px", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.5px" };
const rng = { width: "100%", accentColor: C.accent, cursor: "pointer", height: "3px" };
const abtn = { padding: "5px 10px", fontSize: "10px", background: C.accentBg, border: "1px solid rgba(108,99,255,0.2)", borderRadius: "5px", color: C.accentText, cursor: "pointer", fontFamily: "monospace" };

// ━━━ LABEL BOX ━━━
function LB(props) {
  var bg = props.bg || "transparent";
  var color = props.color || "#fff";
  var size = props.size || 28;
  var bold = props.bold !== false;
  var style = props.style || {};
  var showBg = props.showBoxBg !== false;
  return (
    <div style={Object.assign({
      display: "inline-block", padding: "10px 22px", borderRadius: "12px",
      backgroundColor: showBg ? bg : "transparent", color: color,
      fontSize: size + "px", fontWeight: bold ? 800 : 600,
      fontFamily: "'SF Pro Display',system-ui,sans-serif", lineHeight: 1.3,
      textAlign: "center", whiteSpace: "pre-line",
      boxShadow: showBg ? "0 3px 12px rgba(0,0,0,0.2)" : "none",
    }, style)}>{props.children}</div>
  );
}

// ━━━ RENDERERS ━━━
function RenderCompare(props) {
  var creative = props.creative;
  var parsed = parseInput(creative.inputText);
  var c = COLOR_PRESETS[creative.colorPreset] || COLOR_PRESETS.blau_gelb;
  var co = creative.colorOverrides || {};
  var sb = creative.showBoxBackgrounds;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", padding: "50px 30px", gap: "14px", boxSizing: "border-box" }}>
      <LB bg={c.titleBg} color={c.title} size={44} showBoxBg={sb} style={{ marginBottom: "10px" }}>{parsed.title}</LB>
      <div style={{ display: "flex", width: "92%", justifyContent: "space-between", alignItems: "center" }}>
        <LB bg={c.colA} color={c.colAText} size={30} showBoxBg={sb}>{parsed.colALabel}</LB>
        <LB bg="rgba(255,255,255,0.9)" color="#000" size={24} bold={false} showBoxBg={sb}>vs.</LB>
        <LB bg={c.colB} color={c.colBText} size={30} showBoxBg={sb}>{parsed.colBLabel}</LB>
      </div>
      <div style={{ height: "20px" }} />
      {parsed.rows.map(function(r, i) {
        var o = co[i] || {};
        return (
          <div key={i} style={{ display: "flex", width: "96%", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <LB bg={o.bgA || c.colA} color={o.textA || c.colAText} size={28} showBoxBg={sb} style={{ flex: "1 1 28%", minWidth: 0 }}>{r.left}</LB>
            <LB bg="rgba(255,255,255,0.92)" color="#000" size={24} showBoxBg={sb} style={{ flex: "1 1 36%", minWidth: 0 }}>{r.center}</LB>
            <LB bg={o.bgB || c.colB} color={o.textB || c.colBText} size={28} showBoxBg={sb} style={{ flex: "1 1 28%", minWidth: 0 }}>{r.right}</LB>
          </div>
        );
      })}
      <div style={{ marginTop: "20px" }}>
        <LB bg="rgba(255,255,255,0.85)" color="#000" size={20} bold={false} showBoxBg={sb}>Infos in der Caption</LB>
      </div>
    </div>
  );
}

function RenderList(props) {
  var creative = props.creative;
  var parsed = parseInput(creative.inputText);
  var c = COLOR_PRESETS[creative.colorPreset] || COLOR_PRESETS.blau_gelb;
  var co = creative.colorOverrides || {};
  var sb = creative.showBoxBackgrounds;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", padding: "50px 30px", gap: "14px", boxSizing: "border-box" }}>
      <LB bg={c.titleBg} color={c.title} size={48} showBoxBg={sb} style={{ marginBottom: "4px" }}>{parsed.title}</LB>
      {parsed.subtitle ? <LB bg={c.colA} color={c.colAText} size={28} showBoxBg={sb} style={{ marginBottom: "20px" }}>{parsed.subtitle}</LB> : null}
      {!parsed.subtitle ? <div style={{ height: "20px" }} /> : null}
      {parsed.rows.map(function(r, i) {
        var isLast = i === parsed.rows.length - 1;
        var o = co[i] || {};
        return (
          <div key={i} style={{ display: "flex", width: "90%", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
            <LB bg={o.bgA || c.colA} color={o.textA || c.colAText} size={32} showBoxBg={sb} style={{ flex: "1 1 50%", textAlign: "left" }}>{r.label}</LB>
            {r.value ? <LB bg={o.bgB || (isLast ? c.colB : "#FFFFFF")} color={o.textB || (isLast ? c.colBText : "#000")} size={32} showBoxBg={sb} style={{ flex: "1 1 45%", textAlign: "right" }}>{r.value}</LB> : null}
          </div>
        );
      })}
    </div>
  );
}

function AutoRenderer(props) {
  var parsed = parseInput(props.creative.inputText);
  if (parsed.type === "compare") return <RenderCompare creative={props.creative} />;
  return <RenderList creative={props.creative} />;
}

// ━━━ CANVAS COMPONENT (used for preview + export) ━━━
function CanvasView(props) {
  var creative = props.creative;
  var scale = props.scale || 0.38;
  return (
    <div ref={props.exportRef} style={{
      position: "relative", width: "1080px", height: "1920px",
      background: creative.bgImage ? "transparent" : "#000",
      overflow: "hidden", transformOrigin: "top left",
      transform: "scale(" + scale + ")",
    }}>
      {creative.bgImage && !creative.bgIsVideo ? (
        <img src={creative.bgImage} crossOrigin="anonymous"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} alt="" />
      ) : null}
      {creative.bgImage && creative.bgIsVideo ? (
        <video src={creative.bgImage} crossOrigin="anonymous" autoPlay loop muted playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
      ) : null}
      {creative.overlay.enabled ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
          backgroundColor: hexToRgba(creative.overlay.hex, creative.overlay.opacity) }} />
      ) : null}
      <div style={{
        position: "relative", zIndex: 2, width: "100%", height: "100%",
        display: "flex", flexDirection: "column", justifyContent: "center",
        transform: "scale(" + (creative.textScale / 100) + ") translateY(" + creative.textOffsetY + "px)",
        transformOrigin: "center center",
      }}>
        <AutoRenderer creative={creative} />
      </div>
    </div>
  );
}

// ━━━ FILMSTRIP THUMBNAIL ━━━
function Thumb(props) {
  var c = props.creative;
  var isActive = props.isActive;
  var idx = props.idx;
  return (
    <div onClick={props.onClick} style={{
      flexShrink: 0, cursor: "pointer", position: "relative",
      border: isActive ? "3px solid " + C.accent : "2px solid " + C.border,
      borderRadius: "8px", overflow: "hidden",
      transition: "border-color 0.2s, transform 0.15s",
      transform: isActive ? "scale(1.05)" : "scale(1)",
      width: "75px", height: "133px",
    }}>
      <div style={{
        transform: "scale(0.069)", transformOrigin: "top left",
        width: "1080px", height: "1920px",
        background: c.bgImage ? "transparent" : "#000", position: "relative",
      }}>
        {c.bgImage && !c.bgIsVideo ? <img src={c.bgImage} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : null}
        {c.overlay.enabled ? <div style={{ position: "absolute", inset: 0, backgroundColor: hexToRgba(c.overlay.hex, c.overlay.opacity) }} /> : null}
        <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
          transform: "scale(" + (c.textScale / 100) + ")", transformOrigin: "center center" }}>
          <AutoRenderer creative={c} />
        </div>
      </div>
      <div style={{
        position: "absolute", bottom: "3px", left: "50%", transform: "translateX(-50%)",
        background: isActive ? C.accent : "rgba(0,0,0,0.7)",
        color: "#fff", fontSize: "10px", fontWeight: 700, padding: "1px 6px",
        borderRadius: "4px", fontFamily: "system-ui",
      }}>{idx + 1}</div>
    </div>
  );
}

// ━━━ STEP 1: IMPORT PANEL ━━━
function ImportPanel(props) {
  var creatives = props.creatives;
  var setCreatives = props.setCreatives;
  var setActiveId = props.setActiveId;
  var setStep = props.setStep;
  var fileRef = useRef(null);
  var bulkTextRef = useRef("");
  var _ft = useState(""); var bulkText = _ft[0]; var setBulkText = _ft[1];
  var _sb = useState(false); var showBulk = _sb[0]; var setShowBulk = _sb[1];
  var _ak = useState(function() { return localStorage.getItem("openai_key") || ""; }); var apiKey = _ak[0]; var setApiKey = _ak[1];
  var _pr = useState(""); var prompt = _pr[0]; var setPrompt = _pr[1];
  var _al = useState(false); var aiLoading = _al[0]; var setAiLoading = _al[1];
  var _ac = useState(5); var aiCount = _ac[0]; var setAiCount = _ac[1];
  var _sk = useState(false); var showKey = _sk[0]; var setShowKey = _sk[1];

  useEffect(function() { if (apiKey) localStorage.setItem("openai_key", apiKey); }, [apiKey]);

  var addFromTemplate = function(ex) {
    var c = createCreative({ text: ex.text, color: ex.color });
    setCreatives(function(prev) { return prev.concat([c]); });
    setActiveId(c.id);
  };

  var addBulk = function() {
    var parts = bulkText.split("---").map(function(p) { return p.trim(); }).filter(Boolean);
    var newC = parts.map(function(text) { return createCreative({ text: text }); });
    setCreatives(function(prev) { return prev.concat(newC); });
    if (newC.length > 0) setActiveId(newC[0].id);
    setBulkText(""); setShowBulk(false);
  };

  var handleFiles = function(e) {
    var files = Array.from(e.target.files);
    files.forEach(function(f) {
      var isVideo = f.type.startsWith("video/");
      var r = new FileReader();
      r.onload = function(ev) {
        var c = createCreative({ bgImage: ev.target.result, bgIsVideo: isVideo });
        setCreatives(function(prev) { return prev.concat([c]); });
        setActiveId(c.id);
      };
      r.readAsDataURL(f);
    });
  };

  var handleAiGenerate = function() {
    if (!apiKey.trim() || !prompt.trim()) return;
    setAiLoading(true);
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey.trim() },
      body: JSON.stringify({
        model: "gpt-4o-mini", temperature: 0.8, max_tokens: 2000,
        messages: [
          { role: "system", content: AI_SYSTEM_PROMPT + " Generiere genau " + aiCount + " verschiedene Posts. Trenne sie mit --- auf einer eigenen Zeile." },
          { role: "user", content: prompt },
        ],
      }),
    }).then(function(res) { return res.json(); })
    .then(function(data) {
      var generated = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (generated) {
        var parts = generated.trim().split("---").map(function(p) { return p.trim(); }).filter(Boolean);
        var colorKeys = Object.keys(COLOR_PRESETS);
        var newC = parts.map(function(text) { return createCreative({ text: text, color: pickRandom(colorKeys) }); });
        setCreatives(function(prev) { return prev.concat(newC); });
        if (newC.length > 0) setActiveId(newC[0].id);
      }
    }).catch(function(e) { alert("KI-Fehler: " + e.message); })
    .finally(function() { setAiLoading(false); });
  };

  var addEmpty = function() {
    var c = createCreative({ text: "Neuer Titel\nUntertitel\nLabel: Wert" });
    setCreatives(function(prev) { return prev.concat([c]); });
    setActiveId(c.id);
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ color: "#fff", fontSize: "22px", fontWeight: 700, margin: 0, fontFamily: "system-ui" }}>Creatives importieren</h2>
          <p style={{ color: C.dim, fontSize: "13px", marginTop: "6px", fontFamily: "system-ui" }}>
            Hintergrundbilder/Videos hinzufuegen, Vorlagen nutzen oder mit KI generieren
          </p>
        </div>

        <div style={Object.assign({}, sec, { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px" })}>
          <span style={{ color: C.accentText, fontSize: "14px", fontWeight: 700, fontFamily: "system-ui" }}>
            {creatives.length} Creative{creatives.length !== 1 ? "s" : ""} geladen
          </span>
          {creatives.length > 0 ? (
            <button onClick={function() { setStep("edit"); }} style={{
              padding: "8px 20px", fontSize: "12px", fontWeight: 700,
              background: "linear-gradient(135deg, " + C.accent + ", #4F46E5)",
              border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer", fontFamily: "system-ui",
            }}>Weiter zum Bearbeiten</button>
          ) : null}
        </div>

        <div style={Object.assign({}, sec, { padding: "20px", textAlign: "center", border: "2px dashed " + C.border })}>
          <input ref={fileRef} type="file" accept="image/*,video/mp4" multiple onChange={handleFiles} style={{ display: "none" }} />
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>Upload</div>
          <div style={{ color: C.dim, fontSize: "13px", marginBottom: "12px", fontFamily: "system-ui" }}>
            Bilder und Videos hochladen (mehrere gleichzeitig)
          </div>
          <button onClick={function() { fileRef.current && fileRef.current.click(); }} style={Object.assign({}, abtn, { padding: "10px 24px", fontSize: "13px", fontWeight: 600 })}>
            Dateien auswaehlen
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          <div style={Object.assign({}, sec, { padding: "14px" })}>
            <div style={Object.assign({}, lab, { marginBottom: "8px" })}><span>Vorlagen</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxHeight: "200px", overflowY: "auto" }}>
              {EXAMPLES.map(function(ex, i) {
                return (
                  <button key={i} onClick={function() { addFromTemplate(ex); }} style={{
                    padding: "5px 8px", fontSize: "11px", fontFamily: "system-ui",
                    background: C.card, border: "1px solid " + C.border,
                    borderRadius: "5px", color: C.dim, cursor: "pointer",
                  }}>{ex.name}</button>
                );
              })}
            </div>
            <button onClick={addEmpty} style={Object.assign({}, abtn, { width: "100%", marginTop: "8px" })}>+ Leeres Creative</button>
          </div>

          <div style={Object.assign({}, sec, { padding: "14px", border: "1px solid rgba(108,99,255,0.2)", background: "rgba(108,99,255,0.03)" })}>
            <div style={Object.assign({}, lab, { marginBottom: "8px" })}><span>KI Bulk-Generator</span></div>
            {!showKey ? (
              <button onClick={function() { setShowKey(true); }} style={Object.assign({}, abtn, { width: "100%", marginBottom: "8px" })}>API Key eingeben</button>
            ) : (
              <input type="password" value={apiKey} onChange={function(e) { setApiKey(e.target.value); }} placeholder="sk-..."
                style={{ width: "100%", padding: "6px 8px", fontSize: "11px", fontFamily: "monospace",
                  background: "rgba(255,255,255,0.04)", border: "1px solid " + C.border,
                  borderRadius: "5px", color: "#fff", outline: "none", boxSizing: "border-box", marginBottom: "8px" }} />
            )}
            <textarea value={prompt} onChange={function(e) { setPrompt(e.target.value); }}
              placeholder="z.B. Erstelle Posts ueber Steuer-Tipps und Immobilien"
              style={{ width: "100%", minHeight: "70px", padding: "8px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(108,99,255,0.15)", borderRadius: "6px", color: "#fff",
                fontSize: "12px", fontFamily: "system-ui", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" }}>
              <span style={{ color: C.dim, fontSize: "11px", fontFamily: "system-ui" }}>Anzahl:</span>
              <select value={aiCount} onChange={function(e) { setAiCount(Number(e.target.value)); }}
                style={{ padding: "4px 8px", fontSize: "11px", background: "rgba(255,255,255,0.05)", color: "#fff",
                  border: "1px solid " + C.border, borderRadius: "4px", outline: "none" }}>
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={8}>8</option>
                <option value={10}>10</option>
              </select>
              <button onClick={handleAiGenerate} disabled={aiLoading} style={Object.assign({}, abtn, {
                flex: 1, fontWeight: 600,
                background: aiLoading ? "rgba(108,99,255,0.1)" : "linear-gradient(135deg, rgba(108,99,255,0.8), rgba(79,70,229,0.9))",
                color: "#fff", opacity: aiLoading ? 0.7 : 1,
              })}>
                {aiLoading ? "Generiere..." : aiCount + "x generieren"}
              </button>
            </div>
          </div>
        </div>

        <div style={sec}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: C.dim, fontSize: "10px", fontFamily: "monospace", textTransform: "uppercase" }}>Text Bulk-Import</span>
            <button onClick={function() { setShowBulk(!showBulk); }} style={Object.assign({}, abtn, { fontSize: "9px", padding: "3px 8px" })}>
              {showBulk ? "Schliessen" : "Oeffnen"}
            </button>
          </div>
          {showBulk ? (
            <div style={{ marginTop: "8px" }}>
              <textarea value={bulkText} onChange={function(e) { setBulkText(e.target.value); }}
                placeholder="Mehrere Posts einfuegen, getrennt durch ---"
                style={{ width: "100%", minHeight: "120px", padding: "10px", background: "rgba(255,255,255,0.04)",
                  border: "1px solid " + C.border, borderRadius: "6px", color: "#fff",
                  fontSize: "11px", fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              <button onClick={addBulk} style={Object.assign({}, abtn, { width: "100%", marginTop: "6px", fontWeight: 600 })}>
                Alle importieren
              </button>
            </div>
          ) : null}
        </div>

        {creatives.length > 0 ? (
          <div style={sec}>
            <div style={Object.assign({}, lab, { marginBottom: "10px" })}><span>Geladene Creatives</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {creatives.map(function(c, i) {
                return (
                  <div key={c.id} style={{
                    width: "80px", height: "142px", borderRadius: "6px", overflow: "hidden",
                    border: "1px solid " + C.border, position: "relative", flexShrink: 0,
                  }}>
                    <div style={{ transform: "scale(0.074)", transformOrigin: "top left", width: "1080px", height: "1920px",
                      background: c.bgImage ? "transparent" : "#000", position: "relative" }}>
                      {c.bgImage && !c.bgIsVideo ? <img src={c.bgImage} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : null}
                      {c.overlay.enabled ? <div style={{ position: "absolute", inset: 0, backgroundColor: hexToRgba(c.overlay.hex, c.overlay.opacity) }} /> : null}
                      <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
                        transform: "scale(" + (c.textScale / 100) + ")", transformOrigin: "center center" }}>
                        <AutoRenderer creative={c} />
                      </div>
                    </div>
                    <div style={{ position: "absolute", top: "3px", left: "3px", background: "rgba(0,0,0,0.7)",
                      color: "#fff", fontSize: "9px", padding: "1px 4px", borderRadius: "3px", fontWeight: 700 }}>{i + 1}</div>
                    <button onClick={function() { var id = c.id; setCreatives(function(prev) { return prev.filter(function(x) { return x.id !== id; }); }); }} style={{
                      position: "absolute", top: "2px", right: "2px", background: "rgba(229,9,20,0.8)",
                      color: "#fff", border: "none", borderRadius: "50%", width: "16px", height: "16px",
                      fontSize: "9px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>x</button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ━━━ STEP 2: EDIT PANEL ━━━
function EditPanel(props) {
  var creatives = props.creatives;
  var setCreatives = props.setCreatives;
  var activeId = props.activeId;
  var setActiveId = props.setActiveId;
  var setStep = props.setStep;
  var active = creatives.find(function(c) { return c.id === activeId; }) || creatives[0];
  var activeIndex = creatives.findIndex(function(c) { return c.id === activeId; });
  var fileRef = useRef(null);
  var exportRef = useRef(null);

  var updateActive = function(updates) {
    setCreatives(function(prev) {
      return prev.map(function(c) { return c.id === active.id ? Object.assign({}, c, updates) : c; });
    });
  };

  var applyToAll = function(field) {
    var val = active[field];
    setCreatives(function(prev) {
      return prev.map(function(c) { var u = {}; u[field] = val; return Object.assign({}, c, u); });
    });
  };

  var goNext = function() {
    var idx = creatives.findIndex(function(c) { return c.id === activeId; });
    if (idx < creatives.length - 1) setActiveId(creatives[idx + 1].id);
  };
  var goPrev = function() {
    var idx = creatives.findIndex(function(c) { return c.id === activeId; });
    if (idx > 0) setActiveId(creatives[idx - 1].id);
  };

  useEffect(function() {
    var handler = function(e) {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", handler);
    return function() { window.removeEventListener("keydown", handler); };
  });

  if (!active) return <div style={{ color: "#fff", padding: "40px", textAlign: "center" }}>Keine Creatives geladen.</div>;

  var parsed = parseInput(active.inputText);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", borderBottom: "1px solid " + C.border,
        background: "rgba(13,15,20,0.95)", zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={goPrev} disabled={activeIndex === 0}
            style={Object.assign({}, abtn, { fontSize: "16px", padding: "4px 12px", opacity: activeIndex === 0 ? 0.3 : 1 })}>&#9664;</button>
          <span style={{ color: C.accentText, fontSize: "14px", fontWeight: 700, fontFamily: "system-ui" }}>
            Creative {activeIndex + 1} / {creatives.length}
          </span>
          <button onClick={goNext} disabled={activeIndex === creatives.length - 1}
            style={Object.assign({}, abtn, { fontSize: "16px", padding: "4px 12px", opacity: activeIndex === creatives.length - 1 ? 0.3 : 1 })}>&#9654;</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: C.muted, fontSize: "10px", fontFamily: "monospace" }}>Pfeiltasten zum Navigieren</span>
          <button onClick={function() { setStep("export"); }} style={{
            padding: "8px 20px", fontSize: "12px", fontWeight: 700,
            background: "linear-gradient(135deg, " + C.success + ", #16a34a)",
            border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer", fontFamily: "system-ui",
          }}>Weiter zum Export</button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{
          width: "300px", flexShrink: 0, overflowY: "auto", padding: "12px",
          borderRight: "1px solid " + C.border, background: C.panel,
        }}>
          <div style={sec}>
            <div style={Object.assign({}, lab, { marginBottom: "6px" })}><span>Text</span></div>
            <textarea value={active.inputText}
              onChange={function(e) { updateActive({ inputText: e.target.value }); }}
              style={{ width: "100%", minHeight: "140px", padding: "8px", background: "rgba(255,255,255,0.04)",
                border: "1px solid " + C.border, borderRadius: "6px", color: "#fff",
                fontSize: "11px", fontFamily: "'SF Mono',monospace", lineHeight: 1.6,
                outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ fontSize: "9px", color: C.muted, marginTop: "4px", fontFamily: "monospace" }}>
              {parsed.type === "compare" ? "Vergleich (" + parsed.rows.length + " Zeilen)" : "Liste (" + parsed.rows.length + " Eintraege)"}
            </div>
          </div>

          <div style={sec}>
            <div style={Object.assign({}, lab, { marginBottom: "6px" })}>
              <span>Farben</span>
              <button onClick={function() { applyToAll("colorPreset"); }} style={Object.assign({}, abtn, { fontSize: "8px", padding: "2px 6px" })}>Auf alle</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
              {Object.entries(COLOR_PRESETS).map(function(entry) {
                var k = entry[0]; var v = entry[1];
                return (
                  <button key={k} onClick={function() { updateActive({ colorPreset: k }); }} style={{
                    padding: "3px 6px", fontSize: "9px",
                    background: active.colorPreset === k ? C.accentBg : "transparent",
                    border: "1px solid " + (active.colorPreset === k ? C.accent : C.border),
                    borderRadius: "4px", cursor: "pointer", fontFamily: "system-ui",
                    color: active.colorPreset === k ? C.accentText : C.dim,
                    display: "flex", alignItems: "center", gap: "3px",
                  }}>
                    <div style={{ display: "flex", gap: "1px" }}>
                      <div style={{ width: "7px", height: "7px", borderRadius: "2px", background: v.colA }} />
                      <div style={{ width: "7px", height: "7px", borderRadius: "2px", background: v.colB }} />
                    </div>
                    {v.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={sec}>
            <div style={lab}><span>Textgroesse</span><span>{active.textScale}%</span></div>
            <input type="range" min="40" max="150" value={active.textScale}
              onChange={function(e) { updateActive({ textScale: Number(e.target.value) }); }} style={rng} />
            <div style={Object.assign({}, lab, { marginTop: "8px" })}><span>Y-Position</span><span>{active.textOffsetY}px</span></div>
            <input type="range" min={-400} max={400} value={active.textOffsetY}
              onChange={function(e) { updateActive({ textOffsetY: Number(e.target.value) }); }} style={rng} />
            <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
              <button onClick={function() { applyToAll("textScale"); }} style={Object.assign({}, abtn, { fontSize: "8px", padding: "2px 6px", flex: 1 })}>Groesse auf alle</button>
              <button onClick={function() { applyToAll("textOffsetY"); }} style={Object.assign({}, abtn, { fontSize: "8px", padding: "2px 6px", flex: 1 })}>Position auf alle</button>
            </div>
          </div>

          <div style={sec}>
            <div style={Object.assign({}, lab, { marginBottom: "6px" })}>
              <span>Hintergrund</span>
              <button onClick={function() { applyToAll("bgImage"); }} style={Object.assign({}, abtn, { fontSize: "8px", padding: "2px 6px" })}>Auf alle</button>
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/mp4" onChange={function(e) {
              var f = e.target.files && e.target.files[0]; if (!f) return;
              var isVideo = f.type.startsWith("video/");
              var r = new FileReader();
              r.onload = function(ev) { updateActive({ bgImage: ev.target.result, bgIsVideo: isVideo }); };
              r.readAsDataURL(f);
            }} style={{ display: "none" }} />
            <div style={{ display: "flex", gap: "4px" }}>
              <button onClick={function() { fileRef.current && fileRef.current.click(); }} style={abtn}>
                {active.bgImage ? "Aendern" : "Upload"}
              </button>
              {active.bgImage ? <button onClick={function() { updateActive({ bgImage: null, bgIsVideo: false }); }}
                style={Object.assign({}, abtn, { color: "#FF6B6B", borderColor: "rgba(229,9,20,0.2)" })}>x</button> : null}
            </div>
          </div>

          <div style={sec}>
            <div style={Object.assign({}, lab, { marginBottom: "6px" })}>
              <span>Overlay</span>
              <input type="checkbox" checked={active.overlay.enabled}
                onChange={function() { updateActive({ overlay: Object.assign({}, active.overlay, { enabled: !active.overlay.enabled }) }); }}
                style={{ accentColor: C.accent }} />
            </div>
            {active.overlay.enabled ? (
              <div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input type="color" value={active.overlay.hex}
                    onChange={function(e) { updateActive({ overlay: Object.assign({}, active.overlay, { hex: e.target.value }) }); }}
                    style={{ width: "26px", height: "22px", border: "none", borderRadius: "4px", cursor: "pointer", background: "transparent", padding: 0 }} />
                  <span style={{ fontSize: "10px", color: C.muted, fontFamily: "monospace" }}>
                    {active.overlay.hex} {active.overlay.opacity}%
                  </span>
                </div>
                <input type="range" min="0" max="100" value={active.overlay.opacity}
                  onChange={function(e) { updateActive({ overlay: Object.assign({}, active.overlay, { opacity: Number(e.target.value) }) }); }}
                  style={Object.assign({}, rng, { marginTop: "4px" })} />
                <button onClick={function() { applyToAll("overlay"); }} style={Object.assign({}, abtn, { fontSize: "8px", padding: "2px 6px", marginTop: "4px" })}>Auf alle</button>
              </div>
            ) : null}
          </div>

          <div style={sec}>
            <div style={lab}>
              <span>Box-Hintergruende</span>
              <input type="checkbox" checked={active.showBoxBackgrounds}
                onChange={function() { updateActive({ showBoxBackgrounds: !active.showBoxBackgrounds }); }}
                style={{ accentColor: C.accent }} />
            </div>
          </div>
        </div>

        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          background: "radial-gradient(ellipse at center, #1a1e2e 0%, #0f1119 70%)",
          overflow: "hidden",
        }}>
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", overflow: "auto", padding: "16px" }}>
            <div style={{
              width: 1080 * 0.38, height: 1920 * 0.38, flexShrink: 0,
              boxShadow: "0 16px 100px rgba(0,0,0,0.6)", borderRadius: "16px", overflow: "hidden",
            }}>
              <CanvasView creative={active} scale={0.38} exportRef={exportRef} />
            </div>
          </div>

          <div style={{
            display: "flex", gap: "8px", padding: "12px 16px",
            overflowX: "auto", overflowY: "hidden",
            borderTop: "1px solid " + C.border,
            background: "rgba(13,15,20,0.95)",
            minHeight: "160px",
          }}>
            {creatives.map(function(c, i) {
              return <Thumb key={c.id} creative={c} isActive={c.id === activeId} idx={i}
                onClick={function() { setActiveId(c.id); }} />;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ━━━ STEP 3: EXPORT PANEL ━━━
function ExportPanel(props) {
  var creatives = props.creatives;
  var setCreatives = props.setCreatives;
  var setStep = props.setStep;
  var setActiveId = props.setActiveId;
  var _ex = useState(false); var exporting = _ex[0]; var setExporting = _ex[1];
  var _4k = useState(false); var use4KExport = _4k[0]; var setUse4KExport = _4k[1];
  var _pr = useState({ current: 0, total: 0, status: "" }); var progress = _pr[0]; var setProgress = _pr[1];
  var exportRefs = useRef({});

  var toggleSelect = function(id) {
    setCreatives(function(prev) {
      return prev.map(function(c) { return c.id === id ? Object.assign({}, c, { selected: !c.selected }) : c; });
    });
  };
  var selectAll = function() { setCreatives(function(prev) { return prev.map(function(c) { return Object.assign({}, c, { selected: true }); }); }); };
  var deselectAll = function() { setCreatives(function(prev) { return prev.map(function(c) { return Object.assign({}, c, { selected: false }); }); }); };

  var selectedCount = creatives.filter(function(c) { return c.selected; }).length;

  var exportSinglePNG = function(creative, idx) {
    return new Promise(function(resolve) {
      var el = exportRefs.current[creative.id];
      if (!el) { resolve(); return; }

      var doExport = function() {
        window.html2canvas(el, { scale: use4KExport ? (3840 / (el.offsetHeight || el.getBoundingClientRect().height)) : 1, useCORS: true, allowTaint: true, backgroundColor: null }).then(function(canvas) {
          var link = document.createElement("a");
          var title = parseInput(creative.inputText).title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
          link.download = "reel-" + String(idx + 1).padStart(2, "0") + "-" + title + ".png";
          link.href = canvas.toDataURL("image/png");
          link.click();
          setTimeout(resolve, 400);
        });
      };

      if (!window.html2canvas) {
        var s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        s.onload = doExport;
        document.head.appendChild(s);
      } else {
        doExport();
      }
    });
  };

  var handleBulkExport = function() {
    var selected = creatives.filter(function(c) { return c.selected; });
    if (selected.length === 0) return;
    setExporting(true);
    setProgress({ current: 0, total: selected.length, status: "Starte Export..." });

    var exportNext = function(i) {
      if (i >= selected.length) {
        setProgress({ current: selected.length, total: selected.length, status: "Fertig!" });
        setTimeout(function() { setExporting(false); }, 1500);
        return;
      }
      setProgress({ current: i + 1, total: selected.length, status: "Exportiere " + (i + 1) + "/" + selected.length + "..." });
      exportSinglePNG(selected[i], creatives.indexOf(selected[i])).then(function() {
        exportNext(i + 1);
      });
    };
    exportNext(0);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px", borderBottom: "1px solid " + C.border,
        background: "rgba(13,15,20,0.95)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: 700, margin: 0, fontFamily: "system-ui" }}>
            Bulk Export
          </h3>
          <span style={{ color: C.accentText, fontSize: "12px", fontFamily: "system-ui" }}>
            {selectedCount} von {creatives.length} ausgewaehlt
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button onClick={selectAll} style={abtn}>Alle</button>
          <button onClick={deselectAll} style={abtn}>Keine</button>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={use4KExport} onChange={function(e) { setUse4KExport(e.target.checked); }} style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#6c63ff" }} />
            <span style={{ color: use4KExport ? "#6c63ff" : "#aaa", fontSize: "12px", fontWeight: 600, fontFamily: "system-ui", whiteSpace: "nowrap" }}>2160×3840 (4K)</span>
          </label>
          <button onClick={handleBulkExport} disabled={exporting || selectedCount === 0} style={{
            padding: "10px 28px", fontSize: "13px", fontWeight: 700,
            background: exporting ? "#333" : "linear-gradient(135deg, " + C.success + ", #16a34a)",
            border: "none", borderRadius: "8px", color: "#fff", cursor: exporting ? "wait" : "pointer",
            fontFamily: "system-ui", opacity: selectedCount === 0 ? 0.4 : 1,
          }}>
            {exporting ? progress.status : selectedCount + " PNGs exportieren"}
          </button>
        </div>
      </div>

      {exporting ? (
        <div style={{ padding: "0 20px", background: C.panel }}>
          <div style={{ height: "4px", borderRadius: "2px", background: C.card, marginTop: "8px", marginBottom: "8px" }}>
            <div style={{
              height: "100%", borderRadius: "2px",
              background: "linear-gradient(90deg, " + C.accent + ", " + C.success + ")",
              width: (progress.total > 0 ? (progress.current / progress.total) * 100 : 0) + "%",
              transition: "width 0.3s",
            }} />
          </div>
        </div>
      ) : null}

      <div style={{
        flex: 1, overflowY: "auto", padding: "20px",
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: "16px", alignContent: "start",
      }}>
        {creatives.map(function(c, i) {
          return (
            <div key={c.id} style={{
              position: "relative", borderRadius: "12px", overflow: "hidden",
              border: c.selected ? "3px solid " + C.success : "2px solid " + C.border,
              background: C.card, cursor: "pointer",
            }}>
              <div style={{
                position: "absolute", top: "8px", left: "8px", zIndex: 10,
                display: "flex", alignItems: "center", gap: "6px",
              }}>
                <input type="checkbox" checked={c.selected}
                  onChange={function() { toggleSelect(c.id); }}
                  style={{ accentColor: C.success, width: "16px", height: "16px", cursor: "pointer" }} />
                <span style={{
                  background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: "10px",
                  fontWeight: 700, padding: "2px 6px", borderRadius: "4px",
                }}>{i + 1}</span>
              </div>

              <button onClick={function() { setActiveId(c.id); setStep("edit"); }} style={{
                position: "absolute", top: "8px", right: "8px", zIndex: 10,
                background: "rgba(108,99,255,0.8)", color: "#fff", border: "none",
                borderRadius: "6px", padding: "3px 8px", fontSize: "9px", fontWeight: 600,
                cursor: "pointer", fontFamily: "system-ui",
              }}>Edit</button>

              <div style={{ width: "100%", aspectRatio: "9/16", overflow: "hidden", position: "relative" }}
                onClick={function() { toggleSelect(c.id); }}>
                <div
                  ref={function(el) { if (el) exportRefs.current[c.id] = el; }}
                  style={{
                    transform: "scale(0.148)", transformOrigin: "top left",
                    width: "1080px", height: "1920px",
                    background: c.bgImage ? "transparent" : "#000", position: "absolute", top: 0, left: 0,
                  }}>
                  {c.bgImage && !c.bgIsVideo ? <img src={c.bgImage} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : null}
                  {c.bgImage && c.bgIsVideo ? <video src={c.bgImage} muted loop autoPlay playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                  {c.overlay.enabled ? <div style={{ position: "absolute", inset: 0, zIndex: 1, backgroundColor: hexToRgba(c.overlay.hex, c.overlay.opacity) }} /> : null}
                  <div style={{
                    position: "relative", zIndex: 2, width: "100%", height: "100%",
                    display: "flex", flexDirection: "column", justifyContent: "center",
                    transform: "scale(" + (c.textScale / 100) + ") translateY(" + c.textOffsetY + "px)",
                    transformOrigin: "center center",
                  }}>
                    <AutoRenderer creative={c} />
                  </div>
                </div>
              </div>

              <div style={{ padding: "8px 10px", borderTop: "1px solid " + C.border }}>
                <div style={{
                  fontSize: "10px", fontWeight: 600, color: c.selected ? C.success : C.dim,
                  fontFamily: "system-ui", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {c.selected ? ">> " : ""}{parseInput(c.inputText).title}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ━━━ MAIN APP ━━━
export default function App() {
  var _st = useState("import"); var step = _st[0]; var setStep = _st[1];
  var _cr = useState([]); var creatives = _cr[0]; var setCreatives = _cr[1];
  var _ai = useState(null); var activeId = _ai[0]; var setActiveId = _ai[1];

  useEffect(function() {
    if (!activeId && creatives.length > 0) setActiveId(creatives[0].id);
  }, [creatives, activeId]);

  var steps = [
    { key: "import", label: "Import", num: "1" },
    { key: "edit", label: "Bearbeiten", num: "2" },
    { key: "export", label: "Export", num: "3" },
  ];

  var currentStepIndex = steps.findIndex(function(s) { return s.key === step; });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: C.bg }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", height: "48px", flexShrink: 0,
        background: C.panel, borderBottom: "1px solid " + C.border,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px", fontWeight: 800, color: "#fff", fontFamily: "system-ui", letterSpacing: "-0.5px" }}>
            Reel Producer
          </span>
          <span style={{ fontSize: "10px", color: C.accentText, fontFamily: "monospace", background: C.accentBg,
            padding: "2px 8px", borderRadius: "4px" }}>BULK MODE</span>
        </div>

        <div style={{ display: "flex", gap: "4px" }}>
          {steps.map(function(s, i) {
            var isActive = step === s.key;
            var isCompleted = currentStepIndex > i;
            var isDisabled = (s.key === "edit" || s.key === "export") && creatives.length === 0;
            return (
              <button key={s.key} onClick={function() { if (!isDisabled) setStep(s.key); }}
                disabled={isDisabled}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "6px 16px", fontSize: "12px", fontWeight: isActive ? 700 : 500,
                  background: isActive ? C.accentBg : "transparent",
                  border: "1px solid " + (isActive ? C.accent : isDisabled ? "transparent" : C.border),
                  borderRadius: "8px", cursor: isDisabled ? "not-allowed" : "pointer",
                  fontFamily: "system-ui",
                  color: isActive ? C.accentText : isDisabled ? "rgba(255,255,255,0.15)" : C.dim,
                  opacity: isDisabled ? 0.5 : 1,
                }}>
                <span style={{
                  width: "20px", height: "20px", borderRadius: "50%", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700,
                  background: isActive ? C.accent : isCompleted ? C.success : "rgba(255,255,255,0.05)",
                  color: (isActive || isCompleted) ? "#fff" : C.dim,
                }}>{isCompleted ? "V" : s.num}</span>
                {s.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: C.dim, fontFamily: "system-ui" }}>
            {creatives.length} Creative{creatives.length !== 1 ? "s" : ""}
          </span>
          {creatives.length > 0 ? (
            <button onClick={function() { setCreatives([]); setActiveId(null); setStep("import"); }}
              style={Object.assign({}, abtn, { fontSize: "9px", padding: "3px 8px", color: "#FF6B6B", borderColor: "rgba(229,9,20,0.2)" })}>
              Reset
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        {step === "import" ? (
          <ImportPanel creatives={creatives} setCreatives={setCreatives}
            setActiveId={setActiveId} setStep={setStep} />
        ) : null}
        {step === "edit" ? (
          <EditPanel creatives={creatives} setCreatives={setCreatives}
            activeId={activeId} setActiveId={setActiveId} setStep={setStep} />
        ) : null}
        {step === "export" ? (
          <ExportPanel creatives={creatives} setCreatives={setCreatives}
            setStep={setStep} activeId={activeId} setActiveId={setActiveId} />
        ) : null}
      </div>
    </div>
  );
}
