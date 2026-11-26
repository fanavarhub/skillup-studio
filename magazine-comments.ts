import type { Express, Request, Response } from 'express'
import { DatabaseSync } from 'node:sqlite'
import fs from 'fs'
import { readSession, requireAdminSession } from './auth'
import { magazineArticles } from './src/articleData'

export const MAX_COMMENT_DEPTH = 5
const articles = [{ slug: 'scratch-costume-animation', title: 'ساخت انیمیشن در اسکرچ با کاستیوم' }, { slug: 'download-scratch', title: 'دانلود اسکرچ' }, ...magazineArticles.map(({ slug, title }) => ({ slug, title }))]
const slugs = new Set(articles.map(item => item.slug))
type Row = { id: number; article_slug: string; parent_id: number | null; root_id: number | null; depth: number; author_id: string | null; author_role: string; author_name: string; body: string; deleted_at: string | null; created_at: string; pin: string }

export function mountMagazineComments(app: Express, db: DatabaseSync, legacyPath: string) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS magazine_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_slug TEXT NOT NULL,
      parent_id INTEGER,
      root_id INTEGER,
      depth INTEGER NOT NULL CHECK(depth BETWEEN 0 AND 5),
      author_id TEXT,
      author_role TEXT NOT NULL CHECK(author_role IN ('student','admin','legacy')),
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      pin TEXT NOT NULL DEFAULT 'none' CHECK(pin IN ('none','gold','diamond')),
      legacy_id INTEGER UNIQUE,
      CHECK ((parent_id IS NULL AND root_id IS NULL AND depth = 0) OR (parent_id IS NOT NULL AND root_id IS NOT NULL AND depth > 0))
    );
    CREATE INDEX IF NOT EXISTS idx_magazine_roots ON magazine_comments(article_slug, parent_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_magazine_replies ON magazine_comments(article_slug, root_id, id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_magazine_diamond ON magazine_comments(article_slug) WHERE pin='diamond' AND deleted_at IS NULL;
  `)
  // The old lesson store is read only during this idempotent migration.
  if (fs.existsSync(legacyPath)) {
    const legacy = new DatabaseSync(legacyPath, { readOnly: true })
    try {
      const table = legacy.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='lesson_comments'").get()
      if (table) {
        const insert = db.prepare("INSERT OR IGNORE INTO magazine_comments(article_slug,parent_id,root_id,depth,author_id,author_role,author_name,body,deleted_at,created_at,pin,legacy_id) VALUES ('scratch-costume-animation',NULL,NULL,0,NULL,'legacy',?,?,NULL,?,'none',?)")
        for (const row of legacy.prepare("SELECT id,name,body,state,created_at FROM lesson_comments WHERE state='approved'").all() as { id: number; name: string; body: string; state: string; created_at: number }[]) {
          insert.run(row.name, row.body, new Date(row.created_at).toISOString(), row.id)
        }
      }
    } finally { legacy.close() }
  }

  const get = db.prepare('SELECT * FROM magazine_comments WHERE id=?')
  const visible = (row: Row) => ({ id: row.id, parentId: row.parent_id, rootId: row.root_id, depth: row.depth, name: row.deleted_at ? '' : row.author_name, role: row.deleted_at ? '' : row.author_role, body: row.deleted_at ? '' : row.body, deleted: Boolean(row.deleted_at), createdAt: row.created_at, pin: row.deleted_at ? 'none' : row.pin })
  const validArticle = (req: Request, res: Response) => {
    const slug = String(req.params.slug || '')
    if (!slugs.has(slug)) { res.status(404).json({ error: 'مقاله پیدا نشد.' }); return null }
    return slug
  }
  const validId = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
  const cursor = (value: unknown) => typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null

  app.get('/api/magazine/articles', requireAdminSession, (_req, res) => res.json(articles))
  app.get('/api/magazine/:slug/session', (req, res) => {
    if (!validArticle(req, res)) return
    const session = readSession(req)
    if (!session) return res.json({ authenticated: false })
    if (session.role === 'student') {
      const user = db.prepare("SELECT name FROM users WHERE id=? AND role='student'").get(session.id) as { name: string } | undefined
      if (!user) return res.json({ authenticated: false })
      return res.json({ authenticated: true, name: user.name, role: 'student' })
    }
    res.json({ authenticated: true, name: 'مدیر اسکیل‌آپ', role: 'admin' })
  })
  app.get('/api/magazine/:slug/comments', (req, res) => {
    const slug = validArticle(req, res); if (!slug) return
    const before = req.query.before === undefined ? Number.MAX_SAFE_INTEGER : cursor(req.query.before)
    if (before === null) return res.status(400).json({ error: 'صفحهٔ دیدگاه معتبر نیست.' })
    const rows = db.prepare("SELECT * FROM magazine_comments WHERE article_slug=? AND parent_id IS NULL AND id<? ORDER BY id DESC LIMIT 11").all(slug, before) as Row[]
    const pins = db.prepare("SELECT * FROM magazine_comments WHERE article_slug=? AND parent_id IS NULL AND pin!='none' AND deleted_at IS NULL ORDER BY CASE pin WHEN 'diamond' THEN 0 ELSE 1 END, id DESC").all(slug) as Row[]
    res.json({ comments: rows.slice(0, 10).map(visible), pins: pins.map(visible), next: rows.length > 10 ? rows[9].id : null })
  })
  app.get('/api/magazine/:slug/comments/:id/replies', (req, res) => {
    const slug = validArticle(req, res); if (!slug) return
    const id = cursor(req.params.id), after = req.query.after === undefined ? 0 : cursor(req.query.after)
    if (id === null || after === null) return res.status(400).json({ error: 'شمارهٔ دیدگاه معتبر نیست.' })
    const root = get.get(id) as Row | undefined
    if (!root || root.article_slug !== slug || root.parent_id !== null) return res.status(404).json({ error: 'گفت‌وگو پیدا نشد.' })
    const rows = db.prepare('SELECT * FROM magazine_comments WHERE article_slug=? AND root_id=? AND id>? ORDER BY id LIMIT 31').all(slug, id, after) as Row[]
    res.json({ comments: rows.slice(0, 30).map(visible), next: rows.length > 30 ? rows[29].id : null })
  })
  const recent = new Map<string, number[]>()
  app.post('/api/magazine/:slug/comments', (req, res) => {
    const slug = validArticle(req, res); if (!slug) return
    const session = readSession(req)
    if (!session) return res.status(401).json({ error: 'برای گذاشتن دیدگاه، اول وارد اسکیل‌آپ شو.' })
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
    if (body.length < 2 || body.length > 1200) return res.status(400).json({ error: 'دیدگاه باید بین ۲ تا ۱۲۰۰ نویسه باشد.' })
    if (req.body?.parentId !== undefined && req.body?.parentId !== null && !validId(req.body.parentId)) return res.status(400).json({ error: 'پاسخ معتبر نیست.' })
    const parent = req.body?.parentId ? get.get(req.body.parentId) as Row | undefined : null
    if (req.body?.parentId && (!parent || parent.article_slug !== slug)) return res.status(400).json({ error: 'این دیدگاه متعلق به مقالهٔ دیگری است.' })
    if (parent?.deleted_at) return res.status(400).json({ error: 'به دیدگاه حذف‌شده نمی‌توان پاسخ داد.' })
    if (parent && parent.depth >= MAX_COMMENT_DEPTH) return res.status(400).json({ error: 'این گفت‌وگو به ۵ لایهٔ پاسخ رسیده است. به دیدگاه بالاتر پاسخ بده.' })
    const user = session.role === 'student' ? db.prepare("SELECT name FROM users WHERE id=? AND role='student'").get(session.id) as { name: string } | undefined : null
    if (session.role === 'student' && !user) return res.status(401).json({ error: 'حساب کاربری پیدا نشد؛ دوباره وارد شو.' })
    const key = `${session.role}:${session.id}`; const now = Date.now(); const hits = (recent.get(key) || []).filter(time => time > now - 60_000)
    if (hits.length >= 12) return res.status(429).json({ error: 'کمی صبر کن و بعد پیام بعدی را بفرست.' })
    hits.push(now); recent.set(key, hits)
    const result = db.prepare('INSERT INTO magazine_comments(article_slug,parent_id,root_id,depth,author_id,author_role,author_name,body,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(slug, parent?.id ?? null, parent ? parent.root_id ?? parent.id : null, parent ? parent.depth + 1 : 0, session.id, session.role, session.role === 'admin' ? 'مدیر اسکیل‌آپ' : user!.name, body, new Date(now).toISOString())
    res.status(201).json({ comment: visible(get.get(Number(result.lastInsertRowid)) as Row) })
  })
  app.delete('/api/admin/magazine/:slug/comments/:id', requireAdminSession, (req, res) => {
    const slug = validArticle(req, res); if (!slug) return
    const id = cursor(req.params.id); const row = id === null ? null : get.get(id) as Row | undefined
    if (!row || row.article_slug !== slug) return res.status(404).json({ error: 'دیدگاه پیدا نشد.' })
    db.prepare("UPDATE magazine_comments SET body='',author_name='',author_id=NULL,deleted_at=COALESCE(deleted_at,?),pin='none' WHERE id=?").run(new Date().toISOString(), id)
    res.json({ success: true })
  })
  app.patch('/api/admin/magazine/:slug/comments/:id/pin', requireAdminSession, (req, res) => {
    const slug = validArticle(req, res); if (!slug) return
    const id = cursor(req.params.id); const row = id === null ? null : get.get(id) as Row | undefined
    const pin = req.body?.pin
    if (!row || row.article_slug !== slug || row.parent_id !== null || row.deleted_at) return res.status(400).json({ error: 'فقط دیدگاه اصلی منتشرشده را می‌توان پین کرد.' })
    if (!['none','gold','diamond'].includes(pin)) return res.status(400).json({ error: 'نوع پین معتبر نیست.' })
    db.exec('BEGIN IMMEDIATE')
    try {
      if (pin === 'diamond') db.prepare("UPDATE magazine_comments SET pin='none' WHERE article_slug=? AND pin='diamond'").run(slug)
      if (pin === 'gold') {
        const count = db.prepare("SELECT COUNT(*) AS total FROM magazine_comments WHERE article_slug=? AND pin='gold' AND id!=? AND deleted_at IS NULL").get(slug, id) as { total: number }
        if (count.total >= 3) { db.exec('ROLLBACK'); return res.status(409).json({ error: 'برای هر مقاله حداکثر ۳ پین طلایی می‌توان گذاشت.' }) }
      }
      db.prepare('UPDATE magazine_comments SET pin=? WHERE id=?').run(pin, id)
      db.exec('COMMIT')
      res.json({ success: true })
    } catch (error) { db.exec('ROLLBACK'); throw error }
  })
}
