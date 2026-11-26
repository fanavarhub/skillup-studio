import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { spawn } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempDir = mkdtempSync(path.join(tmpdir(), 'skillup-test-'))
const port = 43991
const base = `http://127.0.0.1:${port}`
let server
let studentToken = ''
let adminToken = ''
let projectId = ''
let sessionId = ''
let sessionAssetId = ''
let freeRegistrationId = ''

async function request(route, options = {}) {
  const response = await fetch(`${base}${route}`, options)
  const type = response.headers.get('content-type') || ''
  const body = type.includes('json') ? await response.json() : await response.text()
  return { response, body }
}

const auth = (token, body) => ({
  headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
})

before(async () => {
  cpSync(path.join(projectDir, 'dist'), path.join(tempDir, 'dist'), { recursive: true })
  server = spawn(process.execPath, [path.join(projectDir, 'dist', 'server.cjs')], {
    cwd: tempDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      SKILLUP_ADMIN_USERNAME: 'test-admin',
      SKILLUP_ADMIN_PASSWORD: 'Automated-Test-Admin-Password',
      SKILLUP_SESSION_SECRET: 'automated-test-session-secret-longer-than-32-characters',
      PUBLIC_BASE_URL: base,
      SCRATCH_LESSON_ADMIN_TOKEN: 'test-only-scratch-moderation-token',
      FREE_SCRATCH_COURSE_ID: 'course-1',
      GA_MEASUREMENT_ID: 'G-TEST12345',
      GOOGLE_SITE_VERIFICATION: 'test-verification-token-12345',
    },
    stdio: 'ignore',
  })
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try { if ((await fetch(`${base}/api/health`)).ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Test server did not start')
})

after(async () => {
  if (server && server.exitCode === null) {
    server.kill()
    await Promise.race([
      new Promise((resolve) => server.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ])
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { rmSync(tempDir, { recursive: true, force: true }); break } catch {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
})

test('health endpoint does not expose database path', async () => {
  const { response, body } = await request('/api/health')
  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal('dbPath' in body, false)
})

test('direct signup URL serves the registration application', async () => {
  const { response, body } = await request('/signup')
  assert.equal(response.status, 200)
  assert.match(body, /اسکیل آپ/)
})

test('comment login URL serves the application without indexing the login screen', async () => {
  const { response, body } = await request('/login?returnTo=%2Fmagazine%2Fscratch-costume-animation%23comments')
  assert.equal(response.status, 200)
  assert.match(body, /<div id="root"><\/div>/)
})

test('Scratch download article has a crawlable SEO shell', async () => {
  const { response, body } = await request('/magazine/download-scratch')
  assert.equal(response.status, 200)
  assert.match(body, /<title>دانلود اسکرچ برای ویندوز و اندروید \+ آموزش نصب \| اسکیل آپ<\/title>/)
  assert.match(body, /rel="canonical" href="https:\/\/skill-up\.ir\/magazine\/download-scratch"/)
  assert.match(body, /"@type":"Article"/)
})

test('magazine index has its own canonical SEO shell', async () => {
  const { response, body } = await request('/magazine')
  assert.equal(response.status, 200)
  assert.match(body, /<title>مجله اسکیل آپ \| آموزش برنامه‌نویسی و مهارت‌های دیجیتال نوجوانان<\/title>/)
  assert.match(body, /rel="canonical" href="https:\/\/skill-up\.ir\/magazine"/)
})

test('all public sections and magazine articles have direct crawlable URLs', async () => {
  const pages = [
    ['/courses', /canonical" href="https:\/\/skill-up\.ir\/courses/],
    ['/projects', /canonical" href="https:\/\/skill-up\.ir\/projects/],
    ['/signup', /canonical" href="https:\/\/skill-up\.ir\/signup/],
    ['/magazine/why-scratch-for-kids', /"@type":"FAQPage"/],
    ['/magazine/ai-future-careers', /هوش مصنوعی و آینده شغلی نوجوانان/],
    ['/magazine/public-speaking-for-teens', /فن بیان و ارائه پروژه/],
  ]
  for (const [route, expected] of pages) {
    const page = await request(route)
    assert.equal(page.response.status, 200)
    assert.match(page.body, expected)
    assert.match(page.body, /google-site-verification/)
  }
  const dashboard = await request('/dashboard')
  assert.match(dashboard.body, /content="noindex, nofollow"/)
  const missing = await request('/definitely-not-a-page')
  assert.equal(missing.response.status, 404)
})

test('Google Analytics is enabled only through the configured measurement ID', async () => {
  const home = await request('/')
  assert.match(home.body, /googletagmanager\.com\/gtag\/js\?id=G-TEST12345/)
  const script = await request('/analytics.js')
  assert.equal(script.response.status, 200)
  assert.match(script.body, /G-TEST12345/)
  assert.match(script.body, /skillup:navigation/)
})

test('unknown or unprovisioned downloads never fall through to the SPA', async () => {
  const unknown = await request('/downloads/not-allowed.exe')
  assert.equal(unknown.response.status, 404)
  assert.equal(unknown.response.headers.get('content-type')?.includes('application/json'), true)
  const missing = await request('/downloads/scratch-windows.exe')
  assert.equal(missing.response.status, 503)
  assert.equal(missing.response.headers.get('content-type')?.includes('application/json'), true)
})

test('student resources require a signed session', async () => {
  const { response } = await request('/api/student-profile')
  assert.equal(response.status, 401)
})

test('public courses hide meeting links and lesson attachments', async () => {
  const { body } = await request('/api/courses')
  assert.ok(body.length > 0)
  assert.ok(body.every((course) => course.onlineMeetingLink === '' && course.offlineVideos.length === 0))
})

test('register creates an isolated level-one profile', async () => {
  const { response, body } = await request('/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Student', phone: '09120001122', password: 'Secure-Test-Password' }),
  })
  assert.equal(response.status, 201)
  studentToken = body.token
  const profile = await request('/api/student-profile?name=SomeoneElse', auth(studentToken))
  assert.equal(profile.body.studentName, 'Test Student')
  assert.equal(profile.body.xp, 0)
  assert.equal(profile.body.level, 1)
  const dailyBeforeEnrollment = await request('/api/daily-questions', auth(studentToken))
  assert.equal(dailyBeforeEnrollment.body.mission, null)
})

test('free Scratch registration validates and stores complete form data', async () => {
  const invalid = await request('/api/free-course-registrations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Test Free Student', phone: '۰۹۱۲۱۱۱۲۲۳۳', age: 12, province: 'تهران', educationGrade: 'هفتم', relation: 'خودم', bannerShared: false, programmingExperience: 'کاملاً مبتدی هستم' }),
  })
  assert.equal(invalid.response.status, 400)

  const payload = { fullName: 'Test Free Student', phone: '۰۹۱۲۱۱۱۲۲۳۳', age: 12, province: 'تهران', educationGrade: 'هفتم', relation: 'خودم', bannerShared: true, programmingExperience: 'کاملاً مبتدی هستم' }
  const created = await request('/api/free-course-registrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  assert.equal(created.response.status, 201)
  freeRegistrationId = created.body.id
  const duplicate = await request('/api/free-course-registrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  assert.equal(duplicate.response.status, 409)
  const privateList = await request('/api/admin/free-course-registrations')
  assert.equal(privateList.response.status, 401)
})

test('admin creates a session, uploads an allowed file and enrollment controls access', async () => {
  const rejectedLogin = await request('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'Automated-Test-Admin-Password' }) })
  assert.equal(rejectedLogin.response.status, 401)
  const login = await request('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test-admin', password: 'Automated-Test-Admin-Password' }) })
  adminToken = login.body.token
  const created = await request('/api/admin/course-sessions', { method: 'POST', ...auth(adminToken, { courseId: 'course-1', title: 'Tracked lesson', description: 'Test lesson', xpReward: 13, durationSeconds: 1 }) })
  assert.equal(created.response.status, 201)
  sessionId = created.body.id

  const form = new FormData()
  form.append('file', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'lesson.pdf')
  const uploaded = await request(`/api/admin/course-sessions/${sessionId}/assets`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: form })
  assert.equal(uploaded.response.status, 201)
  sessionAssetId = uploaded.body.id
  const videoForm = new FormData()
  videoForm.append('file', new Blob(['test-video-bytes'], { type: 'video/mp4' }), 'lesson.mp4')
  const videoUpload = await request(`/api/admin/course-sessions/${sessionId}/assets`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: videoForm })
  assert.equal(videoUpload.response.status, 201)

  const locked = await request('/api/student/courses/course-1/sessions', auth(studentToken))
  assert.equal(locked.response.status, 403)
  const purchase = await request('/api/purchases', { method: 'POST', ...auth(studentToken, { courseId: 'course-1', phone: '09120001122', receiptNumber: 'TEST-1234' }) })
  await request(`/api/payments/${purchase.body.payment.id}`, { method: 'PATCH', ...auth(adminToken, { status: 'approved' }) })
  const unlocked = await request('/api/student/courses/course-1/sessions', auth(studentToken))
  assert.ok(unlocked.body.some((item) => item.id === sessionId))
  const access = await request(`/api/session-assets/${sessionAssetId}/access`, auth(studentToken))
  assert.match(access.body.url, /token=/)
})

test('admin creates one secure student account from a free registration', async () => {
  const list = await request('/api/admin/free-course-registrations', auth(adminToken))
  assert.equal(list.response.status, 200)
  const registration = list.body.find((item) => item.id === freeRegistrationId)
  assert.equal(registration.phone, '09121112233')
  assert.equal('password' in registration, false)

  const created = await request(`/api/admin/free-course-registrations/${freeRegistrationId}/create-account`, { method: 'POST', ...auth(adminToken) })
  assert.equal(created.response.status, 201)
  assert.equal(created.body.credentials.username, '09121112233')
  assert.equal(created.body.credentials.password, '12344321')
  assert.equal(created.body.course.id, 'course-1')
  const login = await request('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: created.body.credentials.username, password: created.body.credentials.password }),
  })
  assert.equal(login.response.status, 200)
  assert.equal(login.body.user.name, 'Test Free Student')
  const freeProfile = await request('/api/student-profile', auth(login.body.token))
  assert.ok(freeProfile.body.purchasedCourses.includes('course-1'))
  const duplicate = await request(`/api/admin/free-course-registrations/${freeRegistrationId}/create-account`, { method: 'POST', ...auth(adminToken) })
  assert.equal(duplicate.response.status, 409)

  const existingRegistration = await request('/api/free-course-registrations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Test Student', phone: '09120001122', age: 13, province: 'تهران', educationGrade: 'هشتم', relation: 'خودم', bannerShared: true, programmingExperience: 'کمی آشنایی دارم' }),
  })
  const linked = await request(`/api/admin/free-course-registrations/${existingRegistration.body.id}/create-account`, { method: 'POST', ...auth(adminToken) })
  assert.equal(linked.response.status, 200)
  assert.equal(linked.body.existingAccount, true)
  assert.equal(linked.body.credentials.password, '12344321')
  const relogin = await request('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '09120001122', password: '12344321' }),
  })
  assert.equal(relogin.response.status, 200)
})

test('admin assigns learning level and course-specific daily mission is completed once', async () => {
  const level = await request('/api/admin/users/not-found/learning-level', { method: 'PATCH', ...auth(adminToken, { level: 5 }) })
  assert.equal(level.response.status, 404)
  const dashboard = await request('/api/admin/learning-dashboard', auth(adminToken))
  const student = dashboard.body.students.find((item) => item.name === 'Test Student')
  const assigned = await request(`/api/admin/users/${student.userId}/learning-level`, { method: 'PATCH', ...auth(adminToken, { level: 5 }) })
  assert.equal(assigned.body.level, 5)
  const created = await request('/api/admin/questions', { method: 'POST', ...auth(adminToken, { courseId: 'course-1', levelBand: 'starter', question: 'Course mission', options: ['A', 'B'], answerIndex: 1, explanation: 'B', xpReward: 7 }) })
  assert.equal(created.response.status, 201)
  const daily = await request('/api/daily-questions', auth(studentToken))
  assert.equal(daily.body.questions.length, 1)
  assert.equal(daily.body.mission.courseId, 'course-1')
  assert.equal(daily.body.level, 5)
  const first = await request(`/api/daily-questions/${daily.body.mission.id}/answer`, { method: 'POST', ...auth(studentToken, { selectedIndex: 1 }) })
  const duplicate = await request(`/api/daily-questions/${daily.body.mission.id}/answer`, { method: 'POST', ...auth(studentToken, { selectedIndex: 1 }) })
  assert.deepEqual([first.body.xpAwarded, duplicate.body.xpAwarded], [7, 0])
  const bulk = await request('/api/admin/questions/bulk', { method: 'POST', ...auth(adminToken, { tasks: [
    { courseId: 'course-1', levelBand: 'starter', question: 'Bulk one', options: ['1', '2'], answerIndex: 0 },
    { courseId: 'course-1', levelBand: 'starter', question: 'Bulk two', options: ['1', '2'], answerIndex: 1 },
  ] }) })
  assert.equal(bulk.body.created, 2)
  const tasks = await request('/api/admin/questions', auth(adminToken))
  const createdTask = tasks.body.find((item) => item.question === 'Bulk one')
  assert.deepEqual(createdTask.options, ['1', '2'])
  await request(`/api/admin/questions/${createdTask.id}`, { method: 'PATCH', ...auth(adminToken, { isActive: false }) })
  const updatedTasks = await request('/api/admin/questions', auth(adminToken))
  assert.equal(updatedTasks.body.find((item) => item.id === createdTask.id).isActive, false)
})

test('student can update display identity', async () => {
  const updated = await request('/api/profile', { method: 'PATCH', ...auth(studentToken, { name: 'New Student Name', avatar: '🐲' }) })
  assert.equal(updated.body.studentName, 'New Student Name')
  assert.equal(updated.body.avatar, '🐲')
})

test('manual completion is rejected and heartbeat awards XP exactly once after real coverage', async () => {
  const manual = await request('/api/student-profile/action', { method: 'POST', ...auth(studentToken, { actionType: 'watch_video', targetId: 'v1', courseId: 'course-1', watchedPercent: 100 }) })
  assert.equal(manual.response.status, 410)
  const spoofedDuration = await request(`/api/sessions/${sessionId}/progress`, { method: 'POST', ...auth(studentToken, { currentTime: 0.1, duration: 0.1, playing: true }) })
  assert.equal(spoofedDuration.response.status, 400)
  const first = await request(`/api/sessions/${sessionId}/progress`, { method: 'POST', ...auth(studentToken, { currentTime: 0, duration: 1, playing: true }) })
  await new Promise((resolve) => setTimeout(resolve, 500))
  const middle = await request(`/api/sessions/${sessionId}/progress`, { method: 'POST', ...auth(studentToken, { currentTime: 0.5, duration: 1, playing: true }) })
  await new Promise((resolve) => setTimeout(resolve, 350))
  const completed = await request(`/api/sessions/${sessionId}/progress`, { method: 'POST', ...auth(studentToken, { currentTime: 0.86, duration: 1, playing: true }) })
  const duplicate = await request(`/api/sessions/${sessionId}/progress`, { method: 'POST', ...auth(studentToken, { currentTime: 0.9, duration: 1, playing: true }) })
  assert.deepEqual([first.body.xpAwarded, middle.body.xpAwarded, completed.body.xpAwarded, duplicate.body.xpAwarded], [0, 0, 13, 0])
  const notices = await request('/api/notifications', auth(studentToken))
  assert.ok(notices.body.some((item) => item.type === 'session_complete'))
})

test('project submission ignores spoofed identity and awards 40 XP once', async () => {
  for (let index = 1; index <= 2; index += 1) {
    const result = await request('/api/projects', { method: 'POST', ...auth(studentToken, { title: `Project ${index}`, category: 'Game', studentName: 'Spoofed Name', status: 'approved', scratchId: `1000${index}` }) })
    assert.equal(result.response.status, 201)
    assert.equal(result.body.studentName, 'New Student Name')
    assert.equal(result.body.status, 'pending')
    if (index === 1) projectId = result.body.id
  }
  const profile = await request('/api/student-profile', auth(studentToken))
  assert.equal(profile.body.xp, 100)
})

test('public weekly league never exposes simulated accounts', async () => {
  const { body } = await request('/api/leaderboard')
  assert.ok(body.entries.length <= 5)
  assert.ok(body.entries.every((entry) => !entry.isBot && !entry.publicLabel))
})

test('site messages require moderation and can include an admin reply', async () => {
  const submitted = await request('/api/site-messages', { method: 'POST', ...auth(studentToken, { body: 'A useful verified review', rating: 5 }) })
  assert.equal(submitted.response.status, 201)
  const before = await request('/api/site-messages')
  assert.ok(!before.body.some((item) => item.id === submitted.body.id))
  await request(`/api/admin/site-messages/${submitted.body.id}`, { method: 'PATCH', ...auth(adminToken, { status: 'approved', featured: true, adminReply: 'Thank you' }) })
  const afterModeration = await request('/api/site-messages')
  const publicItem = afterModeration.body.find((item) => item.id === submitted.body.id)
  assert.equal(publicItem.adminReply, 'Thank you')
})

test('admin dashboard, rubric grading and certificate verification work', async () => {
  const dashboard = await request('/api/admin/learning-dashboard', auth(adminToken))
  assert.equal(dashboard.body.summary.students, 2)
  assert.equal(dashboard.body.summary.demoAccounts, 8)

  await request(`/api/projects/${projectId}`, { method: 'PATCH', ...auth(adminToken, { status: 'revision_required', scoreAwarded: 50, adminNotes: 'Please revise', rubric: [{ title: 'Technical', maxScore: 60 }] }) })
  await request(`/api/projects/${projectId}`, { method: 'PATCH', ...auth(adminToken, { status: 'revision_required', scoreAwarded: 50 }) })
  const graded = await request('/api/student-profile', auth(studentToken))
  assert.equal(graded.body.xp, 150)

  const certRequest = await request('/api/certificates/issue', { method: 'POST', ...auth(studentToken, { courseId: 'course-1' }) })
  assert.equal(certRequest.body.status, 'pending')
  const requests = await request('/api/admin/certificate-requests', auth(adminToken))
  await request(`/api/admin/certificate-requests/${requests.body[0].id}`, { method: 'PATCH', ...auth(adminToken, { status: 'approved' }) })
  const certificates = await request('/api/certificates', auth(studentToken))
  assert.equal(certificates.body.length, 1)
  const verification = await request(`/api/certificates/verify/${certificates.body[0].verificationCode}`)
  assert.equal(verification.body.valid, true)
  const qr = await request(`/api/certificates/${certificates.body[0].id}/qr`)
  assert.match(qr.body, /<svg/)
})

test('club is isolated by course, supports replies, history and admin moderation', async () => {
  const forbiddenCourse = await request('/api/club?courseId=course-2', auth(studentToken))
  assert.equal(forbiddenCourse.response.status, 403)
  const created = await request('/api/club', { method: 'POST', ...auth(studentToken, { courseId: 'course-1', category: 'general', body: 'پیام اصلی باشگاه' }) })
  assert.equal(created.response.status, 201)
  const reply = await request('/api/club', { method: 'POST', ...auth(studentToken, { courseId: 'course-1', category: 'general', body: 'پاسخ هنرجو', parentId: created.body.id }) })
  assert.equal(reply.response.status, 201)
  const history = await request('/api/club?courseId=course-1&limit=10&offset=0', auth(studentToken))
  assert.equal(history.body.total >= 2, true)
  assert.equal(Array.isArray(history.body.posts), true)
  assert.equal(history.body.posts.find((item) => item.id === reply.body.id).parentId, created.body.id)
  const adminReply = await request('/api/admin/club/reply', { method: 'POST', ...auth(adminToken, { courseId: 'course-1', parentId: created.body.id, body: 'پاسخ مدیر' }) })
  assert.equal(adminReply.response.status, 201)
  const adminList = await request('/api/admin/club?courseId=course-1', auth(adminToken))
  assert.ok(adminList.body.some((item) => item.body === 'پاسخ مدیر'))
  await request(`/api/club/${created.body.id}`, { method: 'DELETE', ...auth(adminToken) })
  const afterDelete = await request('/api/club?courseId=course-1&limit=20', auth(studentToken))
  assert.ok(!afterDelete.body.posts.some((item) => item.id === created.body.id))
})

test('course has direct SEO page, editable FAQ and uploaded cover', async () => {
  const updated = await request('/api/courses/course-1', { method: 'PATCH', ...auth(adminToken, { faqs: [{ question: 'آیا پیش‌نیاز دارد؟', answer: 'خیر' }] }) })
  assert.equal(updated.response.status, 200)
  const course = await request('/api/courses/course-1', auth(studentToken))
  assert.equal(course.body.faqs[0].answer, 'خیر')
  assert.equal(course.body.isPurchased, true)
  const form = new FormData()
  form.append('file', new Blob(['fake-png'], { type: 'image/png' }), 'cover.png')
  const upload = await request('/api/admin/courses/course-1/cover', { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: form })
  assert.equal(upload.response.status, 200)
  const cover = await fetch(`${base}${upload.body.coverImage}`)
  assert.equal(cover.status, 200)
  assert.equal(cover.headers.get('content-type'), 'image/png')
  const page = await request('/courses/course-1')
  assert.equal(page.response.status, 200)
  assert.match(page.body, /"@type":"Course"/)
  assert.match(page.body, /rel="canonical" href="https:\/\/skill-up\.ir\/courses\/course-1"/)
  const sitemap = await request('/sitemap.xml')
  assert.match(sitemap.body, /https:\/\/skill-up\.ir\/courses\/course-1/)
})

test('forgot password is generic and admin can issue one temporary password', async () => {
  const unknown = await request('/api/auth/password-reset-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '09129999999' }) })
  const known = await request('/api/auth/password-reset-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '09120001122' }) })
  assert.equal(unknown.body.message, known.body.message)
  const resetRequests = await request('/api/admin/password-reset-requests', auth(adminToken))
  const item = resetRequests.body.find((entry) => entry.phone === '09120001122' && entry.status === 'pending')
  assert.ok(item)
  const resolved = await request(`/api/admin/password-reset-requests/${item.id}/resolve`, { method: 'POST', ...auth(adminToken) })
  assert.match(resolved.body.credentials.temporaryPassword, /^\d{8}$/)
  const login = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '09120001122', password: resolved.body.credentials.temporaryPassword }) })
  assert.equal(login.response.status, 200)
  const secondResolve = await request(`/api/admin/password-reset-requests/${item.id}/resolve`, { method: 'POST', ...auth(adminToken) })
  assert.equal(secondResolve.response.status, 404)
})

test('user CSV contains requested learning fields without password hashes', async () => {
  const report = await request('/api/admin/learning-dashboard.csv', auth(adminToken))
  assert.equal(report.response.status, 200)
  assert.match(report.body, /نام کاربری/)
  assert.match(report.body, /مجموع دقیقه مشاهده/)
  assert.match(report.body, /ویدئوهای بالای ۷۵٪/)
  assert.doesNotMatch(report.body, /[a-f0-9]{24}:[a-f0-9]{64}/)
})

test('magazine comments publish immediately with login, five reply levels, article scope and admin pins', async () => {
  const lesson = '/magazine/scratch-costume-animation'
  const { response, body } = await request(lesson)
  assert.equal(response.status, 200)
  assert.match(body, /<link rel="canonical"/)
  assert.ok(body.includes(base + lesson))
  assert.match(body, /www\.aparat\.com\/video\/video\/embed/)
  assert.match(body, /animation-blocks-approved\.png/)
  assert.equal((await request(lesson + '/assets/animation-blocks-approved.png')).response.headers.get('content-type'), 'image/png')
  assert.ok((await request('/sitemap.xml')).body.includes('https://skill-up.ir' + lesson))

  const endpoint = '/api/magazine/scratch-costume-animation/comments'
  assert.equal((await request(endpoint, { method: 'POST', ...auth('', { body: 'یک دیدگاه' }) })).response.status, 401)
  assert.equal((await request(lesson + '/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'مهمان', body: 'ورود را دور بزن' }) })).response.status, 410)
  const newStudent = await request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'آرین', phone: '09123334455', password: 'test-pass-1234' }) })
  assert.equal(newStudent.response.status, 201)
  const student = newStudent.body.token
  const adminLogin = await request('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test-admin', password: 'Automated-Test-Admin-Password' }) })
  assert.equal(adminLogin.response.status, 200)
  const admin = adminLogin.body.token
  const registry = await request('/api/magazine/articles', auth(admin))
  assert.ok(registry.body.some(item => item.slug === 'scratch-costume-animation'))
  assert.ok(registry.body.some(item => item.slug === 'download-scratch'))
  assert.equal((await request('/api/magazine/articles', auth(student))).response.status, 401)
  assert.equal((await request('/api/magazine/scratch-costume-animation/session', auth(student))).body.name, 'آرین')
  const create = (route, body, token = student) => request(route, { method: 'POST', ...auth(token, body) })
  const root = await create(endpoint, { body: '<b>تمرین تغییر لباس را انجام دادم.</b>', name: 'مدیر جعلی', pin: 'diamond' })
  assert.equal(root.response.status, 201)
  assert.equal(root.body.comment.name, 'آرین')
  assert.equal(root.body.comment.pin, 'none')
  const rootId = root.body.comment.id
  assert.equal((await request(endpoint)).body.comments[0].id, rootId)
  assert.equal((await create('/api/magazine/download-scratch/comments', { body: 'پاسخ اشتباه', parentId: rootId })).response.status, 400)
  let parentId = rootId
  for (let depth = 1; depth <= 5; depth++) {
    const reply = await create(endpoint, { body: `پاسخ لایهٔ ${depth}`, parentId })
    assert.equal(reply.response.status, 201)
    assert.equal(reply.body.comment.depth, depth)
    parentId = reply.body.comment.id
  }
  assert.equal((await create(endpoint, { body: 'لایهٔ اضافه', parentId })).response.status, 400)
  const replies = await request(`${endpoint}/${rootId}/replies`)
  assert.equal(replies.body.comments.length, 5)
  assert.equal((await request(`/api/admin/magazine/scratch-costume-animation/comments/${rootId}/pin`, { method: 'PATCH', ...auth(student, { pin: 'diamond' }) })).response.status, 401)
  const pin = (id, kind, article = 'scratch-costume-animation') => request(`/api/admin/magazine/${article}/comments/${id}/pin`, { method: 'PATCH', ...auth(admin, { pin: kind }) })
  assert.equal((await pin(rootId, 'diamond')).response.status, 200)
  const gold = []
  for (let i = 0; i < 3; i++) {
    const item = await create(endpoint, { body: `دیدگاه طلایی ${i}` }, admin)
    gold.push(item.body.comment.id)
    assert.equal((await pin(item.body.comment.id, 'gold')).response.status, 200)
  }
  const extra = await create(endpoint, { body: 'پین طلایی اضافه' }, admin)
  assert.equal((await pin(extra.body.comment.id, 'gold')).response.status, 409)
  const secondDiamond = await create(endpoint, { body: 'پین الماسی جدید' }, admin)
  assert.equal((await pin(secondDiamond.body.comment.id, 'diamond')).response.status, 200)
  const pinned = (await request(endpoint)).body.pins
  assert.equal(pinned.filter(item => item.pin === 'diamond').length, 1)
  assert.equal(pinned.filter(item => item.pin === 'gold').length, 3)
  assert.equal((await pin(parentId, 'gold')).response.status, 400)
  const deleteReply = await request(`/api/admin/magazine/scratch-costume-animation/comments/${replies.body.comments[0].id}`, { method: 'DELETE', ...auth(admin) })
  assert.equal(deleteReply.response.status, 200)
  const afterDelete = await request(`${endpoint}/${rootId}/replies`)
  assert.equal(afterDelete.body.comments[0].deleted, true)
  assert.equal(afterDelete.body.comments[0].body, '')
  assert.equal(afterDelete.body.comments[1].body, 'پاسخ لایهٔ 2')
  const downloadRoot = await create('/api/magazine/download-scratch/comments', { body: 'دیدگاه مقالهٔ دانلود' })
  assert.equal(downloadRoot.response.status, 201)
  assert.equal((await request('/api/magazine/download-scratch/comments')).body.comments.length, 1)
  assert.equal((await request(endpoint)).body.comments.some(item => item.id === downloadRoot.body.comment.id), false)
  assert.equal((await pin(downloadRoot.body.comment.id, 'diamond', 'download-scratch')).response.status, 200)
  assert.equal((await request('/api/magazine/download-scratch/comments')).body.pins.filter(item => item.pin === 'diamond').length, 1)
  assert.equal((await request(endpoint)).body.pins.filter(item => item.pin === 'diamond').length, 1)
  assert.equal((await request(`/api/admin/magazine/scratch-costume-animation/comments/${secondDiamond.body.comment.id}`, { method: 'DELETE', ...auth(admin) })).response.status, 200)
  assert.equal((await request(endpoint)).body.pins.filter(item => item.pin === 'diamond').length, 0)
})
