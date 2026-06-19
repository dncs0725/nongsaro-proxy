// 우리밭 팜맵 매니저 — API 프록시 (Vercel 서버리스 함수)
// 경로: /api/proxy?target=nongsaro&path=fildMnfct/fildMnfctList&sSeCode=335001
//      /api/proxy?target=farmmap&path=getFarmmapSoilAnalysisService/getCoordinateBasedSoilAnalsInfo&positionX=..&...
//
// 환경변수(Vercel 프로젝트 Settings → Environment Variables):
//   NONGSARO_KEY = 농사로 인증키
//   PORTAL_KEY   = 공공데이터포털 Decoding 키
//
// Vercel은 Node.js 환경이라 농사로의 http:// 호출이 정상 동작합니다.

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    const { target, path = "", ...rest } = req.query;
    if (!target || !path) {
      res.status(400).json({ proxyError: "target과 path 파라미터가 필요합니다" });
      return;
    }

    // 나머지 쿼리를 그대로 전달용 파라미터로
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(rest)) {
      if (Array.isArray(v)) v.forEach(x => params.append(k, x));
      else params.set(k, v);
    }

    let upstream;
    if (target === "nongsaro") {
      if (!process.env.NONGSARO_KEY) { res.status(500).json({ proxyError: "NONGSARO_KEY 미설정" }); return; }
      params.set("apiKey", process.env.NONGSARO_KEY);
      upstream = `http://api.nongsaro.go.kr/service/${path}?${params}`;
    } else if (target === "farmmap") {
      if (!process.env.PORTAL_KEY) { res.status(500).json({ proxyError: "PORTAL_KEY 미설정" }); return; }
      params.set("serviceKey", process.env.PORTAL_KEY);
      upstream = `https://apis.data.go.kr/B552895/rest/farmmap/${path}?${params}`;
    } else {
      res.status(400).json({ proxyError: "target은 nongsaro 또는 farmmap 이어야 합니다" });
      return;
    }

    const r = await fetch(upstream);
    const body = await r.text();
    const ct = r.headers.get("content-type") || "text/xml; charset=utf-8";
    res.setHeader("Content-Type", ct);
    res.status(r.status).send(body);
  } catch (e) {
    res.status(502).json({ proxyError: "프록시 호출 실패: " + e.message });
  }
}
