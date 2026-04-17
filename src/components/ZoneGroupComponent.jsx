import { useState } from 'react';
import { getMajorZone, getSubcategoryList } from '../utils/zones.js';
import { normalizeImageUrl } from '../utils/formatters.js';
import { loadSettings } from '../utils/storage.js';

const FLAG_KEYWORDS = ['용량확인', '원산지', '성인', '알코올', '주류', '선택필요'];

function highlightBulk(name) {
  if (!name || !name.includes('대용량')) return name;
  const parts = name.split('대용량');
  return parts.reduce((acc, part, i) => {
    if (i === 0) return [part];
    return [...acc, <span key={i} style={{ color: '#e53e3e', fontWeight: 800 }}>대용량</span>, part];
  }, []);
}

function needsFlag(item) {
  const name = item.product_name || '';
  const opt = item.option_value || '';
  return FLAG_KEYWORDS.some(kw => name.includes(kw) || opt.includes(kw));
}

// ─── 구역 변경 모달 ───────────────────────────────────────────
function ZoneModal({ item, onSelect, onClose }) {
  return (
    <div className="modal-overlay no-print" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-title">구역 변경 — {item.product_name}</div>
        {getSubcategoryList().map(sub => (
          <div
            key={sub.id}
            className="modal-option"
            onClick={() => { onSelect(sub.letter); onClose(); }}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: sub.color, flexShrink: 0, display: 'inline-block' }} />
            {sub.icon} {sub.label}
          </div>
        ))}
        <div
          className="modal-option"
          style={{ color: 'var(--text3)' }}
          onClick={() => { onSelect(null); onClose(); }}
        >
          ❓ 미분류
        </div>
        <div className="modal-cancel" onClick={onClose}>취소</div>
      </div>
    </div>
  );
}

// ─── 개별 상품 행 ───────────────────────────────────────────
function PickingItem({ item, pickerChecked, inspectorChecked, majorColor, currentLabel, onPickerToggle, onInspectorToggle, onZoneChange }) {
  const [showModal, setShowModal] = useState(false);
  const mallId = loadSettings().mallId || '';
  const imgUrl = normalizeImageUrl(item.product_image || item.small_image || item.image, mallId);
  const flagged = needsFlag(item);

  return (
    <>
      <div className="picking-item">
        {/* 썸네일 */}
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={item.product_name}
            className="item-thumb"
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <div className="item-thumb-placeholder" style={{ display: imgUrl ? 'none' : 'flex' }}>📦</div>

        {/* 상품 정보 */}
        <div className="item-info">
          <div className="item-name">{highlightBulk(item.product_name)}</div>
          {item.option_value && <div className="item-option">{item.option_value}</div>}
          {item.custom_product_code && (
            <div className="item-option" style={{ color: 'var(--text3)', fontSize: 11 }}>
              {item.custom_product_code}
            </div>
          )}
          {flagged && <div className="item-flag">⚠️ 확인 필요</div>}
          <button
            className="zone-select-btn no-print"
            style={{ color: majorColor }}
            onClick={e => { e.stopPropagation(); setShowModal(true); }}
          >
            {currentLabel} ▾
          </button>
        </div>

        {/* 수량 + 피커 + 검수 (가로 한 줄) */}
        <div className="item-checks no-print" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div className="item-qty">× {item.quantity}</div>
          <button
            className={`dual-check ${pickerChecked ? 'checked' : ''}`}
            onClick={e => { e.stopPropagation(); onPickerToggle(); }}
            aria-label="피커 체크"
          >
            <span className="dual-check-label">피커</span>
            {pickerChecked
              ? <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 8l3.5 3.5L13 5"/></svg>
              : null}
          </button>
          <button
            className={`dual-check ${inspectorChecked ? 'checked inspector' : ''}`}
            onClick={e => { e.stopPropagation(); onInspectorToggle(); }}
            aria-label="검수 체크"
          >
            <span className="dual-check-label">검수</span>
            {inspectorChecked
              ? <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 8l3.5 3.5L13 5"/></svg>
              : null}
          </button>
        </div>
      </div>

      {showModal && (
        <ZoneModal
          item={item}
          onSelect={onZoneChange}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ─── 소분류 섹션 ───────────────────────────────────────────
function SubcategorySection({ sub, majorColor, pickerChecked, inspectorChecked, onPickerToggle, onInspectorToggle, onZoneChange }) {
  const { letter, subLabel, items } = sub;
  const sectionLabel = letter ? `${letter} — ${subLabel}` : '미분류';

  return (
    <div>
      {/* 소분류 헤더 */}
      <div style={{
        padding: '6px 14px',
        background: 'var(--bg2)',
        borderTop: '1px solid var(--border)',
        fontSize: 12,
        fontWeight: 700,
        color: majorColor,
        letterSpacing: 0.3,
      }}>
        {sectionLabel}
        <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text3)' }}>{items.length}종</span>
      </div>

      {/* 상품 목록 */}
      <div className="zone-items" style={{ background: 'var(--bg)' }}>
        {items.map(item => (
          <PickingItem
            key={item.order_item_code}
            item={item}
            pickerChecked={pickerChecked.has(item.order_item_code)}
            inspectorChecked={inspectorChecked.has(item.order_item_code)}
            majorColor={majorColor}
            currentLabel={sectionLabel}
            onPickerToggle={() => onPickerToggle(item.order_item_code)}
            onInspectorToggle={() => onInspectorToggle(item.order_item_code)}
            onZoneChange={newLetter => onZoneChange(item.order_item_code, newLetter)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── 대분류 그룹 (최상위 컴포넌트) ────────────────────────
export default function ZoneGroupComponent({ majorGroup, pickerChecked, inspectorChecked, onPickerToggle, onInspectorToggle, onZoneChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const { id, label, icon, color, bg, subcategories, totalItems } = majorGroup;

  return (
    <div className="zone-group">
      {/* 대분류 헤더 */}
      <div
        className="zone-header"
        style={{
          background: bg,
          borderRadius: collapsed ? 'var(--radius)' : 'var(--radius) var(--radius) 0 0',
        }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="zone-dot" style={{ background: color }} />
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span className="zone-label" style={{ color }}>{label}</span>
        <span className="zone-count" style={{ color: 'var(--text3)' }}>{totalItems}종</span>
        <span className={`zone-chevron ${collapsed ? '' : 'open'}`} style={{ color: 'var(--text3)' }}>▼</span>
      </div>

      {/* 소분류 + 아이템 */}
      {!collapsed && (
        <div style={{ borderRadius: '0 0 var(--radius) var(--radius)', overflow: 'hidden' }}>
          {subcategories.map(sub => (
            <SubcategorySection
              key={sub.letter ?? '__none__'}
              sub={sub}
              majorColor={color}
              pickerChecked={pickerChecked}
              inspectorChecked={inspectorChecked}
              onPickerToggle={onPickerToggle}
              onInspectorToggle={onInspectorToggle}
              onZoneChange={onZoneChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
