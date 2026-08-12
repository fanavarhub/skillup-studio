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
import { AuthUser, UserRole } from './types';

const authUserKey = 'skillup_auth_user';

export default function App() {
  const certificateCode = new URLSearchParams(window.location.search).get('certificate');
  const [currentTab, setCurrentTab] = useState<string>('home');
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
    if (currentUser) setUserRole(currentUser.role);
  }, [currentUser]);

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

        {currentTab === 'projects' && (
          <ProjectShowcase />
        )}

        {currentTab === 'articles' && (
          <Articles />
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
