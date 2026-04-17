import { useState, useMemo } from 'react';
import {
  loadPickingSessions,
  clearPickingMetrics,
  exportMetricsJson,
  statsSummary,
  statsPerPicker,
  statsPerProduct,
  statsPerHour,
  statsPerZone,
  statsByDate,
  generateInsights,
} from '../utils/pickingMetrics.js';

const TABS = [
  { id: 'summary',  label: '요약' },
  { id: 'picker',   label: '피커별' },
  { id: 'product',  label: '상품별' },
  { id: 'hour',     label: '시간대' },
  { id: 'daily',    label: '일별' },
];

function fmtSecs(s) {
  if (s >= 60) return `${Math.floor(s / 60)}분 ${s % 60}초`;
  return `${s}초`;
}

function EmptyState({ msg = '데이터가 없습니다' }) {
  return (
    <div className="stats-empty">
      <div className="stats-empty-icon">📊</div>
      <div>{msg}</div>
    </div>
  );
}

// ── 요약 탭 ──────────────────────────────────────────────────
function SummaryTab({ sessions, summary, insights, onClear, onExport }) {
  return (
    <div className="stats-tab-content">
      {/* 핵심 지표 */}
      <div className="stats-kpi-grid">
        <div className="stats-kpi">
          <div className="stats-kpi-val">{summary.completeSessions}</div>
          <div className="stats-kpi-label">완료 주문</div>
        </div>
        <div className="stats-kpi">
          <div className="stats-kpi-val">{summary.totalItems}</div>
          <div className="stats-kpi-label">처리 상품수</div>
        </div>
        <div className="stats-kpi">
          <div className="stats-kpi-val">{fmtSecs(summary.avgSecsPerItem)}</div>
          <div className="stats-kpi-label">상품당 평균</div>
        </div>
        <div className="stats-kpi">
          <div className="stats-kpi-val">{summary.avgMinsPerOrder}분</div>
          <div className="stats-kpi-label">주문당 평균</div>
        </div>
      </div>

      {/* 인사이트 */}
      <div className="stats-section-title">운영 인사이트</div>
      <div className="stats-insights">
        {insights.map((ins, i) => (
          <div key={i} className={`stats-insight stats-insight--${ins.type}`}>
            <span className="stats-insight-icon">{ins.icon}</span>
            <span className="stats-insight-text">{ins.text}</span>
          </div>
        ))}
      </div>

      {/* 데이터 관리 */}
      <div className="stats-section-title" style={{ marginTop: 24 }}>데이터 관리</div>
      <div style={{ display: 'flex', gap: 8, padding: '0 16px' }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onExport}>
          JSON 내보내기
        </button>
        <button className="btn btn-secondary" style={{ flex: 1, color: '#ef4444' }} onClick={onClear}>
          데이터 초기화
        </button>
      </div>
      <div style={{ padding: '8px 16px 16px', fontSize: 12, color: 'var(--text3)' }}>
        전체 {sessions.length}건 기록 (최근 90일, 최대 500건 보관)
      </div>
    </div>
  );
}

// ── 피커별 탭 ─────────────────────────────────────────────────
function PickerTab({ pickerStats }) {
  if (pickerStats.length === 0) return <EmptyState msg="피커 데이터가 없습니다" />;
  return (
    <div className="stats-tab-content">
      <div className="stats-table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th>피커</th>
              <th>완료</th>
              <th>상품당</th>
              <th>주문당</th>
              <th>시간당</th>
            </tr>
          </thead>
          <tbody>
            {pickerStats.map(p => (
              <tr key={p.name}>
                <td className="stats-td-name">{p.name}</td>
                <td>{p.sessions}건</td>
                <td className="stats-td-accent">{fmtSecs(p.avgSecsPerItem)}</td>
                <td>{p.avgMinsPerOrder}분</td>
                <td>{p.ordersPerHour}건</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stats-footnote">빠른 순서로 정렬. 완료 주문만 집계.</div>

      {/* 상대 성능 바 */}
      {pickerStats.length >= 2 && (
        <div style={{ padding: '16px 16px 0' }}>
          <div className="stats-section-title" style={{ paddingLeft: 0 }}>상품당 소요시간 비교</div>
          {pickerStats.map(p => {
            const max = pickerStats[pickerStats.length - 1].avgSecsPerItem || 1;
            const pct = Math.round((p.avgSecsPerItem / max) * 100);
            return (
              <div key={p.name} className="stats-bar-row">
                <div className="stats-bar-label">{p.name}</div>
                <div className="stats-bar-track">
                  <div className="stats-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="stats-bar-value">{fmtSecs(p.avgSecsPerItem)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 상품별 탭 ─────────────────────────────────────────────────
function ProductTab({ productStats }) {
  const top20 = productStats.slice(0, 20);
  if (top20.length === 0) return <EmptyState msg="2회 이상 데이터가 없습니다" />;
  return (
    <div className="stats-tab-content">
      <div className="stats-table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th>코드</th>
              <th>상품명</th>
              <th>구역</th>
              <th>평균</th>
              <th>횟수</th>
            </tr>
          </thead>
          <tbody>
            {top20.map(p => (
              <tr key={p.code || p.name}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.code || '—'}</td>
                <td className="stats-td-truncate">{p.name}</td>
                <td style={{ fontSize: 12 }}>{p.majorZone}</td>
                <td className="stats-td-accent">{fmtSecs(p.avgPickSecs)}</td>
                <td style={{ color: 'var(--text3)' }}>{p.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stats-footnote">오래 걸리는 순. 2회 이상 집계된 상품만 표시.</div>
    </div>
  );
}

// ── 시간대 탭 ─────────────────────────────────────────────────
function HourTab({ hourStats }) {
  if (hourStats.length === 0) return <EmptyState msg="시간대 데이터가 없습니다" />;

  const maxSecs = Math.max(...hourStats.map(h => h.avgSecsPerItem), 1);
  const bestHour = hourStats.reduce((a, b) => a.avgSecsPerItem < b.avgSecsPerItem ? a : b);

  // 6~22시 범위 표시 (데이터 없는 시간은 빈 바)
  const minH = Math.min(...hourStats.map(h => h.hour), 6);
  const maxH = Math.max(...hourStats.map(h => h.hour), 21);
  const hourMap = Object.fromEntries(hourStats.map(h => [h.hour, h]));

  return (
    <div className="stats-tab-content">
      <div style={{ padding: '16px 16px 8px' }}>
        <div className="stats-section-title" style={{ paddingLeft: 0, marginBottom: 16 }}>
          시간대별 상품당 평균 소요시간 (KST)
        </div>
        <div className="hour-chart-wrap">
          <div className="hour-chart">
            {Array.from({ length: maxH - minH + 1 }, (_, i) => minH + i).map(h => {
              const stat = hourMap[h];
              const pct = stat ? Math.round((stat.avgSecsPerItem / maxSecs) * 100) : 0;
              const isBest = stat && h === bestHour.hour;
              return (
                <div key={h} className="hour-bar-col">
                  <div
                    className={`hour-bar ${isBest ? 'hour-bar--best' : ''}`}
                    style={{ height: `${Math.max(pct, 2)}%`, opacity: stat ? 1 : 0.15 }}
                    title={stat ? `${h}시: ${fmtSecs(stat.avgSecsPerItem)} (${stat.sessions}건)` : `${h}시: 데이터 없음`}
                  />
                  <div className="hour-label">{h % 3 === 0 ? h : ''}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="stats-table-wrap">
        <table className="stats-table">
          <thead>
            <tr><th>시간대</th><th>건수</th><th>상품당 평균</th><th>비고</th></tr>
          </thead>
          <tbody>
            {hourStats.map(h => (
              <tr key={h.hour}>
                <td>{h.hour}시대</td>
                <td>{h.sessions}건</td>
                <td className={h.hour === bestHour.hour ? 'stats-td-accent' : ''}>
                  {fmtSecs(h.avgSecsPerItem)}
                </td>
                <td style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {h.hour === bestHour.hour ? '⭐ 최고' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 일별 탭 ──────────────────────────────────────────────────
function DailyTab({ dailyStats }) {
  if (dailyStats.length === 0) return <EmptyState msg="일별 데이터가 없습니다" />;
  return (
    <div className="stats-tab-content">
      <div className="stats-table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>완료</th>
              <th>상품수</th>
              <th>주문당</th>
            </tr>
          </thead>
          <tbody>
            {dailyStats.map(d => (
              <tr key={d.date}>
                <td style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{d.date}</td>
                <td>{d.complete}건</td>
                <td>{d.itemsCompleted}개</td>
                <td className="stats-td-accent">
                  {d.avgMinsPerOrder > 0 ? `${d.avgMinsPerOrder}분` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stats-footnote">최근 30일. 최신순.</div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function PickingStatsView({ showToast }) {
  const [sessions, setSessions] = useState(() => loadPickingSessions());
  const [activeTab, setActiveTab] = useState('summary');

  const summary    = useMemo(() => statsSummary(sessions),    [sessions]);
  const pickerStats  = useMemo(() => statsPerPicker(sessions),  [sessions]);
  const productStats = useMemo(() => statsPerProduct(sessions), [sessions]);
  const hourStats    = useMemo(() => statsPerHour(sessions),    [sessions]);
  const dailyStats   = useMemo(() => statsByDate(sessions),     [sessions]);
  const insights     = useMemo(() => generateInsights(sessions), [sessions]);

  function handleClear() {
    if (!confirm('모든 피킹 통계 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
    clearPickingMetrics();
    setSessions([]);
    showToast('통계 데이터가 초기화되었습니다');
  }

  function handleExport() {
    exportMetricsJson();
    showToast('JSON 파일 다운로드 시작');
  }

  return (
    <div className="stats-body">
      {/* 탭 바 */}
      <div className="stats-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`stats-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'summary' && (
        <SummaryTab
          sessions={sessions}
          summary={summary}
          insights={insights}
          onClear={handleClear}
          onExport={handleExport}
        />
      )}
      {activeTab === 'picker'  && <PickerTab  pickerStats={pickerStats} />}
      {activeTab === 'product' && <ProductTab productStats={productStats} />}
      {activeTab === 'hour'    && <HourTab    hourStats={hourStats} />}
      {activeTab === 'daily'   && <DailyTab   dailyStats={dailyStats} />}
    </div>
  );
}
