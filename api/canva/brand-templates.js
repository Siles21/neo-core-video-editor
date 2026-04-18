import { listBrandTemplates, getBrandTemplateDataset } from "../_lib/canva.js";
import { requireAdmin } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  try {
    if (req.query?.id) {
      const dataset = await getBrandTemplateDataset(req.query.id);
      return res.status(200).json(dataset);
    }
    const templates = await listBrandTemplates();
    return res.status(200).json(templates);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
