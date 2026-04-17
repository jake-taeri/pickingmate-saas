/**
 * 체험 기간 상태 배너
 * - 체험 중: 남은 일수 + 업그레이드 버튼
 * - 체험 만료: 업그레이드 안내
 */
export default function TrialBanner({ isTrial, trialDaysLeft, isTrialExpired }) {
  if (!isTrial && !isTrialExpired) return null;

  if (isTrialExpired) {
    return (
      <div className="trial-banner trial-banner--expired no-print">
        <span>체험 기간이 종료되었습니다. Starter 플랜으로 이용 중입니다.</span>
        <a
          href="https://pickingmate.io/pricing"
          target="_blank"
          rel="noopener noreferrer"
          className="trial-banner-btn"
        >
          업그레이드
        </a>
      </div>
    );
  }

  const isUrgent = trialDaysLeft <= 3;

  return (
    <div className={`trial-banner ${isUrgent ? 'trial-banner--urgent' : ''} no-print`}>
      <span>
        {isUrgent
          ? `⚠️ Pro 체험 ${trialDaysLeft}일 남았습니다`
          : `Pro 무료 체험 중 · ${trialDaysLeft}일 남음`}
      </span>
      <a
        href="https://pickingmate.io/pricing"
        target="_blank"
        rel="noopener noreferrer"
        className="trial-banner-btn"
      >
        플랜 보기
      </a>
    </div>
  );
}
