import { FormEvent, useEffect, useState } from 'react';
import { Bell, BookOpen, CheckCircle2, FolderKanban, LayoutDashboard, Plus, RefreshCw, Sparkles, Trophy } from 'lucide-react';
import { api } from '../api';
import type { Course, StudentProfile, StudentProject } from '../types';
import LearningHub from './LearningHub';
import StudentLearning from './StudentLearning';

interface DashboardProps { unlockedCourses: string[]; setCurrentTab: (tab: string) => void; studentName?: string; }
type Tab = 'overview' | 'lessons' | 'projects' | 'growth';

export default function Dashboard({ setCurrentTab, studentName }: DashboardProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [projects, setProjects] = useState<StudentProject[]>([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StudentProject | null>(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'Game', scratchId: '', studentAge: '14' });
  const [error, setError] = useState('');

  const load = async () => {
    const [profileResult, courseResult, projectResult, notices] = await Promise.all([
      api<StudentProfile>('/api/student-profile'), api<Course[]>('/api/courses'), api<StudentProject[]>('/api/projects?studentName=me'), api<Array<{ readAt?: string }>>('/api/notifications'),
    ]);
    setProfile(profileResult);
    setCourses(courseResult.filter((course) => profileResult.purchasedCourses?.includes(course.id)));
    setProjects(projectResult);
    setUnread(notices.filter((item) => !item.readAt).length);
  };

  useEffect(() => {
    load().catch((reason) => setError(reason instanceof Error ? reason.message : 'اطلاعات پنل بارگذاری نشد.'));
    const timer = window.setInterval(() => api<Array<{ readAt?: string }>>('/api/notifications').then((items) => setUnread(items.filter((item) => !item.readAt).length)).catch(() => undefined), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const submitProject = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    try {
      const result = await api<StudentProject>(editing ? `/api/projects/${editing.id}` : '/api/projects', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ ...form, studentAge: Number(form.studentAge), coverImage: '/assets/project-soltan-pist.png' }) });
      setToast(editing ? 'نسخه اصلاح‌شده پروژه برای بررسی ارسال شد.' : 'پروژه برای بررسی مربی ارسال شد.');
      setProjects((items) => editing ? items.map((item) => item.id === result.id ? result : item) : [result, ...items]);
      setFormOpen(false); setEditing(null); setForm({ title: '', description: '', category: 'Game', scratchId: '', studentAge: '14' }); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'ارسال پروژه انجام نشد.'); }
  };

  const openEdit = (item: StudentProject) => { setEditing(item); setForm({ title: item.title, description: item.description, category: item.category, scratchId: item.scratchId || '', studentAge: String(item.studentAge) }); setFormOpen(true); };
  const xpEarned = (points: number, message: string) => { setToast(`${message}؛ ${points} امتیاز به حسابت اضافه شد.`); load().catch(() => undefined); };
  const tabs: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: 'نمای کلی', icon: LayoutDashboard }, { id: 'lessons', label: 'کلاس‌های من', icon: BookOpen }, { id: 'projects', label: 'پروژه‌ها', icon: FolderKanban }, { id: 'growth', label: 'رشد و لیگ', icon: Trophy },
  ];

  return <div className="min-h-[75vh] bg-slate-50 py-7" dir="rtl">
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <header className="mb-5 overflow-hidden rounded-3xl bg-gradient-to-l from-indigo-950 via-indigo-800 to-violet-700 p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div><p className="text-sm text-indigo-200">سلام {studentName || profile?.studentName || 'هنرجوی خلاق'} 👋</p><h1 className="mt-1 text-2xl font-black md:text-3xl">امروز چه چیزی می‌سازی؟</h1><p className="mt-2 max-w-xl text-sm leading-7 text-indigo-100">از همین‌جا جلسه‌ات را ادامه بده، پروژه بفرست و نتیجه پیشرفتت را ببین.</p></div>
          <div className="grid grid-cols-3 gap-2 text-center"><Stat value={profile?.xp || 0} label="امتیاز" /><Stat value={profile?.level || 1} label="سطح" /><Stat value={unread} label="اعلان جدید" /></div>
        </div>
      </header>
      <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
      {toast && <button onClick={() => setToast('')} className="mb-5 flex w-full items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-right text-sm font-bold text-emerald-700"><CheckCircle2 className="h-5 w-5" />{toast}</button>}
      {error && <div className="mb-5 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {tab === 'overview' && <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-indigo-600">پیشنهاد امروز</p><h2 className="mt-1 text-xl font-black text-slate-950">ادامه مسیر یادگیری</h2></div><Sparkles className="h-8 w-8 text-amber-400" /></div><p className="mt-3 text-sm leading-7 text-slate-500">{courses.length ? `${courses.length} دوره فعال داری. سیستم آخرین زمان ویدئو را نگه می‌دارد و تکمیل جلسه را خودش تشخیص می‌دهد.` : 'هنوز دوره فعالی نداری؛ دوره‌ها را ببین و مسیر مناسب خودت را انتخاب کن.'}</p><button onClick={() => courses.length ? setTab('lessons') : setCurrentTab('courses')} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">{courses.length ? 'رفتن به کلاس‌ها' : 'دیدن دوره‌ها'}</button></section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-2"><Bell className="h-5 w-5 text-indigo-600" /><h2 className="font-black text-slate-950">وضعیت حساب</h2></div><Progress label="مسیر سطح بعد" value={profile?.progress || 0} /><div className="mt-4 grid grid-cols-2 gap-2"><Mini value={profile?.completedSessions?.length || 0} label="جلسه کامل" /><Mini value={projects.length} label="پروژه" /></div></section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2"><h2 className="font-black text-slate-950">فعالیت‌های اخیر</h2><div className="mt-4 grid gap-2 md:grid-cols-3">{profile?.xpLedger?.slice(0, 6).map((item, index) => <div key={`${item.createdAt}-${index}`} className="rounded-2xl bg-slate-50 p-3"><p className="text-sm font-bold text-slate-700">{item.reason || 'فعالیت آموزشی'}</p><p className="mt-1 text-xs font-bold text-emerald-600">+{item.delta} امتیاز</p></div>)}{!profile?.xpLedger?.length && <p className="text-sm text-slate-400">هنوز فعالیتی ثبت نشده است.</p>}</div></section>
      </div>}
      {tab === 'lessons' && <StudentLearning courses={courses} onXp={xpEarned} />}
      {tab === 'projects' && <section className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-2xl font-black text-slate-950">پروژه‌های من</h2><p className="mt-1 text-sm text-slate-500">بازخورد مربی را ببین و در صورت نیاز نسخه اصلاح‌شده بفرست.</p></div><button onClick={() => { setEditing(null); setFormOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" />پروژه جدید</button></div>
        {formOpen && <form onSubmit={submitProject} className="grid gap-3 rounded-3xl border border-indigo-100 bg-white p-5 md:grid-cols-2"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان پروژه" className="input-admin" /><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-admin"><option value="Game">بازی‌سازی</option><option value="AI">هوش مصنوعی</option><option value="Communication">ارتباطات</option></select><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="توضیح پروژه و کاری که انجام دادی" className="input-admin min-h-24 md:col-span-2" /><input value={form.scratchId} onChange={(e) => setForm({ ...form, scratchId: e.target.value })} placeholder="شناسه پروژه Scratch (اختیاری)" className="input-admin" dir="ltr" /><input type="number" min="6" max="99" value={form.studentAge} onChange={(e) => setForm({ ...form, studentAge: e.target.value })} className="input-admin" /><div className="flex gap-2 md:col-span-2"><button className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">{editing ? 'ارسال نسخه اصلاح‌شده' : 'ارسال برای بررسی'}</button><button type="button" onClick={() => setFormOpen(false)} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-600">انصراف</button></div></form>}
        <div className="grid gap-4 md:grid-cols-2">{projects.map((item) => <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><div><h3 className="font-black text-slate-950">{item.title}</h3><p className="mt-1 text-xs text-slate-400">نسخه {item.submissionVersion || 1}</p></div><Status status={item.status} /></div><p className="mt-3 text-sm leading-7 text-slate-600">{item.description || 'بدون توضیح'}</p>{item.adminNotes && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800"><strong>نظر مربی:</strong> {item.adminNotes}</div>}{item.rubric && <div className="mt-3 space-y-1">{item.rubric.map((row) => <div key={row.title} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"><span>{row.title}</span><strong>{row.score} از {row.maxScore}</strong></div>)}</div>}{['pending', 'revision_required'].includes(item.status) && <button onClick={() => openEdit(item)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700"><RefreshCw className="h-4 w-4" />{item.status === 'revision_required' ? 'اصلاح و ارسال مجدد' : 'ویرایش پروژه'}</button>}</article>)}{!projects.length && <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400 md:col-span-2">هنوز پروژه‌ای نفرستادی.</div>}</div>
      </section>}
      {tab === 'growth' && <LearningHub />}
    </div>
  </div>;
}

function Stat({ value, label }: { value: number; label: string }) { return <div className="min-w-20 rounded-2xl bg-white/10 px-3 py-3"><strong className="block text-xl">{value}</strong><span className="text-[10px] text-indigo-200">{label}</span></div>; }
function Mini({ value, label }: { value: number; label: string }) { return <div className="rounded-xl bg-slate-50 p-3 text-center"><strong className="block text-lg text-slate-950">{value}</strong><span className="text-[10px] text-slate-500">{label}</span></div>; }
function Progress({ label, value }: { label: string; value: number }) { return <div className="mt-5"><div className="mb-2 flex justify-between text-xs font-bold text-slate-500"><span>{label}</span><span>{value}٪</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${value}%` }} /></div></div>; }
function Status({ status }: { status: StudentProject['status'] }) { const map = { approved: ['تأیید شده', 'bg-emerald-100 text-emerald-700'], pending: ['در انتظار بررسی', 'bg-amber-100 text-amber-700'], revision_required: ['نیازمند اصلاح', 'bg-rose-100 text-rose-700'], rejected: ['رد شده', 'bg-slate-100 text-slate-600'] }; return <span className={`h-fit rounded-full px-3 py-1 text-[10px] font-bold ${map[status][1]}`}>{map[status][0]}</span>; }
