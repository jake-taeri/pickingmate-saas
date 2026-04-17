/**
 * 현재 테넌트의 플랜 상태를 관리하는 훅
 * Worker KV에서 테넌트 정보를 가져와 유효 플랜을 계산합니다.
 */

import { useState, useEffect, useCallback } from 'react';
import { loadSettings } from '../utils/storage.js';
import { calcTrial, getEffectivePlan, canUse, TRIAL_PLAN } from '../utils/plan.js';

const CACHE_KEY = 'pm_tenant_info';
const CACHE_TTL = 60 * 60 * 1000; // 1시간

function loadCachedTenantInfo() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch (_) { return null; }
}

function saveCachedTenantInfo(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch (_) {}
}

export default function usePlan() {
  const [tenantInfo, setTenantInfo] = useState(() => loadCachedTenantInfo());
  const [loading, setLoading] = useState(!loadCachedTenantInfo());

  const fetchTenantInfo = useCallback(async () => {
    const settings = loadSettings();
    if (!settings.workerUrl || !settings.mallId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `${settings.workerUrl}/tenant-info?mall_id=${settings.mallId}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        setTenantInfo(data);
        saveCachedTenantInfo(data);
      }
    } catch (_) {
      // 네트워크 오류 시 캐시 유지
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenantInfo();
  }, [fetchTenantInfo]);

  const effectivePlan = getEffectivePlan(tenantInfo);
  const trial = calcTrial(tenantInfo?.trialStartedAt);

  return {
    plan: effectivePlan,                         // 'starter' | 'pro' | 'business'
    isTrial: trial.active,                       // 체험 기간 중 여부
    trialDaysLeft: trial.daysLeft,               // 남은 체험일
    trialDaysUsed: trial.daysUsed,               // 사용한 체험일
    isTrialExpired: !trial.active && !!tenantInfo?.trialStartedAt, // 체험 만료
    loading,
    can: (featureId) => canUse(featureId, effectivePlan), // 기능 사용 가능 여부
    refresh: fetchTenantInfo,
  };
}
