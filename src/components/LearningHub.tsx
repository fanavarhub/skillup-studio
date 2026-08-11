import { FormEvent, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Bell, BookOpenCheck, CheckCircle2, ChevronLeft, Medal, MessageCircle, Send, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { authenticatedFetch } from '../api';

type Profile = { userId: string; studentName: string; xp: number; level: number; levelXp: number; nextLevelXp: number; progress: number; tier: string };
type Leader = { rank: number; userId: string; name: string; weeklyXp: number; isBot: boolean; publicLabel?: string };
type Question = { id: string; question: string; options: string[] };
type Notice = { id: string; title: string; body: string; readAt?: string; createdAt: string };
type ClubPost = { id: string; parentId?: string; category: string; body: string; author: string; isAnnouncement: boolean; publicLabel?: string; createdAt: string };
type Passport = { owner: string; level: number; tier: string; xp: number; projects: Array<{ id: string; title: string; status: string; score: number }>; certificates: Array<{ id: string; courseTitle: string; verificationCode: string }> };

const tourSteps = [
  ['XP چطور ثبت می‌شود؟', 'همه امتیازها در دفترکل ثبت می‌شوند: ویدئو پس از ۷۵٪ مشاهده، پاسخ روزانه، پروژه، ارزیابی مربی و فعالیت مفید باشگاه.'],
  ['Level نامحدود است', 'برای رفتن به Level بعدی به ۲۰ + (Level × ۵) امتیاز نیاز داری؛ سطح سقف ندارد.'],
  ['رتبه هفتگی', 'لیگ هر شنبه از نو شروع می‌شود تا هنرجویی که دیرتر عضو شده هم شانس رتبه اول داشته باشد.'],
];

export default function LearningHub() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answered, setAnswered] = useState<Record<string, { correct: boolean; explanation?: string }>>({});
  const [notices, setNotices] = useState<Notice[]>([]);
  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [clubCategory, setClubCategory] = useState('general');
  const [clubBody, setClubBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [tourStep, setTourStep] = useState(0);

  const load = async () => {
    const [p, l, q, n, c, s] = await Promise.all([
      authenticatedFetch('/api/student-profile'),
      authenticatedFetch('/api/leaderboard'),
      authenticatedFetch('/api/daily-questions'),
      authenticatedFetch('/api/notifications'),
      authenticatedFetch('/api/club'),
      authenticatedFetch('/api/skill-passport'),
    ]);
    if (p.ok) setProfile(await p.json());
    if (l.ok) setLeaders((await l.json()).entries);
    if (q.ok) setQuestions((await q.json()).questions);
    if (n.ok) setNotices(await n.json());
    if (c.ok) setPosts(await c.json());
    if (s.ok) setPassport(await s.json());
  };

  useEffect(() => { load().catch(console.error); }, []);

  const answer = async (questionId: string, selectedIndex: number) => {
    const response = await authenticatedFetch(`/api/daily-questions/${questionId}/answer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedIndex }),
    });
    const data = await response.json();
    if (response.ok) {
      setAnswered((current) => ({ ...current, [questionId]: data }));
      load().catch(console.error);
    }
  };

  const sendPost = async (event: FormEvent) => {
    event.preventDefault();
    if (!clubBody.trim()) return;
    const response = await authenticatedFetch('/api/club', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: clubCategory, body: clubBody, parentId: replyTo }),
    });
    if (response.ok) { setClubBody(''); setReplyTo(null); load().catch(console.error); }
  };

  const markRead = async (id: string) => {
    await authenticatedFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    setNotices((items) => items.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <section className="rounded-3xl bg-gradient-to-br from-indigo-950 to-indigo-700 text-white p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row gap-6 justify-between">
          <div>
            <span className="inline-flex px-3 py-1 rounded-full bg-white/10 text-xs font-bold">تور کوتاه پنل · {tourStep + 1} از {tourSteps.length}</span>
            <h2 className="text-2xl font-black mt-4">{tourSteps[tourStep][0]}</h2>
            <p className="text-sm text-indigo-100 mt-2 max-w-2xl leading-7">{tourSteps[tourStep][1]}</p>
          </div>
          <button onClick={() => setTourStep((tourStep + 1) % tourSteps.length)} className="self-end px-4 py-2 rounded-xl bg-white text-indigo-700 text-xs font-black flex items-center gap-2">
            مرحله بعد <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        {profile && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-7">
            <Stat label="XP کل" value={profile.xp} />
            <Stat label="Level" value={profile.level} />
            <Stat label="عنوان" value={profile.tier} />
            <Stat label="تا Level بعد" value={`${profile.levelXp}/${profile.nextLevelXp}`} />
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel title="لیگ هفتگی" icon={<Trophy className="w-5 h-5 text-amber-500" />}>
          <p className="text-xs text-slate-500 mb-4">لیگ هر شنبه ریست می‌شود. حساب‌های نمایشی برای شفافیت با برچسب مشخص شده‌اند.</p>
          <div className="space-y-2">
            {leaders.map((item) => (
              <div key={item.userId} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-100 p-3">
                <div className="flex items-center gap-3"><b className="text-indigo-600">#{item.rank}</b><span className="font-bold text-sm">{item.name}{profile?.userId === item.userId ? ' (شما)' : ''}</span>{item.publicLabel && <small className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full">{item.publicLabel}</small>}</div>
                <strong className="text-sm">{item.weeklyXp} XP</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="سه سؤال امروز" icon={<BookOpenCheck className="w-5 h-5 text-emerald-600" />}>
          <div className="space-y-5">
            {questions.map((question, index) => (
              <div key={question.id} className="border-b border-slate-100 pb-4 last:border-0">
                <p className="font-bold text-sm mb-3">{index + 1}. {question.question}</p>
                <div className="grid grid-cols-2 gap-2">
                  {question.options.map((option, optionIndex) => <button disabled={Boolean(answered[question.id])} onClick={() => answer(question.id, optionIndex)} key={option} className="p-2 rounded-xl border border-slate-200 hover:border-indigo-400 disabled:opacity-60 text-xs">{option}</button>)}
                </div>
                {answered[question.id] && <p className={`text-xs mt-2 font-bold ${answered[question.id].correct ? 'text-emerald-600' : 'text-rose-600'}`}>{answered[question.id].correct ? 'پاسخ درست؛ ۳ XP گرفتی.' : 'این پاسخ درست نبود.'} {answered[question.id].explanation}</p>}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel title="اعلان‌های یادگیری" icon={<Bell className="w-5 h-5 text-rose-500" />}>
          <div className="space-y-2">
            {notices.length === 0 && <Empty text="فعلاً اعلان تازه‌ای نداری." />}
            {notices.map((item) => <button onClick={() => markRead(item.id)} key={item.id} className={`w-full text-right rounded-2xl p-3 border ${item.readAt ? 'bg-white border-slate-100' : 'bg-indigo-50 border-indigo-100'}`}><b className="text-sm block">{item.title}</b><span className="text-xs text-slate-600 leading-6">{item.body}</span></button>)}
          </div>
        </Panel>

        <Panel title="Skill Passport" icon={<ShieldCheck className="w-5 h-5 text-indigo-600" />}>
          {passport ? <div className="space-y-4">
            <div className="rounded-2xl bg-indigo-50 p-4"><b>{passport.owner}</b><p className="text-sm mt-1">Level {passport.level} · {passport.tier} · {passport.xp} XP</p></div>
            <div className="grid grid-cols-2 gap-3"><StatLight label="پروژه‌ها" value={passport.projects.length} /><StatLight label="گواهینامه‌ها" value={passport.certificates.length} /></div>
            {passport.certificates.map((certificate) => <div key={certificate.id} className="flex items-center gap-3 rounded-2xl border p-3"><img src={`/api/certificates/${certificate.id}/qr`} className="w-16 h-16" alt="QR اعتبارسنجی"/><div><b className="text-sm">{certificate.courseTitle}</b><p className="font-mono text-xs mt-1">{certificate.verificationCode}</p></div></div>)}
          </div> : <Empty text="گذرنامه در حال آماده‌سازی است." />}
        </Panel>
      </div>

      <Panel title="باشگاه یادگیری" icon={<MessageCircle className="w-5 h-5 text-cyan-600" />}>
        <form onSubmit={sendPost} className="flex flex-col sm:flex-row gap-2 mb-5">
          <select value={clubCategory} onChange={(e) => setClubCategory(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs"><option value="general">عمومی</option><option value="qa">پرسش و پاسخ</option><option value="projects">پروژه‌ها</option></select>
          <input value={clubBody} onChange={(e) => setClubBody(e.target.value)} placeholder={replyTo ? 'پاسخت را بنویس…' : 'پیام مفیدت را بنویس؛ حداکثر ۵ پیام در روز XP می‌گیرد.'} className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm" />
          <button className="rounded-xl bg-indigo-600 text-white px-5 py-2 text-xs font-bold flex items-center justify-center gap-2"><Send className="w-4 h-4" />ارسال</button>
        </form>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {posts.slice(0, 12).map((post) => <article key={post.id} className={`rounded-2xl border p-4 ${post.isAnnouncement ? 'bg-amber-50 border-amber-200' : post.parentId ? 'bg-cyan-50 border-cyan-100' : 'bg-slate-50 border-slate-100'}`}><div className="flex gap-2 items-center"><b className="text-sm">{post.author}</b>{post.publicLabel && <small className="px-2 py-1 rounded-full bg-amber-100">{post.publicLabel}</small>}{post.isAnnouncement && <Sparkles className="w-4 h-4 text-amber-500"/>}</div><p className="text-xs leading-6 mt-2">{post.body}</p>{!post.isAnnouncement && <button onClick={() => setReplyTo(post.id)} className="text-[11px] text-indigo-600 font-bold mt-2">پاسخ</button>}</article>)}
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) { return <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6"><h3 className="font-black text-lg flex items-center gap-2 mb-4">{icon}{title}</h3>{children}</section>; }
function Stat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-2xl bg-white/10 border border-white/10 p-3"><small className="text-indigo-200 block">{label}</small><strong className="text-xl mt-1 block">{value}</strong></div>; }
function StatLight({ label, value }: { label: string; value: string | number }) { return <div className="rounded-2xl bg-slate-50 p-3"><small className="text-slate-500 block">{label}</small><strong className="text-xl mt-1 block">{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <div className="text-center text-sm text-slate-400 py-8"><Medal className="w-8 h-8 mx-auto mb-2 opacity-40" />{text}</div>; }
