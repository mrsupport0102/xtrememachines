const crypto = require('crypto');

const COOKIE_NAME = 'xm_admin';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function signToken(secret) {
  const payload = Buffer.from(JSON.stringify({
    admin: true,
    exp: Date.now() + MAX_AGE_MS,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token, secret) {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.admin === true && data.exp > Date.now();
  } catch {
    return false;
  }
}

function getTokenFromRequest(req) {
  const header = req.headers.cookie || '';
  const match = header.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function isAuthenticated(req, secret) {
  return verifyToken(getTokenFromRequest(req), secret);
}

function setAuthCookie(res, secret, secure) {
  const token = signToken(secret);
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(MAX_AGE_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(res, secure) {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  COOKIE_NAME,
  isAuthenticated,
  setAuthCookie,
  clearAuthCookie,
  safeEqual,
};
