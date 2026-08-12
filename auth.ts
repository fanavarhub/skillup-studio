import crypto from 'crypto'
import type { NextFunction, Request, Response } from 'express'

export type SessionRole = 'student' | 'admin'

export interface SessionUser {
  id: string
  name: string
  phone: string
  role: SessionRole
  exp: number
}

const SESSION_DURATION_SECONDS = 8 * 60 * 60
const ASSET_TOKEN_DURATION_SECONDS = 15 * 60
const configuredSecret = process.env.SKILLUP_SESSION_SECRET

if (process.env.NODE_ENV === 'production' && (!configuredSecret || configuredSecret.length < 32)) {
  throw new Error('SKILLUP_SESSION_SECRET must be at least 32 characters in production.')
}

const sessionSecret = configuredSecret || crypto.createHash('sha256').update(`skillup-local-${process.cwd()}`).digest('hex')

function sign(payload: string) {
  return crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url')
}

export function createSessionToken(user: Omit<SessionUser, 'exp'>) {
  const body = Buffer.from(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS })).toString('base64url')
  return `${body}.${sign(body)}`
}

export function createAssetToken(assetId: string, userId: string) {
  const body = Buffer.from(JSON.stringify({ assetId, userId, exp: Math.floor(Date.now() / 1000) + ASSET_TOKEN_DURATION_SECONDS })).toString('base64url')
  return `${body}.${sign(`asset:${body}`)}`
}

export function verifyAssetToken(token: string, assetId: string) {
  const [body, supplied] = token.split('.')
  if (!body || !supplied) return null
  const expected = sign(`asset:${body}`)
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { assetId: string; userId: string; exp: number }
    return payload.assetId === assetId && payload.userId && payload.exp >= Math.floor(Date.now() / 1000) ? payload : null
  } catch {
    return null
  }
}

export function readSession(req: Request): SessionUser | null {
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const [body, supplied] = token.split('.')
  if (!body || !supplied) return null
  const expected = sign(body)
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return null
  try {
    const session = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionUser
    return session.id && session.role && session.exp >= Math.floor(Date.now() / 1000) ? session : null
  } catch {
    return null
  }
}

export function requireStudent(req: Request, res: Response, next: NextFunction) {
  const session = readSession(req)
  if (!session || session.role !== 'student') {
    res.status(401).json({ error: 'برای ادامه ابتدا وارد حساب هنرجویی شوید.' })
    return
  }
  res.locals.session = session
  next()
}

export function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  const session = readSession(req)
  if (!session || session.role !== 'admin') {
    res.status(401).json({ error: 'این عملیات فقط برای مدیر مجاز است.' })
    return
  }
  res.locals.session = session
  next()
}

export const sessionDurationMs = SESSION_DURATION_SECONDS * 1000
