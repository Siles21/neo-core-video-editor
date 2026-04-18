import { buildAuthorizeUrl } from "../../_lib/dropbox.js";
import { kvSet, KEYS } from "../../_lib/store.js";
import { randomState } from "../../_lib/auth.js";

export default async function handler(req, res) {
  if (!process.env.DROPBOX_APP_KEY || !process.env.DROPBOX_REDIRECT_URI) {
    return res.status(500).json({ error: "Dropbox OAuth env vars missing" });
  }

  const state = randomState();
  await kvSet(KEYS.oauthState("dropbox", state), { createdAt: Date.now() });

  res.setHeader("Location", buildAuthorizeUrl(state));
  res.status(302).end();
}
