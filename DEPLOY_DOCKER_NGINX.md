# استقرار Skill Up روی VPS

دامنه production: `https://skill-up.ir`

پورت برنامه فقط روی `127.0.0.1:4050` باز می‌شود و Nginx درخواست‌های عمومی را به آن منتقل می‌کند. دیتابیس SQLite در پوشه `data/` باقی می‌ماند و هنگام update نباید حذف یا جایگزین شود.

## نصب اولیه کنار نسخه فعلی

روی VPS ابتدا محل دیتابیس فعلی را پیدا کنید:

```bash
find ~/public/skillup -name skillup-studio.sqlite -print
```

سپس مخزن جدید را در یک پوشه موازی دریافت کنید:

```bash
cd ~/public
gh repo clone fanavarhub/skillup-studio skillup-app
cd skillup-app
cp .env.example .env
nano .env
```

در `.env` مقدارهای زیر را تنظیم کنید:

```env
APP_URL="https://skill-up.ir"
PUBLIC_BASE_URL="https://skill-up.ir"
SKILLUP_ADMIN_PASSWORD="یک رمز طولانی و یکتا"
SKILLUP_SESSION_SECRET="یک مقدار تصادفی حداقل ۳۲ کاراکتر"
```

برای ساخت secret می‌توانید از این دستور استفاده کنید:

```bash
openssl rand -base64 48
```

## انتقال دیتابیس موجود

ابتدا از دیتابیس نسخه پشتیبان بگیرید. مسیر زیر را با خروجی دستور `find` جایگزین کنید:

```bash
mkdir -p ~/backups/skillup
cp "/PATH/TO/OLD/data/skillup-studio.sqlite" \
  "$HOME/backups/skillup/skillup-studio-$(date +%F-%H%M).sqlite"

mkdir -p ~/public/skillup-app/data
cp "/PATH/TO/OLD/data/skillup-studio.sqlite" \
  ~/public/skillup-app/data/skillup-studio.sqlite
```

اگر دستور را با کاربر `root` اجرا می‌کنید، مالکیت volume را برای کاربر داخل کانتینر تنظیم کنید:

```bash
chown -R 1000:1000 ~/public/skillup-app/data
```

## اجرای نسخه جدید

ابتدا کانتینر نسخه قدیمی را از همان پوشه‌ای که compose آن قرار دارد متوقف کنید:

```bash
cd ~/public/skillup/front\ ai\ studio
docker compose down
```

سپس نسخه جدید را اجرا کنید:

```bash
cd ~/public/skillup-app
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:4050/api/health
```

خروجی health باید شبیه `{"ok":true,"storage":"sqlite"}` باشد.

## تنظیم Nginx

```bash
cp ~/public/skillup-app/deploy/nginx-skillup.conf \
  /etc/nginx/sites-available/skill-up.ir

ln -sfn /etc/nginx/sites-available/skill-up.ir \
  /etc/nginx/sites-enabled/skill-up.ir

nginx -t
systemctl reload nginx
```

برای SSL:

```bash
apt update
apt install -y certbot python3-certbot-nginx
certbot --nginx -d skill-up.ir -d www.skill-up.ir
```

## به‌روزرسانی‌های بعدی

پیش از هر update از دیتابیس پشتیبان بگیرید و فقط pull/build انجام دهید:

```bash
cd ~/public/skillup-app

mkdir -p ~/backups/skillup
tar -czf ~/backups/skillup/skillup-data-$(date +%F-%H%M).tar.gz data

git pull --ff-only origin main
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:4050/api/health
nginx -t && systemctl reload nginx
```

مشاهده لاگ‌ها:

```bash
cd ~/public/skillup-app
docker compose logs --tail=200 skillup
```

بازگشت به نسخه قبل:

```bash
cd ~/public/skillup-app
git log --oneline -10
git checkout COMMIT_ID
docker compose up -d --build
```

پس از رفع مشکل، برای برگشت به شاخه اصلی:

```bash
git switch main
git pull --ff-only origin main
docker compose up -d --build
```
