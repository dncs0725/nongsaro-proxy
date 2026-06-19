# 농사로/팜맵 API 프록시 (Vercel)

앱(https) → 이 프록시(Vercel, https) → 농사로(http)/팜맵 중계.
Vercel은 Node.js 환경이라 농사로의 http 호출이 정상 동작합니다.
(Cloudflare Workers에서 522 나던 문제 해결)

## 폴더 구조
```
vercel-proxy/
  ├─ api/
  │   └─ proxy.js     ← 서버리스 함수 (핵심)
  ├─ package.json
  └─ README.md
```

## 배포 순서 (GitHub 연동)

### 1. GitHub에 올리기
1. github.com 로그인 → New repository (이름 예: `nongsaro-proxy`, Public/Private 무관)
2. 이 `vercel-proxy` 폴더 안의 파일들(api/proxy.js, package.json, README.md)을 그 저장소에 업로드
   - 웹에서 "uploading an existing file"로 끌어다 놓아도 됩니다
   - ⚠️ `api/proxy.js` 의 폴더 구조(api 폴더 안에 proxy.js)를 꼭 유지하세요

### 2. Vercel에 연결
1. vercel.com → GitHub 계정으로 로그인
2. Add New → Project → 방금 만든 저장소 Import
3. 별다른 설정 없이 Deploy (프레임워크 감지: Other 그대로 OK)

### 3. 환경변수 추가 (중요)
Vercel 프로젝트 → Settings → Environment Variables 에서 2개 추가:
- `NONGSARO_KEY` = 농사로 인증키
- `PORTAL_KEY`   = 공공데이터포털 Decoding 키

추가 후 Deployments → 최신 배포 → Redeploy (환경변수 반영 위해)

### 4. 주소 확인
배포되면 `https://nongsaro-proxy-xxxx.vercel.app` 형태 주소가 생깁니다.

## 테스트 (브라우저 주소창)
```
https://(내주소).vercel.app/api/proxy?target=nongsaro&path=fildMnfct/fildMnfctList&sSeCode=335001
```
→ 농사로 텃밭가꾸기 목록 XML이 나오면 성공.

## 앱에서 쓰기
테스트 앱의 "프록시 주소" 칸에 `https://(내주소).vercel.app/api/proxy` 형식으로 넣으면 됩니다.
(앱 코드가 ?target=...&path=... 형식으로 호출하도록 맞춰져 있어야 함 — 함께 드린 앱 버전 사용)
