import { useState } from 'react';
import { loadSettings, saveSettings, ORDER_STATUSES } from '../utils/storage.js';
import { checkWorkerHealth, checkTokenStatus, pushAppSettings } from '../api/cafe24.js';

export default function SettingsView({ showToast, onClose, onLogout, onBarcodeMgmt }) {
  const [settings, setSettings] = useState(loadSettings);
  const [workerStatus, setWorkerStatus] = useState(null); // 'checking' | 'ok' | 'error'
  const [tokenStatus, setTokenStatus] = useState(null);

  // Worker URL 입력값 (저장 전 임시)
  const [workerUrlInput, setWorkerUrlInput] = useState(settings.workerUrl || '');
  const [mallIdInput, setMallIdInput] = useState(settings.mallId || '');

  // 주문 설정 임시값 (저장 버튼 클릭 시 반영)
  const [draftListStatus, setDraftListStatus] = useState(settings.pickingListStatus);
  const [draftWorkStatus, setDraftWorkStatus] = useState(settings.pickingWorkStatus);

  function handleSaveOrderSettings() {
    const updated = { ...settings, pickingListStatus: draftListStatus, pickingWorkStatus: draftWorkStatus };
    saveSettings(updated);
    setSettings(updated);
    // Worker KV에 동기화 — 피커 기기에 즉시 반영
    pushAppSettings({ pickingListStatus: draftListStatus, pickingWorkStatus: draftWorkStatus });
    showToast('주문 설정이 저장되었습니다', 'success');
  }

  function handleSaveWorkerUrl() {
    const url = workerUrlInput.trim().replace(/\/$/, '');
    const mallId = mallIdInput.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const updated = { ...settings, workerUrl: url, mallId };
    saveSettings(updated);
    setSettings(updated);
    setMallIdInput(mallId);
    showToast('연결 설정이 저장되었습니다', 'success');
  }

  async function handleCheckConnection() {
    setWorkerStatus('checking');
    setTokenStatus(null);
    const health = await checkWorkerHealth();
    setWorkerStatus(health.ok ? 'ok' : 'error');
    if (health.ok) {
      const ts = await checkTokenStatus();
      setTokenStatus(ts);
    } else {
      showToast('연결 실패: ' + health.error, 'error');
    }
  }

  function clearAllPickingData() {
    if (!confirm('모든 피킹 진행 데이터를 삭제하시겠습니까?')) return;
    localStorage.removeItem('pm_picking');
    localStorage.removeItem('pm_zones');
    showToast('피킹 데이터가 삭제되었습니다');
  }

  return (
    <div className="settings-body">
      {/* 쇼핑몰 연결 설정 */}
      <div className="settings-section">
        <div className="settings-section-title">쇼핑몰 연결</div>

        <div className="settings-row">
          <label>카페24 Mall ID</label>
          <input
            type="text"
            placeholder="예: yourstore"
            value={mallIdInput}
            onChange={e => setMallIdInput(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <p className="settings-hint">
            카페24 쇼핑몰 ID를 입력하세요.<br />
            예: <code style={{ background: 'var(--bg3)', padding: '1px 5px', borderRadius: 3 }}>yourstore</code>.cafe24.com 에서 <strong>yourstore</strong> 부분
          </p>
        </div>

        <div className="settings-row">
          <label>Worker URL</label>
          <input
            type="url"
            placeholder="https://your-worker.workers.dev"
            value={workerUrlInput}
            onChange={e => setWorkerUrlInput(e.target.value)}
          />
          <p className="settings-hint">
            Cloudflare Worker 배포 후 URL을 입력하세요.
          </p>
        </div>

        <div className="settings-row">
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSaveWorkerUrl}>
              저장
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleCheckConnection}
              disabled={workerStatus === 'checking'}
            >
              {workerStatus === 'checking' ? '확인 중...' : '연결 확인'}
            </button>
          </div>
        </div>

        {workerStatus && workerStatus !== 'checking' && (
          <div className="settings-row">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              color: workerStatus === 'ok' ? 'var(--success)' : 'var(--danger)',
              fontSize: 14, fontWeight: 600,
            }}>
              {workerStatus === 'ok' ? '✅ Worker 연결 성공' : '❌ Worker 연결 실패'}
            </div>
            {tokenStatus && (
              <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7 }}>
                <div>토큰 상태: {tokenStatus.access_valid ? '✅ 유효' : '⚠️ 만료됨'}</div>
                {tokenStatus.access_expires_at > 0 && (
                  <div>만료 시각: {new Date(tokenStatus.access_expires_at).toLocaleString('ko-KR')}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 음성 안내 */}
      <div className="settings-section">
        <div className="settings-section-title">음성 안내</div>
        <div className="settings-row">
          <div className="settings-toggle-row">
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                음성 안내
              </div>
              <p className="settings-hint" style={{ margin: 0 }}>
                스캔 성공·담기 완료 시 한국어 음성으로 안내합니다.
              </p>
            </div>
            <button
              className={`toggle-switch ${settings.voiceEnabled ? 'toggle-switch--on' : ''}`}
              onClick={() => {
                const updated = { ...settings, voiceEnabled: !settings.voiceEnabled };
                saveSettings(updated);
                setSettings(updated);
              }}
              aria-label="음성 안내 토글"
            >
              <span className="toggle-thumb" />
            </button>
          </div>
        </div>
      </div>

      {/* 주문 설정 */}
      <div className="settings-section">
        <div className="settings-section-title">주문 설정</div>

        <div className="settings-row">
          <label>피킹리스트 출력 대상 상태</label>
          <select
            className="settings-select"
            value={draftListStatus}
            onChange={e => setDraftListStatus(e.target.value)}
          >
            {ORDER_STATUSES.map(s => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </select>
          <p className="settings-hint">주문 목록에 표시할 주문 상태입니다. (기본: 배송대기)</p>
        </div>

        <div className="settings-row">
          <label>피킹 진행 대상 상태</label>
          <select
            className="settings-select"
            value={draftWorkStatus}
            onChange={e => setDraftWorkStatus(e.target.value)}
          >
            {ORDER_STATUSES.map(s => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </select>
          <p className="settings-hint">피킹 작업 시 적용할 주문 상태입니다. (기본: 배송중)</p>
        </div>

        <div className="settings-row">
          <button
            className="btn btn-success btn-full"
            onClick={handleSaveOrderSettings}
          >
            설정 저장
          </button>
        </div>
      </div>

      {/* 바코드 관리 */}
      <div className="settings-section">
        <div className="settings-section-title">바코드</div>
        <div className="settings-row">
          <p className="settings-hint">등록된 바코드 목록, 스캔 통계, 라벨 재출력을 관리합니다.</p>
          <button className="btn btn-secondary btn-sm" onClick={onBarcodeMgmt}>
            🏷️ 바코드 관리
          </button>
        </div>
      </div>

      {/* 데이터 관리 */}
      <div className="settings-section">
        <div className="settings-section-title">데이터 관리</div>
        <div className="settings-row">
          <p className="settings-hint">피킹 진행 상태 및 구역 분류 캐시를 모두 삭제합니다.</p>
          <button className="btn btn-danger btn-sm" onClick={clearAllPickingData}>
            피킹 데이터 전체 삭제
          </button>
        </div>
      </div>

      {/* 배포 가이드 */}
      <div className="settings-section">
        <div className="settings-section-title">배포 가이드</div>
        <div className="settings-row" style={{ gap: 6 }}>
          <p className="settings-hint" style={{ lineHeight: 1.8 }}>
            <strong>1. Worker 배포</strong><br />
            <code style={{ background: 'var(--bg3)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
              cd worker &amp;&amp; wrangler deploy
            </code>
            <br /><br />
            <strong>2. Worker 시크릿 설정</strong><br />
            <code style={{ background: 'var(--bg3)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
              wrangler secret put CAFE24_CLIENT_SECRET<br />
              wrangler secret put CAFE24_ACCESS_TOKEN<br />
              wrangler secret put CAFE24_REFRESH_TOKEN
            </code>
            <br /><br />
            <strong>3. KV 네임스페이스 생성</strong><br />
            <code style={{ background: 'var(--bg3)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
              wrangler kv:namespace create PICKINGMATE_KV
            </code>
            <br /><br />
            <strong>4. Vercel 배포</strong><br />
            <code style={{ background: 'var(--bg3)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
              vercel --prod
            </code>
          </p>
        </div>
      </div>

      {/* 로그아웃 */}
      <div className="settings-section">
        <div className="settings-section-title">계정</div>
        <div className="settings-row">
          <p className="settings-hint">로그아웃하면 다시 로그인이 필요합니다.</p>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (confirm('로그아웃 하시겠습니까?')) onLogout?.();
            }}
          >
            로그아웃
          </button>
        </div>
      </div>

      <div style={{ height: 32 }} />
    </div>
  );
}
