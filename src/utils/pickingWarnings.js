/**
 * 오피킹(잘못된 상품 피킹) 방지 유사 상품 감지
 */

const VOLUME_RE = /(\d+(?:\.\d+)?)\s*(L|l|ml|mL|ML|kg|KG|g|G)\b/g;

function extractVolumes(name) {
  const vols = [];
  const re = new RegExp(VOLUME_RE.source, 'g');
  let m;
  while ((m = re.exec(name)) !== null) {
    const unit = m[2].toLowerCase().replace('ml', 'ml').replace('kg', 'kg');
    vols.push({ value: parseFloat(m[1]), unit, raw: m[0].trim() });
  }
  return vols;
}

function stripVolumes(name) {
  return name.replace(new RegExp(VOLUME_RE.source, 'g'), '').replace(/\s+/g, ' ').trim();
}

/**
 * 두 상품이 혼동 가능한지 판별
 * @returns {{ reason: string, type: 'volume' | 'prefix' } | null}
 */
function checkSimilar(a, b) {
  const nameA = (a.product_name || '').trim();
  const nameB = (b.product_name || '').trim();
  if (!nameA || !nameB || nameA === nameB) return null;

  // 규칙 1: 용량/중량 혼동 — 베이스명 동일 + 용량 다름
  const volsA = extractVolumes(nameA);
  const volsB = extractVolumes(nameB);
  if (volsA.length > 0 && volsB.length > 0) {
    const baseA = stripVolumes(nameA);
    const baseB = stripVolumes(nameB);
    if (baseA.length >= 2 && baseA === baseB) {
      const rawA = volsA.map(v => v.raw).join('+');
      const rawB = volsB.map(v => v.raw).join('+');
      if (rawA !== rawB) {
        return {
          reason: `용량 혼동 주의 (${rawA} vs ${rawB})`,
          type: 'volume',
        };
      }
    }
  }

  // 규칙 2: 공통 앞글자 3자 이상이면서 짧은 쪽 이름의 50% 이상 공유
  let prefixLen = 0;
  const minLen = Math.min(nameA.length, nameB.length);
  for (let i = 0; i < minLen; i++) {
    if (nameA[i] === nameB[i]) prefixLen++;
    else break;
  }
  if (prefixLen >= 3 && prefixLen / minLen >= 0.5) {
    return {
      reason: `유사 상품명 (공통: "${nameA.slice(0, prefixLen)}")`,
      type: 'prefix',
    };
  }

  return null;
}

/**
 * 스캔된 상품과 주문 내 다른 상품 중 혼동 가능한 상품 목록 반환
 * @param {Object} matchedItem - 스캔 매칭된 상품
 * @param {Object[]} allItems  - 주문 내 전체 상품 목록
 * @returns {{ item: Object, reason: string, type: string }[]}
 */
export function detectSimilarItems(matchedItem, allItems) {
  if (!matchedItem || !allItems || allItems.length === 0) return [];

  const warnings = [];
  for (const other of allItems) {
    if (other.order_item_code === matchedItem.order_item_code) continue;
    const sim = checkSimilar(matchedItem, other);
    if (sim) warnings.push({ item: other, reason: sim.reason, type: sim.type });
  }
  return warnings;
}
