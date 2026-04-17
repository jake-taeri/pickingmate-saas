/**
 * PickingMate SaaS Cloudflare Worker
 * - 멀티테넌트: X-Mall-Id 헤더로 쇼핑몰 식별
 * - 카페24 API CORS 우회 + Access Token 자동 갱신 (mall ID별)
 * - Claude API 프록시 (상품 구역 자동 분류)
 * - Rate Limit 관리 (X-Api-Call-Limit 헤더 기반)
 *
 * 테넌트 최초 등록:
 *   POST /admin/set-tokens  { mall_id, refresh_token }
 *
 * KV 바인딩: KV (binding = "KV")
 * Secrets: CAFE24_CLIENT_ID, CAFE24_CLIENT_SECRET, CLAUDE_API_KEY, ADMIN_SECRET
 */

const TOKEN_BUFFER_MS    = 5 * 60_000;
const REFRESH_MIN_TTL    = 2 * 86400_000;
const LOCK_TTL_SEC       = 15;
const KV_APP_SETTINGS    = 'app_settings';
const TRIAL_DAYS         = 14;

// mall ID별 KV 키
function tokenKey(mallId)   { return `cafe24_tokens:${mallId}`; }
function tenantKey(mallId)  { return `tenant:${mallId}`; }
function lockKey(mallId)    { return `token_lock:${mallId}`; }
function cafe24Base(mallId) { return `https://${mallId}.cafe24api.com`; }

// mall ID 유효성 검사 (영문소문자+숫자, 2~20자)
function isValidMallId(mallId) {
  return typeof mallId === 'string' && /^[a-z0-9]{2,20}$/.test(mallId);
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

// 아이솔레이트 내 동시 갱신 중복 방지 (mall ID별)
const _refreshPromises = {};

function corsResponse(body = null, status = 204, extra = {}) {
  return new Response(body, { status, headers: { ...CORS, ...extra } });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// ──────────────────────────────────────────
// 토큰 관리 (mall ID별 멀티테넌트)
// ──────────────────────────────────────────

async function loadTokens(env, mallId) {
  if (env.KV) {
    try {
      const stored = await env.KV.get(tokenKey(mallId), 'json');
      if (stored?.refresh_token) return stored;
    } catch (_) {}
  }
  // KV에 없음 → 미등록 테넌트
  return null;
}

async function saveTokens(env, mallId, tokens) {
  if (!env.KV) return;
  try {
    const ttlSec = Math.max(86400, Math.ceil((tokens.refresh_expires_at - Date.now()) / 1000) + 86400);
    await env.KV.put(tokenKey(mallId), JSON.stringify(tokens), { expirationTtl: ttlSec });
  } catch (e) {
    console.error(`KV saveTokens(${mallId}) 실패:`, e.message);
  }
}

async function doRefresh(env, mallId, currentTokens) {
  const clientId     = env.CAFE24_CLIENT_ID     || '';
  const clientSecret = env.CAFE24_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) throw new Error('CAFE24_CLIENT_ID / SECRET 미설정');
  if (!currentTokens.refresh_token) throw new Error(`${mallId}: refresh_token 없음`);

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${cafe24Base(mallId)}/api/v2/oauth/token`, {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: currentTokens.refresh_token,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 || res.status === 401) {
      throw new Error(`${mallId}: refresh_token 만료 또는 무효 (${res.status})`);
    }
    throw new Error(`${mallId}: 토큰 갱신 실패 ${res.status}: ${text}`);
  }

  const data = await res.json();
  const now  = Date.now();
  return {
    access_token:       data.access_token,
    refresh_token:      data.refresh_token || currentTokens.refresh_token,
    access_expires_at:  now + (data.expires_in || 7200) * 1000,
    refresh_expires_at: now + 14 * 86400_000,
  };
}

async function refreshWithLock(env, mallId, currentTokens) {
  if (_refreshPromises[mallId]) return _refreshPromises[mallId];

  _refreshPromises[mallId] = (async () => {
    if (env.KV) {
      try {
        const lk = lockKey(mallId);
        const lockVal = await env.KV.get(lk);
        if (lockVal) {
          await sleep(1500);
          const fresh = await loadTokens(env, mallId);
          if (fresh?.access_expires_at > Date.now()) return fresh;
        }
        await env.KV.put(lk, '1', { expirationTtl: LOCK_TTL_SEC });
      } catch (_) {}
    }
    try {
      const newTokens = await doRefresh(env, mallId, currentTokens);
      await saveTokens(env, mallId, newTokens);
      console.log(`[${mallId}] 토큰 갱신 성공`);
      return newTokens;
    } finally {
      if (env.KV) { try { await env.KV.delete(lockKey(mallId)); } catch (_) {} }
      delete _refreshPromises[mallId];
    }
  })();

  return _refreshPromises[mallId];
}

async function getValidToken(env, mallId, forceRefresh = false) {
  const tokens = await loadTokens(env, mallId);
  if (!tokens) throw new Error(`${mallId}: 등록되지 않은 Mall ID입니다. 관리자에게 문의하세요.`);

  const accessNearExpiry  = Date.now() >= tokens.access_expires_at - TOKEN_BUFFER_MS;
  const refreshNearExpiry = tokens.refresh_expires_at
    ? Date.now() >= tokens.refresh_expires_at - REFRESH_MIN_TTL : false;

  if (forceRefresh || accessNearExpiry || refreshNearExpiry) {
    const refreshed = await refreshWithLock(env, mallId, tokens);
    return { token: refreshed.access_token, tokens: refreshed };
  }
  return { token: tokens.access_token, tokens };
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ──────────────────────────────────────────
// 카페24 API 프록시
// ──────────────────────────────────────────

function getDateString(date) {
  return date.toISOString().slice(0, 10);
}

async function handleCafe24(request, env, url, path) {
  // mall ID 추출 및 검증
  const mallId = (request.headers.get('X-Mall-Id') || '').toLowerCase().trim();
  if (!isValidMallId(mallId)) {
    return jsonResponse({ error: 'invalid_mall_id', message: 'X-Mall-Id 헤더가 없거나 형식이 잘못되었습니다.' }, 400);
  }

  const cafe24Path = path.replace(/^\/cafe24/, '');

  const params = new URLSearchParams(url.search);
  if (cafe24Path.includes('/orders') && !params.has('order_id')) {
    if (!params.has('start_date')) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 89);
      params.set('start_date', getDateString(startDate));
    }
    if (!params.has('end_date')) {
      params.set('end_date', getDateString(new Date()));
    }
  }

  const search    = params.toString() ? `?${params.toString()}` : '';
  const cafe24Url = `${cafe24Base(mallId)}${cafe24Path}${search}`;

  // 1차 시도
  let { token } = await getValidToken(env, mallId).catch(e => {
    throw new Error(`토큰 로드 실패: ${e.message}`);
  });

  const makeRequest = (t) => {
    const headers = new Headers({
      Authorization:  `Bearer ${t}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    });
    const init = { method: request.method, headers };
    if (!['GET', 'HEAD'].includes(request.method)) init.body = request.body;
    return fetch(cafe24Url, init);
  };

  let res = await makeRequest(token);

  // 401 수신 시 강제 갱신 후 1회 재시도
  if (res.status === 401) {
    console.warn(`[${mallId}] 401 수신 → 강제 갱신`);
    try {
      const refreshed = await getValidToken(env, mallId, true);
      token = refreshed.token;
      // body가 소비됐을 수 있으므로 request 재구성 불가 → GET/HEAD만 재시도
      if (['GET', 'HEAD'].includes(request.method)) {
        res = await makeRequest(token);
      } else {
        // POST/PUT은 body를 다시 읽을 수 없으므로 401 그대로 반환하되 토큰은 갱신됨
        console.warn('POST/PUT 401 재시도 불가 (body 소비됨) — 토큰은 갱신되었으니 클라이언트 재시도 필요');
      }
    } catch (e) {
      return jsonResponse({ error: 'token_refresh_failed', message: e.message }, 502);
    }
  }

  // Rate limit 체크: X-Api-Call-Limit: 9/10 → 잠시 대기
  const callLimit = res.headers.get('X-Api-Call-Limit');
  if (callLimit) {
    const [used, max] = callLimit.split('/').map(Number);
    if (!isNaN(used) && !isNaN(max) && used >= max - 1) {
      await sleep(1100);
    }
  }

  const body = await res.text();
  return new Response(body, {
    status:  res.status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// ──────────────────────────────────────────
// 테넌트 토큰 등록
// POST /admin/set-tokens  { mall_id, refresh_token }
// ──────────────────────────────────────────

async function handleSetTokens(request, env) {
  const auth = request.headers.get('X-Admin-Secret') || '';
  if (!auth || auth !== (env.ADMIN_SECRET || '')) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  let body;
  try { body = await request.json(); }
  catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const mallId = (body.mall_id || '').toLowerCase().trim();
  if (!isValidMallId(mallId)) {
    return jsonResponse({ error: 'mall_id 필수 (영문소문자+숫자, 2~20자)' }, 400);
  }
  if (!body.refresh_token) {
    return jsonResponse({ error: 'refresh_token 필수' }, 400);
  }

  const tokens = {
    access_token:       '',
    refresh_token:      body.refresh_token,
    access_expires_at:  0,
    refresh_expires_at: Date.now() + 14 * 86400_000,
  };
  await saveTokens(env, mallId, tokens);

  // 테넌트 정보 초기화 (최초 등록 시에만 체험 시작일 기록)
  if (env.KV) {
    const existing = await env.KV.get(tenantKey(mallId), 'json').catch(() => null);
    if (!existing) {
      const tenantInfo = {
        mallId,
        plan: 'starter',
        trialStartedAt: Date.now(),
        createdAt: Date.now(),
      };
      await env.KV.put(tenantKey(mallId), JSON.stringify(tenantInfo));
      console.log(`[${mallId}] 신규 테넌트 등록, 체험 시작`);
    }
  }

  try {
    const fresh = await refreshWithLock(env, mallId, tokens);
    return jsonResponse({
      ok: true, mall_id: mallId,
      access_expires_at: fresh.access_expires_at,
      expires_in: Math.round((fresh.access_expires_at - Date.now()) / 1000),
    });
  } catch (e) {
    return jsonResponse({ ok: false, mall_id: mallId, error: e.message }, 502);
  }
}

// ──────────────────────────────────────────
// 테넌트 정보 조회 (GET /tenant-info?mall_id=xxx)
// 플랜, 체험 기간 상태 반환
// ──────────────────────────────────────────

async function handleTenantInfo(request, env) {
  const url    = new URL(request.url);
  const mallId = (url.searchParams.get('mall_id') || '').toLowerCase().trim();
  if (!isValidMallId(mallId)) {
    return jsonResponse({ error: 'mall_id 파라미터 필요' }, 400);
  }

  if (!env.KV) {
    // KV 없는 환경(로컬 개발) → 체험 중으로 응답
    return jsonResponse({
      mallId,
      plan: 'starter',
      trialStartedAt: Date.now() - 86400_000, // 1일 전 시작으로 가정
      trialDaysLeft: TRIAL_DAYS - 1,
      trialActive: true,
    });
  }

  const info = await env.KV.get(tenantKey(mallId), 'json').catch(() => null);
  if (!info) {
    return jsonResponse({ error: 'unregistered', message: '등록되지 않은 Mall ID입니다.' }, 404);
  }

  const elapsed   = Date.now() - (info.trialStartedAt || 0);
  const daysUsed  = Math.floor(elapsed / 86400_000);
  const daysLeft  = Math.max(0, TRIAL_DAYS - daysUsed);
  const trialActive = daysLeft > 0;

  return jsonResponse({
    mallId:          info.mallId,
    plan:            info.plan || 'starter',
    trialStartedAt:  info.trialStartedAt,
    trialActive,
    trialDaysLeft:   daysLeft,
    trialDaysUsed:   daysUsed,
    // 체험 중이면 Pro, 아니면 실제 플랜
    effectivePlan:   trialActive ? 'pro' : (info.plan || 'starter'),
  });
}

// ──────────────────────────────────────────
// 토큰 상태 확인 (GET /status?mall_id=xxx)
// ──────────────────────────────────────────

async function handleTokenStatus(request, env) {
  const url    = new URL(request.url);
  const mallId = (url.searchParams.get('mall_id') || '').toLowerCase().trim();
  if (!isValidMallId(mallId)) {
    return jsonResponse({ error: 'mall_id 파라미터 필요' }, 400);
  }

  const tokens = await loadTokens(env, mallId);
  if (!tokens) return jsonResponse({ mall_id: mallId, registered: false });

  const now = Date.now();
  return jsonResponse({
    mall_id:              mallId,
    registered:           true,
    has_access_token:     !!tokens.access_token,
    access_expires_at:    tokens.access_expires_at,
    access_valid:         now < tokens.access_expires_at - TOKEN_BUFFER_MS,
    access_expires_in_s:  Math.round((tokens.access_expires_at - now) / 1000),
    refresh_expires_at:   tokens.refresh_expires_at,
    refresh_valid:        now < tokens.refresh_expires_at - REFRESH_MIN_TTL,
    refresh_expires_in_d: Math.round((tokens.refresh_expires_at - now) / 86400_000),
  });
}

// ──────────────────────────────────────────
// Claude 분류 프록시
// ──────────────────────────────────────────

async function handleClaudeClassify(request, env) {
  if (!env.CLAUDE_API_KEY) {
    return jsonResponse({ error: 'CLAUDE_API_KEY 미설정' }, 502);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const products = body.products || [];
  if (!products.length) return jsonResponse({ results: [] });

  // 사용자 정의 구역이 있으면 활용, 없으면 범용 구역 사용
  const customZones = (body.zoneLabels || []).join(', ');
  const zoneList = customZones || '냉동, 냉장, 음료, 식품, 생활용품, 기타';

  const prompt = `다음 상품 목록을 창고 구역으로 분류해주세요.
구역: ${zoneList}
각 상품에 대해 JSON 배열로 {"name":"상품명","zone":"구역"} 형태로만 답하세요.

상품 목록:
${products.map(p => `- ${p.product_name || p.name}`).join('\n')}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'x-api-key':         env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return jsonResponse({ error: `Claude API 실패 ${res.status}`, detail: text }, 502);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '[]';

  try {
    const match   = text.match(/\[[\s\S]*\]/);
    const results = match ? JSON.parse(match[0]) : [];
    return jsonResponse({ results });
  } catch (_) {
    return jsonResponse({ results: [], raw: text });
  }
}

// ──────────────────────────────────────────
// 공유 앱 설정 (기기 간 동기화)
// GET  /app-settings       → 현재 설정 반환
// PUT  /app-settings       → 설정 저장 (관리자 호출)
// ──────────────────────────────────────────

const DEFAULT_APP_SETTINGS = {
  pickingListStatus: 'N20',
  pickingWorkStatus: 'N30',
};

async function handleGetAppSettings(env) {
  if (!env.KV) return jsonResponse(DEFAULT_APP_SETTINGS);
  try {
    const stored = await env.KV.get(KV_APP_SETTINGS, 'json');
    return jsonResponse(stored ? { ...DEFAULT_APP_SETTINGS, ...stored } : DEFAULT_APP_SETTINGS);
  } catch (_) {
    return jsonResponse(DEFAULT_APP_SETTINGS);
  }
}

async function handlePutAppSettings(request, env) {
  let body;
  try { body = await request.json(); } catch (_) {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const allowed = ['pickingListStatus', 'pickingWorkStatus'];
  const settings = {};
  for (const key of allowed) {
    if (typeof body[key] === 'string') settings[key] = body[key];
  }

  if (env.KV) {
    try {
      await env.KV.put(KV_APP_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      return jsonResponse({ error: 'kv_write_failed', message: e.message }, 500);
    }
  }
  return jsonResponse({ ok: true, settings });
}

// ──────────────────────────────────────────
// 피킹 락 (중복 피킹 방지)
// KV key: plock:{orderId}  TTL: 300초(5분)
// ──────────────────────────────────────────

const LOCK_PREFIX = 'plock:';
const LOCK_TTL_S  = 300; // 5분 heartbeat 없으면 자동 해제

async function handleGetLocks(env) {
  if (!env.KV) return jsonResponse({});
  const list = await env.KV.list({ prefix: LOCK_PREFIX });
  const result = {};
  await Promise.all(
    list.keys.map(async ({ name }) => {
      const val = await env.KV.get(name, 'json');
      if (val) result[name.replace(LOCK_PREFIX, '')] = val;
    })
  );
  return jsonResponse(result);
}

async function handleAcquireLock(request, env, orderId) {
  if (!env.KV) return jsonResponse({ ok: true }); // KV 없으면 락 생략

  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const pickerName = (body.pickerName || '').trim();
  if (!pickerName) return jsonResponse({ error: 'pickerName 필수' }, 400);

  const key      = LOCK_PREFIX + orderId;
  const existing = await env.KV.get(key, 'json');

  if (existing && existing.pickerName !== pickerName) {
    return jsonResponse({ ok: false, conflict: true, pickerName: existing.pickerName });
  }

  const lock = { pickerName, startedAt: Date.now() };
  await env.KV.put(key, JSON.stringify(lock), { expirationTtl: LOCK_TTL_S });
  return jsonResponse({ ok: true });
}

async function handleReleaseLock(request, env, orderId) {
  if (!env.KV) return jsonResponse({ ok: true });

  const url         = new URL(request.url);
  const pickerName  = url.searchParams.get('pickerName') || '';
  const isAdminCall = url.searchParams.get('force') === '1';

  const key      = LOCK_PREFIX + orderId;
  const existing = await env.KV.get(key, 'json');

  if (existing && !isAdminCall && existing.pickerName !== pickerName) {
    return jsonResponse({ ok: false, error: '본인 락만 해제할 수 있습니다' }, 403);
  }

  await env.KV.delete(key);
  return jsonResponse({ ok: true });
}

async function handleHeartbeat(request, env, orderId) {
  if (!env.KV) return jsonResponse({ ok: true });

  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const pickerName = (body.pickerName || '').trim();
  const key        = LOCK_PREFIX + orderId;
  const existing   = await env.KV.get(key, 'json');

  if (!existing) return jsonResponse({ ok: false, error: 'lock_not_found' });
  if (existing.pickerName !== pickerName) return jsonResponse({ ok: false, error: 'not_owner' });

  // TTL 갱신
  await env.KV.put(key, JSON.stringify(existing), { expirationTtl: LOCK_TTL_S });
  return jsonResponse({ ok: true });
}

// ──────────────────────────────────────────
// 메인 fetch 핸들러
// ──────────────────────────────────────────

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return corsResponse();

    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // 피킹 락 라우팅
    const lockMatch = path.match(/^\/picking-locks(?:\/([^/]+)(?:\/(heartbeat))?)?$/);
    if (lockMatch) {
      const orderId = lockMatch[1];
      const sub     = lockMatch[2];
      try {
        if (!orderId && method === 'GET')  return await handleGetLocks(env);
        if (orderId  && method === 'PUT')  return await handleAcquireLock(request, env, orderId);
        if (orderId  && method === 'DELETE') return await handleReleaseLock(request, env, orderId);
        if (orderId  && sub === 'heartbeat' && method === 'POST')
                                           return await handleHeartbeat(request, env, orderId);
      } catch (e) {
        return jsonResponse({ error: e.message }, 500);
      }
    }

    try {
      if (path.startsWith('/cafe24/'))        return await handleCafe24(request, env, url, path);
      if (path === '/claude/classify')        return await handleClaudeClassify(request, env);
      if (path === '/status')                 return await handleTokenStatus(request, env);
      if (path === '/admin/set-tokens' && method === 'POST')
                                              return await handleSetTokens(request, env);
      if (path === '/app-settings' && method === 'GET')
                                              return await handleGetAppSettings(env);
      if (path === '/app-settings' && method === 'PUT')
                                              return await handlePutAppSettings(request, env);
      if (path === '/tenant-info' && method === 'GET')
                                              return await handleTenantInfo(request, env);
      if (path === '/health')                 return jsonResponse({ ok: true, ts: Date.now() });
      return jsonResponse({ error: 'not_found' }, 404);
    } catch (e) {
      console.error(e);
      return jsonResponse({ error: 'internal_error', message: e.message }, 500);
    }
  },
};
