import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const validAdminUsername = value => /^[A-Za-z0-9][A-Za-z0-9._@-]{0,63}$/.test(value);

function secret(env, name) {
  if (env[`${name}_FILE`]) return readFileSync(env[`${name}_FILE`], 'utf8').trim();
  return env[name]?.trim() ?? '';
}
export function readConfig(env = process.env) {
  const adminUsername = env.ADMIN_USERNAME?.trim() || 'admin';
  const passwordHash = secret(env, 'ADMIN_PASSWORD_HASH');
  const sessionSecret = secret(env, 'SESSION_SECRET');
  if (!validAdminUsername(adminUsername)) throw new Error('ADMIN_USERNAME نامعتبر است.');
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(passwordHash)) throw new Error('ابتدا npm run setup را اجرا کنید و رمز مدیریت را تنظیم کنید.');
  if (sessionSecret.length < 32) throw new Error('SESSION_SECRET باید حداقل ۳۲ نویسه باشد.');
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT نامعتبر است.');
  const basePath = (env.BASE_PATH || '').replace(/\/$/, '');
  if (basePath && !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(basePath)) throw new Error('BASE_PATH نامعتبر است.');
  let siteOrigin = '';
  if (env.PUBLIC_BASE_URL) {
    const url = new URL(env.PUBLIC_BASE_URL);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/') throw new Error('PUBLIC_BASE_URL باید فقط مبدأ سایت باشد.');
    siteOrigin = url.origin;
  }
  return {
    host: env.HOST || '127.0.0.1', port, basePath, siteOrigin, adminUsername, passwordHash, sessionSecret,
    secureCookies: env.COOKIE_SECURE === 'true' || siteOrigin.startsWith('https:'),
    trustProxy: env.TRUST_PROXY === 'true',
    dataDirectory: resolve(projectRoot, env.DATA_DIR || 'data'),
    staticDirectory: resolve(projectRoot, 'dist'),
  };
}
