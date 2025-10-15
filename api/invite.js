// api/invite.js
export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-auth-token");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  // --- 简单鉴权（可选但强烈建议） ---
  const token = req.headers["x-auth-token"];
  if (!process.env.SECRET_TOKEN || token !== process.env.SECRET_TOKEN) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  try {
    const {
      authorization,             // Bearer xxx
      account_id,                // f381a384-c9f9-4cde-b68c-921c8316b87e
      email_addresses = [],      // ["xxx@qq.com"]
      role = "standard-user",
      resend_emails = true,
      // 可选：自定义 UA
      user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36",
      // 可选：显式传 Cookie（一般也没用）
      cookie,
    } = req.body || {};

    if (!authorization || !account_id || !Array.isArray(email_addresses) || email_addresses.length === 0) {
      return res.status(400).json({ ok: false, error: "Missing required fields: authorization, account_id, email_addresses[]" });
    }

    const url = `https://chatgpt.com/backend-api/accounts/${encodeURIComponent(account_id)}/invites`;

    const headers = {
      "Content-Type": "application/json",
      "Origin": "https://chatgpt.com",
      "Referer": "https://chatgpt.com/",
      "User-Agent": user_agent,
      "Authorization": `Bearer ${authorization}`,
      "chatgpt-account-id": account_id,
      "Accept": "*/*",
    };
    if (cookie) headers["Cookie"] = cookie; // 可选

    // 用原生 fetch（Node 18+ / Vercel 自带）
    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ email_addresses, role, resend_emails }),
      redirect: "manual", // 便于看到是否被挑战/跳转
    });

    const contentType = upstream.headers.get("content-type") || "";
    const text = await upstream.text();

    // 若被 Cloudflare 拦，返回更清晰的提示
    if (upstream.status === 403 && contentType.includes("text/html") && text.includes("Attention Required")) {
      return res.status(403).json({
        ok: false,
        upstream_status: 403,
        reason: "Blocked by Cloudflare at chatgpt.com",
        hint: "该接口仅在已登录的 chatgpt.com 同源浏览器中可用；后端请求容易被拦。建议改用 api.openai.com 的公开API。",
        cf_ray: upstream.headers.get("cf-ray") || null,
      });
    }

    // 透传上游（尽量保持原样）
    res.status(upstream.status);
    if (contentType) res.setHeader("Content-Type", contentType);
    return res.send(text);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
