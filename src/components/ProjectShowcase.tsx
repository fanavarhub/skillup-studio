import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { StudentProject } from '../types';
import { Gamepad2, Heart, Maximize2, MonitorPlay, Play, Sparkles, Star, Trophy, UserRound, Video, Volume2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { authenticatedFetch } from '../api';

type CategoryFilter = 'all' | 'AI' | 'Game' | 'Communication';
type AiVideoSample = {
  id: string;
  hash: string;
  title: string;
  subtitle: string;
  description: string;
  tools: string;
  aiTools: string;
  accent: string;
};

const aiVideoSamples: AiVideoSample[] = [
  {
    id: 'aria-sasol',
    hash: 'lyv6ed0',
    title: 'تیزر تبلیغاتی آریا ساسول',
    subtitle: 'پروژه واقعی تبلیغاتی با فضای Cyber Security',
    description: 'سکانس‌های محصول با کمک هوش مصنوعی ساخته شده و با تدوین خلاقانه، جلوه‌های بصری و فوتیج‌های مرتبط به یک تیزر هدفمند تبدیل شده است.',
    tools: 'After Effects • Premiere Pro • Photoshop',
    aiTools: 'تولید سکانس‌های محصول با هوش مصنوعی',
    accent: 'from-cyan-400 to-indigo-500',
  },
  {
    id: 'ai-content-production',
    hash: 'hfq0455',
    title: 'نمونه پروژه تولید محتوای AI',
    subtitle: 'تصویر، ویدئو، صدا، گویندگی و تیزر تبلیغاتی',
    description: 'نمونه‌ای از یک پروژه واقعی که با ترکیب هوش مصنوعی و نرم‌افزارهای حرفه‌ای تولید محتوا ساخته شده و به هنرجو نشان می‌دهد AI فقط ابزار نیست؛ یک جریان کاری کامل است.',
    tools: 'After Effects • Premiere Pro • Photoshop',
    aiTools: 'Gemini • ChatGPT • Veo 3 • Flow • Firefly • Grok • Copilot',
    accent: 'from-fuchsia-400 to-violet-600',
  },
  {
    id: 'boya-brand',
    hash: 'qyy5818',
    title: 'تیزر تبلیغاتی برند بویا',
    subtitle: 'نمونه پروژه تیم Skill Up با AI و ابزارهای حرفه‌ای',
    description: 'یک نمونه مناسب برای مسیر Creative Media و AI Creator؛ هنرجو می‌بیند چطور ایده، پرامپت، تصویر، ویدئو و تدوین در کنار هم یک خروجی حرفه‌ای می‌سازند.',
    tools: 'After Effects • Premiere Pro • Photoshop',
    aiTools: 'Gemini • ChatGPT • Veo 3 • Flow • Firefly • Grok • Copilot',
    accent: 'from-amber-300 to-rose-500',
  },
];

function scratchEmbedUrl(project: StudentProject) {
  return project.embedUrl || (project.scratchId ? `https://scratch.mit.edu/projects/${project.scratchId}/embed` : '');
}

function aparatEmbedUrl(hash: string) {
  return `https://www.aparat.com/video/video/embed/videohash/${hash}/vt/frame`;
}

export default function ProjectShowcase() {
  const [projects, setProjects] = useState<StudentProject[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [activeProject, setActiveProject] = useState<StudentProject | null>(null);
  const [activeVideo, setActiveVideo] = useState<AiVideoSample | null>(null);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [frameLoading, setFrameLoading] = useState(false);
  const playerShellRef = useRef<HTMLDivElement>(null);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) setProjects(await response.json());
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (activeProject?.scratchId || activeVideo) setFrameLoading(true);
  }, [activeProject?.id, activeVideo?.id]);

  const featuredProjects = useMemo(() => projects.filter((project) => project.featured), [projects]);
  const filteredProjects = projects.filter((project) => selectedCategory === 'all' || project.category === selectedCategory);

  const handleLike = async (id: string, event: MouseEvent) => {
    event.stopPropagation();
    if (likedIds.includes(id)) return;
    try {
      const response = await authenticatedFetch(`/api/projects/${id}/like`, { method: 'POST' });
      if (response.ok) {
        const updatedProject = await response.json();
        setProjects((prev) => prev.map((project) => (project.id === id ? updatedProject : project)));
        setLikedIds((prev) => [...prev, id]);
      } else if (response.status === 401) {
        alert('برای پسندیدن پروژه ابتدا وارد حساب هنرجویی شوید.');
      }
    } catch (err) {
      console.error('Error liking project:', err);
    }
  };

  const handlePlayerFullscreen = async () => {
    try {
      await playerShellRef.current?.requestFullscreen?.();
    } catch (error) {
      console.error('Fullscreen request failed:', error);
    }
  };

  return (
    <section className="py-20 bg-white" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
          <div className="text-right space-y-2">
            <span className="text-indigo-600 font-sans font-bold text-xs sm:text-sm uppercase block">🏆 پورتفولیو و گالری آثار</span>
            <h2 className="font-sans text-3xl sm:text-4xl font-extrabold text-gray-950">پروژه‌های خلاقانه نوجوانان اسکیل آپ</h2>
            <p className="font-sans text-xs sm:text-sm text-gray-500 max-w-xl leading-relaxed">
              هر پروژه یک صفحه کوچک از مسیر رشد هنرجو است؛ می‌توانید دسته‌بندی کنید، پروژه‌های منتخب هفته را ببینید و با لایک از سازنده حمایت کنید.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 bg-gray-100 p-1.5 rounded-2xl w-full md:w-auto">
            <CategoryButton active={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')} label="همه پروژه‌ها" />
            <CategoryButton active={selectedCategory === 'Game'} onClick={() => setSelectedCategory('Game')} label="بازی‌سازی" icon={<Gamepad2 className="w-4 h-4 text-emerald-500" />} />
            <CategoryButton active={selectedCategory === 'AI'} onClick={() => setSelectedCategory('AI')} label="هوش مصنوعی" icon={<Sparkles className="w-4 h-4 text-purple-500" />} />
            <CategoryButton active={selectedCategory === 'Communication'} onClick={() => setSelectedCategory('Communication')} label="مذاکره و ارائه" icon={<Volume2 className="w-4 h-4 text-amber-500" />} />
          </div>
        </div>

        {featuredProjects.length > 0 && (
          <div className="mb-12 rounded-[2rem] bg-slate-950 text-white p-5 sm:p-6 overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,.35),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,.22),transparent_30%)]" />
            <div className="relative z-10 flex items-center gap-2 mb-5">
              <Star className="w-5 h-5 text-amber-300 fill-amber-300" />
              <h3 className="font-sans font-extrabold text-lg">پروژه‌های منتخب هفته</h3>
            </div>
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
              {featuredProjects.map((project) => (
                <button key={project.id} onClick={() => setActiveProject(project)} className="text-right rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 p-4 transition-all">
                  <div className="flex gap-4">
                    <img src={project.coverImage} alt={project.title} className="w-24 h-24 rounded-2xl object-cover shrink-0" />
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-200 font-sans font-bold">
                        <Trophy className="w-3.5 h-3.5" />
                        منتخب مربیان اسکیل آپ
                      </span>
                      <h4 className="font-sans font-extrabold text-white text-base">{project.title}</h4>
                      <p className="font-sans text-xs text-slate-300 line-clamp-2">{project.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="font-sans text-xs text-gray-500">در حال لود پروژه‌ها...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-gray-150 rounded-2xl">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-sans font-semibold text-gray-700">پروژه‌ای در این دسته یافت نشد</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProjects.map((project) => (
              <motion.div
                key={project.id}
                layout
                className="bg-gray-50 rounded-3xl border border-gray-100 overflow-hidden shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer flex flex-col h-full"
                onClick={() => setActiveProject(project)}
              >
                <div className="relative h-48 overflow-hidden bg-slate-900 shrink-0">
                  <img src={project.coverImage} alt={project.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500 opacity-90 group-hover:opacity-100" />
                  <div className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/95 backdrop-blur-md text-gray-900 shadow-md">
                    {project.category === 'Game' && <Gamepad2 className="w-4.5 h-4.5 text-emerald-600" />}
                    {project.category === 'AI' && <Sparkles className="w-4.5 h-4.5 text-purple-600" />}
                    {project.category === 'Communication' && <Volume2 className="w-4.5 h-4.5 text-amber-600" />}
                  </div>
                  {project.featured && (
                    <div className="absolute top-4 left-4 px-3 py-1 rounded-xl bg-amber-400 text-slate-950 text-[10px] font-sans font-black flex items-center gap-1">
                      <Star className="w-3 h-3 fill-slate-950" />
                      منتخب هفته
                    </div>
                  )}
                  {project.category === 'Game' && (
                    <div className="absolute inset-0 bg-indigo-950/55 backdrop-blur-xs flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 px-4">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveProject(project);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-indigo-700 font-sans text-xs font-black shadow-lg transform scale-95 group-hover:scale-100 transition-all"
                      >
                        <Play className="w-4 h-4 fill-indigo-600" />
                        نمایش در سایت
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-6 flex flex-col justify-between flex-1 text-right">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <img src={project.profileAvatar || project.coverImage} alt={project.studentName} className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm" />
                      <div>
                        <span className="text-xs text-indigo-600 font-sans font-bold block">{project.studentName}</span>
                        <span className="text-[10px] text-gray-400 font-sans">{project.studentAge} ساله</span>
                      </div>
                      {project.scratchId && <span className="mr-auto text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-sans font-semibold">قابل اجرا</span>}
                    </div>
                    <h3 className="font-sans font-extrabold text-gray-950 text-lg group-hover:text-indigo-600 transition-all">{project.title}</h3>
                    <p className="font-sans text-xs text-gray-500 leading-relaxed line-clamp-3">{project.description}</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-100/80 pt-4 mt-6">
                    <span className="text-[10px] text-gray-400 font-sans">ثبت‌شده در: {new Date(project.createdAt).toLocaleDateString('fa-IR')}</span>
                    <button
                      onClick={(event) => handleLike(project.id, event)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans font-bold cursor-pointer transition-all ${likedIds.includes(project.id) ? 'bg-rose-50 text-rose-600' : 'bg-gray-100 hover:bg-rose-50 text-gray-500 hover:text-rose-600'}`}
                    >
                      <Heart className={`w-4 h-4 ${likedIds.includes(project.id) ? 'fill-rose-500 stroke-rose-500' : ''}`} />
                      <span>{project.likes}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-20 border-t border-slate-200 pt-14">
          <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6 mb-8">
            <div className="text-right space-y-3">
              <span className="inline-flex items-center gap-2 text-purple-700 bg-purple-50 px-3 py-1.5 rounded-full font-sans text-xs font-black">
                <Video className="w-4 h-4" />
                نمونه پروژه‌های AI و تولید ویدئو
              </span>
              <h3 className="font-sans text-2xl sm:text-3xl font-extrabold text-slate-950">از پرامپت تا تیزر حرفه‌ای</h3>
              <p className="font-sans text-sm text-slate-500 leading-relaxed max-w-2xl">
                محتوای سایت قبلی Skill Up درباره ساخت تصویر، ویدئو، صدا، گویندگی، اینفوگرافیک و اتوماسیون با AI را اینجا به زبان پروژه‌محور نشان می‌دهیم؛ نوجوان می‌بیند خروجی مسیر AI Creator فقط آموزش تئوری نیست، بلکه یک نمونه‌کار واقعی و قابل ارائه است.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
              {['Prompt', 'Image', 'Video', 'Edit'].map((step) => (
                <div key={step} className="rounded-2xl bg-slate-950 text-white px-4 py-3 text-center">
                  <span className="block font-mono text-xs font-black">{step}</span>
                  <span className="block h-1 w-8 bg-purple-400 rounded-full mx-auto mt-2" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {aiVideoSamples.map((sample) => (
              <motion.article
                key={sample.id}
                layout
                className="group overflow-hidden rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-lg flex flex-col min-h-[420px]"
              >
                <button
                  type="button"
                  onClick={() => setActiveVideo(sample)}
                  className={`relative h-52 text-right overflow-hidden bg-gradient-to-br ${sample.accent} p-5 flex flex-col justify-between cursor-pointer`}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.35),transparent_28%),linear-gradient(135deg,rgba(15,23,42,.15),rgba(15,23,42,.65))]" />
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-[10px] font-sans font-black">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Video Project
                    </span>
                    <span className="w-12 h-12 rounded-full bg-white text-slate-950 flex items-center justify-center shadow-xl group-hover:scale-110 transition-all">
                      <Play className="w-5 h-5 fill-slate-950" />
                    </span>
                  </div>
                  <div className="relative z-10">
                    <p className="font-sans text-xs text-white/80 mb-2">{sample.subtitle}</p>
                    <h4 className="font-sans font-extrabold text-xl leading-tight">{sample.title}</h4>
                  </div>
                </button>

                <div className="p-5 flex flex-col justify-between flex-1 gap-5">
                  <p className="font-sans text-xs text-slate-300 leading-relaxed">{sample.description}</p>
                  <div className="space-y-3">
                    <InfoRow label="AI Usage" value={sample.aiTools} />
                    <InfoRow label="Creative Tools" value={sample.tools} />
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveVideo(sample)}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-slate-950 py-2.5 font-sans text-xs font-black hover:bg-purple-50 transition-all"
                    >
                      <MonitorPlay className="w-4 h-4" />
                      تماشای نمونه
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {activeProject && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 md:p-10" onClick={() => setActiveProject(null)}>
              <motion.div initial={{ scale: 0.95, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 15 }} className="bg-slate-900 border border-slate-800 text-white rounded-3xl overflow-hidden max-w-4xl w-full shadow-2xl flex flex-col md:flex-row text-right" onClick={(event) => event.stopPropagation()}>
                <div className="flex-1 bg-slate-950 p-6 flex items-center justify-center relative min-h-[320px] md:min-h-[440px]">
                  {activeProject.scratchId ? (
                    <div className="w-full h-full flex flex-col justify-center items-center">
                      <div ref={playerShellRef} className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800 relative">
                        {frameLoading && (
                          <div className="absolute inset-0 z-10 bg-slate-950 flex flex-col items-center justify-center gap-3 text-center px-6">
                            <div className="w-10 h-10 border-4 border-slate-700 border-t-emerald-400 rounded-full animate-spin" />
                            <p className="font-sans text-xs text-slate-300">در حال آماده‌سازی بازی...</p>
                            <p className="font-sans text-[11px] text-slate-500">چند لحظه صبر کنید تا پروژه آماده شود.</p>
                          </div>
                        )}
                        <iframe
                          src={scratchEmbedUrl(activeProject)}
                          title={`اجرای پروژه ${activeProject.title}`}
                          allow="autoplay; fullscreen"
                          className="absolute inset-0 w-full h-full"
                          frameBorder="0"
                          scrolling="no"
                          loading="eager"
                          allowFullScreen
                          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                          referrerPolicy="strict-origin-when-cross-origin"
                          onLoad={() => setFrameLoading(false)}
                        />
                      </div>
                      <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-3">
                        <p className="text-[11px] text-emerald-400 font-sans">برای شروع بازی، دکمه پرچم سبز را فشار دهید.</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handlePlayerFullscreen}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-slate-950 font-sans text-[11px] font-black hover:bg-emerald-50 transition-all"
                          >
                            <Maximize2 className="w-4 h-4" />
                            تمام‌صفحه
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
                        <Trophy className="w-8 h-8" />
                      </div>
                      <p className="font-sans font-bold text-slate-100">ارائه فیزیکی یا مستندات پروژه</p>
                      <p className="font-sans text-xs text-slate-400 max-w-xs leading-relaxed">این پروژه به‌صورت کارگاهی و با حضور منتورها بررسی شده است.</p>
                    </div>
                  )}
                </div>

                <div className="w-full md:w-96 p-6 border-t md:border-t-0 md:border-r border-slate-800 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-indigo-500/15 text-indigo-300 font-sans font-bold px-2 py-0.5 rounded-sm">{categoryLabel(activeProject.category)}</span>
                      <button onClick={() => setActiveProject(null)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <h3 className="font-sans font-bold text-xl text-white">{activeProject.title}</h3>
                    <p className="font-sans text-xs text-slate-400 leading-relaxed">{activeProject.description}</p>

                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <img src={activeProject.profileAvatar || activeProject.coverImage} alt={activeProject.studentName} className="w-12 h-12 rounded-full object-cover border border-white/20" />
                        <div>
                          <span className="font-sans font-extrabold text-white block">{activeProject.studentName}</span>
                          <span className="font-sans text-[11px] text-slate-400">{activeProject.studentAge} ساله</span>
                        </div>
                      </div>
                      <p className="font-sans text-xs text-slate-300 leading-relaxed flex gap-2">
                        <UserRound className="w-4 h-4 text-indigo-300 shrink-0 mt-0.5" />
                        {activeProject.profileBio || 'هنرجوی خلاق اسکیل آپ در مسیر ساخت پروژه‌های واقعی.'}
                      </p>
                    </div>

                  </div>

                  <div className="border-t border-slate-800 pt-4 mt-6 flex items-center justify-between">
                    <button onClick={(event) => handleLike(activeProject.id, event)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-sans font-bold cursor-pointer transition-all ${likedIds.includes(activeProject.id) ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400'}`}>
                      <Heart className={`w-4 h-4 ${likedIds.includes(activeProject.id) ? 'fill-rose-500 stroke-rose-500' : ''}`} />
                      <span>{activeProject.likes} پسند</span>
                    </button>
                    <button onClick={() => setActiveProject(null)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 font-sans text-xs font-semibold rounded-xl cursor-pointer text-slate-300">
                      بستن پنجره
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activeVideo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[60] flex items-center justify-center p-4 sm:p-6 md:p-10"
              onClick={() => setActiveVideo(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-slate-900 border border-slate-800 text-white rounded-3xl overflow-hidden max-w-5xl w-full shadow-2xl text-right"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-4 p-4 sm:p-5 border-b border-slate-800">
                  <div>
                    <span className="font-sans text-[11px] text-purple-300 font-bold">AI Creator • Creative Media</span>
                    <h3 className="font-sans font-extrabold text-lg sm:text-xl text-white mt-1">{activeVideo.title}</h3>
                  </div>
                  <button onClick={() => setActiveVideo(null)} className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">
                  <div className="bg-black p-3 sm:p-5">
                    <div ref={playerShellRef} className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-slate-800 relative">
                      {frameLoading && (
                        <div className="absolute inset-0 z-10 bg-slate-950 flex flex-col items-center justify-center gap-3 text-center">
                          <div className="w-10 h-10 border-4 border-slate-700 border-t-purple-400 rounded-full animate-spin" />
                          <p className="font-sans text-xs text-slate-300">در حال آماده‌سازی ویدئو...</p>
                        </div>
                      )}
                      <iframe
                        src={aparatEmbedUrl(activeVideo.hash)}
                        title={activeVideo.title}
                        className="absolute inset-0 w-full h-full"
                        allow="autoplay; fullscreen; picture-in-picture"
                        loading="eager"
                        allowFullScreen
                        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                        referrerPolicy="strict-origin-when-cross-origin"
                        onLoad={() => setFrameLoading(false)}
                      />
                    </div>
                    <div className="flex flex-wrap justify-between items-center gap-3 mt-3">
                      <p className="font-sans text-[11px] text-slate-400">نمونه واقعی برای الهام گرفتن از مسیر AI Creator و Creative Media.</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handlePlayerFullscreen}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-slate-950 font-sans text-[11px] font-black hover:bg-purple-50 transition-all"
                        >
                          <Maximize2 className="w-4 h-4" />
                          تمام‌صفحه
                        </button>
                      </div>
                    </div>
                  </div>

                  <aside className="p-5 sm:p-6 space-y-5 border-t lg:border-t-0 lg:border-r border-slate-800">
                    <div className={`h-2 rounded-full bg-gradient-to-l ${activeVideo.accent}`} />
                    <div>
                      <p className="font-sans text-xs text-slate-400 mb-2">{activeVideo.subtitle}</p>
                      <p className="font-sans text-sm text-slate-200 leading-relaxed">{activeVideo.description}</p>
                    </div>
                    <div className="space-y-3">
                      <InfoRow label="AI Tools" value={activeVideo.aiTools} />
                      <InfoRow label="Creative Tools" value={activeVideo.tools} />
                    </div>
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                      <h4 className="font-sans font-extrabold text-sm text-white mb-2">ارتباط با سایت جدید</h4>
                      <p className="font-sans text-xs text-slate-400 leading-relaxed">
                        این نمونه‌ها از محتوای سایت قبلی درباره تولید تصویر، ویدئو، صدا و پرامپت‌نویسی استفاده می‌کنند و می‌توانند خروجی نهایی مسیر «AI Creator» در پنل هنرجو باشند.
                      </p>
                    </div>
                  </aside>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function CategoryButton({ active, label, icon, onClick }: { active: boolean; label: string; icon?: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-sans font-bold transition-all cursor-pointer ${active ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-500 hover:text-gray-950'}`}>
      {icon}
      {label}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
      <span className="font-mono text-[10px] text-purple-300 font-black uppercase">{label}</span>
      <p className="font-sans text-xs text-slate-200 leading-relaxed mt-1">{value}</p>
    </div>
  );
}

function categoryLabel(category: StudentProject['category']) {
  if (category === 'Game') return 'بازی‌سازی اسکرچ';
  if (category === 'AI') return 'هوش مصنوعی';
  return 'مذاکره و بیان';
}
