import { useEffect, useState } from 'react';
import { BadgeCheck, CircleX, ShieldCheck } from 'lucide-react';

type Result = { valid: boolean; studentName?: string; courseTitle?: string; issuedAt?: string; verificationCode?: string; skillPassport?: { level: number; tier: string }; error?: string };

export default function CertificateVerify({ code, onBack }: { code: string; onBack: () => void }) {
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => { fetch(`/api/certificates/verify/${encodeURIComponent(code)}`).then(async (response) => setResult(await response.json())).catch(() => setResult({ valid: false, error: 'ارتباط با سرور برقرار نشد.' })); }, [code]);
  return <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4" dir="rtl"><section className="w-full max-w-xl bg-white rounded-[2rem] p-7 sm:p-10 text-center shadow-2xl">
    <ShieldCheck className="w-14 h-14 text-indigo-600 mx-auto"/><h1 className="text-2xl font-black mt-4">اعتبارسنجی گواهینامه اسکیل آپ</h1>
    {!result && <p className="text-sm text-slate-500 mt-6">در حال بررسی کد…</p>}
    {result?.valid ? <div className="mt-6"><BadgeCheck className="w-16 h-16 text-emerald-500 mx-auto"/><h2 className="text-xl font-black text-emerald-700 mt-3">گواهینامه معتبر است</h2><div className="rounded-2xl bg-slate-50 p-5 mt-5 space-y-2 text-sm"><p><b>هنرجو:</b> {result.studentName}</p><p><b>دوره:</b> {result.courseTitle}</p><p><b>تاریخ صدور:</b> {result.issuedAt}</p><p><b>Skill Passport:</b> Level {result.skillPassport?.level} · {result.skillPassport?.tier}</p><p className="font-mono">{result.verificationCode}</p></div></div> : result && <div className="mt-6"><CircleX className="w-16 h-16 text-rose-500 mx-auto"/><h2 className="text-xl font-black text-rose-700 mt-3">گواهینامه معتبر پیدا نشد</h2><p className="text-sm text-slate-500 mt-2">{result.error}</p></div>}
    <button onClick={onBack} className="mt-7 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold">بازگشت به سایت</button>
  </section></main>;
}
