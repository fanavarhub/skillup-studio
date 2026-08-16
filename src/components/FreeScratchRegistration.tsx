import { FormEvent, ReactNode, useState } from 'react';
import { motion } from 'motion/react';
import { Check, CheckCircle2, Copy, Gift, Heart, Link2, Loader2, Phone, Rocket, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { isIranPhone, normalizePhone } from '../api';

const ages = Array.from({ length: 17 }, (_, index) => index + 6);
const grades = ['پیش‌دبستانی', 'اول ابتدایی', 'دوم ابتدایی', 'سوم ابتدایی', 'چهارم ابتدایی', 'پنجم ابتدایی', 'ششم ابتدایی', 'هفتم', 'هشتم', 'نهم', 'دهم', 'یازدهم', 'دوازدهم', 'مدرسه نمی‌روم', 'دانشگاه'];
const relations = ['خودم', 'فرزندم', 'خواهر / برادر', 'دوست یا آشنا'] as const;
const experiences = ['کاملاً مبتدی هستم', 'کمی آشنایی دارم', 'قبلاً تجربه برنامه‌نویسی داشته‌ام'] as const;

const initialForm = {
  fullName: '', phone: '', age: '', province: '', educationGrade: '', relation: '', bannerShared: false, programmingExperience: '',
};

export default function FreeScratchRegistration() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const registrationUrl = `${window.location.origin}/signup`;

  const update = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  const copyRegistrationLink = async () => {
    try {
      await navigator.clipboard.writeText(registrationUrl);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = registrationUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1800);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!isIranPhone(form.phone)) {
      setError('شماره تماس را به‌صورت ۱۱ رقمی و با ۰۹ وارد کنید.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/free-course-registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, phone: normalizePhone(form.phone), age: Number(form.age) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ثبت اطلاعات انجام نشد.');
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ارتباط با سرور برقرار نشد.');
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="relative min-h-[85vh] overflow-hidden bg-gradient-to-b from-sky-50 via-white to-emerald-50/70 py-8 sm:py-14" dir="rtl">
    <motion.div aria-hidden className="pointer-events-none absolute -right-20 top-20 h-60 w-60 rounded-full bg-violet-200/45 blur-3xl" animate={{ x: [0, 18, 0], y: [0, -15, 0] }} transition={{ duration: 8, repeat: Infinity }} />
    <motion.div aria-hidden className="pointer-events-none absolute -left-24 top-96 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" animate={{ x: [0, -15, 0], y: [0, 18, 0] }} transition={{ duration: 9, repeat: Infinity }} />

    <main className="relative mx-auto w-full max-w-3xl px-3 sm:px-6">
      <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[30px] border-4 border-white bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 px-5 py-7 text-center text-white shadow-[0_22px_60px_rgba(99,102,241,.25)] sm:px-10 sm:py-10">
        <div aria-hidden className="absolute -right-10 -top-10 h-36 w-36 rounded-full border-[22px] border-white/10" />
        <div aria-hidden className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-cyan-300/15" />
        <motion.span aria-hidden animate={{ rotate: [-5, 7, -5], y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity }} className="mx-auto grid h-20 w-20 place-items-center rounded-[26px] border-2 border-white/30 bg-white/20 text-5xl shadow-xl backdrop-blur">🐱</motion.span>
        <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black text-cyan-50"><Sparkles className="h-4 w-4 text-amber-300" />شروع یک ماجراجویی تازه</p>
        <h1 className="mt-4 text-2xl font-black leading-10 sm:text-4xl">🎁 ثبت‌نام دوره رایگان مقدماتی اسکرچ</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-8 text-indigo-50 sm:text-base">سلام و خوش آمدید 🌱🚀<br />لطفاً اطلاعات زیر را تکمیل کنید تا ثبت‌نام شما نهایی شود و لینک ورود به دوره برایتان ارسال گردد. 💻✨</p>
        <div className="mx-auto mt-5 flex max-w-md items-center gap-2 rounded-2xl border border-white/20 bg-white/15 p-2 text-right backdrop-blur">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15"><Link2 className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><span className="block text-[10px] font-bold text-indigo-100">لینک مستقیم ثبت‌نام</span><code dir="ltr" className="block truncate text-xs font-black text-white">{registrationUrl}</code></div>
          <button type="button" onClick={copyRegistrationLink} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-indigo-700 shadow-lg" title="کپی لینک مستقیم" aria-label="کپی لینک مستقیم ثبت‌نام">{linkCopied ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />}</button>
        </div>
      </motion.header>

      {success ? <SuccessCard onAgain={() => { setForm(initialForm); setSuccess(false); }} /> :
        <motion.form data-testid="free-scratch-form" onSubmit={submit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }} className="relative -mt-2 space-y-4 rounded-b-[34px] rounded-t-[22px] border-2 border-white bg-white/90 p-4 shadow-[0_20px_55px_rgba(15,23,42,.08)] backdrop-blur sm:p-8">
          <div className="mb-1 flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
            <span className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />اطلاعات شما فقط برای هماهنگی دوره استفاده می‌شود.</span>
            <span className="shrink-0 rounded-full bg-white px-3 py-1">کمتر از ۲ دقیقه</span>
          </div>

          <Question number="۱" title="نام و نام خانوادگی" icon={<UserRound className="h-5 w-5" />}>
            <input required minLength={3} value={form.fullName} onChange={(event) => update('fullName', event.target.value)} className="form-field" placeholder="مثلاً آراد محمدی" autoComplete="name" />
          </Question>

          <Question number="۲" title="شماره تماس (والدین یا شرکت‌کننده دوره)" icon={<Phone className="h-5 w-5" />}>
            <input required inputMode="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} className="form-field text-left" placeholder="09123456789" autoComplete="tel" dir="ltr" />
            <p className="mt-2 text-[11px] leading-5 text-slate-400">مثال: شماره‌ای که اطلاع‌رسانی‌ها و لینک دوره را دریافت می‌کند</p>
          </Question>

          <div className="grid gap-4 sm:grid-cols-2">
            <Question number="۳" title="سن شرکت‌کننده در دوره">
              <select required value={form.age} onChange={(event) => update('age', event.target.value)} className="form-field">
                <option value="">انتخاب سن</option>{ages.map((age) => <option value={age} key={age}>{age} سال</option>)}
              </select>
            </Question>
            <Question number="۴" title="استان محل زندگی">
              <input required minLength={2} value={form.province} onChange={(event) => update('province', event.target.value)} className="form-field" placeholder="مثلاً تهران" />
            </Question>
          </div>

          <Question number="۵" title="پایه تحصیلی در مهر ماه سال ۱۴۰۵">
            <select required value={form.educationGrade} onChange={(event) => update('educationGrade', event.target.value)} className="form-field">
              <option value="">پایه تحصیلی را انتخاب کنید</option>{grades.map((grade) => <option value={grade} key={grade}>{grade}</option>)}
            </select>
          </Question>

          <Question number="۶" title="این دوره برای چه کسی است؟">
            <ChoiceGrid name="relation" choices={relations} value={form.relation} onChange={(value) => update('relation', value)} />
          </Question>

          <Question number="۷" title="آیا بنر معرفی کانال را برای حداقل ۲ نفر ارسال کرده‌اید؟">
            <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition ${form.bannerShared ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-emerald-200'}`}>
              <input required type="checkbox" checked={form.bannerShared} onChange={(event) => update('bannerShared', event.target.checked)} className="peer sr-only" />
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 ${form.bannerShared ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>{form.bannerShared && <Check className="h-5 w-5" />}</span>
              <b className="text-sm">بله، ارسال کردم ✅</b>
            </label>
          </Question>

          <Question number="۸" title="میزان آشنایی با برنامه‌نویسی">
            <ChoiceGrid name="experience" choices={experiences} value={form.programmingExperience} onChange={(value) => update('programmingExperience', value)} singleColumn />
          </Question>

          {error && <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold leading-6 text-rose-700">{error}</motion.p>}
          <motion.button disabled={submitting} whileHover={{ y: -2 }} whileTap={{ scale: .98 }} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-l from-emerald-500 via-teal-500 to-cyan-500 px-6 py-4 text-base font-black text-white shadow-xl shadow-emerald-200 transition disabled:cursor-wait disabled:opacity-70">
            {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Rocket className="h-6 w-6" />}{submitting ? 'در حال ثبت اطلاعات…' : 'ثبت‌نام و شروع ماجراجویی'}
          </motion.button>
        </motion.form>}
    </main>
  </div>;
}

function Question({ number, title, icon, children }: { number: string; title: string; icon?: ReactNode; children: ReactNode }) {
  return <fieldset className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_6px_24px_rgba(15,23,42,.04)] sm:p-5">
    <legend className="sr-only">{title}</legend>
    <div className="mb-3 flex items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-100 text-xs font-black text-violet-700">{number}</span>{icon && <span className="text-violet-500">{icon}</span>}<h2 className="text-sm font-black leading-6 text-slate-800 sm:text-base">{title}</h2></div>
    {children}
  </fieldset>;
}

function ChoiceGrid<T extends string>({ name, choices, value, onChange, singleColumn = false }: { name: string; choices: readonly T[]; value: string; onChange: (value: T) => void; singleColumn?: boolean }) {
  return <div className={`grid gap-2 ${singleColumn ? '' : 'sm:grid-cols-2'}`}>{choices.map((choice) => <label key={choice} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 text-sm font-bold transition ${value === choice ? 'border-violet-400 bg-violet-50 text-violet-800 shadow-sm' : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-violet-200'}`}>
    <input required type="radio" name={name} value={choice} checked={value === choice} onChange={() => onChange(choice)} className="sr-only" />
    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${value === choice ? 'border-violet-500 bg-violet-500 text-white' : 'border-slate-300 bg-white'}`}>{value === choice && <Check className="h-4 w-4" />}</span>{choice}
  </label>)}</div>;
}

function SuccessCard({ onAgain }: { onAgain: () => void }) {
  return <motion.section data-testid="free-scratch-success" initial={{ opacity: 0, scale: .96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative -mt-2 overflow-hidden rounded-b-[34px] rounded-t-[22px] border-4 border-white bg-white px-5 py-10 text-center shadow-[0_22px_60px_rgba(16,185,129,.16)] sm:px-10 sm:py-14">
    <motion.div animate={{ y: [0, -8, 0], rotate: [-2, 2, -2] }} transition={{ duration: 2.2, repeat: Infinity }} className="mx-auto grid h-24 w-24 place-items-center rounded-[30px] bg-gradient-to-br from-emerald-100 to-cyan-100 text-6xl">🎉</motion.div>
    <h2 className="mt-6 text-3xl font-black text-slate-950">عالیه 😍🔥</h2>
    <p className="mt-4 text-lg font-black text-emerald-700">اطلاعات شما ثبت شد ✅</p>
    <div className="mx-auto mt-6 max-w-xl rounded-[26px] bg-gradient-to-l from-violet-50 to-sky-50 p-5 text-sm font-bold leading-8 text-slate-700 sm:p-7 sm:text-base">لطفاً به دایرکت برگردید و پیام «ارسال کردم ✅» را بفرستید تا لینک نهایی ورود به دوره رایگان برای شما ارسال شود 🚀💻</div>
    <p className="mt-7 flex items-center justify-center gap-2 text-base font-black text-slate-800"><Heart className="h-5 w-5 fill-rose-500 text-rose-500" />با هم برای ساختن ایران قوی‌تر تلاش می‌کنیم 🇮🇷❤️</p>
    <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-slate-950 px-5 py-3 text-xs font-black text-white"><Gift className="h-5 w-5 text-amber-300" />اسکیل آپ، پلتفرم مهارت‌آموزی نوجوانان</div>
    <button type="button" onClick={onAgain} className="mx-auto mt-6 block text-xs font-bold text-violet-600 hover:text-violet-800">ثبت‌نام شخص دیگر</button>
    <CheckCircle2 aria-hidden className="absolute right-5 top-6 h-7 w-7 text-emerald-300" />
  </motion.section>;
}
