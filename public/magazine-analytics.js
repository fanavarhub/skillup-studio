// Aggregate article reading signals without storing a reader identity or phone number.
(() => {
  let current = null;
  const articleSlug = () => /^\/magazine\/([a-z0-9-]+)\/?$/.exec(location.pathname)?.[1] || null;
  const scrollPercent = () => {
    const range = document.documentElement.scrollHeight - innerHeight;
    return range <= 0 ? 100 : Math.min(100, Math.max(0, Math.round(scrollY / range * 100)));
  };
  const sectionAtCenter = (sections) => {
    let selected = sections[0];
    for (const item of sections) {
      if (item.element.getBoundingClientRect().top <= innerHeight * 0.45) selected = item;
      else break;
    }
    return selected;
  };
  const sectionKey = (label, index) => {
    let hash = 2166136261;
    for (const character of label) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return `s${index.toString(36)}${(hash >>> 0).toString(36)}`;
  };
  const flush = async (visit, beacon = false) => {
    if (!visit.id || visit.sending || (!visit.pendingSeconds && visit.maxScroll <= visit.sentScroll)) return;
    const seconds = visit.pendingSeconds;
    const sections = [...visit.pendingSections.values()];
    const maxScroll = visit.maxScroll;
    visit.pendingSeconds = 0; visit.pendingSections.clear(); visit.sending = true;
    const seq = ++visit.seq;
    const url = `/api/magazine/${encodeURIComponent(visit.slug)}/visits/${visit.id}`;
    const body = JSON.stringify({ seq, activeSeconds: seconds, maxScroll, sections });
    if (beacon && navigator.sendBeacon) {
      const sent = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      if (sent) { visit.sentScroll = maxScroll; visit.sending = false; return; }
    }
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: beacon });
      if (!response.ok) throw new Error('analytics update failed');
      visit.sentScroll = maxScroll;
    } catch {
      visit.seq--;
      visit.pendingSeconds += seconds;
      for (const item of sections) {
        const old = visit.pendingSections.get(item.key);
        visit.pendingSections.set(item.key, { ...item, seconds: item.seconds + (old?.seconds || 0) });
      }
    } finally { visit.sending = false; }
  };
  const stop = () => {
    if (!current) return;
    clearInterval(current.timer);
    void flush(current, true);
    current = null;
  };
  const start = async () => {
    const slug = articleSlug();
    if (current?.slug === slug) return;
    stop();
    if (!slug) return;
    const headings = [...document.querySelectorAll('main h1, main h2')].slice(0, 60);
    if (!headings.length) return;
    const visit = { slug, id: null, seq: 0, sending: false, pendingSeconds: 0, pendingSections: new Map(), maxScroll: scrollPercent(), sentScroll: -1, lastActivity: Date.now(), sections: headings.map((element, index) => { const label = (element.textContent || '').trim().slice(0, 90); return { element, key: sectionKey(label, index), label }; }), timer: null };
    current = visit;
    try {
      const response = await fetch(`/api/magazine/${encodeURIComponent(slug)}/visits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok || current !== visit) return;
      visit.id = (await response.json()).visitId;
    } catch { return; }
    visit.timer = setInterval(() => {
      visit.maxScroll = Math.max(visit.maxScroll, scrollPercent());
      if (document.visibilityState === 'visible' && document.hasFocus() && Date.now() - visit.lastActivity < 30_000) {
        if (visit.pendingSeconds < 15) {
          visit.pendingSeconds++;
          const section = sectionAtCenter(visit.sections);
          if (section) {
            const old = visit.pendingSections.get(section.key);
            visit.pendingSections.set(section.key, { key: section.key, label: section.label, seconds: (old?.seconds || 0) + 1 });
          }
        }
      }
      if (visit.pendingSeconds >= 10 || (visit.maxScroll > visit.sentScroll && visit.pendingSeconds >= 3)) void flush(visit);
    }, 1000);
  };
  const activity = () => { if (current) { current.lastActivity = Date.now(); current.maxScroll = Math.max(current.maxScroll, scrollPercent()); } };
  for (const event of ['scroll', 'pointerdown', 'keydown', 'touchstart']) addEventListener(event, activity, { passive: true });
  addEventListener('visibilitychange', () => { if (document.hidden && current) void flush(current, true); else activity(); });
  addEventListener('pagehide', stop);
  addEventListener('skillup:navigation', () => requestAnimationFrame(() => requestAnimationFrame(start)));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(start), { once: true });
  else requestAnimationFrame(start);
})();
