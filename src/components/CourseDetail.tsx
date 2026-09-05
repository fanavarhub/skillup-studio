import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Copy, CreditCard, GraduationCap, Layers3, Users } from 'lucide-react';
import { authenticatedFetch } from '../api';
import type { Course } from '../types';

const cardNumber = '6037-9975-1234-5678';

export default function CourseDetail({ courseId, studentName, navigate }: { courseId: string; studentName?: string; navigate: (tab: string) => void }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [form, setForm] = useState({ phone: '', receiptNumber: '', cardLastFour: '', payerName: '', notes: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { authenticatedFetch(`/api/courses/${encodeURIComponent(courseId)}`).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setCourse(data); }).catch((reason) => setError(reason instanceof Error ? reason.message : 'دوره پیدا نشد.')); }, [courseId]);
  useEffect(() => {
    if (!course) return;
    document.title = `${course.title} | دوره‌های اسکیل آپ`;
    document.head.querySelector('meta[name="description"]')?.setAttribute('content', course.description.slice(0, 160));
    document.head.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://skill-up.ir/courses/${encodeURIComponent(course.id)}`);
    document.head.querySelector('meta[property="og:title"]')?.setAttribute('content', course.title);
    document.head.querySelector('meta[property="og:description"]')?.setAttribute('content', course.description.slice(0, 160));
  }, [course]);

  const submit = async () => {
    if (!course) return; setBusy(true); setError(''); setMessage('');
    try {
      const response = await authenticatedFetch('/api/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, studentName: studentName || 'نوجوان خلاق اسکیل آپ', courseId: course.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'ثبت فیش انجام نشد.');
      setMessage('فیش با موفقیت ثبت شد؛ پس از تأیید مدیر، دوره در پنل شما فعال می‌شود.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'ثبت فیش انجام نشد.'); } finally { setBusy(false); }
  };

  if (!course && !error) return <div className="min-h-[70vh] bg-[#fffaf4] py-24 text-center text-sm font-bold text-violet-700">در حال آماده‌کردن صفحه دوره…</div>;
  if (!course) return <div className="min-h-[70vh] bg-[#fffaf4] py-24 text-center"><p className="text-rose-600">{error}</p><button onClick={() => navigate('courses')} className="mt-4 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white">بازگشت به دوره‌ها</button></div>;

  return <div className="min-h-[75vh] bg-[#fffaf4] py-7 text-right" dir="rtl"><div className="mx-auto max-w-6xl px-4 sm:px-6">
    <button onClick={() => navigate('courses')} className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm"><ArrowRight className="h-4 w-4" />همه دوره‌ها</button>
    <section className="relative overflow-hidden rounded-[36px] bg-slate-950 text-white shadow-2xl"><img src={course.coverImage} alt={`تصویر دوره ${course.title}`} className="absolute inset-0 h-full w-full object-cover opacity-25" /><div className="relative grid gap-8 p-6 md:grid-cols-[1fr_300px] md:p-10"><div><span className="rounded-full bg-sky-400/20 px-4 py-2 text-xs font-black text-sky-200">{course.level}</span><h1 className="mt-5 text-3xl font-black leading-tight sm:text-4xl">{course.title}</h1><p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-8 text-slate-200">{course.description}</p><div className="mt-6 flex flex-wrap gap-3"><Info icon={<Clock3 />} text={course.duration} /><Info icon={<Layers3 />} text={`${course.sessionCount || 0} جلسه`} /><Info icon={<GraduationCap />} text={course.instructor || 'تیم مربیان اسکیل‌آپ'} /></div></div><div className="self-end rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur"><small className="text-slate-300">شهریه دوره</small><strong className="mt-1 block text-2xl">{course.price}</strong><button onClick={() => navigator.clipboard.writeText(window.location.href)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-xs font-bold"><Copy className="h-4 w-4" />کپی لینک این دوره</button></div></div></section>

    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
      <main className="space-y-6"><section className="rounded-[30px] border-2 border-white bg-white p-6 shadow-sm"><h2 className="text-2xl font-black text-slate-950">درباره این دوره</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><Tile icon={<CalendarDays />} title="زمان‌بندی" text={course.scheduleText || 'زمان‌بندی منعطف و هماهنگ‌شده'} /><Tile icon={<Users />} title="ظرفیت" text={`${Math.max(0, (course.capacity || 0) - (course.enrolled || 0))} جای باقی‌مانده`} /></div></section>
        <section className="rounded-[30px] border-2 border-violet-100 bg-white p-6"><h2 className="text-xl font-black text-slate-950">سؤال‌هایی که شاید داشته باشید</h2><div className="mt-4 space-y-3">{(course.faqs?.length ? course.faqs : [{ question: 'این دوره برای چه کسانی مناسب است؟', answer: 'برای هنرجوهایی که می‌خواهند قدم‌به‌قدم و پروژه‌محور مهارت تازه‌ای یاد بگیرند.' }, { question: 'بعد از ثبت فیش چه می‌شود؟', answer: 'مدیر پرداخت را بررسی می‌کند و دوره مستقیماً در پنل هنرجوی شما فعال می‌شود.' }]).map((faq) => <details key={faq.question} className="group rounded-2xl border border-slate-100 bg-slate-50 p-4"><summary className="cursor-pointer list-none font-black text-slate-800">{faq.question}<span className="float-left text-violet-600 group-open:rotate-45">＋</span></summary><p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{faq.answer}</p></details>)}</div></section>
      </main>
      <aside className="h-fit rounded-[30px] border-2 border-emerald-100 bg-white p-5 shadow-lg shadow-emerald-50 lg:sticky lg:top-24">{course.isPurchased ? <div className="py-6 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" /><h2 className="mt-3 text-xl font-black">این دوره برایت فعال است</h2><button onClick={() => navigate('dashboard')} className="mt-5 w-full rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white">رفتن به کلاس‌های من</button></div> : <><h2 className="text-xl font-black text-slate-950">ثبت‌نام در دوره</h2><p className="mt-2 text-xs leading-6 text-slate-500">مبلغ را به کارت زیر واریز و کد پیگیری را ثبت کنید.</p><div className="mt-4 rounded-2xl bg-slate-950 p-4 text-center font-mono text-white" dir="ltr">{cardNumber}</div><div className="mt-4 space-y-3"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="شماره موبایل" className="input-admin w-full" dir="ltr" /><input value={form.receiptNumber} onChange={(event) => setForm({ ...form, receiptNumber: event.target.value })} placeholder="کد پیگیری یا شماره فیش" className="input-admin w-full" /><div className="grid grid-cols-2 gap-2"><input value={form.cardLastFour} onChange={(event) => setForm({ ...form, cardLastFour: event.target.value })} placeholder="۴ رقم آخر کارت" className="input-admin" /><input value={form.payerName} onChange={(event) => setForm({ ...form, payerName: event.target.value })} placeholder="نام واریزکننده" className="input-admin" /></div><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="توضیح اختیاری" className="input-admin min-h-20 w-full" /></div>{message && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs font-bold leading-6 text-emerald-700">{message}</p>}{error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}<button disabled={busy} onClick={submit} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-emerald-600 to-teal-600 py-3 text-sm font-black text-white disabled:opacity-60"><CreditCard className="h-4 w-4" />{busy ? 'در حال ثبت…' : 'ثبت فیش برای بررسی'}</button></>}</aside>
    </div>
  </div></div>;
}

function Info({ icon, text }: { icon: ReactNode; text: string }) { return <span className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-xs font-bold">{icon}{text}</span>; }
function Tile({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="flex items-center gap-3 rounded-2xl bg-violet-50 p-4"><span className="text-violet-600">{icon}</span><div><small className="text-slate-400">{title}</small><b className="block text-sm text-slate-800">{text}</b></div></div>; }
