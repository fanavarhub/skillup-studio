import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';

type AdminFetch = (url: string, options?: RequestInit) => Promise<Response>;
type ResetRequest = { id: string; phone: string; name: string; status: string; createdAt: string };

export default function PasswordResetManager({ adminFetch }: { adminFetch: AdminFetch }) {
  const [items, setItems] = useState<ResetRequest[]>([]);
  const [credentials, setCredentials] = useState<Record<string, { username: string; temporaryPassword: string }>>({});
  const [copied, setCopied] = useState('');
  const load = async () => { const response = await adminFetch('/api/admin/password-reset-requests'); if (response.ok) setItems(await response.json()); };
  useEffect(() => { load().catch(console.error); }, []);
  const resolve = async (item: ResetRequest) => { const response = await adminFetch(`/api/admin/password-reset-requests/${item.id}/resolve`, { method: 'POST' }); const data = await response.json(); if (response.ok) { setCredentials((values) => ({ ...values, [item.id]: data.credentials })); await load(); } };
  const copy = async (id: string, value: string) => { await navigator.clipboard.writeText(value); setCopied(id); window.setTimeout(() => setCopied(''), 1600); };
  return <section className="space-y-3"><div><h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><KeyRound className="h-5 w-5 text-violet-600" />بازیابی رمز هنرجوها</h2><p className="mt-1 text-xs text-slate-500">رمز موقت فقط یک‌بار نمایش داده می‌شود؛ آن را برای هنرجو ارسال کنید.</p></div>{items.map((item) => <article key={item.id} className="rounded-3xl border border-violet-100 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><b>{item.name}</b><p className="mt-1 text-xs text-slate-500" dir="ltr">{item.phone}</p></div>{item.status === 'pending' ? <button onClick={() => resolve(item)} className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white">ساخت رمز موقت</button> : <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">رسیدگی شده</span>}</div>{credentials[item.id] && <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-xs"><p>نام کاربری: <b dir="ltr">{credentials[item.id].username}</b></p><p className="mt-2">رمز موقت: <b dir="ltr">{credentials[item.id].temporaryPassword}</b></p><button onClick={() => copy(item.id, `نام کاربری: ${credentials[item.id].username}\nرمز موقت: ${credentials[item.id].temporaryPassword}`)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 font-black text-emerald-700">{copied === item.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}کپی اطلاعات</button></div>}</article>)}{!items.length && <p className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">درخواست بازیابی رمزی وجود ندارد.</p>}</section>;
}
