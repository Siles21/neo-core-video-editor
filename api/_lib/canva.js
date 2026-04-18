import { kvGet, kvSet, KEYS } from "./store.js";

const AUTH_URL = "https://www.canva.com/api/oauth/authorize";
const TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
const API = "https://api.canva.com/rest/v1";

export const SCOPES = [
  "asset:read",
  "asset:write",
  "brandtemplate:meta:read",
  "brandtemplate:content:read",
  "design:meta:read",
  "design:content:read",
  "design:content:write",
  "folder:read",
  "folder:write",
];

export function buildAuthorizeUrl(state, codeChallenge) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.CANVA_CLIENT_ID,
    redirect_uri: process.env.CANVA_REDIRECT_URI,
    scope: SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

function basicAuth() {
  const id = process.env.CANVA_CLIENT_ID;
  const secret = process.env.CANVA_CLIENT_SECRET;
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export async function exchangeCode(code, codeVerifier) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: process.env.CANVA_REDIRECT_URI,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(),
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Canva token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
}

async function refreshTokens(refresh_token) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(),
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Canva refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refresh_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
}

export async function getAccessToken() {
  let tokens = await kvGet(KEYS.canvaTokens);
  if (!tokens) throw new Error("Canva not connected");
  if (Date.now() >= tokens.expires_at) {
    tokens = await refreshTokens(tokens.refresh_token);
    await kvSet(KEYS.canvaTokens, tokens);
  }
  return tokens.access_token;
}

async function canvaFetch(path, init = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Canva ${init.method || "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function listBrandTemplates() {
  return canvaFetch("/brand-templates");
}

export async function getBrandTemplateDataset(id) {
  return canvaFetch(`/brand-templates/${encodeURIComponent(id)}/dataset`);
}

export async function listFolders() {
  return canvaFetch("/folders");
}

export async function uploadAsset(fileBuffer, filename) {
  const token = await getAccessToken();
  const metadata = {
    name_base64: Buffer.from(filename).toString("base64"),
  };
  const res = await fetch(`${API}/asset-uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Asset-Upload-Metadata": JSON.stringify(metadata),
    },
    body: fileBuffer,
  });
  if (!res.ok) {
    throw new Error(`Canva asset upload failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function getAssetUpload(jobId) {
  return canvaFetch(`/asset-uploads/${encodeURIComponent(jobId)}`);
}

export async function pollAssetUpload(jobId, { timeoutMs = 45000, intervalMs = 2000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const data = await getAssetUpload(jobId);
    const job = data.job || data;
    if (job.status === "success") return job.asset;
    if (job.status === "failed") {
      throw new Error(`Asset upload failed: ${JSON.stringify(job.error || job)}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Asset upload timed out");
}

export async function createAutofill(brandTemplateId, data, title) {
  return canvaFetch("/autofills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      brand_template_id: brandTemplateId,
      title,
      data,
    }),
  });
}

export async function getAutofill(jobId) {
  return canvaFetch(`/autofills/${encodeURIComponent(jobId)}`);
}

export async function pollAutofill(jobId, { timeoutMs = 45000, intervalMs = 2000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const data = await getAutofill(jobId);
    const job = data.job || data;
    if (job.status === "success") return job.result?.design || job.design;
    if (job.status === "failed") {
      throw new Error(`Autofill failed: ${JSON.stringify(job.error || job)}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Autofill timed out");
}

export async function moveDesignToFolder(designId, folderId) {
  return canvaFetch(`/folders/${encodeURIComponent(folderId)}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: designId }),
  });
}
