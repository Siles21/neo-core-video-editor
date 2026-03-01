import { useState, useRef, useCallback, createContext, useContext, useReducer, useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

// ━━━ UTILS ━━━
function hexToRgba(hex, op) {
  const b = parseInt(hex.slice(1), 16);
  return `rgba(${(b >> 16) & 255},${(b >> 8) & 255},${b & 255},${op / 100})`;
}
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

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
    if (parts.length === 2) {
      colALabel = parts[0].trim();
      colBLabel = parts[1].trim();
      type = "compare";
      startIdx = 2;
    }
  }

  if (type === "list" && lines.length > 1 && !lines[1].includes("|") && !lines[1].includes(":")) {
    subtitle = lines[1];
    startIdx = 2;
  }

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
  { name: "🏢 GmbH vs Einzeluntern.", color: "blau_rot", text: "Rechtsform Vergleich\nGmbH vs Einzelunternehmer\nHaftung: Beschränkt ✅ | Unbeschränkt ❌\nGründungskosten: ~1.000€ | 0€\nSteuerlast: ~30% KSt+GewSt | bis 45% ESt\nBuchhaltung: Doppelt | Einfach\nImage: Professionell | Weniger seriös\nVerkauf möglich: Ja ✅ | Schwierig" },
  { name: "💼 Angestellt vs Selbst.", color: "blau_gelb", text: "Karriere-Entscheidung\nAngestellter vs Selbständiger\nSicherheit: Festgehalt | Schwankend\nEinkommen: Gedeckelt | Unbegrenzt ✅\nUrlaub: 30 Tage | Selbst bestimmen\nRente: Gesetzlich | Selbst vorsorgen\nSteuern: Lohnsteuer | Optimierbar ✅\nFreiheit: Chef bestimmt | Du bestimmst ✅" },
  { name: "🇩🇪🇦🇪 DE vs Dubai", color: "gelb_schwarz", text: "Standort Vergleich\nDeutschland vs Dubai\nEinkommensteuer: bis 45% | 0% ✅\nKörperschaftsteuer: ~30% | 9%\nLebenshaltung: Mittel | Hoch\nWetter: 🌧️ | ☀️ 365 Tage\nBürokratie: Hoch ❌ | Gering ✅\nNetzwerk: Lokal | International ✅" },
  { name: "📊 ETF vs Immobilie", color: "gruen_blau", text: "Rendite Vergleich\nETF-Sparplan vs Immobilie\nEinstieg: Ab 25€/Monat | Ab 20.000€\nRendite: ~7% p.a. | ~4-6% + Miete\nHebel: Kein Hebel | Fremdkapital ✅\nSteuer: 26,4% Abgeltung | AfA optimierbar ✅\nAufwand: Passiv ✅ | Aktiv (Verwaltung)\nInflationsschutz: Indirekt | Direkt ✅" },
  { name: "🏦 Festgeld vs Aktien", color: "schwarz_weiss", text: "Wo parke ich 50.000€?\nFestgeld vs Aktien\nRendite 2025: ~3% | ~8-12%\nRisiko: Kein Verlust | Schwankungen\nLiquidität: Gebunden | Jederzeit\nInflationsschutz: Nein ❌ | Ja ✅\nSteuer: Abgeltung | Abgeltung\nFazit: Sicher, verliert real | Chancen + Risiken" },
  { name: "💰 Investment Start", color: "schwarz_weiss", text: "01.01.2025\nWenn du 10.000€ investiert hättest\n🥇 Gold: 10.000€\n📈 S&P 500: 10.000€\n🏦 Commerzbank: 10.000€\n📕 Sparbuch: 10.000€\n🎯 NVIDIA: 10.000€" },
  { name: "📊 Investment Ergebnis", color: "gelb_rot", text: "2026\nWenn meine Eltern 100€/Monat investiert hätten\n🪙 Silber: 112.600€\n📕 Sparbuch: 34.900€\n📱 Nokia: 23.800€\n📈 S&P 500: 116.800€\n🎯 NVIDIA: 2,55 Mio.€" },
  { name: "💎 Vermögen Alter", color: "rot_weiss", text: "Vermögen in 🇩🇪\nTop 10% deiner Altersklasse?\n18 J.: 25.000€\n25 J.: 80.000€\n30 J.: 160.000€\n35 J.: 260.000€\n40 J.: 350.000€\n50 J.: 480.000€\nTop 10% 💸: 550.000€" },
  { name: "🏠 Immobilien Rendite", color: "gelb_schwarz", text: "Mietrendite nach Stadt\nWo lohnt sich der Kauf?\n📍 München: 2,8%\n📍 Berlin: 3,2%\n📍 Hamburg: 3,5%\n📍 Frankfurt: 3,7%\n📍 Düsseldorf: 4,1%\n📍 Leipzig: 5,2%\n📍 Dortmund: 5,8%" },
  { name: "💶 Steuer-Tricks", color: "gruen_rot", text: "5 Steuer-Tricks\nDie 90% der Deutschen nicht kennen\n1️⃣ Arbeitszimmer: bis 1.260€\n2️⃣ Homeoffice-Pauschale: 1.260€\n3️⃣ Handwerkerkosten: 1.200€\n4️⃣ Fahrtkosten: 0,30€/km\n5️⃣ Doppelte Haushaltsführung: 1.000€/Monat" },
  { name: "📉 Fehler Geldanlage", color: "rot_weiss", text: "5 teure Fehler\nDie dich arm halten\n❌ Nur Sparbuch: Inflation frisst Rendite\n❌ Market Timing: Statistisch unmöglich\n❌ Keine Diversifikation: Klumpenrisiko\n❌ Zu hohe Gebühren: -2% p.a. Verlust\n❌ Kein Notgroschen: Panikverkäufe" },
  { name: "🔑 Erste Immobilie", color: "blau_gelb", text: "Deine erste Immobilie\nSchritt für Schritt\n1️⃣ Eigenkapital: Min. 20%\n2️⃣ Bonität: Schufa prüfen\n3️⃣ Finanzierung: Tilgung min. 2%\n4️⃣ Lage: A/B-Standort wählen\n5️⃣ Rendite: Min. 4% Brutto\n6️⃣ Rücklage: 3 Monatsmieten" },
  { name: "🏠 Nebenkosten Kauf", color: "orange_schwarz", text: "Nebenkosten beim Immobilienkauf\nDas vergessen die meisten\n📋 Grunderwerbsteuer: 3,5-6,5%\n📋 Notar: ~1,5%\n📋 Grundbuch: ~0,5%\n📋 Makler: 3-6%\n📋 Sanierung: 10-20%\n💰 Gesamt: bis 35% Nebenkosten!" },
  { name: "📱 Abo-Check", color: "lila_gelb", text: "Deine monatlichen Abos\nWas du wirklich brauchst\n📺 Netflix: 13,99€\n🎵 Spotify: 10,99€\n☁️ iCloud: 2,99€\n📰 News App: 9,99€\n💪 Gym: 29,99€\n📱 Handy: 39,99€\n💸 Gesamt: 107,94€/Monat" },
  { name: "🇩🇪 Steuerlast", color: "rot_weiss", text: "So viel zahlst du wirklich\nSteuerlast in Deutschland\n💰 Brutto: 5.000€\n📉 Lohnsteuer: -850€\n📉 Soli: -47€\n📉 KV: -375€\n📉 RV: -465€\n📉 AV: -65€\n📉 PV: -85€\n✅ Netto: 3.113€" },
  { name: "🏠 Cash-Flow Rechner", color: "gelb_schwarz", text: "Cash-Flow einer Immobilie\nBeispiel: 3-Zimmer Leipzig\n💰 Kaltmiete: 750€\n➖ Hausgeld: -180€\n➖ Rücklage: -50€\n➖ Zinsen: -320€\n➖ Tilgung: -150€\n➖ Steuervorteil: +80€\n✅ Cash-Flow: +130€/Monat" },
];

// ━━━ AI SYSTEM PROMPT ━━━
const AI_SYSTEM_PROMPT = `Du bist ein Assistent für einen Social-Media Reel/Story-Editor für ein deutsches Finanz-Investmentunternehmen (NeoCore Assets).

Der Nutzer gibt dir einen freien Prompt auf Deutsch, und du generierst daraus strukturierten Text in einem spezifischen Format.

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

// ━━━ CONTEXT + REDUCER ━━━
const Ctx = createContext(null);
const useEditor = () => useContext(Ctx);

const startExample = EXAMPLES[0];
const initialState = {
  inputText: startExample.text,
  parsed: parseInput(startExample.text),
  colorPreset: startExample.color,
  bgImage: null,
  overlay: { enabled: true, hex: "#0B1222", opacity: 55 },
  zoom: 0.38,
  textScale: 100,
  textOffsetY: 0,
  animateType: "none", // none, fade, drift, blur
  colorOverrides: {},
  showBoxBackgrounds: true,
  queue: [],
  queueIndex: 0,
  bgIsVideo: false,
};

function reducer(s, a) {
  switch (a.type) {
    case "SET_TEXT": return { ...s, inputText: a.text, parsed: parseInput(a.text) };
    case "SET_COLOR": return { ...s, colorPreset: a.key };
    case "SET_BG": {
      if (a.url && !s.bgImage) {
        const ex = pickRandom(EXAMPLES);
        return { ...s, bgImage: a.url, bgIsVideo: a.isVideo || false, inputText: ex.text, parsed: parseInput(ex.text), colorPreset: ex.color, colorOverrides: {} };
      }
      return { ...s, bgImage: a.url, bgIsVideo: a.isVideo || false };
    }
    case "SET_BG_KEEP": return { ...s, bgImage: a.url, bgIsVideo: false };
    case "SET_OVERLAY": return { ...s, overlay: { ...s.overlay, ...a.p } };
    case "SET_ZOOM": return { ...s, zoom: a.value };
    case "SET_TEXT_SCALE": return { ...s, textScale: a.value };
    case "SET_TEXT_OFFSET_Y": return { ...s, textOffsetY: a.value };
    case "SET_ANIMATE": return { ...s, animateType: a.value };
    case "SET_SHOW_BOX_BACKGROUNDS": return { ...s, showBoxBackgrounds: a.value };
    case "SET_COLOR_OVERRIDE": return { ...s, colorOverrides: { ...s.colorOverrides, [a.index]: a.colors } };
    case "CLEAR_COLOR_OVERRIDE": {
      const copy = { ...s.colorOverrides };
      delete copy[a.index];
      return { ...s, colorOverrides: copy };
    }
    case "LOAD_EXAMPLE": return { ...s, inputText: a.text, parsed: parseInput(a.text), colorPreset: a.color || s.colorPreset, colorOverrides: {}, queue: [], queueIndex: 0 };
    case "RANDOM": {
      const ex = pickRandom(EXAMPLES);
      return { ...s, inputText: ex.text, parsed: parseInput(ex.text), colorPreset: ex.color, colorOverrides: {}, queue: [], queueIndex: 0 };
    }
    case "IMPORT_QUEUE": {
      const parts = a.text.split("---").map(p => p.trim()).filter(Boolean);
      if (parts.length === 0) return s;
      return { ...s, queue: parts, queueIndex: 0, inputText: parts[0], parsed: parseInput(parts[0]), colorOverrides: {} };
    }
    case "LOAD_QUEUE_ITEM": {
      if (a.index < 0 || a.index >= s.queue.length) return s;
      return { ...s, queueIndex: a.index, inputText: s.queue[a.index], parsed: parseInput(s.queue[a.index]), colorOverrides: {} };
    }
    case "NEXT_QUEUE_ITEM": {
      const nextIdx = s.queueIndex + 1;
      if (nextIdx >= s.queue.length) return s;
      return { ...s, queueIndex: nextIdx, inputText: s.queue[nextIdx], parsed: parseInput(s.queue[nextIdx]), colorOverrides: {} };
    }
    case "PREV_QUEUE_ITEM": {
      const prevIdx = s.queueIndex - 1;
      if (prevIdx < 0) return s;
      return { ...s, queueIndex: prevIdx, inputText: s.queue[prevIdx], parsed: parseInput(s.queue[prevIdx]), colorOverrides: {} };
    }
    default: return s;
  }
}

// ━━━ LABEL BOX ━━━
const LB = ({ children, bg, color, size = 28, bold = true, style = {}, animateProps = {} }) => {
  const { delay = 0, type = "none" } = animateProps;
  const { state } = useEditor();

  let animString = "none";
  if (type === "fade") animString = `subtleFade 0.7s cubic-bezier(0.25, 1, 0.5, 1) forwards ${delay}s`;
  if (type === "drift") animString = `subtleDrift 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards ${delay}s`;
  if (type === "blur") animString = `subtleBlur 0.9s cubic-bezier(0.33, 1, 0.68, 1) forwards ${delay}s`;

  return (
    <div style={{
      display: "inline-block", padding: "10px 22px", borderRadius: "12px",
      backgroundColor: state.showBoxBackgrounds ? bg : "transparent", color, fontSize: `${size}px`,
      fontWeight: bold ? 800 : 600, fontFamily: "'SF Pro Display',system-ui,sans-serif",
      lineHeight: 1.3, textAlign: "center", whiteSpace: "pre-line",
      boxShadow: state.showBoxBackgrounds ? "0 3px 12px rgba(0,0,0,0.2)" : "none",
      opacity: type !== "none" ? 0 : 1,
      animation: animString,
      ...style,
    }}>{children}</div>
  );
};


// ━━━ RENDERERS ━━━
function RenderCompare() {
  const { state } = useEditor();
  const { parsed, colorPreset, animateType, colorOverrides } = state;
  const c = COLOR_PRESETS[colorPreset];
  let delay = 0.2; // slight initial pause
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", padding: "50px 30px", gap: "14px", boxSizing: "border-box" }}>
      <LB bg={c.titleBg} color={c.title} size={44} style={{ marginBottom: "10px" }} animateProps={{ type: animateType, delay: delay }}>{parsed.title}</LB>
      <div style={{ display: "flex", width: "92%", justifyContent: "space-between", alignItems: "center" }}>
        <LB bg={c.colA} color={c.colAText} size={30} animateProps={{ type: animateType, delay: delay += 0.15 }}>{parsed.colALabel}</LB>
        <LB bg="rgba(255,255,255,0.9)" color="#000" size={24} bold={false} animateProps={{ type: animateType, delay: delay }}>vs.</LB>
        <LB bg={c.colB} color={c.colBText} size={30} animateProps={{ type: animateType, delay: delay }}>{parsed.colBLabel}</LB>
      </div>
      <div style={{ height: "20px" }} />
      {parsed.rows.map((r, i) => {
        const o = colorOverrides[i];
        delay += 0.6; // Deutlich sichtbarer Abstand pro Reihe
        return (
          <div key={i} style={{ display: "flex", width: "96%", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <LB bg={o?.bgA || c.colA} color={o?.textA || c.colAText} size={28} style={{ flex: "1 1 28%", minWidth: 0 }} animateProps={{ type: animateType, delay }}>{r.left}</LB>
            <LB bg="rgba(255,255,255,0.92)" color="#000" size={24} style={{ flex: "1 1 36%", minWidth: 0 }} animateProps={{ type: animateType, delay: delay + 0.1 }}>{r.center}</LB>
            <LB bg={o?.bgB || c.colB} color={o?.textB || c.colBText} size={28} style={{ flex: "1 1 28%", minWidth: 0 }} animateProps={{ type: animateType, delay: delay + 0.2 }}>{r.right}</LB>
          </div>
        );
      })}
      <div style={{ marginTop: "20px" }}>
        <LB bg="rgba(255,255,255,0.85)" color="#000" size={20} bold={false} animateProps={{ type: animateType, delay: delay += 0.6 }}>Infos in der Caption ⬇️</LB>
      </div>
    </div>
  );
}

function RenderList() {
  const { state } = useEditor();
  const { parsed, colorPreset, animateType, colorOverrides } = state;
  const c = COLOR_PRESETS[colorPreset];
  let delay = 0.2; // slight initial pause
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", padding: "50px 30px", gap: "14px", boxSizing: "border-box" }}>
      <LB bg={c.titleBg} color={c.title} size={48} style={{ marginBottom: "4px" }} animateProps={{ type: animateType, delay: delay }}>{parsed.title}</LB>
      {parsed.subtitle && <LB bg={c.colA} color={c.colAText} size={28} style={{ marginBottom: "20px" }} animateProps={{ type: animateType, delay: delay += 0.15 }}>{parsed.subtitle}</LB>}
      {!parsed.subtitle && <div style={{ height: "20px" }} />}
      {parsed.rows.map((r, i) => {
        const isLast = i === parsed.rows.length - 1;
        const o = colorOverrides[i];
        delay += 0.6; // Deutlich sichtbar Reihe für Reihe
        return (
          <div key={i} style={{ display: "flex", width: "90%", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
            <LB bg={o?.bgA || c.colA} color={o?.textA || c.colAText} size={32} style={{ flex: "1 1 50%", textAlign: "left" }} animateProps={{ type: animateType, delay }}>{r.label}</LB>
            {r.value && <LB bg={o?.bgB || (isLast ? c.colB : "#FFFFFF")} color={o?.textB || (isLast ? c.colBText : "#000")} size={32} style={{ flex: "1 1 45%", textAlign: "right" }} animateProps={{ type: animateType, delay: delay + 0.2 }}>{r.value}</LB>}
          </div>
        );
      })}
    </div>
  );
}

function AutoRenderer() {
  const { state } = useEditor();
  if (state.parsed.type === "compare") return <RenderCompare />;
  return <RenderList />;
}

// ━━━ CANVAS ━━━
function Canvas({ exportRef }) {
  const { state, dispatch } = useEditor();
  const fileRef = useRef(null);

  // Create a ref for the video to handle playback
  const videoRef = useRef(null);

  return (
    <div ref={exportRef} style={{
      position: "relative", width: "1080px", height: "1920px",
      background: state.bgImage ? "transparent" : "#000", overflow: "hidden",
      transformOrigin: "top left", transform: `scale(${state.zoom})`,
    }}>
      {state.bgImage && (
        state.bgIsVideo ? (
          <video
            ref={videoRef}
            src={state.bgImage}
            crossOrigin="anonymous"
            autoPlay
            loop
            muted
            playsInline
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
          />
        ) : (
          <img src={state.bgImage} crossOrigin="anonymous" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} alt="" />
        )
      )}
      <input ref={fileRef} type="file" accept="image/*,video/mp4" onChange={(e) => {
        const f = e.target.files?.[0]; if (!f) return;
        const isVideo = f.type.startsWith('video/');
        const r = new FileReader();
        r.onload = (ev) => dispatch({ type: "SET_BG", url: ev.target.result, isVideo });
        r.readAsDataURL(f);
      }} style={{ display: "none" }} />
      {state.overlay.enabled && (
        <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", backgroundColor: hexToRgba(state.overlay.hex, state.overlay.opacity) }} />
      )}
      <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", transform: `scale(${state.textScale / 100}) translateY(${state.textOffsetY}px)`, transformOrigin: "center center" }}>
        <AutoRenderer />
      </div>
    </div>
  );
}

// ━━━ VIEWPORT ━━━
function Viewport({ exportRef }) {
  const { state } = useEditor();
  return (
    <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", overflow: "auto", padding: "24px", background: "radial-gradient(ellipse at center, #1a1e2e 0%, #0f1119 70%)" }}>
      <div style={{ width: 1080 * state.zoom, height: 1920 * state.zoom, flexShrink: 0, boxShadow: "0 16px 100px rgba(0,0,0,0.6)", borderRadius: "16px", overflow: "hidden" }}>
        <Canvas exportRef={exportRef} />
      </div>
    </div>
  );
}

// ━━━ SHARED STYLE TOKENS ━━━
const sec = { marginBottom: "10px", padding: "10px", background: "rgba(255,255,255,0.025)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" };
const lab = { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "rgba(255,255,255,0.4)", marginBottom: "4px", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.5px" };
const rng = { width: "100%", accentColor: "#6C63FF", cursor: "pointer", height: "3px" };
const csw = { width: "26px", height: "22px", border: "none", borderRadius: "4px", cursor: "pointer", background: "transparent", padding: 0 };
const abtn = { padding: "5px 10px", fontSize: "10px", background: "rgba(108,99,255,0.1)", border: "1px solid rgba(108,99,255,0.2)", borderRadius: "5px", color: "#A9A3FF", cursor: "pointer", fontFamily: "monospace" };

// ━━━ AI PROMPT SECTION ━━━
function AiPromptSection() {
  const { dispatch } = useEditor();
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("openai_key") || "");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyVisible, setKeyVisible] = useState(false);

  useEffect(() => {
    if (apiKey) localStorage.setItem("openai_key", apiKey);
  }, [apiKey]);

  const handleGenerate = useCallback(async () => {
    if (!apiKey.trim()) { setError("Bitte OpenAI API-Key eingeben"); return; }
    if (!prompt.trim()) { setError("Bitte Prompt eingeben"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.trim()}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.7,
          max_tokens: 400,
          messages: [
            { role: "system", content: AI_SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error?.message || `API Fehler ${res.status}`);
      }
      const data = await res.json();
      const generated = data.choices?.[0]?.message?.content?.trim();
      if (!generated) throw new Error("Leere Antwort von OpenAI");
      dispatch({ type: "SET_TEXT", text: generated });
      setPrompt("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiKey, prompt, dispatch]);

  return (
    <div style={{ ...sec, border: "1px solid rgba(108,99,255,0.2)", background: "rgba(108,99,255,0.04)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#A9A3FF", fontFamily: "system-ui", display: "flex", alignItems: "center", gap: "5px" }}>
          <span>✨</span> KI-Prompt
        </div>
        <button onClick={() => setShowKey(p => !p)} style={{ ...abtn, fontSize: "9px", padding: "2px 7px" }}>
          {showKey ? "Key verbergen" : "🔑 API Key"}
        </button>
      </div>

      {/* API Key input */}
      {showKey && (
        <div style={{ marginBottom: "8px" }}>
          <div style={{ ...lab, marginBottom: "3px" }}><span>OpenAI API Key</span></div>
          <div style={{ display: "flex", gap: "4px" }}>
            <input
              type={keyVisible ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              style={{
                flex: 1, padding: "6px 8px", fontSize: "11px", fontFamily: "monospace",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "5px", color: "#fff", outline: "none",
              }}
            />
            <button onClick={() => setKeyVisible(p => !p)} style={{ ...abtn, padding: "4px 7px", fontSize: "11px" }}>{keyVisible ? "🙈" : "👁"}</button>
          </div>
          <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.15)", marginTop: "3px", fontFamily: "monospace" }}>
            Wird nur lokal im Browser gespeichert (localStorage)
          </div>
        </div>
      )}

      {/* Prompt textarea */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
        placeholder={`z.B. „Vergleiche Bitcoin vs Gold über die letzten 10 Jahre" oder „Liste der 6 besten ETFs für Anfänger"`}
        style={{
          width: "100%", minHeight: "80px", padding: "8px",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(108,99,255,0.15)",
          borderRadius: "6px", color: "#fff", fontSize: "12px",
          fontFamily: "system-ui", lineHeight: 1.5, outline: "none",
          resize: "vertical", boxSizing: "border-box",
        }}
      />

      {/* Quick prompts */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "5px", marginBottom: "6px" }}>
        {[
          "Vergleiche Ethereum vs Bitcoin 2025",
          "Top 5 Steuer-Tricks für Selbständige",
          "GmbH vs Einzelunternehmen Vergleich",
          "Mietrendite-Vergleich Deutschlands Städte",
          "Nettolohn bei 4.000€ Brutto aufschlüsseln",
          "ETF Sparplan Ergebnis nach 20 Jahren",
        ].map((q, i) => (
          <button key={i} onClick={() => setPrompt(q)} style={{
            padding: "3px 7px", fontSize: "9px",
            background: prompt === q ? "rgba(108,99,255,0.15)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${prompt === q ? "#6C63FF" : "rgba(255,255,255,0.06)"}`,
            borderRadius: "4px", color: "rgba(255,255,255,0.35)",
            cursor: "pointer", fontFamily: "system-ui",
          }}>{q}</button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ fontSize: "10px", color: "#FF6B6B", fontFamily: "monospace", marginBottom: "6px", padding: "5px 8px", background: "rgba(229,9,20,0.08)", borderRadius: "5px", border: "1px solid rgba(229,9,20,0.15)" }}>
          ⚠ {error}
        </div>
      )}

      {/* Generate button */}
      <button onClick={handleGenerate} disabled={loading} style={{
        width: "100%", padding: "9px",
        background: loading ? "rgba(108,99,255,0.2)" : "linear-gradient(135deg, rgba(108,99,255,0.8), rgba(79,70,229,0.9))",
        color: "#fff", border: "1px solid rgba(108,99,255,0.3)",
        borderRadius: "7px", fontSize: "12px", fontWeight: 600,
        cursor: loading ? "wait" : "pointer", fontFamily: "system-ui",
        opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center",
        justifyContent: "center", gap: "6px",
      }}>
        {loading
          ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> KI generiert…</>
          : <>✨ Generieren <span style={{ fontSize: "9px", opacity: 0.6 }}>⌘↵</span></>}
      </button>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ━━━ PANEL ━━━
function Panel({ exportRef }) {
  const { state, dispatch } = useEditor();
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const fileRef = useRef(null);
  const ffmpegRef = useRef(new FFmpeg());

  const handleExport = useCallback(async (andNext = false) => {
    const el = exportRef.current;
    if (!el || exporting) return;
    setExporting(true);
    await new Promise(r => setTimeout(r, 50));
    try {
      if (!window.html2canvas) {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        document.head.appendChild(s);
        await new Promise((r) => { s.onload = r; s.onerror = () => r(); });
      }
      if (!window.html2canvas) { alert("Export failed"); return; }

      const prevTransform = el.style.transform;
      el.style.transform = "scale(1)";

      const canvas = await window.html2canvas(el, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null
      });

      el.style.transform = prevTransform;

      const link = document.createElement("a");
      link.download = `reel-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setExporting(false);
      if (andNext && state.queue.length > 0 && state.queueIndex < state.queue.length - 1) {
        dispatch({ type: "NEXT_QUEUE_ITEM" });
      }
    }
  }, [exportRef, exporting, state.queue, state.queueIndex, dispatch]);

  const handleVideoExport = useCallback(async () => {
    const el = exportRef.current;
    if (!el || exporting) return;
    setExporting(true);
    setExportProgress("Lade Engine...");

    try {
      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg.loaded) {
        ffmpeg.on("progress", ({ progress }) => {
          setExportProgress(`Lade Engine: ${Math.round(progress * 100)}%`);
        });
        await ffmpeg.load();
      }

      setExportProgress("Erzeuge Overlay...");

      if (!window.html2canvas) {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        document.head.appendChild(s);
        await new Promise((r) => { s.onload = r; s.onerror = () => r(); });
      }

      // 1. Capture the transparent overlay
      const prevTransform = el.style.transform;
      el.style.transform = "scale(1)";

      // Temporarily hide the video element so we only capture the text overlay
      const videoEl = el.querySelector("video");
      const imgEl = el.querySelector("img");
      let originalDisplayVid = "";
      let originalDisplayImg = "";

      if (videoEl) { originalDisplayVid = videoEl.style.display; videoEl.style.display = "none"; }
      if (imgEl && state.bgIsVideo) { originalDisplayImg = imgEl.style.display; imgEl.style.display = "none"; }

      const overlayCanvas = await window.html2canvas(el, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null
      });

      if (videoEl) videoEl.style.display = originalDisplayVid;
      if (imgEl && state.bgIsVideo) imgEl.style.display = originalDisplayImg;
      el.style.transform = prevTransform;

      // Convert overlay canvas to bytes
      const overlayBlob = await new Promise(r => overlayCanvas.toBlob(r, 'image/png'));
      const overlayFile = await fetchFile(overlayBlob);
      await ffmpeg.writeFile('overlay.png', overlayFile);

      setExportProgress("Rendere Video...");
      let durationStr = "-t 6"; // Default duration 6 seconds if no background video

      if (state.bgImage && state.bgIsVideo) {
        // We have a background video!
        const bgFile = await fetchFile(state.bgImage);
        await ffmpeg.writeFile('bg.mp4', bgFile);

        ffmpeg.on("progress", ({ progress }) => {
          setExportProgress(`Rendere Video: ${Math.round(progress * 100)}%`);
        });

        // Loop the video if shorter than 6 seconds, and overlay the PNG scale to fit 1080x1920
        await ffmpeg.exec([
          '-stream_loop', '-1', // loop background
          '-i', 'bg.mp4',
          '-i', 'overlay.png',
          '-filter_complex', '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg];[bg][1:v]overlay=0:0[out]',
          '-map', '[out]',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-t', '6', // hardcode 6 seconds for social media shorts loop
          '-pix_fmt', 'yuv420p',
          'output.mp4'
        ]);
      } else {
        // Just the overlay on a black background
        ffmpeg.on("progress", ({ progress }) => {
          setExportProgress(`Rendere Video: ${Math.round(progress * 100)}%`);
        });

        await ffmpeg.exec([
          '-f', 'lavfi',
          '-i', 'color=c=black:s=1080x1920:d=6',
          '-i', 'overlay.png',
          '-filter_complex', '[0:v][1:v]overlay=0:0[out]',
          '-map', '[out]',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-t', '6',
          '-pix_fmt', 'yuv420p',
          'output.mp4'
        ]);
      }

      setExportProgress("Download...");
      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      // Cleanup FFmpeg file system
      try {
        await ffmpeg.deleteFile('overlay.png');
        if (state.bgIsVideo) await ffmpeg.deleteFile('bg.mp4');
        await ffmpeg.deleteFile('output.mp4');
      } catch (e) { }

      const link = document.createElement("a");
      link.download = `reel-${Date.now()}.mp4`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);

    } catch (err) {
      console.error("FFmpeg render failed:", err);
      alert("Video Export fehlgeschlagen. Starte eventuell den lokalen Server neu.");
    } finally {
      setExporting(false);
      setExportProgress("");
    }
  }, [exportRef, exporting, state.bgImage, state.bgIsVideo]);

  const filtered = templateFilter === "compare"
    ? EXAMPLES.filter(e => parseInput(e.text).type === "compare")
    : templateFilter === "list"
      ? EXAMPLES.filter(e => parseInput(e.text).type === "list")
      : EXAMPLES;

  return (
    <div style={{
      width: "320px", height: "100vh", overflowY: "auto",
      background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.05)",
      padding: "14px 12px", display: "flex", flexDirection: "column",
      fontFamily: "system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff", marginBottom: "14px", letterSpacing: "-0.3px" }}>⚡ Reel Producer</div>

      {/* ✨ AI PROMPT — top position */}
      <AiPromptSection />

      {/* QUEUE / BATCH IMPORT */}
      <div style={sec}>
        <div style={{ ...lab, marginBottom: "6px" }}>
          <span>📚 Massen-Import (Warteschlange)</span>
          <button onClick={() => setShowImport(p => !p)} style={{ ...abtn, fontSize: "9px", padding: "2px 8px" }}>
            {showImport ? "Schließen" : "Importieren"}
          </button>
        </div>

        {showImport && (
          <div style={{ marginBottom: "10px" }}>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Füge mehrere Posts hier ein, getrennt durch ---\n\nPost 1\n...\n---\nPost 2\n..."
              style={{
                width: "100%", minHeight: "80px", padding: "8px",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "6px", color: "#fff", fontSize: "11px",
                fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box", marginBottom: "6px"
              }}
            />
            <button onClick={() => {
              dispatch({ type: "IMPORT_QUEUE", text: importText });
              setShowImport(false);
              setImportText("");
            }} style={{ ...abtn, width: "100%", background: "rgba(108,99,255,0.15)" }}>In Warteschlange laden</button>
          </div>
        )}

        {state.queue.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.02)", padding: "8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: "10px", color: "#A9A3FF", fontWeight: 700, marginBottom: "8px", textAlign: "center" }}>
              Aktive Queue: Post {state.queueIndex + 1} von {state.queue.length}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxHeight: "150px", overflowY: "auto" }}>
              {state.queue.map((q, i) => (
                <button key={i} onClick={() => dispatch({ type: "LOAD_QUEUE_ITEM", index: i })} style={{
                  padding: "4px", minWidth: "24px", textAlign: "center", fontSize: "10px", fontWeight: "bold",
                  background: state.queueIndex === i ? "#6C63FF" : "rgba(255,255,255,0.05)",
                  color: state.queueIndex === i ? "#fff" : "rgba(255,255,255,0.4)",
                  border: "none", borderRadius: "4px", cursor: "pointer", fontFamily: "system-ui"
                }}>
                  {i + 1}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
              <button disabled={state.queueIndex === 0} onClick={() => dispatch({ type: "PREV_QUEUE_ITEM" })} style={{ ...abtn, flex: 1, opacity: state.queueIndex === 0 ? 0.3 : 1 }}>◀ Zurück</button>
              <button disabled={state.queueIndex === state.queue.length - 1} onClick={() => dispatch({ type: "NEXT_QUEUE_ITEM" })} style={{ ...abtn, flex: 1, opacity: state.queueIndex === state.queue.length - 1 ? 0.3 : 1 }}>Vor ▶</button>
            </div>
          </div>
        )}
      </div>

      {/* MANUAL TEXT INPUT */}
      <div style={sec}>
        <div style={{ ...lab, marginBottom: "6px" }}>
          <span>📝 Manuell bearbeiten</span>
          <button onClick={() => dispatch({ type: "RANDOM" })} style={{ ...abtn, fontSize: "9px", padding: "2px 8px" }}>🎲</button>
        </div>
        <textarea
          value={state.inputText}
          onChange={(e) => {
            dispatch({ type: "SET_TEXT", text: e.target.value });
            // Update queue item if in queue
            if (state.queue.length > 0) {
              // We would ideally save it live into the queue, but that's complex without messing up cursor position if queue updates text directly.
              // We'll leave the direct edit local to `inputText` and not sync back automatically to avoid text jumping.
            }
          }}
          placeholder={"Titel\nA vs B\nLabel: WertA | WertB"}
          style={{
            width: "100%", minHeight: "140px", padding: "10px",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "8px", color: "#fff", fontSize: "12px",
            fontFamily: "'SF Mono',monospace", lineHeight: 1.6,
            outline: "none", resize: "vertical", boxSizing: "border-box",
          }}
        />
        <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", marginTop: "4px", fontFamily: "monospace", lineHeight: 1.5 }}>
          Erkannt: <span style={{ color: state.parsed.type === "compare" ? "#A9A3FF" : "#22C55E" }}>
            {state.parsed.type === "compare"
              ? `⚔️ Vergleich (${state.parsed.rows.length} Zeilen)`
              : `📋 Liste (${state.parsed.rows.length} Einträge)`}
          </span>
        </div>
      </div>

      {/* TEMPLATES */}
      <div style={sec}>
        <div style={{ ...lab, marginBottom: "6px" }}><span>📂 Vorlagen ({filtered.length})</span></div>
        <div style={{ display: "flex", gap: "3px", marginBottom: "6px" }}>
          {[["all", "Alle"], ["compare", "⚔️"], ["list", "📋"]].map(([k, n]) => (
            <button key={k} onClick={() => setTemplateFilter(k)} style={{
              padding: "3px 8px", fontSize: "9px",
              background: templateFilter === k ? "rgba(108,99,255,0.15)" : "transparent",
              border: `1px solid ${templateFilter === k ? "#6C63FF" : "rgba(255,255,255,0.05)"}`,
              borderRadius: "4px", color: templateFilter === k ? "#A9A3FF" : "rgba(255,255,255,0.3)",
              cursor: "pointer", fontFamily: "system-ui",
            }}>{n}</button>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", maxHeight: "120px", overflowY: "auto" }}>
          {filtered.map((ex, i) => (
            <button key={i} onClick={() => dispatch({ type: "LOAD_EXAMPLE", text: ex.text, color: ex.color })} style={{
              padding: "4px 7px", fontSize: "10px",
              background: state.inputText === ex.text ? "rgba(108,99,255,0.12)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${state.inputText === ex.text ? "#6C63FF" : "rgba(255,255,255,0.05)"}`,
              borderRadius: "5px", color: state.inputText === ex.text ? "#A9A3FF" : "rgba(255,255,255,0.35)",
              cursor: "pointer", fontFamily: "system-ui",
            }}>{ex.name}</button>
          ))}
        </div>
      </div>

      {/* COLOR PRESETS */}
      <div style={sec}>
        <div style={lab}><span>🎨 Farben</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {Object.entries(COLOR_PRESETS).map(([k, v]) => (
            <button key={k} onClick={() => dispatch({ type: "SET_COLOR", key: k })} style={{
              padding: "4px 8px", fontSize: "10px",
              background: state.colorPreset === k ? "rgba(108,99,255,0.15)" : "transparent",
              border: `1px solid ${state.colorPreset === k ? "#6C63FF" : "rgba(255,255,255,0.05)"}`,
              borderRadius: "6px", cursor: "pointer", fontFamily: "system-ui",
              color: state.colorPreset === k ? "#A9A3FF" : "rgba(255,255,255,0.3)",
              display: "flex", alignItems: "center", gap: "5px",
            }}>
              <div style={{ display: "flex", gap: "1px" }}>
                <div style={{ width: "9px", height: "9px", borderRadius: "2px", background: v.colA }} />
                <div style={{ width: "9px", height: "9px", borderRadius: "2px", background: v.colB }} />
              </div>
              {v.name}
            </button>
          ))}
        </div>
      </div>

      {/* TEXT SIZE + POSITION */}
      <div style={sec}>
        <div style={lab}><span>📐 Textgröße</span><span>{state.textScale}%</span></div>
        <input type="range" min="40" max="150" value={state.textScale} onChange={(e) => dispatch({ type: "SET_TEXT_SCALE", value: Number(e.target.value) })} style={rng} />

        <div style={{ ...lab, marginTop: "8px" }}><span>↕️ Y-Position</span><span>{state.textOffsetY}px</span></div>
        <input type="range" min={-400} max={400} value={state.textOffsetY} onChange={(e) => dispatch({ type: "SET_TEXT_OFFSET_Y", value: Number(e.target.value) })} style={rng} />

        <div style={{ ...lab, marginTop: "12px", marginBottom: "4px" }}>
          <span>🟩 Box-Hintergründe</span>
          <input type="checkbox" checked={state.showBoxBackgrounds} onChange={() => dispatch({ type: "SET_SHOW_BOX_BACKGROUNDS", value: !state.showBoxBackgrounds })} style={{ accentColor: "#6C63FF" }} />
        </div>

        <button onClick={() => { dispatch({ type: "SET_TEXT_SCALE", value: 100 }); dispatch({ type: "SET_TEXT_OFFSET_Y", value: 0 }); }} style={{ ...abtn, fontSize: "9px", padding: "3px 8px", marginTop: "6px" }}>Reset</button>
      </div>

      {/* BACKGROUND */}
      <div style={sec}>
        <div style={lab}><span>🖼️ Hintergrund</span></div>
        <input ref={fileRef} type="file" accept="image/*,video/mp4" onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const isVideo = f.type.startsWith('video/');
          const r = new FileReader();
          r.onload = (ev) => dispatch({ type: "SET_BG", url: ev.target.result, isVideo });
          r.readAsDataURL(f);
        }} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          <button onClick={() => fileRef.current?.click()} style={abtn}>{state.bgImage ? "Ändern" : "📤 Bild/Video hochladen"}</button>
          {state.bgImage && <>
            <button onClick={() => dispatch({ type: "SET_BG_KEEP", url: null })} style={{ ...abtn, color: "#FF6B6B", borderColor: "rgba(229,9,20,0.2)" }}>✕</button>
            <button onClick={() => dispatch({ type: "RANDOM" })} style={{ ...abtn, fontSize: "9px" }}>🎲 Neu</button>
          </>}
        </div>
        {state.bgImage && (
          <div style={{ marginTop: "6px", borderRadius: "6px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
            {state.bgIsVideo ? (
              <video src={state.bgImage} style={{ width: "100%", height: "55px", objectFit: "cover", display: "block" }} muted loop autoPlay playsInline />
            ) : (
              <img src={state.bgImage} style={{ width: "100%", height: "55px", objectFit: "cover", display: "block" }} alt="" />
            )}
          </div>
        )}
      </div>

      {/* OVERLAY */}
      <div style={sec}>
        <div style={{ ...lab, marginBottom: "6px" }}>
          <span>Overlay</span>
          <input type="checkbox" checked={state.overlay.enabled} onChange={() => dispatch({ type: "SET_OVERLAY", p: { enabled: !state.overlay.enabled } })} style={{ accentColor: "#6C63FF" }} />
        </div>
        {state.overlay.enabled && <>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input type="color" value={state.overlay.hex} onChange={(e) => dispatch({ type: "SET_OVERLAY", p: { hex: e.target.value } })} style={csw} />
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>{state.overlay.hex} · {state.overlay.opacity}%</span>
          </div>
          <input type="range" min="0" max="100" value={state.overlay.opacity} onChange={(e) => dispatch({ type: "SET_OVERLAY", p: { opacity: Number(e.target.value) } })} style={{ ...rng, marginTop: "4px" }} />
        </>}
      </div>

      {/* ZOOM & ANIMATION OPTIONS */}
      <div style={sec}>
        <div style={lab}><span>🔍 Zoom</span><span>{Math.round(state.zoom * 100)}%</span></div>
        <input type="range" min="18" max="60" value={Math.round(state.zoom * 100)} onChange={(e) => dispatch({ type: "SET_ZOOM", value: Number(e.target.value) / 100 })} style={rng} />

        <div style={{ ...lab, marginTop: "12px", marginBottom: "6px" }}>
          <span>🎬 Hochwertige Animationen</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <select
            value={state.animate}
            onChange={(e) => {
              dispatch({ type: "SET_ANIMATE", value: "none" }); // Reset first
              setTimeout(() => dispatch({ type: "SET_ANIMATE", value: e.target.value }), 50);
            }}
            style={{
              width: "100%", padding: "6px 8px", fontSize: "11px", fontFamily: "system-ui",
              background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "5px", outline: "none", cursor: "pointer", appearance: "none"
            }}
          >
            <option value="none">Keine (Statisch)</option>
            <option value="fade">🌬️ Subtle Fade (Sanftes Einblenden)</option>
            <option value="drift">🍃 Smooth Drift (Leichtes Schweben)</option>
            <option value="blur">🌫️ Soft Blur (Kino-Fokus)</option>
          </select>
        </div>

        {state.animate !== "none" && (
          <button onClick={() => {
            const current = state.animate;
            dispatch({ type: "SET_ANIMATE", value: "none" });
            setTimeout(() => dispatch({ type: "SET_ANIMATE", value: current }), 50);
          }} style={{ ...abtn, width: "100%", marginTop: "8px", background: "rgba(108,99,255,0.15)" }}>
            ▶️ Animation neu starten
          </button>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* EXPORT OPTIONS */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "10px" }}>

        {/* Video Recording Warning/Button */}
        <button onClick={handleVideoExport} disabled={exporting} style={{
          width: "100%", padding: "12px 10px",
          background: exporting ? "#333" : "linear-gradient(135deg, rgba(229,9,20,0.8), rgba(200,0,0,0.9))",
          color: "#fff", border: "1px solid rgba(229,9,20,0.5)", borderRadius: "10px", fontSize: "12px",
          fontWeight: 700, cursor: exporting ? "wait" : "pointer", fontFamily: "system-ui",
          transition: "background 0.2s"
        }}>
          {exporting ? (exportProgress || "Rendere Video…") : "🎥 Als Video (MP4) rendern"}
        </button>

        {/* PNG Exports */}
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={() => handleExport(false)} disabled={exporting} style={{
            flex: 1, padding: "14px 10px",
            background: exporting ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.08)",
            color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "14px",
            fontWeight: 700, cursor: exporting ? "wait" : "pointer", fontFamily: "system-ui",
            opacity: exporting ? 0.6 : 1, transition: "background 0.2s"
          }}>
            {exporting ? "…" : "↓ PNG"}
          </button>

          <button onClick={() => handleExport(true)} disabled={exporting || (state.queue.length > 0 && state.queueIndex === state.queue.length - 1)} style={{
            flex: 2, padding: "14px 10px",
            background: exporting ? "#333" : "linear-gradient(135deg, #6C63FF, #4F46E5)",
            color: "#fff", border: "none", borderRadius: "10px", fontSize: "13px",
            fontWeight: 700, cursor: exporting ? "wait" : "pointer", fontFamily: "system-ui",
            opacity: exporting ? 0.6 : 1, transition: "opacity 0.2s", display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            {exporting ? "Exporting…" : (state.queue.length > 0 ? "↓ PNG & Nächster ▶" : "↓ PNG Export")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ━━━ APP ━━━
export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const exportRef = useRef(null);

  // Inject keyframes globally once
  useEffect(() => {
    if (!document.getElementById("editor-keyframes")) {
      const style = document.createElement("style");
      style.id = "editor-keyframes";
      style.textContent = `
        @keyframes subtleFade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes subtleDrift {
          0% { opacity: 0; transform: translateY(15px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes subtleBlur {
          0% { opacity: 0; filter: blur(12px); transform: scale(0.95); }
          100% { opacity: 1; filter: blur(0px); transform: scale(1); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <Ctx.Provider value={{ state, dispatch }}>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        <Panel exportRef={exportRef} />
        <Viewport exportRef={exportRef} />
      </div>
    </Ctx.Provider>
  );
}
