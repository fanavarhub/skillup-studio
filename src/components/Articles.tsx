import { useEffect } from 'react';
import { ExternalLink, Calendar, User } from 'lucide-react';

export default function Articles({ navigate }: { navigate: (tab: string) => void }) {
  useEffect(() => {
    const previousTitle = document.title;
    const description = document.head.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content');
    let canonical = document.head.querySelector('link[rel="canonical"]');
    const createdCanonical = !canonical;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    const previousCanonical = canonical.getAttribute('href');
    document.title = 'مجله اسکیل آپ | آموزش برنامه‌نویسی و مهارت‌های دیجیتال نوجوانان';
    description?.setAttribute('content', 'مقاله‌ها و راهنماهای کاربردی اسکیل آپ برای آموزش برنامه‌نویسی، اسکرچ، هوش مصنوعی و مهارت‌های دیجیتال کودکان و نوجوانان.');
    canonical.setAttribute('href', 'https://skill-up.ir/magazine');
    return () => {
      document.title = previousTitle;
      if (previousDescription !== null && previousDescription !== undefined) description?.setAttribute('content', previousDescription);
      if (createdCanonical) canonical?.remove();
      else if (previousCanonical) canonical?.setAttribute('href', previousCanonical);
    };
  }, []);

  const mockArticles = [
    {
      id: 'download-scratch',
      title: 'دانلود اسکرچ برای ویندوز و اندروید + آموزش نصب',
      excerpt: 'دانلود مستقیم نسخه ویندوز و اندروید، لینک رسمی Google Play و آموزش نصب قدم‌به‌قدم برای شروع دوره اسکرچ.',
      date: '۱۴۰۵/۰۶/۰۵',
      author: 'تیم آموزش اسکیل آپ',
      cover: '/assets/scratch-download-cover.svg',
      tab: 'scratch-download',
    },
    {
      id: 1,
      title: 'چرا اسکرچ (Scratch) بهترین زبان برای شروع برنامه‌نویسی کودکان است؟',
      excerpt: 'بررسی علمی چگونگی تقویت تفکر الگوریتمی، ریاضیات بازی و حل مسئله در نوجوانان با استفاده از برنامه‌نویسی بلوکی.',
      date: '۱۴۰۵/۰۴/۰۵',
      author: 'مهندس رضایی (منتور ارشد)',
      cover: '/assets/legacy/unsplash-1607604276583-eef5d076aa5f-q60.jpg',
      tab: '',
    },
    {
      id: 2,
      title: 'نقش هوش مصنوعی در آینده شغلی نسل جدید (Future Makers)',
      excerpt: 'کودکانی که امروز چگونگی کار با مدل‌های هوشمند، پرامپت‌نویسی درست و تحلیل داده را آموزش می‌بینند، فردا رهبران خلاق تکنولوژی خواهند بود.',
      date: '۱۴۰۵/۰۳/۲۸',
      author: 'دکتر حسینی (روانشناس تربیتی)',
      cover: '/assets/service-ai-robot.webp',
      tab: '',
    },
    {
      id: 3,
      title: 'چطور فن بیان و مهارت ارائه خلاق را در نوجوانان تقویت کنیم؟',
      excerpt: 'آموزش برنامه‌نویسی بدون داشتن اعتمادبه‌نفس دفاع از پروژه ناقص است. راهکارهای طلایی برای غلبه بر خجالت و داشتن سخنرانی‌های پرقدرت.',
      date: '۱۴۰۵/۰۳/۱۵',
      author: 'استاد علوی (منتور توسعه فردی)',
      cover: '/assets/legacy/unsplash-1475721027785-f74eccf877e2-q60.jpg',
      tab: '',
    }
  ];

  return (
    <section className="py-20 bg-white" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className="text-right max-w-2xl mb-12 space-y-2">
          <span className="text-indigo-600 font-sans font-bold text-xs uppercase block">📰 مجله دانستنی‌های تکنولوژی اسکیل آپ</span>
          <h2 className="font-sans text-3xl font-extrabold text-gray-950">مقاله‌های آموزشی نوجوانان و والدین</h2>
          <p className="font-sans text-xs text-gray-500">مجموعه مقالات تخصصی منتوران اسکیل آپ در جهت پرورش خلاقیت مهارتی، سواد دیجیتال و تربیت نوجوانان آماده برای فردا.</p>
        </div>

        {/* Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {mockArticles.map((art) => (
            <article
              key={art.id}
              className="bg-gray-50 rounded-3xl border border-gray-100 overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between text-right"
            >
              {/* Cover Image */}
              <div className="h-48 overflow-hidden bg-slate-900">
                <img
                  src={art.cover}
                  alt={art.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-95 hover:scale-103 transition-all duration-300"
                />
              </div>

              {/* Card Body */}
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  {/* Meta date / author */}
                  <div className="flex items-center gap-4 text-gray-400 text-[10px] font-sans">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{art.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{art.author}</span>
                    </div>
                  </div>

                  <h3 className="font-sans font-extrabold text-gray-950 text-base leading-snug hover:text-indigo-600 transition-all">
                    {art.title}
                  </h3>
                  <p className="font-sans text-xs text-gray-500 leading-relaxed">
                    {art.excerpt}
                  </p>
                </div>

                {/* Read more button link */}
                <div className="border-t border-gray-100/80 pt-4 mt-6">
                  {art.tab ? <a href="/magazine/download-scratch" onClick={(event) => { event.preventDefault(); navigate(art.tab); }} className="font-sans text-xs font-bold inline-flex items-center gap-1.5 text-indigo-600 hover:underline" aria-label={`مطالعه مقاله ${art.title}`}><span>مطالعه کامل مقاله</span><ExternalLink className="w-3.5 h-3.5" /></a> : <span className="font-sans inline-flex cursor-not-allowed items-center gap-1.5 text-xs font-bold text-slate-400"><span>مطالعه کامل مقاله</span><ExternalLink className="w-3.5 h-3.5" /></span>}
                </div>
              </div>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
}
