/**
 * 창고 구역 정의
 *
 * 자체상품코드(custom_product_code)의 첫 글자(A~Z)로 구역을 결정합니다.
 * 예: "A001" → A구역, "B023" → B구역
 *
 * 구역 설정은 설정 화면에서 사용자가 직접 구성할 수 있습니다.
 * 미설정 시 기본 구역(DEFAULT_ZONE_CONFIG)이 사용됩니다.
 */

import { loadSettings } from './storage.js';

// ── 기본 구역 설정 (신규 테넌트 기본값) ──────────────────────

export const DEFAULT_MAJOR_ZONES = [
  { id: '1구역', label: '1구역', icon: '🟦', color: '#3b82f6', bg: '#1e3a5f', order: 0 },
  { id: '2구역', label: '2구역', icon: '🟨', color: '#f59e0b', bg: '#3d2c00', order: 1 },
  { id: '3구역', label: '3구역', icon: '🟩', color: '#22c55e', bg: '#052e16', order: 2 },
  { id: '4구역', label: '4구역', icon: '🟪', color: '#a855f7', bg: '#2e1065', order: 3 },
  { id: '미분류', label: '미분류', icon: '❓', color: '#64748b', bg: '#1e293b', order: 99 },
];

// 기본 소분류: A~Z를 4개 구역으로 균등 배분
export const DEFAULT_SUBCATEGORY_MAP = {
  A: { major: '1구역', label: 'A' },
  B: { major: '1구역', label: 'B' },
  C: { major: '1구역', label: 'C' },
  D: { major: '1구역', label: 'D' },
  E: { major: '1구역', label: 'E' },
  F: { major: '1구역', label: 'F' },
  G: { major: '2구역', label: 'G' },
  H: { major: '2구역', label: 'H' },
  I: { major: '2구역', label: 'I' },
  J: { major: '2구역', label: 'J' },
  K: { major: '2구역', label: 'K' },
  L: { major: '2구역', label: 'L' },
  M: { major: '3구역', label: 'M' },
  N: { major: '3구역', label: 'N' },
  O: { major: '3구역', label: 'O' },
  P: { major: '3구역', label: 'P' },
  Q: { major: '3구역', label: 'Q' },
  R: { major: '3구역', label: 'R' },
  S: { major: '4구역', label: 'S' },
  T: { major: '4구역', label: 'T' },
  U: { major: '4구역', label: 'U' },
  V: { major: '4구역', label: 'V' },
  W: { major: '4구역', label: 'W' },
  X: { major: '4구역', label: 'X' },
  Y: { major: '4구역', label: 'Y' },
  Z: { major: '4구역', label: 'Z' },
};

// ── 현재 테넌트 구역 설정 로드 ─────────────────────────────────

function getZoneConfig() {
  const settings = loadSettings();
  if (settings.zoneConfig) return settings.zoneConfig;
  return { subcategories: DEFAULT_SUBCATEGORY_MAP, majorZones: DEFAULT_MAJOR_ZONES };
}

export function getSubcategoryMap() {
  return getZoneConfig().subcategories || DEFAULT_SUBCATEGORY_MAP;
}

export function getMajorZoneList() {
  return getZoneConfig().majorZones || DEFAULT_MAJOR_ZONES;
}

// ── 기존 코드 호환 export ──────────────────────────────────────

export function getMajorZoneMap() {
  return Object.fromEntries(getMajorZoneList().map(z => [z.id, z]));
}

export let SUBCATEGORY_MAP = DEFAULT_SUBCATEGORY_MAP;
export let MAJOR_ZONES     = DEFAULT_MAJOR_ZONES;
export let MAJOR_ZONE_MAP  = Object.fromEntries(DEFAULT_MAJOR_ZONES.map(z => [z.id, z]));

// settings 변경 시 재로드용 (컴포넌트에서 필요 시 호출)
export function reloadZoneConfig() {
  const cfg = getZoneConfig();
  SUBCATEGORY_MAP = cfg.subcategories || DEFAULT_SUBCATEGORY_MAP;
  MAJOR_ZONES     = cfg.majorZones    || DEFAULT_MAJOR_ZONES;
  MAJOR_ZONE_MAP  = Object.fromEntries(MAJOR_ZONES.map(z => [z.id, z]));
}

// ── 핵심 함수 ──────────────────────────────────────────────────

/**
 * 자체상품코드에서 구역 정보 추출
 * @param {string|null} code - custom_product_code (예: "A001")
 */
export function classifyByCode(code) {
  const subMap = getSubcategoryMap();
  const majorMap = getMajorZoneMap();

  if (!code || typeof code !== 'string') {
    return { major: '미분류', letter: null, subLabel: '미분류' };
  }
  const letter = code.trim()[0]?.toUpperCase();
  if (!letter || !/[A-Z]/.test(letter)) {
    return { major: '미분류', letter: null, subLabel: '미분류' };
  }
  const sub = subMap[letter];
  if (sub) {
    return { major: sub.major, letter, subLabel: sub.label || letter };
  }
  // 매핑 없는 알파벳 → 미분류
  return { major: '미분류', letter, subLabel: letter };
}

export function getMajorZone(majorId) {
  return getMajorZoneMap()[majorId] || getMajorZoneMap()['미분류'] || DEFAULT_MAJOR_ZONES.at(-1);
}

/**
 * 소분류 정렬 (대분류 내 알파벳 순)
 */
export function compareSubcategories(_majorId, letterA, letterB) {
  return (letterA ?? '') < (letterB ?? '') ? -1 : (letterA ?? '') > (letterB ?? '') ? 1 : 0;
}

/**
 * 소분류 내 상품 정렬: 자체상품코드 숫자 부분 오름차순
 */
export function sortByProductCode(a, b) {
  const numA = parseInt((a.custom_product_code || '').slice(1)) || 0;
  const numB = parseInt((b.custom_product_code || '').slice(1)) || 0;
  return numA - numB;
}

/** 모달에 표시할 소분류 전체 목록 */
export function getSubcategoryList() {
  const subMap  = getSubcategoryMap();
  const majMap  = getMajorZoneMap();
  return Object.entries(subMap)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([letter, sub]) => {
      const major = majMap[sub.major] || getMajorZone('미분류');
      return {
        id: letter, letter,
        subLabel: sub.label || letter,
        major: sub.major,
        label: `${letter}${sub.label && sub.label !== letter ? ` — ${sub.label}` : ''}`,
        color: major.color,
        bg: major.bg,
        icon: major.icon,
      };
    });
}

// 기존 정적 export 호환 (ZoneGroupComponent 등에서 사용)
export const SUBCATEGORY_LIST = /* 런타임에 동적 생성 필요 시 getSubcategoryList() 사용 */ [];
export const ZONES     = DEFAULT_MAJOR_ZONES;
export const ZONE_IDS  = DEFAULT_MAJOR_ZONES.map(z => z.id);

export function getZone(id) {
  return getMajorZone(id);
}

export function sortZones(a, b) {
  return getMajorZone(a).order - getMajorZone(b).order;
}
