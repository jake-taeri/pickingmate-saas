import { useEffect, useMemo } from 'react';
import BarcodeImage from './BarcodeImage.jsx';
import { registerBarcodes } from '../utils/barcodeRegistry.js';

/**
 * items: [{ custom_product_code, product_name, product_no, ... }]
 * copies: 각 상품 몇 장씩
 * specificItems: 재출력용 특정 아이템 목록 (없으면 items 전체)
 */
export default function BarcodeLabelPrint({ items = [], copies = 1, specificItems = null }) {
  const source = specificItems || items;

  // 자체상품코드가 있는 항목만, 코드 기준 중복 제거
  const unique = useMemo(() => {
    const seen = new Set();
    return source.filter(i => {
      if (!i.custom_product_code) return false;
      if (seen.has(i.custom_product_code)) return false;
      seen.add(i.custom_product_code);
      return true;
    });
  }, [source]);

  // 출력 시 레지스트리에 자동 등록
  useEffect(() => {
    if (unique.length > 0) registerBarcodes(unique);
  }, [unique]);

  // copies 수만큼 라벨 생성
  const labels = useMemo(
    () => unique.flatMap(item => Array(copies).fill(item)),
    [unique, copies]
  );

  if (labels.length === 0) {
    return (
      <div className="print-only">
        <p style={{ padding: 20, color: '#999' }}>자체상품코드가 있는 상품이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="print-only">
      <div className="barcode-label-grid">
        {labels.map((item, idx) => (
          <div key={`${item.custom_product_code}-${idx}`} className="barcode-label">
            <div className="barcode-label-name">
              {item.product_name}
            </div>
            <BarcodeImage value={item.custom_product_code} height={52} width={2} />
            <div className="barcode-label-code">{item.custom_product_code}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
