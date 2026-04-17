/**
 * 피킹 소요시간 측정 유틸리티
 * - 알바에게 완전히 투명 (UI 영향 없음)
 * - 관리자 전용 통계 분석 도구
 */
import { classifyByCode } from './zones.js';

const METRICS_KEY = 'pm_picking_metrics';
const MAX_SESSIONS = 500;
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90일

// ── KST 헬퍼 ──────────────────────────────────────────────────
function kstDate(ts) {
  const d = new Date(ts + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}
function kstHour(ts) {
  const d = new Date(ts + 9 * 60 * 60 * 1000);
  return d.getUTCHours();
}

// ── 스토리지 CRUD ─────────────────────────────────────────────
function loadRaw() {
  try { return JSON.parse(localStorage.getItem(METRICS_KEY) || '[]'); }
  catch { return []; }
}
function saveRaw(sessions) {
  try { localStorage.setItem(METRICS_KEY, JSON.stringify(sessions)); } catch {}
}

export function loadPickingSessions() { return loadRaw(); }
export function clearPickingMetrics() { localStorage.removeItem(METRICS_KEY); }

/** 세션 저장 (신규 추가 또는 id 기준 덮어쓰기) */
export function savePickingSession(session) {
  let sessions = loadRaw();
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.push(session);

  // TTL & 최대 개수 정리
  const cutoff = Date.now() - TTL_MS;
  sessions = sessions.filter(s => (s.sessionStartAt || 0) > cutoff);
  if (sessions.length > MAX_SESSIONS) {
    sessions.sort((a, b) => (a.sessionStartAt || 0) - (b.sessionStartAt || 0));
    sessions = sessions.slice(sessions.length - MAX_SESSIONS);
  }
  saveRaw(sessions);
}

// ── 세션 생명주기 (BarcodeScanner에서 호출) ───────────────────

/** 새 세션 오브젝트 생성 */
export function createPickingSession({ orderId, pickerName, totalItems }) {
  return {
    id: `${orderId}_${pickerName}_${Date.now()}`,
    orderId,
    pickerName,
    date: null,
    hour: null,
    sessionStartAt: null,
    sessionEndAt: null,
    totalMs: 0,
    itemsCompleted: 0,
    totalItems,
    complete: false,
    items: [],
    _lastConfirmAt: null,
    _pendingScan: null,
  };
}

/** 첫 스캔 성공 시 세션 시작 시각 기록 */
export function sessionOnFirstScan(session) {
  if (session.sessionStartAt) return;
  const now = Date.now();
  session.sessionStartAt = now;
  session.date = kstDate(now);
  session.hour = kstHour(now);
}

/** 스캔 매칭 성공 시 — 항목 스캔 시각 기록 */
export function sessionOnScan(session, matchedItem) {
  session._pendingScan = { item: matchedItem, scanAt: Date.now() };
}

/** "담았습니다" 확인 시 — 항목 완료 기록 */
export function sessionOnConfirm(session) {
  if (!session._pendingScan) return;
  const { item, scanAt } = session._pendingScan;
  const now = Date.now();
  const { major: majorZone, letter: zone } = classifyByCode(item.custom_product_code);
  session.items.push({
    code: item.order_item_code,
    productName: item.product_name,
    customCode: item.custom_product_code || '',
    zone: zone || '?',
    majorZone: majorZone || '미분류',
    quantity: item.quantity,
    scanAt,
    confirmAt: now,
    pickMs: now - scanAt,
    // 이전 항목 확인 → 이 항목 스캔까지의 이동 시간 (첫 항목은 null)
    interMs: session._lastConfirmAt ? scanAt - session._lastConfirmAt : null,
  });
  session.itemsCompleted++;
  session._lastConfirmAt = now;
  session._pendingScan = null;
}

/** 세션 종료 및 저장 (완료 여부 판단 포함) */
export function finalizePickingSession(session, forceComplete = false) {
  const now = Date.now();
  session.sessionEndAt = now;
  if (session.sessionStartAt) {
    session.totalMs = now - session.sessionStartAt;
  }
  session.complete = forceComplete || session.itemsCompleted >= session.totalItems;

  // 내부 필드 정리
  delete session._pendingScan;
  delete session._lastConfirmAt;

  // 최소 1개 이상 완료해야 기록
  if (session.sessionStartAt && session.itemsCompleted > 0) {
    savePickingSession(session);
  }
}

// ── 통계 계산 ─────────────────────────────────────────────────

function completeSessions(sessions) {
  return sessions.filter(s => s.complete);
}

/** 전체 요약 통계 */
export function statsSummary(sessions) {
  const complete = completeSessions(sessions);
  const totalItems = complete.reduce((s, sess) => s + sess.itemsCompleted, 0);
  const totalMs = complete.reduce((s, sess) => s + sess.totalMs, 0);
  return {
    totalSessions: sessions.length,
    completeSessions: complete.length,
    totalItems,
    avgSecsPerItem: totalItems ? Math.round(totalMs / totalItems / 1000) : 0,
    avgMinsPerOrder: complete.length ? Math.round(totalMs / complete.length / 60000 * 10) / 10 : 0,
  };
}

/** 피커별 통계 */
export function statsPerPicker(sessions) {
  const map = {};
  for (const s of completeSessions(sessions)) {
    if (!s.pickerName) continue;
    if (!map[s.pickerName]) {
      map[s.pickerName] = { name: s.pickerName, sessions: 0, totalMs: 0, itemsCompleted: 0 };
    }
    const p = map[s.pickerName];
    p.sessions++;
    p.totalMs += s.totalMs;
    p.itemsCompleted += s.itemsCompleted;
  }
  return Object.values(map).map(p => ({
    ...p,
    avgSecsPerItem: p.itemsCompleted ? Math.round(p.totalMs / p.itemsCompleted / 1000) : 0,
    avgMinsPerOrder: p.sessions ? Math.round(p.totalMs / p.sessions / 60000 * 10) / 10 : 0,
    ordersPerHour: p.sessions && p.totalMs
      ? Math.round(3600000 / (p.totalMs / p.sessions) * 10) / 10
      : 0,
  })).sort((a, b) => a.avgSecsPerItem - b.avgSecsPerItem);
}

/** 상품별 평균 피킹 시간 (2회 이상) */
export function statsPerProduct(sessions) {
  const map = {};
  for (const s of sessions) {
    for (const item of (s.items || [])) {
      if (!item.confirmAt) continue;
      const key = item.customCode || item.productName;
      if (!map[key]) {
        map[key] = {
          code: item.customCode,
          name: item.productName,
          zone: item.zone,
          majorZone: item.majorZone,
          count: 0,
          totalPickMs: 0,
        };
      }
      map[key].count++;
      map[key].totalPickMs += item.pickMs || 0;
    }
  }
  return Object.values(map)
    .filter(p => p.count >= 2)
    .map(p => ({ ...p, avgPickSecs: Math.round(p.totalPickMs / p.count / 1000) }))
    .sort((a, b) => b.avgPickSecs - a.avgPickSecs);
}

/** 시간대별 효율 (KST 기준, 시 단위) */
export function statsPerHour(sessions) {
  const map = {};
  for (const s of completeSessions(sessions)) {
    const h = s.hour;
    if (h == null) continue;
    if (!map[h]) map[h] = { hour: h, sessions: 0, totalMs: 0, itemsCompleted: 0 };
    map[h].sessions++;
    map[h].totalMs += s.totalMs;
    map[h].itemsCompleted += s.itemsCompleted;
  }
  return Object.values(map)
    .map(h => ({
      ...h,
      avgSecsPerItem: h.itemsCompleted
        ? Math.round(h.totalMs / h.itemsCompleted / 1000)
        : 0,
    }))
    .sort((a, b) => a.hour - b.hour);
}

/** 구역별 통계 */
export function statsPerZone(sessions) {
  const map = {};
  for (const s of sessions) {
    for (const item of (s.items || [])) {
      if (!item.confirmAt) continue;
      const z = item.majorZone || '미분류';
      if (!map[z]) map[z] = { zone: z, count: 0, totalPickMs: 0 };
      map[z].count++;
      map[z].totalPickMs += item.pickMs || 0;
    }
  }
  return Object.values(map)
    .map(z => ({ ...z, avgPickSecs: z.count ? Math.round(z.totalPickMs / z.count / 1000) : 0 }))
    .sort((a, b) => b.avgPickSecs - a.avgPickSecs);
}

/** 일별 리포트 (최근 30일) */
export function statsByDate(sessions) {
  const map = {};
  for (const s of sessions) {
    const d = s.date;
    if (!d) continue;
    if (!map[d]) map[d] = { date: d, sessions: 0, complete: 0, itemsCompleted: 0, totalMs: 0 };
    map[d].sessions++;
    if (s.complete) {
      map[d].complete++;
      map[d].totalMs += s.totalMs;
      map[d].itemsCompleted += s.itemsCompleted;
    }
  }
  return Object.values(map)
    .map(d => ({
      ...d,
      avgMinsPerOrder: d.complete
        ? Math.round(d.totalMs / d.complete / 60000 * 10) / 10
        : 0,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);
}

/** 창고 최적화 인사이트 */
export function generateInsights(sessions) {
  const insights = [];
  const complete = completeSessions(sessions);

  if (complete.length < 3) {
    insights.push({
      type: 'info', icon: '💡',
      text: `인사이트를 보려면 완료된 피킹이 3건 이상 필요합니다 (현재 ${complete.length}건)`,
    });
    return insights;
  }

  // 가장 느린 구역
  const zones = statsPerZone(sessions);
  if (zones.length > 0) {
    const slow = zones[0];
    insights.push({
      type: 'zone', icon: '⏱️',
      text: `${slow.zone} 구역 피킹이 평균 ${slow.avgPickSecs}초로 가장 오래 걸립니다`,
    });
  }

  // 가장 효율적인 시간대
  const hours = statsPerHour(sessions);
  if (hours.length >= 2) {
    const best = hours.reduce((a, b) => a.avgSecsPerItem < b.avgSecsPerItem ? a : b);
    const worst = hours.reduce((a, b) => a.avgSecsPerItem > b.avgSecsPerItem ? a : b);
    if (best.hour !== worst.hour) {
      insights.push({
        type: 'time', icon: '🕐',
        text: `${best.hour}시대가 상품당 ${best.avgSecsPerItem}초로 가장 효율적입니다 (비효율: ${worst.hour}시대 ${worst.avgSecsPerItem}초)`,
      });
    }
  }

  // 피커 비교
  const pickers = statsPerPicker(sessions);
  if (pickers.length >= 2) {
    const fastest = pickers[0];
    const slowest = pickers[pickers.length - 1];
    insights.push({
      type: 'picker', icon: '👤',
      text: `${fastest.name}님이 상품당 ${fastest.avgSecsPerItem}초로 가장 빠릅니다 (${slowest.name}님: ${slowest.avgSecsPerItem}초)`,
    });
  }

  // 가장 오래 걸리는 상품 (3회 이상)
  const products = statsPerProduct(sessions).filter(p => p.count >= 3);
  if (products.length > 0) {
    const hard = products[0];
    const name = hard.name.length > 22 ? hard.name.slice(0, 22) + '…' : hard.name;
    insights.push({
      type: 'product', icon: '📦',
      text: `"${name}" 피킹이 평균 ${hard.avgPickSecs}초로 가장 오래 걸립니다`,
    });
  }

  // 구역 간 최대 이동 시간
  let maxInterMs = 0, maxPair = null;
  for (const s of sessions) {
    for (let i = 1; i < (s.items || []).length; i++) {
      const prev = s.items[i - 1];
      const curr = s.items[i];
      if (prev.majorZone !== curr.majorZone && curr.interMs != null && curr.interMs > maxInterMs) {
        maxInterMs = curr.interMs;
        maxPair = `${prev.majorZone} → ${curr.majorZone}`;
      }
    }
  }
  if (maxPair && maxInterMs > 30000) {
    insights.push({
      type: 'movement', icon: '🚶',
      text: `${maxPair} 구역 이동이 최대 ${Math.round(maxInterMs / 1000)}초로 나타납니다 — 피킹 순서 조정을 검토하세요`,
    });
  }

  return insights;
}

/** JSON 내보내기 (다운로드) */
export function exportMetricsJson() {
  const sessions = loadRaw();
  const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pickingmate_metrics_${kstDate(Date.now())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
