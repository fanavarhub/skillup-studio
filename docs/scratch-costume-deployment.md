# انتشار مقاله کاستیوم اسکرچ

مقاله در `/magazine/scratch-costume-animation`، فهرست مجله و `/sitemap.xml` قرار دارد. صفحه و فایل‌هایش با سرویس فعلی `skillup` ساخته می‌شوند.

## Ubuntu و Docker

در پوشهٔ واقعی پروژه روی سرور، پس از ادغام Pull Request:

```bash
git switch main
git pull --ff-only origin main
docker compose build skillup
```

برای فعال کردن دیدگاه‌ها، رمز جداگانه بسازید (`openssl rand -hex 32`) و آن را در فایل خصوصی `.env` به‌عنوان `SCRATCH_LESSON_ADMIN_TOKEN` قرار دهید. با تنظیم پیش‌فرض سایت، `PUBLIC_BASE_URL=https://skill-up.ir` باشد. اگر Nginx مطابق نمونهٔ پروژه خودش هدر `X-Real-IP` را تنظیم می‌کند، برای محدودیت ارسال بر اساس IP مقدار `SCRATCH_LESSON_TRUST_PROXY=1` را بگذارید. دیدگاه‌های جدید تا تأیید مدیر عمومی نمی‌شوند. پنل بررسی در `/magazine/scratch-costume-animation/moderation` است. اگر رمز تنظیم نشود، صفحه و ویدیو در دسترس‌اند و ارسال دیدگاه غیرفعال است.

داده‌های مقاله در `data/scratch-comments.sqlite` و همان پوشهٔ ماندگار پروژه نگهداری می‌شود. از داده‌های فعلی طبق راهنمای استقرار پروژه پشتیبان بگیرید. سپس اجرا کنید:

```bash
docker compose up -d --no-deps skillup
docker compose ps
curl -fsS http://127.0.0.1:4050/api/health
curl -fsS -o /dev/null -w '%{http_code}\n' https://skill-up.ir/magazine/scratch-costume-animation
curl -fsS https://skill-up.ir/sitemap.xml | grep -F '/magazine/scratch-costume-animation'
```

همچنین کارت مقاله را در `/magazine` باز کنید و نمایش ویدیو، تمرین و در صورت فعال‌سازی، ارسال و تأیید دیدگاه را بررسی کنید. نقشهٔ اختصاصی ویدیو در `/magazine/scratch-costume-animation/video-sitemap.xml` در دسترس است.
