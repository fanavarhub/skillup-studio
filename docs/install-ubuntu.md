# نصب و به‌روزرسانی اسکیل‌آپ روی Ubuntu

مسئول DevOps این دستورات را روی سرور اجرا کند. دسترسی sudo و دسترسی خواندن مخزن خصوصی با حساب یا کلید GitHub خود مسئول DevOps لازم است.

## نصب روی سرور تازه

پیش از اجرا، رکورد DNS دامنهٔ skill-up.ir را روی IP عمومی سرور تنظیم کنید. اگر www را فعال می‌کنید، DNS آن را نیز تنظیم کنید. پورت‌های TCP 80 و 443 باید در فایروال سرور و ارائه‌دهندهٔ VPS باز باشند. پورت داخلی 4050 فقط روی loopback است.

تا زمانی که Pull Request شمارهٔ ۲ ادغام نشده، برای نصب آزمایشی این شاخه را کلون کنید.

    git clone --branch codex/scratch-costume-magazine https://github.com/fanavarhub/skillup-studio.git
    cd skillup-studio
    sudo bash deploy/install-ubuntu.sh

پس از merge می‌توانید دستور clone را با شاخهٔ main اجرا کنید. برای clone به عنوان کاربر عادی وارد GitHub شوید و sudo را فقط برای اجرای اسکریپت به کار ببرید.

اسکریپت دامنه، فعال‌سازی www، ایمیل Let's Encrypt، پذیرش شرایط گواهی، نام کاربری و رمز مدیر، شناسه دورهٔ رایگان و تنظیمات اختیاری GA4 و Search Console را می‌پرسد. رمز مدیر هنگام تایپ روی صفحه نمایش داده نمی‌شود. کلید نشست و رمز مدیریت دیدگاه‌ها به‌صورت تصادفی ساخته و در فایل محلی .env با مجوز 0600 ذخیره می‌شوند. آدرس دامنهٔ فعلی در بخش‌هایی از برنامه ثابت است. برای انتقال به دامنه‌ای دیگر، ابتدا آدرس‌های canonical برنامه را تغییر دهید.

اسکریپت Docker و Compose را در صورت نیاز نصب می‌کند، سرویس را می‌سازد، Nginx و گواهی HTTPS را تنظیم می‌کند و سلامت سرویس و دسترسی به مقاله را بررسی می‌کند. اگر vhost همین دامنه از قبل وجود داشته باشد، مسیر نصب تازه متوقف می‌شود تا پیکربندی موجود جایگزین نشود.

## به‌روزرسانی سرور فعلی

بعد از ادغام Pull Request، در همان پوشه‌ای که کانتینر فعلی از آن اجرا شده است:

    cd "$(sudo docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' skillup-studio)"
    git switch main
    git pull --ff-only origin main
    sudo bash deploy/install-ubuntu.sh --update

برای فعال شدن دیدگاه‌ها روی سرور موجود، قبل از به‌روزرسانی مقدار SCRATCH_LESSON_ADMIN_TOKEN را با یک خروجی openssl rand -hex 32 در فایل .env بگذارید. با تنظیم معمول Nginx پروژه که X-Real-IP را خودش بازنویسی می‌کند، SCRATCH_LESSON_TRUST_PROXY=1 را هم تنظیم کنید. اگر سرور پوشه‌ای متفاوت با کانتینر فعال دارد، نصب را از همان پوشهٔ کانتینر انجام دهید.

در حالت update اسکریپت از دیتابیس‌های SQLite پشتیبان آنلاین می‌گیرد و محل پشتیبان را چاپ می‌کند. فایل‌های آپلودشده در پوشهٔ data می‌مانند. برای مهاجرت به VPS دیگر، پوشهٔ data و فایل .env هم باید طبق روال انتقال و پشتیبان‌گیری تیم منتقل شوند.

## بررسی و نگهداری

    sudo docker compose ps
    sudo docker compose logs --tail=100 skillup
    sudo nginx -t
    sudo certbot renew --dry-run
    curl -fsS https://skill-up.ir/api/health
    curl -fsSI https://skill-up.ir/magazine/scratch-costume-animation

پنل مدیر سایت در /admin است. پنل بررسی دیدگاه مقاله در /magazine/scratch-costume-animation/moderation قرار دارد و رمز جداگانهٔ SCRATCH_LESSON_ADMIN_TOKEN را می‌خواهد.
