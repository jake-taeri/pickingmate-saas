/**
 * localStorage 유틸리티
 */

const KEYS = {
  SETTINGS: 'pm_settings',
  PICKING_STATE: 'pm_picking',
  ZONE_CACHE: 'pm_zones',
};

// ── Settings ──────────────────────────────

// 카페24 주문 상태 코드 목록 (UI·API 공용)
export const ORDER_STATUSES = [
  { code: 'F1',  label: '입금전' },
  { code: 'N10', label: '배송준비중' },
  { code: 'N20', label: '배송대기' },
  { code: 'N30', label: '배송중' },
  { code: 'N40', label: '배송완료' },
  { code: 'C0',  label: '취소' },
  { code: 'R0',  label: '반품' },
];

export function getStatusLabel(code) {
  return ORDER_STATUSES.find(s => s.code === code)?.label ?? code;
}

export const DEFAULT_SETTINGS = {
  workerUrl: '',
  mallId: '',                // 카페24 Mall ID (예: yourstore)
  customMappings: [],        // [{ id, keyword, zone }]
  voiceEnabled: true,        // 음성 안내
  pickingListStatus: 'N20',  // 주문 목록 조회 기준 상태 (배송대기)
  pickingWorkStatus: 'N30',  // 피킹 진행 시 상태 (배송중)
  zoneConfig: null,          // null = 기본 구역 사용, 커스텀 시 { subcategories, majorZones }
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEYS.SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

// ── Picking State ─────────────────────────

export function loadPickingState() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.PICKING_STATE) || '{}');
  } catch (_) {
    return {};
  }
}

export function savePickingState(state) {
  localStorage.setItem(KEYS.PICKING_STATE, JSON.stringify(state));
}

export function getOrderPickingState(orderId) {
  const all = loadPickingState();
  return all[orderId] || { checkedItems: [], zoneOverrides: {}, startedAt: null, completedAt: null };
}

export function updateOrderPickingState(orderId, updates) {
  const all = loadPickingState();
  all[orderId] = { ...getOrderPickingState(orderId), ...updates };
  savePickingState(all);
  return all[orderId];
}

export function resetOrderPickingState(orderId) {
  const all = loadPickingState();
  delete all[orderId];
  savePickingState(all);
}

// ── Zone Cache (분류 결과 캐시) ─────────────

export function loadZoneCache() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.ZONE_CACHE) || '{}');
  } catch (_) {
    return {};
  }
}

export function getOrderZoneCache(orderId) {
  return loadZoneCache()[orderId] || null;
}

export function setOrderZoneCache(orderId, zoneMap) {
  const all = loadZoneCache();
  all[orderId] = zoneMap;
  // 오래된 캐시 정리 (최근 50건만 유지)
  const keys = Object.keys(all);
  if (keys.length > 50) {
    delete all[keys[0]];
  }
  localStorage.setItem(KEYS.ZONE_CACHE, JSON.stringify(all));
}

export function clearZoneCache(orderId) {
  const all = loadZoneCache();
  delete all[orderId];
  localStorage.setItem(KEYS.ZONE_CACHE, JSON.stringify(all));
}

// ── Product Image Cache ────────────────────
// { [product_no]: { image: string|null, ts: number } }
// 7일 TTL

const PRODUCT_CACHE_KEY = 'pm_product_images';
const PRODUCT_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const PRODUCT_CACHE_MAX = 500;

export function loadProductImageCache() {
  try {
    return JSON.parse(localStorage.getItem(PRODUCT_CACHE_KEY) || '{}');
  } catch (_) {
    return {};
  }
}

export function getProductImages(productNos) {
  const cache = loadProductImageCache();
  const now = Date.now();
  const hit = {};
  const miss = [];
  for (const no of productNos) {
    const entry = cache[no];
    if (entry && now - entry.ts < PRODUCT_CACHE_TTL) {
      hit[no] = entry.image;
    } else {
      miss.push(no);
    }
  }
  return { hit, miss };
}

export function saveProductImages(imageMap) {
  let cache = loadProductImageCache();
  const now = Date.now();
  for (const [no, image] of Object.entries(imageMap)) {
    cache[no] = { image, ts: now };
  }
  // 최대 500개 초과 시 오래된 항목 제거
  const entries = Object.entries(cache);
  if (entries.length > PRODUCT_CACHE_MAX) {
    entries.sort((a, b) => a[1].ts - b[1].ts);
    cache = Object.fromEntries(entries.slice(entries.length - PRODUCT_CACHE_MAX));
  }
  localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(cache));
}
