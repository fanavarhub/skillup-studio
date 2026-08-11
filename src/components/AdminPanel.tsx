import { FormEvent, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ConsultationRequest, Course, PaymentRequest, StudentProject } from '../types';
import { Check, CheckCircle, LockKeyhole, PhoneCall, Plus, RefreshCw, Save, ShieldAlert, Star, Trash2, XCircle } from 'lucide-react';
import LearningAdmin from './LearningAdmin';

type AdminTab = 'learning' | 'payments' | 'consults' | 'projects' | 'courses';

const tokenKey = 'skillup_admin_token';

export default function AdminPanel() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) || '');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('learning');
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [consultations, setConsultations] = useState<ConsultationRequest[]>([]);
  const [projects, setProjects] = useState<StudentProject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [newCourseOpen, setNewCourseOpen] = useState(false);
  const [videoDrafts, setVideoDrafts] = useState<Record<string, { title: string; url: string; duration: string }>>({});
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    level: 'مسیر آموزشی',
    price: '۳,۰۰۰,۰۰۰ تومان',
    duration: '۸ جلسه',
    coverImage: '/assets/legacy/unsplash-1517694712202-14dd9538aa97-q60.jpg',
    onlineMeetingLink: 'https://skyroom.online/ch/skillup',
    instructor: '',
    capacity: '1000',
    enrolled: '0',
    nextSessionAt: '',
    scheduleText: 'وبینار آنلاین',
  });

  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    if (response.status === 401) {
      localStorage.removeItem(tokenKey);
      setToken('');
      throw new Error('نشست مدیر منقضی شد. دوباره وارد شوید.');
    }
    return response;
  };

  const loadData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [resPayments, resConsults, resProjects, resCourses] = await Promise.all([
        adminFetch('/api/payments'),
        adminFetch('/api/consultation'),
        adminFetch('/api/projects?all=1'),
        adminFetch('/api/courses'),
      ]);
      if (resPayments.ok) setPayments(await resPayments.json());
      if (resConsults.ok) setConsultations(await resConsults.json());
      if (resProjects.ok) setProjects(await resProjects.json());
      if (resCourses.ok) setCourses(await resCourses.json());
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'خطا در بارگذاری داده‌ها');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLoginError(data.error || 'ورود ناموفق بود.');
        return;
      }
      localStorage.setItem(tokenKey, data.token);
      setToken(data.token);
      setPassword('');
    } catch {
      setLoginError('ارتباط با سرور برقرار نشد.');
    }
  };

  const handlePaymentStatus = async (payment: PaymentRequest, status: 'approved' | 'rejected') => {
    const response = await adminFetch(`/api/payments/${payment.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, adminNotes: actionNotes[payment.id] || '' }),
    });
    if (response.ok) loadData();
  };

  const handleConsultStatus = async (id: string, status: 'pending' | 'contacted') => {
    const response = await adminFetch(`/api/consultation/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes: actionNotes[id] || '' }),
    });
    if (response.ok) loadData();
  };

  const handleProjectStatus = async (project: StudentProject, status: 'approved' | 'revision_required') => {
    const note = actionNotes[project.id] || '';
    const scoreAwarded = Math.max(0, Math.min(60, Number(actionNotes[`${project.id}:score`] || project.scoreAwarded || (status === 'approved' ? 40 : 0))));
    const response = await adminFetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, adminNotes: note, scoreAwarded, rubric: [
        { title: 'خلاقیت', maxScore: 20 }, { title: 'اجرای فنی', maxScore: 25 }, { title: 'ارائه', maxScore: 15 },
      ] }),
    });
    if (response.ok) loadData();
  };

  const handleToggleFeatured = async (project: StudentProject) => {
    const response = await adminFetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ featured: !project.featured }),
    });
    if (response.ok) loadData();
  };

  const handleDeleteProject = async (project: StudentProject) => {
    if (!confirm('از حذف پروژه مطمئن هستید؟')) return;
    const response = await adminFetch(`/api/projects/${project.id}`, { method: 'DELETE' });
    if (response.ok) loadData();
  };

  const handleCreateCourse = async (event: FormEvent) => {
    event.preventDefault();
    const response = await adminFetch('/api/courses', {
      method: 'POST',
      body: JSON.stringify({
        ...courseForm,
        capacity: Number(courseForm.capacity || 0),
        enrolled: Number(courseForm.enrolled || 0),
        offlineVideos: [],
      }),
    });
    if (response.ok) {
      setNewCourseOpen(false);
      setCourseForm((prev) => ({ ...prev, title: '', description: '' }));
      loadData();
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    if (!confirm('از غیرفعال کردن این دوره مطمئن هستید؟')) return;
    const response = await adminFetch(`/api/courses/${course.id}`, { method: 'DELETE' });
    if (response.ok) loadData();
  };

  const handleAddVideo = async (course: Course) => {
    const draft = videoDrafts[course.id];
    if (!draft?.title.trim() || !draft.url.trim()) return;
    const offlineVideos = [...(course.offlineVideos || []), { id: `video-${Date.now()}`, title: draft.title.trim(), url: draft.url.trim(), duration: draft.duration.trim() || '10' }];
    const response = await adminFetch(`/api/courses/${course.id}`, { method: 'PATCH', body: JSON.stringify({ offlineVideos }) });
    if (response.ok) { setVideoDrafts({ ...videoDrafts, [course.id]: { title: '', url: '', duration: '' } }); loadData(); }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl">
        <form onSubmit={handleLogin} className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl space-y-5 text-right">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
            <LockKeyhole className="w-7 h-7" />
          </div>
          <div>
            <h1 className="font-sans font-extrabold text-2xl text-slate-950">ورود مدیر اسکیل آپ</h1>
            <p className="font-sans text-xs text-slate-500 mt-2">برای دیدن پرداخت‌ها، تایید پروژه‌ها و مدیریت درخواست‌ها وارد شوید.</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="رمز مدیر"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-sans outline-none focus:ring-2 focus:ring-indigo-200"
          />
          {loginError && <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-sans font-bold">{loginError}</div>}
          <button className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold text-sm">
            ورود به پنل مدیریت
          </button>
          <p className="font-sans text-[11px] text-slate-400">رمز مدیریت از تنظیمات امن سرور خوانده می‌شود.</p>
        </form>
      </div>
    );
  }

  const tabItems: { id: AdminTab; label: string; count: number }[] = [
    { id: 'learning', label: 'داشبورد آموزشی', count: 0 },
    { id: 'payments', label: 'پرداخت‌ها', count: payments.length },
    { id: 'consults', label: 'مشاوره‌ها', count: consultations.length },
    { id: 'projects', label: 'پروژه‌ها', count: projects.length },
    { id: 'courses', label: 'دوره‌ها', count: courses.length },
  ];

  return (
    <div className="bg-slate-50 min-h-screen py-10" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl text-right">
          <div className="space-y-2">
            <h1 className="font-sans font-extrabold text-2xl sm:text-3xl flex items-center gap-2">
              <ShieldAlert className="w-7 h-7 text-amber-500" />
              <span>پنل مدیریت اسکیل آپ</span>
            </h1>
            <p className="font-sans text-xs text-slate-300">تایید فیش‌های کارت‌به‌کارت، مدیریت تماس‌ها، پروژه‌های هنرجویی و دوره‌ها.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadData} className="flex items-center gap-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-sans rounded-xl">
              <RefreshCw className="w-4 h-4" />
              بروزرسانی
            </button>
            <button onClick={() => { localStorage.removeItem(tokenKey); setToken(''); }} className="px-4 py-2 bg-rose-500/20 text-rose-100 text-xs font-sans rounded-xl">
              خروج
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 bg-gray-200/60 p-1.5 rounded-2xl max-w-3xl">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl font-sans text-xs sm:text-sm font-bold transition-all ${
                activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
            <p className="font-sans text-xs text-gray-500">در حال بارگذاری اطلاعات...</p>
          </div>
        ) : (
          <>
            {activeTab === 'learning' && <LearningAdmin token={token} courses={courses} />}
            {activeTab === 'payments' && (
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-5 text-right">
                <h3 className="font-sans font-extrabold text-slate-900 text-lg">فیش‌های کارت‌به‌کارت دوره‌ها</h3>
                {payments.length === 0 ? (
                  <EmptyState text="هنوز فیشی برای بررسی ثبت نشده است." />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {payments.map((payment) => (
                      <div key={payment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h4 className="font-sans font-extrabold text-slate-950">{payment.courseTitle}</h4>
                            <p className="font-sans text-xs text-slate-500 mt-1">{payment.studentName} - {payment.phone}</p>
                          </div>
                          <StatusBadge status={payment.status} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs font-sans">
                          <Info label="مبلغ" value={payment.amount} />
                          <Info label="شماره فیش" value={payment.receiptNumber} />
                          <Info label="۴ رقم کارت" value={payment.cardLastFour || '-'} />
                          <Info label="پرداخت‌کننده" value={payment.payerName || '-'} />
                        </div>
                        {payment.notes && <p className="font-sans text-xs text-slate-500 bg-white rounded-xl p-3 border border-slate-100">{payment.notes}</p>}
                        <input
                          value={actionNotes[payment.id] || payment.adminNotes || ''}
                          onChange={(e) => setActionNotes({ ...actionNotes, [payment.id]: e.target.value })}
                          placeholder="یادداشت مدیر برای این پرداخت"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-sans"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => handlePaymentStatus(payment, 'approved')} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-sans font-bold flex items-center justify-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            تایید و فعال‌سازی دوره
                          </button>
                          <button onClick={() => handlePaymentStatus(payment, 'rejected')} className="flex-1 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-sans font-bold flex items-center justify-center gap-1">
                            <XCircle className="w-4 h-4" />
                            رد فیش
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'consults' && (
              <PanelTable title="درخواست‌های مشاوره">
                {consultations.length === 0 ? <EmptyState text="درخواست تماسی ثبت نشده است." /> : consultations.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
                    <div className="space-y-1">
                      <p className="font-mono font-black text-slate-950">{item.phone}</p>
                      <p className="font-sans text-xs text-slate-500">{item.device} - {item.browser} - {item.ip}</p>
                      <p className="font-sans text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString('fa-IR')}</p>
                    </div>
                    <input value={actionNotes[item.id] || item.notes || ''} onChange={(e) => setActionNotes({ ...actionNotes, [item.id]: e.target.value })} placeholder="یادداشت تماس" className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-sans bg-white min-w-64" />
                    <button onClick={() => handleConsultStatus(item.id, item.status === 'contacted' ? 'pending' : 'contacted')} className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-sans text-xs font-bold flex items-center gap-1 justify-center">
                      <PhoneCall className="w-4 h-4" />
                      {item.status === 'contacted' ? 'بازگشت به انتظار' : 'تماس گرفته شد'}
                    </button>
                  </div>
                ))}
              </PanelTable>
            )}

            {activeTab === 'projects' && (
              <PanelTable title="مدیریت پروژه‌های هنرجویی">
                {projects.map((project) => (
                  <div key={project.id} className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-4">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div>
                        <h4 className="font-sans font-extrabold text-slate-950">{project.title}</h4>
                        <p className="font-sans text-xs text-slate-500 mt-1">{project.studentName} ({project.studentAge} سال) - {project.category}</p>
                        <p className="font-sans text-xs text-slate-500 mt-2 leading-relaxed">{project.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 items-start">
                        <StatusBadge status={project.status} />
                        {project.featured && <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-sans font-bold">منتخب هفته</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <input value={actionNotes[project.id] || project.adminNotes || ''} onChange={(e) => setActionNotes({ ...actionNotes, [project.id]: e.target.value })} placeholder="یادداشت مربی یا موارد اصلاح" className="md:col-span-3 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs" />
                      <input type="number" min="0" max="60" value={actionNotes[`${project.id}:score`] || String(project.scoreAwarded || '')} onChange={(e) => setActionNotes({ ...actionNotes, [`${project.id}:score`]: e.target.value })} placeholder="امتیاز از ۶۰" className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleProjectStatus(project, 'approved')} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-sans font-bold flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        تایید
                      </button>
                      <button onClick={() => handleProjectStatus(project, 'revision_required')} className="px-3 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-sans font-bold">نیازمند اصلاح</button>
                      <button onClick={() => handleToggleFeatured(project)} className="px-3 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-sans font-bold flex items-center gap-1">
                        <Star className="w-4 h-4" />
                        {project.featured ? 'حذف از منتخب' : 'منتخب هفته'}
                      </button>
                      <button onClick={() => handleDeleteProject(project)} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-sans font-bold flex items-center gap-1">
                        <Trash2 className="w-4 h-4" />
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </PanelTable>
            )}

            {activeTab === 'courses' && (
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-5 text-right">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-sans font-extrabold text-slate-900 text-lg">دوره‌ها و کلاس‌های آنلاین</h3>
                  <button onClick={() => setNewCourseOpen(!newCourseOpen)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-sans text-xs font-bold flex items-center gap-1">
                    <Plus className="w-4 h-4" />
                    دوره جدید
                  </button>
                </div>

                {newCourseOpen && (
                  <form onSubmit={handleCreateCourse} className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-5">
                    {Object.entries(courseForm).map(([key, value]) => (
                      <input
                        key={key}
                        value={value}
                        onChange={(e) => setCourseForm({ ...courseForm, [key]: e.target.value })}
                        placeholder={courseLabel(key)}
                        className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-sans"
                      />
                    ))}
                    <button className="md:col-span-2 py-2.5 rounded-xl bg-indigo-600 text-white font-sans text-xs font-bold flex items-center justify-center gap-1">
                      <Save className="w-4 h-4" />
                      ذخیره دوره
                    </button>
                  </form>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {courses.map((course) => (
                    <div key={course.id} className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex gap-4">
                      <img src={course.coverImage} className="w-24 h-24 rounded-2xl object-cover" alt={course.title} />
                      <div className="flex-1 space-y-2">
                        <h4 className="font-sans font-extrabold text-slate-950">{course.title}</h4>
                        <p className="font-sans text-xs text-slate-500">{course.instructor || 'بدون مربی'} - {course.scheduleText || 'بدون زمان‌بندی'}</p>
                        <p className="font-sans text-xs text-slate-500">ظرفیت: {course.enrolled || 0} / {course.capacity || 0}</p>
                        <div className="grid grid-cols-1 gap-1.5 pt-2">
                          <input value={videoDrafts[course.id]?.title || ''} onChange={(e) => setVideoDrafts({ ...videoDrafts, [course.id]: { ...(videoDrafts[course.id] || { url: '', duration: '' }), title: e.target.value } })} placeholder="عنوان ویدئوی پیوست" className="px-2 py-1.5 rounded-lg border border-slate-200 text-[11px]" />
                          <input value={videoDrafts[course.id]?.url || ''} onChange={(e) => setVideoDrafts({ ...videoDrafts, [course.id]: { ...(videoDrafts[course.id] || { title: '', duration: '' }), url: e.target.value } })} placeholder="لینک امن ویدئو" className="px-2 py-1.5 rounded-lg border border-slate-200 text-[11px]" dir="ltr" />
                          <div className="flex gap-1"><input value={videoDrafts[course.id]?.duration || ''} onChange={(e) => setVideoDrafts({ ...videoDrafts, [course.id]: { ...(videoDrafts[course.id] || { title: '', url: '' }), duration: e.target.value } })} placeholder="دقیقه" className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-[11px]"/><button onClick={() => handleAddVideo(course)} className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-bold">افزودن پیوست</button></div>
                        </div>
                        <button onClick={() => handleDeleteCourse(course)} className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-[11px] font-sans font-bold">غیرفعال کردن</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PanelTable({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-5 text-right">
      <h3 className="font-sans font-extrabold text-slate-900 text-lg">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-12 text-center text-gray-400 font-sans text-xs border-2 border-dashed border-slate-150 rounded-2xl">{text}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-3">
      <span className="text-[10px] text-slate-400 block">{label}</span>
      <span className="font-bold text-slate-800">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-100',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    contacted: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rejected: 'bg-rose-50 text-rose-700 border-rose-100',
    revision_required: 'bg-amber-50 text-amber-800 border-amber-200',
  };
  const labels: Record<string, string> = {
    pending: 'در انتظار',
    approved: 'تایید شده',
    contacted: 'تماس گرفته شد',
    rejected: 'رد شده',
    revision_required: 'نیازمند اصلاح',
  };
  return <span className={`px-3 py-1 rounded-full border text-[10px] font-sans font-bold ${styles[status] || styles.pending}`}>{labels[status] || status}</span>;
}

function courseLabel(key: string) {
  const labels: Record<string, string> = {
    title: 'عنوان دوره',
    description: 'توضیح دوره',
    level: 'سطح',
    price: 'شهریه',
    duration: 'مدت دوره',
    coverImage: 'تصویر کاور',
    onlineMeetingLink: 'لینک کلاس آنلاین',
    instructor: 'مربی',
    capacity: 'ظرفیت',
    enrolled: 'ثبت‌نام‌شده',
    nextSessionAt: 'زمان جلسه بعدی مثل 2026-07-06T18:00:00+03:30',
    scheduleText: 'برنامه هفتگی',
  };
  return labels[key] || key;
}
