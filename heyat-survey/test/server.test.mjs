import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createApplication } from '../lib/http.mjs';
import { hashPassword, RateLimiter } from '../lib/auth.mjs';
import { readConfig, projectRoot } from '../lib/config.mjs';
import { questions } from '../dist/questionnaire.js';

mkdirSync(join(projectRoot, 'qa'), { recursive: true });
const directory = mkdtempSync(join(projectRoot, 'qa', 'integration-'));
const password = randomBytes(24).toString('base64url');
let app, origin, config, cookie = '', csrf = '';
const sent = [];
const sample = (changes = {}) => ({ questionnaire_version: '1.0', submission_id: randomBytes(16).toString('hex'), contact: { full_name: null, phone: null }, answers: { attendance_days: '2', overall_satisfaction: '4' }, improvement_priorities: [], feedback: null, ...changes });
const request = (path, options = {}) => fetch(`${origin}${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
const post = payload => request('/api/responses', { method: 'POST', body: JSON.stringify(payload) });
async function login() {
  const response = await request('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
  assert.equal(response.status, 200);
  const data = await response.json();
  cookie = response.headers.get('set-cookie').split(';')[0]; csrf = data.csrf_token;
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
}

before(async () => {
  config = readConfig({ ADMIN_PASSWORD_HASH: await hashPassword(password), SESSION_SECRET: randomBytes(32).toString('hex'), DATA_DIR: directory, PORT: '0', HOST: '127.0.0.1' });
  app = createApplication(config);
  const address = await app.listen(); origin = `http://127.0.0.1:${address.port}`;
});
after(async () => { if (app) await app.close(); });

test('public form uses the requested heading and optional exact phone format', async () => {
  const response = await request('/');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /السلام علیک یا فاطمه الزهرا/);
  assert.match(html, /سلام الله علیها/);
  assert.match(html, /placeholder="09101679458"/);
  assert.doesNotMatch(html.match(/<input id="phone"[^>]*>/)[0], /\brequired\b/);
  assert.doesNotMatch(html, /پیش‌نمایش|این نسخه برای بررسی|ارسال یا ذخیره نمی‌شوند|یا حسین/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal((await request('/healthz')).status, 200);
});

test('anonymous response persists and identical retries do not create duplicates', async () => {
  const payload = sample({ answers: { attendance_days: '2', overall_satisfaction: '4', speech_satisfaction: '3', sound_satisfaction: '2', hospitality_satisfaction: 'not_experienced' }, improvement_priorities: ['sound', 'speech_duration', 'total_duration'] });
  const response = await post(payload);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).receipt, payload.submission_id);
  const again = await post(payload);
  assert.equal(again.status, 200);
  assert.equal((await again.json()).duplicate, true);
  assert.equal(app.store.all().length, 1);
  assert.equal(app.store.all()[0].contact.phone, null);
  sent.push(payload);
  const conflict = await post({ ...payload, feedback: 'changed after saving' });
  assert.equal(conflict.status, 409);
  assert.equal(app.store.all().length, 1);
});

test('Persian phone digits normalize, formula-like text and HTML remain literal data', async () => {
  const payload = sample({ contact: { full_name: '=1+1', phone: '۰۹۱۲۰۰۰۰۰۰۰' }, answers: { attendance_days: '5', overall_satisfaction: '5', sound_satisfaction: 'unable_to_assess', speech_satisfaction: 'not_experienced' }, improvement_priorities: ['no_suggestion'], feedback: '<script>alert("x")</script> & پیشنهاد\n=HYPERLINK("https://example.invalid","x")' });
  assert.equal((await post(payload)).status, 201);
  const saved = app.store.all().find(row => row.id === payload.submission_id);
  assert.equal(saved.contact.phone, '09120000000');
  assert.equal(saved.feedback, payload.feedback);
  sent.push(payload);
});

test('server validates phones, values, priority limits, absence routing and minimum feedback', async () => {
  for (const phone of ['0910', '+989120000000', '08120000000', '0912 0000000']) assert.equal((await post(sample({ contact: { phone } }))).status, 400);
  assert.equal((await post(sample({ answers: { overall_satisfaction: '6' } }))).status, 400);
  assert.equal((await post(sample({ improvement_priorities: ['sound', 'venue', 'children', 'speech'] }))).status, 400);
  assert.equal((await post(sample({ improvement_priorities: ['sound', 'no_suggestion'] }))).status, 400);
  assert.equal((await post(sample({ improvement_priorities: ['sound', 'sound'] }))).status, 400);
  assert.equal((await post(sample({ answers: { attendance_days: 'not_attended', overall_satisfaction: '5' }, feedback: 'پیشنهاد' }))).status, 400);
  assert.equal((await post(sample({ answers: { attendance_days: '1' } }))).status, 400);
  assert.equal((await post({ ...sample(), injected: 'discard me' })).status, 400);
  const dissatisfied = sample({ answers: { attendance_days: '1', overall_satisfaction: '1' } });
  assert.equal((await post(dissatisfied)).status, 201); sent.push(dissatisfied);
  const absent = sample({ answers: { attendance_days: 'not_attended' }, feedback: 'نظر فردی که حضور نداشته است' });
  assert.equal((await post(absent)).status, 201); sent.push(absent);
  assert.equal(app.store.all().length, 4);
});

test('private rows, Excel, database files and configuration cannot be read anonymously', async () => {
  for (const path of ['/api/admin/stats', '/api/admin/responses', '/api/admin/export.xlsx']) assert.equal((await request(path)).status, 401);
  for (const path of ['/data/survey.sqlite', '/.env', '/server.mjs', '/lib/auth.mjs', '/assets/../.env']) assert.equal((await request(path)).status, 404);
  assert.equal((await request('/api/admin/session')).status, 200);
  assert.equal((await request('/api/admin/session').then(r => r.json())).authenticated, false);
});

test('foreign origins, invalid content types, malformed and oversized requests are rejected', async () => {
  assert.equal((await request('/api/responses', { method: 'POST', headers: { Origin: 'https://foreign.invalid' }, body: JSON.stringify(sample()) })).status, 403);
  assert.equal((await request('/api/responses', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status, 415);
  assert.equal((await request('/api/responses', { method: 'POST', body: '{' })).status, 400);
  assert.equal((await request('/api/responses', { method: 'POST', body: JSON.stringify({ data: 'x'.repeat(17000) }) })).status, 413);
  assert.equal(app.store.all().length, 4);
});

test('admin authentication protects metrics and computes correct valid denominators', async () => {
  assert.equal((await request('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: 'wrong' }) })).status, 401);
  await login();
  const response = await request('/api/admin/stats', { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  const stats = await response.json();
  assert.equal(stats.total, 4); assert.equal(stats.absent, 1); assert.equal(stats.eligible, 3);
  assert.equal(stats.overall.valid, 3); assert.equal(stats.overall.satisfaction_rate, 2 / 3);
  const sound = stats.measures.find(measure => measure.id === 'sound_satisfaction');
  assert.equal(sound.valid, 1); assert.equal(sound.skipped, 1); assert.equal(sound.alternatives[0].count, 1); assert.equal(sound.excluded_absent, 1);
  assert.equal(stats.priority_respondents, 2);
  assert.equal(stats.priorities.find(item => item.value === 'sound').rate, 0.5);
});

test('authenticated Excel is a real workbook; keep an artifact for independent parser verification', async () => {
  const response = await request('/api/admin/export.xlsx', { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.readUInt32LE(0), 0x04034b50);
  assert.ok(bytes.length > 2000);
  const artifact = join(directory, 'export.xlsx');
  writeFileSync(artifact, bytes);
  writeFileSync(join(projectRoot, 'qa', 'latest-export-path.txt'), artifact);
});

test('responses survive a restart and an online SQLite backup is readable', async () => {
  const backup = join(directory, 'snapshot.sqlite');
  app.store.backup(backup); assert.equal(existsSync(backup), true);
  await app.close(); app = createApplication(config);
  const address = await app.listen(); origin = `http://127.0.0.1:${address.port}`;
  assert.equal(app.store.all().length, 4);
  assert.equal((await request('/api/admin/stats', { headers: { Cookie: cookie } })).status, 200);
});

test('search uses literal parameters, pagination works, and logout revokes the session', async () => {
  for (let index = 0; index < 24; index++) assert.equal((await post(sample({ feedback: `pagination-${index}` }))).status, 201);
  let response = await request('/api/admin/responses?page=2', { headers: { Cookie: cookie } });
  let data = await response.json(); assert.equal(data.total, 28); assert.equal(data.rows.length, 3);
  response = await request('/api/admin/responses?q=09120000000', { headers: { Cookie: cookie } });
  data = await response.json(); assert.equal(data.total, 1); assert.equal(data.rows[0].contact.phone, '09120000000');
  response = await request('/api/admin/responses?q=%27%20OR%201%3D1--', { headers: { Cookie: cookie } });
  assert.equal((await response.json()).total, 0);
  assert.equal((await request('/api/admin/logout', { method: 'POST', headers: { Cookie: cookie }, body: '{}' })).status, 403);
  assert.equal((await request('/api/admin/logout', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': csrf }, body: '{}' })).status, 200);
  assert.equal((await request('/api/admin/export.xlsx', { headers: { Cookie: cookie } })).status, 401);
});

test('the app can share a domain under /heyat without using the main website API', async () => {
  const mounted = createApplication({ ...config, basePath: '/heyat', dataDirectory: join(directory, 'mounted') });
  try {
    const address = await mounted.listen();
    const base = `http://127.0.0.1:${address.port}`;
    const redirect = await fetch(`${base}/heyat`, { redirect: 'manual' }); assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), '/heyat/');
    assert.equal((await fetch(`${base}/heyat/healthz`)).status, 200);
    assert.equal((await fetch(`${base}/heyat/admin`)).status, 200);
    assert.equal((await fetch(`${base}/api/admin/session`)).status, 404);
    assert.equal((await fetch(`${base}/heyat/api/responses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sample()) })).status, 201);
    const script = await fetch(`${base}/heyat/app.js`).then(response => response.text()); assert.match(script, /new URL\('api\/responses', document.baseURI\)/);
  } finally { await mounted.close(); }
});

test('rate limiter expires windows and does not allow unbounded attempts', () => {
  const limiter = new RateLimiter();
  assert.equal(limiter.allow('login', 2, 1000, 0), true); assert.equal(limiter.allow('login', 2, 1000, 1), true); assert.equal(limiter.allow('login', 2, 1000, 2), false); assert.equal(limiter.allow('login', 2, 1000, 1001), true);
});
