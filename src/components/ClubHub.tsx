import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, MessageCircle, Reply, Send, Sparkles } from 'lucide-react';
import { authenticatedFetch } from '../api';
import type { Course } from '../types';

type ClubPost = { id: string; parentId?: string; courseId: string; body: string; author: string; isAnnouncement: boolean; createdAt: string };
type ClubResult = { posts: ClubPost[]; total: number; hasMore: boolean; nextOffset: number };

export default function ClubHub({ courses }: { courses: Course[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<ClubPost | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!courseId && courses[0]) setCourseId(courses[0].id); }, [courses, courseId]);

  const load = async (append = false) => {
    if (!courseId) return;
    const offset = append ? posts.length : 0;
    const response = await authenticatedFetch(`/api/club?courseId=${encodeURIComponent(courseId)}&limit=20&offset=${offset}`);
    const data = await response.json() as ClubResult & { error?: string };
    if (!response.ok) { setError(data.error || 'پیام‌ها بارگذاری نشدند.'); return; }
    setPosts((items) => append ? [...items, ...data.posts] : data.posts);
    setTotal(data.total); setHasMore(data.hasMore); setError('');
  };

  useEffect(() => { setPosts([]); setReplyTo(null); load(false).catch(console.error); }, [courseId]);

  const send = async () => {
    if (!body.trim() || !courseId || busy) return;
    setBusy(true); setError('');
    try {
      const response = await authenticatedFetch('/api/club', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId, category: 'general', body, parentId: replyTo?.id || null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'پیام ارسال نشد.');
      setBody(''); setReplyTo(null); await load(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'پیام ارسال نشد.'); }
    finally { setBusy(false); }
  };

  const roots = useMemo(() => posts.filter((post) => !post.parentId || !posts.some((candidate) => candidate.id === post.parentId)), [posts]);
  const currentCourse = courses.find((course) => course.id === courseId);

  if (!courses.length) return <div className="rounded-[30px] border-2 border-dashed border-sky-200 bg-white p-10 text-center text-sm text-slate-500">برای ورود به باشگاه رفیق‌ها، ابتدا باید یک دوره فعال داشته باشی.</div>;

  return <div className="space-y-5" dir="rtl">
    <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-l from-cyan-600 via-sky-600 to-indigo-600 p-5 text-white shadow-xl shadow-sky-100 sm:p-7">
      <div className="absolute -left-12 -top-12 h-36 w-36 rounded-full border-[20px] border-white/10" />
      <div className="relative flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><motion.span animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2.2 }} className="grid h-16 w-16 place-items-center rounded-3xl bg-white/15 text-4xl">🫶</motion.span><div><p className="text-xs font-black text-cyan-100">گفت‌وگوی امن هم‌کلاسی‌ها</p><h2 className="mt-1 text-2xl font-black">باشگاه رفیق‌ها</h2><p className="mt-1 text-xs text-white/75">هر دوره باشگاه مخصوص خودش را دارد.</p></div></div><span className="rounded-full bg-white/15 px-4 py-2 text-xs font-bold">{total} پیام</span></div>
    </section>

    <div className="flex gap-2 overflow-x-auto rounded-3xl border-2 border-white bg-white p-2 shadow-sm">{courses.map((course) => <button key={course.id} onClick={() => setCourseId(course.id)} className={`shrink-0 rounded-2xl px-4 py-3 text-xs font-black transition ${courseId === course.id ? 'bg-sky-600 text-white shadow-lg shadow-sky-100' : 'bg-slate-50 text-slate-600 hover:bg-sky-50'}`}>{course.title}</button>)}</div>

    <section className="rounded-[30px] border-2 border-sky-100 bg-white p-4 shadow-[0_12px_32px_rgba(14,165,233,.08)] sm:p-6">
      <div className="mb-4 flex items-center gap-2"><MessageCircle className="h-5 w-5 text-sky-600" /><h3 className="font-black text-slate-950">پیام تازه در {currentCourse?.title}</h3></div>
      {replyTo && <div className="mb-2 flex items-center justify-between rounded-2xl bg-indigo-50 p-3 text-xs text-indigo-700"><span className="truncate">پاسخ به {replyTo.author}: {replyTo.body}</span><button onClick={() => setReplyTo(null)} className="mr-3 shrink-0 font-black">لغو</button></div>}
      <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={replyTo ? 'پاسخت را بنویس؛ Enter فقط خط بعدی می‌رود…' : 'یک پیام مفید و دوستانه بنویس؛ Enter فقط خط بعدی می‌رود…'} className="input-admin min-h-28 w-full resize-y leading-7" maxLength={1200} />
      <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[10px] text-slate-400">ارسال فقط با دکمه انجام می‌شود · {body.length}/۱۲۰۰</span><button type="button" disabled={busy || body.trim().length < 2} onClick={send} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-l from-sky-600 to-indigo-600 px-5 py-3 text-xs font-black text-white disabled:opacity-50"><Send className="h-4 w-4" />{busy ? 'در حال ارسال…' : 'ارسال پیام'}</button></div>
      {error && <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
    </section>

    <section className="space-y-3">
      {roots.map((post) => <article key={post.id} className={`rounded-[26px] border p-4 sm:p-5 ${post.isAnnouncement ? 'border-amber-200 bg-gradient-to-l from-amber-50 to-orange-50' : 'border-slate-100 bg-white shadow-sm'}`}>
        <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sky-100">👤</span><div className="min-w-0"><b className="block truncate text-sm text-slate-900">{post.author}</b><time className="text-[10px] text-slate-400">{new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(post.createdAt))}</time></div>{post.isAnnouncement ? <Sparkles className="h-4 w-4 shrink-0 text-amber-500" /> : null}</div><button onClick={() => setReplyTo(post)} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2 text-[11px] font-black text-indigo-700"><Reply className="h-3.5 w-3.5" />پاسخ</button></div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{post.body}</p>
        <ReplyTree posts={posts} parentId={post.id} onReply={setReplyTo} />
      </article>)}
      {!posts.length && <div className="rounded-[28px] border-2 border-dashed border-sky-200 bg-white py-12 text-center text-sm text-slate-400">اولین پیام این باشگاه را تو بنویس 🌱</div>}
      {hasMore && <button onClick={() => load(true)} className="mx-auto flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-black text-sky-700 shadow-sm"><ChevronDown className="h-4 w-4" />نمایش پیام‌های قدیمی‌تر</button>}
    </section>
  </div>;
}

function ReplyTree({ posts, parentId, onReply, depth = 0 }: { posts: ClubPost[]; parentId: string; onReply: (post: ClubPost) => void; depth?: number }) {
  const children = posts.filter((post) => post.parentId === parentId).reverse();
  if (!children.length) return null;
  return <div className={`mt-3 space-y-2 border-r-2 border-sky-100 pr-3 ${depth > 1 ? 'mr-1' : ''}`}>{children.map((reply) => <div key={reply.id} className="rounded-2xl bg-sky-50/70 p-3"><div className="flex items-center justify-between gap-2"><b className="text-xs text-sky-900">{reply.author}</b><button onClick={() => onReply(reply)} className="text-[10px] font-black text-indigo-600">پاسخ</button></div><p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-slate-600">{reply.body}</p>{depth < 5 && <ReplyTree posts={posts} parentId={reply.id} onReply={onReply} depth={depth + 1} />}</div>)}</div>;
}
