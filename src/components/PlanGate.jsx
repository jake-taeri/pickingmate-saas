/**
 * 플랜 제한 게이트
 * 사용 불가 기능에 접근 시 업그레이드 안내를 표시합니다.
 *
 * 사용법:
 *   <PlanGate can={plan.can('barcode_scan')} feature="바코드 스캔" requiredPlan="Pro">
 *     <BarcodeScanner ... />
 *   </PlanGate>
 */

import { FEATURES, PLANS } from '../utils/plan.js';

export default function PlanGate({ can, feature, requiredPlan = 'pro', children }) {
  if (can) return children;

  const planInfo = PLANS[requiredPlan];

  return (
    <div className="plan-gate">
      <div className="plan-gate-icon">🔒</div>
      <div className="plan-gate-title">{feature}</div>
      <div className="plan-gate-desc">
        {planInfo?.name} 플랜 이상에서 사용할 수 있습니다.
      </div>
      <a
        href="https://pickingmate.io/pricing"
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary"
        style={{ marginTop: 16, display: 'inline-block', textDecoration: 'none' }}
      >
        {planInfo?.name} 플랜 시작하기 · {planInfo?.price?.toLocaleString()}원/월
      </a>
    </div>
  );
}

/**
 * 버튼 래퍼: 잠긴 기능 버튼 클릭 시 토스트 안내
 * 사용법:
 *   <PlanGateButton can={plan.can('barcode_scan')} onLocked={() => showToast('...')} onClick={...}>
 *     바코드 스캔
 *   </PlanGateButton>
 */
export function PlanGateButton({ can, onLocked, onClick, children, ...props }) {
  function handleClick() {
    if (!can) {
      onLocked?.();
      return;
    }
    onClick?.();
  }

  return (
    <button {...props} onClick={handleClick} style={{ ...(props.style || {}), position: 'relative' }}>
      {children}
      {!can && (
        <span style={{
          position: 'absolute', top: -4, right: -4,
          background: '#f59e0b', borderRadius: '50%',
          width: 16, height: 16, fontSize: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#000', fontWeight: 800,
        }}>
          🔒
        </span>
      )}
    </button>
  );
}
