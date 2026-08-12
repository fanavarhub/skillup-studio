import { useEffect, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, Download, FileArchive, FileImage, FileSpreadsheet, FileText, LockKeyhole, PlayCircle, Trophy, Video } from 'lucide-react';
import { api, authenticatedFetch } from '../api';
import type { Course, LearningSession, SessionAsset } from '../types';

const fileIcons = { video: Video, pdf: FileText, zip: FileArchive, image: FileImage, excel: FileSpreadsheet };

function VideoPlayer({ lesson, asset, onProgress }: { lesson: LearningSession; asset: SessionAsset; onProgress: (value: { watchedPercent: number; completed: boolean; xpAwarded: number }) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState('');
  const [external, setExternal] = useState(false);
  const [error, setError] = useState('');
  const lastSent = useRef(0);

  useEffect(() => {
    let active = true;
    authenticatedFetch(`/api/session-assets/${asset.id}/access`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'فایل ویدئو در دسترس نیست.');
        if (active) { setUrl(data.url); setExternal(Boolean(data.external)); }
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : 'خطا در دریافت ویدئو'));
    return () => { active = false; };
  }, [asset.id]);

  const report = async (playing: boolean, force = false) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const current = Date.now();
    if (!force && current - lastSent.current < 5000) return;
    lastSent.current = current;
    try {
      const result = await api<{ watchedPercent: number; completed: boolean; xpAwarded: number }>(`/api/sessions/${lesson.id}/progress`, {
        method: 'POST', body: JSON.stringify({ currentTime: video.currentTime, duration: video.duration, playing }),
      });
      onProgress(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'پیشرفت ذخیره نشد.');
    }
  };

  if (error && !url) return <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
  if (!url) return <div className="aspect-video animate-pulse rounded-2xl bg-slate-100 grid place-items-center text-sm text-slate-400">در حال آماده‌سازی ویدئو…</div>;
  if (external) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-bold text-amber-900">این جلسه هنوز از لینک قدیمی استفاده می‌کند.</p><p className="mt-2 text-sm leading-7 text-amber-800">مشاهده خودکار ۷۵٪ فقط برای ویدئویی فعال است که مدیر مستقیماً در جلسه آپلود کرده باشد. تا جایگزینی فایل می‌توانی ویدئوی قدیمی را جداگانه باز کنی.</p><a href={url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl bg-amber-700 px-4 py-2 text-sm font-bold text-white">بازکردن ویدئوی قدیمی</a></div>;
  return (
    <div className="space-y-2">
      <video
        ref={videoRef}
        src={url}
        controls
        controlsList="nodownload"
        className="w-full aspect-video rounded-2xl bg-slate-950"
        onLoadedMetadata={(event) => { if (lesson.progress?.currentTime && lesson.progress.currentTime < event.currentTarget.duration - 2) event.currentTarget.currentTime = lesson.progress.currentTime; }}
        onPlay={() => report(true, true)}
        onTimeUpdate={() => report(true)}
        onPause={() => report(true, true)}
        onEnded={() => report(true, true)}
      />
      <p className="text-xs text-slate-500">پیشرفت خودکار ذخیره می‌شود. با دیدن ۷۵٪ از زمان واقعی ویدئو، جلسه کامل خواهد شد.</p>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export default function StudentLearning({ courses, onXp }: { courses: Course[]; onXp: (points: number, message: string) => void }) {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadSessions = async (course: Course) => {
    setSelectedCourse(course);
    setLoading(true);
    setError('');
    try {
      const result = await api<LearningSession[]>(`/api/student/courses/${course.id}/sessions`);
      setSessions(result);
      setActiveId(result.find((item) => !item.progress?.completed)?.id || result[0]?.id || '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'جلسه‌ها بارگذاری نشدند.');
    } finally { setLoading(false); }
  };

  const openAsset = async (asset: SessionAsset) => {
    try {
      const response = await authenticatedFetch(`/api/session-assets/${asset.id}/access`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'فایل باز نشد.'); }
  };

  if (!selectedCourse) return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-950">کلاس‌های من</h2>
        <p className="mt-1 text-sm text-slate-500">جلسه را باز کن؛ ذخیره پیشرفت و امتیازدهی کاملاً خودکار است.</p>
      </div>
      {courses.length === 0 ? (
        <div className="rounded-[30px] border-2 border-dashed border-violet-200 bg-gradient-to-br from-white to-violet-50 p-10 text-center shadow-sm">
          <span className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-3xl bg-violet-100"><LockKeyhole className="h-9 w-9 text-violet-400" /></span>
          <p className="font-bold text-slate-700">هنوز دوره‌ای برای حساب شما فعال نشده است.</p>
          <p className="mt-2 text-sm text-slate-500">پس از تأیید پرداخت، دوره همین‌جا ظاهر می‌شود.</p>
        </div>
      ) : <div className="grid gap-4 md:grid-cols-2">{courses.map((course) => (
        <button key={course.id} onClick={() => loadSessions(course)} className="playful-card group overflow-hidden rounded-[30px] border-2 border-violet-100 bg-white text-right shadow-lg shadow-violet-100/60 transition hover:-translate-y-2 hover:border-violet-300 hover:shadow-xl">
          <img src={course.coverImage} alt="" className="h-40 w-full object-cover" />
          <div className="p-5">
            <p className="text-xs font-bold text-indigo-600">{course.level}</p>
            <h3 className="mt-1 text-lg font-extrabold text-slate-950">{course.title}</h3>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700"><PlayCircle className="h-5 w-5" /> بزن بریم کلاس!</span>
          </div>
        </button>
      ))}</div>}
    </section>
  );

  const active = sessions.find((item) => item.id === activeId);
  const video = active?.assets.find((asset) => asset.kind === 'video');
  const updateProgress = (result: { watchedPercent: number; completed: boolean; xpAwarded: number }) => {
    setSessions((items) => items.map((item) => item.id === activeId ? { ...item, progress: { ...(item.progress || { currentTime: 0, watchedSeconds: 0 }), watchedPercent: result.watchedPercent, completed: result.completed } } : item));
    if (result.xpAwarded) onXp(result.xpAwarded, 'جلسه با موفقیت کامل شد');
  };

  return (
    <section className="space-y-5">
      <button onClick={() => { setSelectedCourse(null); setSessions([]); }} className="text-sm font-bold text-indigo-700">→ بازگشت به کلاس‌های من</button>
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-[30px] border-2 border-violet-100 bg-white p-3 shadow-lg shadow-violet-100/50">
          <div className="px-3 py-3"><p className="text-xs text-slate-500">دوره</p><h2 className="font-extrabold text-slate-950">{selectedCourse.title}</h2></div>
          {loading && <p className="p-4 text-sm text-slate-400">در حال بارگذاری…</p>}
          {!loading && sessions.map((lesson, index) => (
            <button key={lesson.id} onClick={() => setActiveId(lesson.id)} className={`mb-2 flex w-full items-center gap-3 rounded-2xl p-3 text-right transition ${activeId === lesson.id ? 'bg-gradient-to-l from-indigo-600 to-violet-600 text-white shadow-lg shadow-violet-200' : 'hover:bg-violet-50'}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black ${lesson.progress?.completed ? 'bg-emerald-100 text-emerald-700' : activeId === lesson.id ? 'bg-white/15' : 'bg-slate-100 text-slate-500'}`}>{lesson.progress?.completed ? <CheckCircle2 className="h-5 w-5" /> : index + 1}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-bold">{lesson.title}</span><span className={`text-[11px] ${activeId === lesson.id ? 'text-indigo-100' : 'text-slate-400'}`}>{lesson.xpReward} امتیاز · {lesson.progress?.watchedPercent || 0}٪</span></span>
            </button>
          ))}
        </aside>
        <div className="rounded-[30px] border-2 border-sky-100 bg-gradient-to-br from-white to-sky-50/40 p-5 shadow-lg shadow-sky-100/50 md:p-7">
          {error && <div className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          {!active && !loading && <div className="py-16 text-center text-slate-400"><BookOpen className="mx-auto mb-3 h-10 w-10" />برای این دوره هنوز جلسه‌ای منتشر نشده است.</div>}
          {active && <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-bold text-indigo-600">جلسه {active.orderIndex}</p><h1 className="mt-1 text-2xl font-black text-slate-950">{active.title}</h1></div>
              <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold ${active.progress?.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><Trophy className="h-4 w-4" />{active.progress?.completed ? 'تکمیل شده' : `${active.xpReward} امتیاز`}</span>
            </div>
            {active.description && <p className="whitespace-pre-line text-sm leading-7 text-slate-600">{active.description}</p>}
            {video ? <div key={`${active.id}:${video.id}`}><VideoPlayer lesson={active} asset={video} onProgress={updateProgress} /></div> : <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">برای این جلسه هنوز ویدئو قرار نگرفته است.</div>}
            <div>
              <h3 className="mb-3 font-extrabold text-slate-900">فایل‌های جلسه</h3>
              <div className="grid gap-2 sm:grid-cols-2">{active.assets.filter((item) => item.kind !== 'video').map((asset) => {
                const Icon = fileIcons[asset.kind];
                return <button key={asset.id} onClick={() => openAsset(asset)} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-right hover:border-indigo-300 hover:bg-indigo-50"><Icon className="h-5 w-5 text-indigo-600" /><span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">{asset.originalName}</span><Download className="h-4 w-4 text-slate-400" /></button>;
              })}</div>
              {active.assets.filter((item) => item.kind !== 'video').length === 0 && <p className="text-sm text-slate-400">فایل تکمیلی ندارد.</p>}
            </div>
          </div>}
        </div>
      </div>
    </section>
  );
}
