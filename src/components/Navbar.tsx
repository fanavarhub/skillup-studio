import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AuthUser, UserRole } from '../types';
import { BookOpen, ChevronDown, Gift, Home, Images, LayoutDashboard, LogIn, LogOut, Menu, Newspaper, Pencil, UserRound, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authenticatedFetch, studentTokenKey } from '../api';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  currentUser: AuthUser | null;
  setCurrentUser: (user: AuthUser | null) => void;
}

const authUserKey = 'skillup_auth_user';
const adminTokenKey = 'skillup_admin_token';
const avatars = ['🧑‍🚀', '🦊', '🐼', '🐯', '🤖', '🦄', '🐲', '🧙‍♀️'];

export default function Navbar({ currentTab, setCurrentTab, userRole, setUserRole, currentUser, setCurrentUser }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [name, setName] = useState('');
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '🧑‍🚀');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const profileRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { id: 'home', label: 'صفحه اصلی', href: '/' },
    { id: 'courses', label: 'دوره‌های آموزشی', href: '/courses' },
    { id: 'projects', label: 'پروژه‌های نوجوانان', href: '/projects' },
    { id: 'articles', label: 'مجله اسکیل آپ', href: '/magazine' },
    { id: 'signup', label: 'ثبت‌نام', href: '/signup' },
  ];

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!authOpen && !editingProfile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [authOpen, editingProfile]);

  const goToTab = (tab: string) => {
    setCurrentTab(tab);
    setMenuOpen(false);
    setProfileMenu(false);
  };

  const openAuth = () => {
    setRegistering(false);
    setRecovering(false);
    setAuthError('');
    setIdentity('');
    setPassword('');
    setAuthNotice('');
    setAuthOpen(true);
  };

  const handleLogout = () => {
    localStorage.removeItem(authUserKey);
    localStorage.removeItem(adminTokenKey);
    localStorage.removeItem(studentTokenKey);
    setCurrentUser(null);
    setUserRole('guest');
    setProfileMenu(false);
    if (currentTab === 'dashboard' || currentTab === 'admin') setCurrentTab('home');
  };

  const openPanel = () => goToTab(userRole === 'admin' ? 'admin' : 'dashboard');

  const handleAuthSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAuthError('');
    setIsSubmitting(true);
    try {
      const response = await fetch(registering ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registering
          ? { name, phone: identity, password }
          : { username: identity.trim(), phone: identity, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.error || 'ورود انجام نشد.');
        return;
      }
      const user = data.user as AuthUser;
      if (data.token) {
        localStorage.removeItem(user.role === 'admin' ? studentTokenKey : adminTokenKey);
        localStorage.setItem(user.role === 'admin' ? adminTokenKey : studentTokenKey, data.token);
      }
      const nextUser = { ...user, avatar: user.role === 'admin' ? '🛡️' : '🧑‍🚀' };
      localStorage.setItem(authUserKey, JSON.stringify(nextUser));
      setCurrentUser(nextUser);
      setUserRole(user.role);
      setAuthOpen(false);
      setCurrentTab(user.role === 'admin' ? 'admin' : 'dashboard');
    } catch {
      setAuthError('ارتباط با سرور برقرار نشد.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestPasswordReset = async (event: FormEvent) => {
    event.preventDefault(); setAuthError(''); setAuthNotice(''); setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/password-reset-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: identity }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'ثبت درخواست انجام نشد.');
      setAuthNotice(data.message); setIdentity('');
    } catch (reason) { setAuthError(reason instanceof Error ? reason.message : 'ثبت درخواست انجام نشد.'); }
    finally { setIsSubmitting(false); }
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setAuthError('');
    try {
      const response = await authenticatedFetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, avatar }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.error || 'پروفایل ذخیره نشد.');
        return;
      }
      const nextUser = { ...currentUser!, name: data.studentName, avatar: data.avatar };
      localStorage.setItem(authUserKey, JSON.stringify(nextUser));
      setCurrentUser(nextUser);
      setEditingProfile(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openProfileEditor = () => {
    setName(currentUser?.name || '');
    setAvatar(currentUser?.avatar || '🧑‍🚀');
    setAuthError('');
    setProfileMenu(false);
    setEditingProfile(true);
  };

  const mobileNavItems: Array<{ id: string; label: string; icon: LucideIcon; href: string }> = [
    { id: 'home', label: 'خانه', icon: Home, href: '/' },
    { id: 'courses', label: 'دوره‌ها', icon: BookOpen, href: '/courses' },
    { id: 'projects', label: 'پروژه‌ها', icon: Images, href: '/projects' },
    { id: 'articles', label: 'مجله', icon: Newspaper, href: '/magazine' },
    { id: 'signup', label: 'ثبت‌نام', icon: Gift, href: '/signup' },
  ];

  return <>
    <nav className="sticky top-0 z-50 border-b border-violet-100 bg-white/90 shadow-sm backdrop-blur-xl" dir="rtl">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between md:h-20">
          <div className="flex items-center gap-8">
            <a href="/" onClick={(event) => { event.preventDefault(); goToTab('home'); }} className="flex items-center gap-3">
              <img src="/assets/brand/skillup-logo-light.png" alt="اسکیل آپ" className="h-11 w-[116px] rounded-xl object-cover object-center shadow-sm sm:h-12 sm:w-[128px]" />
            </a>
            <div className="hidden items-center gap-6 md:flex">
              {navItems.map((item) => { const active = currentTab === item.id || (item.id === 'articles' && (currentTab === 'scratch-download' || currentTab.startsWith('article:'))) || (item.id === 'courses' && currentTab.startsWith('course:')); return <a key={item.id} href={item.href} onClick={(event) => { event.preventDefault(); goToTab(item.id); }} className={`relative py-2 text-sm font-bold transition ${active ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-950'}`}>{item.label}{active && <span className="absolute inset-x-1 -bottom-1 h-1 rounded-full bg-gradient-to-l from-indigo-500 to-fuchsia-500" />}</a>; })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!currentUser ? <button onClick={openAuth} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-l from-indigo-600 to-violet-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-violet-200"><LogIn className="h-4 w-4" />ورود</button> :
              <div ref={profileRef} className="relative">
                <button onClick={() => setProfileMenu((value) => !value)} className="flex items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50/70 p-1.5 pl-3 text-right transition hover:bg-violet-100">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-xl shadow-sm">{currentUser.avatar || (userRole === 'admin' ? '🛡️' : '🧑‍🚀')}</span>
                  <span className="hidden sm:block"><b className="block max-w-28 truncate text-xs text-slate-900">{currentUser.name}</b><small className="text-[10px] text-violet-600">{userRole === 'admin' ? 'مدیر' : 'هنرجو'}</small></span>
                  <ChevronDown className="h-4 w-4 text-violet-500" />
                </button>
                {profileMenu && <div className="absolute left-0 top-14 w-64 overflow-hidden rounded-3xl border border-violet-100 bg-white p-2 shadow-2xl">
                  <div className="rounded-2xl bg-gradient-to-l from-violet-600 to-indigo-600 p-4 text-white"><p className="text-xs text-violet-100">خوش آمدی</p><b className="mt-1 block">{currentUser.name}</b></div>
                  <button onClick={openPanel} className="mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-slate-700 hover:bg-violet-50"><LayoutDashboard className="h-4 w-4 text-violet-600" />ورود به پنل من</button>
                  {userRole === 'student' && <><button onClick={openProfileEditor} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-slate-700 hover:bg-violet-50"><Pencil className="h-4 w-4 text-sky-500" />ویرایش پروفایل</button><button onClick={() => goToTab('courses')} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-slate-700 hover:bg-violet-50"><BookOpen className="h-4 w-4 text-emerald-500" />ثبت‌نام دوره جدید</button></>}
                  <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50"><LogOut className="h-4 w-4" />خروج از حساب</button>
                </div>}
              </div>}
            <button onClick={() => setMenuOpen((value) => !value)} className="rounded-xl p-2 text-slate-500 md:hidden">{menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
          </div>
        </div>
      </div>
      {menuOpen && <div className="border-t border-violet-50 bg-white p-4 md:hidden">{navItems.map((item) => <a key={item.id} href={item.href} onClick={(event) => { event.preventDefault(); goToTab(item.id); }} className={`mb-1 block w-full rounded-xl px-4 py-3 text-right text-sm font-bold ${currentTab === item.id ? 'bg-violet-50 text-violet-700' : 'text-slate-600'}`}>{item.label}</a>)}</div>}
    </nav>

    <div className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-violet-100 bg-white/95 backdrop-blur-xl md:hidden" dir="rtl">
      <div className="grid grid-cols-5 gap-1 px-2 pb-[calc(env(safe-area-inset-bottom)+.5rem)] pt-2">{mobileNavItems.map((item) => { const Icon = item.icon; return <a key={item.id} href={item.href} onClick={(event) => { event.preventDefault(); goToTab(item.id); }} className={`flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black ${currentTab === item.id ? 'bg-violet-600 text-white shadow-lg shadow-violet-200' : 'text-slate-500'}`}><Icon className="h-5 w-5" />{item.label}</a>; })}</div>
    </div>

    {authOpen && createPortal(<div className="fixed inset-0 z-[9999] grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm" dir="rtl" onClick={() => setAuthOpen(false)}>
      <form onSubmit={recovering ? requestPasswordReset : handleAuthSubmit} onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-[32px] border-4 border-white bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between"><div><span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-white shadow-lg"><UserRound className="h-7 w-7" /></span><h2 className="mt-4 text-2xl font-black text-slate-950">{recovering ? 'بازیابی رمز عبور' : registering ? 'ساخت حساب هنرجو' : 'ورود به اسکیل آپ'}</h2><p className="mt-1 text-xs leading-6 text-slate-500">{recovering ? 'شماره حساب را وارد کن تا مدیر اسکیل‌آپ درخواستت را بررسی کند.' : registering ? 'حسابت را بساز و مسیرت را شروع کن.' : 'هنرجو با موبایل و مدیر با نام کاربری وارد می‌شود.'}</p></div><button type="button" onClick={() => setAuthOpen(false)} className="rounded-xl bg-slate-100 p-2 text-slate-500"><X className="h-5 w-5" /></button></div>
        {registering && !recovering && <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="نام و نام خانوادگی" className="input-admin mt-5 w-full" />}
        <input required value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder={registering ? 'شماره موبایل' : 'شماره موبایل یا نام کاربری'} className="input-admin mt-3 w-full" dir="ltr" />
        {!recovering && <input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="رمز عبور" className="input-admin mt-3 w-full" />}
        {authError && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{authError}</p>}
        {authNotice && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs font-bold leading-6 text-emerald-700">{authNotice}</p>}
        <button disabled={isSubmitting} className="mt-4 w-full rounded-2xl bg-gradient-to-l from-indigo-600 to-violet-600 py-3 text-sm font-black text-white shadow-lg shadow-violet-200">{isSubmitting ? 'در حال بررسی…' : recovering ? 'ثبت درخواست بازیابی' : registering ? 'ثبت‌نام و ورود' : 'ورود'}</button>
        {!registering && <button type="button" onClick={() => { setRecovering((value) => !value); setAuthError(''); setAuthNotice(''); }} className="mt-3 w-full py-2 text-xs font-bold text-sky-600">{recovering ? 'بازگشت به ورود' : 'رمز عبورم را فراموش کرده‌ام'}</button>}
        {!recovering && <button type="button" onClick={() => { setRegistering((value) => !value); setAuthError(''); }} className="w-full py-2 text-xs font-bold text-violet-600">{registering ? 'قبلاً حساب ساخته‌ام' : 'هنوز حساب هنرجویی ندارم'}</button>}
      </form>
    </div>, document.body)}

    {editingProfile && createPortal(<div className="fixed inset-0 z-[9999] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" dir="rtl" onClick={() => setEditingProfile(false)}>
      <form onSubmit={saveProfile} onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><h2 className="text-xl font-black">شخصیت خودت را بساز</h2><p className="mt-1 text-xs text-slate-500">این چهره در پنل شخصی تو دیده می‌شود.</p></div><button type="button" onClick={() => setEditingProfile(false)}><X /></button></div><div className="mt-5 grid grid-cols-4 gap-2">{avatars.map((item) => <button type="button" key={item} onClick={() => setAvatar(item)} className={`grid aspect-square place-items-center rounded-2xl text-3xl transition ${avatar === item ? 'scale-105 bg-violet-100 ring-2 ring-violet-500' : 'bg-slate-50 hover:bg-violet-50'}`}>{item}</button>)}</div><input required value={name} onChange={(event) => setName(event.target.value)} className="input-admin mt-4 w-full" placeholder="نام نمایشی" />{authError && <p className="mt-3 text-xs text-rose-600">{authError}</p>}<button disabled={isSubmitting} className="mt-4 w-full rounded-2xl bg-violet-600 py-3 text-sm font-black text-white">ذخیره پروفایل</button></form>
    </div>, document.body)}
  </>;
}
