export default async function handler(req, res) {
  if (req.method === "GET") {
    const challenge = req.query?.challenge || "";
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(challenge);
  }

  if (req.method === "POST") {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const workerUrl = `${proto}://${host}/api/worker/sync`;

    fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": process.env.WORKER_SECRET || "",
      },
      body: JSON.stringify({ source: "webhook" }),
    }).catch((e) => console.error("Failed to dispatch worker:", e.message));

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
