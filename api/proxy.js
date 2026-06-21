// 우리밭 팜맵 매니저 — API 프록시 (Vercel 서버리스 함수)
// 경로:
//   /api/proxy?target=nongsaro&path=fildMnfct/fildMnfctList&sSeCode=335001
//   /api/proxy?target=farmmap&path=...
//   /api/proxy?target=file&u=<인코딩된 원본URL>
//   /api/proxy?target=ai   (POST, body: {messages, system})  ← AI 중계
//
// 환경변수(Vercel Settings → Environment Variables):
//   NONGSARO_KEY, CROPEBOOK_KEY, PORTAL_KEY
//   ANTHROPIC_KEY = Claude API 키 (AI 기능용)  ← 새로 추가
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    const target = req.query.target;

    // ── AI 중계 (Claude API) ──
    if (target === "ai") {
      if (req.method !== "POST") { res.status(405).json({ proxyError: "AI는 POST로 호출하세요" }); return; }
      const key = process.env.ANTHROPIC_KEY;
      if (!key) { res.status(500).json({ proxyError: "ANTHROPIC_KEY 미설정" }); return; }

      // body 파싱 (Vercel은 보통 자동 파싱하지만 안전하게 처리)
      let body = req.body;
      if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      body = body || {};
      const messages = body.messages || [];
      const system = body.system || "";
      if (!messages.length) { res.status(400).json({ proxyError: "messages가 필요합니다" }); return; }

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: system,
          messages: messages,
        }),
      });
      const data = await r.json();
      // 텍스트만 뽑아서 단순하게 반환
      let text = "";
      if (data && Array.isArray(data.content)) {
        text = data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.status(r.status).json({ text, raw: data });
      return;
    }

    const { path = "", ...rest } = req.query;
    if (!target || (!path && target !== "file")) {
      res.status(400).json({ proxyError: "target과 path 파라미터가 필요합니다" });
      return;
    }

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(rest)) {
      if (k === "target") continue;
      if (Array.isArray(v)) v.forEach(x => params.append(k, x));
      else params.set(k, v);
    }

    let upstream;
    if (target === "file") {
      const fileUrl = req.query.u;
      if (!fileUrl) { res.status(400).json({ proxyError: "u(파일URL) 파라미터 필요" }); return; }
      const fwdHeaders = {};
      if (req.headers.range) fwdHeaders.range = req.headers.range;
      const r = await fetch(fileUrl, { headers: fwdHeaders });
      let ct = r.headers.get("content-type") || "application/pdf";
      if (/octet-stream/i.test(ct)) ct = "application/pdf";
      res.setHeader("Content-Type", ct);
      res.setHeader("Content-Disposition", 'inline; filename="nongsaro.pdf"');
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=86400");
      const acceptRanges = r.headers.get("accept-ranges");
      const contentRange = r.headers.get("content-range");
      const contentLength = r.headers.get("content-length");
      if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
      if (contentRange) res.setHeader("Content-Range", contentRange);
      if (contentLength) res.setHeader("Content-Length", contentLength);
      res.status(r.status);
      if (r.body && typeof r.body.getReader === "function") {
        const reader = r.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
      } else {
        const buf = Buffer.from(await r.arrayBuffer());
        res.send(buf);
      }
      return;
    } else if (target === "nongsaro") {
      const isCropEbook = path.startsWith("cropEbook");
      const key = isCropEbook ? process.env.CROPEBOOK_KEY : process.env.NONGSARO_KEY;
      if (!key) { res.status(500).json({ proxyError: (isCropEbook ? "CROPEBOOK_KEY" : "NONGSARO_KEY") + " 미설정" }); return; }
      params.set("apiKey", key);
      upstream = `http://api.nongsaro.go.kr/service/${path}?${params}`;
    } else if (target === "farmmap") {
      if (!process.env.PORTAL_KEY) { res.status(500).json({ proxyError: "PORTAL_KEY 미설정" }); return; }
      params.set("serviceKey", process.env.PORTAL_KEY);
      upstream = `https://apis.data.go.kr/B552895/rest/farmmap/${path}?${params}`;
    } else {
      res.status(400).json({ proxyError: "target은 nongsaro, farmmap, file, ai 중 하나여야 합니다" });
      return;
    }

    const r = await fetch(upstream);
    const bodyText = await r.text();
    const ct = r.headers.get("content-type") || "text/xml; charset=utf-8";
    res.setHeader("Content-Type", ct);
    res.status(r.status).send(bodyText);
  } catch (e) {
    res.status(502).json({ proxyError: "프록시 호출 실패: " + e.message });
  }
}
