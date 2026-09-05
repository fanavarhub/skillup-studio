import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { Express, Request, Response } from 'express'
import type { DatabaseSync } from 'node:sqlite'
import multer from 'multer'
import { createAssetToken, readSession, requireAdminSession, requireStudent, verifyAssetToken, type SessionUser } from './auth'

const now = () => new Date().toISOString()
const uid = (prefix: string) => `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`
const clean = (value: unknown, max = 2000) => String(value ?? '').trim().slice(0, max)
const allowedKinds = ['video', 'pdf', 'zip', 'image', 'excel'] as const
type AssetKind = typeof allowedKinds[number]

const extensionKinds: Record<string, AssetKind> = {
  '.mp4': 'video', '.webm': 'video', '.mov': 'video',
  '.pdf': 'pdf', '.zip': 'zip',
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.webp': 'image', '.gif': 'image',
  '.xlsx': 'excel', '.xls': 'excel', '.csv': 'excel',
}

function parseJson<T>(value: unknown, fallback: T): T {
  try { return JSON.parse(String(value || '')) as T } catch { return fallback }
}

function safeHttpUrl(value: unknown) {
  try {
    const url = new URL(clean(value, 1000))
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch { return '' }
}

function clockSeconds(value: unknown) {
  const normalized = clean(value, 30)
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
  const parts = normalized.split(':').map(Number)
  if (!parts.length || parts.some((part) => !Number.isFinite(part) || part < 0)) return 0
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

function canAccessCourse(db: DatabaseSync, user: SessionUser, courseId: string) {
  if (user.role === 'admin') return true
  const row = db.prepare('SELECT purchased_courses FROM student_profiles WHERE user_id = ?').get(user.id) as { purchased_courses?: string } | undefined
  return parseJson<string[]>(row?.purchased_courses, []).includes(courseId)
}

function sessionDto(db: DatabaseSync, row: any, includeStorage = false) {
  const assets = db.prepare(`SELECT id, kind, original_name AS originalName, mime_type AS mimeType,
    size_bytes AS sizeBytes, external_url AS externalUrl, created_at AS createdAt${includeStorage ? ', storage_name AS storageName' : ''}
    FROM session_assets WHERE session_id = ? ORDER BY created_at`).all(row.id)
  return {
    id: row.id, courseId: row.course_id, title: row.title, description: row.description,
    orderIndex: Number(row.order_index), xpReward: Number(row.xp_reward), durationSeconds: Number(row.duration_seconds || 0),
    isPublished: Boolean(row.is_published), createdAt: row.created_at, updatedAt: row.updated_at, assets,
  }
}

function addNotification(db: DatabaseSync, userId: string, key: string, type: string, title: string, body: string) {
  db.prepare(`INSERT OR IGNORE INTO notifications
    (id, user_id, unique_key, type, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(uid('notice'), userId, key, type, title, body, now())
}

function mergeRanges(ranges: Array<[number, number]>, addition?: [number, number]) {
  const normalized = [...ranges, ...(addition ? [addition] : [])]
    .map(([start, end]) => [Math.max(0, start), Math.max(0, end)] as [number, number])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0])
  const result: Array<[number, number]> = []
  for (const range of normalized) {
    const last = result[result.length - 1]
    if (!last || range[0] > last[1] + 0.75) result.push([...range])
    else last[1] = Math.max(last[1], range[1])
  }
  return result.slice(-250)
}

function watchedSeconds(ranges: Array<[number, number]>) {
  return ranges.reduce((sum, [start, end]) => sum + (end - start), 0)
}

export function mountLearningRoutes(app: Express, db: DatabaseSync) {
  const uploadDir = path.join(process.cwd(), 'data', 'uploads')
  fs.mkdirSync(uploadDir, { recursive: true })
  db.exec(`
    CREATE TABLE IF NOT EXISTS course_sessions (
      id TEXT PRIMARY KEY, course_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      order_index INTEGER NOT NULL DEFAULT 1, xp_reward INTEGER NOT NULL DEFAULT 10, duration_seconds REAL NOT NULL DEFAULT 0,
      is_published INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_course_order ON course_sessions(course_id, order_index);
    CREATE TABLE IF NOT EXISTS session_assets (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL, kind TEXT NOT NULL, original_name TEXT NOT NULL,
      storage_name TEXT, external_url TEXT, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_assets_session ON session_assets(session_id);
    CREATE TABLE IF NOT EXISTS session_progress (
      user_id TEXT NOT NULL, session_id TEXT NOT NULL, current_time REAL NOT NULL DEFAULT 0,
      duration REAL NOT NULL DEFAULT 0, watched_seconds REAL NOT NULL DEFAULT 0, watched_ranges TEXT NOT NULL DEFAULT '[]',
      last_position REAL NOT NULL DEFAULT 0, last_heartbeat_at TEXT, completed_at TEXT,
      xp_awarded INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
      PRIMARY KEY(user_id, session_id)
    );
    CREATE TABLE IF NOT EXISTS site_messages (
      id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL, body TEXT NOT NULL, rating INTEGER NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'pending', admin_reply TEXT, featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS platform_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
  `)

  // Preserve existing course videos by migrating them once into the new session model.
  if (!db.prepare("SELECT 1 FROM platform_migrations WHERE id = 'course-sessions-v1'").get()) {
    const legacyCourses = db.prepare('SELECT id, offline_videos FROM courses').all() as Array<{ id: string; offline_videos: string }>
    for (const course of legacyCourses) {
      const count = (db.prepare('SELECT COUNT(*) AS count FROM course_sessions WHERE course_id = ?').get(course.id) as any).count
      if (count) continue
      const videos = parseJson<Array<{ id?: string; title?: string; duration?: string; url?: string }>>(course.offline_videos, [])
      videos.forEach((video, index) => {
        const sessionId = uid('session')
        db.prepare(`INSERT INTO course_sessions
          (id, course_id, title, description, order_index, xp_reward, duration_seconds, is_published, created_at, updated_at)
          VALUES (?, ?, ?, '', ?, 10, ?, 1, ?, ?)`
        ).run(sessionId, course.id, clean(video.title, 180) || `جلسه ${index + 1}`, index + 1, clockSeconds(video.duration), now(), now())
        const legacyUrl = safeHttpUrl(video.url)
        if (legacyUrl) db.prepare(`INSERT INTO session_assets
          (id, session_id, kind, original_name, external_url, mime_type, size_bytes, created_at)
          VALUES (?, ?, 'video', ?, ?, 'video/external', 0, ?)`
        ).run(uid('asset'), sessionId, clean(video.title, 180) || 'ویدئو', legacyUrl, now())
      })
    }
    db.prepare("INSERT INTO platform_migrations (id, applied_at) VALUES ('course-sessions-v1', ?)").run(now())
  }

  const messageHits = new Map<string, number[]>()

  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 500 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => callback(null, Boolean(extensionKinds[path.extname(file.originalname).toLowerCase()])),
  })

  app.post('/api/admin/courses/:id/cover', requireAdminSession, (req, res) => {
    const course = db.prepare('SELECT cover_storage_name FROM courses WHERE id = ?').get(req.params.id) as { cover_storage_name?: string } | undefined
    if (!course) return res.status(404).json({ error: 'دوره پیدا نشد.' })
    upload.single('file')(req, res, (error) => {
      if (error) return res.status(400).json({ error: error instanceof Error ? error.message : 'آپلود تصویر ناموفق بود.' })
      if (!req.file || extensionKinds[path.extname(req.file.originalname).toLowerCase()] !== 'image' || req.file.size > 8 * 1024 * 1024) {
        if (req.file?.path) fs.rmSync(req.file.path, { force: true })
        return res.status(400).json({ error: 'فقط تصویر JPG، PNG، WebP یا GIF تا حجم ۸ مگابایت قابل استفاده است.' })
      }
      if (course.cover_storage_name) fs.rmSync(path.join(uploadDir, path.basename(course.cover_storage_name)), { force: true })
      const coverUrl = `/api/course-covers/${encodeURIComponent(req.params.id)}`
      db.prepare('UPDATE courses SET cover_image = ?, cover_storage_name = ?, cover_mime_type = ?, updated_at = ? WHERE id = ?')
        .run(coverUrl, req.file.filename, req.file.mimetype, now(), req.params.id)
      res.json({ success: true, coverImage: coverUrl })
    })
  })

  app.get('/api/course-covers/:id', (req, res) => {
    const course = db.prepare('SELECT cover_storage_name, cover_mime_type FROM courses WHERE id = ? AND is_active = 1').get(req.params.id) as { cover_storage_name?: string; cover_mime_type?: string } | undefined
    if (!course?.cover_storage_name) return res.status(404).end()
    const filePath = path.join(uploadDir, path.basename(course.cover_storage_name))
    if (!fs.existsSync(filePath)) return res.status(404).end()
    res.setHeader('Content-Type', course.cover_mime_type || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.sendFile(filePath)
  })

  app.get('/api/admin/course-sessions', requireAdminSession, (req, res) => {
    const courseId = clean(req.query.courseId, 120)
    const rows = db.prepare(`SELECT * FROM course_sessions ${courseId ? 'WHERE course_id = ?' : ''} ORDER BY course_id, order_index, created_at`)
      .all(...(courseId ? [courseId] : [])) as any[]
    res.json(rows.map((row) => sessionDto(db, row)))
  })

  app.post('/api/admin/course-sessions', requireAdminSession, (req, res) => {
    const courseId = clean(req.body.courseId, 120)
    const title = clean(req.body.title, 180)
    if (!courseId || !title || !db.prepare('SELECT 1 FROM courses WHERE id = ?').get(courseId)) return res.status(400).json({ error: 'دوره و عنوان جلسه معتبر الزامی است.' })
    const nextOrder = Number((db.prepare('SELECT COALESCE(MAX(order_index), 0) + 1 AS value FROM course_sessions WHERE course_id = ?').get(courseId) as any).value)
    const id = uid('session')
    db.prepare(`INSERT INTO course_sessions
      (id, course_id, title, description, order_index, xp_reward, duration_seconds, is_published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, courseId, title, clean(req.body.description, 4000), Math.max(1, Number(req.body.orderIndex || nextOrder)), Math.max(0, Math.min(1000, Number(req.body.xpReward ?? 10))), Math.max(0, Number(req.body.durationSeconds || 0)), req.body.isPublished === false ? 0 : 1, now(), now())
    res.status(201).json(sessionDto(db, db.prepare('SELECT * FROM course_sessions WHERE id = ?').get(id)))
  })

  app.patch('/api/admin/course-sessions/:id', requireAdminSession, (req, res) => {
    const current = db.prepare('SELECT * FROM course_sessions WHERE id = ?').get(req.params.id) as any
    if (!current) return res.status(404).json({ error: 'جلسه پیدا نشد.' })
    db.prepare(`UPDATE course_sessions SET title = ?, description = ?, order_index = ?, xp_reward = ?, duration_seconds = ?, is_published = ?, updated_at = ? WHERE id = ?`)
      .run(clean(req.body.title, 180) || current.title, req.body.description === undefined ? current.description : clean(req.body.description, 4000), Math.max(1, Number(req.body.orderIndex ?? current.order_index)), Math.max(0, Math.min(1000, Number(req.body.xpReward ?? current.xp_reward))), Math.max(0, Number(req.body.durationSeconds ?? current.duration_seconds)), req.body.isPublished === undefined ? current.is_published : req.body.isPublished ? 1 : 0, now(), current.id)
    res.json(sessionDto(db, db.prepare('SELECT * FROM course_sessions WHERE id = ?').get(current.id)))
  })

  app.delete('/api/admin/course-sessions/:id', requireAdminSession, (req, res) => {
    const assets = db.prepare('SELECT storage_name FROM session_assets WHERE session_id = ? AND storage_name IS NOT NULL').all(req.params.id) as Array<{ storage_name: string }>
    db.exec('BEGIN')
    try {
      db.prepare('DELETE FROM session_progress WHERE session_id = ?').run(req.params.id)
      db.prepare('DELETE FROM session_assets WHERE session_id = ?').run(req.params.id)
      db.prepare('DELETE FROM course_sessions WHERE id = ?').run(req.params.id)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    assets.forEach(({ storage_name }) => fs.rmSync(path.join(uploadDir, path.basename(storage_name)), { force: true }))
    res.json({ success: true })
  })

  app.post('/api/admin/course-sessions/:id/assets', requireAdminSession, (req, res) => {
    const lesson = db.prepare('SELECT duration_seconds FROM course_sessions WHERE id = ?').get(req.params.id) as { duration_seconds: number } | undefined
    if (!lesson) return res.status(404).json({ error: 'جلسه پیدا نشد.' })
    upload.single('file')(req, res, (error) => {
      if (error) return res.status(400).json({ error: error instanceof Error ? error.message : 'آپلود فایل ناموفق بود.' })
      if (!req.file) return res.status(400).json({ error: 'فرمت فایل مجاز نیست. فرمت‌های ویدئو، PDF، ZIP، تصویر و Excel پذیرفته می‌شوند.' })
      const kind = extensionKinds[path.extname(req.file.originalname).toLowerCase()]
      if (kind === 'video' && Number(lesson.duration_seconds) <= 0) {
        fs.rmSync(req.file.path, { force: true })
        return res.status(400).json({ error: 'پیش از آپلود ویدئو، مدت دقیق آن را به ثانیه در تنظیمات جلسه وارد کنید.' })
      }
      if (kind === 'video' && db.prepare("SELECT 1 FROM session_assets WHERE session_id = ? AND kind = 'video'").get(req.params.id)) {
        fs.rmSync(req.file.path, { force: true })
        return res.status(409).json({ error: 'هر جلسه فقط یک ویدئوی اصلی دارد؛ ابتدا ویدئوی قبلی را حذف کنید.' })
      }
      const id = uid('asset')
      db.prepare(`INSERT INTO session_assets
        (id, session_id, kind, original_name, storage_name, mime_type, size_bytes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, req.params.id, kind, clean(req.file.originalname, 255), req.file.filename, req.file.mimetype, req.file.size, now())
      res.status(201).json({ id, kind, originalName: req.file.originalname, sizeBytes: req.file.size })
    })
  })

  app.delete('/api/admin/session-assets/:id', requireAdminSession, (req, res) => {
    const asset = db.prepare('SELECT storage_name FROM session_assets WHERE id = ?').get(req.params.id) as { storage_name?: string } | undefined
    if (!asset) return res.status(404).json({ error: 'فایل پیدا نشد.' })
    db.prepare('DELETE FROM session_assets WHERE id = ?').run(req.params.id)
    if (asset.storage_name) fs.rmSync(path.join(uploadDir, path.basename(asset.storage_name)), { force: true })
    res.json({ success: true })
  })

  app.get('/api/student/courses/:courseId/sessions', requireStudent, (req, res) => {
    const user = res.locals.session as SessionUser
    if (!canAccessCourse(db, user, req.params.courseId)) return res.status(403).json({ error: 'برای دیدن جلسه ابتدا باید دوره را تهیه کنید.' })
    const rows = db.prepare('SELECT * FROM course_sessions WHERE course_id = ? AND is_published = 1 ORDER BY order_index, created_at').all(req.params.courseId) as any[]
    const progressRows = db.prepare('SELECT * FROM session_progress WHERE user_id = ?').all(user.id) as any[]
    const progress = new Map(progressRows.map((item) => [item.session_id, item]))
    res.json(rows.map((row) => {
      const item = progress.get(row.id)
      return { ...sessionDto(db, row), progress: item ? { currentTime: item.current_time, watchedSeconds: item.watched_seconds, watchedPercent: item.duration ? Math.min(100, Math.round(item.watched_seconds / item.duration * 100)) : 0, completed: Boolean(item.completed_at) } : { currentTime: 0, watchedSeconds: 0, watchedPercent: 0, completed: false } }
    }))
  })

  app.get('/api/session-assets/:id/access', (req, res) => {
    const user = readSession(req)
    if (!user) return res.status(401).json({ error: 'ابتدا وارد حساب کاربری شوید.' })
    const asset = db.prepare(`SELECT a.*, s.course_id FROM session_assets a JOIN course_sessions s ON s.id = a.session_id WHERE a.id = ?`).get(req.params.id) as any
    if (!asset || !canAccessCourse(db, user, asset.course_id)) return res.status(403).json({ error: 'به این فایل دسترسی ندارید.' })
    if (asset.external_url) {
      const external = safeHttpUrl(asset.external_url)
      if (!external) return res.status(400).json({ error: 'لینک قدیمی ویدئو معتبر نیست؛ مدیر باید فایل را جایگزین کند.' })
      return res.json({ url: external, external: true })
    }
    res.json({ url: `/api/session-assets/${asset.id}/file?token=${encodeURIComponent(createAssetToken(asset.id, user.id))}`, external: false })
  })

  app.get('/api/session-assets/:id/file', (req, res) => {
    if (!verifyAssetToken(clean(req.query.token, 2000), req.params.id)) return res.status(401).json({ error: 'لینک فایل منقضی یا نامعتبر است.' })
    const asset = db.prepare('SELECT * FROM session_assets WHERE id = ?').get(req.params.id) as any
    if (!asset?.storage_name) return res.status(404).end()
    const filePath = path.join(uploadDir, path.basename(asset.storage_name))
    if (!fs.existsSync(filePath)) return res.status(404).end()
    const size = fs.statSync(filePath).size
    res.setHeader('Content-Type', asset.mime_type || 'application/octet-stream')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.setHeader('Content-Disposition', `${['video', 'image', 'pdf'].includes(asset.kind) ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(asset.original_name)}`)
    const range = req.headers.range
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range)
      if (!match) return res.status(416).end()
      const start = Number(match[1])
      const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
      if (start >= size || end < start) return res.status(416).end()
      res.status(206).set({ 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) })
      fs.createReadStream(filePath, { start, end }).pipe(res)
    } else {
      res.setHeader('Content-Length', String(size))
      fs.createReadStream(filePath).pipe(res)
    }
  })

  app.post('/api/sessions/:id/progress', requireStudent, (req, res) => {
    const user = res.locals.session as SessionUser
    const lesson = db.prepare('SELECT * FROM course_sessions WHERE id = ? AND is_published = 1').get(req.params.id) as any
    if (!lesson) return res.status(404).json({ error: 'جلسه پیدا نشد.' })
    if (!canAccessCourse(db, user, lesson.course_id)) return res.status(403).json({ error: 'به این جلسه دسترسی ندارید.' })
    const localVideo = db.prepare("SELECT 1 FROM session_assets WHERE session_id = ? AND kind = 'video' AND storage_name IS NOT NULL").get(lesson.id)
    if (!localVideo) return res.status(409).json({ error: 'این جلسه هنوز ویدئوی داخلی قابل رهگیری ندارد.' })
    const position = Math.max(0, Number(req.body.currentTime || 0))
    const reportedDuration = Math.max(0, Number(req.body.duration || 0))
    const playing = req.body.playing === true
    const current = db.prepare('SELECT * FROM session_progress WHERE user_id = ? AND session_id = ?').get(user.id, lesson.id) as any
    const timestamp = Date.now()
    const duration = Number(lesson.duration_seconds)
    const durationMismatch = reportedDuration <= 0 || Math.abs(reportedDuration - duration) > Math.max(0.5, duration * 0.03)
    if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0 || durationMismatch || position > duration + 3) return res.status(400).json({ error: 'اطلاعات پخش ویدئو با تنظیمات جلسه هماهنگ نیست.' })
    let ranges = parseJson<Array<[number, number]>>(current?.watched_ranges, [])
    if (current?.last_heartbeat_at && playing && !current.completed_at) {
      const elapsed = Math.max(0, (timestamp - new Date(current.last_heartbeat_at).getTime()) / 1000)
      const delta = position - Number(current.last_position || 0)
      const plausible = elapsed <= 30 && delta > 0 && delta <= Math.max(3, elapsed * 2.5 + 1)
      if (plausible) ranges = mergeRanges(ranges, [Number(current.last_position || 0), Math.min(position, duration)])
    }
    const watched = Math.min(duration, watchedSeconds(ranges))
    const completed = Boolean(current?.completed_at) || watched >= duration * 0.75
    const completedAt = current?.completed_at || (completed ? now() : null)
    db.prepare(`INSERT INTO session_progress
      (user_id, session_id, current_time, duration, watched_seconds, watched_ranges, last_position, last_heartbeat_at, completed_at, xp_awarded, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, session_id) DO UPDATE SET current_time=excluded.current_time, duration=excluded.duration,
      watched_seconds=excluded.watched_seconds, watched_ranges=excluded.watched_ranges, last_position=excluded.last_position,
      last_heartbeat_at=excluded.last_heartbeat_at, completed_at=COALESCE(session_progress.completed_at, excluded.completed_at), updated_at=excluded.updated_at`
    ).run(user.id, lesson.id, position, duration, watched, JSON.stringify(ranges), position, now(), completedAt, Number(current?.xp_awarded || 0), now())
    let xpAwarded = 0
    if (completed && !current?.xp_awarded) {
      const result = db.prepare(`INSERT OR IGNORE INTO xp_ledger
        (id, user_id, delta, event_type, reference_id, reason, source, created_at) VALUES (?, ?, ?, 'complete_session', ?, ?, 'system', ?)`
      ).run(uid('xp'), user.id, Number(lesson.xp_reward), lesson.id, `تکمیل جلسه «${lesson.title}»`, now())
      if (result.changes) {
        xpAwarded = Number(lesson.xp_reward)
        db.prepare('UPDATE student_profiles SET xp = xp + ?, updated_at = ?, last_activity_at = ? WHERE user_id = ?').run(xpAwarded, now(), now(), user.id)
      }
      db.prepare('UPDATE session_progress SET xp_awarded = 1 WHERE user_id = ? AND session_id = ?').run(user.id, lesson.id)
      addNotification(db, user.id, `session-complete:${lesson.id}`, 'session_complete', 'جلسه کامل شد 🎉', `برای تکمیل «${lesson.title}» ${lesson.xp_reward} امتیاز گرفتی.`)
    }
    res.json({ watchedSeconds: watched, watchedPercent: Math.min(100, Math.round(watched / duration * 100)), completed, xpAwarded })
  })

  app.get('/api/site-messages', (_req, res) => {
    res.json(db.prepare(`SELECT id, name, body, rating, admin_reply AS adminReply, featured, created_at AS createdAt
      FROM site_messages WHERE status = 'approved' ORDER BY featured DESC, created_at DESC LIMIT 24`).all())
  })

  app.post('/api/site-messages', (req, res) => {
    const rateKey = req.ip || 'unknown'
    const cutoff = Date.now() - 10 * 60_000
    const hits = (messageHits.get(rateKey) || []).filter((stamp) => stamp > cutoff)
    if (hits.length >= 5) return res.status(429).json({ error: 'تعداد پیام‌ها زیاد است؛ چند دقیقه بعد دوباره تلاش کنید.' })
    hits.push(Date.now()); messageHits.set(rateKey, hits)
    const user = readSession(req)
    const name = clean(user?.name || req.body.name, 100)
    const body = clean(req.body.body, 1200)
    const rating = Math.max(1, Math.min(5, Math.floor(Number(req.body.rating || 5))))
    if (name.length < 2 || body.length < 5) return res.status(400).json({ error: 'نام و متن نظر را کامل وارد کنید.' })
    const id = uid('message')
    db.prepare(`INSERT INTO site_messages (id, user_id, name, body, rating, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).run(id, user?.role === 'student' ? user.id : null, name, body, rating, now(), now())
    res.status(201).json({ id, message: 'نظر شما ثبت شد و پس از بررسی نمایش داده می‌شود.' })
  })

  app.get('/api/admin/site-messages', requireAdminSession, (_req, res) => {
    res.json(db.prepare(`SELECT id, user_id AS userId, name, body, rating, status, admin_reply AS adminReply,
      featured, created_at AS createdAt, updated_at AS updatedAt FROM site_messages ORDER BY created_at DESC`).all())
  })

  app.patch('/api/admin/site-messages/:id', requireAdminSession, (req, res) => {
    const current = db.prepare('SELECT * FROM site_messages WHERE id = ?').get(req.params.id) as any
    if (!current) return res.status(404).json({ error: 'پیام پیدا نشد.' })
    const status = ['pending', 'approved', 'rejected'].includes(req.body.status) ? req.body.status : current.status
    const reply = req.body.adminReply === undefined ? current.admin_reply : clean(req.body.adminReply, 1200)
    const featured = req.body.featured === undefined ? current.featured : req.body.featured ? 1 : 0
    db.prepare('UPDATE site_messages SET status = ?, admin_reply = ?, featured = ?, updated_at = ? WHERE id = ?').run(status, reply || null, featured, now(), current.id)
    if (current.user_id && reply) addNotification(db, current.user_id, `message-reply:${current.id}:${crypto.createHash('sha1').update(reply).digest('hex').slice(0, 8)}`, 'message_reply', 'پاسخ مدیریت به پیام شما', reply)
    res.json({ success: true })
  })
}
