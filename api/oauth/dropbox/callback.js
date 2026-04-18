import { exchangeCode } from "../../_lib/dropbox.js";
import { kvGet, kvSet, kvDel, KEYS } from "../../_lib/store.js";

export default async function handler(req, res) {
  const { code, state, error } = req.query || {};
  if (error) {
    return res.status(400).send(`Dropbox OAuth error: ${error}`);
  }
  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }

  const stored = await kvGet(KEYS.oauthState("dropbox", state));
  if (!stored) {
    return res.status(400).send("Invalid or expired state");
  }
  await kvDel(KEYS.oauthState("dropbox", state));

  try {
    const tokens = await exchangeCode(code);
    await kvSet(KEYS.dropboxTokens, tokens);
  } catch (e) {
    return res.status(500).send(`Dropbox token exchange failed: ${e.message}`);
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(
    `<!doctype html><meta charset="utf-8"><title>Dropbox verbunden</title>
    <body style="font-family:sans-serif;padding:2rem">
      <h2>Dropbox erfolgreich verbunden</h2>
      <p>Du kannst dieses Fenster schließen und zur Setup-Seite zurückkehren.</p>
      <script>window.opener && window.opener.postMessage({ type: "oauth", provider: "dropbox", ok: true }, "*");</script>
    </body>`
  );
}
