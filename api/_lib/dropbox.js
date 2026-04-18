import { kvGet, kvSet, KEYS } from "./store.js";

const AUTH_URL = "https://www.dropbox.com/oauth2/authorize";
const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const API = "https://api.dropboxapi.com/2";
const CONTENT = "https://content.dropboxapi.com/2";

export function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.DROPBOX_APP_KEY,
    redirect_uri: process.env.DROPBOX_REDIRECT_URI,
    state,
    token_access_type: "offline",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code) {
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: process.env.DROPBOX_REDIRECT_URI,
    client_id: process.env.DROPBOX_APP_KEY,
    client_secret: process.env.DROPBOX_APP_SECRET,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Dropbox token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    account_id: data.account_id,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
}

async function refreshTokens(refresh_token) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token,
    client_id: process.env.DROPBOX_APP_KEY,
    client_secret: process.env.DROPBOX_APP_SECRET,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Dropbox refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
}

export async function getAccessToken() {
  let tokens = await kvGet(KEYS.dropboxTokens);
  if (!tokens) throw new Error("Dropbox not connected");
  if (Date.now() >= tokens.expires_at) {
    const fresh = await refreshTokens(tokens.refresh_token);
    tokens = { ...tokens, ...fresh };
    await kvSet(KEYS.dropboxTokens, tokens);
  }
  return tokens.access_token;
}

async function dbxRpc(path, body) {
  const token = await getAccessToken();
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Dropbox ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function listFolder(path) {
  return dbxRpc("/files/list_folder", {
    path,
    recursive: false,
    include_media_info: false,
    include_deleted: false,
  });
}

export async function listFolderContinue(cursor) {
  return dbxRpc("/files/list_folder/continue", { cursor });
}

export async function getLatestCursor(path) {
  return dbxRpc("/files/list_folder/get_latest_cursor", {
    path,
    recursive: false,
  });
}

export async function downloadFile(path) {
  const token = await getAccessToken();
  const res = await fetch(`${CONTENT}/files/download`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
  });
  if (!res.ok) {
    throw new Error(`Dropbox download failed: ${res.status} ${await res.text()}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
