import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Laptop, Cat, Rocket, Cpu, Code, Palette, Globe, 
  Award, Gamepad2, Brain, Briefcase, Trophy, Sparkles, 
  Volume2, CheckCircle2, ChevronRight, Play, ShieldAlert,
  Zap, Star, Terminal, Compass, Eye, Server, Compass as OrbitIcon
} from 'lucide-react';

interface LearningLevel {
  id: string;
  numBadge: string;
  levelTitle: string;
  subtitle: string;
  duration: string;
  bullets: string[];
  imageUrl: string;
  difficulty: 'مبتدی' | 'متوسط' | 'پیشرفته' | 'همه سطوح';
  icon: any;
  colorTheme: {
    bg: string;
    border: string;
    text: string;
    accent: string;
    gradient: string;
    shadow: string;
    neon: string;
  };
  energy: string;
  gearUnlocked: string;
}

export default function Roadmap() {
  const [activeLevelId, setActiveLevelId] = useState<string>('level-0');
  const [selectedBranch, setSelectedBranch] = useState<'4A' | '4B' | '4C'>('4A');
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [completedLevels, setCompletedLevels] = useState<string[]>(['level-0']);
  const [showConfetti, setShowConfetti] = useState(false);
  const [scanPulse, setScanPulse] = useState(0);

  // Sound generator for gamified click feeling
  const playPopSound = (frequency = 440) => {
    if (!isSoundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(frequency * 1.8, ctx.currentTime + 0.15);
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  // Simulated radar scanner animation trigger
  useEffect(() => {
    const timer = setInterval(() => {
      setScanPulse(prev => (prev + 1) % 4);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const handleStartMission = () => {
    playPopSound(587.33); // D5 note for success
    setShowConfetti(true);
    if (!completedLevels.includes(activeLevelId)) {
      setCompletedLevels(prev => [...prev, activeLevelId]);
    }
    setTimeout(() => setShowConfetti(false), 2500);
  };

  const levels: LearningLevel[] = [
    {
      id: 'level-0',
      numBadge: '۰',
      levelTitle: 'کار با کامپیوتر و مهارت‌های پایه',
      subtitle: 'ورود به دنیای دیجیتال و تسلط بر ابزارهای اولیه',
      duration: '۱ تا ۲ ماه',
      difficulty: 'مبتدی',
      icon: Laptop,
      imageUrl: '/assets/legacy/unsplash-1547082299-de196ea013d6-q80.jpg',
      bullets: [
        'آشنایی با سخت‌افزار کامپیوتر و نحوه کارکرد سیستم‌ها',
        'تسلط بر سیستم‌عامل ویندوز و مدیریت حرفه‌ای فایل‌ها',
        'مهارت تایپ ده‌انگشتی سریع و اصولی برای افزایش بازدهی',
        'مفاهیم اینترنت امن، سرچ پیشرفته و ارتباطات دیجیتال',
        'مدیریت فایل‌های ابری و ابزارهای پایه‌ای کاربری'
      ],
      energy: '۹۵٪ تمرکز ذهنی',
      gearUnlocked: 'مدرک سواد کامپیوتر اسکیل‌آپ',
      colorTheme: {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        accent: 'bg-amber-500',
        gradient: 'from-amber-400 to-orange-500',
        shadow: 'shadow-amber-500/10',
        neon: '#f59e0b'
      }
    },
    {
      id: 'level-1',
      numBadge: '۱',
      levelTitle: 'Junior Scratch (جونیور اسکرچ)',
      subtitle: 'اولین گام برنامه‌نویسی بصری و تقویت منطق',
      duration: '۲ ماه',
      difficulty: 'مبتدی',
      icon: Cat,
      imageUrl: '/assets/legacy/unsplash-1607604276583-eef5d076aa5f-q80.jpg',
      bullets: [
        'درک مفهوم الگوریتم و تفکر گام‌به‌گام منطقی',
        'ساخت داستان‌های متحرک و انیمیشن‌های خلاقانه',
        'پیاده‌سازی اولین بازی‌های دو بعدی تعاملی ساده',
        'تقویت حل مسئله بدون درگیر شدن با خطاهای تایپی کد',
        'آشنایی با دستورات شرطی و حلقه‌های تکرار ساده'
      ],
      energy: '۹۰٪ منطق خلاق',
      gearUnlocked: 'لباس ویژه Junior Coder اسکیل‌آپ',
      colorTheme: {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
        accent: 'bg-emerald-500',
        gradient: 'from-emerald-400 to-teal-500',
        shadow: 'shadow-emerald-500/10',
        neon: '#10b981'
      }
    },
    {
      id: 'level-2',
      numBadge: '۲',
      levelTitle: 'Scratch Developer (اسکرچ پیشرفته)',
      subtitle: 'توسعه بازی‌های چندمرحله‌ای و تفکر مهندسی',
      duration: '۳ ماه',
      difficulty: 'متوسط',
      icon: Gamepad2,
      imageUrl: '/assets/legacy/unsplash-1514888286974-6c03e2ca1dba-q80.jpg',
      bullets: [
        'برنامه‌نویسی ساختاریافته‌تر با متغیرها و لیست‌ها',
        'طراحی فیزیک بازی مانند جاذبه، پرش، برخورد و امتیازدهی',
        'ساخت بازی‌های کامل چندمرحله‌ای با سناریوهای جذاب',
        'مفاهیم پیشرفته مثل کلون‌سازی (Cloning) و پیام‌رسانی بین اشیاء',
        'تمرین کار گروهی، تست بازی دیگران و ارائه پروژه خود'
      ],
      energy: '۹۲٪ تفکر مهندسی',
      gearUnlocked: 'مدال نقره بازی‌ساز خلاق اسکیل‌آپ',
      colorTheme: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        text: 'text-blue-400',
        accent: 'bg-blue-500',
        gradient: 'from-blue-400 to-indigo-600',
        shadow: 'shadow-blue-500/10',
        neon: '#3b82f6'
      }
    },
    {
      id: 'level-3',
      numBadge: '۳',
      levelTitle: 'هوش مصنوعی (AI Creator)',
      subtitle: 'تسلط بر ابزارهای نوین هوشمند و خلاقیت دیجیتال',
      duration: '۳ ماه',
      difficulty: 'متوسط',
      icon: Brain,
      imageUrl: '/assets/legacy/unsplash-1620712943543-bcc4688e7485-q80.jpg',
      bullets: [
        'درک مفاهیم هوش مصنوعی، یادگیری ماشین و شبکه‌های عصبی',
        'آموزش ساخت تصاویر، ویدیوها و موسیقی با مدل‌های هوشمند متنی',
        'پرامپت‌نویسی حرفه‌ای جهت بهره‌برداری حداکثری از دستیارهای هوشمند',
        'ساخت چت‌بات‌های اختصاصی پاسخ‌گو با ابزارهای نوکد (No-Code)',
        'توسعه پروژه‌های ترکیبی هوشمند خلاقانه مبتنی بر تشخیص چهره و صدا'
      ],
      energy: '۹۷٪ خلاقیت دیجیتال',
      gearUnlocked: 'هلمت هوشمند هوش مصنوعی خلاق اسکیل‌آپ',
      colorTheme: {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
        text: 'text-purple-400',
        accent: 'bg-purple-500',
        gradient: 'from-purple-400 to-pink-500',
        shadow: 'shadow-purple-500/10',
        neon: '#a855f7'
      }
    },
    {
      id: 'level-4',
      numBadge: '۴',
      levelTitle: 'شاخه‌های انتخابی (تخصصی)',
      subtitle: 'انتخاب تخصص دلخواه بر اساس استعداد و علاقه نوجوان',
      duration: '۳ ماه',
      difficulty: 'پیشرفته',
      icon: Code,
      imageUrl: selectedBranch === '4A' 
        ? '/assets/legacy/unsplash-1551288049-bebda4e38f71-q80.jpg'
        : selectedBranch === '4B'
        ? '/assets/legacy/unsplash-1579783902614-a3fb3927b6a5-q80.jpg'
        : '/assets/legacy/unsplash-1507238691740-187a5b1d37b8-q80.jpg',
      bullets: selectedBranch === '4A' ? [
        'آشنایی با مبانی پایتون (Python)، محبوب‌ترین زبان دنیا',
        'یادگیری ساختارهای داده، توابع و متغیرهای اصلی پایتون',
        'تحلیل و مصورسازی داده‌ها با کتابخانه‌های Pandas و Matplotlib',
        'حل پروژه‌ها و معماهای واقعی برنامه‌نویسی متنی'
      ] : selectedBranch === '4B' ? [
        'یادگیری اصول پایه رنگ‌شناسی، ترکیب‌بندی و فرم‌های بصری',
        'تدوین ویدیو و ادیت کلیپ‌های جذاب با نرم‌افزارهای مدرن',
        'ساخت جلوه‌های موشن گرافیک ساده برای محتواهای دیجیتال',
        'طراحی هویت بصری، پوسترهای خلاقانه و لوگوهای شخصی'
      ] : [
        'آموزش زبان‌های پایه‌ای وب شامل HTML5 و CSS3',
        'آشنایی با فریم‌ورک‌های مدرن برای ساخت کدهای تمیز و اصولی',
        'اصول طراحی رابط کاربری (UI) و تجربه کاربری (UX) برای صفحات موبایل',
        'پیاده‌سازی یک وب‌سایت شخصی زنده و واکنش‌گرا در بستر اینترنت'
      ],
      energy: '۹۹٪ مهارت تخصصی',
      gearUnlocked: 'مدرک تخصصی تایید شده اسکیل‌آپ',
      colorTheme: {
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/30',
        text: 'text-cyan-400',
        accent: 'bg-cyan-600',
        gradient: 'from-cyan-500 to-indigo-950',
        shadow: 'shadow-cyan-500/10',
        neon: '#06b6d4'
      }
    },
    {
      id: 'level-soft',
      numBadge: '✨',
      levelTitle: 'مهارت‌های نرم و مسیر حرفه‌ای',
      subtitle: 'تقویت اعتمادبه‌نفس، ارائه کار و آمادگی بازار کار واقعی',
      duration: '۲ ماه',
      difficulty: 'همه سطوح',
      icon: Briefcase,
      imageUrl: '/assets/legacy/unsplash-1517245386807-bb43f82c33c4-q80.jpg',
      bullets: [
        'تقویت هوش هیجانی، فن بیان، سخنرانی جذاب و پرزنت کارها',
        'رزومه‌نویسی حرفه‌ای و ساخت پورتفولیوی پروژه‌های توسعه‌یافته',
        'اصول مذاکره صمیمانه و حرفه‌ای با کارفرمایان و مشتریان فرضی',
        'تفکر خلاق، کار تیمی، پذیرش نقد سازنده و حل مسئله تیمی',
        'مدیریت بهینه زمان، انضباط شخصی و برنامه‌ریزی برای اهداف بزرگ'
      ],
      energy: '۹۶٪ هوش اجتماعی',
      gearUnlocked: 'جام زرین برترین سخنران اسکیل‌آپ',
      colorTheme: {
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/30',
        text: 'text-rose-400',
        accent: 'bg-rose-600',
        gradient: 'from-rose-500 to-violet-600',
        shadow: 'shadow-rose-500/10',
        neon: '#f43f5e'
      }
    }
  ];

  const activeLevel = levels.find(l => l.id === activeLevelId) || levels[0];
  const ActiveIcon = activeLevel.icon;

  const statsList = [
    { label: 'آموزش کاربردی', value: '۱۰۰٪', icon: Zap, color: 'text-amber-400' },
    { label: 'مأموریت‌های موفق', value: '+۲۰ پروژه', icon: Trophy, color: 'text-indigo-400' },
    { label: 'همراهی گام‌به‌گام', value: 'شخصی‌سازی شده', icon: Brain, color: 'text-purple-400' }
  ];

  return (
    <section 
      className="py-20 bg-slate-950 text-white relative overflow-hidden text-right" 
      dir="rtl" 
      id="skill-roadmap-adventure-station"
    >
      {/* Background Starry Ambient */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />
      <div className="absolute top-10 left-10 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cybernetic grid border and ambient lights */}
      <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-indigo-500/30 via-purple-500/30 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-transparent via-purple-500/30 to-indigo-500/30" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Dynamic Nav Control Unit */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12 border-b border-slate-800 pb-8">
          <div className="flex items-center gap-3.5 bg-slate-900/60 border border-slate-800 px-5 py-3 rounded-2xl backdrop-blur-md">
            <span className="text-3xl animate-pulse">🛰️</span>
            <div className="text-right">
              <span className="font-sans font-black text-sm text-indigo-300 block uppercase tracking-wider">Skill Up Starship Console</span>
              <span className="font-sans text-[11px] text-slate-400 font-extrabold block">مرکز ناوبری مأموریت‌های کهکشانی رشد نوجوانان</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sound toggle with sci-fi design */}
            <button
              onClick={() => {
                setIsSoundEnabled(!isSoundEnabled);
                playPopSound(523.25);
              }}
              className="flex items-center gap-2 px-4.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-slate-300 transition-all text-xs font-sans font-bold cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Volume2 className={`w-4 h-4 ${isSoundEnabled ? 'text-indigo-400' : 'text-slate-500'}`} />
              <span>{isSoundEnabled ? 'سیستم صوتی: فعال 🔊' : 'سیستم صوتی: غیرفعال 🔇'}</span>
            </button>
          </div>
        </div>

        {/* Console Master Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-indigo-400 font-sans font-black text-xs uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 rounded-full inline-block">
            ☄️ نقشه راه دوازده ماهه ارتقای مهارت
          </span>
          <h2 className="font-sans text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            کهکشان آموزشی مأموریت‌های اسکیل آپ
          </h2>
          <p className="font-sans text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            مسیر رشد نوجوان شما تکراری و خسته‌کننده نخواهد بود! با سیستم ناوبری زیر، مأموریت‌های هر سطح را کشف کنید، مهارت‌های جدید را باز کرده و گواهینامه‌های معتبر دریافت کنید.
          </p>
          <div className="w-20 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full mx-auto" />
        </div>

        {/* 
          ========================================================================
          THE STARSHIP MISSION CONTROL BRIDGE (RESPONSIVE SPLIT-GRID)
          ========================================================================
        */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* COLUMN 1 (7 COLS): TACTICAL RADAR STATION GRID MAP */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden backdrop-blur-md flex-1">
              
              {/* Sci-Fi Radar decorative grid circles */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-slate-800/40 rounded-full pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] h-[260px] border border-slate-800/20 rounded-full pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120px] h-[120px] border border-slate-800/10 rounded-full pointer-events-none animate-pulse" />

              {/* Holographic Radar Line sweep */}
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gradient-to-b from-indigo-500/0 via-indigo-500/20 to-indigo-500/0 pointer-events-none" />
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gradient-to-r from-indigo-500/0 via-indigo-500/20 to-indigo-500/0 pointer-events-none" />

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-slate-800/60 pb-4 relative z-10">
                <div className="space-y-1 text-right">
                  <h3 className="font-sans font-black text-white text-base sm:text-lg flex items-center gap-2">
                    <Compass className="w-5 h-5 text-indigo-400 animate-spin" style={{ animationDuration: '8s' }} />
                    <span>رادار تاکتیکی ایستگاه‌های مهارت</span>
                  </h3>
                  <p className="font-sans text-[11px] text-slate-400">برای مشاهده جزئیات و کنترل پنل روی هر ایستگاه ضربه بزنید</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-[10px] text-emerald-400 font-extrabold uppercase">RADAR ONLINE</span>
                </div>
              </div>

              {/* Grid of Celestial Node Stations - Perfectly layouted, non-overlapping */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                {levels.map((lvl, index) => {
                  const isSelected = activeLevelId === lvl.id;
                  const isCompleted = completedLevels.includes(lvl.id);
                  const Icon = lvl.icon;

                  return (
                    <div
                      key={lvl.id}
                      onClick={() => {
                        setActiveLevelId(lvl.id);
                        playPopSound(280 + index * 60);
                      }}
                      className={`p-4 rounded-2xl border transition-all duration-300 text-right cursor-pointer relative group overflow-hidden ${
                        isSelected 
                          ? 'bg-slate-900 border-indigo-500 shadow-lg shadow-indigo-500/10 scale-[1.01]' 
                          : 'bg-slate-950/70 border-slate-800/70 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      {/* Active glow neon border light */}
                      {isSelected && (
                        <div 
                          className="absolute inset-x-0 top-0 h-[2px] animate-pulse"
                          style={{ backgroundColor: lvl.colorTheme.neon }}
                        />
                      )}

                      <div className="flex items-center gap-3.5">
                        {/* Interactive Station Indicator Badge */}
                        <div 
                          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black transition-all ${
                            isSelected 
                              ? 'bg-slate-800 text-white' 
                              : 'bg-slate-900/60 text-slate-400 group-hover:text-white border border-slate-800'
                          }`}
                          style={{
                            boxShadow: isSelected ? `0 0 15px ${lvl.colorTheme.neon}20` : 'none',
                            color: isSelected ? lvl.colorTheme.neon : undefined
                          }}
                        >
                          <Icon className="w-5 h-5" />
                        </div>

                        <div className="space-y-1 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-sans text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                              مأموریت {lvl.numBadge}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 font-bold">
                              ⏱️ {lvl.duration}
                            </span>
                          </div>
                          <h4 className="font-sans font-black text-xs sm:text-sm text-white group-hover:text-indigo-300 transition-colors">
                            {lvl.levelTitle}
                          </h4>
                        </div>
                      </div>

                      {/* Status indicator tag */}
                      <div className="mt-3 flex justify-between items-center border-t border-slate-800/40 pt-2.5">
                        <span className="font-sans text-[9px] text-slate-500">دشواری: <b className="text-slate-300">{lvl.difficulty}</b></span>
                        <span className={`text-[10px] font-sans font-extrabold px-2 py-0.5 rounded ${
                          isSelected 
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                            : isCompleted 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}>
                          {isSelected ? '🎯 هدایت فعال' : isCompleted ? '✓ پاس شد' : '🔒 آماده مأموریت'}
                        </span>
                      </div>

                    </div>
                  );
                })}
              </div>

              {/* Dynamic Branch selector pill overlay if station 4 is focused */}
              {activeLevel.id === 'level-4' && (
                <div className="mt-6 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-right space-y-3 relative z-10 animate-[fadeIn_0.3s_ease]">
                  <span className="font-sans text-[11px] text-amber-400 font-black block">⚙️ ایستگاه چهارم چندشاخه است! یکی از تخصص‌های زیر را برای دیدن جزئیات رادار انتخاب کنید:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(['4A', '4B', '4C'] as const).map(br => (
                      <button
                        key={br}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBranch(br);
                          playPopSound(440);
                        }}
                        className={`py-2 px-1.5 rounded-xl font-sans font-black text-xs border transition-all cursor-pointer ${
                          selectedBranch === br 
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/10' 
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {br === '4A' ? '📊 پایتون خلاق' : br === '4B' ? '🎨 تدوین و گرافیک' : '🌐 طراحی سایت'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Tactical Grid Live Dashboard Status Readout */}
            <div className="grid grid-cols-3 gap-4">
              {statsList.map((stat, i) => {
                const StatIcon = stat.icon;
                return (
                  <div 
                    key={i}
                    className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl text-center space-y-1 relative group hover:border-slate-700 transition-all"
                  >
                    <div className="flex justify-center mb-1">
                      <StatIcon className={`w-5 h-5 ${stat.color} animate-bounce`} />
                    </div>
                    <span className="block font-sans text-[10px] text-slate-400 font-extrabold">{stat.label}</span>
                    <span className="block font-mono text-xs sm:text-sm font-black text-white">{stat.value}</span>
                  </div>
                );
              })}
            </div>

          </div>

          {/* COLUMN 2 (5 COLS): CENTRAL HOLOGRAPHIC READOUT CONSOLE SCREEN */}
          <div className="lg:col-span-5 flex">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeLevelId + (activeLevelId === 'level-4' ? selectedBranch : '')}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden flex flex-col justify-between w-full shadow-2xl relative"
                style={{ borderColor: `${activeLevel.colorTheme.neon}40` }}
              >
                {/* Visual Upper Cover inside spaceship panel */}
                <div className="relative h-44 sm:h-48 w-full overflow-hidden shrink-0">
                  <img 
                    src={activeLevel.imageUrl} 
                    alt={activeLevel.levelTitle} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover saturate-125"
                  />
                  {/* Neon laser sweeps simulation */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/30 to-transparent" />
                  
                  {/* Scanning holographic green bar */}
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-indigo-400 opacity-60 animate-[bounce_3s_infinite]" />

                  {/* Level rating info tag */}
                  <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 px-3 py-1 rounded-xl shadow-md text-[10px] font-mono font-black">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
                    <span>STATION ID {activeLevel.numBadge}</span>
                  </div>

                  <div className="absolute top-3.5 left-3.5 flex items-center gap-1 bg-slate-950/80 text-white px-2.5 py-1 rounded-xl border border-slate-800 text-[9px] font-sans">
                    <span>مصرف انرژی:</span>
                    <span className="text-amber-400 font-extrabold">{activeLevel.energy}</span>
                  </div>

                  {/* Visual name */}
                  <div className="absolute bottom-3.5 right-4 text-right">
                    <span className="text-[10px] uppercase font-sans font-black tracking-widest text-indigo-400 block mb-0.5">مأموریت فعال شما</span>
                    <h3 className="font-sans font-black text-base sm:text-lg text-white drop-shadow-md">
                      {activeLevel.levelTitle}
                    </h3>
                  </div>
                </div>

                {/* Subtitle/Overview Screen readout */}
                <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-right">
                      <span className="text-[10px] font-sans font-black text-indigo-400 block mb-1">🏁 خلاصه‌ی مأموریت این مهد:</span>
                      <p className="font-sans text-xs text-slate-300 leading-relaxed font-semibold">
                        {activeLevel.subtitle}
                      </p>
                    </div>

                    {/* Unlocked Loot gear badge */}
                    <div className="flex items-center gap-3 bg-indigo-950/30 border border-indigo-500/10 p-3 rounded-xl">
                      <div className="w-9 h-9 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-400 shrink-0">
                        <Award className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 block font-sans">تجهیزات و جوایز آنلاک‌شده در پایان سطح:</span>
                        <span className="text-xs text-indigo-300 font-sans font-black block mt-0.5">{activeLevel.gearUnlocked}</span>
                      </div>
                    </div>

                    {/* Quest bullet points */}
                    <div className="space-y-3">
                      <h4 className="font-sans font-black text-xs text-slate-200 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>سرفصل‌ها و مهارت‌های موردنیاز مأموریت (Sub-Quests):</span>
                      </h4>

                      <ul className="space-y-2">
                        {activeLevel.bullets.map((bullet, idx) => (
                          <li 
                            key={idx} 
                            onClick={() => playPopSound(350 + idx * 40)}
                            className="flex items-start gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors cursor-pointer select-none"
                          >
                            <span className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">✓</span>
                            <span className="font-sans text-xs text-slate-300 leading-relaxed font-semibold">
                              {bullet}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                  </div>

                  {/* Start Mission CTA Trigger */}
                  <div className="pt-4 border-t border-slate-800/60 relative mt-6">
                    <button
                      onClick={handleStartMission}
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-700 text-white font-sans font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-950"
                    >
                      <span>🎮 ثبت‌نام و آغاز مأموریت کهکشانی</span>
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    </button>

                    <AnimatePresence>
                      {showConfetti && (
                        <motion.div 
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 bg-emerald-500 rounded-xl flex flex-col items-center justify-center text-white p-3 z-10 text-center"
                        >
                          <span className="text-xl">🎉👨‍🚀</span>
                          <span className="font-sans text-xs font-black mt-1">مأموریت آغاز شد! گیت فضایی اسکیل‌آپ آماده پرتاب است...</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                </div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>

        {/* Motivational Banner */}
        <div className="mt-16 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/60 border border-slate-800 rounded-3xl p-6 text-center max-w-3xl mx-auto relative overflow-hidden">
          <p className="font-sans text-xs sm:text-sm text-indigo-300 font-extrabold flex items-center justify-center gap-2">
            <span>🚀 تو مأموریت شخصی رشدت رو بساز، تیم فرماندهی اسکیل‌آپ تا فتح آخرین ستاره کنارته!</span>
          </p>
        </div>

      </div>
    </section>
  );
}
