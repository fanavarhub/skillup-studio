import { useEffect, useState } from 'react';
import MagazineComments from './MagazineComments';

type Article = { slug: string; title: string };
export default function MagazineCommentsAdmin({ token }: { token: string }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [slug, setSlug] = useState('scratch-costume-animation');
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/magazine/articles', { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'فهرست مقاله‌ها باز نشد.'); return data as Article[]; })
      .then(setArticles).catch(reason => setError(reason instanceof Error ? reason.message : 'فهرست مقاله‌ها باز نشد.'));
  }, [token]);
  return <div className="rounded-3xl bg-white p-4 sm:p-6"><h2 className="text-xl font-black">مدیریت دیدگاه‌های مقاله‌ها</h2><p className="mt-2 text-sm text-slate-600">مقاله را انتخاب کن؛ دیدگاه‌ها و پاسخ‌های همان مقاله را می‌بینی. یک پین الماسی و سه پین طلایی برای هر مقاله در دسترس است.</p><label className="mt-5 block text-sm font-bold" htmlFor="magazine-article-select">انتخاب مقاله</label><select id="magazine-article-select" value={slug} onChange={event => setSlug(event.target.value)} className="mt-2 w-full max-w-lg rounded-xl border border-violet-200 bg-white p-3 text-base">{articles.map(article => <option key={article.slug} value={article.slug}>{article.title}</option>)}</select>{error && <p role="alert" className="mt-3 text-rose-700">{error}</p>}<MagazineComments key={slug} slug={slug} admin adminToken={token} /></div>;
}
