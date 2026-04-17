const PICKERS_KEY = 'pm_pickers';
const SESSION_KEY = 'pm_picker_session';

// ── 피커 목록 ──────────────────────────────────────────────

export function getPickers() {
  try {
    return JSON.parse(localStorage.getItem(PICKERS_KEY) || '[]');
  } catch {
    return [];
  }
}

/** 피커 추가 또는 lastLogin 갱신. 이름 중복 저장 방지. */
export function upsertPicker(name) {
  const pickers = getPickers();
  const idx = pickers.findIndex(p => p.name === name);
  const now = Date.now();
  if (idx >= 0) {
    pickers[idx].lastLogin = now;
  } else {
    pickers.push({ id: now.toString(), name, lastLogin: now });
  }
  localStorage.setItem(PICKERS_KEY, JSON.stringify(pickers));
}

export function removePicker(name) {
  const pickers = getPickers().filter(p => p.name !== name);
  localStorage.setItem(PICKERS_KEY, JSON.stringify(pickers));
}

// ── 피커 세션 (현재 로그인한 피커) ──────────────────────────

export function getPickerSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setPickerSession(name) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ name, loginAt: Date.now() }));
  upsertPicker(name);
}

export function clearPickerSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
