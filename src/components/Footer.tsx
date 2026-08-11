import { GraduationCap, Youtube, Instagram, MessageSquare, Send } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-white border-t border-slate-900 py-16" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 text-right">
          
          {/* Brand Intro Column */}
          <div className="md:col-span-5 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <span className="font-sans font-extrabold text-xl text-white block">اسکیل آپ</span>
                <span className="font-sans text-xs text-indigo-400 font-medium block">Skill Up</span>
              </div>
            </div>
            
            <p className="font-sans text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
              اسکیل آپ پلتفرم جامع و تخصصی آموزش و توسعه مهارتی نوجوانان ۸ تا ۱۷ سال است. رسالت ما توانمندسازی عملی دانش‌آموزان با یادگیری پروژه‌محور و ساخت نمونه‌کارهای واقعی است.
            </p>
          </div>

          {/* Quick links */}
          <div className="md:col-span-3 space-y-4">
            <h4 className="font-sans font-bold text-white text-sm">🌐 صفحات پلتفرم</h4>
            <ul className="space-y-2.5">
              <li>
                <span className="font-sans text-xs text-slate-400 hover:text-white transition-all">صفحه نخست اسکیل آپ</span>
              </li>
              <li>
                <span className="font-sans text-xs text-slate-400 hover:text-white transition-all">دوره‌های یادگیری کارگاهی</span>
              </li>
              <li>
                <span className="font-sans text-xs text-slate-400 hover:text-white transition-all">پروژه‌های تفریحی و بازی‌ها</span>
              </li>
              <li>
                <span className="font-sans text-xs text-slate-400 hover:text-white transition-all">مستندات و مجله آموزشی</span>
              </li>
            </ul>
          </div>

          {/* Contact & Social Channels */}
          <div className="md:col-span-4 space-y-6">
            <h4 className="font-sans font-bold text-white text-sm">📢 راه‌های ارتباطی و شبکه‌های اجتماعی</h4>
            <p className="font-sans text-xs text-slate-400 leading-relaxed">
              با دنبال کردن کانال‌های رسمی اسکیل آپ در پیام‌رسان‌ها و رسانه‌های ویدیویی، از پروژه‌های منتخب هفته و تخفیف دوره‌های جدید مطلع شوید.
            </p>

            {/* Social Grid Row */}
            <div className="flex flex-wrap gap-3">
              {/* Ble */}
              <a
                href="https://ble.ir/join/CjSBy9mEQc"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-900/40 hover:bg-indigo-600 border border-indigo-500/20 rounded-xl text-xs font-sans text-indigo-200 hover:text-white transition-all cursor-pointer"
                title="کانال بله اسکیل آپ"
              >
                <MessageSquare className="w-4 h-4" />
                <span>کانال بله اسکیل‌آپ</span>
              </a>

              {/* Eitaa */}
              <a
                href="https://eitaa.com/skillupir"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-900/40 hover:bg-orange-600 border border-indigo-500/20 rounded-xl text-xs font-sans text-indigo-200 hover:text-white transition-all cursor-pointer"
                title="کانال ایتا اسکیل آپ"
              >
                <Send className="w-4 h-4" />
                <span>ایتا: skillupir@</span>
              </a>

              {/* Youtube */}
              <a
                href="https://youtube.com/@skillup_ir?si=cl3gP801wpY8BFCb"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-red-950/40 hover:bg-red-600 border border-red-500/20 rounded-xl text-xs font-sans text-red-200 hover:text-white transition-all cursor-pointer"
                title="کانال یوتیوب اسکیل آپ"
              >
                <Youtube className="w-4 h-4" />
                <span>یوتیوب اسکیل‌آپ</span>
              </a>

              {/* Instagram */}
              <a
                href="https://www.instagram.com/skillup.ir/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-pink-950/40 hover:bg-pink-600 border border-pink-500/20 rounded-xl text-xs font-sans text-pink-200 hover:text-white transition-all cursor-pointer"
                title="اینستاگرام اسکیل آپ"
              >
                <Instagram className="w-4 h-4" />
                <span>اینستاگرام ما</span>
              </a>
            </div>
          </div>

        </div>

        {/* Bottom credits lines */}
        <div className="border-t border-slate-900 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-sans text-slate-500 text-center sm:text-right">
          <span>© ۱۴۰۵ اسکیل آپ (Skill Up). تمامی حقوق برای دپارتمان آموزش نوجوانان محفوظ است.</span>
          <span className="font-mono text-[10px] text-slate-600">futuremaker-framework-v1.0</span>
        </div>

      </div>
    </footer>
  );
}
