import crypto from 'crypto'
import type { Express, Request, Response } from 'express'
import type { DatabaseSync } from 'node:sqlite'
import QRCode from 'qrcode'
import { readSession, requireAdminSession, requireStudent, type SessionUser } from './auth'

const fa = {
  login: 'برای ادامه ابتدا وارد حساب کاربری شوید.',
  forbidden: 'اجازه انجام این عملیات را ندارید.',
  notFound: 'مورد درخواستی پیدا نشد.',
}

const now = () => new Date().toISOString()
const uid = (prefix: string) => `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
const text = (value: unknown, max = 1000) => String(value || '').trim().slice(0, max)
const normalizePhone = (value: unknown) => {
  const persian = '۰۱۲۳۴۵۶۷۸۹'
  const arabic = '٠١٢٣٤٥٦٧٨٩'
  return String(value || '')
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
    .replace(/[\s-]/g, '')
}
const json = <T>(value: string | null | undefined, fallback: T): T => {
  try { return JSON.parse(value || '') as T } catch { return fallback }
}

function hashGeneratedPassword(password: string, salt = crypto.randomBytes(12).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 32).toString('hex')}`
}

const freeRegistrationPassword = '12344321'

function activateFreeScratchCourse(db: DatabaseSync, userId: string, displayName: string) {
  const configuredCourseId = text(process.env.FREE_SCRATCH_COURSE_ID || 'course-1', 120)
  const replacedCourseId = text(process.env.FREE_SCRATCH_REPLACED_COURSE_ID, 120)
  const course = db.prepare('SELECT id, title FROM courses WHERE id = ? AND is_active = 1')
    .get(configuredCourseId) as { id: string; title: string } | undefined
  if (!course) throw new Error(`FREE_SCRATCH_COURSE_ID does not point to an active course: ${configuredCourseId}`)
  const createdAt = now()
  let profile = db.prepare('SELECT purchased_courses FROM student_profiles WHERE user_id = ?').get(userId) as { purchased_courses: string } | undefined
  if (!profile) {
    db.prepare(`INSERT INTO student_profiles
      (user_id, display_name, xp, purchased_courses, is_bot, created_at, updated_at, last_activity_at)
      VALUES (?, ?, 0, '[]', 0, ?, ?, ?)`
    ).run(userId, displayName, createdAt, createdAt, createdAt)
    profile = { purchased_courses: '[]' }
  }
  const purchased = new Set(json<string[]>(profile.purchased_courses, []))
  if (replacedCourseId && replacedCourseId !== course.id) purchased.delete(replacedCourseId)
  purchased.add(course.id)
  db.prepare('UPDATE student_profiles SET purchased_courses = ?, updated_at = ? WHERE user_id = ?')
    .run(JSON.stringify([...purchased]), createdAt, userId)
  return course
}

function freeRegistrationDto(row: any) {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    age: Number(row.age),
    province: row.province,
    educationGrade: row.education_grade,
    relation: row.relation,
    bannerShared: Boolean(row.banner_shared),
    programmingExperience: row.programming_experience,
    status: row.status,
    userId: row.user_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!columns.some((item) => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

export function levelForXp(xp: number) {
  let level = 1
  let remaining = Math.max(0, Math.floor(xp))
  while (remaining >= 20 + level * 5) {
    remaining -= 20 + level * 5
    level += 1
  }
  return level
}

function levelProgress(xp: number) {
  const level = levelForXp(xp)
  let floor = 0
  for (let current = 1; current < level; current += 1) floor += 20 + current * 5
  const needed = 20 + level * 5
  return { level, levelXp: xp - floor, nextLevelXp: needed, progress: Math.min(100, Math.round(((xp - floor) / needed) * 100)) }
}

function tier(level: number) {
  if (level >= 31) return 'Skill Master'
  if (level >= 11) return 'Skiller'
  return 'Starter'
}

function tehranDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function weekStart(date = new Date()) {
  const local = new Date(`${tehranDay(date)}T12:00:00Z`)
  const sinceSaturday = (local.getUTCDay() + 1) % 7
  local.setUTCDate(local.getUTCDate() - sinceSaturday)
  return local.toISOString().slice(0, 10)
}

function learningBand(level: number) {
  if (level >= 31) return 'master'
  if (level >= 11) return 'skiller'
  return 'starter'
}

function session(req: Request) {
  return readSession(req) as SessionUser | null
}

function profileRow(db: DatabaseSync, user: SessionUser) {
  let row = db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(user.id) as any
  if (!row) {
    db.prepare(`INSERT INTO student_profiles
      (user_id, display_name, xp, purchased_courses, is_bot, public_label, created_at, updated_at, last_activity_at)
      VALUES (?, ?, 0, '[]', 0, NULL, ?, ?, ?)`
    ).run(user.id, user.name, now(), now(), now())
    row = db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(user.id)
  }
  return row
}

function publicProfile(row: any) {
  const progress = levelProgress(Number(row.xp || 0))
  const learningLevel = Number(row.assigned_level || progress.level)
  return {
    userId: row.user_id,
    studentName: row.display_name,
    xp: Number(row.xp || 0),
    ...progress,
    level: learningLevel,
    tier: tier(learningLevel),
    avatar: row.avatar || '🧑‍🚀',
    purchasedCourses: json<string[]>(row.purchased_courses, []),
    isBot: Boolean(row.is_bot),
    publicLabel: row.public_label || undefined,
    lastActivityAt: row.last_activity_at,
  }
}

function dailyMission(db: DatabaseSync, auth: SessionUser) {
  const profile = publicProfile(profileRow(db, auth))
  const band = learningBand(profile.level)
  const purchased = profile.purchasedCourses as string[]
  let rows: any[] = []
  if (purchased.length) {
    const placeholders = purchased.map(() => '?').join(',')
    rows = db.prepare(`SELECT q.*, c.title AS course_title FROM question_bank q
      LEFT JOIN courses c ON c.id = q.course_id
      WHERE q.level_band = ? AND q.is_active = 1 AND q.course_id IN (${placeholders})
      ORDER BY q.sort_order, q.id`).all(band, ...purchased) as any[]
    if (!rows.length) rows = db.prepare(`SELECT q.*, NULL AS course_title FROM question_bank q
      WHERE q.level_band = ? AND q.is_active = 1 AND q.course_id IS NULL ORDER BY q.sort_order, q.id`).all(band) as any[]
  }
  if (!rows.length) return { day: tehranDay(), profile, mission: null }
  const day = tehranDay()
  const dayNumber = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000)
  const userSeed = crypto.createHash('sha256').update(auth.id).digest().readUInt32BE(0)
  const mission = rows[(dayNumber + userSeed) % rows.length]
  return { day, profile, mission }
}

function awardXp(db: DatabaseSync, userId: string, delta: number, eventType: string, referenceId: string, reason = '', source = 'system') {
  const safeDelta = Math.max(-10000, Math.min(10000, Math.floor(delta)))
  if (!safeDelta) return { awarded: 0 }
  const result = db.prepare(`INSERT OR IGNORE INTO xp_ledger
    (id, user_id, delta, event_type, reference_id, reason, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(uid('xp'), userId, safeDelta, eventType, referenceId, reason, source, now())
  if (!result.changes) return { awarded: 0 }
  db.prepare('UPDATE student_profiles SET xp = MAX(0, xp + ?), updated_at = ?, last_activity_at = ? WHERE user_id = ?')
    .run(safeDelta, now(), now(), userId)
  return { awarded: safeDelta }
}

function generateNotifications(db: DatabaseSync, userId: string) {
  const profile = db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(userId) as any
  if (!profile) return
  const add = (key: string, type: string, title: string, body: string) => db.prepare(`INSERT OR IGNORE INTO notifications
    (id, user_id, unique_key, type, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(uid('notice'), userId, key, type, title, body, now())
  const inactiveCutoff = Date.now() - 3 * 24 * 60 * 60 * 1000
  if (new Date(profile.last_activity_at).getTime() < inactiveCutoff) {
    add(`inactive:${tehranDay()}`, 'inactivity', 'دلتنگت شدیم!', 'سه روز از آخرین فعالیتت گذشته؛ با یک قدم کوچک به مسیر یادگیری برگرد.')
  }
  const incomplete = db.prepare(`SELECT course_id, video_id FROM video_progress
    WHERE user_id = ? AND watched_percent > 0 AND watched_percent < 75 AND updated_at < ?`).all(userId, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) as any[]
  for (const item of incomplete) add(`video:${item.course_id}:${item.video_id}`, 'incomplete_video', 'ویدئوی نیمه‌تمام', 'یک ویدئوی آموزشی را نیمه‌کاره گذاشتی؛ ادامه‌اش بده تا امتیازش ثبت شود.')
  const incompleteSessions = db.prepare(`SELECT sp.session_id, s.title FROM session_progress sp
    JOIN course_sessions s ON s.id = sp.session_id
    WHERE sp.user_id = ? AND sp.watched_seconds > 0 AND sp.completed_at IS NULL AND sp.updated_at < ?`
  ).all(userId, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) as Array<{ session_id: string; title: string }>
  for (const item of incompleteSessions) add(`session-incomplete:${item.session_id}`, 'incomplete_video', 'یک جلسه نیمه‌تمام مانده', `ویدئوی «${item.title}» را ادامه بده؛ پیشرفتت از همان‌جا ذخیره شده است.`)
  const overdue = db.prepare(`SELECT a.id, a.title FROM project_assignments a
    WHERE a.due_at < ? AND a.course_id IN (SELECT value FROM json_each(?))
    AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.assignment_id = a.id AND p.user_id = ?)`
  ).all(now(), profile.purchased_courses, userId) as any[]
  for (const item of overdue) add(`overdue:${item.id}`, 'overdue_project', 'مهلت پروژه گذشته است', `پروژه «${item.title}» هنوز ارسال نشده؛ اگر نیاز به کمک داری در باشگاه سؤال بپرس.`)
}

function notifyUser(db: DatabaseSync, userId: string, key: string, type: string, title: string, body: string) {
  db.prepare(`INSERT OR IGNORE INTO notifications
    (id, user_id, unique_key, type, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(uid('notice'), userId, key, type, title, body, now())
}

function seedBots(db: DatabaseSync) {
  const bots = ['آراد محمدی', 'یسنا کریمی', 'علی رضایی', 'رها احمدی', 'سامیار حسینی', 'هانا مرادی', 'پارسا اکبری', 'نیکا جعفری']
  const insert = db.prepare(`INSERT OR IGNORE INTO student_profiles
    (user_id, display_name, xp, purchased_courses, is_bot, public_label, created_at, updated_at, last_activity_at)
    VALUES (?, ?, ?, '["course-1"]', 1, 'حساب نمایشی', ?, ?, ?)`)
  bots.forEach((name, index) => insert.run(`demo-${index + 1}`, name, 35 + index * 17, now(), now(), now()))
}

function advanceBots(db: DatabaseSync) {
  const slot = `${tehranDay()}-${Math.floor(new Date().getUTCHours() / 4)}`
  const bots = db.prepare('SELECT user_id FROM student_profiles WHERE is_bot = 1').all() as Array<{ user_id: string }>
  bots.forEach((bot, index) => {
    const digest = crypto.createHash('sha256').update(`${slot}:${bot.user_id}`).digest()
    if (digest[0] % 3 === 0) return
    awardXp(db, bot.user_id, 1 + (digest[1] % 8), 'demo_progress', slot, 'پیشرفت زمان‌بندی‌شده حساب نمایشی', 'simulation')
    db.prepare('INSERT OR IGNORE INTO bot_activity_log (id, user_id, slot_key, activity, xp_delta, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uid('botlog'), bot.user_id, slot, ['مشاهده ویدئو', 'پاسخ روزانه', 'فعالیت باشگاه'][index % 3], 1 + (digest[1] % 8), now())
  })
}

function safeEmbed(url: string) {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return ['scratch.mit.edu', 'www.youtube.com', 'youtube.com', 'www.aparat.com', 'aparat.com'].includes(parsed.hostname) ? parsed.toString() : ''
  } catch { return '' }
}

function courseDto(row: any, includePrivate = false) {
  const videos = includePrivate ? json<any[]>(row.offline_videos, []) : []
  return {
    id: row.id, title: row.title, description: row.description, level: row.level, price: row.price,
    duration: row.duration, coverImage: row.cover_image, instructor: row.instructor || undefined,
    capacity: row.capacity ?? undefined, enrolled: row.enrolled ?? 0, nextSessionAt: row.next_session_at || undefined,
    isActive: Boolean(row.is_active), offlineVideos: videos, sessionCount: Number(row.session_count || videos.length),
    onlineMeetingLink: includePrivate ? row.online_meeting_link : '',
  }
}

function projectDto(row: any, includeAdmin = false) {
  return {
    id: row.id, title: row.title, description: row.description, category: row.category,
    embedUrl: row.embed_url, offlineEmbedUrl: row.offline_embed_url || undefined, scratchId: row.scratch_id || undefined,
    studentName: row.student_name, studentAge: row.student_age, coverImage: row.cover_image,
    status: row.status, createdAt: row.created_at, likes: row.likes, featured: Boolean(row.featured),
    profileBio: row.profile_bio || undefined, profileAvatar: row.profile_avatar || undefined,
    assignmentId: row.assignment_id || undefined, submissionVersion: row.submission_version || 1,
    adminNotes: row.admin_notes || undefined, rubric: json(row.rubric_json, null), scoreAwarded: row.score_awarded || 0,
    ...(includeAdmin ? { userId: row.user_id } : {}),
  }
}

function paymentDto(row: any) {
  return {
    id: row.id, studentName: row.student_name, phone: row.phone, courseId: row.course_id,
    courseTitle: row.course_title, amount: row.amount, receiptNumber: row.receipt_number,
    cardLastFour: row.card_last_four || undefined, payerName: row.payer_name || undefined,
    notes: row.notes || undefined, status: row.status, adminNotes: row.admin_notes || undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export function mountPlatformRoutes(app: Express, db: DatabaseSync) {
  ensureColumn(db, 'projects', 'user_id', 'TEXT')
  ensureColumn(db, 'projects', 'assignment_id', 'TEXT')
  ensureColumn(db, 'projects', 'submission_version', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn(db, 'projects', 'admin_notes', 'TEXT')
  ensureColumn(db, 'projects', 'rubric_json', 'TEXT')
  ensureColumn(db, 'projects', 'score_awarded', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(db, 'payment_requests', 'user_id', 'TEXT')
  ensureColumn(db, 'certificates', 'user_id', 'TEXT')
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_profiles (
      user_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, xp INTEGER NOT NULL DEFAULT 0,
      purchased_courses TEXT NOT NULL DEFAULT '[]', is_bot INTEGER NOT NULL DEFAULT 0,
      public_label TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_activity_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS xp_ledger (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, delta INTEGER NOT NULL, event_type TEXT NOT NULL,
      reference_id TEXT NOT NULL, reason TEXT, source TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(user_id, event_type, reference_id)
    );
    CREATE INDEX IF NOT EXISTS idx_xp_user_created ON xp_ledger(user_id, created_at);
    CREATE TABLE IF NOT EXISTS video_progress (
      user_id TEXT NOT NULL, course_id TEXT NOT NULL, video_id TEXT NOT NULL, watched_percent INTEGER NOT NULL DEFAULT 0,
      watch_seconds INTEGER NOT NULL DEFAULT 0, liked INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
      PRIMARY KEY(user_id, course_id, video_id)
    );
    CREATE TABLE IF NOT EXISTS video_likes (
      user_id TEXT NOT NULL, course_id TEXT NOT NULL, video_id TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY(user_id, course_id, video_id)
    );
    CREATE TABLE IF NOT EXISTS project_likes (
      user_id TEXT NOT NULL, project_id TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY(user_id, project_id)
    );
    CREATE TABLE IF NOT EXISTS project_assignments (
      id TEXT PRIMARY KEY, course_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
      due_at TEXT, rubric_json TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS certificate_requests (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, course_id TEXT NOT NULL, status TEXT NOT NULL,
      student_note TEXT, admin_note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(user_id, course_id)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, unique_key TEXT NOT NULL, type TEXT NOT NULL,
      title TEXT NOT NULL, body TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL,
      UNIQUE(user_id, unique_key)
    );
    CREATE TABLE IF NOT EXISTS question_bank (
      id TEXT PRIMARY KEY, level_band TEXT NOT NULL, question TEXT NOT NULL, options_json TEXT NOT NULL,
      answer_index INTEGER NOT NULL, explanation TEXT, is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS daily_answers (
      user_id TEXT NOT NULL, question_id TEXT NOT NULL, day_key TEXT NOT NULL, selected_index INTEGER NOT NULL,
      is_correct INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id, question_id, day_key)
    );
    CREATE TABLE IF NOT EXISTS club_posts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, parent_id TEXT, category TEXT NOT NULL, body TEXT NOT NULL,
      is_announcement INTEGER NOT NULL DEFAULT 0, is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blocked_users (user_id TEXT PRIMARY KEY, reason TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS trial_bookings (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, recommended_course_id TEXT,
      answers_json TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS free_course_registrations (
      id TEXT PRIMARY KEY, full_name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, age INTEGER NOT NULL,
      province TEXT NOT NULL, education_grade TEXT NOT NULL, relation TEXT NOT NULL,
      banner_shared INTEGER NOT NULL DEFAULT 0, programming_experience TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', user_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_free_course_registrations_created
      ON free_course_registrations(created_at DESC);
    CREATE TABLE IF NOT EXISTS bot_activity_log (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, slot_key TEXT NOT NULL, activity TEXT NOT NULL,
      xp_delta INTEGER NOT NULL, created_at TEXT NOT NULL, UNIQUE(user_id, slot_key)
    );
  `)

  ensureColumn(db, 'student_profiles', 'assigned_level', 'INTEGER')
  ensureColumn(db, 'student_profiles', 'avatar', "TEXT NOT NULL DEFAULT '🧑‍🚀'")
  ensureColumn(db, 'question_bank', 'course_id', 'TEXT')
  ensureColumn(db, 'question_bank', 'xp_reward', 'INTEGER NOT NULL DEFAULT 3')
  ensureColumn(db, 'question_bank', 'sort_order', 'INTEGER NOT NULL DEFAULT 0')

  const users = db.prepare("SELECT id, name FROM users WHERE role = 'student'").all() as Array<{ id: string; name: string }>
  const seedProfile = db.prepare(`INSERT OR IGNORE INTO student_profiles
    (user_id, display_name, xp, purchased_courses, is_bot, created_at, updated_at, last_activity_at)
    VALUES (?, ?, 0, '[]', 0, ?, ?, ?)`)
  users.forEach((user) => seedProfile.run(user.id, user.name, now(), now(), now()))
  seedBots(db)

  const qCount = (db.prepare('SELECT COUNT(*) count FROM question_bank').get() as any).count
  if (!qCount) {
    const addQuestion = db.prepare('INSERT INTO question_bank (id, level_band, question, options_json, answer_index, explanation, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)')
    const bands = ['starter', 'skiller', 'master']
    for (const band of bands) {
      for (let i = 1; i <= 30; i += 1) {
        const a = i + (band === 'starter' ? 1 : band === 'skiller' ? 3 : 7)
        addQuestion.run(`q-${band}-${i}`, band, `اگر مقدار متغیر x برابر ${a} باشد، نتیجه x + 2 چیست؟`, JSON.stringify([String(a), String(a + 1), String(a + 2), String(a + 3)]), 2, 'با افزودن ۲ به مقدار متغیر، پاسخ به‌دست می‌آید.')
      }
    }
  }

  app.get('/api/courses', (req, res) => {
    const auth = session(req)
    const isAdmin = auth?.role === 'admin'
    let purchased: string[] = []
    if (auth?.role === 'student') purchased = json<string[]>(profileRow(db, auth).purchased_courses, [])
    const rows = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM course_sessions s WHERE s.course_id = c.id AND s.is_published = 1) AS session_count FROM courses c ${isAdmin ? '' : 'WHERE c.is_active = 1'} ORDER BY c.created_at`).all() as any[]
    res.json(rows.map((row) => courseDto(row, Boolean(isAdmin || purchased.includes(row.id)))))
  })

  app.get('/api/student-profile', requireStudent, (req, res) => {
    const auth = res.locals.session as SessionUser
    generateNotifications(db, auth.id)
    const row = profileRow(db, auth)
    db.prepare('UPDATE student_profiles SET last_activity_at = ? WHERE user_id = ?').run(now(), auth.id)
    const ledger = db.prepare('SELECT delta, event_type AS eventType, reason, created_at AS createdAt FROM xp_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(auth.id)
    const completedVideos = (db.prepare('SELECT video_id FROM video_progress WHERE user_id = ? AND watched_percent >= 75').all(auth.id) as Array<{ video_id: string }>).map((item) => item.video_id)
    const completedSessions = (db.prepare('SELECT session_id FROM session_progress WHERE user_id = ? AND completed_at IS NOT NULL').all(auth.id) as Array<{ session_id: string }>).map((item) => item.session_id)
    const completedQuizzes = (db.prepare('SELECT DISTINCT question_id FROM daily_answers WHERE user_id = ? AND is_correct = 1').all(auth.id) as Array<{ question_id: string }>).map((item) => item.question_id)
    res.json({ ...publicProfile(row), completedVideos, completedSessions, completedQuizzes, unlockedRewards: [], xpLedger: ledger })
  })

  app.patch('/api/profile', requireStudent, (req, res) => {
    const auth = res.locals.session as SessionUser
    const displayName = text(req.body.name, 120)
    const allowedAvatars = ['🧑‍🚀', '🦊', '🐼', '🐯', '🤖', '🦄', '🐲', '🧙‍♀️']
    const avatar = allowedAvatars.includes(req.body.avatar) ? req.body.avatar : '🧑‍🚀'
    if (displayName.length < 2) return res.status(400).json({ error: 'نام نمایشی باید حداقل دو حرف باشد.' })
    db.prepare('UPDATE student_profiles SET display_name = ?, avatar = ?, updated_at = ? WHERE user_id = ?').run(displayName, avatar, now(), auth.id)
    db.prepare('UPDATE users SET name = ?, updated_at = ? WHERE id = ?').run(displayName, now(), auth.id)
    res.json(publicProfile(db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(auth.id)))
  })

  app.post('/api/student-profile/action', requireStudent, (req, res) => {
    const auth = res.locals.session as SessionUser
    const action = text(req.body.actionType, 50)
    const target = text(req.body.targetId, 150)
    let result = { awarded: 0 }
    if (action === 'watch_video') {
      return res.status(410).json({ error: 'ثبت دستی مشاهده غیرفعال شده است. پیشرفت هنگام پخش ویدئو به‌صورت خودکار ثبت می‌شود.' })
    }
    const row = profileRow(db, auth)
    res.json({ success: true, xpAwarded: result.awarded, profile: publicProfile(row) })
  })

  app.post('/api/videos/:courseId/:videoId/like', requireStudent, (req, res) => {
    const auth = res.locals.session as SessionUser
    const result = db.prepare('INSERT OR IGNORE INTO video_likes (user_id, course_id, video_id, created_at) VALUES (?, ?, ?, ?)')
      .run(auth.id, req.params.courseId, req.params.videoId, now())
    const xp = result.changes ? awardXp(db, auth.id, 2, 'like_video', `${req.params.courseId}:${req.params.videoId}`, 'پسندیدن ویدئو') : { awarded: 0 }
    res.json({ success: true, liked: true, xpAwarded: xp.awarded })
  })

  app.post('/api/student-profile/unlock-reward', requireStudent, (_req, res) => {
    res.status(410).json({ error: 'فروشگاه پاداش فعلاً غیرفعال است؛ امتیازها از حساب شما کم نمی‌شوند.' })
  })

  app.get('/api/projects', (req, res) => {
    const auth = session(req)
    if (req.query.all === '1') {
      if (auth?.role !== 'admin') return res.status(401).json({ error: fa.forbidden })
      return res.json((db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as any[]).map((row) => projectDto(row, true)))
    }
    if (req.query.studentName !== undefined) {
      if (auth?.role !== 'student') return res.status(401).json({ error: fa.login })
      return res.json((db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC').all(auth.id) as any[]).map((row) => projectDto(row)))
    }
    res.json((db.prepare("SELECT * FROM projects WHERE status = 'approved' ORDER BY featured DESC, likes DESC, created_at DESC").all() as any[]).map((row) => projectDto(row)))
  })

  app.post('/api/projects', requireStudent, (req, res) => {
    const auth = res.locals.session as SessionUser
    const displayName = publicProfile(profileRow(db, auth)).studentName
    const title = text(req.body.title, 180)
    const category = text(req.body.category, 30)
    if (!title || !['AI', 'Game', 'Communication'].includes(category)) return res.status(400).json({ error: 'عنوان و دسته‌بندی معتبر پروژه الزامی است.' })
    const scratchId = text(req.body.scratchId, 40).replace(/\D/g, '')
    const embed = safeEmbed(text(req.body.embedUrl, 500) || (scratchId ? `https://scratch.mit.edu/projects/${scratchId}/embed` : ''))
    const projectId = uid('project')
    db.prepare(`INSERT INTO projects
      (id, title, description, category, embed_url, scratch_id, student_name, student_age, cover_image, status, created_at, updated_at, likes, featured, user_id, assignment_id, submission_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 0, 0, ?, ?, 1)`
    ).run(projectId, title, text(req.body.description, 1600), category, embed, scratchId || null, displayName, Math.max(6, Math.min(99, Number(req.body.studentAge || 14))), text(req.body.coverImage, 500) || '/assets/project-soltan-pist.png', now(), now(), auth.id, text(req.body.assignmentId, 120) || null)
    awardXp(db, auth.id, 40, 'submit_project', projectId, 'ارسال پروژه')
    res.status(201).json(projectDto(db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId)))
  })

  app.patch('/api/projects/:id', (req, res) => {
    const auth = session(req)
    if (!auth) return res.status(401).json({ error: fa.login })
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any
    if (!row) return res.status(404).json({ error: fa.notFound })
    if (auth.role === 'admin') {
      const status = text(req.body.status, 30) || row.status
      if (!['pending', 'approved', 'revision_required', 'rejected'].includes(status)) return res.status(400).json({ error: 'وضعیت پروژه معتبر نیست.' })
      const score = Math.max(0, Math.min(60, Math.floor(Number(req.body.scoreAwarded ?? row.score_awarded ?? 0))))
      const delta = score - Number(row.score_awarded || 0)
      db.prepare('UPDATE projects SET status = ?, featured = ?, admin_notes = ?, rubric_json = ?, score_awarded = ?, updated_at = ? WHERE id = ?')
        .run(status, req.body.featured === undefined ? row.featured : req.body.featured ? 1 : 0, text(req.body.adminNotes, 1600) || row.admin_notes, req.body.rubric ? JSON.stringify(req.body.rubric) : row.rubric_json, score, now(), row.id)
      if (row.user_id && delta) awardXp(db, row.user_id, delta, 'project_grade_adjustment', uid(`grade-${row.id}`), 'امتیاز ارزیابی پروژه', 'admin')
      if (row.user_id) notifyUser(db, row.user_id, `project-review:${row.id}:${row.submission_version}:${status}`, 'project_review', status === 'approved' ? 'پروژه‌ات تأیید شد 🎉' : 'پروژه نیاز به اصلاح دارد', text(req.body.adminNotes, 1600) || (status === 'approved' ? `مربی پروژه را تأیید کرد و ${score} امتیاز ثبت شد.` : 'بازخورد مربی را ببین و نسخه اصلاح‌شده را دوباره بفرست.'))
      return res.json(projectDto(db.prepare('SELECT * FROM projects WHERE id = ?').get(row.id), true))
    }
    if (row.user_id !== auth.id) return res.status(403).json({ error: fa.forbidden })
    if (!['pending', 'revision_required'].includes(row.status)) return res.status(409).json({ error: 'پروژه تأییدشده قابل ویرایش نیست.' })
    const scratchId = text(req.body.scratchId, 40).replace(/\D/g, '')
    const embed = safeEmbed(text(req.body.embedUrl, 500) || (scratchId ? `https://scratch.mit.edu/projects/${scratchId}/embed` : row.embed_url))
    db.prepare(`UPDATE projects SET title = ?, description = ?, category = ?, embed_url = ?, scratch_id = ?, cover_image = ?, status = 'pending',
      submission_version = submission_version + 1, updated_at = ? WHERE id = ?`
    ).run(text(req.body.title, 180) || row.title, text(req.body.description, 1600), text(req.body.category, 30) || row.category, embed, scratchId || row.scratch_id, text(req.body.coverImage, 500) || row.cover_image, now(), row.id)
    res.json(projectDto(db.prepare('SELECT * FROM projects WHERE id = ?').get(row.id)))
  })

  app.post('/api/projects/:id/like', requireStudent, (req, res) => {
    const auth = res.locals.session as SessionUser
    const project = db.prepare("SELECT * FROM projects WHERE id = ? AND status = 'approved'").get(req.params.id) as any
    if (!project) return res.status(404).json({ error: fa.notFound })
    const result = db.prepare('INSERT OR IGNORE INTO project_likes (user_id, project_id, created_at) VALUES (?, ?, ?)').run(auth.id, project.id, now())
    if (result.changes) db.prepare('UPDATE projects SET likes = likes + 1, updated_at = ? WHERE id = ?').run(now(), project.id)
    res.json(projectDto(db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id)))
  })

  app.delete('/api/projects/:id', (req, res) => {
    const auth = session(req)
    if (!auth) return res.status(401).json({ error: fa.login })
    const row = db.prepare('SELECT user_id FROM projects WHERE id = ?').get(req.params.id) as any
    if (!row) return res.status(404).json({ error: fa.notFound })
    if (auth.role !== 'admin' && row.user_id !== auth.id) return res.status(403).json({ error: fa.forbidden })
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  })

  app.get('/api/payments', (req, res) => {
    const auth = session(req)
    if (!auth) return res.status(401).json({ error: fa.login })
    const rows = auth.role === 'admin'
      ? db.prepare('SELECT * FROM payment_requests ORDER BY created_at DESC').all()
      : db.prepare('SELECT * FROM payment_requests WHERE user_id = ? ORDER BY created_at DESC').all(auth.id)
    res.json((rows as any[]).map(paymentDto))
  })

  app.post('/api/purchases', requireStudent, (req, res) => {
    const auth = res.locals.session as SessionUser
    const courseId = text(req.body.courseId, 120)
    const course = db.prepare('SELECT * FROM courses WHERE id = ? AND is_active = 1').get(courseId) as any
    if (!course) return res.status(404).json({ error: 'دوره پیدا نشد.' })
    const phone = text(req.body.phone, 30).replace(/[\s-]/g, '')
    const receipt = text(req.body.receiptNumber, 120)
    if (!/^09\d{9}$/.test(phone) || receipt.length < 4) return res.status(400).json({ error: 'شماره موبایل و کد پیگیری معتبر الزامی است.' })
    const duplicate = db.prepare("SELECT id FROM payment_requests WHERE user_id = ? AND course_id = ? AND status = 'pending'").get(auth.id, courseId)
    if (duplicate) return res.status(409).json({ error: 'برای این دوره یک پرداخت در انتظار بررسی دارید.' })
    const paymentId = uid('payment')
    db.prepare(`INSERT INTO payment_requests
      (id, student_name, phone, course_id, course_title, amount, receipt_number, card_last_four, payer_name, notes, status, created_at, updated_at, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    ).run(paymentId, auth.name, phone, courseId, course.title, course.price, receipt, text(req.body.cardLastFour, 4) || null, text(req.body.payerName, 120) || null, text(req.body.notes, 800) || null, now(), now(), auth.id)
    res.status(201).json({ success: true, payment: paymentDto(db.prepare('SELECT * FROM payment_requests WHERE id = ?').get(paymentId)) })
  })

  app.patch('/api/payments/:id', requireAdminSession, (req, res) => {
    const status = text(req.body.status, 20)
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'وضعیت پرداخت معتبر نیست.' })
    const payment = db.prepare('SELECT * FROM payment_requests WHERE id = ?').get(req.params.id) as any
    if (!payment) return res.status(404).json({ error: fa.notFound })
    db.prepare('UPDATE payment_requests SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?').run(status, text(req.body.adminNotes, 800), now(), payment.id)
    if (status === 'approved' && payment.user_id) {
      const row = db.prepare('SELECT purchased_courses FROM student_profiles WHERE user_id = ?').get(payment.user_id) as any
      const courses = new Set(json<string[]>(row?.purchased_courses, [])); courses.add(payment.course_id)
      db.prepare('UPDATE student_profiles SET purchased_courses = ?, updated_at = ? WHERE user_id = ?').run(JSON.stringify([...courses]), now(), payment.user_id)
    }
    if (payment.user_id) notifyUser(db, payment.user_id, `payment:${payment.id}:${status}`, 'payment_status', status === 'approved' ? 'دوره برایت فعال شد' : 'پرداخت نیاز به بررسی دارد', status === 'approved' ? `دوره «${payment.course_title}» به کلاس‌های تو اضافه شد.` : (text(req.body.adminNotes, 800) || 'اطلاعات پرداخت تأیید نشد؛ لطفاً با پشتیبانی تماس بگیر.'))
    res.json({ success: true })
  })

  app.get('/api/daily-questions', requireStudent, (req, res) => {
    const auth = res.locals.session as SessionUser
    const { day, profile, mission } = dailyMission(db, auth)
    const answer = mission ? db.prepare('SELECT question_id AS questionId, selected_index AS selectedIndex, is_correct AS isCorrect FROM daily_answers WHERE user_id = ? AND question_id = ? AND day_key = ?').get(auth.id, mission.id, day) : null
    const dto = mission ? { id: mission.id, question: mission.question, options: json(mission.options_json, []), courseId: mission.course_id || undefined, courseTitle: mission.course_title || 'مهارت عمومی', xpReward: Number(mission.xp_reward || 3), levelBand: mission.level_band } : null
    res.json({ day, level: profile.level, mission: dto, completed: Boolean(answer), answer, questions: dto ? [dto] : [], answered: answer ? [answer] : [] })
  })

  app.post('/api/daily-questions/:id/answer', requireStudent, (req, res) => {
    const auth = res.locals.session as SessionUser
    const { day, mission: question } = dailyMission(db, auth)
    if (!question || question.id !== req.params.id) return res.status(403).json({ error: 'این مأموریت برای امروز و سطح شما فعال نیست.' })
    const selected = Math.floor(Number(req.body.selectedIndex))
    const correct = selected === question.answer_index
    const result = db.prepare('INSERT OR IGNORE INTO daily_answers (user_id, question_id, day_key, selected_index, is_correct, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(auth.id, question.id, day, selected, correct ? 1 : 0, now())
    let awarded = 0
    if (result.changes && correct) awarded += awardXp(db, auth.id, Number(question.xp_reward || 3), 'daily_answer', `${day}:${question.id}`, 'تکمیل مأموریت روزانه').awarded
    res.json({ correct, explanation: question.explanation, xpAwarded: awarded })
  })

  app.get('/api/leaderboard', (req, res) => {
    advanceBots(db)
    const start = weekStart()
    const rows = db.prepare(`SELECT p.user_id, p.display_name, p.is_bot, p.public_label, COALESCE(SUM(x.delta), 0) weekly_xp
      FROM student_profiles p LEFT JOIN xp_ledger x ON x.user_id = p.user_id AND x.created_at >= ?
      WHERE p.user_id <> 'admin-profile' AND p.is_bot = 0
      GROUP BY p.user_id ORDER BY weekly_xp DESC, p.display_name LIMIT 50`).all(`${start}T00:00:00.000Z`) as any[]
    const mapped = rows.map((row, index) => ({ rank: index + 1, userId: row.user_id, name: row.display_name, weeklyXp: row.weekly_xp, isBot: Boolean(row.is_bot), publicLabel: row.public_label || undefined }))
    const auth = session(req)
    const top = mapped.slice(0, 5)
    const self = auth?.role === 'student' ? mapped.find((entry) => entry.userId === auth.id) : undefined
    if (self && !top.some((entry) => entry.userId === self.userId)) top.push(self)
    res.json({ weekStart: start, entries: top })
  })

  app.get('/api/notifications', requireStudent, (req, res) => {
    const auth = res.locals.session as SessionUser
    generateNotifications(db, auth.id)
    res.json(db.prepare('SELECT id, type, title, body, read_at AS readAt, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(auth.id))
  })

  app.patch('/api/notifications/:id/read', requireStudent, (req, res) => {
    const auth = res.locals.session as SessionUser
    db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?').run(now(), req.params.id, auth.id)
    res.json({ success: true })
  })

  app.get('/api/club', (req, res) => {
    const category = text(req.query.category, 30)
    const where = category ? 'AND c.category = ?' : ''
    const args = category ? [category] : []
    const rows = db.prepare(`SELECT c.id, c.parent_id AS parentId, c.category, c.body, c.is_announcement AS isAnnouncement,
      c.created_at AS createdAt, p.display_name AS author, p.is_bot AS isBot, p.public_label AS publicLabel
      FROM club_posts c JOIN student_profiles p ON p.user_id = c.user_id
      WHERE c.is_deleted = 0 ${where} ORDER BY c.is_announcement DESC, c.created_at DESC LIMIT 100`).all(...args)
    res.json(rows)
  })

  app.post('/api/club', requireStudent, (req, res) => {
    const auth = res.locals.session as SessionUser
    if (db.prepare('SELECT 1 FROM blocked_users WHERE user_id = ?').get(auth.id)) return res.status(403).json({ error: 'امکان ارسال پیام برای این حساب موقتاً مسدود است.' })
    const category = text(req.body.category, 30)
    const body = text(req.body.body, 1200)
    if (!['general', 'qa', 'projects'].includes(category) || body.length < 2) return res.status(400).json({ error: 'دسته‌بندی و متن پیام الزامی است.' })
    const postId = uid('post')
    db.prepare('INSERT INTO club_posts (id, user_id, parent_id, category, body, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(postId, auth.id, text(req.body.parentId, 120) || null, category, body, now())
    const todayCount = (db.prepare("SELECT COUNT(*) count FROM club_posts WHERE user_id = ? AND created_at >= ? AND is_deleted = 0").get(auth.id, `${tehranDay()}T00:00:00.000Z`) as any).count
    const xp = todayCount <= 5 ? awardXp(db, auth.id, 1, 'club_message', postId, 'پیام مفید در باشگاه').awarded : 0
    res.status(201).json({ success: true, id: postId, xpAwarded: xp })
  })

  app.delete('/api/club/:id', requireAdminSession, (req, res) => {
    db.prepare('UPDATE club_posts SET is_deleted = 1 WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  })

  app.post('/api/admin/club/announcement', requireAdminSession, (req, res) => {
    const body = text(req.body.body, 1200)
    if (!body) return res.status(400).json({ error: 'متن اعلان الزامی است.' })
    const adminProfile = { id: 'admin-profile', name: 'مدیریت اسکیل آپ', phone: 'admin', role: 'student' as const, exp: 0 }
    profileRow(db, adminProfile)
    db.prepare('INSERT INTO club_posts (id, user_id, category, body, is_announcement, created_at) VALUES (?, ?, ?, ?, 1, ?)').run(uid('post'), adminProfile.id, 'general', body, now())
    res.json({ success: true })
  })

  app.get('/api/assignments', requireStudent, (req, res) => {
    const auth = res.locals.session as SessionUser
    const courses = profileRow(db, auth).purchased_courses
    res.json(db.prepare('SELECT id, course_id AS courseId, title, description, due_at AS dueAt, rubric_json AS rubric FROM project_assignments WHERE is_active = 1 AND course_id IN (SELECT value FROM json_each(?)) ORDER BY due_at').all(courses))
  })

  app.post('/api/admin/assignments', requireAdminSession, (req, res) => {
    const assignmentId = uid('assignment')
    const rubric = Array.isArray(req.body.rubric) ? req.body.rubric : [{ title: 'خلاقیت', maxScore: 20 }, { title: 'اجرای فنی', maxScore: 25 }, { title: 'ارائه', maxScore: 15 }]
    db.prepare('INSERT INTO project_assignments (id, course_id, title, description, due_at, rubric_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(assignmentId, text(req.body.courseId, 120), text(req.body.title, 180), text(req.body.description, 1600), text(req.body.dueAt, 60) || null, JSON.stringify(rubric), now(), now())
    res.status(201).json({ id: assignmentId })
  })

  app.get('/api/certificates', (req, res) => {
    const auth = session(req)
    if (!auth) return res.status(401).json({ error: fa.login })
    const rows = auth.role === 'admin'
      ? db.prepare('SELECT * FROM certificates ORDER BY issued_at DESC').all()
      : db.prepare('SELECT * FROM certificates WHERE user_id = ? ORDER BY issued_at DESC').all(auth.id)
    res.json((rows as any[]).map((row) => ({ id: row.id, studentName: row.student_name, courseId: row.course_id, courseTitle: row.course_title, issuedAt: row.issued_at, verificationCode: row.verification_code })))
  })

  app.post('/api/certificates/issue', requireStudent, (req, res) => {
    const auth = res.locals.session as SessionUser
    const courseId = text(req.body.courseId, 120)
    const profile = publicProfile(profileRow(db, auth))
    const projects = (db.prepare("SELECT COUNT(*) count FROM projects WHERE user_id = ? AND status IN ('pending','approved','revision_required')").get(auth.id) as any).count
    if (profile.level < 2 || projects < 2) return res.status(400).json({ error: 'برای درخواست گواهینامه باید حداقل Level 2 و دو پروژه ارسال‌شده داشته باشید.' })
    const requestId = uid('certreq')
    db.prepare(`INSERT INTO certificate_requests (id, user_id, course_id, status, student_note, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', ?, ?, ?) ON CONFLICT(user_id, course_id) DO UPDATE SET status = 'pending', student_note = excluded.student_note, updated_at = excluded.updated_at`
    ).run(requestId, auth.id, courseId, text(req.body.studentNote, 800), now(), now())
    res.status(201).json({ success: true, status: 'pending' })
  })

  app.get('/api/admin/certificate-requests', requireAdminSession, (_req, res) => {
    res.json(db.prepare(`SELECT r.*, p.display_name AS student_name FROM certificate_requests r JOIN student_profiles p ON p.user_id = r.user_id ORDER BY r.updated_at DESC`).all())
  })

  app.patch('/api/admin/certificate-requests/:id', requireAdminSession, (req, res) => {
    const status = text(req.body.status, 30)
    if (!['approved', 'revision_required'].includes(status)) return res.status(400).json({ error: 'وضعیت معتبر نیست.' })
    const request = db.prepare('SELECT * FROM certificate_requests WHERE id = ?').get(req.params.id) as any
    if (!request) return res.status(404).json({ error: fa.notFound })
    db.prepare('UPDATE certificate_requests SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?').run(status, text(req.body.adminNote, 1000), now(), request.id)
    notifyUser(db, request.user_id, `certificate:${request.id}:${status}`, 'certificate_status', status === 'approved' ? 'گواهینامه صادر شد' : 'درخواست گواهینامه نیاز به اصلاح دارد', text(req.body.adminNote, 1000) || (status === 'approved' ? 'گواهینامه و QR اعتبارسنجی در گذرنامه مهارتی شما آماده است.' : 'توضیحات مدیر را بررسی کنید.'))
    if (status === 'approved') {
      const profile = db.prepare('SELECT display_name FROM student_profiles WHERE user_id = ?').get(request.user_id) as any
      const course = db.prepare('SELECT title FROM courses WHERE id = ?').get(request.course_id) as any
      const existing = db.prepare('SELECT id FROM certificates WHERE user_id = ? AND course_id = ?').get(request.user_id, request.course_id)
      if (!existing) db.prepare('INSERT INTO certificates (id, student_name, course_id, course_title, issued_at, verification_code, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(uid('cert'), profile.display_name, request.course_id, course?.title || request.course_id, tehranDay(), `SU-${crypto.randomBytes(5).toString('hex').toUpperCase()}`, request.user_id)
    }
    res.json({ success: true })
  })

  app.get('/api/certificates/verify/:code', (req, res) => {
    const row = db.prepare('SELECT * FROM certificates WHERE verification_code = ?').get(text(req.params.code, 80)) as any
    if (!row) return res.status(404).json({ valid: false, error: 'گواهینامه معتبر پیدا نشد.' })
    const profile = db.prepare('SELECT xp FROM student_profiles WHERE user_id = ?').get(row.user_id) as any
    res.json({ valid: true, studentName: row.student_name, courseTitle: row.course_title, issuedAt: row.issued_at, verificationCode: row.verification_code, skillPassport: { level: levelForXp(profile?.xp || 0), tier: tier(levelForXp(profile?.xp || 0)) } })
  })

  app.get('/api/certificates/:id/qr', async (req, res) => {
    const row = db.prepare('SELECT verification_code FROM certificates WHERE id = ?').get(req.params.id) as any
    if (!row) return res.status(404).json({ error: fa.notFound })
    const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`
    const svg = await QRCode.toString(`${base}/?certificate=${encodeURIComponent(row.verification_code)}`, { type: 'svg', margin: 1, width: 240 })
    res.type('image/svg+xml').send(svg)
  })

  app.get('/api/skill-passport', requireStudent, (req, res) => {
    const auth = res.locals.session as SessionUser
    const profile = publicProfile(profileRow(db, auth))
    const projects = db.prepare("SELECT id, title, status, score_awarded AS score FROM projects WHERE user_id = ? ORDER BY created_at DESC").all(auth.id)
    const certificates = db.prepare('SELECT id, course_title AS courseTitle, issued_at AS issuedAt, verification_code AS verificationCode FROM certificates WHERE user_id = ? ORDER BY issued_at DESC').all(auth.id)
    res.json({ owner: profile.studentName, level: profile.level, tier: profile.tier, xp: profile.xp, projects, certificates })
  })

  app.post('/api/trial/assessment', (req, res) => {
    const answers = Array.isArray(req.body.answers) ? req.body.answers.map(Number) : []
    const score = answers.reduce((sum: number, value: number) => sum + Math.max(0, Math.min(3, value || 0)), 0)
    const courses = db.prepare('SELECT id, title FROM courses WHERE is_active = 1 ORDER BY created_at').all() as any[]
    const index = courses.length ? Math.min(courses.length - 1, Math.floor(score / Math.max(1, 12 / courses.length))) : 0
    const recommended = courses[index] || null
    const name = text(req.body.name, 120)
    const phone = text(req.body.phone, 30).replace(/[\s-]/g, '')
    if (name && /^09\d{9}$/.test(phone)) db.prepare('INSERT INTO trial_bookings (id, name, phone, recommended_course_id, answers_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uid('trial'), name, phone, recommended?.id || null, JSON.stringify(answers), now())
    res.json({ score, recommendedCourse: recommended, trialAvailable: true })
  })

  app.post('/api/free-course-registrations', (req, res) => {
    const fullName = text(req.body.fullName, 120)
    const phone = normalizePhone(req.body.phone)
    const age = Math.floor(Number(req.body.age))
    const province = text(req.body.province, 80)
    const educationGrade = text(req.body.educationGrade, 80)
    const relation = text(req.body.relation, 40)
    const programmingExperience = text(req.body.programmingExperience, 80)
    const grades = ['پیش‌دبستانی', 'اول ابتدایی', 'دوم ابتدایی', 'سوم ابتدایی', 'چهارم ابتدایی', 'پنجم ابتدایی', 'ششم ابتدایی', 'هفتم', 'هشتم', 'نهم', 'دهم', 'یازدهم', 'دوازدهم', 'مدرسه نمی‌روم', 'دانشگاه']
    const relations = ['خودم', 'فرزندم', 'خواهر / برادر', 'دوست یا آشنا']
    const experiences = ['کاملاً مبتدی هستم', 'کمی آشنایی دارم', 'قبلاً تجربه برنامه‌نویسی داشته‌ام']

    if (fullName.length < 3) return res.status(400).json({ error: 'نام و نام خانوادگی را کامل وارد کنید.' })
    if (!/^09\d{9}$/.test(phone)) return res.status(400).json({ error: 'شماره تماس معتبر وارد کنید.' })
    if (!Number.isInteger(age) || age < 6 || age > 22) return res.status(400).json({ error: 'سن شرکت‌کننده باید بین ۶ تا ۲۲ سال باشد.' })
    if (province.length < 2) return res.status(400).json({ error: 'استان محل زندگی را وارد کنید.' })
    if (!grades.includes(educationGrade)) return res.status(400).json({ error: 'پایه تحصیلی معتبر انتخاب کنید.' })
    if (!relations.includes(relation)) return res.status(400).json({ error: 'مشخص کنید دوره برای چه کسی است.' })
    if (req.body.bannerShared !== true) return res.status(400).json({ error: 'برای نهایی شدن ثبت‌نام، ارسال بنر برای حداقل دو نفر را تأیید کنید.' })
    if (!experiences.includes(programmingExperience)) return res.status(400).json({ error: 'میزان آشنایی با برنامه‌نویسی را انتخاب کنید.' })
    if (db.prepare('SELECT id FROM free_course_registrations WHERE phone = ?').get(phone)) {
      return res.status(409).json({ error: 'این شماره قبلاً برای دوره رایگان ثبت شده است.' })
    }

    const id = uid('free-registration')
    const createdAt = now()
    db.prepare(`INSERT INTO free_course_registrations
      (id, full_name, phone, age, province, education_grade, relation, banner_shared, programming_experience, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'pending', ?, ?)`
    ).run(id, fullName, phone, age, province, educationGrade, relation, programmingExperience, createdAt, createdAt)
    res.status(201).json({ success: true, id, message: 'اطلاعات شما با موفقیت ثبت شد.' })
  })

  app.get('/api/admin/free-course-registrations', requireAdminSession, (_req, res) => {
    const rows = db.prepare('SELECT * FROM free_course_registrations ORDER BY created_at DESC').all() as any[]
    res.json(rows.map(freeRegistrationDto))
  })

  app.post('/api/admin/free-course-registrations/:id/create-account', requireAdminSession, (req, res) => {
    const registration = db.prepare('SELECT * FROM free_course_registrations WHERE id = ?').get(req.params.id) as any
    if (!registration) return res.status(404).json({ error: 'ثبت‌نام موردنظر پیدا نشد.' })
    if (registration.user_id) return res.status(409).json({ error: 'حساب این ثبت‌نام قبلاً ساخته یا متصل شده است.' })

    const existing = db.prepare('SELECT id, name, phone, role FROM users WHERE phone = ?').get(registration.phone) as any
    if (existing) {
      if (existing.role !== 'student') return res.status(409).json({ error: 'این شماره به یک حساب غیرهنرجو متصل است.' })
      const course = activateFreeScratchCourse(db, existing.id, existing.name)
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
        .run(hashGeneratedPassword(freeRegistrationPassword), now(), existing.id)
      db.prepare("UPDATE free_course_registrations SET user_id = ?, status = 'account_linked', updated_at = ? WHERE id = ?")
        .run(existing.id, now(), registration.id)
      return res.json({
        success: true,
        existingAccount: true,
        user: existing,
        course,
        credentials: { username: existing.phone, password: freeRegistrationPassword },
      })
    }

    const userId = uid('user')
    const password = freeRegistrationPassword
    const createdAt = now()
    let course: { id: string; title: string } | null = null
    db.exec('BEGIN')
    try {
      db.prepare(`INSERT INTO users (id, name, phone, password_hash, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'student', ?, ?)`
      ).run(userId, registration.full_name, registration.phone, hashGeneratedPassword(password), createdAt, createdAt)
      course = activateFreeScratchCourse(db, userId, registration.full_name)
      db.prepare("UPDATE free_course_registrations SET user_id = ?, status = 'account_created', updated_at = ? WHERE id = ?")
        .run(userId, createdAt, registration.id)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    res.status(201).json({
      success: true,
      existingAccount: false,
      user: { id: userId, name: registration.full_name, phone: registration.phone, role: 'student' },
      course,
      credentials: { username: registration.phone, password },
    })
  })

  app.get('/api/admin/learning-dashboard', requireAdminSession, (_req, res) => {
    advanceBots(db)
    const students = db.prepare(`SELECT p.user_id AS userId, p.display_name AS name, p.xp, p.is_bot AS isBot, p.public_label AS publicLabel,
      COALESCE((SELECT SUM(sp.watched_seconds) FROM session_progress sp WHERE sp.user_id = p.user_id), 0) + COALESCE((SELECT SUM(vp.watch_seconds) FROM video_progress vp WHERE vp.user_id = p.user_id), 0) AS watchSeconds,
      (SELECT COUNT(*) FROM session_progress sp WHERE sp.user_id = p.user_id AND sp.completed_at IS NOT NULL) + (SELECT COUNT(*) FROM video_progress vp WHERE vp.user_id = p.user_id AND vp.watched_percent >= 75) AS completedVideos,
      (SELECT COUNT(*) FROM daily_answers a WHERE a.user_id = p.user_id) AS answers,
      (SELECT COUNT(*) FROM projects pr WHERE pr.user_id = p.user_id) AS projects,
      EXISTS(SELECT 1 FROM blocked_users b WHERE b.user_id = p.user_id) AS blocked,
      p.last_activity_at AS lastActivityAt, p.assigned_level AS assignedLevel, p.avatar
      FROM student_profiles p
      WHERE p.user_id <> 'admin-profile'
      GROUP BY p.user_id ORDER BY p.is_bot, p.display_name`).all() as any[]
    res.json({ summary: { students: students.filter((s) => !s.isBot).length, demoAccounts: students.filter((s) => s.isBot).length, totalWatchSeconds: students.reduce((sum, s) => sum + Number(s.watchSeconds), 0), submittedProjects: students.reduce((sum, s) => sum + Number(s.projects), 0) }, students: students.map((s) => ({ ...s, level: Number(s.assignedLevel || levelForXp(s.xp)), isBot: Boolean(s.isBot) })), botActivities: db.prepare('SELECT * FROM bot_activity_log ORDER BY created_at DESC LIMIT 50').all() })
  })

  app.get('/api/admin/learning-dashboard.csv', requireAdminSession, (_req, res) => {
    const rows = db.prepare(`SELECT p.display_name, p.xp, p.is_bot, COALESCE((SELECT SUM(sp.watched_seconds) FROM session_progress sp WHERE sp.user_id=p.user_id),0) + COALESCE((SELECT SUM(vp.watch_seconds) FROM video_progress vp WHERE vp.user_id=p.user_id),0) watch_seconds,
      (SELECT COUNT(*) FROM daily_answers a WHERE a.user_id=p.user_id) answers,
      (SELECT COUNT(*) FROM projects pr WHERE pr.user_id=p.user_id) projects
      FROM student_profiles p WHERE p.user_id <> 'admin-profile' GROUP BY p.user_id ORDER BY p.display_name`).all() as any[]
    const esc = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const lines = [['نام', 'نوع حساب', 'XP', 'Level', 'زمان مشاهده (ثانیه)', 'پاسخ‌ها', 'پروژه‌ها'].map(esc).join(',')]
    rows.forEach((row) => lines.push([row.display_name, row.is_bot ? 'نمایشی/ربات' : 'واقعی', row.xp, levelForXp(row.xp), row.watch_seconds, row.answers, row.projects].map(esc).join(',')))
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="skillup-learning-dashboard.csv"')
    res.send(`\uFEFF${lines.join('\n')}`)
  })

  app.post('/api/admin/xp-gift', requireAdminSession, (req, res) => {
    const userId = text(req.body.userId, 120)
    const amount = Math.max(-10000, Math.min(10000, Math.floor(Number(req.body.amount))))
    const reason = text(req.body.reason, 400)
    if (!userId || !amount || !reason) return res.status(400).json({ error: 'هنرجو، مقدار و دلیل هدیه الزامی است.' })
    const result = awardXp(db, userId, amount, 'admin_gift', uid('gift'), reason, 'admin')
    res.json({ success: true, xpAwarded: result.awarded })
  })

  app.get('/api/admin/questions', requireAdminSession, (_req, res) => {
    const rows = db.prepare(`SELECT q.id, q.level_band AS levelBand, q.course_id AS courseId, c.title AS courseTitle,
      q.question, q.options_json AS options, q.answer_index AS answerIndex, q.explanation,
      q.xp_reward AS xpReward, q.sort_order AS sortOrder, q.is_active AS isActive
      FROM question_bank q LEFT JOIN courses c ON c.id = q.course_id ORDER BY q.level_band, q.sort_order, q.id`).all() as any[]
    res.json(rows.map((row) => ({ ...row, options: json(row.options, []), isActive: Boolean(row.isActive) })))
  })

  app.post('/api/admin/questions', requireAdminSession, (req, res) => {
    const options = Array.isArray(req.body.options) ? req.body.options.map((item: unknown) => text(item, 180)).slice(0, 6) : []
    const answerIndex = Math.floor(Number(req.body.answerIndex))
    if (!text(req.body.question, 500) || options.length < 2 || answerIndex < 0 || answerIndex >= options.length) return res.status(400).json({ error: 'صورت سؤال، گزینه‌ها و پاسخ صحیح معتبر الزامی است.' })
    const questionId = uid('question')
    const courseId = text(req.body.courseId, 120) || null
    db.prepare('INSERT INTO question_bank (id, level_band, course_id, question, options_json, answer_index, explanation, xp_reward, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)')
      .run(questionId, ['starter', 'skiller', 'master'].includes(req.body.levelBand) ? req.body.levelBand : 'starter', courseId, text(req.body.question, 500), JSON.stringify(options), answerIndex, text(req.body.explanation, 800), Math.max(1, Math.min(100, Number(req.body.xpReward) || 3)), Math.floor(Number(req.body.sortOrder) || 0))
    res.status(201).json({ id: questionId })
  })

  app.post('/api/admin/questions/bulk', requireAdminSession, (req, res) => {
    const tasks = Array.isArray(req.body.tasks) ? req.body.tasks.slice(0, 100) : []
    if (!tasks.length) return res.status(400).json({ error: 'حداقل یک مأموریت برای افزودن گروهی لازم است.' })
    const insert = db.prepare('INSERT INTO question_bank (id, level_band, course_id, question, options_json, answer_index, explanation, xp_reward, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)')
    let created = 0
    db.exec('BEGIN')
    try {
      for (const task of tasks) {
        const options = Array.isArray(task.options) ? task.options.map((item: unknown) => text(item, 180)).filter(Boolean).slice(0, 6) : []
        const answerIndex = Math.floor(Number(task.answerIndex))
        if (!text(task.question, 500) || options.length < 2 || answerIndex < 0 || answerIndex >= options.length) continue
        insert.run(uid('question'), ['starter', 'skiller', 'master'].includes(task.levelBand) ? task.levelBand : 'starter', text(task.courseId, 120) || null, text(task.question, 500), JSON.stringify(options), answerIndex, text(task.explanation, 800), Math.max(1, Math.min(100, Number(task.xpReward) || 3)), Math.floor(Number(task.sortOrder) || created))
        created += 1
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    if (!created) return res.status(400).json({ error: 'هیچ ردیف معتبری برای ثبت پیدا نشد.' })
    res.status(201).json({ created })
  })

  app.patch('/api/admin/questions/:id', requireAdminSession, (req, res) => {
    const current = db.prepare('SELECT * FROM question_bank WHERE id = ?').get(req.params.id) as any
    if (!current) return res.status(404).json({ error: fa.notFound })
    const options = Array.isArray(req.body.options) ? req.body.options.map((item: unknown) => text(item, 180)).slice(0, 6) : json(current.options_json, [])
    const answerIndex = req.body.answerIndex === undefined ? current.answer_index : Math.floor(Number(req.body.answerIndex))
    const isActive = req.body.isActive === undefined ? current.is_active : req.body.isActive ? 1 : 0
    db.prepare('UPDATE question_bank SET level_band = ?, course_id = ?, question = ?, options_json = ?, answer_index = ?, explanation = ?, xp_reward = ?, sort_order = ?, is_active = ? WHERE id = ?')
      .run(text(req.body.levelBand, 20) || current.level_band, req.body.courseId === undefined ? current.course_id : (text(req.body.courseId, 120) || null), text(req.body.question, 500) || current.question, JSON.stringify(options), answerIndex, req.body.explanation === undefined ? current.explanation : text(req.body.explanation, 800), req.body.xpReward === undefined ? current.xp_reward : Math.max(1, Math.min(100, Number(req.body.xpReward) || 3)), req.body.sortOrder === undefined ? current.sort_order : Math.floor(Number(req.body.sortOrder) || 0), isActive, current.id)
    res.json({ success: true })
  })

  app.delete('/api/admin/questions/:id', requireAdminSession, (req, res) => {
    db.prepare('UPDATE question_bank SET is_active = 0 WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  })

  app.patch('/api/admin/users/:id/learning-level', requireAdminSession, (req, res) => {
    const level = Math.max(1, Math.min(99, Math.floor(Number(req.body.level))))
    const result = db.prepare('UPDATE student_profiles SET assigned_level = ?, updated_at = ? WHERE user_id = ?').run(level, now(), req.params.id)
    if (!result.changes) return res.status(404).json({ error: 'هنرجو پیدا نشد.' })
    notifyUser(db, req.params.id, `learning-level:${level}:${tehranDay()}`, 'level_update', 'سطح آموزشی‌ات به‌روز شد', `مربی سطح آموزشی تو را روی ${level} تنظیم کرد؛ مأموریت‌های بعدی متناسب با این سطح هستند.`)
    res.json({ success: true, level })
  })

  app.post('/api/admin/users/:id/block', requireAdminSession, (req, res) => {
    const blocked = req.body.blocked !== false
    if (blocked) db.prepare('INSERT INTO blocked_users (user_id, reason, created_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET reason = excluded.reason, created_at = excluded.created_at')
      .run(req.params.id, text(req.body.reason, 400) || 'مدیریت باشگاه', now())
    else db.prepare('DELETE FROM blocked_users WHERE user_id = ?').run(req.params.id)
    res.json({ success: true, blocked })
  })

  const automationTimer = setInterval(() => {
    try {
      advanceBots(db)
      const realUsers = db.prepare('SELECT user_id FROM student_profiles WHERE is_bot = 0').all() as Array<{ user_id: string }>
      realUsers.forEach((user) => generateNotifications(db, user.user_id))
    } catch (error) {
      console.error('[SkillUp automation]', error)
    }
  }, 60 * 60 * 1000)
  automationTimer.unref()
}
