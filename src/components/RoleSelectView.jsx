export default function RoleSelectView({ onPickerLogin, onAdminLogin }) {
  return (
    <div className="role-wrap">
      <div className="role-card">
        <div className="role-logo">📦</div>
        <div className="role-title">피킹메이트</div>
        <div className="role-subtitle">로그인 유형을 선택해주세요</div>

        <div className="role-btn-group">
          <button className="role-btn role-btn--picker" onClick={onPickerLogin}>
            <span className="role-btn-icon">👤</span>
            <span className="role-btn-label">피커 로그인</span>
            <span className="role-btn-sub">피킹 작업용</span>
          </button>

          <button className="role-btn role-btn--admin" onClick={onAdminLogin}>
            <span className="role-btn-icon">🛠️</span>
            <span className="role-btn-label">관리자 로그인</span>
            <span className="role-btn-sub">전체 관리</span>
          </button>
        </div>
      </div>
    </div>
  );
}
