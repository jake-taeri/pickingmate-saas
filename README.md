# PickingMate SaaS

카페24 · Shopify 쇼핑몰을 위한 피킹 관리 SaaS.
기존 WMS 대비 1/10 가격으로 피킹 효율을 높여줍니다.

## 플랜

| 플랜 | 가격 | 주요 기능 |
|------|------|-----------|
| Starter | 9,900원/월 | 피킹리스트 생성, 피킹 앱 |
| Pro | 29,900원/월 | + 음성 안내, 바코드 스캔, 멀티 피커 |
| Business | 59,900원/월 | + 피킹 통계, 피커 성과 분석 |

## 지원 플랫폼

- 카페24 (Cafe24)
- Shopify (예정)

## 개발 구조

```
pickingmate-saas/
├── src/          # React 18 프론트엔드 (Vite + PWA)
├── worker/       # Cloudflare Worker (멀티테넌트 API 프록시)
└── ...
```

## 로컬 개발

```bash
npm install
npm run dev
```

## 관련 프로젝트

- `pickingmate/` — 와캠핑 전용 버전 (레퍼런스 구현)
