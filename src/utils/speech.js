import { loadSettings } from './storage.js';

/**
 * 음성용 상품명 — 전처리는 speak() 내부에서 처리되므로
 * 여기서는 원문 그대로 반환 (speak에 넘기면 단위·괄호가 자동 변환됨)
 */
export function simplifyProductName(name) {
  return name || '';
}

/**
 * 단위 기호를 한국어 발음으로 변환
 * "1.5L" → "1.5리터", "500ml" → "500밀리리터" 등
 */
function preprocessTextForSpeech(text) {
  return text
    // 1. 괄호 제거, 내용 유지
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/\(([^)]+)\)/g, '$1')
    // 2. 수량 단위 → 고유어
    .replace(/10(개|팩|병|봉지|통|캔)/g, '열$1')
    .replace(/1(개|팩|병|봉지|통|캔)/g,  '한$1')
    .replace(/2(개|팩|병|봉지|통|캔)/g,  '두$1')
    .replace(/3(개|팩|병|봉지|통|캔)/g,  '세$1')
    .replace(/4(개|팩|병|봉지|통|캔)/g,  '네$1')
    .replace(/5(개|팩|병|봉지|통|캔)/g,  '다섯$1')
    .replace(/6(개|팩|병|봉지|통|캔)/g,  '여섯$1')
    .replace(/7(개|팩|병|봉지|통|캔)/g,  '일곱$1')
    .replace(/8(개|팩|병|봉지|통|캔)/g,  '여덟$1')
    .replace(/9(개|팩|병|봉지|통|캔)/g,  '아홉$1')
    // 3. 도량형 단위 변환 (소수점 포함 정확히 캡처)
    .replace(/(\d+(?:\.\d+)?)\s*L(?=\s|$)/g,   '$1리터')
    .replace(/(\d+(?:\.\d+)?)\s*ml(?=\s|$)/gi,  '$1밀리리터')
    .replace(/(\d+(?:\.\d+)?)\s*kg(?=\s|$)/gi,  '$1킬로그램')
    .replace(/(\d+(?:\.\d+)?)\s*g(?=\s|$)/gi,   '$1그램')
    // 4. 공백 정리
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 한국어 TTS. 음성 안내가 OFF거나 API 미지원 시 무음.
 * 재생 중인 음성은 즉시 중단 후 새 음성 재생.
 */
export function speak(text) {
  if (!text) return;
  const settings = loadSettings();
  if (!settings.voiceEnabled) return;
  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  text = preprocessTextForSpeech(text);

  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'ko-KR';
  utt.rate = 0.9;
  utt.pitch = 1.1;
  utt.volume = 1.0;

  // iOS Safari 버그: speechSynthesis가 중간에 멈추는 현상 방지
  const resumeTimer = setInterval(() => {
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  }, 250);
  utt.onend = () => clearInterval(resumeTimer);
  utt.onerror = () => clearInterval(resumeTimer);

  window.speechSynthesis.speak(utt);
}
