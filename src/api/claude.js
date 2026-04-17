/**
 * Claude API 클라이언트 (Cloudflare Worker 경유)
 * Worker의 /claude/classify 엔드포인트 호출
 */

import { loadSettings } from '../utils/storage.js';

function getWorkerUrl() {
  const settings = loadSettings();
  return (settings.workerUrl || '').replace(/\/$/, '');
}

/**
 * 상품 목록을 창고 구역으로 자동 분류
 * @param {Array<{product_name: string, product_code?: string}>} products
 * @returns {Promise<Object>} { [product_name]: zoneName }
 */
export async function classifyProducts(products) {
  const workerUrl = getWorkerUrl();
  const settings = loadSettings();

  if (!workerUrl) {
    // Worker 없으면 로컬 분류 폴백
    return localClassify(products);
  }

  try {
    const res = await fetch(`${workerUrl}/claude/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: products.map(p => ({ product_name: p.product_name || p.name })),
        customMappings: settings.customMappings || [],
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const zoneMap = {};
    for (const item of data.results || []) {
      zoneMap[item.name] = item.zone;
    }
    return zoneMap;
  } catch (e) {
    console.warn('Claude 분류 실패, 로컬 분류 사용:', e.message);
    return localClassify(products);
  }
}

/** 로컬 키워드 기반 분류 (폴백) — 범용 키워드 */
function localClassify(products) {
  const rules = [
    // 온도 관리 상품 (보편적)
    ['냉동', ['냉동', '아이스', '얼린', '빙과', '냉동식품']],
    ['냉장', ['냉장', '신선', '생물', '유제품', '육류', '채소', '과일', '버섯']],
    // 음료류 (보편적)
    ['음료', ['음료', '주스', '물', '탄산수', '탄산음료', '주류', '맥주', '와인', '소주', '커피', '차', '드링크']],
    // 증정/사은품
    ['사은품', ['사은품', '증정', '선물', '기프트', '덤', '무료']],
    // 식품
    ['식품', ['식품', '간식', '과자', '라면', '즉석', '소스', '양념', '레토르트']],
    // 생활용품
    ['생활용품', ['생활용품', '소모품', '청소', '위생', '포장재', '비닐', '박스']],
  ];

  const zoneMap = {};
  for (const p of products) {
    const name = p.product_name || p.name || '';
    let zone = '기타';
    for (const [z, keywords] of rules) {
      if (keywords.some(kw => name.includes(kw))) { zone = z; break; }
    }
    zoneMap[name] = zone;
  }
  return zoneMap;
}
