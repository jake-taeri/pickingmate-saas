const TOKEN_KEY = 'pm_auth_token';

function decodeBase64Url(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getTokenPayload() {
  const token = getToken();
  if (!token) return null;
  try {
    const [data] = token.split('.');
    return JSON.parse(decodeBase64Url(data));
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  const payload = getTokenPayload();
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp > Date.now();
}

export function logout() {
  removeToken();
}
