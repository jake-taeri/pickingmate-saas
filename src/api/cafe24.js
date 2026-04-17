/**
 * 카페24 API 클라이언트 (Cloudflare Worker 경유)
 */

import { loadSettings } from '../utils/storage.js';

function getWorkerUrl() {
  const settings = loadSettings();
  return (settings.workerUrl || '').replace(/\/$/, '');
}

function getMallId() {
  return loadSettings().mallId || '';
}

const REQUEST_TIMEOUT_MS = 15_000;

async function proxyRequest(path, options = {}) {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) {
    throw new Error('Worker URL이 설정되지 않았습니다. 설정 화면에서 Worker URL을 입력해주세요.');
  }

  const mallId = getMallId();
  if (!mallId) {
    throw new Error('Mall ID가 설정되지 않았습니다. 설정 화면에서 카페24 Mall ID를 입력해주세요.');
  }

  const url = `${workerUrl}/cafe24${path}`;
  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Mall-Id': mallId,
        ...(options.headers || {}),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      throw new Error('네트워크 연결을 확인해주세요. (15초 초과)');
    }
    throw new Error('네트워크 연결을 확인해주세요.');
  }

  if (!res.ok) {
    let msg = `API 오류 ${res.status}`;
    try {
      const data = await res.json();
      msg = data?.error?.message || data?.message || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  return res.json();
}

/**
 * 주문 목록 조회
 * @param {Object} params
 * @param {string} params.order_status - 조회할 주문 상태 코드 (기본값: settings.pickingListStatus → 'N20')
 * @param {number} params.limit - 최대 결과 수 (기본 100)
 * @param {string} params.start_date - 시작일 (YYYY-MM-DD)
 * @param {string} params.end_date - 종료일 (YYYY-MM-DD)
 */
export async function fetchPendingOrders({ order_status, limit = 100, start_date, end_date } = {}) {
  // order_status 미전달 시 settings에서 읽기
  const statusCode = order_status ?? loadSettings().pickingListStatus ?? 'N20';

  const params = new URLSearchParams({
    order_status: statusCode,
    limit: String(limit),
    fields: 'order_id,buyer_name,buyer_phone,order_date,payment_amount,order_status,shipping_message,receiver,item_count,wished_delivery_date,shipping_company_name',
  });

  if (start_date) params.set('start_date', start_date);
  if (end_date) params.set('end_date', end_date);

  const data = await proxyRequest(`/api/v2/admin/orders?${params}`);
  const orders = data.orders || [];

  // 각 주문의 items + receivers를 5건씩 배치로 병렬 조회
  const CHUNK = 5;
  const enriched = [];
  for (let i = 0; i < orders.length; i += CHUNK) {
    const chunk = orders.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map(async (order) => {
        const [items, receivers] = await Promise.allSettled([
          fetchOrderItems(order.order_id),
          fetchOrderReceivers(order.order_id),
        ]);

        const itemList = items.status === 'fulfilled' ? items.value : [];
        const receiverList = receivers.status === 'fulfilled' ? receivers.value : [];
        const receiver = receiverList[0] ?? null;

        const totalQty = itemList.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);

        // wished_delivery_date: receiver 우선, 없으면 order 레벨 값 사용
        const wished_delivery_date =
          (receiver?.wished_delivery_date || order.wished_delivery_date || '').slice(0, 10) || null;

        return {
          ...order,
          items: itemList,
          totalQty: totalQty || parseInt(order.item_count) || 0,
          receiver,
          wished_delivery_date,
        };
      })
    );
    enriched.push(...results);
  }

  return enriched;
}

/**
 * 주문별 상품 목록 조회 (custom_product_code 포함)
 */
export async function fetchOrderItems(orderId) {
  const data = await proxyRequest(
    `/api/v2/admin/orders/${orderId}/items?fields=order_item_code,product_no,product_code,custom_product_code,product_name,option_value,quantity,product_image`
  );
  return data.items || [];
}

/**
 * 주문별 수령자 정보 조회 (wished_delivery_date 포함)
 */
export async function fetchOrderReceivers(orderId) {
  const data = await proxyRequest(
    `/api/v2/admin/orders/${orderId}/receivers?fields=receiver_id,name,phone,cellphone,wished_delivery_date,wished_delivery_time,shipping_message,address1,address2,zipcode,tracking_no,shipping_code`
  );
  return data.receivers || [];
}

/**
 * 상품 상세 조회 (이미지 + 자체상품코드)
 * @param {number[]} productNos - 상품번호 배열
 * @returns {{ [productNo]: { image: string|null, customProductCode: string|null } }}
 */
export async function fetchProductDetails(productNos) {
  if (!productNos || productNos.length === 0) return {};

  const CHUNK = 5;
  const detailMap = {};

  for (let i = 0; i < productNos.length; i += CHUNK) {
    const chunk = productNos.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map(no =>
        proxyRequest(`/api/v2/admin/products/${no}?fields=product_no,list_image,detail_image,custom_product_code`)
      )
    );
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value?.product) {
        const p = r.value.product;
        detailMap[chunk[idx]] = {
          image: p.list_image || p.detail_image || null,
          customProductCode: p.custom_product_code || null,
        };
      }
    });
  }

  return detailMap;
}

/**
 * 주문 상태 변경
 * @param {string} orderId
 * @param {string} orderStatus - 예: 'N30' (배송중)
 */
export async function updateOrderStatus(orderId, orderStatus) {
  return proxyRequest(`/api/v2/admin/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify({ order: { order_id: orderId, order_status: orderStatus } }),
  });
}

/**
 * 공유 앱 설정 조회 (Worker KV → 기기 간 동기화)
 * @returns {{ pickingListStatus: string, pickingWorkStatus: string } | null}
 */
export async function fetchAppSettings() {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) return null;
  try {
    const res = await fetch(`${workerUrl}/app-settings`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return res.json();
  } catch (_) {}
  return null;
}

/**
 * 공유 앱 설정 저장 (Worker KV → 피커 기기에 즉시 반영)
 * @param {{ pickingListStatus?: string, pickingWorkStatus?: string }} settings
 */
export async function pushAppSettings(settings) {
  try {
    return await proxyRequest('/app-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  } catch (_) {
    // push 실패는 무시 (로컬에는 이미 저장됨)
  }
}

/**
 * Worker 연결 상태 확인
 */
export async function checkWorkerHealth() {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) return { ok: false, error: 'URL 미설정' };

  try {
    const res = await fetch(`${workerUrl}/health`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) return { ok: true };
    return { ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * 토큰 상태 확인
 */
export async function checkTokenStatus() {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) return null;
  try {
    const res = await fetch(`${workerUrl}/status`);
    if (res.ok) return res.json();
  } catch (_) {}
  return null;
}
