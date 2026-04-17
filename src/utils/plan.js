/**
 * 플랜 정의 및 기능 플래그
 */

export const TRIAL_DAYS = 14;
export const TRIAL_PLAN = 'pro'; // 체험 기간은 Pro로 제공

export const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 9900,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 29900,
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 59900,
  },
};

// 플랜별 기능 정의
// true = 해당 플랜에서 사용 가능
export const FEATURES = {
  picking_list:           { starter: true,  pro: true,  business: true,  label: '피킹리스트 생성' },
  picking_app:            { starter: true,  pro: true,  business: true,  label: '피킹 앱' },
  voice_guide:            { starter: false, pro: true,  business: true,  label: '음성 안내' },
  barcode_scan:           { starter: false, pro: true,  business: true,  label: '바코드 스캔' },
  multi_picker:           { starter: false, pro: true,  business: true,  label: '멀티 피커' },
  wrong_pick_prevention:  { starter: false, pro: true,  business: true,  label: '오피킹 방지' },
  picking_stats:          { starter: false, pro: false, business: true,  label: '피킹 통계' },
  picker_performance:     { starter: false, pro: false, business: true,  label: '피커 성과 분석' },
};

/**
 * 특정 플랜에서 기능 사용 가능 여부
 * @param {string} featureId - FEATURES의 키
 * @param {string} planId    - 'starter' | 'pro' | 'business'
 */
export function canUse(featureId, planId) {
  const feature = FEATURES[featureId];
  if (!feature) return true; // 정의 없으면 허용
  return feature[planId] === true;
}

/**
 * 체험 기간 계산
 * @param {number} trialStartedAt - ms timestamp
 * @returns {{ active: boolean, daysLeft: number, daysUsed: number }}
 */
export function calcTrial(trialStartedAt) {
  if (!trialStartedAt) return { active: false, daysLeft: 0, daysUsed: 0 };
  const elapsed = Date.now() - trialStartedAt;
  const daysUsed = Math.floor(elapsed / 86400_000);
  const daysLeft = Math.max(0, TRIAL_DAYS - daysUsed);
  return { active: daysLeft > 0, daysLeft, daysUsed };
}

/**
 * 체험/플랜 상태에서 유효 플랜 ID 반환
 * @param {{ plan: string, trialStartedAt: number }} tenantInfo
 */
export function getEffectivePlan(tenantInfo) {
  if (!tenantInfo) return 'starter';
  const { active } = calcTrial(tenantInfo.trialStartedAt);
  if (active) return TRIAL_PLAN; // 체험 중 → Pro
  return tenantInfo.plan || 'starter';
}
