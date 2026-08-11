import type { ApiError } from './types'

export const studentTokenKey = 'skillup_student_token'
export const adminTokenKey = 'skillup_admin_token'

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(studentTokenKey) || localStorage.getItem(adminTokenKey)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  })
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await authenticatedFetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiError
    throw new Error(body.error || 'درخواست با خطا روبه‌رو شد.')
  }

  return response.json() as Promise<T>
}

export function normalizePhone(value: string) {
  const persian = '۰۱۲۳۴۵۶۷۸۹'
  const arabic = '٠١٢٣٤٥٦٧٨٩'
  return value
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
    .replace(/[\s-]/g, '')
}

export function isIranPhone(value: string) {
  return /^09\d{9}$/.test(normalizePhone(value))
}
