import { listFolders } from "../_lib/canva.js";
import { requireAdmin } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  try {
    const folders = await listFolders();
    return res.status(200).json(folders);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
