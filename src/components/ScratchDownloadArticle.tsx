import { useEffect } from 'react';
import { motion } from 'motion/react';
import MagazineComments from './MagazineComments';
import {
  ArrowLeft, BookOpen, Cat, CheckCircle2, Chrome, CircleHelp, CloudDownload,
  ExternalLink, Gamepad2, Laptop, MonitorDown, Play, Rocket, ShieldCheck,
  Smartphone, Sparkles, Tablet, WifiOff,
} from 'lucide-react';

const articlePath = '/magazine/download-scratch';
const playStoreUrl = 'https://play.google.com/store/apps/details?id=org.scratch';
const scratchOnlineUrl = 'https://scratch.mit.edu/projects/editor/';

const faqs = [
  ['آیا دانلود و استفاده از اسکرچ رایگان است؟', 'بله. اسکرچ رایگان است و می‌توانی نسخه مناسب دستگاهت را نصب کنی یا مستقیماً از ویرایشگر آنلاین استفاده کنی.'],
  ['نسخه رسمی Google Play روی موبایل نصب می‌شود؟', 'برنامه رسمی Scratch برای تبلت‌های اندرویدی و Chromebook طراحی شده است. ممکن است Google Play نصب آن را روی بعضی گوشی‌ها ارائه نکند یا رابط برنامه روی نمایشگر کوچک مناسب نباشد.'],
  ['نسخه آنلاین بهتر است یا نسخه نصب‌شده؟', 'برای تمرین بدون اینترنت، نسخه نصب‌شده مناسب‌تر است. نسخه آنلاین برای دسترسی سریع، ذخیره در حساب Scratch و اشتراک‌گذاری پروژه‌ها کاربرد دارد.'],
  ['اگر هنگام نصب خطا دیدم چه کار کنم؟', 'نسخه مناسب دستگاهت را انتخاب کن، از خطا تصویر بگیر و از داخل پنل یا کانال پشتیبانی اسکیل‌آپ برای ما بفرست. برای نصب فایل APK از یک بزرگ‌تر کمک بگیر.'],
];

function useArticleSeo() {
  useEffect(() => {
    const previousTitle = document.title;
    const cleanups: Array<() => void> = [];
    const setMeta = (selector: string, attributes: Record<string, string>, tag = 'meta') => {
      let element = document.head.querySelector(selector) as HTMLElement | null;
      const created = !element;
      if (!element) {
        element = document.createElement(tag);
        document.head.appendChild(element);
      }
      const previous = new Map<string, string | null>();
      Object.entries(attributes).forEach(([key, value]) => {
        previous.set(key, element!.getAttribute(key));
        element!.setAttribute(key, value);
      });
      cleanups.push(() => {
        if (created) element?.remove();
        else previous.forEach((value, key) => value === null ? element?.removeAttribute(key) : element?.setAttribute(key, value));
      });
    };

    document.title = 'دانلود اسکرچ برای ویندوز و اندروید + آموزش نصب | اسکیل آپ';
    setMeta('meta[name="description"]', { name: 'description', content: 'دانلود مستقیم اسکرچ برای ویندوز و اندروید، لینک رسمی Google Play و آموزش نصب قدم‌به‌قدم برای کودکان و نوجوانان.' });
    setMeta('meta[name="robots"]', { name: 'robots', content: 'index, follow, max-image-preview:large' });
    setMeta('link[rel="canonical"]', { rel: 'canonical', href: `https://skill-up.ir${articlePath}` }, 'link');
    setMeta('meta[property="og:type"]', { property: 'og:type', content: 'article' });
    setMeta('meta[property="og:title"]', { property: 'og:title', content: 'دانلود اسکرچ برای ویندوز و اندروید + آموزش نصب' });
    setMeta('meta[property="og:description"]', { property: 'og:description', content: 'نسخه مناسب اسکرچ را دانلود کن و قدم‌به‌قدم برای شروع برنامه‌نویسی آماده شو.' });
    setMeta('meta[property="og:url"]', { property: 'og:url', content: `https://skill-up.ir${articlePath}` });
    setMeta('meta[property="og:image"]', { property: 'og:image', content: 'https://skill-up.ir/assets/scratch-download-cover.svg' });
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: 'دانلود اسکرچ + آموزش نصب | اسکیل آپ' });
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: 'دانلود مستقیم نسخه ویندوز و اندروید اسکرچ همراه با راهنمای نصب.' });

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.pageSchema = 'scratch-download';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Article',
          headline: 'دانلود اسکرچ برای ویندوز و اندروید + آموزش نصب',
          description: 'دانلود مستقیم اسکرچ، لینک رسمی Google Play و آموزش نصب قدم‌به‌قدم برای کودکان و نوجوانان.',
          inLanguage: 'fa-IR',
          datePublished: '2026-08-27',
          dateModified: '2026-08-27',
          mainEntityOfPage: `https://skill-up.ir${articlePath}`,
          image: 'https://skill-up.ir/assets/scratch-download-cover.svg',
          author: { '@type': 'Organization', name: 'اسکیل آپ', url: 'https://skill-up.ir/' },
          publisher: { '@type': 'Organization', name: 'اسکیل آپ', url: 'https://skill-up.ir/' },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'خانه', item: 'https://skill-up.ir/' },
            { '@type': 'ListItem', position: 2, name: 'مجله اسکیل آپ', item: 'https://skill-up.ir/magazine' },
            { '@type': 'ListItem', position: 3, name: 'دانلود اسکرچ', item: `https://skill-up.ir${articlePath}` },
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: faqs.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })),
        },
      ],
    });
    document.head.appendChild(script);
    return () => {
      document.title = previousTitle;
      script.remove();
      cleanups.reverse().forEach((cleanup) => cleanup());
    };
  }, []);
}

const steps = [
  ['فایل را دانلود کن', 'نسخه مناسب ویندوز یا اندروید را از همین صفحه دریافت کن.'],
  ['فایل دانلودشده را باز کن', 'در ویندوز روی فایل دوبار کلیک کن؛ در اندروید فایل APK را از بخش دانلودها باز کن.'],
  ['اجازه نصب را بررسی کن', 'اگر دستگاه اجازه خواست، متن پیام را با دقت بخوان و در اندروید از یک بزرگ‌تر کمک بگیر.'],
  ['اولین پروژه را بساز', 'اسکرچ را باز کن، زبان دلخواهت را انتخاب کن و شخصیت گربه را حرکت بده!'],
];

export default function ScratchDownloadArticle({ navigate }: { navigate: (tab: string) => void }) {
  useArticleSeo();

  return <article className="overflow-hidden bg-[#fbfaff] text-slate-950" dir="rtl">
    <header className="relative isolate overflow-hidden px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_15%_20%,#fde68a_0,transparent_28%),radial-gradient(circle_at_85%_15%,#ddd6fe_0,transparent_30%),linear-gradient(180deg,#fff_0%,#f5f3ff_100%)]" />
      <div className="absolute left-[6%] top-24 -z-10 h-20 w-20 rounded-[28px] bg-amber-300/35 rotate-12" />
      <div className="absolute right-[8%] top-10 -z-10 h-28 w-28 rounded-full bg-violet-300/25" />
      <div className="mx-auto max-w-6xl">
        <nav aria-label="مسیر صفحه" className="mb-6 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
          <button onClick={() => navigate('home')} className="hover:text-violet-700">خانه</button><span>/</span>
          <button onClick={() => navigate('articles')} className="hover:text-violet-700">مجله اسکیل آپ</button><span>/</span>
          <span className="text-violet-700">دانلود اسکرچ</span>
        </nav>

        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-4 py-2 text-xs font-black text-violet-700 shadow-sm"><Sparkles className="h-4 w-4 text-amber-500" />راهنمای شروع برنامه‌نویسی با اسکرچ</span>
            <h1 className="mt-5 text-3xl font-black leading-[1.45] tracking-tight sm:text-5xl lg:text-[3.5rem]">دانلود اسکرچ برای <span className="text-violet-700">ویندوز و اندروید</span> + آموزش نصب</h1>
            <p className="mt-5 max-w-2xl text-sm font-medium leading-8 text-slate-600 sm:text-base">نسخه مناسب دستگاهت را انتخاب کن، اسکرچ را قدم‌به‌قدم نصب کن و اولین بازی، انیمیشن یا داستان تعاملی خودت را بساز.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href="#download-scratch" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-violet-700 to-indigo-600 px-6 text-sm font-black text-white shadow-xl shadow-violet-200 transition hover:-translate-y-1"><CloudDownload className="h-5 w-5" />انتخاب نسخه دانلود</a>
              <a href="#install-scratch" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-violet-100 bg-white px-6 text-sm font-black text-violet-700 transition hover:border-violet-300"><Play className="h-5 w-5" />آموزش نصب</a>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-500"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-500" />فایل ویندوز دارای امضای معتبر</span><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-sky-500" />دانلود رایگان</span></div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: .94, rotate: 2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: .55 }} className="relative mx-auto w-full max-w-lg">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[38px] border-[6px] border-white bg-gradient-to-br from-violet-700 via-indigo-600 to-sky-500 p-6 shadow-[0_30px_70px_rgba(79,70,229,.25)] sm:p-8">
              <div className="absolute -left-5 -top-7 h-36 w-36 rounded-full bg-fuchsia-400/35 blur-2xl" />
              <div className="relative rounded-[26px] bg-white/95 p-5 shadow-2xl">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3"><span className="h-3 w-3 rounded-full bg-rose-400"/><span className="h-3 w-3 rounded-full bg-amber-400"/><span className="h-3 w-3 rounded-full bg-emerald-400"/><span className="mr-auto text-[10px] font-black text-slate-400">اولین بازی من.sb3</span></div>
                <div className="mt-4 grid grid-cols-[1fr_1.1fr] gap-3">
                  <div className="space-y-2"><div className="rounded-xl bg-blue-500 p-2 text-[10px] font-black text-white">۱۰ قدم حرکت کن</div><div className="rounded-xl bg-amber-400 p-2 text-[10px] font-black text-slate-900">وقتی پرچم کلیک شد</div><div className="rounded-xl bg-fuchsia-500 p-2 text-[10px] font-black text-white">سلام! را بگو</div></div>
                  <div className="grid place-items-center rounded-2xl bg-gradient-to-br from-sky-50 to-violet-100"><Cat className="h-20 w-20 text-orange-500 drop-shadow-md sm:h-28 sm:w-28" strokeWidth={2.2}/></div>
                </div>
              </div>
              <span className="absolute bottom-4 left-5 rounded-full bg-amber-300 px-4 py-2 text-xs font-black text-violet-950 shadow-lg">ایده‌ات را بساز! 🚀</span>
            </div>
          </motion.div>
        </div>
      </div>
    </header>

    <section className="px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="text-center"><span className="inline-flex rounded-full bg-orange-100 px-4 py-2 text-xs font-black text-orange-700">اول اسکرچ را بشناسیم</span><h2 className="mt-4 text-2xl font-black sm:text-4xl">اسکرچ چیست و چه چیزی می‌سازیم؟</h2><p className="mx-auto mt-4 max-w-3xl text-sm leading-8 text-slate-600 sm:text-base">اسکرچ یک محیط برنامه‌نویسی تصویری است. بلوک‌های رنگی را مثل قطعه‌های پازل کنار هم می‌گذاری و بدون درگیر شدن با کدهای پیچیده، منطق برنامه‌نویسی و حل مسئله را یاد می‌گیری.</p></div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[[Gamepad2,'بازی جذاب','bg-violet-100 text-violet-700'],[Play,'انیمیشن','bg-rose-100 text-rose-700'],[BookOpen,'داستان تعاملی','bg-sky-100 text-sky-700'],[Rocket,'پروژه خلاق','bg-amber-100 text-amber-700']].map(([Icon,label,color]) => { const ItemIcon = Icon as typeof Gamepad2; return <div key={label as string} className="rounded-3xl border border-white bg-white p-4 text-center shadow-[0_12px_35px_rgba(15,23,42,.06)]"><span className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${color}`}><ItemIcon className="h-6 w-6"/></span><strong className="mt-3 block text-sm">{label as string}</strong></div>; })}
        </div>
      </div>
    </section>

    <section id="download-scratch" className="scroll-mt-24 bg-slate-950 px-4 py-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center"><span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-black text-violet-200">دانلود اسکرچ</span><h2 className="mt-4 text-2xl font-black sm:text-4xl">نسخه مناسب دستگاهت را انتخاب کن</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-300">برای دوره اسکیل‌آپ، لپ‌تاپ یا کامپیوتر تجربه راحت‌تری دارد. برای اندروید هم دانلود مستقیم و لینک رسمی Google Play در دسترس است.</p></div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <DownloadCard icon={Laptop} title="نسخه ویندوز" text="مناسب لپ‌تاپ و کامپیوتر؛ پیشنهاد اصلی برای انجام تمرین‌ها و پروژه‌های دوره." badge="پیشنهاد اسکیل آپ" tone="violet" actions={[{ label: 'دانلود مستقیم ویندوز', href: '/downloads/scratch-windows.exe', download: true }]} />
          <DownloadCard icon={Tablet} title="نسخه اندروید" text="دانلود مستقیم فایل APK یا نصب نسخه رسمی Scratch Foundation از فروشگاه Google Play." tone="sky" actions={[{ label: 'دانلود مستقیم APK', href: '/downloads/scratch-android.apk', download: true }, { label: 'دریافت از Google Play', href: playStoreUrl, external: true }]} />
          <DownloadCard icon={Chrome} title="اسکرچ آنلاین" text="بدون نصب و از داخل مرورگر پروژه بساز؛ برای ذخیره ابری و اشتراک‌گذاری هم مناسب است." tone="amber" actions={[{ label: 'بازکردن ویرایشگر آنلاین', href: scratchOnlineUrl, external: true }]} />
        </div>
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-xs leading-6 text-amber-100"><Smartphone className="mt-0.5 h-5 w-5 shrink-0"/><p><strong>نکته درباره گوشی:</strong> نسخه رسمی Google Play برای تبلت اندرویدی و Chromebook طراحی شده است. روی گوشی ممکن است نصب در دسترس نباشد یا محیط برنامه روی صفحه کوچک راحت نباشد.</p></div>
      </div>
    </section>

    <section id="install-scratch" className="scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="text-center"><span className="inline-flex rounded-full bg-emerald-100 px-4 py-2 text-xs font-black text-emerald-700">فقط چهار قدم</span><h2 className="mt-4 text-2xl font-black sm:text-4xl">آموزش نصب اسکرچ</h2></div>
        <ol className="mt-9 grid gap-4 md:grid-cols-2">
          {steps.map(([title,text], index) => <li key={title} className="flex gap-4 rounded-3xl border border-violet-100 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,.06)]"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-lg font-black text-white shadow-lg shadow-violet-200">{index + 1}</span><div><h3 className="font-black">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-600">{text}</p></div></li>)}
        </ol>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-violet-100 p-5"><div className="flex items-center gap-3"><MonitorDown className="h-7 w-7 text-violet-700"/><h3 className="font-black">نصب در ویندوز</h3></div><p className="mt-3 text-xs leading-7 text-violet-950">اگر پیام امنیتی ویندوز نمایش داده شد، نام ناشر را بررسی کن. فایل ارائه‌شده در این صفحه با امضای معتبر Massachusetts Institute of Technology شناسایی شده است.</p></div>
          <div className="rounded-3xl bg-sky-100 p-5"><div className="flex items-center gap-3"><WifiOff className="h-7 w-7 text-sky-700"/><h3 className="font-black">نصب فایل APK</h3></div><p className="mt-3 text-xs leading-7 text-sky-950">در بعضی دستگاه‌ها لازم است اجازه نصب از این منبع را فقط برای مرورگر یا فایل‌منیجر فعال کنی. بعد از نصب می‌توانی این اجازه را دوباره غیرفعال کنی.</p></div>
        </div>
      </div>
    </section>

    <section id="faq" className="bg-violet-50 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl"><div className="text-center"><CircleHelp className="mx-auto h-10 w-10 text-violet-600"/><h2 className="mt-3 text-2xl font-black sm:text-4xl">سؤال‌های پرتکرار</h2></div><div className="mt-8 space-y-3">{faqs.map(([question,answer]) => <details key={question} className="group rounded-2xl border border-violet-100 bg-white p-5 shadow-sm"><summary className="cursor-pointer list-none font-black text-slate-900">{question}<span className="float-left text-violet-500 transition group-open:rotate-45">+</span></summary><p className="mt-4 border-t border-slate-100 pt-4 text-xs leading-7 text-slate-600">{answer}</p></details>)}</div></div>
    </section>

    <section className="px-4 py-14 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl overflow-hidden rounded-[34px] bg-gradient-to-l from-violet-700 via-indigo-600 to-sky-500 p-7 text-center text-white shadow-2xl shadow-violet-200 sm:p-12"><Rocket className="mx-auto h-11 w-11 text-amber-300"/><h2 className="mt-4 text-2xl font-black sm:text-4xl">آماده‌ای اولین پروژه‌ات را بسازی؟</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-violet-50">در دوره رایگان اسکرچ اسکیل‌آپ، قدم‌به‌قدم همراهت هستیم تا از نصب برنامه به ساخت یک پروژه واقعی برسی.</p><button onClick={() => navigate('signup')} className="mt-6 inline-flex min-h-13 items-center gap-2 rounded-2xl bg-white px-6 text-sm font-black text-violet-700 shadow-lg transition hover:-translate-y-1">ثبت‌نام در دوره رایگان<ArrowLeft className="h-4 w-4"/></button></div></section>
    <MagazineComments slug="download-scratch" />
  </article>;
}

type DownloadAction = { label: string; href: string; download?: boolean; external?: boolean };

function DownloadCard({ icon: Icon, title, text, badge, tone, actions }: { icon: typeof Laptop; title: string; text: string; badge?: string; tone: 'violet' | 'sky' | 'amber'; actions: DownloadAction[] }) {
  const colors = { violet: 'from-violet-600 to-indigo-600 shadow-violet-950/30', sky: 'from-sky-500 to-cyan-500 shadow-sky-950/30', amber: 'from-amber-400 to-orange-500 shadow-orange-950/30' };
  return <motion.div whileHover={{ y: -6 }} className="relative flex flex-col rounded-[30px] border border-white/10 bg-white/[.07] p-6 backdrop-blur-sm">
    {badge && <span className="absolute -top-3 right-6 rounded-full bg-amber-300 px-3 py-1 text-[10px] font-black text-slate-950">{badge}</span>}
    <span className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${colors[tone]} shadow-lg`}><Icon className="h-7 w-7"/></span>
    <h3 className="mt-5 text-xl font-black">{title}</h3><p className="mt-3 flex-1 text-xs leading-7 text-slate-300">{text}</p>
    <div className="mt-5 space-y-2">{actions.map((action) => <a key={action.label} href={action.href} download={action.download || undefined} target={action.external ? '_blank' : undefined} rel={action.external ? 'noopener noreferrer' : undefined} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-slate-950 transition hover:bg-violet-100"><CloudDownload className="h-4 w-4"/>{action.label}{action.external && <ExternalLink className="h-3.5 w-3.5"/>}</a>)}</div>
  </motion.div>;
}
