import { kvGet, kvSet, KEYS } from "../_lib/store.js";
import { listFolderContinue, getLatestCursor, downloadFile } from "../_lib/dropbox.js";
import {
  uploadAsset,
  pollAssetUpload,
  createAutofill,
  pollAutofill,
  moveDesignToFolder,
} from "../_lib/canva.js";

export const config = { maxDuration: 60 };

function basename(path) {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

function stripExt(name) {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(0, idx) : name;
}

function hasVideoExtension(name, extensions) {
  const lower = name.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext.toLowerCase()));
}

function buildAutofillData(fieldMapping, { filename, assetId }) {
  const data = {};
  for (const [field, source] of Object.entries(fieldMapping || {})) {
    if (source === "videofile") {
      data[field] = { type: "video", asset_id: assetId };
    } else if (source === "filename") {
      data[field] = { type: "text", text: stripExt(filename) };
    } else if (typeof source === "string" && source.startsWith("static:")) {
      data[field] = { type: "text", text: source.slice("static:".length) };
    }
  }
  return data;
}

function isAuthorized(req) {
  const secret = process.env.WORKER_SECRET;
  if (!secret) return true;
  return req.headers["x-worker-secret"] === secret;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const cfg = await kvGet(KEYS.config);
  if (!cfg) {
    return res.status(400).json({ error: "Config missing. Complete setup first." });
  }

  let cursor = await kvGet(KEYS.dropboxCursor);
  if (!cursor) {
    const fresh = await getLatestCursor(cfg.dropboxPath);
    await kvSet(KEYS.dropboxCursor, fresh.cursor);
    return res.status(200).json({ ok: true, note: "Cursor initialized, no sync performed" });
  }

  const results = { processed: [], skipped: [], failed: [] };

  try {
    let hasMore = true;
    while (hasMore) {
      const page = await listFolderContinue(cursor);
      cursor = page.cursor;

      for (const entry of page.entries) {
        if (entry[".tag"] !== "file") {
          results.skipped.push({ path: entry.path_display, reason: "not a file" });
          continue;
        }
        if (!hasVideoExtension(entry.name, cfg.videoExtensions)) {
          results.skipped.push({ path: entry.path_display, reason: "not a video" });
          continue;
        }

        try {
          const buffer = await downloadFile(entry.path_lower);
          const uploadJob = await uploadAsset(buffer, entry.name);
          const jobId = uploadJob.job?.id || uploadJob.id;
          const asset = await pollAssetUpload(jobId);
          const assetId = asset?.id;
          if (!assetId) throw new Error("Asset id missing from upload response");

          const autofillData = buildAutofillData(cfg.fieldMapping, {
            filename: entry.name,
            assetId,
          });

          const autofillJob = await createAutofill(
            cfg.brandTemplateId,
            autofillData,
            stripExt(entry.name)
          );
          const autofillId = autofillJob.job?.id || autofillJob.id;
          const design = await pollAutofill(autofillId);
          const designId = design?.id;
          if (!designId) throw new Error("Design id missing from autofill response");

          await moveDesignToFolder(designId, cfg.canvaFolderId);

          results.processed.push({ path: entry.path_display, designId });
        } catch (err) {
          console.error(`Sync failed for ${entry.path_display}:`, err.message);
          results.failed.push({ path: entry.path_display, error: err.message });
        }
      }

      hasMore = page.has_more;
    }

    await kvSet(KEYS.dropboxCursor, cursor);
    return res.status(200).json({ ok: true, ...results });
  } catch (e) {
    console.error("Sync worker error:", e.message);
    return res.status(500).json({ error: e.message, partial: results });
  }
}
