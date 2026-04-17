import { useState, useMemo, useCallback } from 'react';
import { getRegistry, deleteBarcode } from '../utils/barcodeRegistry.js';
import BarcodeImage from './BarcodeImage.jsx';
import BarcodeLabelPrint from './BarcodeLabelPrint.jsx';

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function BarcodeManagementView({ onBack }) {
  const [search, setSearch] = useState('');
  const [reprintItem, setReprintItem] = useState(null); // { item, copies }
  const [reprintCopies, setReprintCopies] = useState(1);
  const [, forceUpdate] = useState(0);

  const registry = getRegistry();
  const entries = Object.values(registry);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(e =>
      e.code.toLowerCase().includes(q) ||
      e.productName.toLowerCase().includes(q)
    );
  }, [search, registry]);

  const handleDelete = useCallback((code) => {
    if (!confirm(`"${code}" 바코드를 삭제하시겠습니까?`)) return;
    deleteBarcode(code);
    forceUpdate(n => n + 1);
  }, []);

  function handleReprint(item) {
    setReprintItem(item);
    setReprintCopies(1);
  }

  function doReprint() {
    window.print();
  }

  return (
    <>
      {/* 화면 전용 */}
      <div className="no-print">
        <div className="barcode-mgmt-header">
          <input
            className="barcode-mgmt-search"
            type="text"
            placeholder="코드 또는 상품명 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="barcode-mgmt-count">{filtered.length}개</span>
        </div>

        {filtered.length === 0 ? (
          <div className="barcode-mgmt-empty">
            {search ? '검색 결과가 없습니다.' : '등록된 바코드가 없습니다.\n피킹 화면에서 라벨을 출력하면 자동 등록됩니다.'}
          </div>
        ) : (
          <div className="barcode-mgmt-list">
            {filtered.map(entry => (
              <div key={entry.code} className="barcode-mgmt-item">
                <div className="barcode-mgmt-item-info">
                  <div className="barcode-mgmt-code">{entry.code}</div>
                  <div className="barcode-mgmt-name">{entry.productName || '-'}</div>
                  <div className="barcode-mgmt-meta">
                    <span>생성: {entry.generatedAt || '-'}</span>
                    <span className={entry.printed ? 'badge-printed' : 'badge-notprinted'}>
                      {entry.printed ? '출력됨' : '미출력'}
                    </span>
                  </div>
                  <div className="barcode-mgmt-stats">
                    <span>스캔 {entry.scannedCount || 0}회</span>
                    {entry.mismatchCount > 0 && (
                      <span style={{ color: 'var(--danger)' }}>오매칭 {entry.mismatchCount}회</span>
                    )}
                    {entry.lastScanned && (
                      <span>마지막: {formatDate(entry.lastScanned)}</span>
                    )}
                  </div>
                </div>
                <div className="barcode-mgmt-item-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleReprint(entry)}
                  >
                    재출력
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(entry.code)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 재출력 모달 */}
        {reprintItem && (
          <div className="scanner-overlay" onClick={e => { if (e.target === e.currentTarget) setReprintItem(null); }}>
            <div className="scanner-sheet" style={{ gap: 16 }}>
              <div className="scanner-header">
                <span className="scanner-title">🏷️ 라벨 재출력</span>
                <button className="btn btn-icon" style={{ width: 36, height: 36, fontSize: 16 }} onClick={() => setReprintItem(null)}>✕</button>
              </div>

              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <BarcodeImage value={reprintItem.code} height={52} width={2} />
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>{reprintItem.code}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{reprintItem.productName}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
                <span style={{ fontSize: 14, color: 'var(--text2)' }}>출력 매수</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setReprintCopies(c => Math.max(1, c - 1))}>−</button>
                <span style={{ fontSize: 18, fontWeight: 700, minWidth: 32, textAlign: 'center' }}>{reprintCopies}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setReprintCopies(c => Math.min(20, c + 1))}>+</button>
              </div>

              <button className="btn btn-primary btn-full" onClick={doReprint}>
                🖨️ {reprintCopies}장 출력
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 재출력 인쇄 전용 */}
      {reprintItem && (
        <BarcodeLabelPrint
          items={[{
            custom_product_code: reprintItem.code,
            product_name: reprintItem.productName,
            product_no: reprintItem.cafe24ProductNo,
          }]}
          copies={reprintCopies}
        />
      )}
    </>
  );
}
