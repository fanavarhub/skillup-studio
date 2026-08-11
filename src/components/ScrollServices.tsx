import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Award, Palette, Video, Mic, RefreshCw, Send,
  CheckCircle2, Star, Zap, ChevronLeft, ChevronRight, Code, Check,
  Brain, Gamepad2, Compass, Heart, Smile, UserCheck, HelpCircle, Trophy
} from 'lucide-react';

interface Question {
  id: number;
  text: string;
  options: {
    text: string;
    emoji: string;
    type: 'creative' | 'game' | 'ai' | 'soft_skills';
    bgClass: string;
    borderClass: string;
    hoverClass: string;
    accentColor: string;
  }[];
}

interface SuperpowerResult {
  title: string;
  desc: string;
  parentTip: string;
  skills: string[];
  courses: string[];
  color: string;
  ageLabel: string;
}

export default function ScrollServices() {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [quizState, setQuizState] = useState<'intro' | 'questions' | 'results'>('intro');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<'junior' | 'senior'>('junior');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<('creative' | 'game' | 'ai' | 'soft_skills')[]>([]);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);

  // Lead Form state on Results screen
  const [parentPhone, setParentPhone] = useState('');
  const [parentName, setParentName] = useState('');
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const [leadError, setLeadError] = useState('');

  // Synthesize soft game sound effects
  const playSfx = (freq = 440, type: 'sine' | 'square' | 'triangle' | 'sawtooth' = 'sine', duration = 0.1) => {
    if (!isSoundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio context blocked
    }
  };

  // -------------------------------------------------------------
  // CHILD-FRIENDLY & PARENT-APPROVED QUIZ DATA
  // -------------------------------------------------------------
  const juniorQuestions: Question[] = [
    {
      id: 1,
      text: "وقتی پای سیستم، کامپیوتر یا تبلت هستی، بیشتر دوست داری چیکار کنی؟",
      options: [
        { text: "نقاشی کشیدن، رنگ‌آمیزی یا تماشای کارتون‌های باحال", emoji: "🎨", type: "creative", bgClass: "bg-pink-50", borderClass: "border-pink-200", hoverClass: "hover:bg-pink-100/60", accentColor: "#ec4899" },
        { text: "بازی کردن و کلنجار رفتن با بازی‌های فکری و هیجانی", emoji: "🕹️", type: "game", bgClass: "bg-emerald-50", borderClass: "border-emerald-200", hoverClass: "hover:bg-emerald-100/60", accentColor: "#10b981" },
        { text: "سوال پرسیدن از ربات‌ها و فهمیدن کارهای علمی عجیب", emoji: "🤖", type: "ai", bgClass: "bg-indigo-50", borderClass: "border-indigo-200", hoverClass: "hover:bg-indigo-100/60", accentColor: "#6366f1" },
        { text: "تعریف کردن داستان‌های قشنگ برای دوستان و خانواده", emoji: "🗣️", type: "soft_skills", bgClass: "bg-amber-50", borderClass: "border-amber-200", hoverClass: "hover:bg-amber-100/60", accentColor: "#f59e0b" },
      ]
    },
    {
      id: 2,
      text: "اگر یک جعبه مدادرنگی جادویی داشتی، دوست داشتی چی باهاش بکشی که زنده بشه؟",
      options: [
        { text: "یک انیمیشن متحرک خنده‌دار که خودش داستان تعریف کنه", emoji: "🎬", type: "creative", bgClass: "bg-pink-50", borderClass: "border-pink-200", hoverClass: "hover:bg-pink-100/60", accentColor: "#ec4899" },
        { text: "یک نقشه بازی ماجراجویی پر از قلعه، طلا و اژدهای مهربان", emoji: "🧱", type: "game", bgClass: "bg-emerald-50", borderClass: "border-emerald-200", hoverClass: "hover:bg-emerald-100/60", accentColor: "#10b981" },
        { text: "یک ربات پرنده که مشق‌هام رو بنویسه و باهام شطرنج بازی کنه", emoji: "🦾", type: "ai", bgClass: "bg-indigo-50", borderClass: "border-indigo-200", hoverClass: "hover:bg-indigo-100/60", accentColor: "#6366f1" },
        { text: "یک بلندگوی جادویی که برم پشتش و برای همه بچه‌ها صحبت کنم", emoji: "🎤", type: "soft_skills", bgClass: "bg-amber-50", borderClass: "border-amber-200", hoverClass: "hover:bg-amber-100/60", accentColor: "#f59e0b" },
      ]
    },
    {
      id: 3,
      text: "توی یک کار گروهی توی مدرسه، دوست داری کدوم مسئولیت رو داشته باشی؟",
      options: [
        { text: "خوشگل‌سازی دفترچه، نقاشی‌ها و کار با قیچی و چسب", emoji: "🖼️", type: "creative", bgClass: "bg-pink-50", borderClass: "border-pink-200", hoverClass: "hover:bg-pink-100/60", accentColor: "#ec4899" },
        { text: "طراحی کردن مسابقه و نوشتن قوانین بازی گروهی برای بچه‌ها", emoji: "🎲", type: "game", bgClass: "bg-emerald-50", borderClass: "border-emerald-200", hoverClass: "hover:bg-emerald-100/60", accentColor: "#10b981" },
        { text: "حل کردن جدول‌های سخت، پیدا کردن فرمول‌ها و محاسبات ریاضی", emoji: "🧬", type: "ai", bgClass: "bg-indigo-50", borderClass: "border-indigo-200", hoverClass: "hover:bg-indigo-100/60", accentColor: "#6366f1" },
        { text: "توضیح دادن کار گروهی جلوی تخته کلاس برای معلم و کل بچه‌ها", emoji: "📣", type: "soft_skills", bgClass: "bg-amber-50", borderClass: "border-amber-200", hoverClass: "hover:bg-amber-100/60", accentColor: "#f59e0b" },
      ]
    },
    {
      id: 4,
      text: "اگر قهرمان یک کارتون فانتزی بودی، کدوم قدرت جادویی رو انتخاب می‌کردی؟",
      options: [
        { text: "جادوی تغییر رنگ و افکت: زیبا کردن هر چیزی در چند ثانیه", emoji: "🪄", type: "creative", bgClass: "bg-pink-50", borderClass: "border-pink-200", hoverClass: "hover:bg-pink-100/60", accentColor: "#ec4899" },
        { text: "کنترل زمان بازی: زنده کردن قهرمان‌ها و ساختن دنیاهای بازی جدید", emoji: "⚡", type: "game", bgClass: "bg-emerald-50", borderClass: "border-emerald-200", hoverClass: "hover:bg-emerald-100/60", accentColor: "#10b981" },
        { text: "فهمیدن زبان کامپیوترها: فرمان دادن به همه دستگاه‌های الکترونیکی", emoji: "🧠", type: "ai", bgClass: "bg-indigo-50", borderClass: "border-indigo-200", hoverClass: "hover:bg-indigo-100/60", accentColor: "#6366f1" },
        { text: "صحبت شیرین و جذاب: راضی کردن آدم‌ها به همکاری و دوست شدن", emoji: "👑", type: "soft_skills", bgClass: "bg-amber-50", borderClass: "border-amber-200", hoverClass: "hover:bg-amber-100/60", accentColor: "#f59e0b" },
      ]
    }
  ];

  const seniorQuestions: Question[] = [
    {
      id: 1,
      text: "کدام حوزه از دنیای تکنولوژی و کامپیوتر برای آینده شما هیجان‌انگیزتر است؟",
      options: [
        { text: "تولید محتوای خلاق ویدیویی، کارگردانی دیجیتال و افکت‌های ویژه تصویر", emoji: "📸", type: "creative", bgClass: "bg-pink-50", borderClass: "border-pink-200", hoverClass: "hover:bg-pink-100/60", accentColor: "#ec4899" },
        { text: "طراحی و برنامه‌نویسی بازی‌های دو بعدی و سه بعدی برای پی‌سی یا موبایل", emoji: "🎮", type: "game", bgClass: "bg-emerald-50", borderClass: "border-emerald-200", hoverClass: "hover:bg-emerald-100/60", accentColor: "#10b981" },
        { text: "کدنویسی پایتون، تحلیل داده، کار با مدل‌های زبانی بزرگ و هوش مصنوعی", emoji: "💻", type: "ai", bgClass: "bg-indigo-50", borderClass: "border-indigo-200", hoverClass: "hover:bg-indigo-100/60", accentColor: "#6366f1" },
        { text: "ارائه استارتاپی، سخنرانی تاثیرگذار، رهبری تیم و فنون متقاعدسازی", emoji: "🤝", type: "soft_skills", bgClass: "bg-amber-50", borderClass: "border-amber-200", hoverClass: "hover:bg-amber-100/60", accentColor: "#f59e0b" },
      ]
    },
    {
      id: 2,
      text: "معمولاً اوقات فراغت خودتان در اینترنت را بیشتر چگونه می‌گذرانید؟",
      options: [
        { text: "دنبال کردن ولاگ‌ها، تیزرهای سینمایی خلاقانه و تکنیک‌های تدوین ویدیو", emoji: "🎥", type: "creative", bgClass: "bg-pink-50", borderClass: "border-pink-200", hoverClass: "hover:bg-pink-100/60", accentColor: "#ec4899" },
        { text: "بازی کردن بازی‌های خلاقانه مثل Minecraft, Roblox یا بررسی قوانین مکانیک بازی", emoji: "🕹️", type: "game", bgClass: "bg-emerald-50", borderClass: "border-emerald-200", hoverClass: "hover:bg-emerald-100/60", accentColor: "#10b981" },
        { text: "کنجکاوی درباره نحوه کارکرد سیستم‌ها، وب‌سایت‌ها و تحلیل کدهای پشت صحنه", emoji: "🧠", type: "ai", bgClass: "bg-indigo-50", borderClass: "border-indigo-200", hoverClass: "hover:bg-indigo-100/60", accentColor: "#6366f1" },
        { text: "گوش دادن به پادکست‌ها، بحث‌های روانشناسی یا سخنرانی‌های انگیزشی تدتاک", emoji: "🎙", type: "soft_skills", bgClass: "bg-amber-50", borderClass: "border-amber-200", hoverClass: "hover:bg-amber-100/60", accentColor: "#f59e0b" },
      ]
    },
    {
      id: 3,
      text: "اگر قرار باشد یک پروژه بزرگ را به تنهایی رهبری کنی، دوست داری خروجی‌اش چه باشد؟",
      options: [
        { text: "یک تیزر تبلیغاتی یا ویدیوی داستانی کوتاه با سناریوی عمیق و تدوین مدرن", emoji: "🎞️", type: "creative", bgClass: "bg-pink-50", borderClass: "border-pink-200", hoverClass: "hover:bg-pink-100/60", accentColor: "#ec4899" },
        { text: "یک بازی مسابقه‌ای چندنفره آنلاین با فیزیک برخورد زنده و سیستم امتیازدهی دقیق", emoji: "🏎️", type: "game", bgClass: "bg-emerald-50", borderClass: "border-emerald-200", hoverClass: "hover:bg-emerald-100/60", accentColor: "#10b981" },
        { text: "یک چت‌بات هوش مصنوعی که با تحلیل فایل‌های درسی، شب امتحان دانش‌آموز را آماده کند", emoji: "🤖", type: "ai", bgClass: "bg-indigo-50", borderClass: "border-indigo-200", hoverClass: "hover:bg-indigo-100/60", accentColor: "#6366f1" },
        { text: "یک ایده استارتاپی انقلابی که جلوی جمع بزرگی از سرمایه‌گذارها ارائه‌اش دهم", emoji: "🚀", type: "soft_skills", bgClass: "bg-amber-50", borderClass: "border-amber-200", hoverClass: "hover:bg-amber-100/60", accentColor: "#f59e0b" },
      ]
    },
    {
      id: 4,
      text: "بزرگترین لذت ذهنی در حل یک چالش برای شما کدام است؟",
      options: [
        { text: "ترکیب درست رنگ‌ها، نورها و موسیقی برای انتقال یک حس عمیق در ویدیو", emoji: "🎨", type: "creative", bgClass: "bg-pink-50", borderClass: "border-pink-200", hoverClass: "hover:bg-pink-100/60", accentColor: "#ec4899" },
        { text: "رفع باگ منطقی برخورد کاراکتر با دیوار و روان‌تر کردن فریم‌ریت حرکات بازی", emoji: "🧬", type: "game", bgClass: "bg-emerald-50", borderClass: "border-emerald-200", hoverClass: "hover:bg-emerald-100/60", accentColor: "#10b981" },
        { text: "بهینه‌سازی کدهای پایتون و طراحی پایگاه داده منظم برای پردازش حجم زیادی داده", emoji: "📊", type: "ai", bgClass: "bg-indigo-50", borderClass: "border-indigo-200", hoverClass: "hover:bg-indigo-100/60", accentColor: "#6366f1" },
        { text: "کنترل تن صدا و زبان بدن برای جلب توجه کامل مخاطبین مخالف در یک جلسه دفاع", emoji: "🗣️", type: "soft_skills", bgClass: "bg-amber-50", borderClass: "border-amber-200", hoverClass: "hover:bg-amber-100/60", accentColor: "#f59e0b" },
      ]
    }
  ];

  const activeQuestions = selectedAgeGroup === 'junior' ? juniorQuestions : seniorQuestions;

  // -------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------
  const handleStartQuiz = () => {
    playSfx(520, 'sine', 0.15);
    setQuizState('questions');
    setCurrentQuestionIdx(0);
    setAnswers([]);
    setSelectedOptionIdx(null);
  };

  const handleSelectOption = (idx: number, type: 'creative' | 'game' | 'ai' | 'soft_skills') => {
    playSfx(660, 'sine', 0.1);
    setSelectedOptionIdx(idx);
  };

  const handleNextQuestion = () => {
    if (selectedOptionIdx === null) return;
    
    const selectedType = activeQuestions[currentQuestionIdx].options[selectedOptionIdx].type;
    const newAnswers = [...answers, selectedType];
    setAnswers(newAnswers);

    if (currentQuestionIdx < activeQuestions.length - 1) {
      playSfx(750, 'sine', 0.15);
      setCurrentQuestionIdx(currentQuestionIdx + 1);
      setSelectedOptionIdx(null);
    } else {
      // Calculate results
      playSfx(900, 'triangle', 0.3);
      setQuizState('results');
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIdx > 0) {
      playSfx(420, 'sine', 0.15);
      setCurrentQuestionIdx(currentQuestionIdx - 1);
      const updatedAnswers = [...answers];
      updatedAnswers.pop();
      setAnswers(updatedAnswers);
      setSelectedOptionIdx(null);
    }
  };

  const handleResetQuiz = () => {
    playSfx(440, 'sine', 0.2);
    setQuizState('intro');
    setCurrentQuestionIdx(0);
    setAnswers([]);
    setSelectedOptionIdx(null);
    setLeadSuccess(false);
    setParentPhone('');
    setParentName('');
    setLeadError('');
  };

  // -------------------------------------------------------------
  // RESULT CALCULATION
  // -------------------------------------------------------------
  const getSuperpowerResult = (): SuperpowerResult => {
    const defaultResult: SuperpowerResult = { 
      title: "🧠 نابغه تفکر منطقی و هوش مصنوعی", 
      desc: "در حال بررسی استعداد...", 
      parentTip: "در حال بررسی...", 
      skills: [], 
      courses: [], 
      color: "indigo", 
      ageLabel: selectedAgeGroup === 'junior' ? 'کودک (۸ تا ۱۲ سال)' : 'نوجوان (۱۳ تا ۱۷ سال)' 
    };

    if (answers.length === 0) return defaultResult;

    const counts = answers.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let maxType: 'creative' | 'game' | 'ai' | 'soft_skills' = 'ai';
    let maxCount = -1;

    for (const type of ['ai', 'game', 'creative', 'soft_skills'] as const) {
      if ((counts[type] || 0) > maxCount) {
        maxCount = counts[type] || 0;
        maxType = type;
      }
    }

    const ageLabel = selectedAgeGroup === 'junior' ? 'کودک (۸ تا ۱۲ سال)' : 'نوجوان (۱۳ تا ۱۷ سال)';

    const resultDatabase = {
      ai: {
        title: "🧠 نابغه تفکر منطقی و هوش مصنوعی",
        desc: `فرزند شما ذهنی به شدت تحلیل‌گر، منظم و حلال چالش‌های پیچیده دارد. او دوست دارد بداند ابزارهای هوشمندی مثل ربات‌ها چطور کار می‌کنند و علاقه دارد کارهایی بسازد که خودکار تصمیم بگیرند! این مسیر او را به یک معمار آینده تکنولوژی تبدیل می‌کند.`,
        parentTip: `والدین گرامی، تفکر منطقی و علاقه فرزند شما به محاسبات و تحلیل سیستم‌ها نشان‌دهنده پتانسیل عالی برای مهندسی نرم‌افزار و هوش مصنوعی است. دوره‌های اسکیل‌آپ به او یاد می‌دهد به جای بازی کردن ساده، منطق پشت تکنولوژی را لمس کند و در رده سنی او بهترین زبان‌های برنامه‌نویسی را تجربه نماید.`,
        skills: ["برنامه‌نویسی و بازی‌سازی با Scratch جونیور", "آموزش مقدماتی تا پیشرفته پایتون به زبان ساده", "آشنایی با نحوه اتصال به Gemini API و هوش مصنوعی"],
        courses: ["آموزش مقدماتی اسکرچ (Junior Scratch)", "خالق هوش مصنوعی (AI Creator)"],
        color: "indigo"
      },
      game: {
        title: "🕹️ مهندس خلاق و جهان‌ساز بازی‌ها",
        desc: `فرزند شما عاشق ساختن قوانین، چیدمان موانع و جان بخشیدن به کاراکترهاست! او نگاه تولیدی به بازی‌های ویدیویی دارد و به جای صرفاً بازی کردن تفریحی، دوست دارد فیزیک حرکات، شتاب ماشین‌ها و چالش مراحل بازی را شخصاً برنامه‌نویسی کند.`,
        parentTip: `والدین گرامی، علاقه فرزند شما به بازی‌های دیجیتال یک فرصت طلایی است! اسکیل‌آپ این علاقه شدید را هدایت کرده و او را به یک بازی‌ساز تبدیل می‌کند. ساخت بازی به او ریاضیات کاربردی، تفکر الگوریتمی و طراحی منطقی را به صورت کاملاً عملی و شیرین می‌آموزد.`,
        skills: ["طراحی فیزیک دوبعدی و موتور سقوط آزاد کاراکتر", "برنامه‌نویسی برخوردها، کلون‌ها و شبیه‌سازی حریف", "ساخت بازی‌های تعاملی و انتشار آن در پورتال اسکرچ"],
        courses: ["توسعه‌دهنده پیشرفته اسکرچ (Scratch Developer)", "آموزش مقدماتی اسکرچ (Junior Scratch)"],
        color: "emerald"
      },
      creative: {
        title: "🎬 جادوگر تصویر و کارگردان رسانه‌های نو",
        desc: `فرزند شما ذوق هنری فوق‌العاده، دید بصری قوی و ذهنی سناریوپرداز دارد. او دنیای اطراف را با فریم‌ها، رنگ‌ها، افکت‌ها و موسیقی می‌بیند و توانایی فوق‌العاده‌ای در ترکیب خلاقانه تکنولوژی با هنر دارد.`,
        parentTip: `والدین گرامی، فرزند خلاق شما یک سازنده محتوای عالی در دنیای دیجیتال خواهد شد. ما در اسکیل‌آپ ابزارهای استاندارد گرافیک و تدوین، به همراه مهندسی تصاویر با هوش مصنوعی (مانند Runway و کپ‌کات) را به او آموزش می‌دهیم تا بتواند پروژه‌های چندرسانه‌ای شگفت‌انگیز تولید کند.`,
        skills: ["تدوین خلاقانه ویدیو، ساخت تیزر و افکت‌های مدرن", "تصویرسازی و پرامپت‌نویسی پیشرفته در مولدهای هنری", "اصول سناریونویسی و زمان‌بندی فریم‌های داستانی"],
        courses: ["گرافیک دیجیتال و تدوین ویدیو (Creative Media)", "خالق هوش مصنوعی (AI Creator)"],
        color: "pink"
      },
      soft_skills: {
        title: "👑 رهبر آینده و سخنور طلایی استارتاپ‌ها",
        desc: `فرزند شما دارای هوش اجتماعی و توانایی ارتباطی عالی است. او استعداد زیادی در متقاعد کردن دیگران، پرزنت ایده‌ها، صحبت کردن در جمع‌های شلوغ و مدیریت کارهای گروهی دارد. کلام او قدرت نفوذ بالایی دارد!`,
        parentTip: `والدین گرامی، فن بیان و کاریزمای ارتباطی فرزند شما باارزش‌ترین دارایی اوست. در اسکیل‌آپ، او یاد می‌گیرد چطور ایده‌های استارتاپی و کدهای فنی خود را با فن بیان قوی به دیگران ارائه دهد، بر استرس کلامی غلبه کند و یک مدیر موفق در کارهای تیمی باشد.`,
        skills: ["فن بیان قدرتمند، غلبه بر خجالت و زبان بدن حرفه‌ای", "اصول پرزنت استارتاپی و طراحی فایل‌های ارائه متقاعدکننده", "مهارت‌های نرم مثل کار گروهی، زمان‌بندی و تفویض کارها"],
        courses: ["کارگاه فن بیان و پرزنت استارتاپی", "گرافیک دیجیتال و تدوین ویدیو (Creative Media)"],
        color: "amber"
      }
    };

    return {
      ...resultDatabase[maxType],
      ageLabel
    };
  };

  const result = getSuperpowerResult();

  // -------------------------------------------------------------
  // LEAD FORM SUBMISSION (INTEGRATED WITH /api/consultation)
  // -------------------------------------------------------------
  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError('');
    setIsSubmittingLead(true);

    const phoneRegex = /^09\d{9}$/;
    if (!parentPhone.trim() || !phoneRegex.test(parentPhone.trim())) {
      setLeadError('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد (مثال: ۰۹۱۲۳۴۵۶۷۸۹)');
      setIsSubmittingLead(false);
      return;
    }

    try {
      const response = await fetch('/api/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: parentPhone.trim(),
          // Passing metadata about the test result in the request
          notes: `ثبت‌نام مستقیم از آزمون استعدادیابی آنلاین. استعداد کشف‌شده: ${result.title} برای رده سنی ${result.ageLabel} - نام هنرجو: ${parentName.trim()}`
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'خطایی رخ داد.');
      }

      setLeadSuccess(true);
      playSfx(980, 'sine', 0.4);
    } catch (err: any) {
      setLeadError(err.message || 'مشکلی در ثبت اطلاعات پیش آمد. لطفاً مجدداً تلاش کنید.');
    } finally {
      setIsSubmittingLead(false);
    }
  };

  return (
    <section 
      className="py-16 sm:py-24 bg-gray-50 text-gray-950 relative overflow-hidden" 
      dir="rtl"
      id="modern-services-pillar"
    >
      {/* Decorative light backgrounds */}
      <div className="absolute top-10 right-10 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-4">
          <span className="text-indigo-600 font-sans font-extrabold text-xs uppercase tracking-wider bg-indigo-50 px-4.5 py-2 rounded-full inline-block">
            ⚡ ارزیابی و استعدادیابی هوشمند کودکان و نوجوانان
          </span>
          <h2 className="font-sans text-2xl sm:text-3xl font-black text-gray-950 leading-tight">
            کشف استعداد دیجیتالی با آزمون جادویی اسکیل‌آپ 🪄
          </h2>
          <p className="font-sans text-xs sm:text-sm text-gray-600 leading-relaxed max-w-xl mx-auto">
            با ۴ سوال ساده، بازی‌گونه و شیرین، ابرقدرت فرزندتان را پیدا کنید تا با نقشه راه استاندارد و مشاوره مربیان ما بهترین مسیر مهارتی را انتخاب کنید.
          </p>
          <div className="w-16 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full mx-auto" />
        </div>

        {/* =============================================================
            INTRO STATE
            ============================================================= */}
        <AnimatePresence mode="wait">
          {quizState === 'intro' && (
            <motion.div
              key="intro-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-3xl p-6 sm:p-10 border border-gray-100 shadow-xl shadow-indigo-100/30 text-center space-y-8"
              id="talent-test-intro"
            >
              <div className="space-y-3">
                <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
                  <Compass className="w-10 h-10 animate-spin" style={{ animationDuration: '20s' }} />
                </div>
                <h3 className="font-sans font-bold text-xl text-gray-900">قدم اول: رده سنی فرزند خلاقتان را انتخاب کنید</h3>
                <p className="font-sans text-xs text-gray-500">
                  بر اساس رده سنی، سوالات و راهنمایی‌های تحلیلی مربیان ما شخصی‌سازی می‌شوند.
                </p>
              </div>

              {/* Age group toggle buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => { setSelectedAgeGroup('junior'); playSfx(480, 'sine', 0.1); }}
                  className={`p-5 rounded-2xl border-2 text-right transition-all flex items-start gap-3.5 cursor-pointer ${
                    selectedAgeGroup === 'junior' 
                      ? 'border-indigo-600 bg-indigo-50/40 shadow-md shadow-indigo-100' 
                      : 'border-gray-100 bg-gray-50 hover:bg-gray-100/50'
                  }`}
                >
                  <span className="text-3xl shrink-0">👧</span>
                  <div>
                    <h4 className="font-sans font-bold text-sm text-gray-900">دوره کودکان (۸ تا ۱۲ سال)</h4>
                    <p className="font-sans text-[11px] text-gray-500 mt-1 leading-relaxed">
                      آموزش‌های کامپیوتر بازی‌محور، بلاک برنامه نویسی اسکرچ، انیمیشن‌سازی و منطق خلاق.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setSelectedAgeGroup('senior'); playSfx(580, 'sine', 0.1); }}
                  className={`p-5 rounded-2xl border-2 text-right transition-all flex items-start gap-3.5 cursor-pointer ${
                    selectedAgeGroup === 'senior' 
                      ? 'border-indigo-600 bg-indigo-50/40 shadow-md shadow-indigo-100' 
                      : 'border-gray-100 bg-gray-50 hover:bg-gray-100/50'
                  }`}
                >
                  <span className="text-3xl shrink-0">🧑</span>
                  <div>
                    <h4 className="font-sans font-bold text-sm text-gray-900">دوره نوجوانان (۱۳ تا ۱۷ سال)</h4>
                    <p className="font-sans text-[11px] text-gray-500 mt-1 leading-relaxed">
                      زبان‌های برنامه‌نویسی متنی پایتون، مهندسی پرامپت هوش مصنوعی، ادیت ویدیو حرفه‌ای و ارائه استارتاپی.
                    </p>
                  </div>
                </button>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleStartQuiz}
                className="w-full max-w-sm py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-sans font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer mx-auto"
              >
                <span>شروع بازی کشف استعداد اسکیل‌آپ 🚀</span>
              </button>

              <div className="flex justify-center items-center gap-2 text-xs text-gray-400 font-sans font-medium pt-3">
                <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
                <span>طراحی‌شده با متدهای روانشناسی بازی‌محور کودکان</span>
              </div>
            </motion.div>
          )}

          {/* =============================================================
              QUESTION FLOW STATE
              ============================================================= */}
          {quizState === 'questions' && (
            <motion.div
              key="questions-card"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-10 border border-gray-100 shadow-xl shadow-indigo-100/30 space-y-8"
              id="talent-test-questions"
            >
              {/* Top progress bar info */}
              <div className="flex justify-between items-center text-xs font-sans">
                <span className="text-indigo-600 font-extrabold">
                  رده سنی: {selectedAgeGroup === 'junior' ? '👧 کودکان (۸ تا ۱۲ سال)' : '🧑 نوجوانان (۱۳ تا ۱۷ سال)'}
                </span>
                <span className="text-gray-400 font-bold">
                  سوال {currentQuestionIdx + 1} از {activeQuestions.length}
                </span>
              </div>

              {/* Real progress line */}
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                  initial={{ width: '0%' }}
                  animate={{ width: `${((currentQuestionIdx + 1) / activeQuestions.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Question Text */}
              <div className="text-center py-2">
                <h3 className="font-sans font-extrabold text-lg sm:text-xl text-gray-950 leading-relaxed">
                  {activeQuestions[currentQuestionIdx].text}
                </h3>
              </div>

              {/* Option Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeQuestions[currentQuestionIdx].options.map((opt, idx) => {
                  const isSelected = selectedOptionIdx === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectOption(idx, opt.type)}
                      className={`p-4 rounded-2xl border-2 text-right transition-all flex items-center gap-3.5 cursor-pointer ${opt.bgClass} ${opt.hoverClass} ${
                        isSelected 
                          ? 'border-indigo-600 ring-2 ring-indigo-600/10 shadow-md' 
                          : opt.borderClass
                      }`}
                    >
                      <span className="text-3xl shrink-0 bg-white/80 p-2.5 rounded-xl shadow-xs">
                        {opt.emoji}
                      </span>
                      <span className="font-sans font-bold text-xs sm:text-sm text-gray-800 leading-relaxed">
                        {opt.text}
                      </span>
                      {isSelected && (
                        <div className="mr-auto shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handlePrevQuestion}
                  disabled={currentQuestionIdx === 0}
                  className="px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 text-xs font-sans font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>قبلی</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  disabled={selectedOptionIdx === null}
                  className={`px-6 py-2.5 rounded-xl text-white text-xs font-sans font-extrabold flex items-center gap-1 cursor-pointer transition-all ${
                    selectedOptionIdx === null 
                      ? 'bg-gray-200 cursor-not-allowed text-gray-400' 
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100'
                  }`}
                >
                  <span>{currentQuestionIdx === activeQuestions.length - 1 ? 'مشاهده نتیجه استعداد یابی 🏆' : 'مرحله بعد'}</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* =============================================================
              RESULTS STATE (THE GRAND REVEAL)
              ============================================================= */}
          {quizState === 'results' && (
            <motion.div
              key="results-card"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
              id="talent-test-results"
            >
              {/* Main Superpower Card */}
              <div className="bg-white rounded-3xl p-6 sm:p-10 border border-gray-100 shadow-xl shadow-indigo-100/30 text-center relative overflow-hidden">
                {/* Simulated festive sparkles in background */}
                <div className="absolute top-4 left-4 text-2xl animate-pulse">✨</div>
                <div className="absolute bottom-4 right-4 text-2xl animate-pulse delay-500">✨</div>
                
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-sans font-black mb-4">
                  <Trophy className="w-4 h-4" />
                  <span>تحلیل استعداد با موفقیت انجام شد!</span>
                </span>

                <h3 className="font-sans font-black text-2xl sm:text-3xl text-gray-950 mt-1">
                  {result.title}
                </h3>
                
                <p className="font-sans text-xs text-indigo-600 font-extrabold mt-1">
                  نشان طلایی برای رده سنی: {result.ageLabel}
                </p>

                <p className="font-sans text-xs sm:text-sm text-gray-600 leading-relaxed max-w-xl mx-auto mt-6">
                  {result.desc}
                </p>

                {/* Sub-skills list */}
                <div className="mt-8 text-right max-w-lg mx-auto bg-gray-50/60 p-5 rounded-2xl border border-gray-100 space-y-3">
                  <h4 className="font-sans font-black text-xs text-gray-900 flex items-center gap-2">
                    <span className="w-1.5 h-3 bg-indigo-500 rounded-full" />
                    🎯 مهارت‌هایی که فرزندتان یاد می‌گیرد:
                  </h4>
                  <ul className="space-y-2">
                    {result.skills.map((skill, i) => (
                      <li key={i} className="font-sans text-xs text-gray-600 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>{skill}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Special Parent Advisory Block */}
              <div className="bg-indigo-50/50 rounded-3xl p-6 sm:p-8 border border-indigo-100/60 space-y-4">
                <div className="flex items-center gap-2 text-indigo-800">
                  <UserCheck className="w-5 h-5" />
                  <h4 className="font-sans font-black text-sm">💡 راهنمای طلایی مربیان اسکیل‌آپ (ویژه والدین):</h4>
                </div>
                <p className="font-sans text-xs sm:text-sm text-indigo-950/80 leading-relaxed">
                  {result.parentTip}
                </p>
                <div className="pt-2 border-t border-indigo-100/80 flex flex-wrap gap-2 items-center text-xs text-indigo-700 font-bold font-sans">
                  <span>دوره‌های پیشنهادی:</span>
                  {result.courses.map((c, i) => (
                    <span key={i} className="bg-white border border-indigo-200 px-3 py-1 rounded-lg">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Lead registration form for parents */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xl shadow-indigo-100/30">
                <div className="text-center max-w-lg mx-auto space-y-2 mb-6">
                  <h4 className="font-sans font-black text-base text-gray-900">🎁 هدیه اسکیل‌آپ: ثبت‌نام یک جلسه کلاس تعاملی آنلاین رایگان</h4>
                  <p className="font-sans text-xs text-gray-500 leading-relaxed">
                    با ثبت نام زیر، یک جلسه ارزیابی زنده و اختصاصی با مربیان ارشد اسکیل‌آپ با تمرکز بر استعداد <b>{result.title.split(' ').slice(1).join(' ')}</b> برای فرزندتان هماهنگ می‌شود.
                  </p>
                </div>

                <AnimatePresence mode="wait">
                  {leadSuccess ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-start gap-3 max-w-md mx-auto"
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <h5 className="font-sans font-bold text-emerald-800 text-sm">ثبت‌نام با موفقیت انجام شد!</h5>
                        <p className="font-sans text-xs text-emerald-700 mt-1 leading-relaxed">
                          ممنون از اعتمادتان. اطلاعات استعداد فرزندتان با مربیان ارشد به اشتراک گذاشته شد. طی ۲۴ ساعت آینده جهت فیکس کردن ساعت جلسه آنلاین رایگان با شما تماس می‌گیریم.
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleLeadSubmit} className="space-y-4 max-w-md mx-auto">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-gray-400 font-sans font-bold mb-1">نام و نام خانوادگی فرزندتان:</label>
                          <input
                            type="text"
                            required
                            placeholder="مثال: آرش رضایی"
                            value={parentName}
                            onChange={(e) => setParentName(e.target.value)}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white text-xs font-sans focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 font-sans font-bold mb-1">شماره همراه شما (والدین):</label>
                          <input
                            type="tel"
                            required
                            placeholder="مثال: 09123456789"
                            maxLength={11}
                            value={parentPhone}
                            onChange={(e) => setParentPhone(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white text-center font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      {leadError && (
                        <p className="font-sans text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100">
                          ⚠️ {leadError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={isSubmittingLead}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-sans font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isSubmittingLead ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>درخواست هماهنگی کارگاه اختصاصی آنلاین رایگان</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </AnimatePresence>
              </div>

              {/* Reset Quiz Button */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleResetQuiz}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-xs font-sans font-bold cursor-pointer"
                >
                  🔄 بررسی استعداد فرزندی دیگر (تکرار آزمون)
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </section>
  );
}
