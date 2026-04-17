import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchOrderItems, fetchProductDetails } from '../api/cafe24.js';
import {
  getOrderPickingState,
  updateOrderPickingState,
  getProductImages,
  saveProductImages,
} from '../utils/storage.js';
import { classifyByCode } from '../utils/zones.js';
import { buildZoneGroups } from '../utils/picking.js';
// barcodeRegistry now handled inside BarcodeScanner
import { acquireLock, releaseLock, sendHeartbeat } from '../utils/pickingLocks.js';
import DeliveryPanel from './DeliveryPanel.jsx';
import ZoneGroupComponent from './ZoneGroupComponent.jsx';
import PrintView from './PrintView.jsx';
import BarcodeLabelPrint from './BarcodeLabelPrint.jsx';
import BarcodeScanner from './BarcodeScanner.jsx';

export default function PickingView({ order, showToast, onBack, pickerName = null, plan = null, showPlanToast = null }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [pickerChecked, setPickerChecked] = useState(() => {
    const s = getOrderPickingState(order.order_id);
    return new Set(s.pickedItems || []);
  });
  const [inspectorChecked, setInspectorChecked] = useState(() => {
    const s = getOrderPickingState(order.order_id);
    return new Set(s.inspectedItems || []);
  });

  const [zoneOverrides, setZoneOverrides] = useState(() => {
    return getOrderPickingState(order.order_id).zoneOverrides || {};
  });

  const [showScanner, setShowScanner] = useState(false);
  const [labelMode, setLabelMode] = useState(false);

  // 피커 전용: 피킹 진입 시 락 획득, 이탈 시 자동 해제
  const lockActiveRef = useRef(false);
  useEffect(() => {
    if (!pickerName) return; // 관리자는 락 없음

    acquireLock(order.order_id, pickerName).then(result => {
      if (result.ok) {
        lockActiveRef.current = true;
      } else if (result.conflict) {
        showToast(`${result.pickerName}님이 이미 피킹 중입니다`, 'error');
        onBack();
      }
    });

    // Heartbeat: 30초마다 TTL 갱신
    const hbId = setInterval(() => {
      if (lockActiveRef.current) sendHeartbeat(order.order_id, pickerName);
    }, 30_000);

    return () => {
      clearInterval(hbId);
      if (lockActiveRef.current) {
        releaseLock(order.order_id, pickerName);
        lockActiveRef.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.order_id, pickerName]);

  // 상품 로드 (자체상품코드 + 이미지)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // 주문 목록에서 이미 로드된 items가 있으면 재사용, 없으면 API 호출
        const fetchedItems = (order.items && order.items.length > 0)
          ? order.items
          : await fetchOrderItems(order.order_id);
        if (cancelled) return;

        const productNos = [...new Set(fetchedItems.map(i => i.product_no).filter(Boolean))];

        // 1) 캐시에서 이미지 조회
        const { hit: cachedImages, miss: uncachedNos } = getProductImages(productNos);

        // 2) 캐시 미스된 상품만 API 조회 (custom_product_code는 items에서 이미 옴)
        let fetchedDetails = {};
        if (uncachedNos.length > 0) {
          fetchedDetails = await fetchProductDetails(uncachedNos);
          // 가져온 이미지 캐시 저장
          const newImages = {};
          for (const [no, d] of Object.entries(fetchedDetails)) {
            newImages[no] = d.image;
          }
          saveProductImages(newImages);
        }

        const enrichedItems = fetchedItems.map(item => {
          const no = item.product_no;
          const image =
            cachedImages[no] ??
            fetchedDetails[no]?.image ??
            item.product_image ??
            null;
          return { ...item, product_image: image };
        });

        if (cancelled) return;
        setItems(enrichedItems);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [order.order_id]);

  // 피커 체크 토글
  const togglePicker = useCallback((itemCode) => {
    setPickerChecked(prev => {
      const next = new Set(prev);
      next.has(itemCode) ? next.delete(itemCode) : next.add(itemCode);
      updateOrderPickingState(order.order_id, { pickedItems: [...next] });
      return next;
    });
  }, [order.order_id]);

  // 검수 체크 토글
  const toggleInspector = useCallback((itemCode) => {
    setInspectorChecked(prev => {
      const next = new Set(prev);
      next.has(itemCode) ? next.delete(itemCode) : next.add(itemCode);
      updateOrderPickingState(order.order_id, { inspectedItems: [...next] });
      return next;
    });
  }, [order.order_id]);

  // 구역 변경 (소분류 알파벳 코드로 오버라이드)
  const changeItemZone = useCallback((itemCode, newLetter) => {
    setZoneOverrides(prev => {
      const updated = { ...prev, [itemCode]: newLetter };
      updateOrderPickingState(order.order_id, { zoneOverrides: updated });
      return updated;
    });
    const { subLabel } = classifyByCode(newLetter);
    const label = newLetter ? `${newLetter} — ${subLabel}` : '미분류';
    showToast(`구역을 "${label}"(으)로 변경했습니다`);
  }, [order.order_id, showToast]);

  // 대분류 → 소분류 2단 그룹핑
  const zoneGroups = useMemo(
    () => buildZoneGroups(items, zoneOverrides),
    [items, zoneOverrides]
  );

  // 전체 아이템 평탄화 (스캔 매칭용)
  const allItems = useMemo(
    () => zoneGroups.flatMap(g => g.subcategories.flatMap(s => s.items)),
    [zoneGroups]
  );


  if (loading) {
    return (
      <div className="loading-wrap">
        <div className="spinner" />
        <p style={{ color: 'var(--text3)', fontSize: 14 }}>상품 목록 로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-wrap">
        <div className="error-icon">⚠️</div>
        <div className="error-title">상품 로드 실패</div>
        <div className="error-msg">{error}</div>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>다시 시도</button>
      </div>
    );
  }

  return (
    <>
      {/* 화면 전용 UI */}
      <div className="no-print">
        <DeliveryPanel order={order} />
        {/* 바코드 스캔 버튼 — 상단 눈에 띄게 */}
        <div style={{ padding: '8px 16px 0' }}>
          <button
            className="btn btn-primary btn-full scan-top-btn"
            onClick={() => {
              if (plan && !plan.can('barcode_scan')) {
                showPlanToast?.('바코드 스캔');
                return;
              }
              setShowScanner(true);
            }}
            style={{ position: 'relative' }}
          >
            📷 바코드 스캔
            {plan && !plan.can('barcode_scan') && (
              <span style={{
                position: 'absolute', top: 6, right: 10,
                fontSize: 12, opacity: 0.8,
              }}>🔒</span>
            )}
          </button>
        </div>
      </div>

      <div className="zone-list no-print">
        {zoneGroups.map(majorGroup => (
          <ZoneGroupComponent
            key={majorGroup.id}
            majorGroup={majorGroup}
            pickerChecked={pickerChecked}
            inspectorChecked={inspectorChecked}
            onPickerToggle={togglePicker}
            onInspectorToggle={toggleInspector}
            onZoneChange={changeItemZone}
          />
        ))}
      </div>

      <div className="bottom-actions no-print" style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-secondary"
          style={{ flex: 1 }}
          onClick={() => { setLabelMode(true); setTimeout(() => window.print(), 150); }}
        >
          🏷️ 라벨
        </button>
        <button
          className="btn btn-secondary"
          style={{ flex: 1 }}
          onClick={() => { setLabelMode(false); setTimeout(() => window.print(), 50); }}
        >
          🖨️ 인쇄
        </button>
      </div>

      {/* 바코드 스캐너 (풀스크린) */}
      {showScanner && (
        <BarcodeScanner
          allItems={allItems}
          pickerChecked={pickerChecked}
          onConfirmPick={togglePicker}
          onClose={() => setShowScanner(false)}
          orderId={order.order_id}
          pickerName={pickerName}
        />
      )}

      {/* 인쇄 전용: 피킹시트 (라벨 모드 아닐 때) */}
      {!labelMode && <PrintView order={order} zoneGroups={zoneGroups} />}

      {/* 인쇄 전용: 바코드 라벨 (라벨 모드일 때) */}
      {labelMode && <BarcodeLabelPrint items={allItems} />}
    </>
  );
}
