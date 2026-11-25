import { randomBytes, scrypt, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, saved) {
  if (typeof password !== 'string' || password.length > 200) return false;
  const [salt, expected] = saved.split(':');
  const actual = await derive(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
export function digestToken(token, secret, purpose = 'session') {
  return createHmac('sha256', secret).update(`${purpose}:${token}`).digest('hex');
}
export function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function newToken() { return randomBytes(32).toString('hex'); }
export function sessionCookie(token, config, remove = false) {
  return `heyat_admin=${token}; Path=${config.basePath || '/'}; HttpOnly; SameSite=Strict; Max-Age=${remove ? 0 : 28800}${config.secureCookies ? '; Secure' : ''}`;
}
export function requestToken(request) {
  const cookie = (request.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith('heyat_admin='));
  const value = cookie?.slice('heyat_admin='.length) || '';
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export class RateLimiter {
  constructor() { this.buckets = new Map(); }
  allow(key, limit, windowMs, now = Date.now()) {
    if (this.buckets.size > 10000) {
      for (const [entry, bucket] of this.buckets) if (bucket.expires <= now) this.buckets.delete(entry);
      if (this.buckets.size > 10000 && !this.buckets.has(key)) return false;
    }
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.expires <= now) {
      bucket = { count: 0, expires: now + windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    return bucket.count <= limit;
  }
}
