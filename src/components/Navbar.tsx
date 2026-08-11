import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AuthUser, UserRole } from '../types';
import { BookOpen, GraduationCap, Home, Images, LayoutDashboard, LogIn, Menu, Newspaper, ShieldCheck, User, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { studentTokenKey } from '../api';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  currentUser: AuthUser | null;
  setCurrentUser: (user: AuthUser | null) => void;
}

type AuthMode = 'login' | 'register' | 'admin';

const authUserKey = 'skillup_auth_user';
const adminTokenKey = 'skillup_admin_token';

export default function Navbar({ currentTab, setCurrentTab, userRole, setUserRole, currentUser, setCurrentUser }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navItems = [
    { id: 'home', label: 'صفحه اصلی' },
    { id: 'courses', label: 'دوره‌های آموزشی' },
    { id: 'projects', label: 'پروژه‌های نوجوانان' },
    { id: 'articles', label: 'مجله اسکیل آپ' },
  ];

  const roleLabel = userRole === 'admin' ? 'مدیر' : userRole === 'student' ? 'هنرجو' : 'بازدیدکننده';

  useEffect(() => {
    if (!authOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [authOpen]);

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthError('');
    setAuthOpen(true);
  };

  const handleLogout = () => {
    localStorage.removeItem(authUserKey);
    localStorage.removeItem(adminTokenKey);
    localStorage.removeItem(studentTokenKey);
    setCurrentUser(null);
    setUserRole('guest');
    if (currentTab === 'dashboard' || currentTab === 'admin') setCurrentTab('home');
  };

  const handlePanelClick = (target: 'dashboard' | 'admin') => {
    if (target === 'dashboard') {
      if (userRole === 'student') {
        setCurrentTab('dashboard');
      } else {
        openAuth('login');
      }
    } else if (userRole === 'admin') {
      setCurrentTab('admin');
    } else {
      openAuth('admin');
    }
    setMenuOpen(false);
  };

  const handleMobilePanelClick = () => {
    if (userRole === 'admin') {
      setCurrentTab('admin');
    } else if (userRole === 'student') {
      setCurrentTab('dashboard');
    } else {
      openAuth('login');
    }
    setMenuOpen(false);
  };

  const goToTab = (tab: string) => {
    setCurrentTab(tab);
    setMenuOpen(false);
  };

  const mobileNavItems: Array<{ id: string; label: string; icon: LucideIcon; onClick: () => void; active: boolean }> = [
    { id: 'home', label: 'خانه', icon: Home, onClick: () => goToTab('home'), active: currentTab === 'home' },
    { id: 'courses', label: 'دوره‌ها', icon: BookOpen, onClick: () => goToTab('courses'), active: currentTab === 'courses' },
    { id: 'projects', label: 'پروژه‌ها', icon: Images, onClick: () => goToTab('projects'), active: currentTab === 'projects' },
    { id: 'articles', label: 'مجله', icon: Newspaper, onClick: () => goToTab('articles'), active: currentTab === 'articles' },
    { id: 'panel', label: 'پنل', icon: LayoutDashboard, onClick: handleMobilePanelClick, active: currentTab === 'dashboard' || currentTab === 'admin' },
  ];

  const handleAuthSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAuthError('');
    setIsSubmitting(true);
    try {
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = authMode === 'register'
        ? { name, phone, password }
        : authMode === 'admin'
          ? { mode: 'admin', password }
          : { phone, password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      localStorage.setItem(authUserKey, JSON.stringify(user));
      setCurrentUser(user);
      setUserRole(user.role);
      setAuthOpen(false);
      setPassword('');
      if (user.role === 'admin') setCurrentTab('admin');
      if (user.role === 'student') setCurrentTab('dashboard');
    } catch {
      setAuthError('ارتباط با سرور برقرار نشد.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const authModal = authOpen
    ? createPortal(
      <div
        className="fixed inset-0 z-[9999] isolate bg-slate-950/65 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 py-6"
        dir="rtl"
        role="dialog"
        aria-modal="true"
        onClick={() => setAuthOpen(false)}
      >
        <form
          onSubmit={handleAuthSubmit}
          onClick={(event) => event.stopPropagation()}
          className="relative z-10 bg-white rounded-3xl p-5 sm:p-7 w-full max-w-md shadow-2xl space-y-5 text-right mt-2 sm:mt-0"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-sans font-extrabold text-xl text-slate-950">
                {authMode === 'register' ? 'ثبت‌نام هنرجو' : authMode === 'admin' ? 'ورود مدیر' : 'ورود هنرجو'}
              </h3>
              <p className="font-sans text-xs text-slate-500 mt-1">ورود هنرجو و مدیر از همین بخش انجام می‌شود.</p>
            </div>
            <button type="button" onClick={() => setAuthOpen(false)} className="p-2 rounded-xl bg-slate-100 text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1 rounded-2xl">
            <button type="button" onMouseDown={(event) => { event.preventDefault(); setAuthMode('login'); }} onClick={() => setAuthMode('login')} className={`py-2 rounded-xl font-sans text-xs font-bold ${authMode === 'login' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'}`}>ورود</button>
            <button type="button" onMouseDown={(event) => { event.preventDefault(); setAuthMode('register'); }} onClick={() => setAuthMode('register')} className={`py-2 rounded-xl font-sans text-xs font-bold ${authMode === 'register' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'}`}>ثبت‌نام</button>
            <button type="button" onMouseDown={(event) => { event.preventDefault(); setAuthMode('admin'); }} onClick={() => setAuthMode('admin')} className={`py-2 rounded-xl font-sans text-xs font-bold ${authMode === 'admin' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-500'}`}>مدیر</button>
          </div>

          {authMode === 'register' && (
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="نام و نام خانوادگی هنرجو" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-sans outline-none focus:ring-2 focus:ring-indigo-200" />
          )}
          {authMode !== 'admin' && (
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="شماره موبایل: 09123456789" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-sans outline-none focus:ring-2 focus:ring-indigo-200" dir="ltr" />
          )}
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={authMode === 'admin' ? 'رمز مدیر' : 'رمز عبور'} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-sans outline-none focus:ring-2 focus:ring-indigo-200" />

          {authError && <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-sans font-bold">{authError}</div>}

          <button disabled={isSubmitting} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-sans font-bold text-sm">
            {isSubmitting ? 'در حال بررسی...' : authMode === 'register' ? 'ثبت‌نام و ورود به پنل' : 'ورود'}
          </button>
          {authMode === 'admin' && <p className="font-sans text-[11px] text-slate-400">رمز مدیریت از تنظیمات امن سرور خوانده می‌شود.</p>}
        </form>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-xs" dir="rtl">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 md:h-20">
          <div className="flex items-center gap-8">
            <button onClick={() => setCurrentTab('home')} className="flex items-center gap-3 focus:outline-hidden cursor-pointer">
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                <GraduationCap className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div className="text-right">
                <span className="font-sans font-bold text-lg md:text-xl text-gray-900 block leading-tight">اسکیل آپ</span>
                <span className="font-sans text-[11px] md:text-xs text-indigo-600 font-medium block">Skill Up</span>
              </div>
            </button>

            <div className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setMenuOpen(false);
                  }}
                  className={`font-sans text-sm font-medium transition-all duration-200 relative py-2 cursor-pointer ${
                    currentTab === item.id ? 'text-indigo-600 font-bold' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                  {currentTab === item.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => handlePanelClick('dashboard')} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold font-sans transition-all cursor-pointer ${currentTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
              <User className="w-4 h-4" />
              پنل هنرجو
            </button>
            <button onClick={() => handlePanelClick('admin')} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold font-sans transition-all cursor-pointer ${currentTab === 'admin' ? 'bg-amber-50 text-amber-800 ring-2 ring-amber-100' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
              <ShieldCheck className="w-4 h-4" />
              پنل مدیریت
            </button>
            <div className="h-8 w-px bg-gray-200" />
            <div className="px-3.5 py-2 rounded-xl bg-gray-100 text-gray-600 font-sans text-xs font-bold">
              نقش فعلی: <span className="text-gray-950">{roleLabel}</span>
              {currentUser?.name && <span className="text-indigo-600 mr-1">({currentUser.name})</span>}
            </div>
            {currentUser ? (
              <button onClick={handleLogout} className="px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 font-sans text-xs font-bold">خروج</button>
            ) : (
              <button onClick={() => openAuth('login')} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white font-sans text-xs font-bold">
                <LogIn className="w-4 h-4" />
                ورود / ثبت‌نام
              </button>
            )}
          </div>

          <div className="flex items-center md:hidden gap-2">
            <div className="hidden min-[380px]:block px-2 py-1 rounded-lg bg-gray-50 text-[10px] font-sans font-black text-gray-500">
              {roleLabel}
            </div>
            <button onClick={() => (currentUser ? handleMobilePanelClick() : openAuth('login'))} className="p-2 rounded-lg bg-gray-100 text-gray-600" title={currentUser ? 'پنل' : 'ورود'}>
              <User className="w-5 h-5" />
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg text-gray-500 hover:text-gray-900 focus:outline-hidden cursor-pointer">
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 pt-2 pb-6 space-y-2">
          <div className="px-4 py-2 rounded-xl bg-gray-50 text-xs font-sans font-bold text-gray-600">
            نقش فعلی: <span className="text-gray-950">{roleLabel}</span>
          </div>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentTab(item.id);
                setMenuOpen(false);
              }}
              className={`w-full text-right block px-4 py-2.5 rounded-xl font-sans text-sm font-semibold cursor-pointer ${currentTab === item.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {item.label}
            </button>
          ))}
          <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
            <button onClick={() => handlePanelClick('dashboard')} className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-gray-50 text-gray-700 text-sm font-semibold cursor-pointer">
              <span>پنل هنرجو اسکیل آپ</span>
              <User className="w-4 h-4 text-indigo-500" />
            </button>
            <button onClick={() => handlePanelClick('admin')} className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-gray-50 text-gray-700 text-sm font-semibold cursor-pointer">
              <span>پنل مدیریت سیستم</span>
              <ShieldCheck className="w-4 h-4 text-amber-500" />
            </button>
            {currentUser ? (
              <button onClick={handleLogout} className="w-full px-4 py-2.5 rounded-xl bg-rose-50 text-rose-700 text-sm font-bold">خروج</button>
            ) : (
              <button onClick={() => openAuth('login')} className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold">ورود / ثبت‌نام</button>
            )}
          </div>
        </div>
      )}

    </nav>
    <div className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-10px_30px_rgba(15,23,42,0.10)] mobile-bottom-nav" dir="rtl">
      <div className="grid grid-cols-5 gap-1 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`min-w-0 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 font-sans text-[10px] font-black transition-all ${
                item.active
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="truncate max-w-full px-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
    {authModal}
    </>
  );
}
