import { createHmac, timingSafeEqual } from 'crypto';

// In-memory rate limiting (resets on cold start — acceptable for single-admin use)
const attempts = new Map();

function safeEqual(a, b) {
  try {
    if (a.length !== b.length) {
      // Still run timingSafeEqual on equal-length dummy to prevent timing leak
      timingSafeEqual(Buffer.from(a), Buffer.from(a));
      return false;
    }
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력하세요' });
  }

  const ip = (req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const key = `${ip}:${email.toLowerCase()}`;
  const now = Date.now();
  const record = attempts.get(key) || { count: 0, lockedUntil: 0 };

  if (record.lockedUntil > now) {
    const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
    return res.status(429).json({
      error: `로그인 시도 초과. ${retryAfter}초 후 다시 시도하세요.`,
    });
  }

  const adminEmail = (process.env.ADMIN_EMAIL || '').trim();
  const adminPassword = (process.env.ADMIN_PASSWORD || '').trim();
  const jwtSecret = (process.env.JWT_SECRET || '').trim();

  if (!adminEmail || !adminPassword || !jwtSecret) {
    console.error('Missing env vars: ADMIN_EMAIL, ADMIN_PASSWORD, or JWT_SECRET');
    return res.status(500).json({ error: '서버 설정 오류. 관리자에게 문의하세요.' });
  }

  const emailOk = safeEqual(email.toLowerCase(), adminEmail.toLowerCase());
  const passOk = safeEqual(password, adminPassword);

  if (!emailOk || !passOk) {
    record.count = (record.count || 0) + 1;
    if (record.count >= 5) {
      record.lockedUntil = now + 60_000; // 1분 잠금
      record.count = 0;
    }
    attempts.set(key, record);
    return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
  }

  // 성공 — 시도 초기화
  attempts.delete(key);

  const exp = now + 24 * 60 * 60 * 1000; // 24시간
  const payload = JSON.stringify({ email: adminEmail, iat: now, exp });
  const data = Buffer.from(payload).toString('base64url');
  const sig = createHmac('sha256', jwtSecret).update(data).digest('base64url');
  const token = `${data}.${sig}`;

  return res.status(200).json({ token, exp });
}
