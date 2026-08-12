import { FormEvent, useEffect, useState } from 'react';
import { BookPlus, Check, ChevronLeft, FileUp, Plus, Save, Trash2, Video } from 'lucide-react';
import type { Course, LearningSession } from '../types';

type AdminFetch = (url: string, options?: RequestInit) => Promise<Response>;
const emptyCourse = { title: '', description: '', level: 'مقدماتی', price: '۰ تومان', duration: '۸ جلسه', coverImage: '/assets/legacy/unsplash-1517694712202-14dd9538aa97-q60.jpg', instructor: '', capacity: '100', scheduleText: '' };
const emptyLesson = { title: '', description: '', xpReward: '10', durationMinutes: '', isPublished: true };

export default function CourseManager({ adminFetch }: { adminFetch: AdminFetch }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selected, setSelected] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [lessonForm, setLessonForm] = useState(emptyLesson);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadCourses = async () => {
    const response = await adminFetch('/api/courses');
    if (response.ok) setCourses(await response.json());
  };
  const loadSessions = async (course: Course) => {
    setSelected(course);
    const response = await adminFetch(`/api/admin/course-sessions?courseId=${encodeURIComponent(course.id)}`);
    if (response.ok) setSessions(await response.json());
  };
  useEffect(() => { loadCourses(); }, []);

  const createCourse = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await adminFetch('/api/courses', { method: 'POST', body: JSON.stringify({ ...courseForm, capacity: Number(courseForm.capacity), enrolled: 0, onlineMeetingLink: '', nextSessionAt: '', isActive: true, offlineVideos: [] }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ساخت دوره انجام نشد.');
      setCourseForm(emptyCourse); setShowCourseForm(false); setMessage('دوره جدید ساخته شد.'); await loadCourses();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'خطا در ساخت دوره'); } finally { setBusy(false); }
  };

  const createSession = async (event: FormEvent) => {
    event.preventDefault(); if (!selected) return; setBusy(true); setError('');
    try {
      const response = await adminFetch('/api/admin/course-sessions', { method: 'POST', body: JSON.stringify({ courseId: selected.id, title: lessonForm.title, description: lessonForm.description, xpReward: Number(lessonForm.xpReward), durationSeconds: Number(lessonForm.durationMinutes || 0) * 60, isPublished: lessonForm.isPublished }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ساخت جلسه انجام نشد.');
      setLessonForm(emptyLesson); setMessage('جلسه جدید اضافه شد.'); await loadSessions(selected);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'خطا در ساخت جلسه'); } finally { setBusy(false); }
  };

  const patchSession = async (lesson: LearningSession, patch: Partial<LearningSession>) => {
    const response = await adminFetch(`/api/admin/course-sessions/${lesson.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    if (response.ok && selected) { setMessage('تغییرات جلسه ذخیره شد.'); await loadSessions(selected); }
  };

  const uploadFiles = async (lesson: LearningSession, files: FileList | null) => {
    if (!files?.length || !selected) return; setBusy(true); setError('');
    try {
      for (const file of Array.from(files)) {
        const form = new FormData(); form.append('file', file);
        const response = await adminFetch(`/api/admin/course-sessions/${lesson.id}/assets`, { method: 'POST', body: form, headers: {} });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `آپلود ${file.name} انجام نشد.`);
      }
      setMessage(`${files.length} فایل با موفقیت آپلود شد.`); await loadSessions(selected);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'آپلود ناموفق بود.'); } finally { setBusy(false); }
  };

  const deleteSession = async (lesson: LearningSession) => {
    if (!confirm(`جلسه «${lesson.title}» و فایل‌های آن حذف شود؟`)) return;
    const response = await adminFetch(`/api/admin/course-sessions/${lesson.id}`, { method: 'DELETE' });
    if (response.ok && selected) loadSessions(selected);
  };

  const deleteAsset = async (id: string) => {
    const response = await adminFetch(`/api/admin/session-assets/${id}`, { method: 'DELETE' });
    if (response.ok && selected) loadSessions(selected);
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-slate-950">دوره‌ها و جلسه‌ها</h2><p className="mt-1 text-sm text-slate-500">محتوا و امتیاز هر جلسه را از یک‌جا مدیریت کنید.</p></div>
      <button onClick={() => setShowCourseForm((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white"><BookPlus className="h-5 w-5" /> دوره جدید</button>
    </div>
    {message && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700"><Check className="h-4 w-4" />{message}</div>}
    {error && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    {showCourseForm && <form onSubmit={createCourse} className="grid gap-3 rounded-3xl border border-indigo-100 bg-indigo-50/50 p-5 md:grid-cols-2">
      <input required value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} placeholder="عنوان دوره" className="input-admin" />
      <input value={courseForm.level} onChange={(e) => setCourseForm({ ...courseForm, level: e.target.value })} placeholder="سطح دوره" className="input-admin" />
      <textarea required value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} placeholder="توضیح کوتاه و ساده دوره" className="input-admin md:col-span-2 min-h-24" />
      <input value={courseForm.price} onChange={(e) => setCourseForm({ ...courseForm, price: e.target.value })} placeholder="قیمت" className="input-admin" />
      <input value={courseForm.duration} onChange={(e) => setCourseForm({ ...courseForm, duration: e.target.value })} placeholder="مدت دوره" className="input-admin" />
      <input value={courseForm.coverImage} onChange={(e) => setCourseForm({ ...courseForm, coverImage: e.target.value })} placeholder="نشانی تصویر کاور" className="input-admin md:col-span-2" dir="ltr" />
      <button disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white md:col-span-2">{busy ? 'در حال ساخت…' : 'ساخت دوره'}</button>
    </form>}
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-3">
        {courses.map((course) => <button key={course.id} onClick={() => loadSessions(course)} className={`mb-2 flex w-full items-center justify-between rounded-2xl p-3 text-right text-sm font-bold ${selected?.id === course.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50'}`}><span className="truncate">{course.title}</span><ChevronLeft className="h-4 w-4" /></button>)}
        {!courses.length && <p className="p-4 text-center text-sm text-slate-400">دوره‌ای وجود ندارد.</p>}
      </aside>
      <main className="space-y-4">
        {!selected && <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">یک دوره را برای مدیریت جلسه‌ها انتخاب کنید.</div>}
        {selected && <>
          <form onSubmit={createSession} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 md:grid-cols-2">
            <h3 className="font-black text-slate-900 md:col-span-2"><Plus className="ml-2 inline h-5 w-5 text-indigo-600" />جلسه جدید برای {selected.title}</h3>
            <input required value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} placeholder="عنوان جلسه" className="input-admin" />
            <input type="number" min="0" max="1000" value={lessonForm.xpReward} onChange={(e) => setLessonForm({ ...lessonForm, xpReward: e.target.value })} placeholder="امتیاز تکمیل" className="input-admin" />
            <textarea value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} placeholder="توضیحات جلسه، هدف و تمرین" className="input-admin min-h-24 md:col-span-2" />
            <input type="number" min="0" value={lessonForm.durationMinutes} onChange={(e) => setLessonForm({ ...lessonForm, durationMinutes: e.target.value })} placeholder="مدت دقیق ویدئو به دقیقه (برای آپلود الزامی)" className="input-admin" />
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold"><input type="checkbox" checked={lessonForm.isPublished} onChange={(e) => setLessonForm({ ...lessonForm, isPublished: e.target.checked })} /> انتشار برای هنرجو</label>
            <button disabled={busy} className="rounded-xl bg-slate-950 px-4 py-3 font-bold text-white md:col-span-2">افزودن جلسه</button>
          </form>
          {sessions.map((lesson) => <article key={lesson.id} className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-bold text-indigo-600">جلسه {lesson.orderIndex}</p><h3 className="text-lg font-black text-slate-950">{lesson.title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{lesson.description || 'بدون توضیح'}</p></div>
              <div className="flex items-center gap-2">
                <button onClick={() => patchSession(lesson, { isPublished: !lesson.isPublished })} className={`rounded-xl px-3 py-2 text-xs font-bold ${lesson.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{lesson.isPublished ? 'منتشر شده' : 'پیش‌نویس'}</button>
                <button onClick={() => deleteSession(lesson)} className="rounded-xl bg-rose-50 p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              <label className="text-xs text-slate-500">عنوان جلسه<input defaultValue={lesson.title} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== lesson.title) patchSession(lesson, { title: e.target.value }); }} className="input-admin mt-1 w-full" /></label>
              <label className="text-xs text-slate-500">توضیحات<textarea defaultValue={lesson.description} onBlur={(e) => { if (e.target.value !== lesson.description) patchSession(lesson, { description: e.target.value }); }} className="input-admin mt-1 min-h-12 w-full" /></label>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[100px_120px_160px_1fr]">
              <label className="text-xs text-slate-500">ترتیب<input type="number" min="1" defaultValue={lesson.orderIndex} onBlur={(e) => patchSession(lesson, { orderIndex: Number(e.target.value) })} className="input-admin mt-1 w-full" /></label>
              <label className="text-xs text-slate-500">امتیاز<input type="number" defaultValue={lesson.xpReward} onBlur={(e) => patchSession(lesson, { xpReward: Number(e.target.value) })} className="input-admin mt-1 w-full" /></label>
              <label className="text-xs text-slate-500">مدت ویدئو (ثانیه)<input type="number" defaultValue={lesson.durationSeconds} onBlur={(e) => patchSession(lesson, { durationSeconds: Number(e.target.value) })} className="input-admin mt-1 w-full" /></label>
              <label className="flex cursor-pointer items-center justify-center gap-2 self-end rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-100"><FileUp className="h-5 w-5" />{busy ? 'در حال آپلود…' : 'آپلود فایل‌های جلسه'}<input type="file" multiple className="hidden" accept="video/mp4,video/webm,video/quicktime,.pdf,.zip,image/*,.xlsx,.xls,.csv" onChange={(e) => uploadFiles(lesson, e.target.files)} /></label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">{lesson.assets.map((asset) => <span key={asset.id} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${asset.externalUrl ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}><Video className="h-4 w-4 text-indigo-500" /><span className="max-w-40 truncate">{asset.originalName}{asset.externalUrl ? ' · لینک قدیمی؛ جایگزین شود' : ''}</span><button onClick={() => deleteAsset(asset.id)} className="text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button></span>)}{!lesson.assets.length && <span className="text-xs text-slate-400">هنوز فایلی بارگذاری نشده است.</span>}</div>
          </article>)}
        </>}
      </main>
    </div>
  </div>;
}
