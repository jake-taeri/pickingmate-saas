/**
 * 데이터 포맷 유틸리티
 */

export function formatMoney(amount) {
  if (!amount && amount !== 0) return '-';
  return Number(amount).toLocaleString('ko-KR') + '원';
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (_) {
    return dateStr;
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  } catch (_) {
    return dateStr;
  }
}

export function formatPhone(phone) {
  if (!phone) return '-';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function normalizeImageUrl(url, mallId = '') {
  if (!url) return null;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) {
    // mall ID가 있으면 해당 도메인, 없으면 상대 경로 그대로 반환
    if (mallId) return `https://${mallId}.cafe24.com${url}`;
    return url;
  }
  return url;
}

/** 배송 메시지에서 숙소명/객실/배송시간 파싱 (형식: "숙소명|객실|배송시간") */
export function parseDeliveryMessage(message) {
  if (!message) return { raw: '' };
  // 파이프(|) 구분자 패턴
  const parts = message.split('|').map(s => s.trim());
  if (parts.length >= 3) {
    return { lodge: parts[0], room: parts[1], deliveryTime: parts[2], raw: message };
  }
  // 줄바꿈 패턴
  const lines = message.split(/\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length >= 3) {
    return { lodge: lines[0], room: lines[1], deliveryTime: lines[2], raw: message };
  }
  return { raw: message };
}

export function totalItemQty(items) {
  return (items || []).reduce((s, i) => s + (parseInt(i.quantity) || 0), 0);
}
