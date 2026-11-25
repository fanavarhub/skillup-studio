import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { readConfig } from './config.mjs';
import { SurveyStore } from './store.mjs';
import { validateSubmission, HttpError } from './validation.mjs';
import { RateLimiter, verifyPassword, newToken, digestToken, requestToken, sessionCookie, safeEqual } from './auth.mjs';
import { buildStatistics } from './statistics.mjs';
import { createExcel } from './excel.mjs';

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Cache-Control': 'no-store',
};
function json(response, status, value, headers = {}) {
  response.writeHead(status, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', ...headers });
  response.end(JSON.stringify(value));
}
async function body(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) throw new HttpError(415, 'نوع داده باید JSON باشد.');
  if (Number(request.headers['content-length']) > 16384) { request.resume(); throw new HttpError(413, 'حجم پاسخ بیشتر از حد مجاز است.'); }
  const bytes = await new Promise((done, reject) => {
    const chunks = []; let length = 0, failed = false;
    request.on('data', chunk => {
      if (failed) return;
      length += chunk.length;
      if (length > 16384) { failed = true; chunks.length = 0; reject(new HttpError(413, 'حجم پاسخ بیشتر از حد مجاز است.')); return; }
      chunks.push(chunk);
    });
    request.on('end', () => { if (!failed) done(Buffer.concat(chunks)); });
    request.on('error', () => reject(new HttpError(400, 'دریافت پاسخ کامل نشد.')));
    request.on('aborted', () => reject(new HttpError(400, 'دریافت پاسخ کامل نشد.')));
  });
  try { return JSON.parse(bytes.toString('utf8')); } catch { throw new HttpError(400, 'دادهٔ ارسالی معتبر نیست.'); }
}
function checkOrigin(request, config) {
  if (request.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'این درخواست مجاز نیست.');
  const origin = request.headers.origin;
  if (origin) {
    let url;
    try { url = new URL(origin); } catch { throw new HttpError(403, 'مبدأ درخواست معتبر نیست.'); }
    const expected = config.siteOrigin || `${request.socket.encrypted ? 'https' : 'http'}://${request.headers.host}`;
    if (url.origin !== expected) throw new HttpError(403, 'مبدأ درخواست مجاز نیست.');
  }
}
function clientIp(request, config) {
  const address = request.socket.remoteAddress || 'unknown';
  if (config.trustProxy) return String(request.headers['x-forwarded-for'] || address).split(',')[0].trim().slice(0, 80);
  return address;
}

export function createApplication(config) {
  const store = new SurveyStore(config.dataDirectory);
  const limiter = new RateLimiter();
  function auth(request) {
    const token = requestToken(request);
    if (!token || !store.validSession(digestToken(token, config.sessionSecret))) return null;
    return { token, csrf: digestToken(token, config.sessionSecret, 'csrf') };
  }
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://local.invalid');
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { throw new HttpError(400, 'مسیر معتبر نیست.'); }
      if (config.basePath && pathname === config.basePath && ['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(308, { ...securityHeaders, Location: `${config.basePath}/${url.search}` }); return response.end();
      }
      if (config.basePath && !pathname.startsWith(`${config.basePath}/`)) throw new HttpError(404, 'صفحه پیدا نشد.');
      const path = config.basePath ? pathname.slice(config.basePath.length) : pathname;
      if (request.method === 'POST') checkOrigin(request, config);
      const ip = clientIp(request, config);

      if (path === '/healthz' && ['GET', 'HEAD'].includes(request.method)) {
        store.db.prepare('SELECT 1').get(); return json(response, 200, { status: 'ok', storage: 'sqlite' });
      }
      if (path === '/api/responses' && request.method === 'POST') {
        if (!limiter.allow(`submit:${ip}`, 60, 60000)) return json(response, 429, { message: 'تعداد درخواست‌ها زیاد است؛ یک دقیقه دیگر دوباره تلاش کنید.' }, { 'Retry-After': '60' });
        const payload = validateSubmission(await body(request));
        const result = store.save(payload);
        return json(response, result.duplicate ? 200 : 201, result);
      }
      if (path === '/api/admin/session' && request.method === 'GET') {
        const session = auth(request);
        return json(response, 200, session ? { authenticated: true, csrf_token: session.csrf } : { authenticated: false });
      }
      if (path === '/api/admin/login' && request.method === 'POST') {
        if (!limiter.allow(`login:${ip}`, 8, 15 * 60000)) return json(response, 429, { message: 'تلاش‌های ورود زیاد است؛ ۱۵ دقیقه دیگر دوباره تلاش کنید.' }, { 'Retry-After': '900' });
        const input = await body(request);
        if (!input || typeof input !== 'object' || !await verifyPassword(input.password, config.passwordHash)) throw new HttpError(401, 'رمز عبور درست نیست.');
        const previous = requestToken(request);
        if (previous) store.removeSession(digestToken(previous, config.sessionSecret));
        const token = newToken();
        store.addSession(digestToken(token, config.sessionSecret), Date.now() + 28800000);
        return json(response, 200, { authenticated: true, csrf_token: digestToken(token, config.sessionSecret, 'csrf') }, { 'Set-Cookie': sessionCookie(token, config) });
      }
      if (path.startsWith('/api/admin/')) {
        const session = auth(request);
        if (!session) throw new HttpError(401, 'برای مشاهدهٔ گزارش‌ها وارد بخش مدیریت شوید.');
        if (request.method === 'POST' && !safeEqual(request.headers['x-csrf-token'], session.csrf)) throw new HttpError(403, 'درخواست معتبر نیست؛ صفحه را تازه کنید.');
        if (path === '/api/admin/logout' && request.method === 'POST') {
          store.removeSession(digestToken(session.token, config.sessionSecret));
          return json(response, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', config, true) });
        }
        if (path === '/api/admin/stats' && request.method === 'GET') return json(response, 200, buildStatistics(store.all()));
        if (path === '/api/admin/responses' && request.method === 'GET') {
          const page = Number(url.searchParams.get('page') || 1);
          const search = (url.searchParams.get('q') || '').trim();
          if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || search.length > 100) throw new HttpError(400, 'پارامتر جست‌وجو معتبر نیست.');
          return json(response, 200, store.page(page, search));
        }
        if (path === '/api/admin/export.xlsx' && request.method === 'GET') {
          const bytes = createExcel(store.all());
          response.writeHead(200, { ...securityHeaders, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="heyat-responses-${new Date().toISOString().slice(0, 10)}.xlsx"`, 'Content-Length': bytes.length });
          return response.end(bytes);
        }
        throw new HttpError(404, 'مسیر گزارش پیدا نشد.');
      }
      if (path.startsWith('/api/')) throw new HttpError(404, 'مسیر پیدا نشد.');
      if (!['GET', 'HEAD'].includes(request.method)) throw new HttpError(405, 'این روش مجاز نیست.');
      if (path === '/admin/') {
        response.writeHead(308, { ...securityHeaders, Location: `${config.basePath}/admin` }); return response.end();
      }
      const file = path === '/' ? '/index.html' : path === '/admin' ? '/admin.html' : path;
      if (!/^\/(?:index\.html|app\.js|questionnaire\.js|styles\.css|admin\.(?:html|js|css)|assets\/[a-zA-Z0-9_./-]+)$/.test(file) || file.includes('..') || file.includes('\\')) throw new HttpError(404, 'صفحه پیدا نشد.');
      const target = resolve(config.staticDirectory, `.${file}`);
      if (!target.startsWith(config.staticDirectory + sep)) throw new HttpError(404, 'صفحه پیدا نشد.');
      const info = await stat(target).catch(() => null);
      if (!info?.isFile()) throw new HttpError(404, 'صفحه پیدا نشد.');
      const data = await readFile(target);
      response.writeHead(200, { ...securityHeaders, 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Content-Length': data.length });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error('Request failed:', error.code || 'INTERNAL_ERROR');
      json(response, status, { message: status === 500 ? 'انجام درخواست ممکن نشد. لطفاً دوباره تلاش کنید.' : error.message });
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  return {
    server, store, config,
    async listen() {
      await new Promise((done, reject) => { server.once('error', reject); server.listen(config.port, config.host, done); });
      return server.address();
    },
    async close() {
      server.closeIdleConnections();
      await new Promise((done, reject) => server.close(error => error ? reject(error) : done()));
      store.close();
    },
  };
}

export async function startServer() {
  let app;
  try {
    app = createApplication(readConfig());
    const address = await app.listen();
    console.log(`Survey: http://${app.config.host}:${address.port}${app.config.basePath}/`);
    console.log(`Admin: http://${app.config.host}:${address.port}${app.config.basePath}/admin`);
  } catch (error) { console.error(error.message); process.exit(1); }
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    try { await app.close(); process.exit(0); } catch { process.exit(1); }
  });
  return app;
}
