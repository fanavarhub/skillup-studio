import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
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
  server = spawn(process.execPath, [path.join(projectDir, 'dist', 'server.cjs')], {
    cwd: tempDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      SKILLUP_ADMIN_PASSWORD: 'Automated-Test-Admin-Password',
      SKILLUP_SESSION_SECRET: 'automated-test-session-secret-longer-than-32-characters',
      PUBLIC_BASE_URL: base,
    },
    stdio: 'ignore',
  })
  for (let attempt = 0; attempt < 60; attempt += 1) {
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
})

test('video XP is awarded once and only after 75 percent', async () => {
  const first = await request('/api/student-profile/action', { method: 'POST', ...auth(studentToken, { actionType: 'watch_video', targetId: 'v1', courseId: 'course-1', watchedPercent: 74 }) })
  const completed = await request('/api/student-profile/action', { method: 'POST', ...auth(studentToken, { actionType: 'watch_video', targetId: 'v1', courseId: 'course-1', watchedPercent: 75 }) })
  const duplicate = await request('/api/student-profile/action', { method: 'POST', ...auth(studentToken, { actionType: 'watch_video', targetId: 'v1', courseId: 'course-1', watchedPercent: 100 }) })
  assert.deepEqual([first.body.xpAwarded, completed.body.xpAwarded, duplicate.body.xpAwarded], [0, 10, 0])
})

test('project submission ignores spoofed identity and awards 40 XP once', async () => {
  for (let index = 1; index <= 2; index += 1) {
    const result = await request('/api/projects', { method: 'POST', ...auth(studentToken, { title: `Project ${index}`, category: 'Game', studentName: 'Spoofed Name', status: 'approved', scratchId: `1000${index}` }) })
    assert.equal(result.response.status, 201)
    assert.equal(result.body.studentName, 'Test Student')
    assert.equal(result.body.status, 'pending')
    if (index === 1) projectId = result.body.id
  }
  const profile = await request('/api/student-profile', auth(studentToken))
  assert.equal(profile.body.xp, 90)
  assert.equal(profile.body.level, 4)
})

test('weekly league visibly labels every simulated account', async () => {
  const { body } = await request('/api/leaderboard')
  const demos = body.entries.filter((entry) => entry.isBot)
  assert.ok(demos.length > 0)
  assert.ok(body.entries.length <= 5)
  assert.ok(demos.every((entry) => entry.publicLabel === 'حساب نمایشی'))
})

test('admin dashboard, rubric grading and certificate verification work', async () => {
  const login = await request('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'Automated-Test-Admin-Password' }) })
  adminToken = login.body.token
  const dashboard = await request('/api/admin/learning-dashboard', auth(adminToken))
  assert.equal(dashboard.body.summary.students, 1)
  assert.equal(dashboard.body.summary.demoAccounts, 8)

  await request(`/api/projects/${projectId}`, { method: 'PATCH', ...auth(adminToken, { status: 'revision_required', scoreAwarded: 50, adminNotes: 'Please revise', rubric: [{ title: 'Technical', maxScore: 60 }] }) })
  await request(`/api/projects/${projectId}`, { method: 'PATCH', ...auth(adminToken, { status: 'revision_required', scoreAwarded: 50 }) })
  const graded = await request('/api/student-profile', auth(studentToken))
  assert.equal(graded.body.xp, 140)

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
