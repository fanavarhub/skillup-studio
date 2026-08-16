import { useMemo, useState } from 'react';
import { Check, CheckCircle2, Copy, KeyRound, Loader2, Search, UserPlus, UsersRound } from 'lucide-react';
import type { FreeCourseRegistration } from '../types';

type Credentials = { username: string; password: string };

const welcomeMessage = (account: Credentials) => `🎉 ثبت‌نامت در اِسکیل‌آپ با موفقیت انجام شد

سلام 👋
حساب کاربری شما در پلتفرم آموزشی اسکیل‌آپ با موفقیت ساخته شد و دوره اسکرچ مقدماتی برای شما فعال شد. 🚀

📚 دوره: اسکرچ مقدماتی
📅 تاریخ شروع دوره: [شنبه ۳۱ مرداد]

━━━━━━━━━━━━━━

🔐 اطلاعات ورود به اسکیل‌آپ

👤 نام کاربری: ${account.username}
🔑 رمز عبور: ${account.password}

🌐 حتماً همین حالا وارد سایت اسکیل‌آپ شوید و نام کاربری و رمز عبور خود را تست کنید تا مطمئن شوید همه‌چیز آماده است.

اگر هنگام ورود یا استفاده از حساب مشکلی داشتید، همین‌جا به ما پیام دهید. 💬`;

export default function FreeRegistrationsManager({ registrations, adminFetch, reload }: {
  registrations: FreeCourseRegistration[];
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  reload: () => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [creatingId, setCreatingId] = useState('');
  const [credentials, setCredentials] = useState<Record<string, Credentials>>({});
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  const visible = useMemo(() => registrations.filter((item) => `${item.fullName} ${item.phone} ${item.province}`.includes(query.trim())), [registrations, query]);
  const pending = registrations.filter((item) => !item.userId).length;

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value; textarea.style.position = 'fixed'; textarea.style.opacity = '0';
      document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove();
    }
    setCopied(key); window.setTimeout(() => setCopied(''), 1800);
  };

  const createAccount = async (item: FreeCourseRegistration) => {
    setCreatingId(item.id); setError('');
    try {
      const response = await adminFetch(`/api/admin/free-course-registrations/${item.id}/create-account`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ساخت حساب انجام نشد.');
      if (data.credentials) setCredentials((current) => ({ ...current, [item.id]: data.credentials }));
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ساخت حساب انجام نشد.');
    } finally { setCreatingId(''); }
  };

  return <section data-tour="admin-registrations" className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <Summary label="کل ثبت‌نام‌ها" value={registrations.length} emoji="🎁" color="from-violet-600 to-indigo-600" />
      <Summary label="منتظر ساخت حساب" value={pending} emoji="⏳" color="from-amber-500 to-orange-500" />
      <Summary label="حساب آماده" value={registrations.length - pending} emoji="✅" color="from-emerald-500 to-teal-500" />
    </div>
    <div className="flex flex-col gap-3 rounded-3xl border-2 border-white bg-white/90 p-4 shadow-[0_10px_30px_rgba(99,102,241,.08)] sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><UsersRound className="h-6 w-6 text-violet-600" />ثبت‌نام‌های دوره رایگان</h2><p className="mt-1 text-xs leading-6 text-slate-500">پس از بررسی هر فرد، با دکمه «ثبت‌نام» حساب هنرجویی بسازید؛ رمز فقط همان لحظه نمایش داده می‌شود.</p></div>
      <label className="flex min-w-64 items-center gap-2 rounded-2xl bg-slate-100 px-3"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 w-full bg-transparent text-sm font-bold outline-none" placeholder="جست‌وجوی نام، شماره یا استان" /></label>
    </div>
    {error && <div role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
    {!visible.length ? <div className="rounded-3xl border-2 border-dashed border-violet-200 bg-white/70 p-10 text-center"><div className="text-5xl">🌱</div><h3 className="mt-3 font-black text-slate-800">هنوز ثبت‌نامی پیدا نشد</h3><p className="mt-1 text-sm text-slate-500">فرم‌های جدید در همین بخش نمایش داده می‌شوند.</p></div> :
      <div className="grid gap-4 xl:grid-cols-2">{visible.map((item) => {
        const account = credentials[item.id];
        return <article key={item.id} className="overflow-hidden rounded-[28px] border border-violet-100 bg-white shadow-[0_10px_28px_rgba(15,23,42,.06)]">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-l from-violet-50 to-sky-50 p-5">
            <div><h3 className="text-lg font-black text-slate-950">{item.fullName}</h3><button onClick={() => copy(`${item.id}-phone`, item.phone)} dir="ltr" className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-indigo-700">{item.phone}{copied === `${item.id}-phone` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button></div>
            <span className={`rounded-full px-3 py-1.5 text-[11px] font-black ${item.userId ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.userId ? 'حساب متصل' : 'منتظر بررسی'}</span>
          </div>
          <div className="p-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3">
              <Info label="سن" value={`${item.age} سال`} /><Info label="استان" value={item.province} /><Info label="پایه" value={item.educationGrade} />
              <Info label="دوره برای" value={item.relation} /><Info label="آشنایی" value={item.programmingExperience} /><Info label="ارسال بنر" value={item.bannerShared ? 'تأیید شده ✅' : 'خیر'} />
            </dl>
            <p className="mt-4 text-[10px] text-slate-400">ثبت در {new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</p>

            {account && <div className="mt-4 rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-emerald-800"><CheckCircle2 className="h-5 w-5" />حساب ساخته شد؛ اطلاعات را همین حالا ارسال کنید</div>
              <Credential label="نام کاربری" value={account.username} copied={copied === `${item.id}-username`} onCopy={() => copy(`${item.id}-username`, account.username)} />
              <Credential label="رمز عبور موقت" value={account.password} copied={copied === `${item.id}-password`} onCopy={() => copy(`${item.id}-password`, account.password)} />
              <button onClick={() => copy(`${item.id}-all`, welcomeMessage(account))} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white"><Copy className="h-4 w-4" />{copied === `${item.id}-all` ? 'متن کامل کپی شد' : 'کپی متن کامل برای ارسال'}</button>
            </div>}

            {!item.userId && !account && <button disabled={creatingId === item.id} onClick={() => createAccount(item)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-violet-600 to-indigo-600 py-3.5 text-sm font-black text-white shadow-lg shadow-violet-200 disabled:opacity-60">{creatingId === item.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}{creatingId === item.id ? 'در حال ساخت حساب…' : 'ثبت‌نام و ساخت حساب'}</button>}
            {item.userId && !account && <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3 text-xs font-bold text-slate-500"><KeyRound className="h-4 w-4" />حساب قبلاً ساخته یا به این درخواست متصل شده است</div>}
          </div>
        </article>;
      })}</div>}
  </section>;
}

function Summary({ label, value, emoji, color }: { label: string; value: number; emoji: string; color: string }) {
  return <div className={`flex items-center justify-between rounded-3xl bg-gradient-to-l ${color} p-4 text-white shadow-lg`}><div><p className="text-xs text-white/75">{label}</p><b className="mt-1 block text-2xl">{value.toLocaleString('fa-IR')}</b></div><span className="text-3xl">{emoji}</span></div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-slate-400">{label}</dt><dd className="mt-1 font-bold leading-5 text-slate-700">{value}</dd></div>; }

function Credential({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-white p-3"><div><span className="block text-[10px] text-slate-400">{label}</span><code dir="ltr" className="mt-1 block text-sm font-black text-slate-800">{value}</code></div><button onClick={onCopy} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700" title={`کپی ${label}`}>{copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}</button></div>;
}
