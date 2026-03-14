export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages, model } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages required" });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing GOOGLE_API_KEY" });
  }

  const useModel = model || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent`;

  const contents = messages.map((m) => {
    const role = m.role === "assistant" ? "model" : m.role === "system" ? "user" : m.role;
    return { role, parts: [{ text: m.content || "" }] };
  });

  const payload = { contents };

  const response = await fetch(url + `?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return res.status(response.status).json({ error: data?.error?.message || "Gemini error" });
  }

  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("\n")
    .trim();

  return res.status(200).json({ text });
}
