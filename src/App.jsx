import { useState, useRef, useCallback, useEffect } from "react";

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
  var _prov = useState("openai");
  var selectedProvider = _prov[0]; var setSelectedProvider = _prov[1];
  var _mod = useState("gpt-4o-mini");
  var selectedModel = _mod[0]; var setSelectedModel = _mod[1];
  var _ak = useState(function() { return localStorage.getItem("openai_key") || ""; }); var apiKey = _ak[0]; var setApiKey = _ak[1];
  var _ak2 = useState(function() { return localStorage.getItem("anthropic_key") || ""; });
  var anthropicKey = _ak2[0]; var setAnthropicKey = _ak2[1];
  var _ak3 = useState(function() { return localStorage.getItem("gemini_key") || ""; });
  var geminiKey = _ak3[0]; var setGeminiKey = _ak3[1];
  var _pr = useState(""); var prompt = _pr[0]; var setPrompt = _pr[1];
  var _al = useState(false); var aiLoading = _al[0]; var setAiLoading = _al[1];
  var _ac = useState(5); var aiCount = _ac[0]; var setAiCount = _ac[1];
  var _sk = useState(false); var showKey = _sk[0]; var setShowKey = _sk[1];
  var _pt = useState("video"); var projectType = _pt[0]; var setProjectType = _pt[1];
  var _toc = useState(50); var toCount = _toc[0]; var setToCount = _toc[1];
  var _tot = useState(""); var toTopics = _tot[0]; var setToTopics = _tot[1];
  var _tos = useState(""); var toStyle = _tos[0]; var setToStyle = _tos[1];
  var _ton = useState(""); var toTone = _ton[0]; var setToTone = _ton[1];
  var _top = useState(false); var toProgress = _top[0]; var setToProgress = _top[1];
  var _tod = useState({ done: 0, total: 0 }); var toBatchState = _tod[0]; var setToBatchState = _tod[1];

  useEffect(function() { if (apiKey) localStorage.setItem("openai_key", apiKey); }, [apiKey]);
  useEffect(function() { if (anthropicKey) localStorage.setItem("anthropic_key", anthropicKey); }, [anthropicKey]);
  useEffect(function() { if (geminiKey) localStorage.setItem("gemini_key", geminiKey); }, [geminiKey]);

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
    var activeKey = selectedProvider === "anthropic" ? anthropicKey : selectedProvider === "gemini" ? geminiKey : apiKey;
    if (!activeKey.trim() || !prompt.trim()) return;
    setAiLoading(true);
    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: activeKey.trim(),
        provider: selectedProvider,
        model: selectedModel,
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

    var handleTextOnlyGenerate = function() {
    var activeKey = selectedProvider === "anthropic" ? anthropicKey : selectedProvider === "gemini" ? geminiKey : apiKey;
    if (!activeKey.trim()) { alert("Bitte API-Key eingeben."); return; }
    var total = Math.max(1, Math.min(200, toCount));
    var batchSize = 5;
    var batches = Math.ceil(total / batchSize);
    var allCreated = 0;
    setToProgress(true);
    setToBatchState({ done: 0, total: total });
    var runBatch = function(batchIndex) {
      if (batchIndex >= batches) { setToProgress(false); return; }
      var thisSize = Math.min(batchSize, total - allCreated);
      var topicsHint = toTopics.trim() ? ("Themen (bevorzuge diese): " + toTopics + ". ") : "";
      var styleHint = toStyle.trim() ? ("Stil: " + toStyle + ". ") : "";
      var toneHint = toTone.trim() ? ("Ton: " + toTone + ". ") : "";
      var sysMsg = "Du bist ein Experte fuer inspirierende, motivierende und informative Social-Media-Grafiktexte. Erstelle kurze, kraftvolle Texte fuer Reels und Story-Grafiken. Jede Grafik besteht aus: THEMA: [Thema]\nTITEL: [kurzer Haupttext, max 8 Woerter]\nSUBTITEL: [ergaenzender Satz, max 12 Woerter]\nTrenne die Grafiken mit ---";
      var userMsg = topicsHint + styleHint + toneHint + "Erstelle genau " + thisSize + " verschiedene Text-Grafiken. Variiere die Themen stark.";
      fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: activeKey.trim(),
          provider: selectedProvider,
          model: selectedModel,
          messages: [
            { role: "system", content: sysMsg },
            { role: "user", content: userMsg },
          ],
        }),
      }).then(function(res) { return res.json(); })
      .then(function(data) {
        var generated = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (generated) {
          var parts = generated.trim().split("---").map(function(p) { return p.trim(); }).filter(Boolean);
          var colorKeys = Object.keys(COLOR_PRESETS);
          var newC = parts.map(function(rawText) {
            var tlines = rawText.split("\n").map(function(l) { return l.trim(); }).filter(Boolean);
            var topic = ""; var title = ""; var subtitle = "";
            tlines.forEach(function(l) {
              if (l.startsWith("THEMA:")) topic = l.replace("THEMA:", "").trim();
              else if (l.startsWith("TITEL:")) title = l.replace("TITEL:", "").trim();
              else if (l.startsWith("SUBTITEL:")) subtitle = l.replace("SUBTITEL:", "").trim();
            });
            var combined = (title || tlines[0] || "Text") + (subtitle ? "\n" + subtitle : "") + (topic ? "\n\nThema: " + topic : "");
            return createCreative({ text: combined, color: pickRandom(colorKeys), bgImage: null, bgIsVideo: false });
          });
          setCreatives(function(prev) { return prev.concat(newC); });
          allCreated += newC.length;
          setToBatchState({ done: allCreated, total: total });
          if (newC.length > 0 && batchIndex === 0) setActiveId(newC[0].id);
        }
        runBatch(batchIndex + 1);
      }).catch(function(e) { alert("KI-Fehler: " + e.message); setToProgress(false); });
    };
    runBatch(0);
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

        {/* ━━━ PROJEKT-TYP AUSWAHL ━━━ */}
        <div style={Object.assign({}, sec, { padding: "16px", marginBottom: "16px" })}>
          <div style={Object.assign({}, lab, { marginBottom: "12px" })}><span>Projekt-Typ waehlen</span></div>
          <div style={{ display: "flex", gap: "10px" }}>
            {[
              { id: "video", label: "Video", icon: "🎬", desc: "Hintergrundvideo + Text" },
              { id: "image", label: "Bild + Text", icon: "🖼️", desc: "Bild als Hintergrund" },
              { id: "textonly", label: "Text Only", icon: "✨", desc: "Grafikvorlagen generieren" },
            ].map(function(pt) {
              var active = projectType === pt.id;
              return (
                <button key={pt.id} onClick={function() { setProjectType(pt.id); }} style={{
                  flex: 1, padding: "12px 8px", borderRadius: "8px", cursor: "pointer",
                  border: active ? "2px solid " + C.accent : "1px solid " + C.border,
                  background: active ? C.accentBg : C.card,
                  color: active ? C.accentText : C.dim,
                  fontFamily: "system-ui", textAlign: "center", transition: "all 0.15s",
                }}>
                  <div style={{ fontSize: "22px", marginBottom: "4px" }}>{pt.icon}</div>
                  <div style={{ fontSize: "12px", fontWeight: 700 }}>{pt.label}</div>
                  <div style={{ fontSize: "10px", opacity: 0.7, marginTop: "2px" }}>{pt.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ━━━ TEXT ONLY: GRAFIKGENERATOR ━━━ */}
        {projectType === "textonly" && (
          <div style={Object.assign({}, sec, { padding: "20px", border: "1px solid rgba(108,99,255,0.3)", background: "rgba(108,99,255,0.06)" })}>
            <div style={Object.assign({}, lab, { marginBottom: "14px" })}><span>✨ Text Only Grafikgenerator</span></div>

            {/* Provider + Model + API Key */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{ color: C.dim, fontSize: "11px", fontFamily: "monospace", marginBottom: "6px" }}>KI-ANBIETER</div>
              <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                {Object.entries(AI_PROVIDERS).map(function(entry) {
                  var pk = entry[0]; var pv = entry[1];
                  var active = selectedProvider === pk;
                  return (
                    <button key={pk} onClick={function() {
                      setSelectedProvider(pk);
                      setSelectedModel(pv.models[0]);
                    }} style={{
                      flex: 1, padding: "8px 4px", borderRadius: "6px", cursor: "pointer",
                      border: active ? "2px solid " + C.accent : "1px solid " + C.border,
                      background: active ? C.accentBg : C.card,
                      color: active ? C.accentText : C.dim,
                      fontFamily: "system-ui", fontSize: "11px", fontWeight: active ? 700 : 400, textAlign: "center",
                    }}>
                      <div style={{ fontSize: "16px" }}>{pv.icon}</div>
                      <div>{pv.name}</div>
                    </button>
                  );
                })}
              </div>
              <div style={{ color: C.dim, fontSize: "11px", fontFamily: "monospace", marginBottom: "4px" }}>MODELL</div>
              <select value={selectedModel} onChange={function(e) { setSelectedModel(e.target.value); }} style={{
                width: "100%", padding: "7px 10px", background: "rgba(255,255,255,0.04)",
                border: "1px solid " + C.border, borderRadius: "6px", color: "#fff", fontSize: "12px",
                fontFamily: "monospace", boxSizing: "border-box",
              }}>
                {AI_PROVIDERS[selectedProvider].models.map(function(m) {
                  return <option key={m} value={m}>{m}</option>;
                })}
              </select>
            </div>
            {/* API Key */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{ color: C.dim, fontSize: "11px", fontFamily: "monospace", marginBottom: "4px" }}>{AI_PROVIDERS[selectedProvider].keyLabel}</div>
              <input type="password"
                value={selectedProvider === "anthropic" ? anthropicKey : selectedProvider === "gemini" ? geminiKey : apiKey}
                onChange={function(e) {
                  if (selectedProvider === "anthropic") setAnthropicKey(e.target.value);
                  else if (selectedProvider === "gemini") setGeminiKey(e.target.value);
                  else setApiKey(e.target.value);
                }}
                placeholder={AI_PROVIDERS[selectedProvider].keyPlaceholder}
                style={{
                  width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid " + C.border,
                  borderRadius: "6px", color: "#fff", fontSize: "12px", fontFamily: "monospace", boxSizing: "border-box",
                }} />
            </div>
            {/* Anzahl + Themen Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <div style={{ color: C.dim, fontSize: "11px", fontFamily: "monospace", marginBottom: "4px" }}>ANZAHL DER GRAFIKEN</div>
                <input type="number" min="1" max="200" value={toCount} onChange={function(e) { setToCount(parseInt(e.target.value) || 1); }} style={{
                  width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid " + C.border,
                  borderRadius: "6px", color: "#fff", fontSize: "14px", fontWeight: 700, fontFamily: "monospace", boxSizing: "border-box",
                }} />
              </div>
              <div>
                <div style={{ color: C.dim, fontSize: "11px", fontFamily: "monospace", marginBottom: "4px" }}>THEMEN (optional, kommagetrennt)</div>
                <input type="text" value={toTopics} onChange={function(e) { setToTopics(e.target.value); }} placeholder="Erfolg, Mindset, Business, Finanzen..." style={{
                  width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid " + C.border,
                  borderRadius: "6px", color: "#fff", fontSize: "12px", fontFamily: "system-ui", boxSizing: "border-box",
                }} />
              </div>
            </div>

            {/* Stil + Ton Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div>
                <div style={{ color: C.dim, fontSize: "11px", fontFamily: "monospace", marginBottom: "4px" }}>STIL (optional)</div>
                <input type="text" value={toStyle} onChange={function(e) { setToStyle(e.target.value); }} placeholder="Minimalistisch, Bold, Modern..." style={{
                  width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid " + C.border,
                  borderRadius: "6px", color: "#fff", fontSize: "12px", fontFamily: "system-ui", boxSizing: "border-box",
                }} />
              </div>
              <div>
                <div style={{ color: C.dim, fontSize: "11px", fontFamily: "monospace", marginBottom: "4px" }}>TON (optional)</div>
                <input type="text" value={toTone} onChange={function(e) { setToTone(e.target.value); }} placeholder="Motivierend, Sachlich, Inspirierend..." style={{
                  width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid " + C.border,
                  borderRadius: "6px", color: "#fff", fontSize: "12px", fontFamily: "system-ui", boxSizing: "border-box",
                }} />
              </div>
            </div>

            {/* Progress */}
            {toProgress && (
              <div style={{ marginBottom: "12px", padding: "10px", background: "rgba(108,99,255,0.1)", borderRadius: "6px", border: "1px solid rgba(108,99,255,0.2)" }}>
                <div style={{ color: C.accentText, fontSize: "12px", fontFamily: "monospace", marginBottom: "6px" }}>
                  Generiere... {toBatchState.done}/{toBatchState.total} Grafiken erstellt
                </div>
                <div style={{ height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", background: C.accent, borderRadius: "2px", width: toBatchState.total > 0 ? Math.round((toBatchState.done / toBatchState.total) * 100) + "%" : "0%", transition: "width 0.3s" }} />
                </div>
              </div>
            )}

            {/* Generate Button */}
            <button onClick={handleTextOnlyGenerate} disabled={toProgress} style={{
              width: "100%", padding: "12px", fontSize: "13px", fontWeight: 700,
              background: toProgress ? "rgba(108,99,255,0.3)" : "linear-gradient(135deg, #6C63FF, #A9A3FF)",
              border: "none", borderRadius: "8px", color: "#fff", cursor: toProgress ? "not-allowed" : "pointer",
              fontFamily: "system-ui", letterSpacing: "0.5px",
            }}>
              {toProgress ? ("⏳ Generiere... (" + toBatchState.done + "/" + toBatchState.total + ")") : ("✨ " + toCount + " Grafikvorlagen generieren")}
            </button>

            <div style={{ marginTop: "10px", color: C.muted, fontSize: "10px", fontFamily: "monospace", textAlign: "center" }}>
              Automatische Batch-Generierung • 5 Grafiken pro API-Aufruf • Alle vollst. editierbar
            </div>
          </div>
        )}

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

        {projectType !== "textonly" && (
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
        )}

        {projectType !== "textonly" && (
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
        )}

        {projectType !== "textonly" && (
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
        )}

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
      if (!el) { resolve(null); return; }
      var doExport = function() {
        var videos = el.querySelectorAll('video');
        var videoStyles = [];
        videos.forEach(function(v) {
          videoStyles.push(v.style.visibility);
          v.style.visibility = 'hidden';
        });
        // Fix: temporarily remove CSS transform so html2canvas captures at full resolution
        var savedTransform = el.style.transform;
        var savedTransformOrigin = el.style.transformOrigin;
        el.style.transform = 'none';
        el.style.transformOrigin = 'left top';
        window.html2canvas(el, {
          scale: use4KExport ? (3840 / (el.offsetHeight || el.getBoundingClientRect().height)) : 1,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#000000'
        }).then(function(canvas) {
          el.style.transform = savedTransform;
          el.style.transformOrigin = savedTransformOrigin;
          videos.forEach(function(v, i) { v.style.visibility = videoStyles[i] || ''; });
          var title = parseInput(creative.inputText).title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
          var filename = 'reel-' + String(idx + 1).padStart(2, '0') + '-' + title + '.png';
          canvas.toBlob(function(blob) { resolve({ filename: filename, blob: blob }); }, 'image/png');
        }).catch(function() {
          el.style.transform = savedTransform;
          el.style.transformOrigin = savedTransformOrigin;
          videos.forEach(function(v, i) { v.style.visibility = videoStyles[i] || ''; });
          resolve(null);
        });
      };
      if (!window.html2canvas) {
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = doExport;
        document.head.appendChild(s);
      } else { doExport(); }
    });
  };
  var handleBulkExport = function() {
    var selected = creatives.filter(function(c) { return c.selected; });
    if (selected.length === 0) return;
    setExporting(true);
    setProgress({ current: 0, total: selected.length, status: 'Starte Export...' });
    var loadJSZip = function() {
      return new Promise(function(resolve) {
        if (window.JSZip) { resolve(window.JSZip); return; }
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        s.onload = function() { resolve(window.JSZip); };
        document.head.appendChild(s);
      });
    };
    loadJSZip().then(function(JSZip) {
      var zip = new JSZip();
      var exportNext = function(i) {
        if (i >= selected.length) {
          setProgress({ current: selected.length, total: selected.length, status: 'ZIP wird erstellt...' });
          zip.generateAsync({ type: 'blob' }).then(function(zipBlob) {
            var link = document.createElement('a');
            link.download = 'reel-export-' + Date.now() + '.zip';
            link.href = URL.createObjectURL(zipBlob);
            link.click();
            setTimeout(function() { URL.revokeObjectURL(link.href); }, 10000);
            setProgress({ current: selected.length, total: selected.length, status: 'Fertig! ZIP heruntergeladen.' });
            setTimeout(function() { setExporting(false); }, 2000);
          });
          return;
        }
        setProgress({ current: i + 1, total: selected.length, status: 'Exportiere ' + (i + 1) + '/' + selected.length + '...' });
        exportSinglePNG(selected[i], creatives.indexOf(selected[i])).then(function(result) {
          if (result && result.blob) {
            zip.file(result.filename, result.blob);
          }
          exportNext(i + 1);
        });
      };
      exportNext(0);
    });
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
            {exporting ? progress.status : selectedCount + " PNGs als ZIP"}
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
