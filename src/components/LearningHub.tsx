import { FormEvent, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Clock3, Medal, MessageCircle, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { authenticatedFetch } from '../api';

type Profile = { userId: string; studentName: string; avatar?: string; xp: number; level: number; levelXp: number; nextLevelXp: number; progress: number; tier: string };
type Leader = { rank: number; userId: string; name: string; weeklyXp: number };
type Mission = { id: string; question: string; options: string[]; courseTitle: string; xpReward: number; levelBand: string };
type MissionData = { day: string; level: number; mission: Mission | null; completed: boolean; answer?: { selectedIndex: number; isCorrect: number } };
type Notice = { id: string; title: string; body: string; readAt?: string; createdAt: string };
type ClubPost = { id: string; parentId?: string; category: string; body: string; author: string; isAnnouncement: boolean; createdAt: string };
type Passport = { owner: string; level: number; tier: string; xp: number; projects: Array<{ id: string; title: string; status: string; score: number }>; certificates: Array<{ id: string; courseTitle: string; verificationCode: string }> };

export default function LearningHub() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [missionData, setMissionData] = useState<MissionData | null>(null);
  const [answerResult, setAnswerResult] = useState<{ correct: boolean; explanation?: string; xpAwarded?: number } | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [clubBody, setClubBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const load = async () => {
    const [p, l, m, n, c, s] = await Promise.all([
      authenticatedFetch('/api/student-profile'), authenticatedFetch('/api/leaderboard'),
      authenticatedFetch('/api/daily-questions'), authenticatedFetch('/api/notifications'),
      authenticatedFetch('/api/club'), authenticatedFetch('/api/skill-passport'),
    ]);
    if (p.ok) setProfile(await p.json());
    if (l.ok) setLeaders((await l.json()).entries);
    if (m.ok) setMissionData(await m.json());
    if (n.ok) setNotices(await n.json());
    if (c.ok) setPosts(await c.json());
    if (s.ok) setPassport(await s.json());
  };

  useEffect(() => { load().catch(console.error); }, []);

  const answer = async (selectedIndex: number) => {
    if (!missionData?.mission || missionData.completed || answerResult) return;
    const response = await authenticatedFetch(`/api/daily-questions/${missionData.mission.id}/answer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedIndex }),
    });
    const data = await response.json();
    if (response.ok) {
      setAnswerResult(data);
      setMissionData((current) => current ? { ...current, completed: true } : current);
      load().catch(console.error);
    }
  };

  const sendPost = async (event: FormEvent) => {
    event.preventDefault();
    if (!clubBody.trim()) return;
    const response = await authenticatedFetch('/api/club', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'general', body: clubBody, parentId: replyTo }) });
    if (response.ok) { setClubBody(''); setReplyTo(null); load().catch(console.error); }
  };

  const markRead = async (id: string) => {
    await authenticatedFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    setNotices((items) => items.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
  };

  const topThree = leaders.slice(0, 3);
  return <div className="space-y-5 text-right" dir="rtl">
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[28px] border-4 border-white bg-gradient-to-l from-indigo-700 via-violet-600 to-fuchsia-500 p-4 text-white shadow-[0_16px_38px_rgba(109,40,217,.22)]">
      <div className="panel-orb absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-300/25" />
      <div className="relative flex flex-wrap items-center gap-3">
        <CharacterStat emoji="🚀" name="نُوا" label="انرژی تجربه" value={profile?.xp || 0} color="bg-amber-300/20" />
        <CharacterStat emoji="🐯" name="ریکو" label="سطح آموزشی" value={profile?.level || 1} color="bg-sky-300/20" />
        <CharacterStat emoji="🏆" name="تیکو" label="رتبه این هفته" value={leaders.find((item) => item.userId === profile?.userId)?.rank || '—'} color="bg-emerald-300/20" />
        <div className="min-w-[180px] flex-1 px-2"><div className="mb-2 flex justify-between text-[11px] font-bold text-white/80"><span>تا پرشدن انرژی نُوا</span><span>{profile?.progress || 0}٪</span></div><div className="h-3 overflow-hidden rounded-full bg-black/15 p-0.5"><motion.div initial={{ width: 0 }} animate={{ width: `${profile?.progress || 0}%` }} transition={{ duration: .9, ease: 'easeOut' }} className="h-full rounded-full bg-gradient-to-l from-amber-300 to-yellow-200" /></div></div>
      </div>
    </motion.section>

    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <motion.section initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .08 }} className="relative overflow-hidden rounded-[32px] border-2 border-violet-100 bg-white p-5 shadow-[0_12px_34px_rgba(124,58,237,.10)] sm:p-6">
        <div className="absolute left-5 top-5 text-6xl opacity-[.06]">🦉</div>
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><motion.span animate={{ rotate: [-3, 4, -3] }} transition={{ duration: 2.5, repeat: Infinity }} className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-3xl">🦉</motion.span><div><p className="text-[11px] font-black text-violet-600">میمو · راهنمای مأموریت</p><h3 className="text-xl font-black text-slate-950">مرحله امروز</h3></div></div>{missionData?.mission && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">+{missionData.mission.xpReward} انرژی</span>}</div>

        {!missionData?.mission ? <Empty text="مدیر هنوز برای دوره و سطح تو مأموریتی تعریف نکرده است." /> :
          missionData.completed ? <motion.div initial={{ scale: .9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-6 rounded-3xl bg-gradient-to-l from-emerald-50 to-cyan-50 p-6 text-center"><motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 1.8, repeat: Infinity }} className="text-6xl">🎉</motion.div><h4 className="mt-3 text-xl font-black text-emerald-800">مأموریت امروز تمام شد!</h4><p className="mt-2 text-sm text-emerald-700">{answerResult?.correct === false ? 'این بار درست نبود؛ فردا یک فرصت تازه داری.' : 'عالی بود! میمو فردا یک مرحله تازه برایت می‌آورد.'}</p>{answerResult?.explanation && <p className="mt-3 rounded-2xl bg-white/70 p-3 text-xs leading-6 text-slate-600">{answerResult.explanation}</p>}<span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-500"><Clock3 className="h-4 w-4" />مرحله بعد: فردا</span></motion.div> :
          <div className="mt-6"><div className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-500"><span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">{missionData.mission.courseTitle}</span><span>سطح {missionData.level}</span></div><p className="text-base font-black leading-8 text-slate-800">{missionData.mission.question}</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{missionData.mission.options.map((option, index) => <motion.button whileHover={{ y: -2, scale: 1.01 }} whileTap={{ scale: .98 }} onClick={() => answer(index)} key={`${option}-${index}`} className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-3 text-sm font-bold text-slate-700 transition hover:border-violet-300 hover:bg-violet-50">{option}</motion.button>)}</div></div>}
      </motion.section>

      <Panel title="لیگ هفتگی تیکو" icon={<span className="text-2xl">🏆</span>}>
        <p className="mb-3 text-xs leading-6 text-slate-500">شروع دوباره در هر شنبه؛ کوچک، رقابتی و منصفانه.</p>
        <div className="space-y-2">{topThree.map((item, index) => <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .08 * index }} key={item.userId} className={`flex items-center justify-between rounded-2xl p-3 ${profile?.userId === item.userId ? 'bg-violet-100 ring-2 ring-violet-200' : 'bg-slate-50'}`}><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-lg shadow-sm">{['🥇','🥈','🥉'][index]}</span><div><b className="block text-sm">{item.name}</b><small className="text-[10px] text-slate-400">{profile?.userId === item.userId ? 'این تویی!' : `رتبه ${item.rank}`}</small></div></div><strong className="text-xs text-violet-700">{item.weeklyXp} XP</strong></motion.div>)}</div>
      </Panel>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="نامه‌های پیکو" icon={<span className="text-2xl">🐦</span>}>
        <div className="max-h-64 space-y-2 overflow-y-auto pl-1">{notices.length === 0 && <Empty text="پیکو فعلاً نامه تازه‌ای ندارد." />}{notices.map((item) => <button onClick={() => markRead(item.id)} key={item.id} className={`w-full rounded-2xl border p-3 text-right ${item.readAt ? 'border-slate-100 bg-white' : 'border-sky-100 bg-sky-50'}`}><b className="block text-sm">{item.title}</b><span className="mt-1 block text-xs leading-6 text-slate-600">{item.body}</span></button>)}</div>
      </Panel>
      <Panel title="گذرنامه آرکو" icon={<span className="text-2xl">🐲</span>}>
        {passport ? <div className="space-y-3"><div className="flex items-center justify-between rounded-2xl bg-gradient-to-l from-indigo-50 to-violet-50 p-4"><div><b>{passport.owner}</b><p className="mt-1 text-xs text-violet-600">سطح {passport.level} · {passport.tier}</p></div><ShieldCheck className="h-7 w-7 text-indigo-600" /></div><div className="grid grid-cols-2 gap-2"><Mini label="پروژه" value={passport.projects.length} /><Mini label="گواهینامه" value={passport.certificates.length} /></div>{passport.certificates.slice(0, 2).map((certificate) => <div key={certificate.id} className="flex items-center gap-3 rounded-2xl border p-2"><img src={`/api/certificates/${certificate.id}/qr`} className="h-14 w-14" alt="QR اعتبارسنجی" /><div><b className="text-xs">{certificate.courseTitle}</b><p className="mt-1 font-mono text-[10px]">{certificate.verificationCode}</p></div></div>)}</div> : <Empty text="گذرنامه در حال آماده‌سازی است." />}
      </Panel>
    </div>

    <Panel title="باشگاه رفیق‌ها" icon={<MessageCircle className="h-5 w-5 text-cyan-600" />}>
      <form onSubmit={sendPost} className="mb-5 flex flex-col gap-2 sm:flex-row"><input value={clubBody} onChange={(event) => setClubBody(event.target.value)} placeholder={replyTo ? 'پاسخت را بنویس…' : 'یک پیام مفید برای بقیه بنویس…'} className="input-admin flex-1" /><button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white"><Send className="h-4 w-4" />ارسال</button></form>
      <div className="grid gap-3 md:grid-cols-2">{posts.slice(0, 6).map((post) => <article key={post.id} className={`rounded-2xl border p-4 ${post.isAnnouncement ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}><div className="flex items-center gap-2"><b className="text-sm">{post.author}</b>{post.isAnnouncement && <Sparkles className="h-4 w-4 text-amber-500" />}</div><p className="mt-2 text-xs leading-6">{post.body}</p>{!post.isAnnouncement && <button onClick={() => setReplyTo(post.id)} className="mt-2 text-[11px] font-bold text-indigo-600">پاسخ</button>}</article>)}</div>
    </Panel>
  </div>;
}

function CharacterStat({ emoji, name, label, value, color }: { emoji: string; name: string; label: string; value: string | number; color: string }) {
  return <motion.div whileHover={{ y: -3 }} className={`flex min-w-[145px] items-center gap-2 rounded-2xl border border-white/15 p-2.5 backdrop-blur ${color}`}><motion.span animate={{ y: [0, -3, 0] }} transition={{ duration: 2.2, repeat: Infinity }} className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-2xl">{emoji}</motion.span><div><small className="block text-[9px] text-white/70">{name} · {label}</small><strong className="mt-0.5 block text-lg">{value}</strong></div></motion.div>;
}
function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) { return <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border-2 border-white bg-white p-5 shadow-[0_10px_30px_rgba(99,102,241,.08)]"><h3 className="mb-4 flex items-center gap-2 text-lg font-black">{icon}{title}</h3>{children}</motion.section>; }
function Mini({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl bg-slate-50 p-3"><small className="text-slate-500">{label}</small><strong className="block text-lg">{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <div className="py-8 text-center text-sm text-slate-400"><Medal className="mx-auto mb-2 h-8 w-8 opacity-40" />{text}</div>; }
