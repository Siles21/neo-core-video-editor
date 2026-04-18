import { kvGet, kvSet, KEYS } from "./_lib/store.js";
import { requireAdmin } from "./_lib/auth.js";
import { getLatestCursor } from "./_lib/dropbox.js";

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method === "GET") {
    const config = (await kvGet(KEYS.config)) || {};
    const canva = await kvGet(KEYS.canvaTokens);
    const dropbox = await kvGet(KEYS.dropboxTokens);
    const cursor = await kvGet(KEYS.dropboxCursor);
    return res.status(200).json({
      config,
      status: {
        canvaConnected: Boolean(canva),
        dropboxConnected: Boolean(dropbox),
        cursorInitialized: Boolean(cursor),
      },
    });
  }

  if (req.method === "POST") {
    const { dropboxPath, brandTemplateId, canvaFolderId, fieldMapping, videoExtensions, initCursor } = req.body || {};

    if (!dropboxPath || !brandTemplateId || !canvaFolderId) {
      return res.status(400).json({ error: "dropboxPath, brandTemplateId, canvaFolderId required" });
    }

    const next = {
      dropboxPath,
      brandTemplateId,
      canvaFolderId,
      fieldMapping: fieldMapping || {},
      videoExtensions: videoExtensions || [".mp4", ".mov", ".webm", ".m4v"],
    };
    await kvSet(KEYS.config, next);

    if (initCursor) {
      try {
        const { cursor } = await getLatestCursor(dropboxPath);
        await kvSet(KEYS.dropboxCursor, cursor);
      } catch (e) {
        return res.status(200).json({ config: next, cursorError: e.message });
      }
    }

    return res.status(200).json({ config: next });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
