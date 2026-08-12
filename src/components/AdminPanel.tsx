import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpen, CheckCircle2, ClipboardList, FolderKanban, LogIn, MessageSquareText, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import type { ConsultationRequest, Course, PaymentRequest, StudentProject } from '../types';
import CourseManager from './CourseManager';
import LearningAdmin from './LearningAdmin';
import MessageManager from './MessageManager';
import GuidedTour from './GuidedTour';

const tokenKey = 'skillup_admin_token';
type Tab = 'learning' | 'courses' | 'projects' | 'messages' | 'requests';

export default function AdminPanel() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<Tab>('learning');
  const [courses, setCourses] = useState<Course[]>([]);
  const [projects, setProjects] = useState<StudentProject[]>([]);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [consults, setConsults] = useState<ConsultationRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rubrics, setRubrics] = useState<Record<string, [number, number, number]>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const formData = options.body instanceof FormData;
    const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, ...(!formData && options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
    if (response.status === 401) { localStorage.removeItem(tokenKey); setToken(''); throw new Error('نشست مدیریت منقضی شد؛ دوباره وارد شوید.'); }
    return response;
  };

  const load = async () => {
    if (!token) return;
    try {
      const [c, p, pay, con] = await Promise.all([adminFetch('/api/courses'), adminFetch('/api/projects?all=1'), adminFetch('/api/payments'), adminFetch('/api/consultation')]);
      if (c.ok) setCourses(await c.json()); if (p.ok) setProjects(await p.json()); if (pay.ok) setPayments(await pay.json()); if (con.ok) setConsults(await con.json());
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'اطلاعات مدیریت بارگذاری نشد.'); }
  };
  useEffect(() => { load(); }, [token]);

  const login = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    try { const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); localStorage.setItem(tokenKey, data.token); setToken(data.token); setUsername(''); setPassword(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'ورود انجام نشد.'); }
  };

  const reviewProject = async (project: StudentProject, status: 'approved' | 'revision_required') => {
    const values = rubrics[project.id] || [0, 0, 0];
    const rubric = [{ title: 'ایده و حل مسئله', score: values[0], maxScore: 20 }, { title: 'اجرای فنی', score: values[1], maxScore: 20 }, { title: 'ارائه و توضیح', score: values[2], maxScore: 20 }];
    const response = await adminFetch(`/api/projects/${project.id}`, { method: 'PATCH', body: JSON.stringify({ status, adminNotes: notes[project.id] || '', rubric, scoreAwarded: status === 'approved' ? values.reduce((sum, value) => sum + value, 0) : 0 }) });
    if (response.ok) { setNotice(status === 'approved' ? 'پروژه تأیید و امتیاز ثبت شد.' : 'پروژه برای اصلاح به هنرجو برگشت.'); await load(); }
  };

  const paymentStatus = async (item: PaymentRequest, status: 'approved' | 'rejected') => {
    const response = await adminFetch(`/api/payments/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status, adminNotes: notes[item.id] || '' }) });
    if (response.ok) { setNotice('وضعیت پرداخت به‌روزرسانی شد.'); await load(); }
  };

  const consultDone = async (item: ConsultationRequest) => {
    const response = await adminFetch(`/api/consultation/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'contacted', notes: notes[item.id] || '' }) });
    if (response.ok) { setNotice('درخواست مشاوره پیگیری‌شده ثبت شد.'); await load(); }
  };

  const tourSteps = useMemo(() => [
    { target: '[data-tour="admin-header"]', title: 'مرکز کنترل اسکیل‌آپ', description: 'از این پنل، وضعیت آموزشی، محتوا، پروژه‌ها، نظرها و درخواست‌ها را یکپارچه مدیریت می‌کنید.', emoji: '🧑‍💼', onEnter: () => setTab('learning') },
    { target: '[data-tour="admin-learning"]', title: 'رصد پیشرفت هنرجوها', description: 'زمان مشاهده، جلسه‌های کامل، پاسخ‌ها، پروژه‌ها و حساب‌های آزمایشی اینجا دیده می‌شوند و خروجی CSV هم آماده است.', emoji: '📊', onEnter: () => setTab('learning') },
    { target: '[data-tour="admin-courses"]', title: 'ساخت دوره و جلسه', description: 'دوره جدید بسازید؛ سپس برای هر جلسه توضیح، ترتیب، امتیاز، مدت و فایل‌های آموزشی را تنظیم کنید.', emoji: '🎬', onEnter: () => setTab('courses') },
    { target: '[data-tour="admin-projects"]', title: 'Rubric و بازخورد پروژه', description: 'پروژه را بر اساس سه معیار ارزیابی کنید؛ تأیید کنید یا همراه با بازخورد برای اصلاح برگردانید.', emoji: '🧩', onEnter: () => setTab('projects') },
    { target: '[data-tour="admin-messages"]', title: 'مدیریت نظرها و پاسخ‌ها', description: 'پیام را تأیید یا رد کنید، پاسخ بدهید و نظرهای برگزیده را برای صفحه اصلی انتخاب کنید.', emoji: '💬', onEnter: () => setTab('messages') },
    { target: '[data-tour="admin-requests"]', title: 'پرداخت و مشاوره', description: 'تأیید پرداخت، فعال‌سازی خودکار دوره و پیگیری درخواست‌های مشاوره از این قسمت انجام می‌شود.', emoji: '✅', onEnter: () => setTab('requests') },
  ], []);

  if (!token) return <div className="min-h-[70vh] bg-slate-50 py-16" dir="rtl"><form onSubmit={login} className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl"><div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-700"><ShieldCheck className="h-7 w-7" /></div><h1 className="text-2xl font-black text-slate-950">ورود مدیریت</h1><p className="mt-2 text-sm text-slate-500">نام کاربری و رمز امن مدیریت را وارد کنید.</p><input required value={username} onChange={(e) => setUsername(e.target.value)} className="input-admin mt-5 w-full" placeholder="نام کاربری مدیر" dir="ltr" /><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input-admin mt-3 w-full" placeholder="رمز مدیریت" />{error && <p className="mt-3 text-sm text-rose-600">{error}</p>}<button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 p-3 text-sm font-bold text-white"><LogIn className="h-4 w-4" />ورود</button></form></div>;

  const tabs: Array<{ id: Tab; label: string; icon: typeof BarChart3 }> = [{ id: 'learning', label: 'آموزش و کاربران', icon: BarChart3 }, { id: 'courses', label: 'دوره و جلسه', icon: BookOpen }, { id: 'projects', label: 'ارزیابی پروژه', icon: FolderKanban }, { id: 'messages', label: 'نظرها و پیام‌ها', icon: MessageSquareText }, { id: 'requests', label: 'درخواست‌ها', icon: ClipboardList }];
  return <div className="relative min-h-[80vh] overflow-hidden bg-gradient-to-b from-violet-50 via-slate-50 to-sky-50 py-7" dir="rtl"><div className="pointer-events-none absolute -right-16 top-20 h-52 w-52 rounded-full bg-fuchsia-200/30 blur-3xl" /><div className="pointer-events-none absolute -left-16 bottom-20 h-64 w-64 rounded-full bg-cyan-200/30 blur-3xl" /><div className="relative mx-auto max-w-[1500px] px-4 sm:px-6">
    <header data-tour="admin-header" className="relative mb-5 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-[32px] border-4 border-white bg-gradient-to-l from-slate-950 via-indigo-950 to-violet-900 p-6 text-white shadow-[0_18px_45px_rgba(49,46,129,.22)]"><div className="absolute -left-8 -top-12 h-32 w-32 rounded-full border-[18px] border-fuchsia-400/10" /><div><p className="text-xs font-bold text-amber-300">✦ مرکز کنترل اسکیل‌آپ</p><h1 className="mt-1 text-2xl font-black">پنل مدیریت</h1><p className="mt-1 text-sm text-indigo-200">دوره، آموزش، پیام و درخواست‌ها در یک نمای ساده</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur hover:bg-white/20"><RefreshCw className="h-4 w-4" />به‌روزرسانی</button></header>
    <nav className="mb-5 flex gap-2 overflow-x-auto rounded-[22px] border-2 border-white bg-white/90 p-2 shadow-[0_10px_30px_rgba(99,102,241,.10)] backdrop-blur">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${tab === id ? 'bg-gradient-to-l from-indigo-700 to-violet-600 text-white shadow-lg shadow-violet-200' : 'text-slate-500 hover:bg-violet-50 hover:text-violet-700'}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
    {notice && <button onClick={() => setNotice('')} className="mb-4 flex w-full items-center gap-2 rounded-xl bg-emerald-50 p-3 text-right text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{notice}</button>}{error && <div className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    {tab === 'learning' && <div data-tour="admin-learning"><LearningAdmin token={token} courses={courses} /></div>}
    {tab === 'courses' && <div data-tour="admin-courses"><CourseManager adminFetch={adminFetch} /></div>}
    {tab === 'messages' && <div data-tour="admin-messages"><MessageManager adminFetch={adminFetch} /></div>}
    {tab === 'projects' && <div data-tour="admin-projects" className="space-y-4"><div><h2 className="text-2xl font-black text-slate-950">ارزیابی پروژه‌ها 🧩</h2><p className="mt-1 text-sm text-slate-500">هر معیار ۲۰ امتیاز دارد. نتیجه می‌تواند تأیید یا نیازمند اصلاح باشد.</p></div>{projects.map((project) => {
      const values = rubrics[project.id] || [project.rubric?.[0]?.score || 0, project.rubric?.[1]?.score || 0, project.rubric?.[2]?.score || 0];
      return <article key={project.id} className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-black text-slate-950">{project.title}</h3><p className="mt-1 text-xs text-slate-500">{project.studentName} · نسخه {project.submissionVersion || 1}</p></div><span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{project.status}</span></div><p className="mt-3 text-sm leading-7 text-slate-600">{project.description}</p><div className="mt-4 grid gap-2 sm:grid-cols-3">{['ایده و حل مسئله', 'اجرای فنی', 'ارائه و توضیح'].map((label, index) => <label key={label} className="text-xs font-bold text-slate-500">{label}<input type="number" min="0" max="20" value={values[index]} onChange={(e) => { const next = [...values] as [number, number, number]; next[index] = Math.max(0, Math.min(20, Number(e.target.value))); setRubrics({ ...rubrics, [project.id]: next }); }} className="input-admin mt-1 w-full" /></label>)}</div><textarea value={notes[project.id] ?? project.adminNotes ?? ''} onChange={(e) => setNotes({ ...notes, [project.id]: e.target.value })} placeholder="بازخورد روشن و قابل اجرا برای هنرجو…" className="input-admin mt-3 min-h-20 w-full" /><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => reviewProject(project, 'approved')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"><CheckCircle2 className="h-4 w-4" />تأیید ({values.reduce((a, b) => a + b, 0)} امتیاز)</button><button onClick={() => reviewProject(project, 'revision_required')} className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-2 text-sm font-bold text-amber-800"><RefreshCw className="h-4 w-4" />نیازمند اصلاح</button></div></article>;
    })}</div>}
    {tab === 'requests' && <div data-tour="admin-requests" className="grid gap-5 xl:grid-cols-2"><section className="space-y-3"><h2 className="text-xl font-black text-slate-950">پرداخت‌ها 💳</h2>{payments.map((item) => <article key={item.id} className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm"><div className="flex justify-between"><div><h3 className="font-black">{item.studentName}</h3><p className="text-xs text-slate-500">{item.courseTitle} · {item.amount}</p></div><span className="text-xs font-bold text-slate-500">{item.status}</span></div><input value={notes[item.id] || ''} onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })} placeholder="یادداشت مدیریت" className="input-admin mt-3 w-full" /><div className="mt-2 flex gap-2"><button onClick={() => paymentStatus(item, 'approved')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">تأیید و فعال‌سازی</button><button onClick={() => paymentStatus(item, 'rejected')} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">رد</button></div></article>)}</section><section className="space-y-3"><h2 className="text-xl font-black text-slate-950">مشاوره‌ها 📞</h2>{consults.map((item) => <article key={item.id} className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm"><div className="flex justify-between"><div><h3 className="font-black">{item.childName || 'بدون نام'}</h3><p className="text-xs text-slate-500" dir="ltr">{item.phone}</p></div><span className="text-xs font-bold text-slate-500">{item.status}</span></div><input value={notes[item.id] || ''} onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })} placeholder="نتیجه تماس" className="input-admin mt-3 w-full" /><button onClick={() => consultDone(item)} className="mt-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white">ثبت پیگیری</button></article>)}</section></div>}
    <GuidedTour steps={tourSteps} storageKey="skillup-tour-admin-v1" accent="indigo" launcherLabel="راهنمای مدیریت" />
  </div></div>;
}
