import { useState, FormEvent } from 'react';
import { Phone, CheckCircle, Sparkles, AlertCircle, Rocket, GraduationCap, Bot, Gamepad2, Mic2, ArrowUpLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Hero() {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Simple regex validation for Iranian mobile numbers
    const phoneRegex = /^09\d{9}$/;
    if (!phoneRegex.test(phone.trim())) {
      setError('شماره موبایل وارد شده صحیح نیست. باید با ۰۹ شروع شود و ۱۱ رقم باشد (مثال: ۰۹۱۲۳۴۵۶۷۸۹).');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/consultation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'خطایی رخ داد.');
      }

      setSuccess(true);
      setPhone('');
    } catch (err: any) {
      setError(err.message || 'متأسفانه مشکلی در ارتباط با سرور رخ داده است.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="relative overflow-hidden bg-radial from-indigo-50/60 to-transparent py-12 sm:py-20 lg:py-24" dir="rtl">
      {/* Decorative background element */}
      <div className="absolute top-1/4 -right-24 -z-10 hidden sm:block w-96 h-96 rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="absolute bottom-1/4 -left-24 -z-10 hidden sm:block w-96 h-96 rounded-full bg-pink-100/40 blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Right: Content & Form */}
          <div className="lg:col-span-7 text-right space-y-8">
            {/* Tagline */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 font-sans text-xs sm:text-sm font-semibold">
              <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
              <span>پلتفرم تخصصی رشد مهارتی کودکان و نوجوانان (۸ تا ۱۷ سال)</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-sans text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-950 leading-tight">
              آینده را بساز، <br />
              نه اینکه فقط تماشایش کنی!
            </h1>

            {/* Description */}
            <p className="font-sans text-base sm:text-lg text-gray-600 leading-relaxed max-w-2xl">
              در <strong className="text-indigo-600 font-bold">اسکیل آپ</strong>، نوجوانان مهارت‌های فنی مورد نیاز فردا را همراه با مربیان مجرب و در قالب پروژه‌های واقعی آموزش می‌بینند. برنامه‌نویسی، هوش مصنوعی، ساخت بازی و مهارت‌های نرم مانند فن بیان و کار تیمی.
            </p>

            {/* Phone consult form */}
            <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-gray-100 shadow-xl shadow-indigo-100/40 max-w-xl">
              <h3 className="font-sans font-bold text-gray-900 text-lg mb-2">📞 دریافت مشاوره رایگان آموزش پروژه‌محور</h3>
              <p className="font-sans text-xs text-gray-500 mb-5">
                شماره تماس خود را وارد کنید؛ مشاوران متخصص اسکیل آپ برای ارزیابی استعداد نوجوان شما به صورت کاملاً رایگان با شما تماس می‌گیرند.
              </p>

              <AnimatePresence mode="wait">
                {success ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl flex items-start gap-3"
                  >
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-right">
                      <h4 className="font-sans font-bold text-emerald-800 text-sm">درخواست مشاوره ثبت شد!</h4>
                      <p className="font-sans text-xs text-emerald-700 mt-1">
                        کارشناسان اسکیل آپ به زودی با شما تماس می‌گیرند تا هماهنگی‌های لازم جهت ارزیابی و مشاوره رایگان فرزندتان انجام شود.
                      </p>
                      <button 
                        onClick={() => setSuccess(false)}
                        className="font-sans text-xs text-emerald-800 font-bold mt-3 underline focus:outline-hidden"
                      >
                        ثبت شماره دیگر
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form 
                    onSubmit={handleSubmit}
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="مثال: 09123456789"
                          disabled={isLoading}
                          className="w-full pl-4 pr-11 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-center text-lg text-gray-900 tracking-wider placeholder:font-sans placeholder:text-sm placeholder:tracking-normal"
                          maxLength={11}
                          required
                        />
                        <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-sans font-bold text-sm rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                      >
                        {isLoading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>درخواست تماس مربی</span>
                            <Rocket className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-100 p-3.5 rounded-xl flex items-start gap-2 text-red-600 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="font-sans leading-relaxed">{error}</span>
                      </div>
                    )}
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Left: Creative Graphic/Illustration */}
          <div className="lg:col-span-5 relative">
            <MobileMissionBoard />

            <div data-testid="desktop-orbit-visual" className="hidden lg:block w-96 h-96 relative mx-auto">
              {/* Outer floating rings */}
              <div className="absolute inset-0 border border-dashed border-indigo-200 rounded-full animate-spin" style={{ animationDuration: '40s' }} />
              <div className="absolute inset-8 border border-dashed border-indigo-100 rounded-full animate-spin" style={{ animationDuration: '25s', animationDirection: 'reverse' }} />
              
              {/* Decorative bento-like floating tags */}
              <div className="absolute -top-4 -right-4 bg-amber-400 text-gray-900 px-3.5 py-1.5 rounded-lg text-xs font-bold font-sans shadow-lg flex items-center gap-1.5 animate-bounce" style={{ animationDuration: '4s' }}>
                🐱 اسکرچ
              </div>
              <div className="absolute top-1/2 -left-8 bg-indigo-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold font-sans shadow-lg flex items-center gap-1.5 animate-pulse">
                🤖 هوش مصنوعی
              </div>
              <div className="absolute bottom-4 right-10 bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold font-sans shadow-lg flex items-center gap-1.5 animate-bounce" style={{ animationDuration: '5s', animationDelay: '1s' }}>
                🐍 پایتون
              </div>

              {/* Main character / visual graphic inside a beautifully stylized circle */}
              <div className="absolute inset-16 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-full flex items-center justify-center p-4 shadow-2xl">
                <div className="text-center text-white space-y-3">
                  <GraduationCap className="w-20 h-20 mx-auto text-indigo-100" />
                  <p className="font-sans font-extrabold text-xl sm:text-2xl tracking-tight">Skill Up</p>
                  <p className="font-sans text-indigo-200 text-xs sm:text-sm">Future Makers Platform</p>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium font-sans">
                    <span>سنین ۸ تا ۱۷ سال</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

function MobileMissionBoard() {
  const missions = [
    { icon: Bot, title: 'هوش مصنوعی', detail: 'ساخت تصویر و ویدئو', color: 'bg-violet-500', status: 'در حال یادگیری' },
    { icon: Gamepad2, title: 'بازی‌سازی', detail: 'طراحی اولین بازی', color: 'bg-emerald-400', status: 'ماموریت بعدی' },
    { icon: Mic2, title: 'فن بیان', detail: 'ارائه پروژه', color: 'bg-amber-400', status: 'مهارت همیشگی' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      data-testid="mobile-mission-board"
      className="lg:hidden relative overflow-hidden rounded-[28px] bg-slate-950 p-4 text-white shadow-2xl shadow-indigo-200/50"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#a78bfa_0_33%,#34d399_33%_66%,#fbbf24_66%)]" />

      <div className="flex items-center justify-between border-b border-white/10 pb-4 pt-1">
        <div className="text-right">
          <span className="font-mono text-[10px] text-indigo-300">SKILL UP / FUTURE MAKER</span>
          <h2 className="mt-1 font-sans text-lg font-black">نقشه مأموریت من</h2>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-950 shadow-lg">
          <Rocket className="h-5 w-5" />
        </div>
      </div>

      <div className="grid grid-cols-[74px_1fr] gap-3 py-4">
        <div className="relative overflow-hidden rounded-xl bg-indigo-500 p-3">
          <div className="absolute -left-4 -top-3 text-[64px] font-black leading-none text-white/10">01</div>
          <div className="relative flex h-full flex-col justify-between">
            <span className="font-sans text-[10px] font-bold text-indigo-100">LEVEL</span>
            <div>
              <strong className="block font-sans text-2xl font-black">۰۱</strong>
              <span className="font-sans text-[10px] text-indigo-100">شروع ساختن</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <span className="font-sans text-[10px] font-bold text-emerald-300">ماموریت فعال</span>
              <h3 className="mt-1 font-sans text-sm font-black">از ایده تا اولین پروژه</h3>
            </div>
            <Check className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div initial={{ width: 0 }} animate={{ width: '42%' }} transition={{ delay: 0.6, duration: 0.8 }} className="h-full rounded-full bg-emerald-400" />
          </div>
          <div className="mt-2 flex justify-between font-sans text-[10px] text-slate-400">
            <span>پیشرفت مسیر</span>
            <span>۴۲٪</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {missions.map((mission, index) => {
          const Icon = mission.icon;
          return (
            <motion.div
              key={mission.title}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + index * 0.1 }}
              className="grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-slate-950 ${mission.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-right">
                <h3 className="font-sans text-xs font-black">{mission.title}</h3>
                <p className="mt-0.5 truncate font-sans text-[10px] text-slate-400">{mission.detail}</p>
              </div>
              <div className="flex items-center gap-1 font-sans text-[9px] text-slate-300">
                <span>{mission.status}</span>
                <ArrowUpLeft className="h-3.5 w-3.5 text-indigo-300" />
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 font-sans text-[10px] text-slate-400">
        <span>۸ تا ۱۷ سال</span>
        <span className="text-white">یادگیری • ساختن • ارائه</span>
      </div>
    </motion.div>
  );
}
