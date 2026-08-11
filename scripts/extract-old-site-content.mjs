import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.OLD_SITE_URL || 'http://localhost/';
const outputPath = path.resolve('docs/old-site-content-audit.md');
const strategyPath = path.resolve('docs/old-site-content-strategy.md');
const baseOrigin = new URL(baseUrl).origin;

const normalizeUrl = (value) => {
  const url = new URL(value, baseUrl);
  url.hash = '';
  url.pathname = url.pathname.replace(/\/{2,}/g, '/');
  return url.href;
};

const decodeEntities = (value = '') => value
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#039;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const stripHtml = (html = '') => decodeEntities(html)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<\/(h[1-6]|p|li|div|section|article|br|tr)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/[ \t]{2,}/g, ' ')
  .trim();

const safeFetchText = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, status: response.status, finalUrl: response.url, text: '' };
    return { ok: true, status: response.status, finalUrl: response.url, text: await response.text() };
  } catch (error) {
    return { ok: false, status: 0, finalUrl: String(url), text: String(error?.message || error) };
  }
};

const safeFetchJson = async (url) => {
  const result = await safeFetchText(url);
  if (!result.ok) return [];
  try {
    return JSON.parse(result.text);
  } catch {
    return [];
  }
};

const titleFromHtml = (html) => decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim());

const extractLinks = (html, sourceUrl) => {
  const links = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(decodeEntities(match[1]), sourceUrl);
      if (url.origin !== baseOrigin) continue;
      if (url.hash) url.hash = '';
      if (/\/wp-(content|admin|json)\//i.test(url.pathname)) continue;
      const text = stripHtml(match[2]);
      links.push({ text, url: normalizeUrl(url.href) });
    } catch {
      // Ignore malformed links from page builders.
    }
  }
  return Array.from(new Map(links.map((item) => [item.url, item])).values());
};

const extractImages = (html, sourceUrl) => {
  const images = [];
  for (const match of html.matchAll(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
    const tag = match[0];
    try {
      const src = new URL(decodeEntities(match[1]), sourceUrl).href;
      const alt = decodeEntities(tag.match(/\balt=["']([^"']*)["']/i)?.[1] || '').trim();
      images.push({ alt, src });
    } catch {
      // Ignore malformed image URLs.
    }
  }
  return Array.from(new Map(images.map((item) => [item.src, item])).values());
};

const summarizeText = (text, limit = 1800) => {
  const normalized = text.replace(/\n{3,}/g, '\n\n').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit).trim()}...` : normalized;
};

const wpPosts = await safeFetchJson(new URL('/wp-json/wp/v2/posts?per_page=100', baseUrl));
const wpPages = await safeFetchJson(new URL('/wp-json/wp/v2/pages?per_page=100', baseUrl));
const wpMedia = await safeFetchJson(new URL('/wp-json/wp/v2/media?per_page=100', baseUrl));
const home = await safeFetchText(baseUrl);
const homeLinks = home.ok ? extractLinks(home.text, baseUrl) : [];
const homeImages = home.ok ? extractImages(home.text, baseUrl) : [];
const productLinks = homeLinks.filter((link) => link.url.includes('/product/'));

const crawlCandidates = [
  ...homeLinks,
  ...wpPosts.map((post) => ({ text: stripHtml(post.title?.rendered || ''), url: post.link })),
  ...wpPages.map((page) => ({ text: stripHtml(page.title?.rendered || ''), url: page.link })),
].filter((item) => item.url);

const uniqueCandidates = Array.from(new Map(crawlCandidates.map((item) => [item.url, item])).values())
  .filter((item) => !item.url.includes('/wp-json/'))
  .slice(0, 40);

const crawledPages = [];
for (const item of uniqueCandidates) {
  const result = await safeFetchText(item.url);
  const finalUrl = result.finalUrl ? normalizeUrl(result.finalUrl) : normalizeUrl(item.url);
  const requestedUrl = normalizeUrl(item.url);
  if (!result.ok) {
    crawledPages.push({ ...item, url: requestedUrl, finalUrl, redirected: finalUrl !== requestedUrl, ok: false, status: result.status, title: item.text || item.url, text: '' });
    continue;
  }
  crawledPages.push({
    ...item,
    url: requestedUrl,
    finalUrl,
    redirected: finalUrl !== requestedUrl,
    ok: true,
    status: result.status,
    title: titleFromHtml(result.text) || item.text || item.url,
    text: stripHtml(result.text),
    images: extractImages(result.text, item.url),
    links: extractLinks(result.text, item.url),
  });
}

const posts = wpPosts.map((post) => ({
  title: stripHtml(post.title?.rendered || ''),
  date: post.date?.slice(0, 10) || '',
  link: post.link,
  excerpt: stripHtml(post.excerpt?.rendered || ''),
  content: stripHtml(post.content?.rendered || ''),
}));

const pages = wpPages.map((page) => ({
  title: stripHtml(page.title?.rendered || ''),
  date: page.modified?.slice(0, 10) || '',
  link: page.link,
  content: stripHtml(page.content?.rendered || ''),
}));

const allImages = [
  ...homeImages,
  ...crawledPages.flatMap((page) => page.images || []),
  ...wpMedia.map((media) => ({
    alt: stripHtml(media.alt_text || media.title?.rendered || ''),
    src: media.source_url,
  })).filter((media) => media.src),
];
const uniqueImages = Array.from(new Map(allImages.map((item) => [item.src, item])).values());

const productPages = crawledPages.filter((page) => page.url.includes('/product/') && page.finalUrl.includes('/product/'));
const redirectedProductPages = crawledPages.filter((page) => page.url.includes('/product/') && !page.finalUrl.includes('/product/'));
const articlePages = crawledPages.filter((page) => !page.url.includes('/product/') && !page.url.endsWith('/about-us/') && page.url !== baseUrl);
const articleTitles = posts.map((post) => post.title).filter(Boolean);

const report = `# استخراج محتوای سایت قبلی Skill Up

منبع بررسی: ${baseUrl}

تاریخ استخراج: 2026-07-09

## خلاصه مدیریتی

سایت قبلی با محور «آموزش هوش مصنوعی برای همه» ساخته شده است. پیام اصلی آن ساده، عمومی و مناسب جذب لید است: یادگیری کاربردی AI برای کار، تحصیل، تولید محتوا، اتوماسیون و افزایش بهره‌وری. این محتوا برای نسخه جدید Skill Up ارزش زیادی دارد، اما باید با مخاطب فعلی یعنی والدین، دانش‌آموزان و نوجوانان 8 تا 17 سال بازنویسی و بخش‌بندی شود.

## پیام‌ها و عبارت‌های کلیدی استخراج‌شده

- آموزش هوش مصنوعی برای همه، از هر جا
- با آینده دنیا همراه شو
- دوره رایگان
- آموزش پروژه‌محور
- مدرک معتبر
- دوره کارآموزی و استخدام
- آموزشی پویا بدون خستگی
- دوره جامع هوش مصنوعی برای همه
- یادگیری کاربردی، ساده و بدون اصطلاحات پیچیده
- افزایش بهره‌وری، تولید محتوا، ایده‌سازی و حل مسئله با AI

## صفحه اصلی

عنوان مرورگر: ${home.ok ? titleFromHtml(home.text) : 'در دسترس نبود'}

متن استخراج‌شده از صفحه اصلی:

${home.ok ? summarizeText(stripHtml(home.text), 3000) : 'صفحه اصلی خوانده نشد.'}

## لینک‌های مهم صفحه اصلی

${homeLinks.length ? homeLinks.map((link) => `- ${link.text || '(بدون متن)'}: ${link.url}`).join('\n') : '- لینکی استخراج نشد.'}

## دوره‌ها / محصول‌ها

${productPages.length ? productPages.map((page) => `### ${page.title}

URL: ${page.url}

${summarizeText(page.text, 2600)}
`).join('\n') : `در سایت صفحه اصلی لینک محصول وجود دارد، اما در لوکال این لینک‌ها به صفحه اصلی redirect می‌شوند و محتوای واقعی محصول قابل استخراج نبود.

لینک‌های محصول شناسایی‌شده:

${productLinks.length ? productLinks.map((link) => `- ${link.text || '(بدون متن لینک)'}: ${link.url}`).join('\n') : '- لینک محصولی در صفحه اصلی پیدا نشد.'}

صفحه‌های محصولی که redirect شدند:

${redirectedProductPages.length ? redirectedProductPages.map((page) => `- ${page.url} → ${page.finalUrl}`).join('\n') : '- موردی ثبت نشد.'}`}

## نوشته‌ها / مقاله‌ها از REST API وردپرس

${posts.length ? posts.map((post) => `### ${post.title}

- تاریخ: ${post.date}
- لینک: ${post.link}

خلاصه:

${post.excerpt || summarizeText(post.content, 700)}

متن پاک‌سازی‌شده:

${summarizeText(post.content, 2600)}
`).join('\n') : 'مقاله‌ای از REST API استخراج نشد.'}

## برگه‌ها از REST API وردپرس

${pages.length ? pages.map((page) => `### ${page.title}

- آخرین ویرایش: ${page.date}
- لینک: ${page.link}

${summarizeText(page.content, 2200)}
`).join('\n') : 'برگه‌ای از REST API استخراج نشد.'}

## تصاویر و دارایی‌های قابل استفاده

${uniqueImages.length ? uniqueImages.slice(0, 80).map((image) => `- ${image.alt || '(بدون alt)'}: ${image.src}`).join('\n') : '- تصویری استخراج نشد.'}

## ایده‌های پیشنهادی برای استفاده در سایت جدید Skill Up

### 1. تبدیل «آموزش هوش مصنوعی برای همه» به مسیر مخصوص نوجوانان

پیام سایت قبلی عمومی است. در سایت جدید بهتر است این پیام به «AI Creator برای نوجوانان» تبدیل شود: نوجوان یاد می‌گیرد با AI محتوا بسازد، ایده‌پردازی کند، ارائه بسازد، پروژه انجام دهد و اخلاق استفاده از هوش مصنوعی را بفهمد.

### 2. استفاده از «دوره رایگان» به عنوان آهنربای جذب والدین

یک دوره رایگان کوتاه داخل LMS بسازید با عنوان پیشنهادی «شروع هوش مصنوعی برای نوجوانان». والدین شماره تماس ثبت کنند، نوجوان وارد پنل شود و 2 تا 3 ویدئوی رایگان ببیند. بعد مسیر ثبت‌نام به دوره اصلی فعال شود.

### 3. تبدیل مقالات قدیمی به مجله تستی فعلی

مقاله‌های اتوماسیون، ساخت ویدیو با AI، ابزارهای کسب‌وکار و درآمدزایی را نگه دارید، اما لحن آن‌ها را برای والدین و نوجوانان بازنویسی کنید. مثال: «ساخت ویدیو با هوش مصنوعی» تبدیل شود به «نوجوان شما چطور با AI یک ویدیوی خلاقانه می‌سازد؟».

### 4. ساخت بخش نمونه‌کارهای AI کنار پروژه‌های Scratch

در سایت جدید فقط پروژه‌های Scratch دیده می‌شوند. از محتوای «نمونه کارهای تولید شده با AI» سایت قبلی می‌شود یک تب جدید ساخت: پروژه‌های بازی‌سازی، پروژه‌های AI، پروژه‌های رسانه خلاق.

### 5. بازنویسی بخش درباره ما

متن درباره ما سایت قبلی خوب است اما عمومی است. نسخه جدید باید تأکید کند Skill Up فقط آموزش ابزار نیست؛ مسیر پروژه‌محور، مربی، ارزیابی، مهارت نرم و پورتفولیو دارد.

### 6. استفاده از مزیت‌ها در کارت‌های اعتماد

عبارت‌های «پروژه‌محور»، «مدرک معتبر»، «کارآموزی»، «آموزش بدون خستگی» برای کارت‌های اعتماد صفحه اصلی مناسب‌اند. پیشنهاد من: کنار فرم مشاوره والدین چهار کارت کوچک با همین پیام‌ها قرار بگیرد.

### 7. اضافه کردن محتوای AI به داشبورد هنرجو

در پنل هنرجو برای مسیر AI Creator چند تمرین هفتگی تعریف شود: پرامپت‌نویسی، ساخت تصویر، ساخت سناریو، ساخت ویدیو، ارائه پروژه. این دقیقاً با محتوای قبلی سایت هم‌راستا است.

### 8. تفکیک مخاطب والدین و نوجوانان

محتوای قبلی برای «همه افراد» نوشته شده. در سایت جدید هر محتوا بهتر است دو لایه داشته باشد: توضیح اطمینان‌بخش برای والدین، خروجی جذاب و پروژه‌محور برای نوجوان.

## اولویت اجرایی پیشنهادی

1. اضافه کردن دوره رایگان AI به لیست دوره‌های سایت جدید.
2. اضافه کردن 3 مقاله تستی واقعی از همین محتوا به بخش مجله.
3. افزودن تب «پروژه‌های AI» در پروژه‌های نوجوانان.
4. بازنویسی Hero صفحه اصلی با یک جمله مکمل از سایت قبلی: «هوش مصنوعی، مهارتی که آینده نوجوانت را می‌سازد».
5. ساخت صفحه مسیر AI Creator با تمرین‌های هفتگی و badge.

## صفحات Crawl شده

${crawledPages.map((page) => `- ${page.ok ? 'OK' : `ERROR ${page.status}`} ${page.redirected ? `(Redirected to ${page.finalUrl})` : ''} | ${page.title}: ${page.url}`).join('\n')}
`;

await writeFile(outputPath, report, 'utf8');

const strategy = `# خلاصه قابل استفاده از محتوای سایت قبلی برای سایت جدید Skill Up

منبع: ${baseUrl}

تاریخ استخراج: 2026-07-09

## نتیجه سریع

محتوای سایت قبلی ارزشمند است، اما برای سایت جدید باید از حالت «AI برای همه» به «مسیر مهارت‌آموزی نوجوانان با AI» تبدیل شود. بهترین استفاده فوری از این محتوا در سه بخش است: مجله، دوره AI Creator، و کارت‌های اعتماد صفحه اصلی.

## محتوای قابل انتقال مستقیم

### پیام‌های مناسب صفحه اصلی

- هوش مصنوعی، مهارتی که آینده را می‌سازد.
- آموزش پروژه‌محور، ساده و قابل اجرا.
- یادگیری AI برای تولید محتوا، ایده‌سازی و حل مسئله.
- دوره رایگان به عنوان شروع مسیر.
- آموزش پویا و بدون خستگی.

### محتوای مناسب دوره‌ها

- دوره رایگان: «شروع هوش مصنوعی برای نوجوانان»
- مسیر اصلی: «AI Creator»
- تمرین‌های پیشنهادی: پرامپت‌نویسی، ساخت تصویر، ساخت سناریو، تبدیل متن به ویدیو، ارائه پروژه AI.

### مقالات مناسب برای مجله سایت جدید

${articleTitles.length ? articleTitles.map((title) => `- ${title}`).join('\n') : '- مقاله‌ای از REST API استخراج نشد.'}

## وضعیت محصول‌ها

لینک محصول در صفحه اصلی وجود دارد، اما در نسخه لوکال XAMPP به صفحه اصلی redirect می‌شود. برای استخراج کامل محصول‌ها باید یکی از این کارها انجام شود:

1. permalink ووکامرس/وردپرس در XAMPP دوباره ذخیره شود.
2. افزونه WooCommerce فعال و REST محصول‌ها expose شود.
3. از دیتابیس WordPress جدول‌های محصول export گرفته شود.

لینک‌های محصول دیده‌شده:

${productLinks.length ? productLinks.map((link) => `- ${link.text || '(بدون متن لینک)'}: ${link.url}`).join('\n') : '- محصولی پیدا نشد.'}

## پیشنهاد تغییرات برای سایت جدید

### Hero

جمله فعلی سایت جدید را با این پیام مکمل قوی‌تر کنید:

«هوش مصنوعی، بازی‌سازی و مهارت‌های ارتباطی؛ مسیر پروژه‌محور نوجوان شما برای ساخت آینده.»

### مسیر AI Creator

برای Level 3 یا یک مسیر مستقل، محتوای قدیمی AI را تبدیل کنید به یک نقشه 6 هفته‌ای:

1. آشنایی با AI و اخلاق استفاده
2. پرامپت‌نویسی برای نوجوانان
3. ساخت تصویر و پوستر
4. ساخت سناریو و ویدیو
5. ارائه پروژه با AI
6. ساخت پروژه نهایی و انتشار در پورتفولیو

### مجله

مقاله‌های قبلی فعلاً به صورت تستی در سایت جدید قرار بگیرند، اما تیترها کودک/نوجوان‌محور شوند. مثال:

- «آموزش ساخت ویدیو با AI» → «نوجوان شما چطور با AI یک ویدیوی خلاقانه می‌سازد؟»
- «اتوماسیون هوشمند چیست؟» → «AI چطور کارهای تکراری را برای دانش‌آموز ساده‌تر می‌کند؟»
- «بهترین ابزارهای رایگان تولید محتوا» → «ابزارهای امن و رایگان AI برای پروژه‌های مدرسه»

### پروژه‌ها

در صفحه پروژه‌های نوجوانان، یک فیلتر جدید اضافه شود:

- بازی‌سازی
- هوش مصنوعی
- رسانه خلاق

برای پروژه‌های AI از تصاویر و ایده‌های سایت قبلی مثل ساخت تصویر، اینفوگرافیک، ویدیو، زیرنویس و سناریو استفاده شود.

### پنل هنرجو

داخل داشبورد، برای دوره AI Creator بخش «تمرین هفته» اضافه شود. هر تمرین خروجی قابل آپلود داشته باشد: تصویر، متن پرامپت، لینک ویدیو، یا فایل ارائه.

### پنل ادمین

برای مدیر یک فیلد دسته‌بندی پروژه اضافه شود تا پروژه‌ها فقط محدود به Scratch نباشند. دسته‌ها مطابق سه خدمت اصلی باشند: AI، بازی‌سازی، فن بیان/ارائه.

## اولویت اجرا

1. اضافه کردن 3 مقاله تستی از محتوای قدیمی به داده‌های مجله.
2. اضافه کردن دوره رایگان AI به لیست دوره‌ها.
3. اضافه کردن فیلتر پروژه‌های AI در پروژه‌های نوجوانان.
4. بازنویسی متن Hero با پیام AI سایت قبلی.
5. اضافه کردن تمرین‌های AI Creator به داشبورد.

## فایل کامل

گزارش کامل استخراج محتوا در این فایل است:

\`docs/old-site-content-audit.md\`
`;

await writeFile(strategyPath, strategy, 'utf8');
console.log(`Wrote ${outputPath}`);
console.log(`Wrote ${strategyPath}`);
