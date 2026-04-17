# 피킹메이트 배포 가이드

## 1단계: Cloudflare Worker 배포

```bash
cd worker

# Wrangler 설치
npm install -g wrangler

# 로그인
wrangler login

# KV 네임스페이스 생성
wrangler kv:namespace create PICKINGMATE_KV
# → 출력된 id를 wrangler.toml의 id = "YOUR_KV_NAMESPACE_ID" 에 입력

# Worker 배포
wrangler deploy

# 시크릿 설정 (차례로 입력)
wrangler secret put CAFE24_CLIENT_SECRET
# → OqoR3fuhc6aFN6e3NkrXfC

wrangler secret put CAFE24_ACCESS_TOKEN
# → McNGoS5GCJ8lYgKlbIqw6D

wrangler secret put CAFE24_REFRESH_TOKEN
# → icMD8crxBhfDZgnbNOS8BC

wrangler secret put CLAUDE_API_KEY
# → Anthropic API 키 입력
```

배포 완료 후 Worker URL 확인 (예: `https://pickingmate-proxy.your-account.workers.dev`)

---

## 2단계: Vercel 배포

```bash
cd ..  # 프로젝트 루트

# Vercel CLI 설치
npm install -g vercel

# 배포
vercel --prod
# → 배포 URL 확인 (예: https://pickingmate.vercel.app)

# 커스텀 도메인 설정 (pickingmate.shop)
vercel domains add pickingmate.shop
```

---

## 3단계: 앱 설정

1. 배포된 앱에 접속
2. 우상단 **설정** 아이콘 클릭
3. **Worker URL** 에 1단계에서 확인한 URL 입력 후 저장
4. **연결 확인** 버튼으로 정상 연결 확인

---

## 구조 요약

```
pickingmate/
├── src/               ← React 앱 (Vite)
│   ├── api/           ← cafe24.js, claude.js
│   ├── components/    ← UI 컴포넌트
│   └── utils/         ← zones, storage, formatters
├── worker/            ← Cloudflare Worker
│   ├── index.js       ← 메인 워커 코드
│   └── wrangler.toml  ← 배포 설정
├── public/            ← PWA 아이콘, favicon
└── vercel.json        ← Vercel SPA 라우팅 설정
```

## Worker 엔드포인트

| 경로 | 설명 |
|------|------|
| `GET /health` | 헬스체크 |
| `GET /status` | 토큰 상태 확인 |
| `GET /cafe24/api/v2/admin/orders?order_status=N20` | 배송대기 주문 조회 |
| `GET /cafe24/api/v2/admin/orders/{id}/items` | 주문 상품 조회 |
| `PUT /cafe24/api/v2/admin/orders/{id}` | 주문 상태 변경 |
| `POST /claude/classify` | 상품 구역 자동 분류 |
