import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, GraduationCap, HelpCircle, X } from 'lucide-react';

export interface TourStep {
  target: string;
  title: string;
  description: string;
  emoji?: string;
  onEnter?: () => void;
}

interface GuidedTourProps {
  steps: TourStep[];
  storageKey: string;
  autoStart?: boolean;
  accent?: 'indigo' | 'violet' | 'amber';
  launcherLabel?: string;
}

type Rect = { top: number; left: number; width: number; height: number; right: number; bottom: number };

const accentClasses = {
  indigo: 'from-indigo-600 to-blue-500 shadow-indigo-300/50',
  violet: 'from-violet-600 to-fuchsia-500 shadow-violet-300/50',
  amber: 'from-amber-500 to-orange-500 shadow-amber-300/50',
};

export default function GuidedTour({ steps, storageKey, autoStart = true, accent = 'violet', launcherLabel = 'راهنمای صفحه' }: GuidedTourProps) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const step = steps[index];

  const start = () => { setIndex(0); setReady(false); setActive(true); };
  const finish = () => {
    localStorage.setItem(storageKey, 'done');
    setActive(false); setRect(null); setReady(false);
  };

  useEffect(() => {
    if (!autoStart || localStorage.getItem(storageKey) || !steps.length) return;
    const timer = window.setTimeout(start, 700);
    return () => window.clearTimeout(timer);
  }, [autoStart, storageKey, steps.length]);

  useEffect(() => {
    if (!active || !step) return;
    setReady(false);
    step.onEnter?.();
    let cancelled = false;
    let attempt = 0;
    let timer = 0;
    const locate = () => {
      if (cancelled) return;
      const target = document.querySelector<HTMLElement>(step.target);
      if (!target) {
        attempt += 1;
        if (attempt < 30) timer = window.setTimeout(locate, 80);
        else if (index < steps.length - 1) setIndex((value) => value + 1);
        else finish();
        return;
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      timer = window.setTimeout(() => {
        if (cancelled) return;
        const box = target.getBoundingClientRect();
        const padding = window.innerWidth < 640 ? 6 : 10;
        setRect({
          top: Math.max(6, box.top - padding), left: Math.max(6, box.left - padding),
          width: Math.min(window.innerWidth - 12, box.width + padding * 2), height: Math.min(window.innerHeight - 12, box.height + padding * 2),
          right: Math.min(window.innerWidth - 6, box.right + padding), bottom: Math.min(window.innerHeight - 6, box.bottom + padding),
        });
        setReady(true);
      }, 420);
    };
    locate();
    const refresh = () => {
      const target = document.querySelector<HTMLElement>(step.target);
      if (!target) return;
      const box = target.getBoundingClientRect();
      const padding = window.innerWidth < 640 ? 6 : 10;
      setRect({ top: Math.max(6, box.top - padding), left: Math.max(6, box.left - padding), width: Math.min(window.innerWidth - 12, box.width + padding * 2), height: Math.min(window.innerHeight - 12, box.height + padding * 2), right: Math.min(window.innerWidth - 6, box.right + padding), bottom: Math.min(window.innerHeight - 6, box.bottom + padding) });
    };
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);
    return () => { cancelled = true; window.clearTimeout(timer); window.removeEventListener('resize', refresh); window.removeEventListener('scroll', refresh, true); };
  }, [active, index, step, steps.length]);

  useEffect(() => {
    if (!active) return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
      if (event.key === 'ArrowLeft') setIndex((value) => Math.min(steps.length - 1, value + 1));
      if (event.key === 'ArrowRight') setIndex((value) => Math.max(0, value - 1));
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); };
  }, [active, steps.length]);

  const position = useMemo(() => {
    if (!rect) return { top: 20, left: 12 };
    if (window.innerWidth < 640) return { left: 12, bottom: 12, width: window.innerWidth - 24 };
    const width = Math.min(370, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
    if (window.innerHeight - rect.bottom > 270) return { top: rect.bottom + 18, left, width };
    if (rect.top > 270) return { bottom: window.innerHeight - rect.top + 18, left, width };
    const estimatedHeight = 255;
    const vertical = Math.max(12, Math.min(window.innerHeight - estimatedHeight - 12, rect.top + rect.height / 2 - estimatedHeight / 2));
    if (rect.left > width + 30) return { top: vertical, left: rect.left - width - 18, width };
    if (window.innerWidth - rect.right > width + 30) return { top: vertical, left: rect.right + 18, width };
    return { bottom: 16, left, width };
  }, [rect, ready]);

  return <>
    <button onClick={start} className={`tour-launcher fixed bottom-[94px] left-4 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-l ${accentClasses[accent]} px-4 py-3 text-xs font-black text-white shadow-xl transition hover:-translate-y-1 md:bottom-6 md:left-6`} aria-label={launcherLabel}>
      <HelpCircle className="h-5 w-5" /><span className="hidden sm:inline">{launcherLabel}</span>
    </button>
    {active && step && rect && createPortal(<div className={`fixed inset-0 z-[10000] transition-opacity ${ready ? 'opacity-100' : 'opacity-0'}`} dir="rtl" role="dialog" aria-modal="true" aria-label={`راهنمای مرحله ${index + 1}`}>
      <div className="absolute left-0 top-0 w-full bg-slate-950/70 backdrop-blur-[2px]" style={{ height: rect.top }} />
      <div className="absolute left-0 bg-slate-950/70 backdrop-blur-[2px]" style={{ top: rect.top, width: rect.left, height: rect.height }} />
      <div className="absolute right-0 bg-slate-950/70 backdrop-blur-[2px]" style={{ top: rect.top, width: Math.max(0, window.innerWidth - rect.right), height: rect.height }} />
      <div className="absolute bottom-0 left-0 w-full bg-slate-950/70 backdrop-blur-[2px]" style={{ top: rect.bottom }} />
      <div className="pointer-events-none absolute rounded-2xl border-2 border-white bg-white/5 shadow-[0_0_0_5px_rgba(139,92,246,.5),0_0_35px_rgba(139,92,246,.65)] transition-all duration-300" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
      <div ref={popoverRef} className="absolute overflow-hidden rounded-[26px] border border-white/60 bg-white shadow-2xl" style={position}>
        <div className={`h-2 bg-gradient-to-l ${accentClasses[accent]}`} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-xl">{step.emoji || '✨'}</span><div><span className="text-[10px] font-black text-violet-600">مرحله {index + 1} از {steps.length}</span><h2 className="mt-1 text-lg font-black text-slate-950">{step.title}</h2></div></div>
            <button onClick={finish} className="rounded-xl bg-slate-100 p-2 text-slate-500" aria-label="بستن راهنما"><X className="h-4 w-4" /></button>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-600">{step.description}</p>
          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex gap-1.5">{steps.map((_, dot) => <span key={dot} className={`h-1.5 rounded-full transition-all ${dot === index ? 'w-6 bg-violet-600' : dot < index ? 'w-2 bg-emerald-400' : 'w-2 bg-slate-200'}`} />)}</div>
            <div className="flex gap-2">
              {index > 0 && <button onClick={() => setIndex((value) => value - 1)} className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"><ArrowRight className="h-4 w-4" />قبلی</button>}
              <button onClick={() => index === steps.length - 1 ? finish() : setIndex((value) => value + 1)} className={`inline-flex items-center gap-1 rounded-xl bg-gradient-to-l ${accentClasses[accent]} px-4 py-2 text-xs font-black text-white shadow-lg`}>{index === steps.length - 1 ? <><Check className="h-4 w-4" />تمام شد</> : <>بعدی<ArrowLeft className="h-4 w-4" /></>}</button>
            </div>
          </div>
          <p className="mt-3 text-center text-[10px] text-slate-400"><GraduationCap className="ml-1 inline h-3.5 w-3.5" />با کلیدهای جهت هم می‌توانی حرکت کنی.</p>
        </div>
      </div>
    </div>, document.body)}
  </>;
}
