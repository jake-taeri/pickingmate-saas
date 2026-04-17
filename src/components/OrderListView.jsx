import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPendingOrders, fetchAppSettings } from '../api/cafe24.js';
import { fetchAllLocks, releaseLock } from '../utils/pickingLocks.js';
import { loadSettings, saveSettings, getOrderPickingState, getProductImages, saveProductImages, getStatusLabel } from '../utils/storage.js';
import { fetchProductDetails } from '../api/cafe24.js';
import { formatMoney, formatDateTime, formatDate } from '../utils/formatters.js';
import { buildZoneGroups } from '../utils/picking.js';
import OrderCard from './OrderCard.jsx';
import BulkPrintView from './BulkPrintView.jsx';

/** KST 기준 오늘 날짜 YYYY-MM-DD */
function todayKST() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00+09:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default function OrderListView({ onSelectOrder, showToast, isAdmin = true, pickerName = null }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [filterDate, setFilterDate] = useState(todayKST);
  const [showAll, setShowAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkPrintData, setBulkPrintData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [locks, setLocks] = useState({});    // { [orderId]: { pickerName, startedAt } }
  const locksRef = useRef({});

  const loadOrders = useCallback(async () => {
    const localSettings = loadSettings();
    if (!localSettings.workerUrl) {
      setError('WORKER_URL_NOT_SET');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Worker KV에서 최신 설정 조회 — 기기 간 동기화 (실패 시 로컬 설정 사용)
      const remoteSettings = await fetchAppSettings();
      let settings = localSettings;
      if (remoteSettings) {
        settings = { ...localSettings, ...remoteSettings };
        // 로컬에도 반영해 다음 로드(오프라인 포함)에 최신값 사용
        if (
          remoteSettings.pickingListStatus !== localSettings.pickingListStatus ||
          remoteSettings.pickingWorkStatus  !== localSettings.pickingWorkStatus
        ) {
          saveSettings(settings);
        }
      }

      // 관리자: 피킹리스트 출력 대상, 피커: 피킹 진행 대상
      const statusCode = isAdmin
        ? (settings.pickingListStatus ?? 'N20')
        : (settings.pickingWorkStatus ?? 'N30');

      const data = await fetchPendingOrders({ limit: 100, order_status: statusCode });
      setOrders(data);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
      showToast('주문 로드 실패: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, isAdmin]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // 락 상태 폴링 (2.5초 간격)
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const data = await fetchAllLocks();
      if (!cancelled) {
        locksRef.current = data;
        setLocks(data);
      }
    }
    poll();
    const id = setInterval(poll, 2500);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // 날짜/전체 필터 변경 시 선택 초기화
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterDate, showAll]);

  // 일괄 출력 데이터 준비되면 print 실행
  useEffect(() => {
    if (!bulkPrintData) return;
    const t = setTimeout(() => {
      window.print();
      setBulkPrintData(null);
      setIsPrinting(false);
    }, 200);
    return () => clearTimeout(t);
  }, [bulkPrintData]);

  // 날짜 필터 적용
  const filteredOrders = showAll
    ? orders
    : orders.filter(o => {
        const d = o.wished_delivery_date;
        if (!d) return false;
        return d.slice(0, 10) === filterDate;
      });

  // 요약 통계 — 필터된 주문 기준
  const totalOrders = filteredOrders.length;
  const totalQty = filteredOrders.reduce((s, o) => s + (o.totalQty != null ? o.totalQty : (parseInt(o.item_count) || 0)), 0);
  const totalAmount = filteredOrders.reduce((s, o) => s + (parseFloat(o.payment_amount) || 0), 0);

  // 날짜 미지정 주문 수 (필터 활성 시 안내용)
  const undatedCount = showAll ? 0 : orders.filter(o => !o.wished_delivery_date).length;

  // 일괄 선택
  const allSelected = filteredOrders.length > 0 && selectedIds.size === filteredOrders.length;
  const someSelected = selectedIds.size > 0;

  function toggleSelect(orderId) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  }

  // 피커 전용: 주문 클릭 전 락 확인
  function handleOrderClick(order) {
    if (isAdmin) { onSelectOrder(order); return; }
    const lock = locksRef.current[order.order_id];
    if (lock && lock.pickerName !== pickerName) {
      showToast(`${lock.pickerName}님이 이미 피킹 중입니다`, 'error');
      // 최신 락 상태 즉시 새로고침
      fetchAllLocks().then(data => { locksRef.current = data; setLocks(data); });
      return;
    }
    onSelectOrder(order);
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.order_id)));
    }
  }

  async function handleBulkPrint() {
    if (isPrinting || !someSelected) return;
    setIsPrinting(true);
    try {
      const selected = filteredOrders.filter(o => selectedIds.has(o.order_id));

      // 선택된 모든 주문의 product_no 수집
      const allProductNos = [...new Set(
        selected.flatMap(o => (o.items || []).map(i => i.product_no).filter(Boolean))
      )];

      // 캐시에서 이미지 조회
      const { hit: cachedImages, miss: uncachedNos } = getProductImages(allProductNos);

      // 캐시 미스 상품만 API 조회
      let fetchedDetails = {};
      if (uncachedNos.length > 0) {
        fetchedDetails = await fetchProductDetails(uncachedNos);
        const newImages = {};
        for (const [no, d] of Object.entries(fetchedDetails)) {
          if (d.image) newImages[no] = d.image;
        }
        if (Object.keys(newImages).length > 0) saveProductImages(newImages);
      }

      const data = selected.map(order => {
        const enrichedItems = (order.items || []).map(item => {
          const no = item.product_no;
          const image = cachedImages[no] ?? fetchedDetails[no]?.image ?? item.product_image ?? null;
          return { ...item, product_image: image };
        });
        const zoneOverrides = getOrderPickingState(order.order_id).zoneOverrides || {};
        const zoneGroups = buildZoneGroups(enrichedItems, zoneOverrides);
        return { order, zoneGroups };
      });

      setBulkPrintData(data);
    } catch (e) {
      showToast('이미지 로드 실패: ' + e.message, 'error');
      setIsPrinting(false);
    }
  }

  const settings2 = loadSettings();
  const activeStatusCode = isAdmin
    ? (settings2.pickingListStatus ?? 'N20')
    : (settings2.pickingWorkStatus ?? 'N30');
  const listStatusLabel = getStatusLabel(activeStatusCode);

  if (loading) {
    return (
      <div className="loading-wrap">
        <div className="spinner" />
        <p style={{ color: 'var(--text3)', fontSize: 14 }}>{listStatusLabel} 주문 로딩 중...</p>
      </div>
    );
  }

  if (error === 'WORKER_URL_NOT_SET') {
    return (
      <div className="error-wrap">
        <div className="error-icon">⚙️</div>
        <div className="error-title">설정이 필요합니다</div>
        <div className="error-msg">
          우상단 설정 아이콘을 눌러<br />
          Cloudflare Worker URL을 입력해주세요.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-wrap">
        <div className="error-icon">⚠️</div>
        <div className="error-title">오류가 발생했습니다</div>
        <div className="error-msg">{error}</div>
        <button className="btn btn-primary" onClick={loadOrders}>다시 시도</button>
      </div>
    );
  }

  return (
    <>
      {/* 요약바 */}
      <div className="summary-bar no-print" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div
          className="summary-item"
          style={{ cursor: 'pointer' }}
          onClick={() => setShowAll(true)}
        >
          <div className="summary-value">{orders.length}</div>
          <div className="summary-label">전체 주문</div>
        </div>
        <div className="summary-item">
          <div className="summary-value">{totalQty}</div>
          <div className="summary-label">총 수량</div>
        </div>
        <div className="summary-item">
          <div className="summary-value" style={{ fontSize: 15 }}>{formatMoney(totalAmount).replace('원', '')}</div>
          <div className="summary-label">총 금액</div>
        </div>
      </div>

      {/* 희망배송일 날짜 필터 */}
      <div className="date-filter-bar no-print">
        <button
          className="date-nav-btn"
          onClick={() => { setFilterDate(d => shiftDate(d, -1)); setShowAll(false); }}
          disabled={showAll}
          aria-label="이전 날짜"
        >
          ‹
        </button>

        <div className="date-filter-center">
          <span className="date-filter-label">희망배송일</span>
          <input
            type="date"
            className="date-filter-input"
            value={showAll ? '' : filterDate}
            onChange={e => { setFilterDate(e.target.value); setShowAll(false); }}
          />
        </div>

        <button
          className="date-nav-btn"
          onClick={() => { setFilterDate(d => shiftDate(d, 1)); setShowAll(false); }}
          disabled={showAll}
          aria-label="다음 날짜"
        >
          ›
        </button>

        <button
          className={`date-all-btn ${showAll ? 'active' : ''}`}
          onClick={() => setShowAll(v => !v)}
        >
          전체
        </button>
      </div>

      {/* 새로고침 툴바 + 전체선택 */}
      <div
        className="no-print"
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flexShrink: 0 }}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }}
          />
          <span style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>전체 선택</span>
        </label>
        <span style={{ fontSize: 12, color: 'var(--text3)', flex: 1 }}>
          {lastRefresh ? `${formatDateTime(lastRefresh)} 기준` : ''}
          {!showAll && undatedCount > 0 && (
            <span style={{ marginLeft: 8 }}>(날짜 미지정 {undatedCount}건 제외)</span>
          )}
        </span>
        <button className="btn btn-secondary btn-sm" onClick={loadOrders}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M1 4v6h6"/>
            <path d="M3.51 15a9 9 0 1 0 .49-3.85"/>
          </svg>
          새로고침
        </button>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="empty-wrap">
          <div className="empty-icon">{showAll ? '✅' : '📅'}</div>
          <div className="empty-text">
            {showAll
              ? `${listStatusLabel} 주문이 없습니다`
              : `${formatDate(filterDate)} 희망배송 주문이 없습니다`}
          </div>
          {!showAll && orders.length > 0 && (
            <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setShowAll(true)}>
              전체 주문 보기 ({orders.length}건)
            </button>
          )}
        </div>
      ) : (
        <div className="order-list">
          {filteredOrders.map(order => (
            <OrderCard
              key={order.order_id}
              order={order}
              onClick={() => handleOrderClick(order)}
              selected={selectedIds.has(order.order_id)}
              onToggle={isAdmin ? toggleSelect : null}
              lock={locks[order.order_id] || null}
              myName={pickerName}
              isAdmin={isAdmin}
              onForceUnlock={isAdmin ? (id) => releaseLock(id, '', true).then(() =>
                fetchAllLocks().then(d => { locksRef.current = d; setLocks(d); })
              ) : null}
            />
          ))}
        </div>
      )}

      {/* 일괄 출력 버튼 */}
      {someSelected && (
        <div className="no-print" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100,
        }}>
          <button
            className="btn btn-primary"
            onClick={handleBulkPrint}
            disabled={isPrinting}
            style={{ padding: '12px 28px', fontSize: 15, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', borderRadius: 24 }}
          >
            {isPrinting ? '준비 중...' : `선택 주문 출력 (${selectedIds.size}건)`}
          </button>
        </div>
      )}

      {/* 일괄 출력 인쇄 영역 */}
      {bulkPrintData && <BulkPrintView printData={bulkPrintData} />}
    </>
  );
}
