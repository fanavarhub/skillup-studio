import crypto from 'crypto'
import type { Express, Request, Response } from 'express'
import { DatabaseSync } from 'node:sqlite'
import { requireAdminSession } from './auth'
import { magazineArticleRegistry } from './magazine-comments'

type Visit = { id: string; article_slug: string; day: string; started_at: string; last_seen_at: string; last_seq: number; active_seconds: number; max_scroll: number }
type SectionInput = { key: string; label: string; seconds: number }
const slugs = new Set(magazineArticleRegistry.map(item => item.slug))
const dayInTehran = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (type: string) => parts.find(item => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function mountMagazineAnalytics(app: Express, db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS magazine_visits (
      id TEXT PRIMARY KEY,
      article_slug TEXT NOT NULL,
      day TEXT NOT NULL,
      started_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      last_seq INTEGER NOT NULL DEFAULT 0,
      active_seconds INTEGER NOT NULL DEFAULT 0,
      max_scroll INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_magazine_visits_article_day ON magazine_visits(article_slug,day);
    CREATE TABLE IF NOT EXISTS magazine_visit_sections (
      visit_id TEXT NOT NULL,
      section_key TEXT NOT NULL,
      label TEXT NOT NULL,
      active_seconds INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (visit_id,section_key)
    );
  `)
  const find = db.prepare('SELECT * FROM magazine_visits WHERE id=?')
  let lastPrune = 0
  const prune = () => {
    if (Date.now() - lastPrune < 86_400_000) return
    const cutoff = dayInTehran(new Date(Date.now() - 91 * 86_400_000))
    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare('DELETE FROM magazine_visit_sections WHERE visit_id IN (SELECT id FROM magazine_visits WHERE day<?)').run(cutoff)
      db.prepare('DELETE FROM magazine_visits WHERE day<?').run(cutoff)
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
    lastPrune = Date.now()
  }
  prune()
  const validArticle = (req: Request, res: Response) => {
    const slug = String(req.params.slug || '')
    if (!slugs.has(slug)) { res.status(404).json({ error: 'مقاله پیدا نشد.' }); return null }
    return slug
  }
  const sameOrigin = (req: Request, res: Response) => {
    const origin = req.get('origin')
    if (origin && origin !== `${req.protocol}://${req.get('host')}`) { res.status(403).json({ error: 'درخواست از دامنهٔ دیگری پذیرفته نیست.' }); return false }
    return true
  }
  const starts = new Map<string, number[]>()
  app.post('/api/magazine/:slug/visits', (req, res) => {
    const slug = validArticle(req, res); if (!slug || !sameOrigin(req, res)) return
    const key = req.ip || 'unknown'; const now = Date.now()
    const recent = (starts.get(key) || []).filter(time => time > now - 60_000)
    if (recent.length >= 30) return res.status(429).json({ error: 'کمی بعد دوباره تلاش کن.' })
    recent.push(now); starts.set(key, recent)
    if (starts.size > 5000) for (const [address, times] of starts) if (times.at(-1)! < now - 60_000) starts.delete(address)
    prune()
    const id = crypto.randomUUID()
    const date = new Date(now)
    db.prepare('INSERT INTO magazine_visits(id,article_slug,day,started_at,last_seen_at) VALUES (?,?,?,?,?)').run(id, slug, dayInTehran(date), date.toISOString(), date.toISOString())
    res.status(201).json({ visitId: id })
  })
  app.post('/api/magazine/:slug/visits/:id', (req, res) => {
    const slug = validArticle(req, res); if (!slug || !sameOrigin(req, res)) return
    const id = String(req.params.id || '')
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'شناسهٔ بازدید معتبر نیست.' })
    const visit = find.get(id) as Visit | undefined
    if (!visit || visit.article_slug !== slug) return res.status(404).json({ error: 'بازدید پیدا نشد.' })
    const { seq, activeSeconds, maxScroll, sections } = req.body || {}
    if (!Number.isSafeInteger(seq) || seq <= visit.last_seq || seq > 1000) return res.status(409).json({ error: 'گزارش تکراری یا نامعتبر است.' })
    if (!Number.isSafeInteger(activeSeconds) || activeSeconds < 0 || activeSeconds > 15) return res.status(400).json({ error: 'زمان معتبر نیست.' })
    if (!Number.isSafeInteger(maxScroll) || maxScroll < 0 || maxScroll > 100) return res.status(400).json({ error: 'میزان پیمایش معتبر نیست.' })
    if (!Array.isArray(sections) || sections.length > 15) return res.status(400).json({ error: 'بخش‌های مقاله معتبر نیستند.' })
    let total = 0
    const cleanSections: SectionInput[] = []
    const seen = new Set<string>()
    for (const item of sections) {
      if (!item || typeof item.key !== 'string' || !/^s[a-z0-9]{1,12}$/.test(item.key) || seen.has(item.key) || typeof item.label !== 'string' || item.label.trim().length < 2 || item.label.length > 90 || !Number.isSafeInteger(item.seconds) || item.seconds < 0 || item.seconds > 15) return res.status(400).json({ error: 'بخش‌های مقاله معتبر نیستند.' })
      seen.add(item.key); total += item.seconds; cleanSections.push({ key: item.key, label: item.label.trim(), seconds: item.seconds })
    }
    if (total > activeSeconds || visit.active_seconds + activeSeconds > 7200) return res.status(400).json({ error: 'زمان گزارش معتبر نیست.' })
    const now = Date.now()
    if (now - Date.parse(visit.started_at) > 4 * 60 * 60_000 || activeSeconds > Math.floor((now - Date.parse(visit.last_seen_at)) / 1000) + 5) return res.status(400).json({ error: 'زمان گزارش معتبر نیست.' })
    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare('UPDATE magazine_visits SET last_seen_at=?,last_seq=?,active_seconds=active_seconds+?,max_scroll=MAX(max_scroll,?) WHERE id=?').run(new Date(now).toISOString(), seq, activeSeconds, maxScroll, id)
      const upsert = db.prepare('INSERT INTO magazine_visit_sections(visit_id,section_key,label,active_seconds) VALUES (?,?,?,?) ON CONFLICT(visit_id,section_key) DO UPDATE SET active_seconds=active_seconds+excluded.active_seconds')
      for (const item of cleanSections) if (item.seconds) upsert.run(id, item.key, item.label, item.seconds)
      db.exec('COMMIT')
      res.json({ success: true })
    } catch (error) { db.exec('ROLLBACK'); throw error }
  })
  app.get('/api/admin/magazine/:slug/analytics', requireAdminSession, (req, res) => {
    const slug = validArticle(req, res); if (!slug) return
    const days = Number(req.query.days || 30)
    if (![7, 30, 90].includes(days)) return res.status(400).json({ error: 'بازهٔ زمانی معتبر نیست.' })
    const since = dayInTehran(new Date(Date.now() - (days - 1) * 86_400_000))
    const summary = db.prepare(`SELECT COUNT(*) AS visits, COALESCE(SUM(active_seconds),0) AS activeSeconds,
      SUM(CASE WHEN active_seconds>=10 THEN 1 ELSE 0 END) AS engagedVisits,
      SUM(CASE WHEN max_scroll>=25 THEN 1 ELSE 0 END) AS scroll25,
      SUM(CASE WHEN max_scroll>=50 THEN 1 ELSE 0 END) AS scroll50,
      SUM(CASE WHEN max_scroll>=75 THEN 1 ELSE 0 END) AS scroll75,
      SUM(CASE WHEN max_scroll>=95 THEN 1 ELSE 0 END) AS scrollEnd
      FROM magazine_visits WHERE article_slug=? AND day>=?`).get(slug, since) as Record<string, number | null>
    const daily = db.prepare('SELECT day,COUNT(*) AS visits,COALESCE(SUM(active_seconds),0) AS activeSeconds FROM magazine_visits WHERE article_slug=? AND day>=? GROUP BY day ORDER BY day').all(slug, since)
    const sections = db.prepare(`SELECT s.section_key AS key,MAX(s.label) AS label,COUNT(*) AS visits,SUM(s.active_seconds) AS activeSeconds
      FROM magazine_visit_sections s JOIN magazine_visits v ON v.id=s.visit_id
      WHERE v.article_slug=? AND v.day>=? GROUP BY s.section_key ORDER BY s.section_key`).all(slug, since)
    res.setHeader('Cache-Control', 'no-store')
    res.json({ articleSlug: slug, days, timezone: 'Asia/Tehran', summary: { ...summary, engagedVisits: summary.engagedVisits || 0, scroll25: summary.scroll25 || 0, scroll50: summary.scroll50 || 0, scroll75: summary.scroll75 || 0, scrollEnd: summary.scrollEnd || 0 }, daily, sections })
  })
}
