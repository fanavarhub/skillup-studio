import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { HttpError } from './validation.mjs';

function unpack(row) {
  return { id: row.id, created_at: row.created_at, version: row.version, contact: { full_name: row.full_name, phone: row.phone }, answers: JSON.parse(row.answers_json), priorities: JSON.parse(row.priorities_json), feedback: row.feedback };
}

export class SurveyStore {
  constructor(directory) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.path = join(directory, 'survey.sqlite');
    this.db = new DatabaseSync(this.path);
    try { chmodSync(this.path, 0o600); } catch { /* ACLs apply on Windows. */ }
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS responses (
        id TEXT PRIMARY KEY, created_at TEXT NOT NULL, version TEXT NOT NULL,
        full_name TEXT, phone TEXT, answers_json TEXT NOT NULL, priorities_json TEXT NOT NULL,
        feedback TEXT, payload_hash TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS responses_created_at ON responses(created_at);
      CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
      PRAGMA user_version=1;`);
  }
  save(response, now = new Date()) {
    const hash = createHash('sha256').update(JSON.stringify(response)).digest('hex');
    const previous = this.db.prepare('SELECT payload_hash FROM responses WHERE id = ?').get(response.id);
    if (previous) {
      if (previous.payload_hash !== hash) throw new HttpError(409, 'این نظر قبلاً ثبت شده است. برای ثبت نظر تازه، صفحه را دوباره باز کنید.');
      return { receipt: response.id, duplicate: true };
    }
    this.db.prepare('INSERT INTO responses (id,created_at,version,full_name,phone,answers_json,priorities_json,feedback,payload_hash) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(response.id, now.toISOString(), response.version, response.contact.full_name, response.contact.phone, JSON.stringify(response.answers), JSON.stringify(response.priorities), response.feedback, hash);
    return { receipt: response.id, duplicate: false };
  }
  all() { return this.db.prepare('SELECT * FROM responses ORDER BY created_at DESC, id DESC').all().map(unpack); }
  page(page = 1, search = '') {
    const offset = (page - 1) * 25;
    const escaped = search.replace(/[\\%_]/g, value => `\\${value}`);
    const term = `%${escaped}%`;
    const where = search ? "WHERE full_name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR feedback LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\'" : '';
    const parameters = search ? [term, term, term, term] : [];
    const total = this.db.prepare(`SELECT COUNT(*) AS count FROM responses ${where}`).get(...parameters).count;
    const rows = this.db.prepare(`SELECT * FROM responses ${where} ORDER BY created_at DESC, id DESC LIMIT 25 OFFSET ?`).all(...parameters, offset).map(unpack);
    return { rows, total, page, page_size: 25 };
  }
  addSession(hash, expires) {
    this.db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(Date.now());
    this.db.prepare('INSERT INTO admin_sessions (token_hash,expires_at) VALUES (?,?)').run(hash, expires);
  }
  validSession(hash) { return Boolean(this.db.prepare('SELECT 1 FROM admin_sessions WHERE token_hash = ? AND expires_at > ?').get(hash, Date.now())); }
  removeSession(hash) { this.db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(hash); }
  backup(destination) { this.db.prepare('VACUUM INTO ?').run(destination); }
  close() { this.db.close(); }
}
