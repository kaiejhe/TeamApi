// api/proxy-post.js
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Api-Key");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  // 简单鉴权（可选）
  const needKey = process.env.API_KEY;
  if (needKey && req.headers["x-api-key"] !== needKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const fixedTarget = process.env.TARGET_URL;
  const incomingTarget = req.body?.__target;
  const TARGET_URL = fixedTarget || incomingTarget;
  if (!TARGET_URL) return res.status(400).json({ error: "TARGET_URL not specified" });

  try {
    const PROXY_URL = process.env.PROXY_URL;
    if (!PROXY_URL) return res.status(500).json({ error: "PROXY_URL not configured" });

    const agent = new HttpsProxyAgent(PROXY_URL);

    const headers = {
      "Content-Type": "application/json",
      ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
    };

    const resp = await axios.post(TARGET_URL, req.body, {
      headers,
      httpAgent: agent,
      httpsAgent: agent,
      proxy: false,
      timeout: 15000,
      validateStatus: () => true,
    });

    return res.status(resp.status).send(resp.data);
  } catch (e) {
    return res.status(502).json({
      error: "Upstream request failed",
      message: e.message,
      details: e.response?.data,
    });
  }
}
