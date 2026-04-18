import { buildAuthorizeUrl } from "../../_lib/canva.js";
import { kvSet, KEYS } from "../../_lib/store.js";
import { randomState } from "../../_lib/auth.js";

function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(hash);
}

export default async function handler(req, res) {
  if (!process.env.CANVA_CLIENT_ID || !process.env.CANVA_REDIRECT_URI) {
    return res.status(500).json({ error: "Canva OAuth env vars missing" });
  }

  const state = randomState();
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const codeVerifier = base64UrlEncode(verifierBytes);
  const codeChallenge = await sha256(codeVerifier);

  await kvSet(KEYS.oauthState("canva", state), { codeVerifier, createdAt: Date.now() });

  res.setHeader("Location", buildAuthorizeUrl(state, codeChallenge));
  res.status(302).end();
}
