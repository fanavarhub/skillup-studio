import { FormEvent, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Bot, CheckCircle2, Download, FileSpreadsheet, Gift, Layers3, Pencil, PlusCircle, RotateCcw, Save, Trash2, Users } from 'lucide-react';

type Student = { userId: string; name: string; xp: number; level: number; assignedLevel?: number; avatar?: string; isBot: boolean; blocked?: boolean; publicLabel?: string; watchSeconds: number; completedVideos: number; answers: number; projects: number; lastActivityAt: string };
type DashboardData = { summary: { students: number; demoAccounts: number; totalWatchSeconds: number; submittedProjects: number }; students: Student[]; botActivities: Array<{ id: string; user_id: string; activity: string; xp_delta: number; created_at: string }> };
type CertificateRequest = { id: string; user_id: string; course_id: string; status: string; student_name: string; student_note?: string; admin_note?: string; updated_at: string };
type DailyTask = { id: string; levelBand: string; courseId?: string; courseTitle?: string; question: string; options: string[]; answerIndex: number; explanation?: string; xpReward: number; sortOrder: number; isActive: boolean };
const emptyTask = { courseId: '', levelBand: 'starter', question: '', option1: '', option2: '', option3: '', option4: '', answerIndex: '0', explanation: '', xpReward: '3', sortOrder: '0' };

export default function LearningAdmin({ token, courses }: { token: string; courses: Array<{ id: string; title: string }> }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [requests, setRequests] = useState<CertificateRequest[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [giftAmount, setGiftAmount] = useState('10');
  const [giftReason, setGiftReason] = useState('هدیه پیشرفت آموزشی');
  const [message, setMessage] = useState('');
  const [assignment, setAssignment] = useState({ courseId: '', title: '', description: '', dueAt: '' });
  const [certificateNotes, setCertificateNotes] = useState<Record<string, string>>({});
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState('');

  const adminFetch = (url: string, init: RequestInit = {}) => fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) } });

  const load = async () => {
    const [dashboardResponse, requestsResponse, tasksResponse] = await Promise.all([
      adminFetch('/api/admin/learning-dashboard'),
      adminFetch('/api/admin/certificate-requests'),
      adminFetch('/api/admin/questions'),
    ]);
    if (dashboardResponse.ok) {
      const result = await dashboardResponse.json();
      setData(result);
      if (!selectedUser && result.students.length) setSelectedUser(result.students[0].userId);
    }
    if (requestsResponse.ok) setRequests(await requestsResponse.json());
    if (tasksResponse.ok) setTasks(await tasksResponse.json());
  };

  useEffect(() => { load().catch(console.error); }, [token]);

  const exportCsv = async () => {
    const response = await adminFetch('/api/admin/learning-dashboard.csv');
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'skillup-users-report.csv'; anchor.click();
    URL.revokeObjectURL(url);
  };

  const sendGift = async (event: FormEvent) => {
    event.preventDefault(); setMessage('');
    const response = await adminFetch('/api/admin/xp-gift', { method: 'POST', body: JSON.stringify({ userId: selectedUser, amount: Number(giftAmount), reason: giftReason }) });
    const result = await response.json();
    setMessage(response.ok ? `${result.xpAwarded} XP ثبت شد.` : result.error);
    if (response.ok) load().catch(console.error);
  };

  const decideCertificate = async (id: string, status: 'approved' | 'revision_required') => {
    await adminFetch(`/api/admin/certificate-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status, adminNote: certificateNotes[id] || '' }) });
    load().catch(console.error);
  };

  const createAssignment = async (event: FormEvent) => {
    event.preventDefault();
    const response = await adminFetch('/api/admin/assignments', { method: 'POST', body: JSON.stringify({ ...assignment, rubric: [{ title: 'خلاقیت', maxScore: 20 }, { title: 'اجرای فنی', maxScore: 25 }, { title: 'ارائه', maxScore: 15 }] }) });
    if (response.ok) { setAssignment({ courseId: '', title: '', description: '', dueAt: '' }); setMessage('تکلیف پروژه با Rubric شصت‌امتیازی ثبت شد.'); }
  };

  const toggleBlock = async (student: Student) => {
    await adminFetch(`/api/admin/users/${student.userId}/block`, { method: 'POST', body: JSON.stringify({ blocked: !student.blocked, reason: 'مدیریت باشگاه' }) });
    load().catch(console.error);
  };

  const setLearningLevel = async (student: Student, level: number) => {
    const response = await adminFetch(`/api/admin/users/${student.userId}/learning-level`, { method: 'PATCH', body: JSON.stringify({ level }) });
    if (response.ok) { setMessage(`سطح آموزشی ${student.name} روی ${level} تنظیم شد.`); load().catch(console.error); }
  };

  const saveTask = async (event: FormEvent) => {
    event.preventDefault();
    const payload = { courseId: taskForm.courseId, levelBand: taskForm.levelBand, question: taskForm.question, options: [taskForm.option1, taskForm.option2, taskForm.option3, taskForm.option4].filter(Boolean), answerIndex: Number(taskForm.answerIndex), explanation: taskForm.explanation, xpReward: Number(taskForm.xpReward), sortOrder: Number(taskForm.sortOrder), isActive: true };
    const response = await adminFetch(editingTask ? `/api/admin/questions/${editingTask}` : '/api/admin/questions', { method: editingTask ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    const result = await response.json();
    setMessage(response.ok ? (editingTask ? 'مأموریت ویرایش شد.' : 'مأموریت جدید اضافه شد.') : result.error);
    if (response.ok) { setTaskForm(emptyTask); setEditingTask(null); load().catch(console.error); }
  };

  const editTask = (task: DailyTask) => {
    setEditingTask(task.id);
    setTaskForm({ courseId: task.courseId || '', levelBand: task.levelBand, question: task.question, option1: task.options[0] || '', option2: task.options[1] || '', option3: task.options[2] || '', option4: task.options[3] || '', answerIndex: String(task.answerIndex), explanation: task.explanation || '', xpReward: String(task.xpReward), sortOrder: String(task.sortOrder) });
  };

  const toggleTask = async (task: DailyTask) => {
    await adminFetch(`/api/admin/questions/${task.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !task.isActive }) });
    load().catch(console.error);
  };

  const addBulkTasks = async () => {
    const parsed = bulkText.split(/\r?\n/).map((line, sortOrder) => {
      const [question, option1, option2, option3, option4, answer, explanation = ''] = line.split('|').map((part) => part.trim());
      return { question, options: [option1, option2, option3, option4].filter(Boolean), answerIndex: Math.max(0, Number(answer) - 1), explanation, courseId: taskForm.courseId, levelBand: taskForm.levelBand, xpReward: Number(taskForm.xpReward), sortOrder };
    }).filter((item) => item.question && item.options.length >= 2);
    const response = await adminFetch('/api/admin/questions/bulk', { method: 'POST', body: JSON.stringify({ tasks: parsed }) });
    const result = await response.json();
    setMessage(response.ok ? `${result.created} مأموریت به‌صورت گروهی اضافه شد.` : result.error);
    if (response.ok) { setBulkText(''); load().catch(console.error); }
  };

  if (!data) return <div className="py-20 text-center text-sm text-slate-500">در حال آماده‌سازی داشبورد آموزشی…</div>;

  return <div className="space-y-6 text-right" dir="rtl">
    <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
      <div><h3 className="font-black text-xl">داشبورد آموزشی مدیر</h3><p className="text-xs text-slate-500 mt-1">نمای جلسه‌ای شبیه Code.org؛ مشاهده، پاسخ، پروژه و فعالیت حساب‌های نمایشی.</p></div>
      <button onClick={exportCsv} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/>خروجی Excel/CSV</button>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Metric label="هنرجوی واقعی" value={data.summary.students} icon={<Users className="w-5 h-5"/>}/>
      <Metric label="حساب نمایشی" value={data.summary.demoAccounts} icon={<Bot className="w-5 h-5"/>}/>
      <Metric label="زمان مشاهده" value={`${Math.round(data.summary.totalWatchSeconds / 60)} دقیقه`} icon={<Download className="w-5 h-5"/>}/>
      <Metric label="پروژه ارسال‌شده" value={data.summary.submittedProjects} icon={<CheckCircle2 className="w-5 h-5"/>}/>
    </div>

    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-xs min-w-[1050px]"><thead className="bg-slate-100"><tr>{['هنرجو','نوع','XP','سطح آموزشی','زمان مشاهده','ویدئوی کامل','پاسخ‌ها','پروژه‌ها','آخرین فعالیت','باشگاه'].map((head) => <th key={head} className="p-3 text-right">{head}</th>)}</tr></thead>
        <tbody>{data.students.map((student) => <tr key={student.userId} className="border-t border-slate-100"><td className="p-3 font-bold"><span className="ml-2 text-lg">{student.avatar || '🧑‍🚀'}</span>{student.name}</td><td className="p-3">{student.isBot ? <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 inline-flex gap-1"><Bot className="w-3 h-3"/>ربات/نمایشی</span> : 'واقعی'}</td><td className="p-3">{student.xp}</td><td className="p-3"><select value={student.level} onChange={(event) => setLearningLevel(student, Number(event.target.value))} className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 font-bold text-violet-700">{Array.from({ length: 50 }, (_, index) => index + 1).map((level) => <option key={level} value={level}>سطح {level}</option>)}</select></td><td className="p-3">{Math.round(student.watchSeconds / 60)} دقیقه</td><td className="p-3">{student.completedVideos}</td><td className="p-3">{student.answers}</td><td className="p-3">{student.projects}</td><td className="p-3">{new Date(student.lastActivityAt).toLocaleString('fa-IR')}</td><td className="p-3"><button onClick={() => toggleBlock(student)} className={`px-2 py-1 rounded-lg font-bold ${student.blocked ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{student.blocked ? 'رفع مسدودی' : 'مسدودکردن'}</button></td></tr>)}</tbody>
      </table>
    </div>

    <section className="rounded-[30px] border-2 border-violet-100 bg-white p-5 shadow-sm"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h4 className="flex items-center gap-2 text-lg font-black"><Layers3 className="h-5 w-5 text-violet-600"/>مدیریت مأموریت‌های روزانه</h4><p className="mt-1 text-xs text-slate-500">هر هنرجو روزانه فقط یک مرحله متناسب با دوره فعال و سطح تعیین‌شده دریافت می‌کند.</p></div><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">{tasks.filter((task) => task.isActive).length} مأموریت فعال</span></div>
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]"><div className="space-y-4"><form onSubmit={saveTask} className="space-y-3 rounded-3xl bg-violet-50/60 p-4"><h5 className="font-black">{editingTask ? 'ویرایش مأموریت' : 'مأموریت جدید'}</h5><div className="grid grid-cols-2 gap-2"><select value={taskForm.courseId} onChange={(event) => setTaskForm({ ...taskForm, courseId: event.target.value })} className="input-admin"><option value="">مهارت عمومی</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select><select value={taskForm.levelBand} onChange={(event) => setTaskForm({ ...taskForm, levelBand: event.target.value })} className="input-admin"><option value="starter">سطح ۱ تا ۱۰</option><option value="skiller">سطح ۱۱ تا ۳۰</option><option value="master">سطح ۳۱ به بالا</option></select></div><textarea required value={taskForm.question} onChange={(event) => setTaskForm({ ...taskForm, question: event.target.value })} placeholder="متن مأموریت یا سؤال" className="input-admin min-h-20 w-full"/><div className="grid grid-cols-2 gap-2">{(['option1','option2','option3','option4'] as const).map((key, index) => <input required={index < 2} key={key} value={taskForm[key]} onChange={(event) => setTaskForm({ ...taskForm, [key]: event.target.value })} placeholder={`گزینه ${index + 1}`} className="input-admin"/>)}</div><div className="grid grid-cols-3 gap-2"><select value={taskForm.answerIndex} onChange={(event) => setTaskForm({ ...taskForm, answerIndex: event.target.value })} className="input-admin"><option value="0">پاسخ ۱</option><option value="1">پاسخ ۲</option><option value="2">پاسخ ۳</option><option value="3">پاسخ ۴</option></select><input type="number" min="1" max="100" value={taskForm.xpReward} onChange={(event) => setTaskForm({ ...taskForm, xpReward: event.target.value })} className="input-admin" title="امتیاز"/><input type="number" value={taskForm.sortOrder} onChange={(event) => setTaskForm({ ...taskForm, sortOrder: event.target.value })} className="input-admin" title="ترتیب"/></div><input value={taskForm.explanation} onChange={(event) => setTaskForm({ ...taskForm, explanation: event.target.value })} placeholder="توضیح پاسخ" className="input-admin w-full"/><div className="flex gap-2"><button className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-600 py-2.5 text-xs font-black text-white"><PlusCircle className="h-4 w-4"/>{editingTask ? 'ذخیره تغییرات' : 'افزودن مأموریت'}</button>{editingTask && <button type="button" onClick={() => { setEditingTask(null); setTaskForm(emptyTask); }} className="rounded-2xl bg-white px-4 text-xs font-bold text-slate-500">انصراف</button>}</div></form>
        <div className="rounded-3xl border border-dashed border-sky-200 bg-sky-50/60 p-4"><h5 className="font-black text-sky-900">افزودن گروهی</h5><p className="mt-1 text-[10px] leading-5 text-sky-700">هر خط: سؤال | گزینه۱ | گزینه۲ | گزینه۳ | گزینه۴ | شماره پاسخ ۱ تا ۴ | توضیح</p><textarea value={bulkText} onChange={(event) => setBulkText(event.target.value)} className="input-admin mt-3 min-h-28 w-full" placeholder="۲+۲ چند است؟ | ۳ | ۴ | ۵ | ۶ | ۲ | پاسخ ۴ است"/><button type="button" onClick={addBulkTasks} className="mt-2 w-full rounded-2xl bg-sky-600 py-2.5 text-xs font-black text-white">ثبت گروهی با دوره و سطح انتخاب‌شده بالا</button></div></div>
        <div className="max-h-[680px] space-y-2 overflow-y-auto pl-1">{tasks.map((task) => <article key={task.id} className={`rounded-2xl border p-4 ${task.isActive ? 'border-slate-100 bg-white' : 'border-slate-200 bg-slate-50 opacity-65'}`}><div className="flex items-start justify-between gap-3"><div><div className="mb-2 flex flex-wrap gap-1"><span className="rounded-full bg-violet-100 px-2 py-1 text-[9px] font-bold text-violet-700">{task.levelBand}</span><span className="rounded-full bg-sky-100 px-2 py-1 text-[9px] font-bold text-sky-700">{task.courseTitle || 'عمومی'}</span><span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-bold text-amber-700">{task.xpReward} XP</span></div><h6 className="text-sm font-black leading-7 text-slate-800">{task.question}</h6><p className="mt-1 text-[10px] text-slate-400">{task.options.join(' · ')}</p></div><div className="flex shrink-0 gap-1"><button onClick={() => editTask(task)} className="rounded-xl bg-indigo-50 p-2 text-indigo-600" title="ویرایش"><Pencil className="h-4 w-4"/></button><button onClick={() => toggleTask(task)} className={`rounded-xl p-2 ${task.isActive ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`} title={task.isActive ? 'غیرفعال‌کردن' : 'فعال‌کردن'}>{task.isActive ? <Trash2 className="h-4 w-4"/> : <RotateCcw className="h-4 w-4"/>}</button></div></div></article>)}</div></div>
    </section>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <form onSubmit={sendGift} className="rounded-3xl bg-white border border-slate-200 p-5 space-y-3"><h4 className="font-black flex items-center gap-2"><Gift className="w-5 h-5 text-fuchsia-600"/>هدیه یا اصلاح XP با دلیل</h4>
        <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="w-full rounded-xl border p-2 text-xs">{data.students.map((student) => <option key={student.userId} value={student.userId}>{student.name}{student.isBot ? ' (ربات)' : ''}</option>)}</select>
        <div className="grid grid-cols-3 gap-2"><input type="number" value={giftAmount} onChange={(e) => setGiftAmount(e.target.value)} className="rounded-xl border p-2 text-xs"/><input value={giftReason} onChange={(e) => setGiftReason(e.target.value)} className="col-span-2 rounded-xl border p-2 text-xs"/></div>
        <button className="w-full rounded-xl bg-fuchsia-600 text-white py-2 text-xs font-bold">ثبت در دفترکل</button>{message && <p className="text-xs text-indigo-600 font-bold">{message}</p>}
      </form>

      <form onSubmit={createAssignment} className="rounded-3xl bg-white border border-slate-200 p-5 space-y-3"><h4 className="font-black flex items-center gap-2"><Save className="w-5 h-5 text-indigo-600"/>تکلیف پروژه و Rubric</h4>
        <select required value={assignment.courseId} onChange={(e) => setAssignment({...assignment, courseId:e.target.value})} className="w-full rounded-xl border p-2 text-xs"><option value="">انتخاب دوره</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select>
        <input required value={assignment.title} onChange={(e) => setAssignment({...assignment, title:e.target.value})} placeholder="عنوان پروژه" className="w-full rounded-xl border p-2 text-xs"/>
        <textarea value={assignment.description} onChange={(e) => setAssignment({...assignment, description:e.target.value})} placeholder="توضیحات" className="w-full rounded-xl border p-2 text-xs"/>
        <input type="datetime-local" value={assignment.dueAt} onChange={(e) => setAssignment({...assignment, dueAt:e.target.value})} className="w-full rounded-xl border p-2 text-xs"/>
        <button className="w-full rounded-xl bg-indigo-600 text-white py-2 text-xs font-bold">ایجاد پروژه با Rubric پیش‌فرض ۶۰ امتیازی</button>
      </form>
    </div>

    <section className="rounded-3xl bg-white border border-slate-200 p-5"><h4 className="font-black mb-4">درخواست‌های گواهینامه</h4><div className="space-y-3">
      {requests.length === 0 && <p className="text-xs text-slate-400">درخواستی ثبت نشده است.</p>}
      {requests.map((request) => <div key={request.id} className="rounded-2xl bg-slate-50 border p-4 space-y-3"><div className="flex flex-col lg:flex-row gap-3 justify-between"><div><b>{request.student_name}</b><p className="text-xs text-slate-500 mt-1">دوره: {request.course_id} · وضعیت: {request.status}</p></div><div className="flex gap-2"><button onClick={() => decideCertificate(request.id,'approved')} className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">تأیید و صدور QR</button><button onClick={() => decideCertificate(request.id,'revision_required')} className="px-3 py-2 bg-amber-100 text-amber-800 rounded-xl text-xs font-bold flex gap-1"><RotateCcw className="w-4 h-4"/>نیازمند اصلاح</button></div></div><input value={certificateNotes[request.id] || request.admin_note || ''} onChange={(e) => setCertificateNotes({...certificateNotes,[request.id]:e.target.value})} placeholder="یادداشت تأیید یا توضیح اصلاح" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white"/></div>)}
    </div></section>

    <section className="rounded-3xl bg-slate-950 text-white p-5"><h4 className="font-black flex gap-2"><Bot className="w-5 h-5 text-amber-400"/>گزارش رفتار حساب‌های نمایشی</h4><p className="text-xs text-slate-400 mt-1">این حساب‌ها فقط برای تست پنل مدیر نگه‌داری می‌شوند و وارد لیگ عمومی هنرجوها نمی‌شوند.</p><div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">{data.botActivities.slice(0,10).map((item) => <div key={item.id} className="rounded-xl bg-white/5 p-3 text-xs">{item.user_id}: {item.activity} · +{item.xp_delta} XP</div>)}</div></section>
  </div>;
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) { return <div className="rounded-2xl bg-white border border-slate-200 p-4"><span className="text-indigo-600">{icon}</span><small className="block text-slate-500 mt-2">{label}</small><strong className="text-xl block mt-1">{value}</strong></div>; }
