import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApplication } from '../lib/http.mjs';
import { readConfig, projectRoot } from '../lib/config.mjs';
import { hashPassword } from '../lib/auth.mjs';

test('all form fields persist centrally and all response pages export after restart', async () => {
  const qa = join(projectRoot, 'qa');
  mkdirSync(qa, { recursive: true });
  const directory = mkdtempSync(join(qa, 'complete-export-'));
  const password = randomBytes(24).toString('base64url');
  const username = 'survey-operator';
  const config = readConfig({ HOST: '127.0.0.1', PORT: '0', DATA_DIR: directory, ADMIN_USERNAME: username, ADMIN_PASSWORD_HASH: await hashPassword(password), SESSION_SECRET: randomBytes(32).toString('hex') });
  let app = createApplication(config);
  let origin;
  const listen = async () => { const address = await app.listen(); origin = `http://127.0.0.1:${address.port}`; };
  const request = (path, options = {}) => fetch(`${origin}${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const fullAnswers = {
    attendance_days: '5', overall_satisfaction: '4', start_time: 'slightly_late', venue_satisfaction: '2',
    speech_satisfaction: '5', speech_duration: 'slightly_long', recitation_satisfaction: '3', reciter_count: 'too_many',
    hospitality_satisfaction: '1', sound_satisfaction: '4', women_space_satisfaction: '5', total_duration: 'suitable', children_satisfaction: '2',
  };
  const fullLabels = ['۵ روز', 'راضی', 'کمی دیر', 'ناراضی', 'بسیار راضی', 'کمی طولانی', 'نه راضی و نه ناراضی', 'بیشتر از حد مناسب', 'بسیار ناراضی', 'راضی', 'بسیار راضی', 'مناسب', 'ناراضی'];
  const headers = ['شناسه پاسخ', 'زمان ثبت تهران', 'زمان ثبت UTC', 'نام و نام خانوادگی', 'شماره تماس', 'میزان حضور', 'رضایت کلی', 'ساعت شروع', 'محل برگزاری', 'سخنرانی‌ها', 'مدت سخنرانی', 'اجرای مداحان', 'تعداد مداحان', 'پذیرایی', 'کیفیت صوت', 'فضای خواهران', 'مدت کل مراسم', 'بخش نونهالان', 'اولویت‌های بهبود', 'نظر آزاد'];
  const expected = [];
  try {
    await listen();
    for (let index = 0; index < 27; index++) {
      const absent = index === 25;
      const partial = index === 26;
      const payload = {
        questionnaire_version: '1.0', submission_id: randomBytes(16).toString('hex'),
        contact: { full_name: index === 0 ? '=1+1' : index === 1 || absent || partial ? null : `نمونه آزمایشی ${index}`, phone: index === 0 ? '09120000000' : null },
        answers: absent ? { attendance_days: 'not_attended' } : partial ? { attendance_days: '1', sound_satisfaction: 'unable_to_assess', women_space_satisfaction: 'not_experienced' } : { ...fullAnswers },
        improvement_priorities: absent ? [] : partial ? ['no_suggestion'] : ['sound', 'other', 'speech_duration'],
        feedback: absent ? 'نظر آزمایشی فرد غایب' : partial ? null : index === 0 ? '=SUM(1,2)\nمتن فارسی <b>خام</b> & چندخطی' : `نظر آزمایشی ${index}\nحفظ کیفیت و نظم برنامه`,
      };
      const response = await request('/api/responses', { method: 'POST', body: JSON.stringify(payload) });
      assert.equal(response.status, 201);
      assert.equal((await response.json()).receipt, payload.submission_id);
      const labels = absent ? ['در این مراسم حضور نداشتم', ...Array(12).fill('بدون پاسخ')] : partial ? ['۱ روز', ...Array(8).fill('بدون پاسخ'), 'امکان ارزیابی ندارم', 'از این فضا استفاده نکردم', 'بدون پاسخ', 'بدون پاسخ'] : fullLabels;
      expected.push({ id: payload.submission_id, payload, labels, priorities_label: absent ? '' : partial ? 'در حال حاضر پیشنهاد مشخصی ندارم' : 'سایر؛ صوت؛ مدت سخنرانی' });
    }
    assert.equal(app.store.all().length, 27);
    const loginAs = credentials => request('/api/admin/login', { method: 'POST', body: JSON.stringify(credentials) });
    const loginPage = await request('/admin').then(response => response.text());
    assert.match(loginPage, /id="admin-username"[^>]+autocomplete="username"/);
    assert.match(loginPage, /id="export-link" href="\.\/api\/admin\/export\.xlsx"/);
    assert.equal((await request('/api/admin/export.xlsx')).status, 401);
    assert.equal((await loginAs({ password })).status, 401);
    assert.equal((await loginAs({ username: 'admin', password })).status, 401);
    const login = await loginAs({ username, password });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const auth = { headers: { Cookie: cookie } };
    const pageOne = await request('/api/admin/responses?page=1', auth).then(r => r.json());
    const pageTwo = await request('/api/admin/responses?page=2', auth).then(r => r.json());
    assert.equal(pageOne.total, 27); assert.equal(pageOne.rows.length, 25); assert.equal(pageTwo.rows.length, 2);
    const filtered = await request('/api/admin/responses?q=%3D1%2B1', auth).then(r => r.json());
    assert.equal(filtered.total, 1);
    const snapshot = join(directory, 'snapshot.sqlite');
    app.store.backup(snapshot);
    await app.close(); app = null;
    app = createApplication(config); await listen();
    assert.equal(app.store.all().length, 27);
    for (const row of expected) {
      const stored = app.store.all().find(item => item.id === row.id);
      assert.deepEqual(stored.contact, row.payload.contact);
      for (const [key, value] of Object.entries(row.payload.answers)) assert.equal(stored.answers[key], value);
      assert.deepEqual(stored.priorities, [...row.payload.improvement_priorities].sort());
      assert.equal(stored.feedback, row.payload.feedback);
    }
    const stats = await request('/api/admin/stats', auth).then(r => r.json());
    assert.equal(stats.total, 27);
    const response = await request('/api/admin/export.xlsx', auth);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.readUInt32LE(0), 0x04034b50);
    const workbook = join(directory, 'all-columns.xlsx');
    writeFileSync(workbook, bytes);
    const backup = new DatabaseSync(snapshot, { readOnly: true });
    try {
      assert.equal(backup.prepare('SELECT COUNT(*) AS total FROM responses').get().total, 27);
      for (const row of expected) {
        const saved = backup.prepare('SELECT * FROM responses WHERE id=?').get(row.id);
        assert.equal(saved.full_name, row.payload.contact.full_name);
        assert.equal(saved.phone, row.payload.contact.phone);
        assert.equal(saved.feedback, row.payload.feedback);
      }
    } finally { backup.close(); }
    const report = { workbook, snapshot, responses: 27, columns: headers.length, headers, expected };
    writeFileSync(join(directory, 'expected.json'), JSON.stringify(report, null, 2));
    writeFileSync(join(qa, 'complete-export-report-path.txt'), join(directory, 'expected.json'));
  } finally { if (app) await app.close(); }
});
