import { useEffect, useState } from 'react';
import { Megaphone, Reply, Send, Trash2 } from 'lucide-react';
import type { Course } from '../types';

type AdminFetch = (url: string, options?: RequestInit) => Promise<Response>;
type Post = { id: string; parentId?: string; courseId: string; body: string; author: string; isAnnouncement: boolean; createdAt: string };

export default function ClubAdmin({ adminFetch, courses }: { adminFetch: AdminFetch; courses: Course[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [posts, setPosts] = useState<Post[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [replyTo, setReplyTo] = useState<Post | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { if (!courseId && courses[0]) setCourseId(courses[0].id); }, [courses, courseId]);
  const load = async () => {
    if (!courseId) return;
    const response = await adminFetch(`/api/admin/club?courseId=${encodeURIComponent(courseId)}&limit=200`);
    if (response.ok) setPosts(await response.json());
  };
  useEffect(() => { load().catch(console.error); }, [courseId]);

  const publish = async () => {
    if (!announcement.trim()) return;
    const response = await adminFetch('/api/admin/club/announcement', { method: 'POST', body: JSON.stringify({ courseId, body: announcement }) });
    if (response.ok) { setAnnouncement(''); setMessage('اعلان دوره منتشر شد.'); await load(); }
  };
  const reply = async () => {
    if (!replyTo || !replyBody.trim()) return;
    const response = await adminFetch('/api/admin/club/reply', { method: 'POST', body: JSON.stringify({ courseId, parentId: replyTo.id, body: replyBody }) });
    if (response.ok) { setReplyBody(''); setReplyTo(null); setMessage('پاسخ مدیر ثبت شد.'); await load(); }
  };
  const remove = async (post: Post) => {
    if (!confirm(`پیام «${post.author}» حذف شود؟`)) return;
    const response = await adminFetch(`/api/club/${post.id}`, { method: 'DELETE' });
    if (response.ok) { setMessage('پیام حذف شد.'); await load(); }
  };

  return <div className="space-y-5">
    <div><h2 className="text-2xl font-black text-slate-950">مدیریت باشگاه رفیق‌ها</h2><p className="mt-1 text-sm text-slate-500">پیام‌های هر دوره را جدا ببینید، پاسخ دهید یا حذف کنید.</p></div>
    <select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="input-admin w-full max-w-xl"><option value="">انتخاب دوره</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select>
    {message && <button onClick={() => setMessage('')} className="w-full rounded-2xl bg-emerald-50 p-3 text-right text-xs font-bold text-emerald-700">{message}</button>}
    <section className="rounded-3xl border border-amber-100 bg-white p-5"><h3 className="flex items-center gap-2 font-black"><Megaphone className="h-5 w-5 text-amber-500" />اعلان برای همین دوره</h3><textarea value={announcement} onChange={(event) => setAnnouncement(event.target.value)} className="input-admin mt-3 min-h-24 w-full" placeholder="متن اعلان…" /><button type="button" onClick={publish} className="mt-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-black text-white">انتشار اعلان</button></section>
    {replyTo && <section className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5"><h3 className="font-black text-indigo-900">پاسخ به {replyTo.author}</h3><p className="mt-2 line-clamp-2 text-xs text-indigo-600">{replyTo.body}</p><textarea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} className="input-admin mt-3 min-h-24 w-full bg-white" placeholder="پاسخ مدیر…" /><div className="mt-2 flex gap-2"><button type="button" onClick={reply} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white"><Send className="h-4 w-4" />ثبت پاسخ</button><button type="button" onClick={() => setReplyTo(null)} className="rounded-xl bg-white px-4 text-xs font-bold text-slate-500">لغو</button></div></section>}
    <div className="space-y-3">{posts.map((post) => <article key={post.id} className={`rounded-3xl border bg-white p-5 ${post.isAnnouncement ? 'border-amber-200' : 'border-slate-200'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><b className="text-sm text-slate-900">{post.author}</b><p className="mt-1 text-[10px] text-slate-400">{new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(post.createdAt))}{post.parentId ? ' · پاسخ' : ''}</p></div><div className="flex gap-2"><button onClick={() => setReplyTo(post)} className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700"><Reply className="h-4 w-4" />پاسخ</button><button onClick={() => remove(post)} className="rounded-xl bg-rose-50 p-2 text-rose-600" title="حذف"><Trash2 className="h-4 w-4" /></button></div></div><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{post.body}</p></article>)}{courseId && !posts.length && <p className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">پیامی در این دوره ثبت نشده است.</p>}</div>
  </div>;
}
