import { useEffect, useState } from 'react';

type Article = { slug: string; title: string };
type Analytics = {
  articleSlug: string;
  days: number;
  timezone: string;
  summary: { visits: number; activeSeconds: number; engagedVisits: number; scroll25: number; scroll50: number; scroll75: number; scrollEnd: number };
  daily: Array<{ day: string; visits: number; activeSeconds: number }>;
  sections: Array<{ key: string; label: string; visits: number; activeSeconds: number }>;
};
const number = (value: number) => new Intl.NumberFormat('fa-IR').format(value);
const minutes = (seconds: number) => seconds < 60 ? `${number(seconds)} ثانیه` : `${number(Math.round(seconds / 60))} دقیقه`;

export default function MagazineAnalyticsAdmin({ token }: { token: string }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [slug, setSlug] = useState('scratch-costume-animation');
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/magazine/articles', { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || 'فهرست مقاله‌ها باز نشد.'); return result as Article[]; })
      .then(setArticles).catch(reason => setError(reason instanceof Error ? reason.message : 'فهرست مقاله‌ها باز نشد.'));
  }, [token]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(null);
    fetch(`/api/admin/magazine/${encodeURIComponent(slug)}/analytics?days=${days}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || 'آمار بارگذاری نشد.'); return result as Analytics; })
      .then(result => { if (active) setData(result); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'آمار بارگذاری نشد.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, slug, days]);
  const summary = data?.summary;
  const percent = (count: number) => summary?.visits ? `${number(Math.round(count / summary.visits * 100))}٪` : '۰٪';
  const maxDaily = Math.max(1, ...(data?.daily.map(item => item.visits) || []));
  const maxSection = Math.max(1, ...(data?.sections.map(item => item.activeSeconds) || []));
  return <section className="rounded-3xl bg-white p-4 sm:p-6" dir="rtl">
    <h2 className="text-2xl font-black text-slate-950">آمار مقاله‌ها</h2>
    <p className="mt-2 text-sm leading-7 text-slate-600">بازدید، زمان مطالعهٔ تقریبی و بخش‌هایی که توجه بیشتری گرفته‌اند. این گزارش هویت خواننده را نگه نمی‌دارد.</p>
    <div className="mt-5 flex flex-wrap gap-3"><label className="text-sm font-bold">مقاله<select value={slug} onChange={event => setSlug(event.target.value)} className="mt-2 block w-full min-w-56 rounded-xl border border-violet-200 bg-white p-3 text-base">{articles.map(article => <option key={article.slug} value={article.slug}>{article.title}</option>)}</select></label><label className="text-sm font-bold">بازهٔ زمانی<select value={days} onChange={event => setDays(Number(event.target.value) as 7 | 30 | 90)} className="mt-2 block rounded-xl border border-violet-200 bg-white p-3 text-base"><option value={7}>۷ روز</option><option value={30}>۳۰ روز</option><option value={90}>۹۰ روز</option></select></label></div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-rose-700">{error}</p>}
    {loading && <p role="status" className="mt-6 text-violet-700">در حال بارگذاری آمار…</p>}
    {data && <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
        ['بازدید مقاله', number(summary!.visits)],
        ['زمان مطالعهٔ تقریبی', minutes(summary!.activeSeconds)],
        ['میانگین زمان هر بازدید', minutes(summary!.visits ? Math.round(summary!.activeSeconds / summary!.visits) : 0)],
        ['بازدیدهای فعالِ ۱۰ ثانیه یا بیشتر', `${number(summary!.engagedVisits)} · ${percent(summary!.engagedVisits)}`],
      ].map(([label, value]) => <div key={label} className="rounded-2xl border border-violet-100 bg-violet-50 p-4"><p className="text-xs font-bold text-violet-700">{label}</p><strong className="mt-2 block text-xl font-black text-slate-950">{value}</strong></div>)}</div>
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-100 p-4"><h3 className="font-black">بازدید روزانه</h3><div className="mt-4 flex min-h-40 items-end gap-2 overflow-x-auto border-b border-slate-200 pb-2" aria-label="نمودار بازدید روزانه">{data.daily.map(item => <div key={item.day} className="flex min-w-9 flex-1 flex-col items-center gap-1" title={`${item.day}: ${number(item.visits)} بازدید`}><span className="text-[10px] text-slate-500">{number(item.visits)}</span><div className="w-full rounded-t-lg bg-gradient-to-t from-violet-700 to-sky-400" style={{ height: `${Math.max(6, item.visits / maxDaily * 125)}px` }} /><span className="text-[10px] text-slate-500">{item.day.slice(5)}</span></div>)}</div>{!data.daily.length && <p className="mt-4 text-sm text-slate-500">در این بازه هنوز بازدیدی ثبت نشده است.</p>}</section>
        <section className="rounded-2xl border border-slate-100 p-4"><h3 className="font-black">رسیدن به بخش‌های پایین صفحه</h3><p className="mt-1 text-xs text-slate-500">درصد بازدیدهایی که به هر عمق پیمایش رسیده‌اند</p><div className="mt-4 space-y-3">{([['۲۵٪ صفحه', summary!.scroll25], ['۵۰٪ صفحه', summary!.scroll50], ['۷۵٪ صفحه', summary!.scroll75], ['پایان صفحه', summary!.scrollEnd]] as const).map(([label, count]) => <div key={label}><div className="flex justify-between text-sm"><span>{label}</span><strong>{percent(count)}</strong></div><div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-l from-violet-600 to-sky-400" style={{ width: summary!.visits ? `${count / summary!.visits * 100}%` : '0%' }} /></div></div>)}</div></section>
      </div>
      <section className="mt-5 rounded-2xl border border-slate-100 p-4"><h3 className="font-black">توجه به بخش‌های مقاله</h3><p className="mt-1 text-xs text-slate-500">زمان فعال جمع‌شده در هر بخش؛ هر بخش با تیتر همان مقاله مشخص شده است.</p><div className="mt-4 space-y-3">{[...data.sections].sort((a, b) => b.activeSeconds - a.activeSeconds).map(item => <div key={item.key}><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="min-w-0 break-words font-bold">{item.label}</span><span className="text-slate-600">{minutes(item.activeSeconds)} · {number(item.visits)} بازدید</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${item.activeSeconds / maxSection * 100}%` }} /></div></div>)}{!data.sections.length && <p className="text-sm text-slate-500">هنوز زمان مطالعه‌ای برای بخش‌های این مقاله ثبت نشده است.</p>}</div></section>
      <p className="mt-5 text-xs leading-6 text-slate-500">هر بار باز شدن مقاله یک بازدید است؛ این عدد تعداد افراد یکتا نیست. زمان فقط هنگام فعال بودن صفحه و تعامل اخیر ثبت می‌شود و تخمینی است. داده‌ها حداکثر ۹۱ روز نگهداری می‌شوند. ساعت گزارش: تهران.</p>
    </>}
  </section>;
}
