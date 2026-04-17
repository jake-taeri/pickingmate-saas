export default function Header({ view, onBack, onSettings, onStats, selectedOrder, pickerName, onPickerLogout }) {
  const isPickingView = view === 'picking';
  const isSettingsView = view === 'settings';
  const isBarcodeMgmt = view === 'barcode-mgmt';
  const isStatsView = view === 'stats';
  const showBack = isPickingView || isBarcodeMgmt || isStatsView;

  const title =
    isPickingView && selectedOrder
      ? (selectedOrder.receiver?.name || selectedOrder.buyer_name || '주문') + ' 피킹'
      : isSettingsView   ? '설정'
      : isBarcodeMgmt    ? '바코드 관리'
      : isStatsView      ? '피킹 통계'
      : pickerName       ? `${pickerName} 님`
      : '피킹메이트';

  return (
    <header className="header no-print">
      {showBack ? (
        <button className="btn btn-icon" onClick={onBack} aria-label="뒤로가기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
      ) : (
        <span className="header-logo">📦</span>
      )}

      <h1 className="header-title">{title}</h1>

      {/* 피커 모드: 로그아웃 버튼 */}
      {pickerName && onPickerLogout && !isPickingView && (
        <button
          className="btn btn-icon picker-logout-btn"
          onClick={onPickerLogout}
          aria-label="로그아웃"
          title="로그아웃"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      )}

      {/* 관리자 모드: 통계 + 설정 버튼 */}
      {!pickerName && !isPickingView && !isStatsView && (
        <div style={{ display: 'flex', gap: 4 }}>
          {onStats && view === 'list' && (
            <button
              className="btn btn-icon"
              onClick={onStats}
              aria-label="피킹 통계"
              title="피킹 통계"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </button>
          )}
          {onSettings && (
            <button
              className="btn btn-icon"
              onClick={onSettings}
              aria-label={isSettingsView ? '닫기' : '설정'}
            >
              {isSettingsView ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              )}
            </button>
          )}
        </div>
      )}

      {/* 피킹/통계 화면: 오른쪽 spacer */}
      {(isPickingView || isStatsView) && <span style={{ width: 44 }} />}
    </header>
  );
}
