import { useEffect, useState } from 'react';
import { CheckCircle2, MessageCircleReply, Star, XCircle } from 'lucide-react';
import type { SiteMessage } from '../types';

type AdminFetch = (url: string, options?: RequestInit) => Promise<Response>;

export default function MessageManager({ adminFetch }: { adminFetch: AdminFetch }) {
  const [messages, setMessages] = useState<SiteMessage[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const load = async () => { const response = await adminFetch('/api/admin/site-messages'); if (response.ok) setMessages(await response.json()); };
  useEffect(() => { load(); }, []);
  const save = async (item: SiteMessage, patch: Partial<SiteMessage>) => {
    const response = await adminFetch(`/api/admin/site-messages/${item.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    if (response.ok) { setNotice('تغییرات پیام ذخیره شد.'); await load(); }
  };
  return <div className="space-y-4">
    <div><h2 className="text-2xl font-black text-slate-950">نظرها و پیام‌ها</h2><p className="mt-1 text-sm text-slate-500">نظر را بررسی کنید، پاسخ بدهید و موارد مناسب را در صفحه اصلی نمایش دهید.</p></div>
    {notice && <div className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{notice}</div>}
    {!messages.length && <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">پیامی ثبت نشده است.</div>}
    {messages.map((item) => <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><h3 className="font-black text-slate-900">{item.name}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : item.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{item.status === 'approved' ? 'تأیید شده' : item.status === 'rejected' ? 'رد شده' : 'در انتظار'}</span></div><div className="mt-1 flex gap-0.5 text-amber-400">{Array.from({ length: item.rating }, (_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}</div></div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={Boolean(item.featured)} onChange={(e) => save(item, { featured: e.target.checked })} /> نمایش ویژه در صفحه اصلی</label>
      </div>
      <p className="my-4 whitespace-pre-line text-sm leading-7 text-slate-700">{item.body}</p>
      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
        <input value={replies[item.id] ?? item.adminReply ?? ''} onChange={(e) => setReplies({ ...replies, [item.id]: e.target.value })} placeholder="پاسخ مدیریت…" className="input-admin" />
        <button onClick={() => save(item, { status: 'approved', adminReply: replies[item.id] ?? item.adminReply ?? '' })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"><CheckCircle2 className="h-4 w-4" />تأیید و پاسخ</button>
        <button onClick={() => save(item, { status: 'rejected' })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700"><XCircle className="h-4 w-4" />رد</button>
      </div>
      {item.adminReply && <p className="mt-3 flex gap-2 rounded-xl bg-indigo-50 p-3 text-xs leading-6 text-indigo-800"><MessageCircleReply className="h-4 w-4 shrink-0" /> پاسخ فعلی: {item.adminReply}</p>}
    </article>)}
  </div>;
}
