import { formatMoney, formatDateTime, formatDate, parseDeliveryMessage } from '../utils/formatters.js';

const STATUS_ORDER_LABEL = {
  N20: '배송대기',
  N30: '배송중',
  N40: '배송완료',
};

export default function OrderCard({ order, onClick, selected, onToggle, lock, myName, isAdmin, onForceUnlock }) {
  const {
    order_id,
    buyer_name,
    buyer_phone,
    order_date,
    payment_amount,
    shipping_message,
    receiver,
    order_status,
    item_count,
    totalQty,
    wished_delivery_date,
  } = order;

  const recipientName = receiver?.name;
  const recipientPhone = receiver?.cellphone || receiver?.phone;
  const deliveryMsg = receiver?.shipping_message || shipping_message;
  const address = [receiver?.address1, receiver?.address2].filter(Boolean).join(' ');
  const trackingNo = receiver?.tracking_no || null;

  const parsed = parseDeliveryMessage(deliveryMsg);
  const totalCount = totalQty != null ? totalQty : (parseInt(item_count) || 0);

  // 락 상태 계산
  const isLockedByMe    = lock && lock.pickerName === myName;
  const isLockedByOther = lock && lock.pickerName !== myName;
  const lockClass = isLockedByOther ? 'order-card--locked' : isLockedByMe ? 'order-card--my-lock' : '';

  return (
    <div
      className={`order-card ${lockClass}`}
      style={{ opacity: isLockedByOther ? 0.65 : 1, cursor: isLockedByOther ? 'default' : 'pointer' }}
      onClick={isLockedByOther ? undefined : onClick}
    >
      {/* 락 배너 */}
      {lock && (
        <div className={`order-lock-banner ${isLockedByMe ? 'order-lock-banner--me' : 'order-lock-banner--other'}`}>
          <span>{isLockedByMe ? '🟢 내가 피킹 중' : `🔒 ${lock.pickerName}님 피킹 중`}</span>
          {isAdmin && onForceUnlock && (
            <button
              className="order-lock-force-btn"
              onClick={e => { e.stopPropagation(); onForceUnlock(order_id); }}
            >
              강제 해제
            </button>
          )}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      {onToggle != null && (
        <label
          style={{ paddingTop: 14, paddingLeft: 16, flexShrink: 0, cursor: 'pointer' }}
          onClick={e => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggle(order_id)}
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--primary)' }}
          />
        </label>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
      <div className="order-card-header" style={onToggle != null ? { paddingLeft: 0 } : undefined}>
        <div>
          <div className="order-card-name">{buyer_name || recipientName || '이름없음'}</div>
          <div className="order-card-id">{order_id}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="order-card-amount">{formatMoney(payment_amount)}</div>
          {totalCount > 0 && (
            <span className="tag badge-pending" style={{ marginTop: 4 }}>{totalCount}종</span>
          )}
        </div>
      </div>

      {wished_delivery_date && (
        <div className="order-delivery-date">
          <span className="order-meta-icon">🚚</span>
          희망배송일 <strong>{formatDate(wished_delivery_date)}</strong>
        </div>
      )}

      <div className="order-card-meta">
        {parsed.lodge && (
          <div className="order-meta-item">
            <span className="order-meta-icon">🏕️</span>
            <span>{parsed.lodge}</span>
          </div>
        )}
        {parsed.room && (
          <div className="order-meta-item">
            <span className="order-meta-icon">🚪</span>
            <span>{parsed.room}</span>
          </div>
        )}
        {parsed.deliveryTime && (
          <div className="order-meta-item">
            <span className="order-meta-icon">🕐</span>
            <span>{parsed.deliveryTime}</span>
          </div>
        )}
        {order_date && (
          <div className="order-meta-item">
            <span className="order-meta-icon">📅</span>
            <span>{formatDateTime(order_date)}</span>
          </div>
        )}
        {(buyer_phone || recipientPhone) && (
          <div className="order-meta-item">
            <span className="order-meta-icon">📱</span>
            <span>{buyer_phone || recipientPhone}</span>
          </div>
        )}
        {totalCount > 0 && (
          <div className="order-meta-item">
            <span className="order-meta-icon">📦</span>
            <span>{totalCount}개 상품</span>
          </div>
        )}
        {address && (
          <div className="order-meta-item">
            <span className="order-meta-icon">📍</span>
            <span>{address}</span>
          </div>
        )}
        {trackingNo && (
          <div className="order-meta-item">
            <span className="order-meta-icon">🚛</span>
            <span>송장 {trackingNo}</span>
          </div>
        )}
      </div>

      {parsed.raw && !parsed.lodge && (
        <div className="order-card-message">{parsed.raw}</div>
      )}
      </div>
      </div>
    </div>
  );
}
