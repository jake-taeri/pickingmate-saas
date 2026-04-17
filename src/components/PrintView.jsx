import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { formatDateTime, formatDate, normalizeImageUrl } from '../utils/formatters.js';
import { loadSettings } from '../utils/storage.js';

function highlightBulk(name) {
  if (!name || !name.includes('대용량')) return name;
  const parts = name.split('대용량');
  return parts.reduce((acc, part, i) => {
    if (i === 0) return [part];
    return [...acc, <span key={i} style={{ color: '#e53e3e', fontWeight: 800 }}>대용량</span>, part];
  }, []);
}

const S = {
  // 페이지 전체
  page: { padding: 0, fontSize: 11, color: '#000', lineHeight: 1.2 },

  // 상단 헤더 (한 줄)
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    borderBottom: '1.5px solid #000', paddingBottom: 4, marginBottom: 5,
    fontSize: 11,
  },
  headerTitle: { fontSize: 14, fontWeight: 800, flexShrink: 0 },
  headerMeta: { display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1, fontSize: 10.5 },

  // 배송정보 (한 줄)
  info: {
    display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
    border: '1px solid #ccc', borderRadius: 3, padding: '3px 8px',
    marginBottom: 5, fontSize: 10.5,
  },
  infoItem: { whiteSpace: 'nowrap' },
  infoMsg: { color: '#333', borderLeft: '1px solid #ccc', paddingLeft: 8 },

  // 대분류 헤더
  majorHeader: {
    background: '#e0e0e0', padding: '4px 8px',
    fontWeight: 800, fontSize: 13,
    borderBottom: '1.5px solid #888',
  },

  // 소분류 헤더
  subHeader: {
    background: '#f2f2f2', padding: '3px 8px',
    fontWeight: 700, fontSize: 12,
    borderBottom: '1px solid #ccc',
  },

  // 테이블
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { padding: '4px 3px', borderBottom: '1px solid #bbb', background: '#fafafa', fontWeight: 600, fontSize: 11 },
  tdCheck: { padding: '5px 4px', textAlign: 'center', fontSize: 16, lineHeight: 1, width: 28, borderBottom: '1px solid #eee' },
  tdCheckPick: { padding: '5px 10px 5px 8px', textAlign: 'center', fontSize: 16, lineHeight: 1, width: 36, borderBottom: '1px solid #eee', borderLeft: '1px solid #ddd' },
  tdThumb: { padding: '4px', width: 44, borderBottom: '1px solid #eee', verticalAlign: 'middle' },
  tdCode: { padding: '5px 4px', fontSize: 11, color: '#555', width: 48, borderBottom: '1px solid #eee', verticalAlign: 'middle' },
  tdName: { padding: '5px 4px', fontWeight: 600, lineHeight: 1.2, borderBottom: '1px solid #eee', verticalAlign: 'middle' },
  tdOpt: { padding: '5px 4px', color: '#444', fontSize: 11, borderBottom: '1px solid #eee', verticalAlign: 'middle' },
  tdQty: { padding: '5px 4px', textAlign: 'center', fontWeight: 800, fontSize: 14, width: 32, borderBottom: '1px solid #eee', verticalAlign: 'middle' },

  // 서명란
  sign: { marginTop: 8, paddingTop: 6, borderTop: '1px solid #ccc', display: 'flex', gap: 24, fontSize: 11 },
};

export default function PrintView({ order, zoneGroups, noWrapper = false }) {
  const {
    order_id, buyer_name, buyer_phone, order_date,
    receiver, payment_amount, wished_delivery_date,
  } = order;

  const recipientName  = receiver?.name || buyer_name;
  const recipientPhone = receiver?.cellphone || receiver?.phone || buyer_phone;
  const address        = [receiver?.address1, receiver?.address2].filter(Boolean).join(' ');
  const deliveryMsg    = receiver?.shipping_message || order.shipping_message;
  const wishedDate     = receiver?.wished_delivery_date || wished_delivery_date;
  const wishedTime     = receiver?.wished_delivery_time || null;
  const shippingCompany = order.shipping_company_name || null;
  const totalItems     = zoneGroups.reduce((n, g) => n + g.totalItems, 0);

  // 배송요청사항 파싱
  const { lodge, room, raw } = (() => {
    if (!deliveryMsg) return {};
    const parts = deliveryMsg.split('|').map(s => s.trim());
    if (parts.length >= 2) return { lodge: parts[0], room: parts[1], raw: deliveryMsg };
    return { raw: deliveryMsg };
  })();

  // QR코드 생성
  const [qrDataUrl, setQrDataUrl] = useState(null);
  useEffect(() => {
    const payload = JSON.stringify({
      phone: recipientPhone || '',
      name: recipientName || '',
      orderId: order_id || '',
      address: address || '',
    });
    QRCode.toDataURL(payload, { width: 80, margin: 1, errorCorrectionLevel: 'M' })
      .then(url => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null));
  }, [order_id, recipientName, recipientPhone, address]);

  const infoCell = (label, value) =>
    value ? (
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
        <span style={{ color: '#666', whiteSpace: 'nowrap', minWidth: 72, fontSize: 10 }}>{label}</span>
        <span style={{ fontWeight: 600, fontSize: 18 }}>{value}</span>
      </div>
    ) : null;

  const content = (
    <div style={S.page}>

      {/* ── 헤더 한 줄 ── */}
      <div style={{ ...S.header, position: 'relative' }}>
        <span style={S.headerTitle}>📦 피킹시트</span>
        <div style={S.headerMeta}>
          <span><strong>{order_id}</strong></span>
          <span>총 {totalItems}종</span>
          <span style={{ marginLeft: 'auto', color: '#666' }}>출력: {formatDateTime(new Date().toISOString())}</span>
        </div>
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt="QR"
            className="qr-print-only"
            style={{ width: 80, height: 80, flexShrink: 0 }}
          />
        )}
      </div>

      {/* ── 배송 정보 박스 ── */}
      <div style={{
        border: '1px solid #bbb', borderRadius: 3, padding: '6px 10px',
        marginBottom: 6, display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '3px 12px', fontSize: 11, lineHeight: 1.4,
      }}>
        {infoCell('수령인', recipientName)}
        {infoCell('연락처', recipientPhone)}
        {infoCell('희망배송일', wishedDate ? formatDate(wishedDate) : null)}
        {infoCell('희망배송시간', wishedTime)}
        {infoCell('배송업체', shippingCompany)}
        {infoCell('숙소/객실', lodge && room ? `${lodge} / ${room}` : lodge || room || null)}
        {address && (
          <div style={{ gridColumn: 'span 2', display: 'flex', gap: 4 }}>
            <span style={{ color: '#666', whiteSpace: 'nowrap', minWidth: 72, fontSize: 10 }}>배송지</span>
            <span style={{ fontWeight: 600, fontSize: 18 }}>{address}</span>
          </div>
        )}
        {raw && (
          <div style={{
            gridColumn: 'span 2',
            borderTop: '1.5px solid #999',
            marginTop: 4, paddingTop: 4,
            display: 'flex', gap: 6, alignItems: 'flex-start',
          }}>
            <span style={{
              color: '#000', whiteSpace: 'nowrap', minWidth: 72,
              fontSize: 11, fontWeight: 700,
            }}>배송요청사항</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#000', lineHeight: 1.4 }}>{raw}</span>
          </div>
        )}
      </div>

      {/* ── 대분류 → 소분류 → 상품 ── */}
      {zoneGroups.map(major => (
        <div key={major.id} style={{ marginBottom: 6 }}>

          {/* 대분류 헤더 */}
          <div style={S.majorHeader}>
            {major.icon} {major.label}
            <span style={{ fontWeight: 400, fontSize: 10, marginLeft: 6 }}>({major.totalItems}종)</span>
          </div>

          {major.subcategories.map(sub => {
            const subTitle = sub.letter ? `${sub.letter} — ${sub.subLabel}` : '미분류';
            return (
              <div key={sub.letter ?? '__none__'} style={{ breakInside: 'avoid' }}>

                {/* 소분류 헤더 */}
                <div style={S.subHeader}>
                  {subTitle}
                  <span style={{ fontWeight: 400, fontSize: 10, marginLeft: 6 }}>({sub.items.length}종)</span>
                </div>

                {/* 상품 테이블 */}
                <table style={S.table}>
                  <colgroup>
                    <col style={{ width: 28 }} />{/* 검수 */}
                    <col style={{ width: 44 }} />{/* 썸네일 */}
                    <col style={{ width: 48 }} />{/* 코드 */}
                    <col />{/* 상품명 */}
                    <col style={{ width: 32 }} />{/* 수량 */}
                    <col style={{ width: '22%' }} />{/* 옵션 */}
                    <col style={{ width: 36 }} />{/* 피킹 */}
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ ...S.th, textAlign: 'center' }}>검수</th>
                      <th style={S.th} />
                      <th style={{ ...S.th, textAlign: 'left' }}>코드</th>
                      <th style={{ ...S.th, textAlign: 'left' }}>상품명</th>
                      <th style={{ ...S.th, textAlign: 'center' }}>수량</th>
                      <th style={{ ...S.th, textAlign: 'left' }}>옵션</th>
                      <th style={{ ...S.th, textAlign: 'center', borderLeft: '1px solid #ddd' }}>피킹</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sub.items.map(item => {
                      const imgUrl = normalizeImageUrl(item.product_image || item.small_image || item.image, loadSettings().mallId || '');
                      return (
                        <tr key={item.order_item_code}>
                          <td style={S.tdCheck}>☐</td>
                          <td style={S.tdThumb}>
                            {imgUrl
                              ? <img src={imgUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', display: 'block', borderRadius: 2 }} />
                              : <div style={{ width: 40, height: 40, background: '#eee', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>-</div>
                            }
                          </td>
                          <td style={S.tdCode}>{item.custom_product_code || '-'}</td>
                          <td style={S.tdName}>{highlightBulk(item.product_name)}</td>
                          <td style={S.tdQty}>{item.quantity}</td>
                          <td style={S.tdOpt}>{item.option_value || '-'}</td>
                          <td style={S.tdCheckPick}>☐</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ))}

      {/* ── 서명란 ── */}
      <div style={S.sign}>
        <span>피킹 확인: ________________</span>
        <span>검수 확인: ________________</span>
        <span>출고 확인: ________________</span>
      </div>
    </div>
  );

  if (noWrapper) return content;
  return <div className="print-only">{content}</div>;
}
