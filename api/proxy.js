// 우리밭 팜맵 매니저 — API 프록시 (Vercel 서버리스 함수)
// 경로: /api/proxy?target=nongsaro&path=fildMnfct/fildMnfctList&sSeCode=335001
//      /api/proxy?target=farmmap&path=getFarmmapSoilAnalysisService/getCoordinateBasedSoilAnalsInfo&positionX=..&...
//
// 환경변수(Vercel 프로젝트 Settings → Environment Variables):
//   NONGSARO_KEY = 농사로 인증키 (텃밭·주간농사·병해충 공통)
//   CROPEBOOK_KEY = 작목별농업기술정보 전용 인증키 (서비스별 키가 다른 경우)
//   PORTAL_KEY   = 공공데이터포털 Decoding 키 (팜맵용)
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
    if (!target || (!path && target !== "file")) {
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
    if (target === "file") {
      // 농사로 첨부파일(PDF 등) 중계: ?target=file&u=<인코딩된 원본URL>
      // http 파일을 https로 받아 화면에 표시할 수 있게 함. 키 불필요.
      const fileUrl = req.query.u;
      if (!fileUrl) { res.status(400).json({ proxyError: "u(파일URL) 파라미터 필요" }); return; }
      const r = await fetch(fileUrl);
      const buf = Buffer.from(await r.arrayBuffer());
      const ct = r.headers.get("content-type") || "application/pdf";
      res.setHeader("Content-Type", ct);
      res.setHeader("Content-Disposition", "inline"); // 다운로드 대신 화면 표시
      res.status(r.status).send(buf);
      return;
    } else if (target === "nongsaro") {
      // 작목별(cropEbook)은 전용 키, 나머지는 공통 키 사용
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
