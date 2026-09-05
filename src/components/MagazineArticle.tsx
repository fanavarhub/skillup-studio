import { useEffect } from 'react';
import { ArrowRight, CalendarDays, Clock3, UserRound } from 'lucide-react';
import { findMagazineArticle } from '../articleData';

export default function MagazineArticle({ slug, navigate }: { slug: string; navigate: (tab: string) => void }) {
  const article = findMagazineArticle(slug);
  useEffect(() => {
    if (!article) return;
    document.title = `${article.title} | مجله اسکیل آپ`;
    document.head.querySelector('meta[name="description"]')?.setAttribute('content', article.description);
    document.head.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://skill-up.ir/magazine/${article.slug}`);
  }, [article]);
  if (!article) return <div className="min-h-[70vh] bg-[#fffaf4] py-24 text-center"><p className="font-bold text-rose-600">مقاله پیدا نشد.</p><button onClick={() => navigate('articles')} className="mt-4 rounded-xl bg-violet-600 px-5 py-3 text-white">بازگشت به مجله</button></div>;
  return <main className="bg-[#fffaf4] py-8 text-right" dir="rtl"><article className="mx-auto max-w-4xl px-4 sm:px-6">
    <button onClick={() => navigate('articles')} className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm"><ArrowRight className="h-4 w-4" />مجله اسکیل آپ</button>
    <header className="overflow-hidden rounded-[36px] border-4 border-white bg-white shadow-xl"><img src={article.cover} alt={article.title} className="h-56 w-full object-cover sm:h-80" /><div className="p-6 sm:p-9"><span className="text-xs font-black text-violet-600">راهنمای کاربردی والدین و نوجوانان</span><h1 className="mt-3 text-3xl font-black leading-[1.6] text-slate-950 sm:text-4xl">{article.title}</h1><p className="mt-4 text-base leading-8 text-slate-600">{article.description}</p><div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" />{article.date}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4" />{article.readTime}</span><span className="inline-flex items-center gap-1"><UserRound className="h-4 w-4" />تیم آموزش اسکیل آپ</span></div></div></header>
    <div className="mt-6 rounded-[32px] border-2 border-violet-100 bg-white p-6 text-[15px] leading-9 text-slate-700 sm:p-9"><p className="text-lg font-bold leading-9 text-slate-800">{article.intro}</p>{article.sections.map((section) => <section key={section.title} className="mt-9"><h2 className="text-2xl font-black text-slate-950">{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4">{paragraph}</p>)}{section.bullets && <ul className="mt-4 list-inside list-disc space-y-2 rounded-2xl bg-violet-50 p-5 text-violet-950">{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}</section>)}</div>
    <section className="mt-6 rounded-[32px] border-2 border-sky-100 bg-white p-6 sm:p-8"><h2 className="text-2xl font-black text-slate-950">سؤالات متداول</h2><div className="mt-4 space-y-3">{article.faq.map((item) => <details key={item.question} className="group rounded-2xl bg-slate-50 p-4"><summary className="cursor-pointer list-none font-black text-slate-800">{item.question}<span className="float-left text-violet-600 group-open:rotate-45">＋</span></summary><p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p></details>)}</div></section>
    <section className="mt-6 rounded-[32px] bg-gradient-to-l from-indigo-700 to-violet-600 p-7 text-white"><h2 className="text-2xl font-black">آماده‌ای یک مهارت را با پروژه واقعی شروع کنی؟</h2><p className="mt-2 text-sm leading-7 text-violet-100">دوره‌های اسکیل‌آپ را ببین و مسیر مناسب سن و علاقه‌ات را انتخاب کن.</p><button onClick={() => navigate('courses')} className="mt-4 rounded-2xl bg-white px-5 py-3 text-sm font-black text-violet-700">مشاهده دوره‌ها</button></section>
  </article></main>;
}
