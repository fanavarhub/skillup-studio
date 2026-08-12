import { FormEvent, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Bot, CheckCircle2, Download, FileSpreadsheet, Gift, RotateCcw, Save, Users } from 'lucide-react';

type Student = { userId: string; name: string; xp: number; level: number; isBot: boolean; blocked?: boolean; publicLabel?: string; watchSeconds: number; completedVideos: number; answers: number; projects: number; lastActivityAt: string };
type DashboardData = { summary: { students: number; demoAccounts: number; totalWatchSeconds: number; submittedProjects: number }; students: Student[]; botActivities: Array<{ id: string; user_id: string; activity: string; xp_delta: number; created_at: string }> };
type CertificateRequest = { id: string; user_id: string; course_id: string; status: string; student_name: string; student_note?: string; admin_note?: string; updated_at: string };

export default function LearningAdmin({ token, courses }: { token: string; courses: Array<{ id: string; title: string }> }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [requests, setRequests] = useState<CertificateRequest[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [giftAmount, setGiftAmount] = useState('10');
  const [giftReason, setGiftReason] = useState('هدیه پیشرفت آموزشی');
  const [message, setMessage] = useState('');
  const [assignment, setAssignment] = useState({ courseId: '', title: '', description: '', dueAt: '' });
  const [certificateNotes, setCertificateNotes] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState('');

  const adminFetch = (url: string, init: RequestInit = {}) => fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) } });

  const load = async () => {
    const [dashboardResponse, requestsResponse] = await Promise.all([
      adminFetch('/api/admin/learning-dashboard'),
      adminFetch('/api/admin/certificate-requests'),
    ]);
    if (dashboardResponse.ok) {
      const result = await dashboardResponse.json();
      setData(result);
      if (!selectedUser && result.students.length) setSelectedUser(result.students[0].userId);
    }
    if (requestsResponse.ok) setRequests(await requestsResponse.json());
  };

  useEffect(() => { load().catch(console.error); }, [token]);

  const exportCsv = async () => {
    const response = await adminFetch('/api/admin/learning-dashboard.csv');
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'skillup-learning-dashboard.csv'; anchor.click();
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

  const sendAnnouncement = async () => {
    if (!announcement.trim()) return;
    const response = await adminFetch('/api/admin/club/announcement', { method: 'POST', body: JSON.stringify({ body: announcement }) });
    if (response.ok) { setAnnouncement(''); setMessage('اعلان باشگاه منتشر شد.'); }
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
      <table className="w-full text-xs min-w-[950px]"><thead className="bg-slate-100"><tr>{['هنرجو','نوع','XP / Level','زمان مشاهده','ویدئوی کامل','پاسخ‌ها','پروژه‌ها','آخرین فعالیت','باشگاه'].map((head) => <th key={head} className="p-3 text-right">{head}</th>)}</tr></thead>
        <tbody>{data.students.map((student) => <tr key={student.userId} className="border-t border-slate-100"><td className="p-3 font-bold">{student.name}</td><td className="p-3">{student.isBot ? <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 inline-flex gap-1"><Bot className="w-3 h-3"/>ربات/نمایشی</span> : 'واقعی'}</td><td className="p-3">{student.xp} / L{student.level}</td><td className="p-3">{Math.round(student.watchSeconds / 60)} دقیقه</td><td className="p-3">{student.completedVideos}</td><td className="p-3">{student.answers}</td><td className="p-3">{student.projects}</td><td className="p-3">{new Date(student.lastActivityAt).toLocaleString('fa-IR')}</td><td className="p-3"><button onClick={() => toggleBlock(student)} className={`px-2 py-1 rounded-lg font-bold ${student.blocked ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{student.blocked ? 'رفع مسدودی' : 'مسدودکردن'}</button></td></tr>)}</tbody>
      </table>
    </div>

    <section className="rounded-3xl bg-white border border-slate-200 p-5"><h4 className="font-black mb-3">اعلان باشگاه یادگیری</h4><div className="flex gap-2"><input value={announcement} onChange={(e) => setAnnouncement(e.target.value)} placeholder="پیام سراسری مدیر" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs"/><button onClick={sendAnnouncement} className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold">انتشار</button></div></section>

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
