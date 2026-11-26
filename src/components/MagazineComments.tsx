import { FormEvent, useEffect, useState } from 'react';
import { adminTokenKey, studentTokenKey } from '../api';

export type MagazineComment = { id: number; parentId: number | null; rootId: number | null; depth: number; name: string; role: string; body: string; deleted: boolean; createdAt: string; pin: 'none' | 'gold' | 'diamond' };
type Session = { authenticated: boolean; name?: string; role?: string };
const token = () => localStorage.getItem(studentTokenKey) || localStorage.getItem(adminTokenKey) || '';
const loginUrl = () => `/login?returnTo=${encodeURIComponent(window.location.pathname + '#comments')}`;
const date = (value: string) => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(value));

function Thread({ root, slug, session, onSent, admin = false, onManage }: { key?: number; root: MagazineComment; slug: string; session: Session; onSent: () => void; admin?: boolean; onManage?: (id: number, operation: 'delete' | 'gold' | 'diamond' | 'none') => void }) {
  const [replies, setReplies] = useState<MagazineComment[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const loadReplies = async (after?: number) => {
    const response = await fetch(`/api/magazine/${encodeURIComponent(slug)}/comments/${root.id}/replies${after ? `?after=${after}` : ''}`);
    if (!response.ok) { setStatus('پاسخ‌ها بارگذاری نشدند. دوباره تلاش کن.'); return; }
    const data = await response.json() as { comments: MagazineComment[]; next: number | null };
    setReplies(old => after ? [...old, ...data.comments] : data.comments);
    setNext(data.next);
  };
  useEffect(() => { void loadReplies(); }, [root.id, slug]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!replyTo || !draft.trim()) return;
    setBusy(true); setStatus('');
    try {
      const response = await fetch(`/api/magazine/${encodeURIComponent(slug)}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin ? localStorage.getItem(adminTokenKey) || token() : token()}` }, body: JSON.stringify({ body: draft, parentId: replyTo }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ارسال انجام نشد.');
      setDraft(''); setReplyTo(null); setStatus('پاسخت منتشر شد ✨');
      await loadReplies(); onSent();
    } catch (error) { setStatus(error instanceof Error ? error.message : 'ارسال انجام نشد.'); }
    finally { setBusy(false); }
  };
  const nodes = [root, ...replies];
  const render = (comment: MagazineComment, isRoot = false) => <div key={comment.id} className={`${isRoot ? 'rounded-3xl border-2 border-violet-200 bg-white p-4 shadow-sm sm:p-6' : 'mt-3 rounded-2xl border-r-4 border-violet-400 bg-violet-50 p-3 sm:p-4'} min-w-0`} style={isRoot ? undefined : { marginRight: `${Math.min(comment.depth, 2) * 8}px` }}>
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><strong className="text-sm text-slate-900">{comment.deleted ? 'دیدگاه حذف‌شده' : comment.name}</strong>{!comment.deleted && comment.role === 'admin' && <span className="rounded-full bg-sky-100 px-2 py-0.5 font-bold text-sky-800">تیم اسکیل‌آپ</span>}{comment.pin !== 'none' && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">{comment.pin === 'diamond' ? '💎 پین الماسی' : '⭐ پین طلایی'}</span>}<time dateTime={comment.createdAt}>{date(comment.createdAt)}</time></div>
    {!isRoot && <p className="mt-1 text-xs text-violet-700">در پاسخ به {nodes.find(item => item.id === comment.parentId)?.name || 'دیدگاه بالاتر'}</p>}
    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">{comment.deleted ? 'این دیدگاه حذف شده است.' : comment.body}</p>
    <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-violet-700">
      {session.authenticated && !comment.deleted && comment.depth < 5 && <button type="button" onClick={() => { setReplyTo(comment.id); setStatus(''); }}>پاسخ دادن</button>}
      {admin && onManage && !comment.deleted && <button type="button" className="text-rose-700" onClick={() => onManage(comment.id, 'delete')}>حذف</button>}
      {admin && onManage && isRoot && !comment.deleted && <>{(['diamond','gold','none'] as const).map(pin => <button type="button" key={pin} onClick={() => onManage(comment.id, pin)}>{pin === 'diamond' ? '💎 الماسی' : pin === 'gold' ? '⭐ طلایی' : 'برداشتن پین'}</button>)}</>}
    </div>
    {replyTo === comment.id && <form onSubmit={submit} className="mt-3 rounded-xl bg-white p-3"><label className="block text-sm font-bold" htmlFor={`reply-${comment.id}`}>پاسخ به {comment.name}</label><textarea id={`reply-${comment.id}`} required minLength={2} maxLength={1200} value={draft} onChange={event => setDraft(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-violet-200 p-3 text-base" /><div className="mt-2 flex gap-2"><button disabled={busy} className="rounded-xl bg-violet-700 px-4 py-2 text-white">ثبت پاسخ</button><button type="button" onClick={() => setReplyTo(null)}>انصراف</button></div></form>}
    {nodes.filter(item => item.parentId === comment.id).map(item => render(item))}
  </div>;
  return <li className="list-none">{render(root, true)}{status && <p role="status" className="mt-2 text-sm text-violet-700">{status}</p>}{next && <button type="button" onClick={() => loadReplies(next)} className="mt-2 rounded-xl bg-violet-100 px-4 py-2 text-sm font-bold text-violet-800">پاسخ‌های بیشتر</button>}</li>;
}

export default function MagazineComments({ slug, admin = false, adminToken }: { key?: string; slug: string; admin?: boolean; adminToken?: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [comments, setComments] = useState<MagazineComment[]>([]);
  const [pins, setPins] = useState<MagazineComment[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async (before?: number) => {
    const response = await fetch(`/api/magazine/${encodeURIComponent(slug)}/comments${before ? `?before=${before}` : ''}`);
    if (!response.ok) { setStatus('دیدگاه‌ها بارگذاری نشدند.'); return; }
    const data = await response.json() as { comments: MagazineComment[]; pins: MagazineComment[]; next: number | null };
    setComments(old => before ? [...old, ...data.comments] : data.comments); setPins(data.pins); setNext(data.next);
  };
  useEffect(() => {
    setComments([]); setPins([]); setStatus(''); setSession(null);
    void load();
    const currentToken = admin ? adminToken || '' : token();
    fetch(`/api/magazine/${encodeURIComponent(slug)}/session`, { headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {} }).then(response => response.json()).then(setSession).catch(() => setSession({ authenticated: false }));
  }, [slug]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setStatus('');
    try {
      const response = await fetch(`/api/magazine/${encodeURIComponent(slug)}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ body: draft }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'ارسال انجام نشد.');
      setDraft(''); setStatus('دیدگاهت همین حالا منتشر شد ✨'); await load();
    } catch (error) { setStatus(error instanceof Error ? error.message : 'ارسال انجام نشد.'); }
    finally { setBusy(false); }
  };
  const manage = async (id: number, operation: 'delete' | 'gold' | 'diamond' | 'none') => {
    if (operation === 'delete' && !window.confirm('این دیدگاه حذف شود؟')) return;
    const url = `/api/admin/magazine/${encodeURIComponent(slug)}/comments/${id}`;
    const response = await fetch(operation === 'delete' ? url : `${url}/pin`, { method: operation === 'delete' ? 'DELETE' : 'PATCH', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, ...(operation === 'delete' ? {} : { body: JSON.stringify({ pin: operation }) }) });
    const data = await response.json(); if (!response.ok) { setStatus(data.error || 'عملیات انجام نشد.'); return; }
    setStatus('تغییر ثبت شد.'); await load();
  };
  const ordered = [...pins, ...comments.filter(item => !pins.some(pin => pin.id === item.id))];
  return <section id="comments" dir="rtl" className="mx-auto my-10 w-full max-w-5xl px-4 text-right sm:px-6"><h2 className="text-2xl font-black text-slate-950">دیدگاه‌های این مقاله</h2><p className="mt-2 text-sm leading-7 text-slate-600">سؤالت را بپرس و به گفت‌وگوی دیگران بپیوند.</p>
    {!admin && (session === null ? <p className="mt-5 text-sm text-violet-700">در حال بررسی حساب…</p> : session.authenticated ? <form onSubmit={submit} className="mt-5 rounded-3xl border-2 border-violet-100 bg-white p-4 sm:p-6"><label htmlFor={`new-comment-${slug}`} className="font-bold">دیدگاهت را بنویس، {session.name}</label><textarea id={`new-comment-${slug}`} required minLength={2} maxLength={1200} value={draft} onChange={event => setDraft(event.target.value)} placeholder="ایده، نتیجهٔ تمرین یا سؤالت را اینجا بنویس…" className="mt-3 min-h-28 w-full rounded-xl border border-violet-200 p-3 text-base" /><button disabled={busy} className="mt-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white">انتشار دیدگاه</button></form> : <div className="mt-5 rounded-3xl border border-violet-200 bg-violet-50 p-5"><p className="font-bold text-violet-950">رفیق اسکیل‌آپی، برای نوشتن دیدگاه اول وارد حسابت شو ✨</p><p className="mt-1 text-sm text-violet-800">دوست داری وارد شوی و بعد همین‌جا نظرت را بنویسی؟</p><a href={loginUrl()} className="mt-3 inline-block rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white">بله، ورود به اسکیل‌آپ</a></div>)}
    {status && <p role="status" className="mt-3 rounded-xl bg-violet-50 p-3 text-sm text-violet-800">{status}</p>}
    <ul className="mt-5 grid gap-4">{ordered.map(item => <Thread key={item.id} root={item} slug={slug} session={session || { authenticated: false }} onSent={() => void load()} admin={admin} onManage={admin ? manage : undefined} />)}</ul>
    {!ordered.length && <p className="mt-5 rounded-2xl bg-white p-6 text-sm text-slate-600">هنوز دیدگاهی ثبت نشده؛ تو می‌توانی گفت‌وگو را شروع کنی.</p>}
    {next && <button type="button" onClick={() => load(next)} className="mt-4 rounded-xl bg-violet-100 px-5 py-3 text-sm font-bold text-violet-800">دیدگاه‌های بیشتر</button>}
  </section>;
}
