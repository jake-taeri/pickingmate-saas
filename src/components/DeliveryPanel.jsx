import { useState } from 'react';
import { formatDateTime, formatDate, formatPhone, parseDeliveryMessage } from '../utils/formatters.js';

function Row({ label, value, children }) {
  if (!value && !children) return null;
  return (
    <div className="delivery-row">
      <span className="delivery-label">{label}</span>
      <span className="delivery-value">{children ?? value}</span>
    </div>
  );
}

export default function DeliveryPanel({ order }) {
  const [open, setOpen] = useState(true);

  const {
    buyer_name,
    buyer_phone,
    order_date,
    order_id,
    shipping_message: orderShippingMsg,
    wished_delivery_date: orderWishedDate,
    receiver,
  } = order;

  // receiver 우선, 없으면 order 레벨 폴백
  const recipientName   = receiver?.name || buyer_name;
  const recipientPhone  = receiver?.cellphone || receiver?.phone || buyer_phone;
  const address         = [receiver?.address1, receiver?.address2].filter(Boolean).join(' ');
  const shippingMsg     = receiver?.shipping_message || orderShippingMsg;
  const wishedDate      = receiver?.wished_delivery_date || orderWishedDate;
  const shippingCompany = order.shipping_company_name || null;
  const trackingNo      = receiver?.tracking_no || null;
  const wishedTime      = receiver?.wished_delivery_time || null;

  const parsed = parseDeliveryMessage(shippingMsg);

  return (
    <div className="delivery-panel no-print">
      <div className="delivery-panel-toggle" onClick={() => setOpen(o => !o)}>
        <div className="delivery-panel-toggle-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          배송 정보
        </div>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s', color: 'var(--text3)' }}
        >
          <path d="M19 9l-7 7-7-7"/>
        </svg>
      </div>

      {open && (
        <div className="delivery-panel-body">
          <Row label="수령인" value={recipientName} />

          {recipientPhone && (
            <div className="delivery-row">
              <span className="delivery-label">연락처</span>
              <span className="delivery-value">
                <a href={`tel:${recipientPhone.replace(/\D/g, '')}`}>{formatPhone(recipientPhone)} ☎</a>
              </span>
            </div>
          )}

          <Row label="배송지" value={address} />

          {wishedDate && (
            <Row label="희망배송일" value={formatDate(wishedDate)} />
          )}

          {(wishedTime || parsed.deliveryTime) && (
            <Row label="희망배송시간" value={wishedTime || parsed.deliveryTime} />
          )}

          {shippingCompany && (
            <Row label="배송업체" value={shippingCompany} />
          )}

          {parsed.lodge && <Row label="숙소명" value={parsed.lodge} />}
          {parsed.room && <Row label="객실" value={parsed.room} />}

          {shippingMsg && (
            <Row label="배송요청사항" value={shippingMsg} />
          )}

          {trackingNo && (
            <Row label="송장번호" value={trackingNo} />
          )}

          <Row label="주문일시" value={formatDateTime(order_date)} />
          <Row label="주문번호">
            <span style={{ fontSize: 12 }}>{order_id}</span>
          </Row>
        </div>
      )}
    </div>
  );
}
