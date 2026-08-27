# استقرار فایل‌های دانلود مقاله اسکرچ

صفحه مقاله در مسیر `/magazine/download-scratch` قرار دارد. فایل‌های نصبی عمداً داخل Git نگهداری نمی‌شوند؛ فایل ویندوز از سقف ۱۰۰ مگابایتی فایل عادی GitHub بزرگ‌تر است و هر دو فایل نیز داده استقرار محسوب می‌شوند. برنامه آن‌ها را از volume پایدار `data/downloads/` ارائه می‌کند.

نام فایل‌های مورد انتظار روی سرور:

- `data/downloads/scratch-windows.exe`
- `data/downloads/scratch-android.apk`

هش SHA-256 فایل‌های تحویل‌گرفته‌شده در ۱۴۰۵/۰۶/۰۵:

- Windows: `0EBC6439E3EB36D40BB68C096646C03A0224F60625434C7418BC734C56525908`
- Android: `3EA91971B30C42A8806C30262A63AE0C0D5B4A0784DCF2B75800D8D5CBEA4E2D`

فایل ویندوز نسخه `Scratch Desktop 3.4.0` است و امضای Authenticode آن با ناشر `Massachusetts Institute of Technology` معتبر شناسایی شد. پیش از هر بار جایگزینی فایل‌ها، منبع، امضا و هش نسخه جدید دوباره بررسی شود.

## انتقال فایل‌ها از Windows به VPS

ابتدا روی VPS:

```bash
mkdir -p ~/public/skillup-app/data/downloads
chown -R 1000:1000 ~/public/skillup-app/data/downloads
```

سپس از PowerShell رایانه محلی، مقدار `SERVER_IP` را با IP سرور جایگزین کنید:

```powershell
scp "C:\Users\fanavar\Downloads\Mobile Devices\blog01\scratch.exe" root@SERVER_IP:/root/public/skillup-app/data/downloads/scratch-windows.exe
scp "C:\Users\fanavar\Downloads\Mobile Devices\blog01\scratch.apk" root@SERVER_IP:/root/public/skillup-app/data/downloads/scratch-android.apk
```

بعد از انتقال، روی VPS:

```bash
chown 1000:1000 ~/public/skillup-app/data/downloads/scratch-windows.exe
chown 1000:1000 ~/public/skillup-app/data/downloads/scratch-android.apk

sha256sum ~/public/skillup-app/data/downloads/scratch-windows.exe
sha256sum ~/public/skillup-app/data/downloads/scratch-android.apk
```

این پوشه از طریق volume فعلی Docker در `/app/data/downloads` در دسترس برنامه قرار می‌گیرد و با `git pull` یا rebuild حذف نمی‌شود.

## آزمون پس از استقرار

```bash
curl -I https://skill-up.ir/magazine/download-scratch
curl -I https://skill-up.ir/downloads/scratch-windows.exe
curl -I https://skill-up.ir/downloads/scratch-android.apk
```

صفحه مقاله باید `200` و هر دو فایل باید همراه `Content-Disposition: attachment` پاسخ داده شوند.
