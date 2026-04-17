import { useState } from 'react';
import { getPickers, setPickerSession, removePicker } from '../utils/pickerStorage.js';

function formatLastLogin(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60_000) return '방금 전';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

export default function PickerLoginView({ onLogin, onAdminLogin, onBack }) {
  const [pickers, setPickers] = useState(getPickers);
  const [showInput, setShowInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState(null); // 삭제 확인 중인 피커 name

  function handleSelect(name) {
    setPickerSession(name);
    onLogin(name);
  }

  function handleAdd(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setPickerSession(name);
    onLogin(name);
  }

  function handleDelete(name) {
    if (deleting === name) {
      removePicker(name);
      setPickers(getPickers());
      setDeleting(null);
    } else {
      setDeleting(name);
    }
  }

  return (
    <div className="login-wrap">
      <div className="picker-login-card">

        {/* 헤더 */}
        <div className="picker-login-header">
          <button className="btn btn-icon" onClick={onBack} aria-label="뒤로">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <div className="picker-login-title">피커 로그인</div>
          </div>
        </div>

        <p className="picker-login-guide">
          피킹을 담당하실 분의 이름을 선택해주세요
        </p>

        {/* 기존 피커 그리드 */}
        {pickers.length > 0 && (
          <div className="picker-grid">
            {pickers
              .slice()
              .sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0))
              .map(p => (
                <div
                  key={p.id}
                  className={`picker-card ${deleting === p.name ? 'picker-card--confirm-delete' : ''}`}
                  onClick={() => deleting === p.name ? null : handleSelect(p.name)}
                >
                  {deleting === p.name ? (
                    <>
                      <div className="picker-card-icon" style={{ fontSize: 28 }}>🗑️</div>
                      <div className="picker-card-name" style={{ fontSize: 13, color: 'var(--danger)' }}>삭제할까요?</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, width: '100%' }}>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ flex: 1, height: 32, fontSize: 12 }}
                          onClick={e => { e.stopPropagation(); handleDelete(p.name); }}
                        >
                          삭제
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1, height: 32, fontSize: 12 }}
                          onClick={e => { e.stopPropagation(); setDeleting(null); }}
                        >
                          취소
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="picker-card-icon">👤</div>
                      <div className="picker-card-name">{p.name}</div>
                      {p.lastLogin && (
                        <div className="picker-card-last">{formatLastLogin(p.lastLogin)}</div>
                      )}
                      <button
                        className="picker-card-del"
                        onClick={e => { e.stopPropagation(); setDeleting(p.name); }}
                        aria-label="삭제"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* 새 피커 추가 */}
        <div className="picker-new-section">
          {!showInput ? (
            <button
              className="btn btn-secondary btn-full picker-add-btn"
              onClick={() => setShowInput(true)}
            >
              + 새 피커로 시작
            </button>
          ) : (
            <form className="picker-new-form" onSubmit={handleAdd}>
              <input
                type="text"
                placeholder="이름 입력 (예: 홍길동)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
                maxLength={20}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={!newName.trim()}
                >
                  시작
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => { setShowInput(false); setNewName(''); }}
                >
                  취소
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 관리자 로그인 링크 */}
        <button className="picker-admin-link" onClick={onAdminLogin}>
          관리자 로그인이 필요하신가요?
        </button>

      </div>
    </div>
  );
}
