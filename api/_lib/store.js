const URL = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

function ensureConfigured() {
  if (!URL || !TOKEN) {
    throw new Error("KV store not configured: set KV_REST_API_URL and KV_REST_API_TOKEN");
  }
}

async function request(path) {
  ensureConfigured();
  const res = await fetch(`${URL}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`KV ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}

export async function kvGet(key) {
  const { result } = await request(`/get/${encodeURIComponent(key)}`);
  if (result == null) return null;
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

export async function kvSet(key, value) {
  const payload = typeof value === "string" ? value : JSON.stringify(value);
  await request(`/set/${encodeURIComponent(key)}/${encodeURIComponent(payload)}`);
}

export async function kvDel(key) {
  await request(`/del/${encodeURIComponent(key)}`);
}

export const KEYS = {
  canvaTokens: "tokens:canva",
  dropboxTokens: "tokens:dropbox",
  dropboxCursor: "dropbox:cursor",
  config: "config",
  oauthState: (provider, state) => `oauth:${provider}:${state}`,
};
