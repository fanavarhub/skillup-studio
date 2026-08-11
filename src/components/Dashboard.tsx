import { useState, useEffect, FormEvent } from 'react';
import { Course, StudentProject, Certificate, StudentProfile } from '../types';
import { 
  Gamepad2, Sparkles, Volume2, Plus, Edit, Trash2, 
  ExternalLink, Play, CheckCircle, Clock, AlertCircle, FileText, ArrowLeft, Video,
  Award, Lock, BookOpen, Share2, Printer, Coins, Trophy, UserCheck, Star, GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authenticatedFetch } from '../api';
import LearningHub from './LearningHub';

interface DashboardProps {
  unlockedCourses: string[];
  setCurrentTab: (tab: string) => void;
  studentName?: string;
}

// Interactive Quiz Database for the courses
const courseQuizzes: { [courseId: string]: { question: string; options: string[]; answerIdx: number }[] } = {
  'scratch-jr': [
    {
      question: 'کدام رنگ برای بلوک‌های حرکتی (مستقیم، چرخش و...) در اسکرچ استفاده می‌شود؟',
      options: ['آبی (Motion)', 'نارنجی (Control)', 'بنفش (Looks)', 'سبز (Operators)'],
      answerIdx: 0
    },
    {
      question: 'برای اجرای کدها وقتی روی پرچم سبز کلیک می‌شود، از کدام بلوک رویداد استفاده می‌کنیم؟',
      options: ['When Space Key Pressed', 'When Green Flag Clicked', 'When I Receive Message', 'Forever Loop'],
      answerIdx: 1
    },
    {
      question: 'چطور می‌توانیم یک شکلک (Sprite) جدید به پروژه اضافه کنیم؟',
      options: ['از منوی فایل', 'با کلیک روی دکمه شکلک جدید (Choose a Sprite)', 'با نوشتن کد پایتون', 'با خاموش روشن کردن کامپیوتر'],
      answerIdx: 1
    }
  ],
  'scratch-dev': [
    {
      question: 'کدام بلوک به ما اجازه می‌دهد کدی را برای همیشه و بدون توقف تکرار کنیم؟',
      options: ['Repeat 10', 'Repeat Until', 'Forever', 'If-Then'],
      answerIdx: 2
    },
    {
      question: 'برای ذخیره کردن متغیرهایی مانند امتیاز بازیکن یا تعداد جان‌ها، از کدام بخش استفاده می‌شود؟',
      options: ['Variables (متغیرها)', 'Sensing (حسگرها)', 'Sound (صداها)', 'My Blocks'],
      answerIdx: 0
    },
    {
      question: 'برای اینکه بفهمیم آیا دو شکلک به هم برخورد کرده‌اند یا خیر، از چه بلوکی استفاده می‌شود؟',
      options: ['Touch Color', 'Touching Sprite', 'Distance to Mouse', 'هر سه مورد صحیح است'],
      answerIdx: 3
    }
  ],
  'ai-creators': [
    {
      question: 'به آموزش دادن مدل هوش مصنوعی با استفاده از تصویر، صدا یا متن چه می‌گویند؟',
      options: ['برنامه‌نویسی سخت‌افزار', 'یادگیری ماشین (Machine Learning)', 'طراحی وب‌سایت', 'فتوشاپ'],
      answerIdx: 1
    },
    {
      question: 'یک مدل هوش مصنوعی برای یادگیری تشخیص چهره، به چه چیزی نیاز دارد؟',
      options: ['تصاویر نمونه زیاد (Dataset)', 'آهنگ شاد', 'تایپ سریع فارسی', 'کارت گرافیک خاموش'],
      answerIdx: 0
    },
    {
      question: 'ابزار Teachable Machine محصول کدام کمپانی است که با آن مدل‌های ساده یادگیری ماشین می‌سازیم؟',
      options: ['مایکروسافت', 'گوگل (Google)', 'اپل', 'اسکرچ'],
      answerIdx: 1
    }
  ]
};

// General fallback quiz if course quiz is not defined
const generalQuiz = [
  {
    question: 'برنامه‌نویسی یعنی چه؟',
    options: ['تایپ سریع با کامپیوتر', 'دادن دستورات منطقی و گام‌به‌گام به کامپیوتر برای حل مسئله', 'بازی کردن طولانی‌مدت', 'نصب نرم‌افزارهای مختلف'],
    answerIdx: 1
  },
  {
    question: 'کدام مهارت در یادگیری تفکر رایانه‌ای و برنامه‌نویسی به ما کمک می‌کند؟',
    options: ['حفظ کردن فرمول‌ها', 'شکستن مسائل بزرگ به بخش‌های کوچک‌تر (Decomposition)', 'تنها کار کردن و عدم همفکری', 'کپی‌برداری کامل'],
    answerIdx: 1
  },
  {
    question: 'منظور از باگ (Bug) در برنامه‌نویسی چیست؟',
    options: ['یک قطعه سخت‌افزاری جدید', 'یک نوع ویروس کامپیوتری خطرناک', 'خطا یا اشکالی در کد که مانع کارکرد درست برنامه می‌شود', 'ماوس و کیبورد بیسیم'],
    answerIdx: 2
  }
];

export default function Dashboard({ unlockedCourses, setCurrentTab, studentName: loggedInStudentName }: DashboardProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [studentProjects, setStudentProjects] = useState<StudentProject[]>([]);
  
  // Gamified student states
  const [studentName, setStudentName] = useState('نوجوان خلاق اسکیل آپ');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [activeTab, setActiveTab] = useState<'lessons' | 'projects' | 'growth' | 'rewards'>('lessons');
  
  // Selected course for viewing sessions
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeVideo, setActiveVideo] = useState<{ id: string; title: string; url: string } | null>(null);

  // Form states for creating / editing projects
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<StudentProject | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'AI' | 'Game' | 'Communication'>('Game');
  const [scratchId, setScratchId] = useState('');
  const [studentAge, setStudentAge] = useState(14);
  const [coverImage, setCoverImage] = useState('/assets/legacy/unsplash-1511512578047-dfb367046420-q60.jpg');

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // XP Alert State (floating toast)
  const [xpToast, setXpToast] = useState<{ message: string; points: number } | null>(null);

  // Quiz States
  const [activeQuizCourse, setActiveQuizCourse] = useState<Course | null>(null);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizSuccessMessage, setQuizSuccessMessage] = useState('');
  const [quizError, setQuizError] = useState('');

  // Certificate Modal State
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);

  // Copy link state
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch complete profile, certificates, and projects
  const fetchProfileAndCerts = async () => {
    try {
      const nameParam = encodeURIComponent(studentName.trim());
      // 1. Get or create Student Profile
      const resProfile = await authenticatedFetch(`/api/student-profile?name=${nameParam}`);
      if (resProfile.ok) {
        const pData = await resProfile.json();
        setProfile(pData);
      }

      // 2. Get Student Certificates
      const resCerts = await authenticatedFetch(`/api/certificates?studentName=${nameParam}`);
      if (resCerts.ok) {
        const cData = await resCerts.json();
        setCertificates(cData);
      }

      // 3. Get Student Projects
      const resProj = await authenticatedFetch(`/api/projects?studentName=${nameParam}`);
      if (resProj.ok) {
        const pData = await resProj.json();
        setStudentProjects(pData);
      }
    } catch (err) {
      console.error('Error fetching student profile data:', err);
    }
  };

  // Fetch base courses
  const fetchCourses = async () => {
    try {
      const resCourses = await authenticatedFetch('/api/courses');
      if (resCourses.ok) {
        const cData = await resCourses.json();
        const purchasedCourses = profile?.purchasedCourses || [];
        const activeCourseIds = new Set([...unlockedCourses, ...purchasedCourses]);
        const filtered = cData.filter((c: Course) => activeCourseIds.has(c.id));
        setCourses(filtered);
        if (filtered.length > 0 && (!selectedCourse || !filtered.some((course: Course) => course.id === selectedCourse.id))) {
          setSelectedCourse(filtered[0]);
        }
        if (filtered.length === 0) setSelectedCourse(null);
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [unlockedCourses, profile?.purchasedCourses?.join(',')]);

  useEffect(() => {
    fetchProfileAndCerts();
  }, [studentName]);

  useEffect(() => {
    if (loggedInStudentName && loggedInStudentName !== studentName) {
      setStudentName(loggedInStudentName);
    }
  }, [loggedInStudentName]);

  // Award XP helper
  const triggerActionXp = async (actionType: string, targetId: string) => {
    try {
      const response = await authenticatedFetch('/api/student-profile/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim(),
          actionType,
          targetId
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.xpAwarded > 0) {
          // Trigger cute toast
          let msg = '';
          if (actionType === 'watch_video') msg = 'فیلم آموزشی رو تماشا کردی! 🍿';
          else if (actionType === 'pass_quiz') msg = 'آزمون رو با موفقیت پشت سر گذاشتی! 🏆';
          else if (actionType === 'submit_project') msg = 'پروژه خلاقانه خودت رو ثبت کردی! 🚀';
          else if (actionType === 'like_project') msg = 'به پروژه هم‌تیمی‌هات امتیاز دادی! ❤️';

          setXpToast({ message: msg, points: data.xpAwarded });
          setTimeout(() => setXpToast(null), 3500);
        }
        setProfile(data.profile);
      }
    } catch (err) {
      console.error('Error awarding action points:', err);
    }
  };

  // Watch video session trigger
  const handleWatchVideo = (video: any) => {
    setActiveVideo({ id: video.id, title: video.title, url: video.url });
  };

  const markVideoWatched = async () => {
    if (!activeVideo || !selectedCourse) return;
    const response = await authenticatedFetch('/api/student-profile/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType: 'watch_video', targetId: activeVideo.id, courseId: selectedCourse.id, watchedPercent: 75 }),
    });
    if (response.ok) {
      const data = await response.json();
      setProfile(data.profile);
      if (data.xpAwarded) setXpToast({ message: 'حداقل ۷۵٪ ویدئو دیده شد و پیشرفت ثبت شد.', points: data.xpAwarded });
    }
  };

  // Submit project handler
  const handleSaveProject = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!title.trim()) {
      setFormError('عنوان پروژه الزامی است');
      return;
    }

    const payload = {
      title,
      description,
      category,
      scratchId: scratchId || undefined,
      studentName,
      studentAge,
      coverImage,
      status: 'pending'
    };

    try {
      let response;
      if (editingProject) {
        response = await authenticatedFetch(`/api/projects/${editingProject.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        response = await authenticatedFetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (response.ok) {
        setFormSuccess(editingProject ? 'پروژه با موفقیت ویرایش و برای تایید ارسال شد!' : 'پروژه با موفقیت ثبت و به مربی برای ارزیابی ارسال شد!');
        
        // Award submitting project XP!
        if (!editingProject) {
          triggerActionXp('submit_project', title);
        }

        setTimeout(() => {
          setIsFormOpen(false);
          setEditingProject(null);
          setTitle('');
          setDescription('');
          setScratchId('');
          setFormSuccess('');
          fetchProfileAndCerts(); // reload
        }, 1500);
      } else {
        const errData = await response.json();
        setFormError(errData.error || 'خطایی در ثبت پروژه رخ داد');
      }
    } catch (err) {
      setFormError('خطای شبکه در ذخیره پروژه');
    }
  };

  const handleEditClick = (p: StudentProject) => {
    setEditingProject(p);
    setTitle(p.title);
    setDescription(p.description);
    setCategory(p.category);
    setScratchId(p.scratchId || '');
    setCoverImage(p.coverImage);
    setStudentAge(p.studentAge);
    setIsFormOpen(true);
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('آیا از حذف این پروژه اطمینان دارید؟')) return;
    try {
      const response = await authenticatedFetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchProfileAndCerts();
      }
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  // QUIZ LOGIC
  const handleStartQuiz = (course: Course) => {
    setActiveQuizCourse(course);
    setCurrentQuizIndex(0);
    setQuizAnswers([]);
    setQuizFinished(false);
    setQuizSuccessMessage('');
    setQuizError('');
  };

  const handleAnswerQuizQuestion = (optionIdx: number) => {
    const updatedAnswers = [...quizAnswers, optionIdx];
    setQuizAnswers(updatedAnswers);

    const questions = courseQuizzes[activeQuizCourse?.id || ''] || generalQuiz;
    if (currentQuizIndex + 1 < questions.length) {
      setCurrentQuizIndex(currentQuizIndex + 1);
    } else {
      // Calculate scores
      let score = 0;
      questions.forEach((q, idx) => {
        if (updatedAnswers[idx] === q.answerIdx) {
          score += 1;
        }
      });

      setQuizFinished(true);
      const passed = score >= 2; // Pass criteria: at least 2 out of 3 questions
      if (passed) {
        setQuizSuccessMessage(`تبریک می‌گم! تو با پاسخ دادن به ${score} سوال از ${questions.length} سوال، در این آزمون با امتیاز عالی قبول شدی! 🎉`);
        // Award quiz points!
        triggerActionXp('pass_quiz', activeQuizCourse?.id || 'general');
      } else {
        setQuizError(`امیدت رو از دست نده! تو به ${score} سوال درست جواب دادی ولی برای قبولی نیاز داری حداقل به ۲ سوال پاسخ درست بدی. یک بار دیگه مرور کن و دوباره تلاش کن! ❤️`);
      }
    }
  };

  // Claim certificate
  const handleClaimCertificate = async (course: Course) => {
    try {
      const res = await authenticatedFetch('/api/certificates/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim(),
          courseId: course.id,
          courseTitle: course.title
        })
      });

      if (res.ok) {
        const certificate = await res.json();
        // Update certificates local list
        setCertificates(prev => {
          if (prev.some(c => c.id === certificate.id)) return prev;
          return [...prev, certificate];
        });
        setSelectedCert(certificate);
      }
    } catch (err) {
      console.error('Error issuing certificate:', err);
    }
  };

  // Redeem Reward Shop item
  const handleClaimReward = async (rewardId: string) => {
    try {
      const res = await authenticatedFetch('/api/student-profile/unlock-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim(),
          rewardId
        })
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        alert('🎉 پاداش با موفقیت فعال شد! کد تخفیف اختصاصی شما در بخش هدایای من باز شد.');
      } else {
        const data = await res.json();
        alert(data.error || 'امتیاز کافی برای فعال‌سازی این پاداش ندارید.');
      }
    } catch (err) {
      console.error('Error claiming reward:', err);
    }
  };

  // Dynamic calculations for user levels
  const currentXp = profile?.xp || 0;
  const currentLvl = profile?.level || 1;
  
  const nextLevelXp = profile?.nextLevelXp || (20 + currentLvl * 5);
  const levelTitle = profile?.tier || (currentLvl >= 31 ? 'Skill Master' : currentLvl >= 11 ? 'Skiller' : 'Starter');
  const levelIcon = currentLvl >= 31 ? '🏆' : currentLvl >= 11 ? '🚀' : '🌱';
  const xpProgressPercent = profile?.progress || 0;
  const totalVideoCount = courses.reduce((sum, course) => sum + (course.offlineVideos?.length || 0), 0);
  const completedVideoCount = profile?.completedVideos?.length || 0;
  const learningProgressPercent = totalVideoCount > 0 ? Math.min(100, Math.round((completedVideoCount / totalVideoCount) * 100)) : 0;
  const nextStepText = courses.length === 0
    ? 'ارسال فیش و تایید مدیر برای فعال شدن اولین دوره'
    : learningProgressPercent < 100
      ? 'تماشای جلسه بعدی و تکمیل تمرین هفته'
      : 'ثبت پروژه نهایی و دریافت گواهینامه';

  return (
    <div className="bg-gray-50 min-h-screen py-10" dir="rtl">
      
      {/* Floating XP Alert notification */}
      <AnimatePresence>
        {xpToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="fixed bottom-8 left-8 z-50 bg-slate-900 text-white p-4 rounded-2xl flex items-center gap-3.5 border border-slate-700 shadow-2xl max-w-sm text-right"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center text-xl shrink-0 font-bold animate-bounce">
              ⭐
            </div>
            <div>
              <span className="font-sans font-extrabold text-xs text-amber-400 block">امتیاز مهارتی جدید! +{xpToast.points} XP</span>
              <span className="font-sans text-[11px] text-slate-200 block">{xpToast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Playful & Adventure Gamified Dashboard Header */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-950 rounded-[2.5rem] p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border-4 border-indigo-400/20">
          
          {/* Bubbles / Wave effect background */}
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-8">
            
            {/* Right block: Profile Avatar, Level Badge and edit name */}
            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-right">
              <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center border-2 border-indigo-300 text-4xl shadow-inner shrink-0 relative animate-pulse">
                <span>{levelIcon}</span>
                <span className="absolute -bottom-2 -right-2 bg-amber-500 text-white text-[10px] font-sans font-black px-2 py-0.5 rounded-full border border-amber-300 shadow-md">
                  LV {currentLvl}
                </span>
              </div>
              
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <span className="font-sans font-black text-amber-300 text-sm">{levelTitle}</span>
                  <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl shrink-0">
                    <input 
                      type="text" 
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="bg-white text-gray-950 px-2 py-1 rounded-md font-sans text-xs font-bold border-0 focus:ring-2 focus:ring-amber-400 w-36 text-center"
                      title="نام خود را تغییر دهید"
                    />
                  </div>
                </div>
                <h1 className="font-sans font-extrabold text-xl sm:text-2xl text-slate-100">سلام قهرمان، {studentName}! 👋</h1>
                <p className="font-sans text-[11px] text-indigo-200 leading-relaxed max-w-xl">
                  به سفر یادگیری اسکیل آپ خوش آمدی؛ ویدئوها را کامل ببین، سؤال‌های روزانه را پاسخ بده، پروژه بساز و پیشرفتت را در Skill Passport ثبت کن.
                </p>
              </div>
            </div>

            {/* Left block: XP Progress bar */}
            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-5 lg:w-80 space-y-3.5 shrink-0">
              <div className="flex justify-between items-center text-xs">
                <span className="font-sans font-bold text-indigo-300 flex items-center gap-1">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  سطح بعدی: LV {currentLvl + 1}
                </span>
                <span className="font-sans font-extrabold text-amber-300">{profile?.levelXp || 0} / {nextLevelXp} XP</span>
              </div>

              {/* Progress bar container */}
              <div className="w-full bg-slate-800 rounded-full h-3.5 relative overflow-hidden p-0.5 border border-slate-700">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgressPercent}%` }}
                  transition={{ duration: 1 }}
                  className="bg-gradient-to-r from-amber-400 to-amber-300 h-full rounded-full shadow-inner shadow-amber-500/20" 
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-indigo-200 leading-tight">
                <span>مشاهده ۷۵٪ ویدئو: +۱۰ XP</span>
                <span>ارسال پروژه: +۴۰ XP</span>
              </div>
            </div>

          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 bg-white rounded-3xl border border-gray-150 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="font-sans font-extrabold text-slate-950 text-sm">مسیر پیشرفت یادگیری</span>
              <span className="font-sans font-black text-indigo-600 text-sm">{learningProgressPercent}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-emerald-400" style={{ width: `${learningProgressPercent}%` }} />
            </div>
            <p className="font-sans text-xs text-slate-500 mt-3">گام بعدی: {nextStepText}</p>
          </div>
          <MiniStat title="دوره‌های فعال" value={`${courses.length}`} />
          <MiniStat title="نشان‌ها و گواهی‌ها" value={`${certificates.length}`} />
        </div>

        {/* Dynamic Navigation Tabs inside dashboard */}
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-200/80 max-w-md mx-auto shadow-xs">
          <button
            onClick={() => setActiveTab('lessons')}
            className={`flex-1 py-2.5 rounded-xl font-sans text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'lessons'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-500 hover:text-indigo-600'
            }`}
          >
            📺 کارگاه‌ها و آزمون‌ها
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex-1 py-2.5 rounded-xl font-sans text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'projects'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-500 hover:text-indigo-600'
            }`}
          >
            🚀 ارسال پروژه‌های من
          </button>
          <button
            onClick={() => setActiveTab('growth')}
            className={`flex-1 py-2.5 rounded-xl font-sans text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'growth'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-500 hover:text-indigo-600'
            }`}
          >
            🏆 رشد و Skill Passport
          </button>
        </div>

        {/* Tab Contents */}
        <AnimatePresence mode="wait">

          {activeTab === 'growth' && (
            <motion.div key="growth" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
              <LearningHub />
            </motion.div>
          )}
          
          {/* TAB 1: Enrolled Courses & Weekly Video player & Quizzes */}
          {activeTab === 'lessons' && (
            <motion.div
              key="lessons"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-right"
            >
              
              {/* Right Side: Active courses, playlist and interactive video preview */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-150/80 shadow-md space-y-6">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                    <h2 className="font-sans font-extrabold text-gray-950 text-xl flex items-center gap-2">
                      <Video className="w-6 h-6 text-indigo-600" />
                      <span>کلاس‌ها و کارگاه‌های آنلاین من</span>
                    </h2>
                    <span className="text-xs bg-indigo-50 text-indigo-700 font-sans font-bold px-3 py-1 rounded-full border border-indigo-100">
                      تعداد دوره‌ها: {courses.length}
                    </span>
                  </div>

                  {courses.length === 0 ? (
                    <div className="py-12 text-center bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-150">
                      <Play className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="font-sans font-bold text-gray-700 text-sm">هیچ دوره‌ای هنوز فعال نشده است</p>
                      <p className="font-sans text-xs text-gray-400 mt-1 mb-5">
                        برای شروع سفر مهارتی خود ابتدا یکی از دوره‌های کارگاهی اسکیل آپ را در صفحه دوره‌ها فعال کنید.
                      </p>
                      <button
                        onClick={() => setCurrentTab('courses')}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold text-xs rounded-xl shadow-md shadow-indigo-100 cursor-pointer transition-all"
                      >
                        🚀 ورود به فروشگاه دوره‌ها
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      
                      {/* Course Tabs selector */}
                      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                        {courses.map((course) => (
                          <button
                            key={course.id}
                            onClick={() => {
                              setSelectedCourse(course);
                              setActiveVideo(null);
                            }}
                            className={`px-4 py-2.5 rounded-xl font-sans text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                              selectedCourse?.id === course.id
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {course.title}
                          </button>
                        ))}
                      </div>

                      {selectedCourse && (
                        <div className="space-y-6 border-t border-gray-100 pt-6">
                          
                          {/* Course Quick Links */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100/50">
                            <div className="space-y-1">
                              <h3 className="font-sans font-extrabold text-indigo-950 text-base">{selectedCourse.title}</h3>
                              <p className="font-sans text-xs text-indigo-700 font-medium">سطح کارگاه: {selectedCourse.level} | مربی: {selectedCourse.instructor || 'تیم مربیان اسکیل آپ'}</p>
                            </div>
                            <a
                              href={selectedCourse.onlineMeetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold text-xs rounded-xl shadow-xs shrink-0 transition-all cursor-pointer"
                            >
                              <span>ورود به کلاس آنلاین زنده</span>
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-4 rounded-2xl bg-white border border-indigo-100">
                              <span className="font-sans text-[10px] text-indigo-500 font-bold block">جلسه آنلاین بعدی</span>
                              <strong className="font-sans text-xs text-slate-950 block mt-1">
                                {selectedCourse.nextSessionAt ? new Date(selectedCourse.nextSessionAt).toLocaleString('fa-IR') : 'به‌زودی اعلام می‌شود'}
                              </strong>
                            </div>
                            <div className="p-4 rounded-2xl bg-white border border-emerald-100">
                              <span className="font-sans text-[10px] text-emerald-600 font-bold block">برنامه کلاس</span>
                              <strong className="font-sans text-xs text-slate-950 block mt-1">{selectedCourse.scheduleText || 'زمان‌بندی منعطف'}</strong>
                            </div>
                            <div className="p-4 rounded-2xl bg-white border border-amber-100">
                              <span className="font-sans text-[10px] text-amber-600 font-bold block">ظرفیت ثبت‌نام</span>
                              <strong className="font-sans text-xs text-slate-950 block mt-1">{selectedCourse.enrolled || 0} از {selectedCourse.capacity || 16} نفر</strong>
                            </div>
                          </div>

                          {/* Video player view */}
                          {activeVideo ? (
                            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 relative overflow-hidden shadow-lg">
                              <div className="aspect-video bg-black rounded-xl flex items-center justify-center relative overflow-hidden">
                                <iframe 
                                  src={activeVideo.url}
                                  allowFullScreen
                                  className="absolute inset-0 w-full h-full rounded-xl"
                                  frameBorder="0"
                                  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                                  referrerPolicy="strict-origin-when-cross-origin"
                                />
                              </div>
                              <div className="flex justify-between items-center text-white mt-1">
                                <span className="font-sans font-bold text-xs text-slate-100">{activeVideo.title}</span>
                                <button onClick={markVideoWatched} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[10px] font-bold">ثبت مشاهده ۷۵٪ و دریافت ۱۰ XP</button>
                                <button
                                  onClick={() => setActiveVideo(null)}
                                  className="text-[10px] text-slate-400 hover:text-white underline font-sans font-medium"
                                >
                                  بستن پخش‌کننده
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-100/40 p-10 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center text-center gap-2">
                              <Play className="w-10 h-10 text-indigo-400" />
                              <span className="font-sans font-bold text-gray-700 text-xs">آماده پخش درس‌های ویدیویی</span>
                              <span className="font-sans text-[11px] text-gray-400">یکی از جلسات زیر را انتخاب کن تا با دیدنش امتیازت بیشتر بشه!</span>
                            </div>
                          )}

                          {/* Playlist */}
                          <div className="space-y-3">
                            <h4 className="font-sans font-bold text-gray-900 text-sm">📺 جلسات هفتگی فعال‌شده این ترم:</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {selectedCourse.offlineVideos?.map((video, idx) => {
                                const isCompleted = profile?.completedVideos?.includes(video.id);
                                return (
                                  <button
                                    key={video.id}
                                    onClick={() => handleWatchVideo(video)}
                                    className={`flex items-center justify-between p-3.5 border rounded-xl text-right group transition-all cursor-pointer ${
                                      isCompleted 
                                        ? 'border-emerald-200 bg-emerald-50/25 hover:border-emerald-400' 
                                        : 'border-gray-150 bg-white hover:border-indigo-400'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-lg font-mono font-bold flex items-center justify-center text-xs transition-all ${
                                        isCompleted 
                                          ? 'bg-emerald-500 text-white' 
                                          : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'
                                      }`}>
                                        {idx + 1}
                                      </div>
                                      <div className="text-right">
                                        <span className="font-sans font-bold text-xs text-gray-950 block group-hover:text-indigo-600 transition-all flex items-center gap-1.5">
                                          {video.title}
                                          {isCompleted && <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-sans font-black">دیده‌شده +۱۵ XP</span>}
                                        </span>
                                        <span className="font-sans text-[10px] text-gray-400 block">مدت: {video.duration} دقیقه</span>
                                      </div>
                                    </div>
                                    <Play className={`w-4 h-4 transition-all ml-1 ${
                                      isCompleted ? 'text-emerald-500' : 'text-indigo-500 opacity-60 group-hover:opacity-100'
                                    }`} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                        </div>
                      )}

                    </div>
                  )}

                </div>
              </div>

              {/* Left Side: Interactive Mini Quizzes & Missions panel */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* 1. Missions Checklist */}
                {selectedCourse && (
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-6 rounded-[2rem] border border-amber-200 shadow-xs space-y-4">
                    <h3 className="font-sans font-extrabold text-amber-950 text-sm flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                      <span>چالش‌های طلایی دوره {selectedCourse.title}</span>
                    </h3>
                    
                    <div className="space-y-3 text-xs text-amber-900 font-sans">
                      
                      {/* Quest 1 */}
                      <div className="flex items-start gap-2 bg-white/70 p-3 rounded-xl border border-amber-150">
                        <input 
                          type="checkbox" 
                          checked={selectedCourse.offlineVideos?.every(v => profile?.completedVideos?.includes(v.id)) || false}
                          readOnly
                          className="mt-0.5 text-emerald-600 rounded-sm focus:ring-0 shrink-0 pointer-events-none"
                        />
                        <div>
                          <span className="font-bold block">مأموریت اول: تماشای کل جلسات</span>
                          <span className="text-[10px] text-slate-500 block leading-normal mt-0.5">تماشای تمام ویدیوها در پنل کاربری.</span>
                        </div>
                      </div>

                      {/* Quest 2 */}
                      <div className="flex items-start gap-2 bg-white/70 p-3 rounded-xl border border-amber-150">
                        <input 
                          type="checkbox" 
                          checked={profile?.completedQuizzes?.includes(selectedCourse.id) || false}
                          readOnly
                          className="mt-0.5 text-emerald-600 rounded-sm focus:ring-0 shrink-0 pointer-events-none"
                        />
                        <div>
                          <span className="font-bold block">مأموریت دوم: قبولی در کوئیز مهارتی</span>
                          <span className="text-[10px] text-slate-500 block leading-normal mt-0.5">کسب نمره قبولی در آزمون کوچک دوره.</span>
                        </div>
                      </div>

                      {/* Quest 3 */}
                      <div className="flex items-start gap-2 bg-white/70 p-3 rounded-xl border border-amber-150">
                        <input 
                          type="checkbox" 
                          checked={studentProjects.length > 0}
                          readOnly
                          className="mt-0.5 text-emerald-600 rounded-sm focus:ring-0 shrink-0 pointer-events-none"
                        />
                        <div>
                          <span className="font-bold block">مأموریت سوم: بارگذاری پروژه پایانی</span>
                          <span className="text-[10px] text-slate-500 block leading-normal mt-0.5">ثبت یک پروژه با نام خودت در پورتال.</span>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* 2. Interactive Mini Quiz Trigger or Play Board */}
                {selectedCourse && (
                  <div className="bg-white p-6 rounded-[2rem] border border-gray-150 shadow-md space-y-4">
                    <h3 className="font-sans font-extrabold text-gray-950 text-sm flex items-center gap-2">
                      <Gamepad2 className="w-5 h-5 text-indigo-600" />
                      <span>آزمون کوئیز دوره ({selectedCourse.title})</span>
                    </h3>
                    
                    <p className="font-sans text-[11px] text-gray-500 leading-relaxed">
                      یک آزمون خیلی باحال ۳ سواله برای تو تدارک دیدیم! با حل کردنش تفکر الگوریتمی و مهارتیت رو به چالش بکش و امتیاز کسب کن.
                    </p>

                    {profile?.completedQuizzes?.includes(selectedCourse.id) ? (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col items-center text-center gap-1.5">
                        <UserCheck className="w-8 h-8 text-emerald-600" />
                        <span className="font-sans font-bold text-emerald-800 text-xs">آزمون این دوره را با موفقیت پاس کردی!</span>
                        <span className="font-sans text-[10px] text-emerald-600">+۵۰ امتیاز مهارتی قبلاً دریافت شده است.</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartQuiz(selectedCourse)}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold text-xs rounded-xl cursor-pointer transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5"
                      >
                        <span>📝 شروع कोईز (+۵۰ XP)</span>
                      </button>
                    )}
                  </div>
                )}

              </div>

            </motion.div>
          )}

          {/* TAB 2: Project Portfolios Manager */}
          {activeTab === 'projects' && (
            <motion.div
              key="projects"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-right"
            >
              
              {/* Right panel: project form overlay / workspace tips */}
              <div className="lg:col-span-8">
                <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-150/80 shadow-md space-y-6">
                  
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-150 pb-4">
                    <div>
                      <h2 className="font-sans font-extrabold text-gray-950 text-xl flex items-center gap-2">
                        <Gamepad2 className="w-6 h-6 text-indigo-600" />
                        <span>پورتال بارگذاری پروژه‌های من</span>
                      </h2>
                      <p className="font-sans text-xs text-gray-400 mt-1">پروژه‌هایی که ساختی رو اینجا آپلود کن تا منتورهای اسکیل آپ ارزیابی کنند و در گالری عمومی نمایش داده بشه!</p>
                    </div>
                    
                    {!isFormOpen && (
                      <button
                        onClick={() => {
                          setEditingProject(null);
                          setTitle('');
                          setDescription('');
                          setScratchId('');
                          setIsFormOpen(true);
                        }}
                        className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center gap-1.5 font-sans font-bold text-xs cursor-pointer transition-all shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        پروژه جدید جدید
                      </button>
                    )}
                  </div>

                  {isFormOpen ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 bg-gray-50 rounded-2xl border border-gray-150 space-y-4"
                    >
                      <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                        <span className="font-sans font-black text-sm text-indigo-950">
                          {editingProject ? '✏️ ویرایش پروژه خلاقانه' : '🚀 ثبت پروژه جدید'}
                        </span>
                        <button 
                          onClick={() => {
                            setIsFormOpen(false);
                            setEditingProject(null);
                          }}
                          className="text-gray-400 hover:text-gray-900 font-sans text-xs underline cursor-pointer"
                        >
                          انصراف و بستن فرم
                        </button>
                      </div>

                      <form onSubmit={handleSaveProject} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <label className="font-sans text-xs text-gray-500 font-bold block">نام پروژه:</label>
                            <input 
                              type="text" 
                              placeholder="مثال: دوج فایت کهکشانی"
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-sans focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="font-sans text-xs text-gray-500 font-bold block">توضیح کوتاه پروژه:</label>
                            <textarea 
                              placeholder="داستان پروژه، نحوه بازی یا ایده خود را اینجا شرح بده..."
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-sans h-24 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="font-sans text-xs text-gray-500 font-bold block">دسته مهارتی پروژه:</label>
                            <select 
                              value={category}
                              onChange={(e) => setCategory(e.target.value as any)}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-sans focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                            >
                              <option value="Game">🎮 بازی‌سازی اسکرچ (Scratch)</option>
                              <option value="AI">🤖 هوش مصنوعی (AI)</option>
                              <option value="Communication">🎤 فن بیان و مذاکره</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {category === 'Game' && (
                            <div className="space-y-1 bg-amber-50 p-3 border border-amber-200 rounded-xl">
                              <label className="font-sans text-[11px] text-amber-800 font-bold block">شناسه (ID) پروژه اسکرچ:</label>
                              <input 
                                type="text" 
                                placeholder="کد عددی در لینک Scratch (مثال: 400349603)"
                                value={scratchId}
                                onChange={(e) => setScratchId(e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-mono text-center"
                              />
                              <span className="font-sans text-[9px] text-amber-700 leading-relaxed block mt-1">
                                نکته: با وارد کردن این کد، بازی تو مستقیماً و به صورت تعاملی داخل گالری اسکیل آپ برای همه قابل بازی خواهد شد!
                              </span>
                            </div>
                          )}

                          <div className="space-y-1">
                            <label className="font-sans text-xs text-gray-500 font-bold block">سن نوجوان شما:</label>
                            <input 
                              type="number" 
                              value={studentAge}
                              onChange={(e) => setStudentAge(parseInt(e.target.value) || 14)}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-sans text-center"
                              min={8}
                              max={17}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="font-sans text-xs text-gray-500 font-bold block">تصویر پیش‌نمایش (لینک عکس):</label>
                            <input 
                              type="text" 
                              value={coverImage}
                              onChange={(e) => setCoverImage(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-sans"
                            />
                          </div>

                          {formError && (
                            <div className="p-2.5 rounded-lg bg-red-50 text-red-600 text-[10px] font-sans flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{formError}</span>
                            </div>
                          )}

                          {formSuccess && (
                            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-sans flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>{formSuccess}</span>
                            </div>
                          )}

                          <button
                            type="submit"
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold text-xs rounded-xl cursor-pointer shadow-md shadow-indigo-100"
                          >
                            {editingProject ? 'ویرایش پروژه و ارسال مجدد' : '🚀 ثبت نهایی پروژه و کسب +۱۰۰ XP'}
                          </button>
                        </div>

                      </form>
                    </motion.div>
                  ) : (
                    <div className="space-y-4">
                      <h3 className="font-sans font-bold text-gray-950 text-sm">لیست پروژه‌های آپلودشده شما ({studentProjects.length}):</h3>
                      
                      {studentProjects.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 text-xs font-sans space-y-1 border border-dashed border-gray-150 rounded-2xl bg-gray-50/50">
                          <FileText className="w-10 h-10 text-gray-300 mx-auto" />
                          <p className="font-bold text-gray-700 text-sm">هنوز پروژه‌ای اضافه نکرده‌ای.</p>
                          <p className="text-[11px] text-gray-400 mt-1">با کلیک روی دکمه "پروژه جدید" در بالا اولین بازی یا برنامه‌ات را به مربی تحویل بده!</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {studentProjects.map((p) => (
                            <div
                              key={p.id}
                              className="p-4 rounded-2xl border border-gray-100 bg-white flex flex-col justify-between text-right shadow-xs hover:shadow-md transition-all"
                            >
                              <div className="space-y-1">
                                <div className="flex justify-between items-start">
                                  <h4 className="font-sans font-extrabold text-xs text-gray-950">{p.title}</h4>
                                  
                                  {p.status === 'approved' && (
                                    <span className="text-[8px] sm:text-[9px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-sans font-bold flex items-center gap-0.5">
                                      <CheckCircle className="w-3 h-3" />
                                      منتشر شده
                                    </span>
                                  )}
                                  {p.status === 'pending' && (
                                    <span className="text-[8px] sm:text-[9px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-sans font-bold flex items-center gap-0.5">
                                      <Clock className="w-3 h-3" />
                                      در انتظار تایید مربی
                                    </span>
                                  )}
                                  {p.status === 'rejected' && (
                                    <span className="text-[8px] sm:text-[9px] text-red-700 bg-red-50 px-2 py-0.5 rounded-full font-sans font-bold flex items-center gap-0.5">
                                      <AlertCircle className="w-3 h-3" />
                                      نیازمند اصلاح
                                    </span>
                                  )}
                                </div>
                                <p className="font-sans text-[11px] text-gray-400 line-clamp-2 mt-1">{p.description}</p>
                              </div>

                              <div className="flex items-center justify-between border-t border-gray-50 pt-3 mt-3">
                                <span className="text-[10px] text-gray-500 font-sans">دسته: {p.category === 'Game' ? 'بازی‌سازی اسکرچ' : p.category === 'AI' ? 'هوش مصنوعی' : 'مذاکره'}</span>
                                
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleEditClick(p)}
                                    className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg cursor-pointer"
                                    title="ویرایش پروژه"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProject(p.id)}
                                    className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg cursor-pointer"
                                    title="حذف پروژه"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>

              {/* Left panel: project checklist guides */}
              <div className="lg:col-span-4">
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50/30 p-6 rounded-[2rem] border border-indigo-100 shadow-xs space-y-4">
                  <h3 className="font-sans font-extrabold text-indigo-950 text-sm">💡 چطوری مربی پروژه رو تایید میکنه؟</h3>
                  <div className="space-y-3.5 text-xs text-indigo-900 font-sans leading-relaxed">
                    <p>برای اینکه پروژه‌ات در گالری عمومی نمایش داده بشه و تایید بشه، این نکات رو رعایت کن:</p>
                    <ul className="list-disc list-inside space-y-1.5 text-[11px] text-slate-600">
                      <li>کدهای پروژه کاملاً به درستی کار کنه.</li>
                      <li>خودت پروژه رو طراحی کرده باشی و کپی نباشه.</li>
                      <li>کدهای Scratch یا ویدیو سخنرانیت رو کامل آپلود کنی.</li>
                      <li>اگر بازی می‌سازی، شناسه پروژه Scratch رو وارد کن.</li>
                    </ul>
                    <div className="bg-white p-3 rounded-xl border border-indigo-150 font-bold text-center text-indigo-600">
                      🏆 به ازای تایید هر پروژه +۱۰۰ امتیاز تجربه اضافه دریافت میکنی!
                    </div>
                  </div>
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB 3: Digital Certificates & Rewards shop */}
          {activeTab === 'rewards' && (
            <motion.div
              key="rewards"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8 text-right"
            >
              
              {/* Top Row Grid: Digital Certificates Issuance hub & Shop */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Right: Digital Certificates Issuance and Checker */}
                <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-150/80 shadow-md space-y-6">
                  
                  <div className="border-b border-gray-100 pb-3">
                    <h2 className="font-sans font-extrabold text-gray-950 text-lg flex items-center gap-2">
                      <Award className="w-5.5 h-5.5 text-indigo-600" />
                      <span>مرکز صدور گواهینامه‌های رسمی اسکیل آپ</span>
                    </h2>
                    <p className="font-sans text-xs text-gray-400 mt-1">با به اتمام رساندن چالش‌های هر دوره، گواهینامه رسمی و دیجیتال خود را بلافاصله صادر و چاپ کنید!</p>
                  </div>

                  <div className="space-y-4">
                    {courses.map((course) => {
                      // Check if certificate already issued
                      const hasCert = certificates.find(c => c.courseId === course.id);
                      
                      // Check unlocking criteria
                      const allVideosWatched = course.offlineVideos?.every(v => profile?.completedVideos?.includes(v.id)) || false;
                      const quizPassed = profile?.completedQuizzes?.includes(course.id) || false;
                      const hasProject = studentProjects.length > 0;
                      
                      const canIssue = allVideosWatched && quizPassed && hasProject;

                      return (
                        <div 
                          key={course.id}
                          className="p-4 rounded-2xl border border-gray-150 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50 hover:bg-gray-50 transition-all"
                        >
                          <div className="space-y-1">
                            <span className="text-[9px] bg-slate-900 text-amber-400 font-sans font-extrabold px-2 py-0.5 rounded-sm">
                              {course.level}
                            </span>
                            <h4 className="font-sans font-extrabold text-gray-950 text-xs sm:text-sm">{course.title}</h4>
                            
                            {/* Visual Criteria trackers in compact mode */}
                            <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500 font-sans pt-1">
                              <span className="flex items-center gap-1">
                                {allVideosWatched ? '🟢' : '🔴'} ویدیوها
                              </span>
                              <span className="flex items-center gap-1">
                                {quizPassed ? '🟢' : '🔴'} آزمون
                              </span>
                              <span className="flex items-center gap-1">
                                {hasProject ? '🟢' : '🔴'} تحویل پروژه
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 w-full sm:w-auto">
                            {hasCert ? (
                              <button
                                onClick={() => setSelectedCert(hasCert)}
                                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5"
                              >
                                <Award className="w-4 h-4" />
                                <span>مشاهده و چاپ گواهینامه 🏅</span>
                              </button>
                            ) : canIssue ? (
                              <button
                                onClick={() => handleClaimCertificate(course)}
                                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-sans font-bold text-xs rounded-xl shadow-md shadow-amber-200 cursor-pointer transition-all flex items-center justify-center gap-1.5 animate-bounce"
                              >
                                <Sparkles className="w-4 h-4" />
                                <span>صدور اتوماتیک گواهینامه</span>
                              </button>
                            ) : (
                              <button
                                disabled
                                className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-400 font-sans font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed"
                                title="تمام مأموریت‌های این دوره را ابتدا در چالش‌های طلایی تکمیل کنید."
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>قفل است (تکمیل مأموریت‌ها)</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {courses.length === 0 && (
                      <p className="text-center font-sans text-xs text-gray-400 py-6">
                        دوره فعالی در پنل شما وجود ندارد. پس از تهیه دوره، گواهینامه برای شما در دسترس قرار خواهد گرفت.
                      </p>
                    )}
                  </div>

                </div>

                {/* Left: Gamified Rewards & Discount Store */}
                <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-150/80 shadow-md space-y-6">
                  
                  <div className="border-b border-gray-100 pb-3">
                    <h2 className="font-sans font-extrabold text-gray-950 text-lg flex items-center gap-2">
                      <Coins className="w-5.5 h-5.5 text-amber-500" />
                      <span>فروشگاه پاداش‌ها و کدهای تخفیف</span>
                    </h2>
                    <p className="font-sans text-xs text-gray-400 mt-1">امتیازهای تجربه (XP) خودت رو به جوایز و تخفیف‌های واقعی دوره‌های اسکیل آپ تبدیل کن!</p>
                  </div>

                  {/* Rewards Shop Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Reward Item 1 */}
                    <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200 space-y-3 flex flex-col justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-sans font-bold">۱۵۰ امتیاز (XP)</span>
                        <h4 className="font-sans font-extrabold text-gray-950 text-xs">کد تخفیف ۱۵٪ ثبت‌نام ترم بعد</h4>
                        <p className="font-sans text-[10px] text-gray-500 leading-normal">دریافت کد تخفیف ۱۵ درصدی روی خرید هر دوره بعدی.</p>
                      </div>
                      
                      {profile?.unlockedRewards?.includes('discount-15') ? (
                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                          <span className="font-sans font-black text-xs text-emerald-800">کد: FUTURE-HERO-15</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleClaimReward('discount-15')}
                          className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-sans font-bold text-[11px] rounded-lg cursor-pointer transition-all"
                        >
                          فعال‌سازی با امتیاز
                        </button>
                      )}
                    </div>

                    {/* Reward Item 2 */}
                    <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200 space-y-3 flex flex-col justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-sans font-bold">۴۰۰ امتیاز (XP)</span>
                        <h4 className="font-sans font-extrabold text-gray-950 text-xs">کد تخفیف ۳۰٪ ثبت‌نام ترم بعد</h4>
                        <p className="font-sans text-[10px] text-gray-500 leading-normal">دریافت کد تخفیف ۳۰ درصدی روی خرید هر دوره بعدی.</p>
                      </div>
                      
                      {profile?.unlockedRewards?.includes('discount-30') ? (
                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                          <span className="font-sans font-black text-xs text-emerald-800">کد: SKILLUP-30</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleClaimReward('discount-30')}
                          className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-sans font-bold text-[11px] rounded-lg cursor-pointer transition-all"
                        >
                          فعال‌سازی با امتیاز
                        </button>
                      )}
                    </div>

                    {/* Reward Item 3 */}
                    <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-200 space-y-3 flex flex-col justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full font-sans font-bold">رسیدن به سطح ۳</span>
                        <h4 className="font-sans font-extrabold text-gray-950 text-xs">پروژه‌های انحصاری هوش مصنوعی</h4>
                        <p className="font-sans text-[10px] text-gray-500 leading-normal">دسترسی به فایل‌ها و جزوه‌های تکمیلی مربیان ارشد هوش مصنوعی.</p>
                      </div>
                      
                      {profile?.unlockedRewards?.includes('exclusive-ai') ? (
                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                          <span className="font-sans font-black text-xs text-emerald-800">✅ فعال شد! دانلود در کانال اسکیل آپ</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleClaimReward('exclusive-ai')}
                          className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-sans font-bold text-[11px] rounded-lg cursor-pointer transition-all"
                        >
                          فعال‌سازی با امتیاز
                        </button>
                      )}
                    </div>

                    {/* Reward Item 4 */}
                    <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-200 space-y-3 flex flex-col justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full font-sans font-bold">رسیدن به سطح ۴</span>
                        <h4 className="font-sans font-extrabold text-gray-950 text-xs">قالب گواهینامه طلایی لوکس</h4>
                        <p className="font-sans text-[10px] text-gray-500 leading-normal">دسترسی به پوسته سلطنتی و طلایی در زمان پرینت و چاپ گواهینامه شما.</p>
                      </div>
                      
                      {profile?.unlockedRewards?.includes('golden-theme') ? (
                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                          <span className="font-sans font-black text-xs text-emerald-800">✅ قالب طلایی فعال شد!</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleClaimReward('golden-theme')}
                          className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-sans font-bold text-[11px] rounded-lg cursor-pointer transition-all"
                        >
                          فعال‌سازی با امتیاز
                        </button>
                      )}
                    </div>

                  </div>

                </div>

              </div>

            </motion.div>
          )}

        </AnimatePresence>

      </div>

      {/* 1. INTERACTIVE QUIZ MODAL */}
      <AnimatePresence>
        {activeQuizCourse && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 text-right"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -15 }}
              className="bg-white rounded-[2.5rem] w-full max-w-lg p-6 sm:p-8 space-y-6 border-4 border-indigo-400 shadow-2xl relative overflow-hidden"
            >
              
              {/* Visual stars background */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-indigo-600" />

              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="font-sans text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold">
                  آزمون مهارتی {activeQuizCourse.title}
                </span>
                <button
                  onClick={() => setActiveQuizCourse(null)}
                  className="text-gray-400 hover:text-gray-900 font-sans text-xs font-black underline"
                >
                  انصراف و خروج
                </button>
              </div>

              {!quizFinished ? (
                <div className="space-y-6">
                  {/* Progress info */}
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>تعداد کل سوالات: ۳ سوال</span>
                    <span className="font-sans font-bold text-indigo-600">سوال {currentQuizIndex + 1} از ۳</span>
                  </div>

                  {/* Question Title */}
                  <div className="space-y-4">
                    <h3 className="font-sans font-black text-slate-900 text-sm sm:text-base leading-relaxed">
                      { (courseQuizzes[activeQuizCourse.id] || generalQuiz)[currentQuizIndex].question }
                    </h3>
                    
                    {/* Options list */}
                    <div className="space-y-3">
                      { (courseQuizzes[activeQuizCourse.id] || generalQuiz)[currentQuizIndex].options.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAnswerQuizQuestion(idx)}
                          className="w-full text-right p-4 rounded-xl border-2 border-gray-150 hover:border-indigo-400 hover:bg-indigo-50/20 font-sans text-xs font-bold transition-all cursor-pointer"
                        >
                          {option}
                        </button>
                      )) }
                    </div>
                  </div>
                </div>
              ) : (
                // Finished quiz screen
                <div className="space-y-6 text-center py-4">
                  {quizSuccessMessage ? (
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 text-3xl mx-auto shadow-inner">
                        🎉
                      </div>
                      <h3 className="font-sans font-black text-slate-900 text-base">قبولی در آزمون مهارتی!</h3>
                      <p className="font-sans text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">{quizSuccessMessage}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 text-3xl mx-auto shadow-inner">
                        ❤️
                      </div>
                      <h3 className="font-sans font-black text-slate-900 text-base">دوباره تلاش کن!</h3>
                      <p className="font-sans text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">{quizError}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setActiveQuizCourse(null);
                        fetchProfileAndCerts(); // refresh
                      }}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold text-xs rounded-xl cursor-pointer"
                    >
                      فهمیدم، بستن صفحه آزمون
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* 2. OFFICIAL DIGITAL CERTIFICATE PREVIEW MODAL */}
      <AnimatePresence>
        {selectedCert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 text-center overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -15 }}
              className="bg-white rounded-[3rem] w-full max-w-3xl p-6 sm:p-8 space-y-6 border-4 border-amber-400 shadow-2xl relative"
            >
              
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <span className="font-sans text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
                  🏅 گواهینامه معتبر صادر شده اسکیل آپ
                </span>
                <button
                  onClick={() => setSelectedCert(null)}
                  className="text-gray-400 hover:text-gray-900 font-sans text-xs underline font-black"
                >
                  بستن گواهینامه
                </button>
              </div>

              {/* PRINTABLE HIGH-FIDELITY CERTIFICATE CANVAS FRAME */}
              <div 
                id="certificate-print-area"
                className={`relative border-8 border-double p-6 sm:p-10 rounded-[2rem] text-center space-y-6 overflow-hidden shadow-inner ${
                  profile?.unlockedRewards?.includes('golden-theme') 
                    ? 'border-amber-400 bg-gradient-to-br from-amber-50/70 via-white to-amber-100/50 shadow-amber-200' 
                    : 'border-slate-800 bg-gradient-to-br from-indigo-50/20 via-white to-slate-50 shadow-gray-100'
                }`}
                style={{ direction: 'rtl' }}
              >
                {/* Visual watermark SVG pattern */}
                <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center">
                  <GraduationCap className="w-80 h-80" />
                </div>

                {/* Certificate headers */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b-2 border-dashed border-gray-200 pb-4">
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block font-sans">شناسه گواهی: {selectedCert.verificationCode}</span>
                    <span className="text-[10px] text-gray-400 block font-sans">تاریخ صدور: {selectedCert.issuedAt}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                      <GraduationCap className="w-5.5 h-5.5" />
                    </div>
                    <div className="text-right">
                      <span className="font-sans font-black text-sm text-gray-900 block leading-tight">اسکیل آپ</span>
                      <span className="font-sans text-[10px] text-indigo-600 font-bold block">پلتفرم تخصصی خلاقیت نوجوانان</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 py-4">
                  <span className="text-xs bg-amber-500 text-white font-sans font-black px-4 py-1.5 rounded-full uppercase tracking-wider shadow-xs">
                    گواهینامه رسمی مهارت‌آموزی
                  </span>
                  
                  <h3 className="font-sans text-lg sm:text-2xl font-black text-slate-900 pt-2">
                    به نام خدا
                  </h3>

                  <p className="font-sans text-xs sm:text-sm text-slate-700 leading-relaxed max-w-xl mx-auto pt-1">
                    بدینوسیله گواهی می‌شود هنرجوی گرامی، <strong className="text-indigo-600 text-base sm:text-lg font-black underline decoration-indigo-400 decoration-2 decoration-offset-4">{selectedCert.studentName}</strong>، با موفقیت و شایستگی تمام جلسات و چالش‌های کارگاهی فشرده و پروژه پایانی دوره <strong>«{selectedCert.courseTitle}»</strong> را تحت نظارت مستقیم منتورهای اسکیل آپ به پایان رسانده است.
                  </p>
                </div>

                {/* Footers, Seals and signatures */}
                <div className="flex flex-col sm:flex-row justify-between items-end gap-6 pt-6 border-t-2 border-dashed border-gray-100">
                  <div className="text-right space-y-1">
                    <span className="font-sans text-[10px] text-gray-400 block">صحت امضا مربی:</span>
                    <span className="font-sans text-xs font-bold text-gray-900 block">شورای عالی منتورهای اسکیل آپ</span>
                    <span className="font-sans text-[10px] text-slate-400 block">منتورهای حرفه‌ای مسیرهای مهارتی</span>
                  </div>

                  {/* Stamp Graphic */}
                  <div className="w-16 h-16 rounded-full border-4 border-indigo-600/30 flex items-center justify-center text-center rotate-12 text-indigo-600/60 font-sans font-bold text-[9px] select-none scale-90 shrink-0">
                    مهر رسمی<br />اسکیل آپ
                  </div>

                  <div className="text-left space-y-1">
                    <span className="font-sans text-[10px] text-gray-400 block">محل امضا مدیریت:</span>
                    <span className="font-sans text-xs font-bold text-gray-900 block">مدیریت آکادمی اسکیل آپ</span>
                    <div className="h-6 w-24 bg-[url('/assets/legacy/unsplash-1598128558393-70ff21433be0-q60.jpg')] opacity-40 mix-blend-multiply bg-cover bg-center" />
                  </div>
                </div>

              </div>

              {/* Certificate Actions: PRINT / COPY */}
              <div className="flex flex-col sm:flex-row gap-3 pt-3">
                <button
                  onClick={() => {
                    // Quick custom print window helper
                    const printContent = document.getElementById('certificate-print-area')?.innerHTML;
                    const originalContent = document.body.innerHTML;
                    if (printContent) {
                      window.print();
                    }
                  }}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold text-xs rounded-xl cursor-pointer shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ فیزیکی یا ذخیره PDF 📄</span>
                </button>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `گواهینامه رسمی اسکیل آپ برای هنرجو ${selectedCert.studentName} در دوره ${selectedCert.courseTitle} صادر شد! کد اصالت گواهی: ${selectedCert.verificationCode}`
                    );
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-sans font-bold text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-4 h-4 text-indigo-500" />
                  <span>{copiedLink ? 'کپی شد! ✅' : 'اشتراک‌گذاری در شبکه‌های اجتماعی'}</span>
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function MiniStat({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-150 p-5 shadow-xs">
      <span className="font-sans text-[11px] text-slate-400 font-bold block">{title}</span>
      <strong className="font-sans text-2xl text-slate-950 font-black block mt-2">{value}</strong>
    </div>
  );
}
