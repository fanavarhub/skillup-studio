import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { adminPage, escapeMarkup } from './moderation.mjs';

export const lessonPath = '/magazine/scratch-costume-animation';
export const videoFrame = 'https://www.aparat.com/video/video/embed/videohash/ljc4b3o/vt/frame?titleShow=true&recom=self';
const defaultOrigin = 'https://skill-up.ir';
const commentsPath = lessonPath + '/comments';
const adminPath = lessonPath + '/moderation';
const sitemapPath = '/magazine/scratch-costume-animation/video-sitemap.xml';
const minute = 60_000;
const signInLifetime = 8 * 60 * minute;
const bodyLimit = 12 * 1024;
const queued = 'دیدگاهت ثبت شد و بعد از بررسی مدیر نمایش داده می‌شه.';
const siteName = 'اسکیل‌آپ';
const videoName = 'ساخت انیمیشن در اسکرچ با کاستیوم | قسمت ۱۱ اسکیل‌آپ';
const videoDescription = 'آموزش رایگان ساخت انیمیشن در اسکرچ با کاستیوم، Next Costume و Switch Costume to و تمرین تغییر ظاهر شخصیت.';
const contentTypes = {
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  jpg: 'image/jpeg',
  png: 'image/png',
  woff2: 'font/woff2',
};
const filenames = ['animation-blocks-approved.png', 'lesson.css', 'lesson.js', 'costume-cover.jpg', 'poses.png', 'skillup-logo.png', 'skillup-logo-inverse.png', 'teen-growth.png',
  'vazir-regular.woff2', 'vazir-medium.woff2', 'vazir-bold.woff2', 'vazir-heavy.woff2'];
function metadata(template, publicOrigin, uploadDate) {
  const canonical = publicOrigin + lessonPath;
  const cover = canonical + '/assets/costume-cover.jpg';
  const publisher = { '@type': 'Organization', name: siteName, url: defaultOrigin + '/' };
  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': canonical, name: videoName, description: videoDescription, inLanguage: 'fa-IR',
        isAccessibleForFree: true, mainEntity: { '@id': canonical + '#video' }, publisher },
      { '@type': 'VideoObject', '@id': canonical + '#video', name: videoName, description: videoDescription,
        thumbnailUrl: cover, uploadDate, duration: 'PT10M31S', embedUrl: videoFrame, inLanguage: 'fa-IR', publisher },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'خانه', item: defaultOrigin + '/' },
        { '@type': 'ListItem', position: 2, name: 'مجله اسکیل‌آپ', item: publicOrigin + '/magazine' },
        { '@type': 'ListItem', position: 3, name: 'قسمت ۱۱', item: canonical },
      ] },
    ],
  }).replaceAll('<', '\\u003c');
  const valueByKey = { CANONICAL: escapeMarkup(canonical), COVER: escapeMarkup(cover), EMBED_HTML: escapeMarkup(videoFrame), SCHEMA: schema };
  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => valueByKey[key]);
  const sitemap = placeInSitemap(canonical, cover, uploadDate);
  const schemaHash = createHash('sha256').update(schema).digest('base64');
  return { html, sitemap, schemaHash };
}

function placeInSitemap(canonical, cover, uploadDate) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url><loc>${escapeMarkup(canonical)}</loc><video:video>
    <video:thumbnail_loc>${escapeMarkup(cover)}</video:thumbnail_loc>
    <video:title>${escapeMarkup(videoName)}</video:title>
    <video:description>${escapeMarkup(videoDescription)}</video:description>
    <video:player_loc>${escapeMarkup(videoFrame)}</video:player_loc>
    <video:duration>631</video:duration>${uploadDate ? '\n    <video:publication_date>' + escapeMarkup(uploadDate) + '</video:publication_date>' : ''}
    <video:family_friendly>yes</video:family_friendly>
    <video:requires_subscription>no</video:requires_subscription>
  </video:video></url>
</urlset>`;
}

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readFields(req) {
  const type = req.headers['content-type']?.split(';', 1)[0];
  if (type !== 'application/json' && type !== 'application/x-www-form-urlencoded') {
    throw new RequestError(415, 'فرمت ارسال دیدگاه پشتیبانی نمی‌شه.');
  }
  if (Number(req.headers['content-length']) > bodyLimit) {
    req.resume();
    throw new RequestError(413, 'حجم درخواست بیش از حد مجازه.');
  }
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length <= bodyLimit) chunks.push(chunk);
  }
  if (length > bodyLimit) throw new RequestError(413, 'حجم درخواست بیش از حد مجازه.');
  const text = Buffer.concat(chunks).toString('utf8');
  if (type === 'application/x-www-form-urlencoded') return Object.fromEntries(new URLSearchParams(text));
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch {
    throw new RequestError(400, 'اطلاعات فرم کامل نیست.');
  }
}

function clean(value) {
  return typeof value === 'string'
    ? value.normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').trim()
    : '';
}

function commentInput({ name: rawName, body: rawBody }) {
  const name = clean(rawName).replace(/\s+/g, ' ');
  const body = clean(rawBody);
  if (name.length < 2 || name.length > 40 || body.length < 8 || body.length > 800) {
    throw new RequestError(422, 'اسم یا لقب باید ۲ تا ۴۰ حرف و دیدگاه باید ۸ تا ۸۰۰ حرف باشه.');
  }
  const personalText = (name + ' ' + body).replace(/[۰-۹]/g, digit => digit.charCodeAt(0) - 1776)
    .replace(/[٠-٩]/g, digit => digit.charCodeAt(0) - 1632);
  if (/[\w.%+-]+@[\w.-]+\.[a-z]{2,}/i.test(personalText) || /(?:^|\D)(?:\+?98|0)[\s.-]*9(?:[\s.-]*\d){9}(?!\d)/.test(personalText)) {
    throw new RequestError(422, 'لطفاً شمارهٔ همراه یا ایمیل رو از دیدگاه پاک کن.');
  }
  return { name, body };
}

function originValue(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('LESSON_PUBLIC_ORIGIN must be an HTTP(S) origin without a path.');
  }
  return url.origin;
}

function rateLimiter() {
  const buckets = new Map();
  return (key, count, interval) => {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (bucket && bucket.until > now) {
      if (bucket.hits >= count) return false;
      bucket.hits += 1;
      return true;
    }
    if (buckets.size >= 4096) {
      for (const [id, entry] of buckets) if (entry.until <= now) buckets.delete(id);
      if (buckets.size >= 4096 && !buckets.has(key)) return false;
    }
    buckets.set(key, { hits: 1, until: now + interval });
    return true;
  };
}

const safeJson = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

const htmlReply = (res, status, page) => {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page);
};

const redirect = (res, status, destination) => {
  res.writeHead(status, { Location: destination });
  res.end();
};

const digest = value => createHash('sha256').update(value).digest();
const identifier = value => /^\d{1,15}$/.test(value ?? '') && Number(value) > 0 ? Number(value) : null;
const acceptedStatus = value => ['pending', 'approved', 'rejected'].includes(value);

/** @param {{ assetDir: string, databasePath?: string, publicOrigin?: string, videoUploadDate?: string, adminToken?: string, trustProxy?: boolean }} options */
export function createLessonServer({
  assetDir,
  databasePath = resolve('data', 'scratch-comments.sqlite'),
  publicOrigin = defaultOrigin,
  videoUploadDate = '2026-11-19',
  adminToken = '',
  trustProxy = false,
}) {
  const origin = originValue(publicOrigin);
  const template = readFileSync(resolve(assetDir, 'index.html'), 'utf8');
  const assets = new Map(filenames.map(name => [
    lessonPath + '/assets/' + name,
    { bytes: readFileSync(resolve(assetDir, 'assets', name)), type: contentTypes[name.split('.').at(-1)] },
  ]));
  const page = metadata(template, origin, videoUploadDate || undefined);
  if (adminToken && adminToken.length < 20) throw new Error('SCRATCH_LESSON_ADMIN_TOKEN must be at least 20 characters.');
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 4000;
    CREATE TABLE IF NOT EXISTS lesson_comments (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'approved', 'rejected')),
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS lesson_comments_state ON lesson_comments(state, id DESC);
  `);
  const list = db.prepare('SELECT id, name, body, state, created_at FROM lesson_comments WHERE state = ? AND id < ? ORDER BY id DESC LIMIT 26');
  const add = db.prepare('INSERT INTO lesson_comments(name, body, created_at) VALUES (?, ?, ?)');
  const recent = db.prepare('SELECT 1 FROM lesson_comments WHERE name = ? AND body = ? AND created_at >= ? LIMIT 1');
  const moderate = db.prepare('UPDATE lesson_comments SET state = ? WHERE id = ? AND state = ?');
  const take = rateLimiter();
  const sessions = new Map();

  function requestOrigin(req) {
    const host = req.headers.host;
    const loopback = /^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host ?? '') ? 'http://' + host : null;
    if (req.headers.origin === origin || (loopback && req.headers.origin === loopback)) return req.headers.origin;
    throw new RequestError(403, 'درخواست باید از همین صفحه ارسال بشه.');
  }

  function clientAddress(req) {
    const forwarded = req.headers['x-real-ip'];
    if (trustProxy && typeof forwarded === 'string' && isIP(forwarded)) return forwarded;
    return req.socket.remoteAddress;
  }

  function sessionKey(req) {
    const value = req.headers.cookie?.match(/(?:^|;\s*)scratch_admin=([a-f\d]{64})(?:;|$)/)?.[1];
    if (value && (sessions.get(value) ?? 0) > Date.now()) return value;
    return null;
  }

  function writeCookie(res, key, secure, maxAge) {
    res.setHeader('Set-Cookie', `scratch_admin=${key}; Path=${adminPath}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
  }

  function renderAdmin(res, status, options) {
    htmlReply(res, status, adminPage({ adminPath, lessonPath, ...options }));
  }

  async function handleAdmin(req, res, path, params) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (!adminToken) return renderAdmin(res, 404, { message: 'مدیریت دیدگاه‌ها راه‌اندازی نشده.' });
    if (req.method === 'GET' && path === adminPath) {
      if (!sessionKey(req)) return renderAdmin(res, 200, { requirePassword: true });
      const state = acceptedStatus(params.get('status')) ? params.get('status') : 'pending';
      const entries = list.all(state, identifier(params.get('before')) ?? Number.MAX_SAFE_INTEGER);
      return renderAdmin(res, 200, { entries: entries.slice(0, 25), state, next: entries.length > 25 ? entries[24].id : null });
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { Allow: path === adminPath ? 'GET' : 'POST' });
      return res.end();
    }
    const secure = requestOrigin(req).startsWith('https:');
    if (path === adminPath + '/login') {
      if (!take('login:' + clientAddress(req), 8, 15 * minute)) {
        return renderAdmin(res, 429, { requirePassword: true, message: 'چند دقیقه صبر کنید و دوباره امتحان کنید.' });
      }
      const { password } = await readFields(req);
      if (typeof password !== 'string' || !timingSafeEqual(digest(password), digest(adminToken))) {
        return renderAdmin(res, 401, { requirePassword: true, message: 'رمز مدیریت درست نیست.' });
      }
      const now = Date.now();
      for (const [key, expiry] of sessions) if (expiry <= now) sessions.delete(key);
      if (sessions.size >= 128) sessions.delete(sessions.keys().next().value);
      const key = randomBytes(32).toString('hex');
      sessions.set(key, now + signInLifetime);
      writeCookie(res, key, secure, signInLifetime / 1000);
      return redirect(res, 303, adminPath);
    }
    const key = sessionKey(req);
    if (!key) return renderAdmin(res, 401, { requirePassword: true, message: 'برای ادامه دوباره وارد شوید.' });
    if (path === adminPath + '/logout') {
      sessions.delete(key);
      writeCookie(res, '', secure, 0);
      return redirect(res, 303, adminPath);
    }
    if (path === adminPath + '/update') {
      const { id, from, to } = await readFields(req);
      if (typeof id !== 'string' || !identifier(id) || !acceptedStatus(from) || !acceptedStatus(to) || from === to) {
        return renderAdmin(res, 422, { message: 'عملیات انتخاب‌شده معتبر نیست.' });
      }
      if (!moderate.run(to, Number(id), from).changes) {
        return renderAdmin(res, 409, { message: 'وضعیت این دیدگاه تغییر کرده است. فهرست را دوباره باز کنید.' });
      }
      return redirect(res, 303, adminPath + '?status=' + from);
    }
    return renderAdmin(res, 404, { message: 'این مسیر وجود نداره.' });
  }

  async function handleComments(req, res, params) {
    if (req.method === 'GET') {
      const raw = params.get('before');
      if (raw !== null && !identifier(raw)) throw new RequestError(400, 'شمارهٔ صفحه معتبر نیست.');
      const entries = list.all('approved', identifier(raw) ?? Number.MAX_SAFE_INTEGER);
      const comments = entries.slice(0, 25).map(({ id, name, body, created_at }) => ({
        id, name, body, createdAt: new Date(created_at).toISOString(),
      }));
      return safeJson(res, 200, { comments, next: entries.length > 25 ? entries[24].id : null });
    }
    if (req.method === 'POST') {
      requestOrigin(req);
      if (!take('comment:' + clientAddress(req), 5, 10 * minute)) {
        res.setHeader('Retry-After', '600');
        throw new RequestError(429, 'کمی صبر کن و بعد دوباره دیدگاهت رو بفرست.');
      }
      const fields = await readFields(req);
      if (!clean(fields.website)) {
        const { name, body } = commentInput(fields);
        const now = Date.now();
        if (!recent.get(name, body, now - 10 * minute)) add.run(name, body, now);
      }
      if (req.headers['content-type']?.startsWith('application/json')) return safeJson(res, 201, { message: queued });
      return htmlReply(res, 201, adminPage({ lessonPath, adminPath, title: 'دیدگاه ثبت شد', message: queued, publicMessage: true }));
    }
    res.writeHead(405, { Allow: 'GET, POST' });
    res.end();
  }

  async function handle(req, res) {
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self' 'sha256-${page.schemaHash}'; style-src 'self'; img-src 'self'; frame-src https://www.aparat.com; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'`);
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    const { pathname, searchParams } = new URL(req.url, origin);
    const read = req.method === 'GET' || req.method === 'HEAD';
    if (read && pathname === '/') return redirect(res, 302, lessonPath);
    if (read && pathname === lessonPath + '/') return redirect(res, 308, lessonPath);
    if (read && pathname === lessonPath) return htmlReply(res, 200, page.html);
    if (read && pathname === sitemapPath) {
      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
      return res.end(page.sitemap);
    }
    const asset = assets.get(pathname);
    if (read && asset) {
      res.writeHead(200, { 'Content-Type': asset.type, 'Content-Length': asset.bytes.length, 'Cache-Control': 'public, max-age=3600' });
      return res.end(asset.bytes);
    }
    if (pathname === commentsPath) {
      if (req.method === 'POST' && !adminToken) {
        throw new RequestError(503, 'ارسال دیدگاه فعلاً در دسترس نیست.');
      }
      return handleComments(req, res, searchParams);
    }
    if (pathname === adminPath || pathname.startsWith(adminPath + '/')) return handleAdmin(req, res, pathname, searchParams);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('این صفحه پیدا نشد.');
  }

  const server = createServer({ requestTimeout: 15_000, headersTimeout: 10_000 }, (req, res) => {
    handle(req, res).catch(error => {
      if (res.headersSent) return res.end();
      const status = error instanceof RequestError ? error.status : 500;
      const message = status === 500 ? 'مشکلی پیش اومده. کمی بعد دوباره امتحان کن.' : error.message;
      if (status === 500) console.error('Lesson request failed:', error.code || error.name);
      if (req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) {
        return htmlReply(res, status, adminPage({ lessonPath, adminPath, title: 'درخواست انجام نشد', message, publicMessage: true }));
      }
      safeJson(res, status, { message });
    });
  });
  server.once('close', () => db.close());
  return server;
}
