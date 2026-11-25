# راه‌اندازی نظرسنجی روی Ubuntu

مسئول DevOps با حساب GitHub دارای دسترسی به مخزن خصوصی و کاربر دارای `sudo` روی Ubuntu اجرا کند. پیش از نصب، رکورد DNS دامنه را به سرور وصل کنید و دسترسی ورودی ۸۰ و ۴۴۳ را در فایروال سرور و پنل میزبان بررسی کنید. اگر رکورد AAAA دارید، IPv6 نیز باید به همین سرویس برسد. مخزن‌های APT و رجیستری Docker باید از سرور قابل‌دسترسی باشند.

```bash
git clone --single-branch --branch codex/heyat-survey https://github.com/fanavarhub/skillup-studio.git
cd skillup-studio/heyat-survey
bash deploy/install.sh
```

در ترمینال یکی از حالت‌های زیر را انتخاب کنید.

- **مسیر سایت فعلی**. گزینهٔ `2` و دامنهٔ `skill-up.ir` را وارد کنید. اسکریپت بلوک HTTPS فعال همان دامنه را پیدا می‌کند و مسیر `/heyat/` را به آن می‌افزاید. اگر چند بلوک هم‌نام وجود دارد، مسیر کامل فایل را وارد کنید. این حالت به گواهی معتبر موجود روی همان Nginx نیاز دارد.
- **دامنه یا زیردامنهٔ اختصاصی**. گزینهٔ `1` و نام دامنه را وارد کنید. برای Let’s Encrypt ایمیل لازم است و اعتبارسنجی از پورت ۸۰ انجام می‌شود. اسکریپت درخواست گواهی، پیکربندی HTTPS و تمدید را تنظیم می‌کند. اگر گواهی سازمانی دارید، مسیر مطلق full chain و کلید خصوصی را بدهید و تمدید را با سامانهٔ فعلی خود انجام دهید.

پورت داخلی میزبان از بازهٔ `7480–7490` انتخاب و فقط روی `127.0.0.1` باز می‌شود. پیش‌فرض اولین پورت آزاد است. در نصب تازه، نام کاربری و رمز مدیریت را در همان ترمینال تعیین کنید. رمز هنگام ورود پنهان است و فقط هش آن در `.env` ذخیره می‌شود. حساب نصب قبلی در اجرای مجدد قابل استفاده است.

اسکریپت بسته‌های لازم را نصب می‌کند، کانتینر را می‌سازد، سلامت SQLite را بررسی می‌کند و پس از `nginx -t` تنظیمات را اعمال می‌کند. اگر بررسی HTTPS یا پنل خطا بدهد، فایل قبلی Nginx بازگردانده می‌شود. برای بررسی نصب از لینک‌هایی استفاده کنید که اسکریپت در پایان چاپ می‌کند.

## بررسی و تحویل به مسئول نرم‌افزار

برای حالت مسیر مشترک این دو نشانی پس از نصب قابل‌استفاده‌اند.

- فرم — [skill-up.ir/heyat/](https://skill-up.ir/heyat/)
- مدیریت — [skill-up.ir/heyat/admin](https://skill-up.ir/heyat/admin)

```bash
sudo docker compose ps
sudo docker compose logs --tail=50 survey
sudo nginx -t
curl -fsS https://skill-up.ir/heyat/healthz
```

در حالت زیردامنه، نشانی سلامت را با `https://<دامنه>/healthz` جایگزین کنید. در پنل با حساب تعیین‌شده وارد شوید و «دریافت فایل اکسل» را بزنید. برگهٔ «پاسخ‌ها» به ازای هر ثبت یک ردیف دارد. ۲۰ ستون شامل نام، شماره، ۱۳ پاسخ انتخابی، اولویت‌ها، نظر آزاد، شناسه و دو زمان ثبت هستند. جزئیات ستون‌ها در [راهنمای تحویل](HANDOFF.md) آمده است. حساب مدیریت را از کانال امن سازمان به مسئول نرم‌افزار تحویل دهید.

## به‌روزرسانی، تغییر حساب و پشتیبان

دستورها را در همان پوشهٔ `heyat-survey` اجرا کنید.

```bash
git pull --ff-only
sudo docker compose up -d --build survey
sudo docker compose ps
```

برای تغییر نام کاربری یا رمز، `bash deploy/install.sh --reset-admin` را اجرا کنید. داده‌ها در volume ماندگار `heyat-survey_survey_data` و فایل `/app/data/survey.sqlite` هستند. قبل از تغییرات مهم نسخهٔ پشتیبان بگیرید و آن را خارج از VPS نگه دارید.

```bash
sudo docker compose exec -T survey node tools/backup.mjs
mkdir -p -m 700 backups
sudo docker compose cp survey:/app/backups/. ./backups/
```

برای تمدید Let’s Encrypt در حالت زیردامنه، نام گواهی `heyat-survey-<دامنه>` است. با `sudo certbot certificates` نام را بررسی کنید و برای آزمون تمدید `sudo certbot renew --dry-run --cert-name heyat-survey-<دامنه>` را با نام واقعی اجرا کنید. در نصب روی سایت موجود، تمدید از طریق تنظیمات گواهی همان سایت انجام می‌شود.

مراجع [Docker روی Ubuntu](https://docs.docker.com/engine/install/ubuntu/)، [Certbot](https://eff-certbot.readthedocs.io/en/stable/using.html)، [اعتبارسنجی HTTP-01](https://letsencrypt.org/docs/challenge-types/) و [تنظیمات پراکسی Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass).
