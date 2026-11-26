import express, { NextFunction, Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { createServer as createViteServer } from 'vite'
import { DatabaseSync } from 'node:sqlite'
import { seedCourses, seedProjects } from './src/data'
import type { ConsultationStatus, Course, PaymentRequest, PaymentStatus, ProjectStatus, StudentProject } from './src/types'
import { createSessionToken, readSession, requireAdminSession, sessionDurationMs } from './auth'
import { mountPlatformRoutes } from './platform'
import { mountLearningRoutes } from './learning'
import { findMagazineArticle, magazineArticles } from './src/articleData'
import { createLessonServer, lessonPath } from './features/scratch-costume/server.mjs'
import { mountMagazineComments } from './magazine-comments'
import { mountMagazineAnalytics } from './magazine-analytics'

const app = express()
const PORT = Number(process.env.PORT || 3000)
const isProduction = process.env.NODE_ENV === 'production'
const rootDir = process.cwd()
const dataDir = path.join(rootDir, 'data')
const downloadDir = path.join(dataDir, 'downloads')
const dbPath = path.join(dataDir, 'skillup-studio.sqlite')
const adminUsername = process.env.SKILLUP_ADMIN_USERNAME || 'admin'
const adminPassword = process.env.SKILLUP_ADMIN_PASSWORD || (isProduction ? '' : 'SkillUp@1405')
const configuredGaId = String(process.env.GA_MEASUREMENT_ID || '').trim().toUpperCase()
const gaMeasurementId = /^G-[A-Z0-9]{5,20}$/.test(configuredGaId) ? configuredGaId : ''
const configuredGoogleVerification = String(process.env.GOOGLE_SITE_VERIFICATION || '').trim()
const googleSiteVerification = /^[A-Za-z0-9_-]{20,100}$/.test(configuredGoogleVerification) ? configuredGoogleVerification : ''

if (isProduction && !adminPassword) throw new Error('SKILLUP_ADMIN_PASSWORD must be configured in production.')

fs.mkdirSync(dataDir, { recursive: true })
fs.mkdirSync(downloadDir, { recursive: true })
app.set('trust proxy', true)
app.disable('x-powered-by')
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  const scriptPolicy = isProduction ? "script-src 'self' https://www.googletagmanager.com" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  res.setHeader('Content-Security-Policy', `default-src 'self'; img-src 'self' data: https:; media-src 'self' https:; frame-src https://scratch.mit.edu https://www.youtube.com https://www.aparat.com; style-src 'self' 'unsafe-inline'; ${scriptPolicy}; connect-src 'self' ws: wss: https://www.google-analytics.com https://region1.google-analytics.com;`)
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})

// Give the lesson its own handlers before Express reads comment request bodies.
const lesson = createLessonServer({
  assetDir: path.resolve(path.dirname(process.argv[1]), isProduction ? '..' : '.', 'features', 'scratch-costume', 'public'),
  databasePath: path.join(dataDir, 'scratch-comments.sqlite'),
  publicOrigin: process.env.PUBLIC_BASE_URL || 'https://skill-up.ir',
  adminToken: '',
  trustProxy: false,
})
app.use((req, res, next) => {
  if (req.path === lessonPath + '/comments') {
    if (req.method === 'GET') return res.redirect(308, `/api/magazine/scratch-costume-animation/comments${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`)
    return res.status(410).json({ error: 'برای ثبت دیدگاه از بخش دیدگاه‌های همین مقاله استفاده کن.' })
  }
  if (req.path === lessonPath + '/moderation' || req.path.startsWith(lessonPath + '/moderation/')) {
    if (req.method === 'GET') return res.redirect(302, '/admin')
    return res.status(410).json({ error: 'مدیریت دیدگاه‌ها به پنل اصلی منتقل شده است.' })
  }
  if (req.path === lessonPath || req.path.startsWith(lessonPath + '/')) {
    lesson.emit('request', req, res)
    return
  }
  next()
})
app.use(express.json({ limit: '1mb' }))

app.get('/analytics.js', (_req, res) => {
  if (!gaMeasurementId) return res.status(404).type('text/javascript').send('')
  res.type('text/javascript').setHeader('Cache-Control', 'public, max-age=3600')
  res.send(`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${gaMeasurementId}',{anonymize_ip:true});window.__skillupLastGaPath=location.pathname+location.search;window.addEventListener('skillup:navigation',function(event){var next=event.detail&&event.detail.path;if(next&&next!==window.__skillupLastGaPath){window.__skillupLastGaPath=next;gtag('event','page_view',{page_location:location.href,page_path:next,page_title:document.title})}});`)
})

const db = new DatabaseSync(dbPath)

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS consultations (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    child_name TEXT,
    ip TEXT NOT NULL,
    device TEXT NOT NULL,
    browser TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL,
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_consultations_phone_created ON consultations(phone, created_at);

  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    level TEXT NOT NULL,
    price TEXT NOT NULL,
    duration TEXT NOT NULL,
    cover_image TEXT NOT NULL,
    online_meeting_link TEXT NOT NULL,
    offline_videos TEXT NOT NULL,
    instructor TEXT,
    capacity INTEGER,
    enrolled INTEGER,
    next_session_at TEXT,
    schedule_text TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    embed_url TEXT NOT NULL,
    offline_embed_url TEXT,
    scratch_id TEXT,
    student_name TEXT NOT NULL,
    student_age INTEGER NOT NULL,
    cover_image TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    likes INTEGER NOT NULL DEFAULT 0,
    featured INTEGER NOT NULL DEFAULT 0,
    profile_bio TEXT,
    profile_avatar TEXT
  );

  CREATE TABLE IF NOT EXISTS students (
    student_name TEXT PRIMARY KEY,
    xp INTEGER NOT NULL,
    level INTEGER NOT NULL,
    completed_videos TEXT NOT NULL,
    completed_quizzes TEXT NOT NULL,
    unlocked_rewards TEXT NOT NULL,
    purchased_courses TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    course_id TEXT NOT NULL,
    course_title TEXT NOT NULL,
    issued_at TEXT NOT NULL,
    verification_code TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS payment_requests (
    id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    course_id TEXT NOT NULL,
    course_title TEXT NOT NULL,
    amount TEXT NOT NULL,
    receipt_number TEXT NOT NULL,
    card_last_four TEXT,
    payer_name TEXT,
    notes TEXT,
    status TEXT NOT NULL,
    admin_notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`)
mountMagazineComments(app, db, path.join(dataDir, 'scratch-comments.sqlite'))
mountMagazineAnalytics(app, db)

function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

ensureColumn('courses', 'instructor', 'TEXT')
ensureColumn('courses', 'capacity', 'INTEGER')
ensureColumn('courses', 'enrolled', 'INTEGER')
ensureColumn('courses', 'next_session_at', 'TEXT')
ensureColumn('courses', 'schedule_text', 'TEXT')
ensureColumn('courses', 'faq_json', "TEXT NOT NULL DEFAULT '[]'")
ensureColumn('courses', 'cover_storage_name', 'TEXT')
ensureColumn('courses', 'cover_mime_type', 'TEXT')
ensureColumn('projects', 'featured', 'INTEGER NOT NULL DEFAULT 0')
ensureColumn('projects', 'profile_bio', 'TEXT')
ensureColumn('projects', 'profile_avatar', 'TEXT')

function now() {
  return new Date().toISOString()
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function normalizeDigits(value: unknown) {
  const input = String(value || '')
  const persian = '۰۱۲۳۴۵۶۷۸۹'
  const arabic = '٠١٢٣٤٥٦٧٨٩'
  return input
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
    .replace(/[\s-]/g, '')
}

function cleanText(value: unknown, max = 1000) {
  return String(value || '').trim().slice(0, max)
}

function hashPassword(password: string, salt = crypto.randomBytes(12).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, 32)
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), candidate)
}

function createAdminToken() {
  return createSessionToken({ id: 'admin', name: 'مدیر اسکیل آپ', phone: 'admin', role: 'admin' })
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAdminSession(req, res, next)
}

function isAdminRequest(req: Request) {
  return readSession(req)?.role === 'admin'
}

function rejectAdminRequired(res: Response) {
  res.status(401).json({ error: 'این عملیات فقط برای مدیر مجاز است.' })
}

function getClientInfo(req: Request) {
  const userAgent = req.get('user-agent') || 'Unknown'
  let device = 'دسکتاپ'
  if (/ipad|tablet/i.test(userAgent)) device = 'تبلت'
  else if (/iphone/i.test(userAgent)) device = 'آیفون'
  else if (/android/i.test(userAgent)) device = /mobile/i.test(userAgent) ? 'موبایل اندروید' : 'تبلت اندروید'
  else if (/mobile/i.test(userAgent)) device = 'موبایل'

  let browser = 'مرورگر ناشناس'
  if (/edg/i.test(userAgent)) browser = 'Microsoft Edge'
  else if (/chrome|crios/i.test(userAgent)) browser = 'Google Chrome'
  else if (/safari/i.test(userAgent)) browser = 'Safari'
  else if (/firefox/i.test(userAgent)) browser = 'Firefox'

  return {
    ip: req.ip || String(req.headers['x-forwarded-for'] || 'unknown'),
    device,
    browser,
  }
}

function courseFromRow(row: any): Course {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    level: row.level,
    price: row.price,
    duration: row.duration,
    coverImage: row.cover_image,
    onlineMeetingLink: row.online_meeting_link,
    offlineVideos: parseJson(row.offline_videos, []),
    instructor: row.instructor || undefined,
    capacity: row.capacity ?? undefined,
    enrolled: row.enrolled ?? undefined,
    nextSessionAt: row.next_session_at || undefined,
    scheduleText: row.schedule_text || undefined,
    faqs: parseJson(row.faq_json, []),
    isActive: Boolean(row.is_active),
  }
}

function projectFromRow(row: any): StudentProject {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    embedUrl: row.embed_url,
    offlineEmbedUrl: row.offline_embed_url || undefined,
    scratchId: row.scratch_id || undefined,
    studentName: row.student_name,
    studentAge: row.student_age,
    coverImage: row.cover_image,
    status: row.status,
    createdAt: row.created_at,
    likes: row.likes,
    featured: Boolean(row.featured),
    profileBio: row.profile_bio || undefined,
    profileAvatar: row.profile_avatar || undefined,
  }
}

function paymentFromRow(row: any): PaymentRequest {
  return {
    id: row.id,
    studentName: row.student_name,
    phone: row.phone,
    courseId: row.course_id,
    courseTitle: row.course_title,
    amount: row.amount,
    receiptNumber: row.receipt_number,
    cardLastFour: row.card_last_four || undefined,
    payerName: row.payer_name || undefined,
    notes: row.notes || undefined,
    status: row.status,
    adminNotes: row.admin_notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function seedDatabase() {
  const courseCount = db.prepare('SELECT COUNT(*) AS count FROM courses').get() as { count: number }
  if (!courseCount.count) {
    const insertCourse = db.prepare(`
      INSERT INTO courses (id, title, description, level, price, duration, cover_image, online_meeting_link, offline_videos, instructor, capacity, enrolled, next_session_at, schedule_text, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const course of seedCourses) {
      insertCourse.run(
        course.id,
        course.title,
        course.description,
        course.level,
        course.price,
        course.duration,
        course.coverImage,
        course.onlineMeetingLink,
        JSON.stringify(course.offlineVideos),
        course.instructor || null,
        course.capacity || null,
        course.enrolled || 0,
        course.nextSessionAt || null,
        course.scheduleText || null,
        course.isActive === false ? 0 : 1,
        now(),
        now(),
      )
    }
  }
  const updateSeedCourseMeta = db.prepare(`
    UPDATE courses
    SET instructor = COALESCE(instructor, ?),
        capacity = COALESCE(capacity, ?),
        enrolled = COALESCE(enrolled, ?),
        next_session_at = COALESCE(next_session_at, ?),
        schedule_text = COALESCE(schedule_text, ?)
    WHERE id = ?
  `)
  for (const course of seedCourses) {
    updateSeedCourseMeta.run(course.instructor || null, course.capacity || null, course.enrolled || 0, course.nextSessionAt || null, course.scheduleText || null, course.id)
  }

  const projectCount = db.prepare('SELECT COUNT(*) AS count FROM projects').get() as { count: number }
  if (!projectCount.count) {
    const insertProject = db.prepare(`
      INSERT INTO projects (id, title, description, category, embed_url, offline_embed_url, scratch_id, student_name, student_age, cover_image, status, created_at, updated_at, likes, featured, profile_bio, profile_avatar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const project of seedProjects) {
      insertProject.run(
        project.id,
        project.title,
        project.description,
        project.category,
        project.embedUrl,
        project.offlineEmbedUrl || null,
        project.scratchId || null,
        project.studentName,
        project.studentAge,
        project.coverImage,
        project.status,
        project.createdAt,
        now(),
        project.likes,
        project.featured ? 1 : 0,
        project.profileBio || null,
        project.profileAvatar || null,
      )
    }
  }
  const updateSeedProjectMeta = db.prepare(`
    UPDATE projects
    SET featured = ?,
        profile_bio = COALESCE(profile_bio, ?),
        profile_avatar = COALESCE(profile_avatar, ?)
    WHERE id = ?
  `)
  for (const project of seedProjects) {
    updateSeedProjectMeta.run(project.featured ? 1 : 0, project.profileBio || null, project.profileAvatar || null, project.id)
  }
  db.prepare("UPDATE projects SET profile_avatar = '/assets/service-ai-robot.webp' WHERE profile_avatar = '/assets/service-ai-robot.png'").run()
}

seedDatabase()
mountPlatformRoutes(app, db)
mountLearningRoutes(app, db)

const ipHits = new Map<string, number[]>()
const authHits = new Map<string, number[]>()

function authRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || 'unknown'
  const cutoff = Date.now() - 15 * 60_000
  const hits = (authHits.get(key) || []).filter((stamp) => stamp > cutoff)
  if (hits.length >= 20) {
    res.status(429).json({ error: 'تلاش‌های ورود بیش از حد مجاز است؛ چند دقیقه بعد دوباره امتحان کنید.' })
    return
  }
  hits.push(Date.now())
  authHits.set(key, hits)
  next()
}

function consultationRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || 'unknown'
  const cutoff = Date.now() - 60_000
  const hits = (ipHits.get(key) || []).filter((stamp) => stamp > cutoff)
  if (hits.length >= 5) {
    res.status(429).json({ error: 'تعداد درخواست‌ها زیاد است. لطفاً یک دقیقه دیگر دوباره تلاش کنید.' })
    return
  }
  hits.push(Date.now())
  ipHits.set(key, hits)
  next()
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, storage: 'sqlite' })
})

const downloadableScratchFiles: Record<string, string> = {
  'scratch-windows.exe': 'scratch-windows.exe',
  'scratch-android.apk': 'scratch-android.apk',
}

app.get('/downloads/:filename', (req, res) => {
  const storageName = downloadableScratchFiles[String(req.params.filename)]
  if (!storageName) return res.status(404).json({ error: 'فایل دانلود پیدا نشد.' })
  const filePath = path.join(downloadDir, storageName)
  if (!fs.existsSync(filePath)) return res.status(503).json({ error: 'فایل دانلود هنوز روی سرور قرار نگرفته است.' })
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.download(filePath, storageName)
})

app.post('/api/admin/login', authRateLimit, (req, res) => {
  const username = cleanText(req.body.username, 120)
  const password = cleanText(req.body.password, 200)
  if (username !== adminUsername || !password || password !== adminPassword) {
    res.status(401).json({ error: 'نام کاربری یا رمز مدیر اشتباه است.' })
    return
  }
  res.json({ success: true, token: createAdminToken(), expiresInMs: sessionDurationMs, user: { id: 'admin', name: 'مدیر اسکیل آپ', phone: 'admin', role: 'admin' } })
})

app.post('/api/auth/register', authRateLimit, (req, res) => {
  const name = cleanText(req.body.name, 120)
  const phone = normalizeDigits(req.body.phone)
  const password = cleanText(req.body.password, 200)

  if (!name || name.length < 2) {
    res.status(400).json({ error: 'نام هنرجو را کامل وارد کنید.' })
    return
  }
  if (!/^09\d{9}$/.test(phone)) {
    res.status(400).json({ error: 'شماره موبایل معتبر نیست.' })
    return
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' })
    return
  }

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)
  if (existing) {
    res.status(409).json({ error: 'با این شماره قبلا ثبت‌نام انجام شده است.' })
    return
  }

  const user = {
    id: id('user'),
    name,
    phone,
    role: 'student' as const,
  }
  db.prepare(`
    INSERT INTO users (id, name, phone, password_hash, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'student', ?, ?)
  `).run(user.id, user.name, user.phone, hashPassword(password), now(), now())
  ensureStudent(user.name)
  res.status(201).json({ success: true, user, token: createSessionToken(user) })
})

app.post('/api/auth/login', authRateLimit, (req, res) => {
  const phone = normalizeDigits(req.body.phone)
  const password = cleanText(req.body.password, 200)
  const mode = cleanText(req.body.mode, 20)

  if (mode === 'admin' || cleanText(req.body.username, 120) === adminUsername) {
    const username = cleanText(req.body.username, 120)
    if (username !== adminUsername || !password || password !== adminPassword) {
      res.status(401).json({ error: 'نام کاربری یا رمز مدیر اشتباه است.' })
      return
    }
    res.json({
      success: true,
      token: createAdminToken(),
      user: { id: 'admin', name: 'مدیر اسکیل آپ', phone: 'admin', role: 'admin' },
    })
    return
  }

  if (!/^09\d{9}$/.test(phone) || !password) {
    res.status(400).json({ error: 'شماره موبایل و رمز عبور را وارد کنید.' })
    return
  }

  const row = db.prepare('SELECT * FROM users WHERE phone = ? LIMIT 1').get(phone) as any
  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: 'شماره موبایل یا رمز عبور اشتباه است.' })
    return
  }

  ensureStudent(row.name)
  res.json({
    success: true,
    token: createSessionToken({ id: row.id, name: row.name, phone: row.phone, role: row.role }),
    user: { id: row.id, name: row.name, phone: row.phone, role: row.role },
  })
})

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ ok: true, role: 'admin' })
})

app.post('/api/consultation', consultationRateLimit, (req, res) => {
  const phone = normalizeDigits(req.body.phone)
  const childName = cleanText(req.body.childName, 120)
  const notes = cleanText(req.body.notes, 1600)

  if (!/^09\d{9}$/.test(phone)) {
    res.status(400).json({ error: 'شماره موبایل معتبر نیست. شماره باید با 09 شروع شود و ۱۱ رقم باشد.' })
    return
  }

  const duplicateCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const duplicate = db.prepare('SELECT id FROM consultations WHERE phone = ? AND created_at > ? LIMIT 1').get(phone, duplicateCutoff)
  if (duplicate) {
    res.status(409).json({ error: 'برای این شماره در دو ساعت گذشته درخواست ثبت شده است. مشاوران Skill Up با شما تماس می‌گیرند.' })
    return
  }

  const client = getClientInfo(req)
  const newConsultation = {
    id: id('consult'),
    phone,
    childName,
    ip: client.ip,
    device: client.device,
    browser: client.browser,
    createdAt: now(),
    status: 'pending' as ConsultationStatus,
    notes,
  }

  db.prepare(`
    INSERT INTO consultations (id, phone, child_name, ip, device, browser, created_at, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newConsultation.id,
    newConsultation.phone,
    newConsultation.childName || null,
    newConsultation.ip,
    newConsultation.device,
    newConsultation.browser,
    newConsultation.createdAt,
    newConsultation.status,
    newConsultation.notes || null,
  )

  res.status(201).json({ success: true, message: 'درخواست مشاوره ثبت شد.', consultation: newConsultation })
})

app.get('/api/consultation', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT id, phone, child_name AS childName, ip, device, browser, created_at AS createdAt, status, notes
    FROM consultations
    ORDER BY created_at DESC
  `).all()
  res.json(rows)
})

app.patch('/api/consultation/:id', requireAdmin, (req, res) => {
  const status = cleanText(req.body.status) as ConsultationStatus
  const notes = cleanText(req.body.notes, 1600)
  if (status && !['pending', 'contacted', 'canceled'].includes(status)) {
    res.status(400).json({ error: 'وضعیت درخواست معتبر نیست.' })
    return
  }

  const existing = db.prepare('SELECT id FROM consultations WHERE id = ?').get(req.params.id)
  if (!existing) {
    res.status(404).json({ error: 'درخواست پیدا نشد.' })
    return
  }

  db.prepare('UPDATE consultations SET status = COALESCE(?, status), notes = COALESCE(?, notes) WHERE id = ?').run(status || null, notes || null, req.params.id)
  const updated = db.prepare(`
    SELECT id, phone, child_name AS childName, ip, device, browser, created_at AS createdAt, status, notes
    FROM consultations WHERE id = ?
  `).get(req.params.id)
  res.json(updated)
})

app.get('/api/courses', (req, res) => {
  const rows = db.prepare('SELECT * FROM courses WHERE is_active = 1 ORDER BY created_at ASC').all()
  res.json(rows.map(courseFromRow))
})

app.post('/api/courses', requireAdmin, (req, res) => {
  const title = cleanText(req.body.title, 180)
  const price = cleanText(req.body.price, 80)
  if (!title || !price) {
    res.status(400).json({ error: 'عنوان و قیمت دوره الزامی است.' })
    return
  }

  const course: Course = {
    id: id('course'),
    title,
    description: cleanText(req.body.description, 1600) || 'توضیحات دوره Skill Up',
    level: cleanText(req.body.level, 80) || 'مسیر آموزشی',
    price,
    duration: cleanText(req.body.duration, 80) || '۸ جلسه',
    coverImage: cleanText(req.body.coverImage, 500) || '/assets/project-soltan-pist.png',
    onlineMeetingLink: cleanText(req.body.onlineMeetingLink, 500) || 'https://ble.ir/join/CjSBy9mEQc',
    offlineVideos: Array.isArray(req.body.offlineVideos) ? req.body.offlineVideos : [],
    instructor: cleanText(req.body.instructor, 120) || undefined,
    capacity: Number(req.body.capacity || 0) || undefined,
    enrolled: Number(req.body.enrolled || 0) || 0,
    nextSessionAt: cleanText(req.body.nextSessionAt, 120) || undefined,
    scheduleText: cleanText(req.body.scheduleText, 200) || undefined,
    isActive: true,
    faqs: Array.isArray(req.body.faqs) ? req.body.faqs.map((item: any) => ({ question: cleanText(item?.question, 240), answer: cleanText(item?.answer, 1200) })).filter((item: any) => item.question && item.answer).slice(0, 30) : [],
  }

  db.prepare(`
    INSERT INTO courses (id, title, description, level, price, duration, cover_image, online_meeting_link, offline_videos, instructor, capacity, enrolled, next_session_at, schedule_text, faq_json, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(course.id, course.title, course.description, course.level, course.price, course.duration, course.coverImage, course.onlineMeetingLink, JSON.stringify(course.offlineVideos), course.instructor || null, course.capacity || null, course.enrolled || 0, course.nextSessionAt || null, course.scheduleText || null, JSON.stringify(course.faqs || []), now(), now())

  res.status(201).json(course)
})

app.patch('/api/courses/:id', requireAdmin, (req, res) => {
  const current = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id)
  if (!current) {
    res.status(404).json({ error: 'دوره پیدا نشد.' })
    return
  }
  const existing = courseFromRow(current)
  const nextCourse: Course = {
    ...existing,
    ...req.body,
    offlineVideos: Array.isArray(req.body.offlineVideos) ? req.body.offlineVideos : existing.offlineVideos,
    faqs: Array.isArray(req.body.faqs) ? req.body.faqs.map((item: any) => ({ question: cleanText(item?.question, 240), answer: cleanText(item?.answer, 1200) })).filter((item: any) => item.question && item.answer).slice(0, 30) : existing.faqs,
  }
  db.prepare(`
    UPDATE courses
    SET title = ?, description = ?, level = ?, price = ?, duration = ?, cover_image = ?, online_meeting_link = ?, offline_videos = ?, instructor = ?, capacity = ?, enrolled = ?, next_session_at = ?, schedule_text = ?, faq_json = ?, is_active = ?, updated_at = ?
    WHERE id = ?
  `).run(nextCourse.title, nextCourse.description, nextCourse.level, nextCourse.price, nextCourse.duration, nextCourse.coverImage, nextCourse.onlineMeetingLink, JSON.stringify(nextCourse.offlineVideos), nextCourse.instructor || null, nextCourse.capacity || null, nextCourse.enrolled || 0, nextCourse.nextSessionAt || null, nextCourse.scheduleText || null, JSON.stringify(nextCourse.faqs || []), nextCourse.isActive === false ? 0 : 1, now(), req.params.id)
  res.json(nextCourse)
})

app.delete('/api/courses/:id', requireAdmin, (req, res) => {
  db.prepare('UPDATE courses SET is_active = 0, updated_at = ? WHERE id = ?').run(now(), req.params.id)
  res.json({ success: true })
})

app.get('/api/projects', (req, res) => {
  const includeAll = req.query.all === '1'
  const studentName = cleanText(req.query.studentName, 120)
  if (studentName) {
    const rows = db.prepare('SELECT * FROM projects WHERE student_name = ? ORDER BY created_at DESC').all(studentName)
    res.json(rows.map(projectFromRow))
    return
  }
  if (includeAll && !isAdminRequest(req)) {
    rejectAdminRequired(res)
    return
  }
  const rows = includeAll
    ? db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all()
    : db.prepare("SELECT * FROM projects WHERE status = 'approved' ORDER BY featured DESC, likes DESC, created_at DESC").all()
  res.json(rows.map(projectFromRow))
})

app.post('/api/projects', (req, res) => {
  const title = cleanText(req.body.title, 180)
  const studentName = cleanText(req.body.studentName, 120)
  const category = cleanText(req.body.category) as StudentProject['category']
  if (!title || !studentName || !['AI', 'Game', 'Communication'].includes(category)) {
    res.status(400).json({ error: 'عنوان، نام هنرجو و حوزه پروژه الزامی است.' })
    return
  }

  const scratchId = normalizeDigits(req.body.scratchId)
  const embedUrl = cleanText(req.body.embedUrl, 500) || (scratchId ? `https://scratch.mit.edu/projects/${scratchId}/embed` : '')
  const status = (cleanText(req.body.status) as ProjectStatus) || 'pending'
  const project: StudentProject = {
    id: id('project'),
    title,
    description: cleanText(req.body.description, 1600) || 'پروژه جدید هنرجوی Skill Up',
    category,
    embedUrl,
    offlineEmbedUrl: cleanText(req.body.offlineEmbedUrl, 500) || undefined,
    scratchId: scratchId || undefined,
    studentName,
    studentAge: Number(req.body.studentAge || 14),
    coverImage: cleanText(req.body.coverImage, 500) || '/assets/project-soltan-pist.png',
    status: ['approved', 'pending', 'rejected'].includes(status) ? status : 'pending',
    createdAt: now(),
    likes: 0,
    featured: false,
    profileBio: cleanText(req.body.profileBio, 500) || undefined,
    profileAvatar: cleanText(req.body.profileAvatar, 500) || undefined,
  }

  db.prepare(`
    INSERT INTO projects (id, title, description, category, embed_url, offline_embed_url, scratch_id, student_name, student_age, cover_image, status, created_at, updated_at, likes, featured, profile_bio, profile_avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(project.id, project.title, project.description, project.category, project.embedUrl, project.offlineEmbedUrl || null, project.scratchId || null, project.studentName, project.studentAge, project.coverImage, project.status, project.createdAt, now(), project.featured ? 1 : 0, project.profileBio || null, project.profileAvatar || null)

  awardXp(project.studentName, 'submit_project', project.id)
  res.status(201).json(project)
})

app.patch('/api/projects/:id', (req, res) => {
  const requestedStatus = cleanText(req.body.status) as ProjectStatus
  const adminOnlyChange = ['approved', 'rejected'].includes(requestedStatus) || req.body.featured !== undefined
  if (adminOnlyChange && !isAdminRequest(req)) {
    rejectAdminRequired(res)
    return
  }
  const current = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!current) {
    res.status(404).json({ error: 'پروژه پیدا نشد.' })
    return
  }
  const existing = projectFromRow(current)
  const nextProject = { ...existing, ...req.body }
  db.prepare(`
    UPDATE projects
    SET title = ?, description = ?, category = ?, embed_url = ?, offline_embed_url = ?, scratch_id = ?, student_name = ?, student_age = ?, cover_image = ?, status = ?, featured = ?, profile_bio = ?, profile_avatar = ?, updated_at = ?
    WHERE id = ?
  `).run(nextProject.title, nextProject.description, nextProject.category, nextProject.embedUrl || '', nextProject.offlineEmbedUrl || null, nextProject.scratchId || null, nextProject.studentName, Number(nextProject.studentAge), nextProject.coverImage, nextProject.status, nextProject.featured ? 1 : 0, nextProject.profileBio || null, nextProject.profileAvatar || null, now(), req.params.id)
  res.json(nextProject)
})

app.post('/api/projects/:id/like', (req, res) => {
  db.prepare('UPDATE projects SET likes = likes + 1, updated_at = ? WHERE id = ?').run(now(), req.params.id)
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!row) {
    res.status(404).json({ error: 'پروژه پیدا نشد.' })
    return
  }
  res.json(projectFromRow(row))
})

app.delete('/api/projects/:id', (req, res) => {
  const existing = db.prepare('SELECT student_name FROM projects WHERE id = ?').get(req.params.id) as { student_name: string } | undefined
  if (!existing) {
    res.status(404).json({ error: 'پروژه پیدا نشد.' })
    return
  }
  const studentName = cleanText(req.query.studentName, 120)
  if (!isAdminRequest(req) && studentName !== existing.student_name) {
    rejectAdminRequired(res)
    return
  }
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

function levelForXp(xp: number) {
  if (xp >= 800) return 5
  if (xp >= 450) return 4
  if (xp >= 220) return 3
  if (xp >= 90) return 2
  return 1
}

function ensureStudent(studentName: string) {
  const name = cleanText(studentName, 120) || 'نوجوان خلاق اسکیل آپ'
  let row = db.prepare('SELECT * FROM students WHERE student_name = ?').get(name) as any
  if (!row) {
    db.prepare(`
      INSERT INTO students (student_name, xp, level, completed_videos, completed_quizzes, unlocked_rewards, purchased_courses, updated_at)
      VALUES (?, 120, 2, ?, ?, ?, ?, ?)
    `).run(name, JSON.stringify(['sj-1']), JSON.stringify([]), JSON.stringify([]), JSON.stringify(['scratch-junior']), now())
    row = db.prepare('SELECT * FROM students WHERE student_name = ?').get(name)
  }
  return row
}

function studentFromRow(row: any) {
  return {
    studentName: row.student_name,
    xp: row.xp,
    level: row.level,
    completedVideos: parseJson<string[]>(row.completed_videos, []),
    completedQuizzes: parseJson<string[]>(row.completed_quizzes, []),
    unlockedRewards: parseJson<string[]>(row.unlocked_rewards, []),
    purchasedCourses: parseJson<string[]>(row.purchased_courses, []),
  }
}

function saveStudent(profile: ReturnType<typeof studentFromRow>) {
  db.prepare(`
    UPDATE students
    SET xp = ?, level = ?, completed_videos = ?, completed_quizzes = ?, unlocked_rewards = ?, purchased_courses = ?, updated_at = ?
    WHERE student_name = ?
  `).run(profile.xp, profile.level, JSON.stringify(profile.completedVideos), JSON.stringify(profile.completedQuizzes), JSON.stringify(profile.unlockedRewards), JSON.stringify(profile.purchasedCourses), now(), profile.studentName)
}

function awardXp(studentName: string, actionType: string, targetId: string) {
  const profile = studentFromRow(ensureStudent(studentName))
  let xpAwarded = 0
  if (actionType === 'watch_video' && !profile.completedVideos.includes(targetId)) {
    profile.completedVideos.push(targetId)
    xpAwarded = 15
  }
  if (actionType === 'pass_quiz' && !profile.completedQuizzes.includes(targetId)) {
    profile.completedQuizzes.push(targetId)
    xpAwarded = 50
  }
  if (actionType === 'submit_project') xpAwarded = 100
  if (actionType === 'purchase_course' && !profile.purchasedCourses.includes(targetId)) {
    profile.purchasedCourses.push(targetId)
    xpAwarded = 30
  }
  if (xpAwarded > 0) {
    profile.xp += xpAwarded
    profile.level = levelForXp(profile.xp)
    saveStudent(profile)
  }
  return { profile, xpAwarded }
}

app.get('/api/student-profile', (req, res) => {
  res.json(studentFromRow(ensureStudent(String(req.query.name || ''))))
})

app.post('/api/student-profile/action', (req, res) => {
  const studentName = cleanText(req.body.studentName, 120)
  const actionType = cleanText(req.body.actionType, 80)
  const targetId = cleanText(req.body.targetId, 120)
  if (!studentName || !actionType || !targetId) {
    res.status(400).json({ error: 'اطلاعات فعالیت کامل نیست.' })
    return
  }
  const result = awardXp(studentName, actionType, targetId)
  res.json({ success: true, ...result })
})

app.post('/api/student-profile/unlock-reward', (req, res) => {
  const studentName = cleanText(req.body.studentName, 120)
  const rewardId = cleanText(req.body.rewardId, 120)
  if (!studentName || !rewardId) {
    res.status(400).json({ error: 'نام هنرجو و شناسه پاداش الزامی است.' })
    return
  }

  const costByReward: Record<string, number> = {
    'discount-15': 150,
    'discount-30': 320,
    'exclusive-ai': 500,
    'golden-theme': 700,
  }

  const profile = studentFromRow(ensureStudent(studentName))
  const cost = costByReward[rewardId] ?? 200
  if (profile.unlockedRewards.includes(rewardId)) {
    res.json({ success: true, profile })
    return
  }
  if (profile.xp < cost) {
    res.status(400).json({ error: 'امتیاز کافی برای فعال‌سازی این پاداش ندارید.' })
    return
  }

  profile.xp -= cost
  profile.level = levelForXp(profile.xp)
  profile.unlockedRewards.push(rewardId)
  saveStudent(profile)
  res.json({ success: true, profile })
})

app.get('/api/payments', (req, res) => {
  const studentName = cleanText(req.query.studentName, 120)
  if (!studentName && !isAdminRequest(req)) {
    rejectAdminRequired(res)
    return
  }
  const rows = studentName
    ? db.prepare('SELECT * FROM payment_requests WHERE student_name = ? ORDER BY created_at DESC').all(studentName)
    : db.prepare('SELECT * FROM payment_requests ORDER BY created_at DESC').all()
  res.json(rows.map(paymentFromRow))
})

app.post('/api/purchases', (req, res) => {
  const studentName = cleanText(req.body.studentName, 120) || 'نوجوان خلاق اسکیل آپ'
  const phone = normalizeDigits(req.body.phone)
  const courseId = cleanText(req.body.courseId, 120)
  const receiptNumber = cleanText(req.body.receiptNumber, 120)
  const cardLastFour = normalizeDigits(req.body.cardLastFour).slice(-4)
  const payerName = cleanText(req.body.payerName, 120)
  const notes = cleanText(req.body.notes, 800)
  const course = db.prepare('SELECT * FROM courses WHERE id = ? AND is_active = 1').get(courseId) as any
  if (!course) {
    res.status(404).json({ error: 'دوره پیدا نشد.' })
    return
  }
  if (!/^09\d{9}$/.test(phone)) {
    res.status(400).json({ error: 'شماره موبایل معتبر نیست.' })
    return
  }
  if (!receiptNumber || receiptNumber.length < 4) {
    res.status(400).json({ error: 'شماره فیش یا کد پیگیری واریز را وارد کنید.' })
    return
  }

  const duplicate = db.prepare(`
    SELECT * FROM payment_requests
    WHERE student_name = ? AND course_id = ? AND status = 'pending'
    LIMIT 1
  `).get(studentName, courseId) as any
  if (duplicate) {
    res.status(409).json({ error: 'برای این دوره یک فیش در انتظار تایید دارید.', payment: paymentFromRow(duplicate) })
    return
  }

  const payment: PaymentRequest = {
    id: id('payment'),
    studentName,
    phone,
    courseId,
    courseTitle: course.title,
    amount: course.price,
    receiptNumber,
    cardLastFour: cardLastFour || undefined,
    payerName: payerName || undefined,
    notes: notes || undefined,
    status: 'pending',
    createdAt: now(),
    updatedAt: now(),
  }

  db.prepare(`
    INSERT INTO payment_requests (id, student_name, phone, course_id, course_title, amount, receipt_number, card_last_four, payer_name, notes, status, admin_notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)
  `).run(payment.id, payment.studentName, payment.phone, payment.courseId, payment.courseTitle, payment.amount, payment.receiptNumber, payment.cardLastFour || null, payment.payerName || null, payment.notes || null, payment.createdAt, payment.updatedAt)

  res.status(201).json({ success: true, payment })
})

app.patch('/api/payments/:id', requireAdmin, (req, res) => {
  const status = cleanText(req.body.status, 40) as PaymentStatus
  const adminNotes = cleanText(req.body.adminNotes, 800)
  if (!['approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'وضعیت پرداخت معتبر نیست.' })
    return
  }

  const current = db.prepare('SELECT * FROM payment_requests WHERE id = ?').get(req.params.id) as any
  if (!current) {
    res.status(404).json({ error: 'درخواست پرداخت پیدا نشد.' })
    return
  }

  db.prepare('UPDATE payment_requests SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?').run(status, adminNotes || null, now(), req.params.id)

  let activation = null
  if (status === 'approved') {
    activation = awardXp(current.student_name, 'purchase_course', current.course_id)
    db.prepare('UPDATE courses SET enrolled = COALESCE(enrolled, 0) + 1, updated_at = ? WHERE id = ?').run(now(), current.course_id)
  }

  const updated = db.prepare('SELECT * FROM payment_requests WHERE id = ?').get(req.params.id)
  res.json({ success: true, payment: paymentFromRow(updated), activation })
})

app.get('/api/certificates', (req, res) => {
  const studentName = cleanText(req.query.studentName, 120)
  if (!studentName) {
    res.json(db.prepare('SELECT id, student_name AS studentName, course_id AS courseId, course_title AS courseTitle, issued_at AS issuedAt, verification_code AS verificationCode FROM certificates ORDER BY issued_at DESC').all())
    return
  }
  res.json(db.prepare('SELECT id, student_name AS studentName, course_id AS courseId, course_title AS courseTitle, issued_at AS issuedAt, verification_code AS verificationCode FROM certificates WHERE student_name = ? ORDER BY issued_at DESC').all(studentName))
})

app.post('/api/certificates/issue', (req, res) => {
  const studentName = cleanText(req.body.studentName, 120)
  const courseId = cleanText(req.body.courseId, 120)
  const courseTitle = cleanText(req.body.courseTitle, 180)
  if (!studentName || !courseId || !courseTitle) {
    res.status(400).json({ error: 'نام هنرجو، شناسه دوره و عنوان دوره الزامی است.' })
    return
  }
  const existing = db.prepare('SELECT id, student_name AS studentName, course_id AS courseId, course_title AS courseTitle, issued_at AS issuedAt, verification_code AS verificationCode FROM certificates WHERE student_name = ? AND course_id = ?').get(studentName, courseId)
  if (existing) {
    res.json(existing)
    return
  }
  const certificate = {
    id: id('cert'),
    studentName,
    courseId,
    courseTitle,
    issuedAt: new Date().toLocaleDateString('fa-IR'),
    verificationCode: `SU-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
  }
  db.prepare('INSERT INTO certificates (id, student_name, course_id, course_title, issued_at, verification_code) VALUES (?, ?, ?, ?, ?, ?)').run(certificate.id, certificate.studentName, certificate.courseId, certificate.courseTitle, certificate.issuedAt, certificate.verificationCode)
  res.status(201).json(certificate)
})

app.get('/sitemap.xml', (_req, res) => {
  const xml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character] || character)
  const courses = db.prepare('SELECT id, updated_at FROM courses WHERE is_active = 1 ORDER BY created_at').all() as Array<{ id: string; updated_at: string }>
  const fixed = [
    { loc: 'https://skill-up.ir/', priority: '1.0', changefreq: 'weekly' },
    { loc: 'https://skill-up.ir/courses', priority: '0.9', changefreq: 'weekly' },
    { loc: 'https://skill-up.ir/projects', priority: '0.8', changefreq: 'weekly' },
    { loc: 'https://skill-up.ir/signup', priority: '0.9', changefreq: 'monthly' },
    { loc: 'https://skill-up.ir' + lessonPath, priority: '0.8', changefreq: 'monthly' },
    { loc: 'https://skill-up.ir/magazine', priority: '0.8', changefreq: 'weekly' },
    { loc: 'https://skill-up.ir/magazine/download-scratch', priority: '0.9', changefreq: 'monthly' },
  ]
  const urls = [
    ...fixed.map((item) => `<url><loc>${xml(item.loc)}</loc><changefreq>${item.changefreq}</changefreq><priority>${item.priority}</priority></url>`),
    ...magazineArticles.map((article) => `<url><loc>${xml(`https://skill-up.ir/magazine/${article.slug}`)}</loc><lastmod>${article.isoDate}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`),
    ...courses.map((course) => `<url><loc>${xml(`https://skill-up.ir/courses/${encodeURIComponent(course.id)}`)}</loc><lastmod>${xml(course.updated_at.slice(0, 10))}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`),
  ]
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`)
})

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('[SkillUp API]', err)
  res.status(500).json({ error: 'خطای داخلی سرور رخ داد.' })
})

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.join(rootDir, 'dist')
    const indexTemplate = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8')
    const escapeAttribute = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character)
    const analyticsHead = gaMeasurementId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}"></script>\n    <script defer src="/analytics.js"></script>` : ''
    const renderPage = (page: { title: string; description: string; canonical: string; image?: string; type?: string; robots?: string; schema?: unknown }) => {
      const image = page.image || 'https://skill-up.ir/assets/brand/skillup-og.png'
      const extra = `${googleSiteVerification ? `<meta name="google-site-verification" content="${googleSiteVerification}" />` : ''}\n    ${page.schema ? `<script type="application/ld+json">${JSON.stringify(page.schema).replace(/</g, '\\u003c')}</script>` : ''}\n    ${analyticsHead}`
      return indexTemplate
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttribute(page.title)}</title>`)
        .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeAttribute(page.description)}" />`)
        .replace(/<meta name="robots"[^>]*>/, `<meta name="robots" content="${escapeAttribute(page.robots || 'index, follow, max-image-preview:large')}" />`)
        .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${escapeAttribute(page.canonical)}" />`)
        .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeAttribute(page.title)}" />`)
        .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeAttribute(page.description)}" />`)
        .replace(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="${escapeAttribute(page.type || 'website')}" />`)
        .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escapeAttribute(page.canonical)}" />`)
        .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${escapeAttribute(image)}" />`)
        .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escapeAttribute(page.title)}" />`)
        .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escapeAttribute(page.description)}" />`)
        .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escapeAttribute(image)}" />`)
        .replace('</head>', `    ${extra}\n  </head>`)
    }
    app.use(express.static(distPath, { maxAge: '7d', index: false }))

    const staticPages = [
      { paths: ['/', '/index.html'], title: 'اسکیل آپ | آموزش برنامه‌نویسی و هوش مصنوعی نوجوانان', description: 'آموزش پروژه‌محور برنامه‌نویسی، اسکرچ، هوش مصنوعی و مهارت‌های دیجیتال برای کودکان و نوجوانان همراه با مربی و پروژه واقعی.', canonical: 'https://skill-up.ir/' },
      { paths: ['/courses', '/courses/'], title: 'دوره‌های برنامه‌نویسی کودکان و نوجوانان | اسکیل آپ', description: 'دوره‌های پروژه‌محور اسکرچ، برنامه‌نویسی، هوش مصنوعی و مهارت‌های دیجیتال اسکیل آپ را مقایسه و مسیر مناسب را انتخاب کنید.', canonical: 'https://skill-up.ir/courses', schema: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'دوره‌های آموزشی اسکیل آپ', url: 'https://skill-up.ir/courses', inLanguage: 'fa-IR' } },
      { paths: ['/projects', '/projects/'], title: 'پروژه‌های برنامه‌نویسی نوجوانان | اسکیل آپ', description: 'نمونه پروژه‌های واقعی هنرجویان اسکیل آپ در بازی‌سازی، اسکرچ، هوش مصنوعی و تولید محتوای دیجیتال را ببینید.', canonical: 'https://skill-up.ir/projects', schema: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'پروژه‌های نوجوانان اسکیل آپ', url: 'https://skill-up.ir/projects', inLanguage: 'fa-IR' } },
      { paths: ['/signup', '/signup/'], title: 'ثبت‌نام رایگان دوره مقدماتی اسکرچ | اسکیل آپ', description: 'فرم ثبت‌نام رایگان دوره مقدماتی اسکرچ برای کودکان و نوجوانان؛ اطلاعات را تکمیل کنید تا حساب و دسترسی دوره برایتان فعال شود.', canonical: 'https://skill-up.ir/signup', schema: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'ثبت‌نام رایگان دوره مقدماتی اسکرچ', url: 'https://skill-up.ir/signup', inLanguage: 'fa-IR' } },
      { paths: ['/login', '/login/'], title: 'ورود به اسکیل‌آپ', description: 'ورود به حساب اسکیل‌آپ برای شرکت در گفت‌وگوهای مقاله‌ها.', canonical: 'https://skill-up.ir/login', robots: 'noindex, nofollow' },
      { paths: ['/magazine', '/magazine/'], title: 'مجله اسکیل آپ | آموزش برنامه‌نویسی و مهارت‌های دیجیتال نوجوانان', description: 'مقاله‌ها و راهنماهای کاربردی اسکیل آپ برای آموزش برنامه‌نویسی، اسکرچ، هوش مصنوعی و مهارت‌های دیجیتال کودکان و نوجوانان.', canonical: 'https://skill-up.ir/magazine', schema: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'مجله اسکیل آپ', url: 'https://skill-up.ir/magazine', inLanguage: 'fa-IR' } },
      { paths: ['/dashboard', '/dashboard/'], title: 'پنل هنرجو | اسکیل آپ', description: 'فضای شخصی یادگیری هنرجوی اسکیل آپ.', canonical: 'https://skill-up.ir/dashboard', robots: 'noindex, nofollow' },
      { paths: ['/admin', '/admin/'], title: 'پنل مدیریت | اسکیل آپ', description: 'مدیریت امن پلتفرم اسکیل آپ.', canonical: 'https://skill-up.ir/admin', robots: 'noindex, nofollow' },
    ]
    staticPages.forEach((page) => app.get(page.paths, (_req, res) => res.type('html').send(renderPage(page))))

    app.get(['/magazine/download-scratch', '/magazine/download-scratch/'], (_req, res) => {
      const articleSchema = JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Article',
            headline: 'دانلود اسکرچ برای ویندوز و اندروید + آموزش نصب',
            description: 'دانلود مستقیم اسکرچ، لینک رسمی Google Play و آموزش نصب قدم‌به‌قدم برای کودکان و نوجوانان.',
            inLanguage: 'fa-IR',
            datePublished: '2026-08-27',
            dateModified: '2026-08-27',
            mainEntityOfPage: 'https://skill-up.ir/magazine/download-scratch',
            image: 'https://skill-up.ir/assets/scratch-download-cover.svg',
            author: { '@type': 'Organization', name: 'اسکیل آپ', url: 'https://skill-up.ir/' },
            publisher: { '@type': 'Organization', name: 'اسکیل آپ', url: 'https://skill-up.ir/' },
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'خانه', item: 'https://skill-up.ir/' },
              { '@type': 'ListItem', position: 2, name: 'مجله اسکیل آپ', item: 'https://skill-up.ir/magazine' },
              { '@type': 'ListItem', position: 3, name: 'دانلود اسکرچ', item: 'https://skill-up.ir/magazine/download-scratch' },
            ],
          },
        ],
      }).replace(/</g, '\\u003c')
      res.type('html').send(renderPage({ title: 'دانلود اسکرچ برای ویندوز و اندروید + آموزش نصب | اسکیل آپ', description: 'دانلود مستقیم اسکرچ برای ویندوز و اندروید، لینک رسمی Google Play و آموزش نصب قدم‌به‌قدم برای کودکان و نوجوانان.', canonical: 'https://skill-up.ir/magazine/download-scratch', image: 'https://skill-up.ir/assets/scratch-download-cover.svg', type: 'article', schema: JSON.parse(articleSchema) }))
    })

    app.get(['/magazine/:slug', '/magazine/:slug/'], (req, res, next) => {
      const article = findMagazineArticle(cleanText(req.params.slug, 120))
      if (!article) return next()
      const canonical = `https://skill-up.ir/magazine/${article.slug}`
      const image = article.cover.startsWith('http') ? article.cover : `https://skill-up.ir${article.cover}`
      const schema = { '@context': 'https://schema.org', '@graph': [
        { '@type': 'Article', headline: article.title, description: article.description, inLanguage: 'fa-IR', datePublished: article.isoDate, dateModified: article.isoDate, mainEntityOfPage: canonical, image, author: { '@type': 'Organization', name: 'تیم آموزش اسکیل آپ', url: 'https://skill-up.ir/' }, publisher: { '@id': 'https://skill-up.ir/#organization' } },
        { '@type': 'FAQPage', mainEntity: article.faq.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) },
        { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'خانه', item: 'https://skill-up.ir/' }, { '@type': 'ListItem', position: 2, name: 'مجله', item: 'https://skill-up.ir/magazine' }, { '@type': 'ListItem', position: 3, name: article.title, item: canonical }] },
      ] }
      res.type('html').send(renderPage({ title: `${article.title} | مجله اسکیل آپ`, description: article.description, canonical, image, type: 'article', schema }))
    })

    app.get(['/courses/:id', '/courses/:id/'], (req, res, next) => {
      const course = db.prepare('SELECT id, title, description, cover_image, instructor, level, price FROM courses WHERE id = ? AND is_active = 1').get(cleanText(req.params.id, 120)) as any
      if (!course) return next()
      const canonical = `https://skill-up.ir/courses/${encodeURIComponent(course.id)}`
      const description = cleanText(course.description, 155)
      const image = String(course.cover_image || '').startsWith('http') ? course.cover_image : `https://skill-up.ir${course.cover_image || '/assets/brand/skillup-logo-light.png'}`
      const schema = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Course', name: course.title, description, provider: { '@type': 'Organization', name: 'اسکیل آپ', url: 'https://skill-up.ir/' }, educationalLevel: course.level, image, url: canonical }).replace(/</g, '\\u003c')
      res.type('html').send(renderPage({ title: `${course.title} | اسکیل آپ`, description, canonical, image, schema: JSON.parse(schema) }))
    })
    app.get('*', (_req, res) => {
      res.status(404).type('html').send('<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="robots" content="noindex"><title>صفحه پیدا نشد | اسکیل آپ</title><body style="font-family:sans-serif;text-align:center;padding:4rem"><h1>صفحه پیدا نشد</h1><p><a href="/">بازگشت به اسکیل آپ</a></p></body></html>')
    })
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Skill Up] http://localhost:${PORT}`)
  })
}

startServer()
