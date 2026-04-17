import { loadSettings } from './storage.js';

function getWorkerUrl() {
  return (loadSettings().workerUrl || '').replace(/\/$/, '');
}

/** 현재 모든 락 조회. 반환: { [orderId]: { pickerName, startedAt } } */
export async function fetchAllLocks() {
  const base = getWorkerUrl();
  if (!base) return {};
  try {
    const res = await fetch(`${base}/picking-locks`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * 락 획득 시도.
 * @returns {{ ok: boolean, conflict?: boolean, pickerName?: string }}
 */
export async function acquireLock(orderId, pickerName) {
  const base = getWorkerUrl();
  if (!base) return { ok: true };
  try {
    const res = await fetch(`${base}/picking-locks/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickerName }),
      signal: AbortSignal.timeout(5000),
    });
    return await res.json();
  } catch {
    return { ok: true }; // 네트워크 오류 시 낙관적 허용
  }
}

/** 락 해제 */
export async function releaseLock(orderId, pickerName, force = false) {
  const base = getWorkerUrl();
  if (!base) return;
  const params = new URLSearchParams({ pickerName });
  if (force) params.set('force', '1');
  try {
    await fetch(`${base}/picking-locks/${orderId}?${params}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(5000),
    });
  } catch {}
}

/** Heartbeat — 30초마다 호출해 TTL 갱신 */
export async function sendHeartbeat(orderId, pickerName) {
  const base = getWorkerUrl();
  if (!base) return;
  try {
    await fetch(`${base}/picking-locks/${orderId}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickerName }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {}
}
