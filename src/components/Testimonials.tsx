import { FormEvent, useEffect, useState } from 'react';
import { MessageCircle, Send, Star } from 'lucide-react';
import { api } from '../api';
import type { SiteMessage } from '../types';

export default function Testimonials() {
  const [items, setItems] = useState<SiteMessage[]>([]);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(5);
  const [notice, setNotice] = useState('');
  useEffect(() => { api<SiteMessage[]>('/api/site-messages').then(setItems).catch(() => undefined); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setNotice('');
    try { const result = await api<{ message: string }>('/api/site-messages', { method: 'POST', body: JSON.stringify({ name, body, rating }) }); setNotice(result.message); setName(''); setBody(''); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : 'ثبت نظر انجام نشد.'); }
  };
  return <section className="bg-slate-50 py-16" dir="rtl">
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="mb-8 text-center"><span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700"><MessageCircle className="h-4 w-4" /> تجربه هنرجوها</span><h2 className="mt-3 text-3xl font-black text-slate-950">از زبان خانواده اسکیل‌آپ</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-500">فقط نظرهایی که مدیریت بررسی و تأیید کرده، در این بخش نمایش داده می‌شوند.</p></div>
      {items.length > 0 && <div className="mb-8 grid gap-4 md:grid-cols-3">{items.slice(0, 6).map((item) => <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-0.5 text-amber-400">{Array.from({ length: item.rating }, (_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div><p className="my-4 text-sm leading-7 text-slate-700">«{item.body}»</p><p className="font-extrabold text-slate-950">{item.name}</p>{item.adminReply && <p className="mt-3 rounded-xl bg-indigo-50 p-3 text-xs leading-6 text-indigo-700"><strong>پاسخ اسکیل‌آپ:</strong> {item.adminReply}</p>}</article>)}</div>}
      <form onSubmit={submit} className="mx-auto grid max-w-3xl gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[180px_1fr]">
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="نام شما" className="input-admin" />
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="input-admin"><option value="5">۵ ستاره</option><option value="4">۴ ستاره</option><option value="3">۳ ستاره</option><option value="2">۲ ستاره</option><option value="1">۱ ستاره</option></select>
        <textarea required minLength={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="تجربه یا پیام شما…" className="input-admin min-h-24 md:col-span-2" />
        {notice && <p className="text-sm text-indigo-700 md:col-span-2">{notice}</p>}
        <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white md:col-span-2"><Send className="h-4 w-4" />ارسال برای بررسی</button>
      </form>
    </div>
  </section>;
}
