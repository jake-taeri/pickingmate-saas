import { useEffect, useRef, useState } from 'react';
import Quagga from '@ericblade/quagga2';
import { recordScan, lookupBarcode } from '../utils/barcodeRegistry.js';
import { normalizeImageUrl } from '../utils/formatters.js';
import { loadSettings } from '../utils/storage.js';
import { speak, simplifyProductName } from '../utils/speech.js';
import {
  createPickingSession,
  sessionOnFirstScan,
  sessionOnScan,
  sessionOnConfirm,
  finalizePickingSession,
} from '../utils/pickingMetrics.js';
import { detectSimilarItems } from '../utils/pickingWarnings.js';

// ── 오디오 피드백 ──────────────────────────────────────────────
function playBeep(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {}
}

function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch {}
}

// ── 스캔 상태 ──────────────────────────────────────────────────
const M = { SCANNING: 'scanning', MATCH: 'match', MISMATCH: 'mismatch', UNKNOWN: 'unknown', DONE: 'done' };

export default function BarcodeScanner({ allItems = [], pickerChecked, onConfirmPick, onClose, orderId, pickerName }) {
  const containerRef = useRef(null);
  const scanStateRef = useRef({ mode: M.SCANNING, cooldown: false, lastCode: null });
  const processRef = useRef(null);
  const quaggaStarted = useRef(false);
  const [mode, setMode] = useState(M.SCANNING);
  const [scannedCode, setScannedCode] = useState('');
  const [matchedItem, setMatchedItem] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [matchWarnings, setMatchWarnings] = useState([]);

  // ── 시간 측정 (백그라운드, UI 영향 없음) ─────────────────────
  const metricsSessionRef = useRef(null);
  const metricsFinalizedRef = useRef(false);

  useEffect(() => {
    if (orderId && pickerName) {
      metricsSessionRef.current = createPickingSession({
        orderId,
        pickerName,
        totalItems: allItems.length,
      });
    }
    return () => {
      // 언마운트 시 미완료 세션 저장
      if (!metricsFinalizedRef.current && metricsSessionRef.current) {
        finalizePickingSession(metricsSessionRef.current, false);
        metricsFinalizedRef.current = true;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingItems = allItems.filter(i => !pickerChecked.has(i.order_item_code));

  useEffect(() => { scanStateRef.current.mode = mode; }, [mode]);

  // 스캐너 열릴 때 첫 번째 대기 상품 안내
  useEffect(() => {
    const pending = allItems.filter(i => !pickerChecked.has(i.order_item_code));
    if (pending.length > 0) {
      speak(`첫 번째 상품입니다. ${simplifyProductName(pending[0].product_name)}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  processRef.current = (code) => {
    const match = allItems.find(
      i => i.custom_product_code?.toUpperCase() === code.toUpperCase()
    );

    if (match) {
      // 타이밍 기록 (백그라운드)
      if (metricsSessionRef.current) {
        sessionOnFirstScan(metricsSessionRef.current);
        sessionOnScan(metricsSessionRef.current, match);
      }
      recordScan(code, true);
      setScannedCode(code);
      setMatchedItem(match);
      setErrorInfo(null);

      // 오피킹 방지: 유사 상품 감지
      const warnings = detectSimilarItems(match, allItems);
      setMatchWarnings(warnings);

      setMode(M.MATCH);
      playBeep('success');

      if (warnings.length > 0) {
        vibrate([100, 80, 100, 80, 100]);
        speak(`잠깐! 비슷한 상품이 있습니다. 확인해주세요. ${match.quantity}개 필요합니다`);
      } else {
        vibrate(100);
        speak(`${match.quantity}개 필요합니다`);
      }
    } else {
      const entry = lookupBarcode(code);
      recordScan(code, false);
      setScannedCode(code);
      setMatchedItem(null);
      setErrorInfo(entry
        ? { type: 'mismatch', productName: entry.productName, code: entry.code }
        : { type: 'unknown', code }
      );
      setMode(entry ? M.MISMATCH : M.UNKNOWN);
      playBeep('error');
      vibrate([200, 100, 200]);
    }
  };

  // ── Quagga 초기화 ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;

    Quagga.init({
      inputStream: {
        type: 'LiveStream',
        target: containerRef.current,
        constraints: {
          facingMode: 'environment',
          width: { min: 640, ideal: 1280 },
          height: { min: 480, ideal: 720 },
        },
      },
      locator: { patchSize: 'medium', halfSample: true },
      numOfWorkers: 0,
      frequency: 10,
      decoder: {
        readers: ['code_128_reader', 'code_39_reader', 'ean_reader', 'ean_8_reader'],
        multiple: false,
      },
      locate: true,
    }, (err) => {
      if (!mounted) return;
      if (err) {
        setCameraError('카메라를 시작할 수 없습니다.\n권한을 허용하거나 코드를 직접 입력하세요.');
        return;
      }
      quaggaStarted.current = true;
      Quagga.start();
    });

    function onDetected(result) {
      const state = scanStateRef.current;
      if (state.cooldown || state.mode !== M.SCANNING) return;

      const code = result?.codeResult?.code;
      if (!code) return;

      const errors = result?.codeResult?.decodedCodes?.filter(c => c.error != null) ?? [];
      const avgError = errors.length ? errors.reduce((s, c) => s + c.error, 0) / errors.length : 1;
      if (avgError > 0.25) return;

      if (state.lastCode === code) return;
      state.lastCode = code;
      state.cooldown = true;
      setTimeout(() => {
        if (!mounted) return;
        state.cooldown = false;
        state.lastCode = null;
      }, 1500);

      processRef.current(code);
    }

    Quagga.onDetected(onDetected);

    return () => {
      mounted = false;
      Quagga.offDetected(onDetected);
      if (quaggaStarted.current) {
        try { Quagga.stop(); } catch {}
        quaggaStarted.current = false;
      }
    };
  }, []);

  function handleConfirmPick() {
    if (!matchedItem) return;
    // 타이밍 기록 (백그라운드)
    if (metricsSessionRef.current) {
      sessionOnConfirm(metricsSessionRef.current);
    }
    onConfirmPick(matchedItem.order_item_code);

    const remaining = pendingItems.filter(i => i.order_item_code !== matchedItem.order_item_code);
    if (remaining.length === 0) {
      speak('피킹이 완료되었습니다');
      setMode(M.DONE);
    } else {
      const nextName = simplifyProductName(remaining[0].product_name);
      speak(`담았습니다. 다음 상품입니다. ${nextName}`);
      setMode(M.SCANNING);
      setMatchedItem(null);
      setScannedCode('');
    }
  }

  function handleDoneClose() {
    // 완료 확인 — 완료 세션으로 저장
    if (!metricsFinalizedRef.current && metricsSessionRef.current) {
      finalizePickingSession(metricsSessionRef.current, true);
      metricsFinalizedRef.current = true;
    }
    onClose();
  }

  function handleRescan() {
    setMode(M.SCANNING);
    setScannedCode('');
    setMatchedItem(null);
    setErrorInfo(null);
    setMatchWarnings([]);
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    const code = manualCode.trim().toUpperCase();
    if (code) { setManualCode(''); processRef.current(code); }
  }

  const mallId = loadSettings().mallId || '';
  const imgUrl = matchedItem
    ? normalizeImageUrl(matchedItem.product_image || matchedItem.small_image, mallId)
    : null;

  const isOverlay = mode === M.MATCH || mode === M.MISMATCH || mode === M.UNKNOWN || mode === M.DONE;

  return (
    <div className="scanner-fs">

      {/* ── 헤더 ── */}
      <div className="scanner-header-bar">
        <span className="scanner-header-title">
          {mode === M.SCANNING ? `바코드 스캔 · 남은 ${pendingItems.length}종` : '바코드 스캔'}
        </span>
        <button className="scanner-close-btn" onClick={onClose} aria-label="닫기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* ── 메인 영역 (카메라 + 리스트) ── */}
      <div className="scanner-main">

        {/* 카메라 영역 */}
        <div className="scanner-camera-area" ref={containerRef}>
          {mode === M.SCANNING && !cameraError && (
            <div className="scanner-guide-frame">
              <span className="sgf-corner tl" /><span className="sgf-corner tr" />
              <span className="sgf-corner bl" /><span className="sgf-corner br" />
              <span className="sgf-scan-line" />
            </div>
          )}
          {cameraError && (
            <div className="scanner-cam-msg">
              <span style={{ fontSize: 36 }}>📷</span>
              <p style={{ whiteSpace: 'pre-line', textAlign: 'center' }}>{cameraError}</p>
            </div>
          )}
        </div>

        {/* 대기 상품 목록 */}
        {mode === M.SCANNING && (
          <div className="scanner-pending-panel">
            <div className="scanner-pending-header">
              <div className="scanner-pending-title">남은 상품 {pendingItems.length}종</div>
            </div>
            <div className="scanner-pending-scroll">
              {pendingItems.length === 0 ? (
                <div className="scanner-pending-empty">남은 상품이 없습니다</div>
              ) : (
                <div className="scanner-pending-list">
                  {pendingItems.map(item => (
                    <div key={item.order_item_code} className="scanner-pending-item">
                      <span className="scanner-pending-code">{item.custom_product_code || '—'}</span>
                      <span className="scanner-pending-name">{item.product_name}</span>
                      <span className="scanner-pending-qty">×{item.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 하단 입력 바 ── */}
      {mode === M.SCANNING && (
        <div className="scanner-bottom-bar">
          <form className="scanner-manual" onSubmit={handleManualSubmit}>
            <input
              type="text"
              placeholder="코드 직접 입력 (예: A001)"
              value={manualCode}
              onChange={e => setManualCode(e.target.value.toUpperCase())}
              autoComplete="off"
              autoCapitalize="characters"
            />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={!manualCode.trim()}>확인</button>
          </form>
        </div>
      )}

      {/* ── 전체화면 오버레이 (스캔 결과) ── */}
      {isOverlay && (
        <div className="sro-backdrop">

          {/* 성공 카드 */}
          {mode === M.MATCH && matchedItem && (
            <div className="sro-card sro-card--success">
              <div className="sro-check-circle">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>

              {imgUrl ? (
                <img src={imgUrl} alt="" className="sro-product-img" />
              ) : (
                <div className="sro-product-img sro-product-img--placeholder">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
              )}

              <div className="sro-info">
                <div className="sro-product-name">{matchedItem.product_name}</div>
                <div className="sro-product-code">{matchedItem.custom_product_code}</div>
              </div>

              <div className="sro-qty-block">
                <span className="sro-qty-big">{matchedItem.quantity}</span>
                <span className="sro-qty-unit">개 필요합니다</span>
              </div>

              {matchWarnings.length > 0 && (
                <div className="sro-warning-section">
                  <div className="sro-warning-header">
                    ⚠️ 비슷한 상품이 있습니다. 확인하세요!
                  </div>
                  {matchWarnings.map(w => (
                    <div key={w.item.order_item_code} className="sro-warning-item">
                      <span className="sro-warning-item-name">{w.item.product_name}</span>
                      <span className="sro-warning-item-reason">{w.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="sro-btn-group">
                <button className="btn btn-success btn-full sro-btn-main" onClick={handleConfirmPick}>
                  {matchWarnings.length > 0 ? '✓ 맞습니다, 담겠습니다' : '✓ 담았습니다'}
                </button>
                <button className="btn sro-btn-outline btn-full" onClick={handleRescan}>
                  다시 스캔
                </button>
              </div>
            </div>
          )}

          {/* 실패 카드 */}
          {(mode === M.MISMATCH || mode === M.UNKNOWN) && (
            <div className="sro-card sro-card--failure">
              <div className="sro-fail-circle">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </div>

              <div className="sro-info" style={{ marginTop: 8 }}>
                <div className="sro-product-name">
                  {mode === M.MISMATCH ? '이 주문에 없는 상품입니다' : '등록되지 않은 바코드입니다'}
                </div>
                <div className="sro-product-code">{scannedCode}</div>
                {errorInfo?.productName && <div className="sro-sub-text">{errorInfo.productName}</div>}
                {mode === M.UNKNOWN && <div className="sro-sub-text">라벨 출력을 먼저 진행해주세요</div>}
              </div>

              <div className="sro-btn-group" style={{ marginTop: 24 }}>
                <button className="btn btn-primary btn-full sro-btn-main" onClick={handleRescan}>
                  다시 스캔
                </button>
                <button className="btn sro-btn-outline btn-full" onClick={onClose}>
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 완료 카드 */}
          {mode === M.DONE && (
            <div className="sro-card sro-card--done">
              <div style={{ fontSize: 80, lineHeight: 1 }}>🎉</div>
              <div className="sro-product-name" style={{ fontSize: 22, marginTop: 16 }}>모든 상품 피킹 완료!</div>
              <div className="sro-sub-text">총 {allItems.length}종 완료</div>
              <div className="sro-btn-group" style={{ marginTop: 32 }}>
                <button className="btn btn-primary btn-full sro-btn-main" onClick={handleDoneClose}>
                  확인
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
