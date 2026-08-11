import { FormEvent, useState } from 'react';
import { CalendarCheck, Compass, Sparkles } from 'lucide-react';

const questions = [
  'چقدر به ساخت بازی و داستان تعاملی علاقه داری؟',
  'چقدر با منطق، الگو و حل مسئله راحت هستی؟',
  'چقدر دوست داری با هوش مصنوعی تصویر یا محتوا بسازی؟',
  'تا امروز چقدر تجربه برنامه‌نویسی داشته‌ای؟',
];

export default function TrialAssessment({ goToCourses }: { goToCourses: () => void }) {
  const [answers, setAnswers] = useState([0, 0, 0, 0]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<{ score: number; recommendedCourse?: { id: string; title: string } } | null>(null);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    const response = await fetch('/api/trial/assessment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers, name, phone }) });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'آزمون ثبت نشد.');
    setResult(data);
  };

  return <section className="py-16 bg-indigo-950 text-white" dir="rtl">
    <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      <div className="pt-5"><span className="inline-flex gap-2 items-center px-3 py-1 rounded-full bg-white/10 text-xs font-bold"><Sparkles className="w-4 h-4 text-amber-300"/>جلسه آزمایشی رایگان</span><h2 className="text-3xl sm:text-4xl font-black mt-5 leading-tight">در کمتر از دو دقیقه، مسیر مناسب یادگیری را پیدا کن</h2><p className="text-indigo-200 text-sm leading-7 mt-4">این آزمون کوتاه بر اساس علاقه و تجربه، یک دوره مناسب پیشنهاد می‌دهد. اگر نام و موبایل را وارد کنی، درخواست جلسه آزمایشی هم ثبت می‌شود.</p>
        <div className="mt-6 rounded-3xl bg-white/5 border border-white/10 p-5 flex gap-3"><CalendarCheck className="w-6 h-6 text-emerald-300 shrink-0"/><div><b>بدون پرداخت</b><p className="text-xs text-indigo-200 mt-1">جلسه برای آشنایی هنرجو با مربی و فضای دوره است.</p></div></div>
      </div>
      <form onSubmit={submit} className="bg-white text-slate-950 rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl">
        {questions.map((question, index) => <label key={question} className="block"><span className="text-sm font-bold block mb-2">{index + 1}. {question}</span><div className="grid grid-cols-4 gap-2">{['کم','نسبتاً','زیاد','خیلی زیاد'].map((label, value) => <button type="button" key={label} onClick={() => setAnswers((items) => items.map((item, itemIndex) => itemIndex === index ? value : item))} className={`py-2 rounded-xl text-[11px] font-bold border ${answers[index] === value ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200'}`}>{label}</button>)}</div></label>)}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام هنرجو (برای رزرو)" className="rounded-xl border border-slate-200 px-3 py-2 text-xs"/><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09123456789" dir="ltr" className="rounded-xl border border-slate-200 px-3 py-2 text-xs"/></div>
        {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}
        {result ? <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4"><div className="flex gap-2 items-center"><Compass className="w-5 h-5 text-emerald-600"/><b>پیشنهاد مسیر: {result.recommendedCourse?.title || 'مشاوره اختصاصی'}</b></div><button type="button" onClick={goToCourses} className="mt-3 text-xs font-bold text-indigo-600">مشاهده دوره‌های پیشنهادی ←</button></div> : <button className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black text-sm">نمایش پیشنهاد و رزرو جلسه رایگان</button>}
      </form>
    </div>
  </section>;
}
