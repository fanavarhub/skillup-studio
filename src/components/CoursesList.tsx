import { useEffect, useMemo, useState } from 'react';
import { Course, PaymentRequest } from '../types';
import { CalendarDays, CheckCircle2, Clock, CreditCard, Layers, Lock, Sparkles, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { authenticatedFetch } from '../api';

interface CoursesListProps {
  onUnlockCourse: (courseId: string) => void;
  unlockedCourses: string[];
  setCurrentTab: (tab: string) => void;
  studentName?: string;
}

const defaultStudentName = 'نوجوان خلاق اسکیل آپ';
const bankCardNumber = '6037-9975-1234-5678';
const bankAccountOwner = 'Skill Up Academy';
const courseAccents = [
  'border-violet-200 shadow-violet-100/70', 'border-sky-200 shadow-sky-100/70', 'border-amber-200 shadow-amber-100/70',
  'border-emerald-200 shadow-emerald-100/70', 'border-rose-200 shadow-rose-100/70', 'border-fuchsia-200 shadow-fuchsia-100/70',
];

export default function CoursesList({ onUnlockCourse, unlockedCourses, setCurrentTab, studentName: loggedInStudentName }: CoursesListProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [studentName, setStudentName] = useState(defaultStudentName);
  const [phone, setPhone] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [cardLastFour, setCardLastFour] = useState('');
  const [payerName, setPayerName] = useState('');
  const [notes, setNotes] = useState('');

  const activePaymentByCourse = useMemo(() => {
    return payments.reduce<Record<string, PaymentRequest>>((acc, payment) => {
      acc[payment.courseId] = payment;
      return acc;
    }, {});
  }, [payments]);

  const fetchCourses = async () => {
    try {
      const response = await authenticatedFetch('/api/courses');
      if (response.ok) setCourses(await response.json());
    } catch (err) {
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async (name = studentName) => {
    if (!name.trim()) return;
    try {
      const response = await authenticatedFetch('/api/payments');
      if (response.ok) setPayments(await response.json());
    } catch (err) {
      console.error('Error fetching payments:', err);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchPayments(defaultStudentName);
  }, []);

  useEffect(() => {
    if (loggedInStudentName) {
      setStudentName(loggedInStudentName);
      fetchPayments(loggedInStudentName);
    }
  }, [loggedInStudentName]);

  const resetPaymentForm = () => {
    setPaymentSuccess('');
    setPaymentError('');
    setPhone('');
    setReceiptNumber('');
    setCardLastFour('');
    setPayerName('');
    setNotes('');
  };

  const openCourse = (course: Course) => {
    setCurrentTab(`course:${course.id}`);
  };

  const handleSubmitReceipt = async () => {
    if (!activeCourse) return;
    setIsSubmitting(true);
    setPaymentError('');
    setPaymentSuccess('');

    try {
      const response = await authenticatedFetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim() || defaultStudentName,
          phone,
          courseId: activeCourse.id,
          receiptNumber,
          cardLastFour,
          payerName,
          notes,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setPaymentError(data.error || 'ثبت فیش با خطا روبه‌رو شد.');
        if (data.payment) setPayments((prev) => [data.payment, ...prev.filter((p) => p.id !== data.payment.id)]);
        return;
      }
      setPayments((prev) => [data.payment, ...prev.filter((p) => p.id !== data.payment.id)]);
      setPaymentSuccess('فیش شما ثبت شد و بعد از تایید مدیر، دوره در پنل هنرجو فعال می‌شود.');
      fetchPayments(studentName);
    } catch (err) {
      setPaymentError('ارتباط با سرور برقرار نشد. لطفا دوباره تلاش کنید.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCourseUnlocked = (courseId: string) => {
    return unlockedCourses.includes(courseId) || activePaymentByCourse[courseId]?.status === 'approved';
  };

  const paymentBadge = (courseId: string) => {
    const payment = activePaymentByCourse[courseId];
    if (!payment) return null;
    if (payment.status === 'pending') return 'فیش در انتظار تایید';
    if (payment.status === 'approved') return 'تایید شده و فعال';
    return 'فیش رد شده';
  };

  return (
    <section data-tour="home-courses" className="relative overflow-hidden py-20 bg-gradient-to-b from-violet-50/70 via-white to-sky-50/60" dir="rtl">
      <div className="pointer-events-none absolute -right-16 top-20 h-48 w-48 rounded-full bg-amber-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-20 h-56 w-56 rounded-full bg-fuchsia-200/30 blur-3xl" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <span className="text-indigo-600 font-sans font-bold text-xs sm:text-sm uppercase block">🎓 فروشگاه دوره‌های اسکیل آپ</span>
          <h2 className="font-sans text-3xl sm:text-4xl font-extrabold text-gray-950">مسیرهای مهارتی اختصاصی آنلاین</h2>
          <p className="font-sans text-xs sm:text-sm text-gray-500 leading-relaxed">
            پرداخت دوره‌ها به‌صورت کارت‌به‌کارت انجام می‌شود. بعد از ارسال شماره فیش، مدیر پرداخت را بررسی می‌کند و دوره در پنل هنرجو فعال می‌شود.
          </p>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="font-sans text-xs text-gray-500">بارگذاری دوره‌های آموزشی...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map((course, courseIndex) => {
              const isUnlocked = isCourseUnlocked(course.id);
              const badge = paymentBadge(course.id);
              const remaining = Math.max((course.capacity || 0) - (course.enrolled || 0), 0);
              return (
                <div
                  key={course.id}
                  className={`playful-card relative bg-white rounded-[30px] border-2 ${courseAccents[courseIndex % courseAccents.length]} overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300 flex flex-col justify-between h-full text-right group`}
                >
                  <div className={`absolute inset-x-0 top-0 z-10 h-1.5 ${['bg-violet-500','bg-sky-500','bg-amber-400','bg-emerald-500','bg-rose-500','bg-fuchsia-500'][courseIndex % 6]}`} />
                  <div className="relative h-48 bg-slate-900 shrink-0">
                    <img src={course.coverImage} alt={course.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" />
                    <div className="absolute top-4 right-4 px-3 py-1 bg-white/95 backdrop-blur-md rounded-xl text-xs font-sans font-bold text-indigo-600 shadow-md">
                      {course.level}
                    </div>
                    {badge && (
                      <div className="absolute bottom-4 right-4 px-3 py-1 bg-slate-950/80 text-white rounded-xl text-[10px] font-sans font-bold">
                        {badge}
                      </div>
                    )}
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      <h3 className="font-sans font-extrabold text-gray-900 text-lg group-hover:text-indigo-600 transition-all">{course.title}</h3>
                      <p className="font-sans text-xs text-gray-500 leading-relaxed line-clamp-3">{course.description}</p>

                      <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-4 mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock className="w-4 h-4 text-indigo-500" />
                          <span className="font-sans font-medium">{course.duration}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Layers className="w-4 h-4 text-indigo-500" />
                          <span className="font-sans font-medium">{course.sessionCount ?? course.offlineVideos?.length ?? 0} جلسه</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <CalendarDays className="w-4 h-4 text-emerald-500" />
                          <span className="font-sans font-medium">{course.scheduleText || 'زمان‌بندی منعطف'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Users className="w-4 h-4 text-amber-500" />
                          <span className="font-sans font-medium">{remaining} ظرفیت باقی‌مانده</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-6 border-t border-gray-100/80 pt-4">
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 block font-sans">شهریه ترم کامل:</span>
                        <span className="text-base font-sans font-bold text-gray-900">{course.price}</span>
                      </div>

                      <a
                        href={`/courses/${encodeURIComponent(course.id)}`}
                        onClick={(event) => { event.preventDefault(); openCourse(course); }}
                        className={`px-4.5 py-2.5 font-sans font-bold text-xs rounded-2xl transition-all cursor-pointer ${
                          isUnlocked ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-100' : 'bg-gradient-to-l from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-violet-200'
                        }`}
                      >
                        {isUnlocked ? 'صفحه دوره' : 'مشاهده جزئیات دوره'}
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <AnimatePresence>
          {activeCourse && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 sm:p-6"
              onClick={() => setActiveCourse(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-white rounded-3xl overflow-hidden max-w-3xl w-full shadow-2xl flex flex-col text-right border border-gray-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative h-44 bg-slate-900 shrink-0">
                  <img src={activeCourse.coverImage} alt={activeCourse.title} referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent" />
                  <div className="absolute bottom-6 right-6">
                    <span className="text-amber-400 font-sans font-extrabold text-xs block mb-1">{activeCourse.level}</span>
                    <h3 className="text-xl sm:text-2xl font-sans font-extrabold text-white">{activeCourse.title}</h3>
                  </div>
                  <button onClick={() => setActiveCourse(null)} className="absolute top-4 left-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all cursor-pointer">
                    بستن
                  </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[560px] space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                      <span className="text-[10px] text-indigo-500 font-sans font-bold">مربی دوره</span>
                      <p className="font-sans font-extrabold text-slate-900 text-sm mt-1">{activeCourse.instructor || 'تیم مربیان اسکیل آپ'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                      <span className="text-[10px] text-emerald-600 font-sans font-bold">جلسه آنلاین بعدی</span>
                      <p className="font-sans font-extrabold text-slate-900 text-sm mt-1">
                        {activeCourse.nextSessionAt ? new Date(activeCourse.nextSessionAt).toLocaleString('fa-IR') : 'پس از ثبت‌نام اعلام می‌شود'}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
                      <span className="text-[10px] text-amber-600 font-sans font-bold">ظرفیت کلاس</span>
                      <p className="font-sans font-extrabold text-slate-900 text-sm mt-1">
                        {activeCourse.enrolled || 0} از {activeCourse.capacity || 16} نفر ثبت‌نام کرده‌اند
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-sans font-extrabold text-gray-900 text-sm">درباره این مسیر آموزشی:</h4>
                    <p className="font-sans text-xs text-gray-600 leading-relaxed">{activeCourse.description}</p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-sans font-extrabold text-gray-900 text-sm">سرفصل‌ها و جلسات ویدیویی ضبط‌شده:</h4>
                    <div className="space-y-2">
                      {activeCourse.offlineVideos?.map((video, idx) => (
                        <div key={video.id} className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-right">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs font-bold font-mono">{idx + 1}</div>
                            <div>
                              <span className="font-sans font-bold text-xs text-gray-950 block">{video.title}</span>
                              <span className="font-sans text-[10px] text-gray-400 block">مدت زمان: {video.duration}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-sans">
                            <Lock className="w-3.5 h-3.5" />
                            <span>پس از تایید فیش فعال می‌شود</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {!isCourseUnlocked(activeCourse.id) ? (
                    <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-sans font-extrabold text-slate-950 text-sm">پرداخت کارت‌به‌کارت و ارسال فیش</h4>
                          <p className="font-sans text-xs text-slate-500 leading-relaxed mt-1">
                            مبلغ {activeCourse.price} را به شماره کارت زیر واریز کنید و کد پیگیری یا شماره فیش را ثبت کنید.
                          </p>
                          <div className="mt-3 p-3 bg-white rounded-2xl border border-indigo-100 text-left ltr">
                            <span className="font-mono text-lg font-black text-slate-950 tracking-wider">{bankCardNumber}</span>
                            <span className="font-sans text-[10px] text-slate-400 block mt-1 text-right">به نام {bankAccountOwner}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input value={studentName} onChange={(e) => setStudentName(e.target.value)} onBlur={(event) => fetchPayments(event.currentTarget.value)} placeholder="نام هنرجو" className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-xs font-sans outline-none focus:ring-2 focus:ring-indigo-200" />
                        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="شماره موبایل والد: 09123456789" className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-xs font-sans outline-none focus:ring-2 focus:ring-indigo-200" dir="ltr" />
                        <input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} placeholder="شماره فیش / کد پیگیری" className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-xs font-sans outline-none focus:ring-2 focus:ring-indigo-200" />
                        <input value={cardLastFour} onChange={(e) => setCardLastFour(e.target.value)} placeholder="۴ رقم آخر کارت پرداخت‌کننده" maxLength={4} className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-xs font-sans outline-none focus:ring-2 focus:ring-indigo-200" dir="ltr" />
                        <input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="نام پرداخت‌کننده" className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-xs font-sans outline-none focus:ring-2 focus:ring-indigo-200" />
                        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="توضیح اختیاری برای مدیر" className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-xs font-sans outline-none focus:ring-2 focus:ring-indigo-200" />
                      </div>

                      {paymentError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 font-sans text-xs font-bold">{paymentError}</div>}
                      {paymentSuccess && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 font-sans text-xs font-bold">{paymentSuccess}</div>}

                      <button
                        onClick={handleSubmitReceipt}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold font-sans rounded-xl shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>ثبت فیش و ارسال برای تایید مدیر</span><Sparkles className="w-3.5 h-3.5 text-amber-300" /></>}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-150 text-emerald-800 text-xs font-bold font-sans px-4 py-3 rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>این دوره تایید شده و در پنل هنرجو فعال است.</span>
                      <button onClick={() => { onUnlockCourse(activeCourse.id); setCurrentTab('dashboard'); }} className="mr-auto px-3 py-1.5 rounded-lg bg-emerald-600 text-white">رفتن به پنل</button>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
