import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ProjectShowcase from './components/ProjectShowcase';
import CoursesList from './components/CoursesList';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import Articles from './components/Articles';
import Footer from './components/Footer';
import TrialAssessment from './components/TrialAssessment';
import CertificateVerify from './components/CertificateVerify';
import Testimonials from './components/Testimonials';
import FreeScratchRegistration from './components/FreeScratchRegistration';
import ScratchDownloadArticle from './components/ScratchDownloadArticle';
import CourseDetail from './components/CourseDetail';
import MagazineArticle from './components/MagazineArticle';
import { AuthUser, UserRole } from './types';

const authUserKey = 'skillup_auth_user';
const tabFromPath = () => {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/signup') return 'signup';
  if (path === '/magazine/download-scratch') return 'scratch-download';
  if (path === '/magazine') return 'articles';
  if (path.startsWith('/magazine/')) return `article:${decodeURIComponent(path.slice('/magazine/'.length))}`;
  if (path === '/courses') return 'courses';
  if (path === '/projects') return 'projects';
  if (path === '/dashboard') return 'dashboard';
  if (path === '/admin') return 'admin';
  if (path.startsWith('/courses/')) return `course:${decodeURIComponent(path.slice('/courses/'.length))}`;
  return 'home';
};

const pathForTab = (tab: string) => {
  if (tab === 'signup') return '/signup';
  if (tab === 'scratch-download') return '/magazine/download-scratch';
  if (tab === 'articles') return '/magazine';
  if (tab === 'courses') return '/courses';
  if (tab === 'projects') return '/projects';
  if (tab === 'dashboard') return '/dashboard';
  if (tab === 'admin') return '/admin';
  if (tab.startsWith('article:')) return `/magazine/${encodeURIComponent(tab.slice('article:'.length))}`;
  if (tab.startsWith('course:')) return `/courses/${encodeURIComponent(tab.slice('course:'.length))}`;
  return '/';
};

export default function App() {
  const certificateCode = new URLSearchParams(window.location.search).get('certificate');
  const [currentTab, setCurrentTab] = useState<string>(tabFromPath);
  const [userRole, setUserRole] = useState<UserRole>('guest');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(authUserKey) || 'null') as AuthUser | null;
    } catch {
      return null;
    }
  });
  
  const [unlockedCourses, setUnlockedCourses] = useState<string[]>([]);
  const handleUnlockCourse = (courseId: string) => {
    if (!unlockedCourses.includes(courseId)) {
      setUnlockedCourses(prev => [...prev, courseId]);
    }
  };

  // Scroll to top on tab change for standard web routing behavior
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('skillup:navigation', { detail: { path: `${window.location.pathname}${window.location.search}` } }));
  }, [currentTab]);

  useEffect(() => {
    const onHistoryChange = () => setCurrentTab(tabFromPath());
    window.addEventListener('popstate', onHistoryChange);
    return () => window.removeEventListener('popstate', onHistoryChange);
  }, []);

  useEffect(() => {
    if (certificateCode) return;
    const targetPath = pathForTab(currentTab);
    if (window.location.pathname.replace(/\/+$/, '') !== targetPath) window.history.pushState({}, '', targetPath);
  }, [certificateCode, currentTab]);

  useEffect(() => {
    if (currentUser) setUserRole(currentUser.role);
  }, [currentUser]);

  useEffect(() => {
    const pages: Record<string, { title: string; description: string; index: boolean }> = {
      home: { title: 'اسکیل آپ | آموزش برنامه‌نویسی و هوش مصنوعی نوجوانان', description: 'آموزش پروژه‌محور برنامه‌نویسی، اسکرچ، هوش مصنوعی و مهارت‌های دیجیتال برای کودکان و نوجوانان همراه با مربی و پروژه واقعی.', index: true },
      courses: { title: 'دوره‌های برنامه‌نویسی کودکان و نوجوانان | اسکیل آپ', description: 'دوره‌های پروژه‌محور اسکرچ، برنامه‌نویسی، هوش مصنوعی و مهارت‌های دیجیتال اسکیل آپ را مقایسه و مسیر مناسب را انتخاب کنید.', index: true },
      projects: { title: 'پروژه‌های برنامه‌نویسی نوجوانان | اسکیل آپ', description: 'نمونه پروژه‌های واقعی هنرجویان اسکیل آپ در بازی‌سازی، اسکرچ، هوش مصنوعی و تولید محتوای دیجیتال را ببینید.', index: true },
      signup: { title: 'ثبت‌نام رایگان دوره مقدماتی اسکرچ | اسکیل آپ', description: 'فرم ثبت‌نام رایگان دوره مقدماتی اسکرچ برای کودکان و نوجوانان؛ اطلاعات را تکمیل کنید تا حساب و دسترسی دوره برایتان فعال شود.', index: true },
      articles: { title: 'مجله اسکیل آپ | آموزش برنامه‌نویسی و مهارت‌های دیجیتال نوجوانان', description: 'راهنماهای کاربردی اسکرچ، هوش مصنوعی، برنامه‌نویسی و رشد مهارت‌های دیجیتال برای نوجوانان و والدین.', index: true },
      dashboard: { title: 'پنل هنرجو | اسکیل آپ', description: 'فضای شخصی یادگیری هنرجوی اسکیل آپ.', index: false },
      admin: { title: 'پنل مدیریت | اسکیل آپ', description: 'مدیریت امن پلتفرم اسکیل آپ.', index: false },
    };
    const page = pages[currentTab];
    if (!page) return;
    document.title = page.title;
    document.head.querySelector('meta[name="description"]')?.setAttribute('content', page.description);
    document.head.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://skill-up.ir${pathForTab(currentTab)}`);
    let robots = document.head.querySelector('meta[name="robots"]');
    if (!robots) { robots = document.createElement('meta'); robots.setAttribute('name', 'robots'); document.head.appendChild(robots); }
    robots.setAttribute('content', page.index ? 'index, follow, max-image-preview:large' : 'noindex, nofollow');
  }, [currentTab]);

  if (certificateCode) return <CertificateVerify code={certificateCode} onBack={() => { window.history.replaceState({}, '', '/'); window.location.reload(); }} />;

  return (
    <div className="min-h-screen bg-white text-gray-950 flex flex-col justify-between selection:bg-indigo-500 selection:text-white pb-24 md:pb-0">
      {/* Dynamic Header */}
      <Navbar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        userRole={userRole} 
        setUserRole={setUserRole} 
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
      />

      {/* Main Content Router */}
      <main className="flex-grow">
        {currentTab === 'home' && (
          <div className="space-y-0">
            {/* 1. Hero & Consultation phone input */}
            <Hero />

            {/* مسیرهای اصلی بدون شلوغی بصری */}
            <CoursesList 
              onUnlockCourse={handleUnlockCourse} 
              unlockedCourses={unlockedCourses} 
              setCurrentTab={setCurrentTab} 
              studentName={currentUser?.role === 'student' ? currentUser.name : undefined}
            />

            <TrialAssessment goToCourses={() => setCurrentTab('courses')} />

            <ProjectShowcase />

            <Testimonials />

            {/* 6. Footer is appended automatically */}
          </div>
        )}

        {currentTab === 'courses' && (
          <CoursesList 
            onUnlockCourse={handleUnlockCourse} 
            unlockedCourses={unlockedCourses} 
            setCurrentTab={setCurrentTab} 
            studentName={currentUser?.role === 'student' ? currentUser.name : undefined}
          />
        )}

        {currentTab.startsWith('course:') && (
          <CourseDetail courseId={currentTab.slice('course:'.length)} studentName={currentUser?.role === 'student' ? currentUser.name : undefined} navigate={setCurrentTab} />
        )}

        {currentTab === 'projects' && (
          <ProjectShowcase />
        )}

        {currentTab === 'articles' && (
          <Articles navigate={setCurrentTab} />
        )}

        {currentTab === 'scratch-download' && (
          <ScratchDownloadArticle navigate={setCurrentTab} />
        )}

        {currentTab.startsWith('article:') && (
          <MagazineArticle slug={currentTab.slice('article:'.length)} navigate={setCurrentTab} />
        )}

        {currentTab === 'signup' && (
          <FreeScratchRegistration />
        )}

        {currentTab === 'dashboard' && (
          <Dashboard 
            unlockedCourses={unlockedCourses} 
            setCurrentTab={setCurrentTab} 
            studentName={currentUser?.role === 'student' ? currentUser.name : undefined}
          />
        )}

        {currentTab === 'admin' && (
          <AdminPanel />
        )}
      </main>

      {/* Shared Footer with direct messenger links */}
      <Footer />
    </div>
  );
}
