import { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header.jsx';
import OrderListView from './components/OrderListView.jsx';
import PickingView from './components/PickingView.jsx';
import SettingsView from './components/SettingsView.jsx';
import PickingStatsView from './components/PickingStatsView.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import LoginView from './components/LoginView.jsx';
import RoleSelectView from './components/RoleSelectView.jsx';
import PickerLoginView from './components/PickerLoginView.jsx';
import BarcodeManagementView from './components/BarcodeManagementView.jsx';
import TrialBanner from './components/TrialBanner.jsx';
import PlanGate from './components/PlanGate.jsx';
import { isAuthenticated, logout } from './utils/auth.js';
import { getPickerSession, clearPickerSession } from './utils/pickerStorage.js';
import usePlan from './hooks/usePlan.js';

function PlanGatePage({ feature, requiredPlan }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <PlanGate can={false} feature={feature} requiredPlan={requiredPlan}>
        {null}
      </PlanGate>
    </div>
  );
}

// 인증 상태 초기값 계산
function getInitialAuth() {
  if (isAuthenticated()) return { type: 'admin', name: null };
  const s = getPickerSession();
  if (s) return { type: 'picker', name: s.name };
  return { type: 'none', name: null };
}

export default function App() {
  const [auth, setAuth] = useState(getInitialAuth);
  // loginMode: null(역할 선택) | 'admin'(관리자 로그인 폼) | 'picker'(피커 선택 화면)
  const [loginMode, setLoginMode] = useState(null);
  const [view, setView] = useState('list');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  // 관리자 토큰 만료 자동 감지
  useEffect(() => {
    if (auth.type !== 'admin') return;
    const id = setInterval(() => {
      if (!isAuthenticated()) {
        logout();
        setAuth({ type: 'none', name: null });
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [auth.type]);

  const showToast = useCallback((msg, type = 'default', duration = 2500) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const openOrder = useCallback((order) => {
    setSelectedOrder(order);
    setView('picking');
  }, []);

  const goBack = useCallback(() => {
    setView('list');
    setSelectedOrder(null);
  }, []);

  function handleAdminLogout() {
    logout();
    setAuth({ type: 'none', name: null });
    setView('list');
    setSelectedOrder(null);
    setLoginMode(null);
  }

  function handlePickerLogout() {
    clearPickerSession();
    setAuth({ type: 'none', name: null });
    setView('list');
    setSelectedOrder(null);
    setLoginMode(null);
  }

  // ── 미인증 흐름 ────────────────────────────────────────────
  if (auth.type === 'none') {
    // 역할 선택 화면
    if (loginMode === null) {
      return (
        <RoleSelectView
          onPickerLogin={() => setLoginMode('picker')}
          onAdminLogin={() => setLoginMode('admin')}
        />
      );
    }

    // 관리자 로그인 폼
    if (loginMode === 'admin') {
      return (
        <LoginView
          onLogin={() => setAuth({ type: 'admin', name: null })}
          onBack={() => setLoginMode(null)}
        />
      );
    }

    // 피커 로그인 화면
    if (loginMode === 'picker') {
      return (
        <PickerLoginView
          onLogin={(name) => setAuth({ type: 'picker', name })}
          onAdminLogin={() => setLoginMode('admin')}
          onBack={() => setLoginMode(null)}
        />
      );
    }
  }

  // ── 인증된 메인 앱 ─────────────────────────────────────────
  const isAdmin = auth.type === 'admin';
  const plan = usePlan();

  // 잠긴 기능 접근 시 토스트 안내
  const showPlanToast = useCallback((featureName, requiredPlan = 'Pro') => {
    showToast(`${featureName}은 ${requiredPlan} 플랜 이상에서 사용 가능합니다`, 'error', 3000);
  }, [showToast]);

  return (
    <>
      <Header
        view={view}
        onBack={goBack}
        onSettings={isAdmin ? () => setView(view === 'settings' ? 'list' : 'settings') : null}
        onStats={isAdmin && plan.can('picking_stats') ? () => setView('stats') : null}
        selectedOrder={selectedOrder}
        pickerName={auth.type === 'picker' ? auth.name : null}
        onPickerLogout={auth.type === 'picker' ? handlePickerLogout : null}
      />

      {/* 체험 기간 배너 — 관리자에게만 표시 */}
      {isAdmin && (
        <TrialBanner
          isTrial={plan.isTrial}
          trialDaysLeft={plan.trialDaysLeft}
          isTrialExpired={plan.isTrialExpired}
        />
      )}

      <main style={{ flex: 1 }}>
        {view === 'list' && (
          <OrderListView onSelectOrder={openOrder} showToast={showToast} isAdmin={isAdmin} pickerName={auth.name} />
        )}
        {view === 'picking' && selectedOrder && (
          <PickingView
            order={selectedOrder}
            showToast={showToast}
            onBack={goBack}
            pickerName={auth.name}
            plan={plan}
            showPlanToast={showPlanToast}
          />
        )}
        {isAdmin && view === 'settings' && (
          <SettingsView
            showToast={showToast}
            onClose={() => setView('list')}
            onLogout={handleAdminLogout}
            onBarcodeMgmt={() => setView('barcode-mgmt')}
          />
        )}
        {isAdmin && view === 'barcode-mgmt' && (
          <BarcodeManagementView onBack={() => setView('settings')} />
        )}
        {isAdmin && view === 'stats' && (
          plan.can('picking_stats')
            ? <PickingStatsView showToast={showToast} />
            : <PlanGatePage feature="피킹 통계" requiredPlan="business" />
        )}
      </main>

      <ToastContainer toasts={toasts} />
    </>
  );
}
