const nextPose = document.querySelector('#next-pose');
const progressAnimation = document.querySelector('.teen-progress');
const progressToggle = document.querySelector('#toggle-progress');
progressToggle.addEventListener('click', () => {
  const paused = progressAnimation.classList.toggle('is-paused');
  progressToggle.setAttribute('aria-pressed', String(paused));
  progressToggle.textContent = paused ? 'پخش انیمیشن' : 'توقف انیمیشن';
});
const playPoses = document.querySelector('#play-poses');
const stage = document.querySelector('#demo-pose');
const counter = document.querySelector('#pose-counter');
const announcement = document.querySelector('#pose-announcement');
const poseButtons = [...document.querySelectorAll('[data-pose]')];
const poses = [
  { className: 'pose-ready', count: 'آماده · ۱ از ۲', label: 'گربه آمادهٔ پرش' },
  { className: 'pose-jump', count: 'پرش · ۲ از ۲', label: 'گربه در حال پرش' },
];
let selectedPose = 0;
let animation;
function showPose(index, announce = false) {
  stage.classList.replace(poses[selectedPose].className, poses[index].className);
  selectedPose = index;
  stage.setAttribute('aria-label', poses[index].label);
  counter.textContent = poses[index].count;
  for (const button of poseButtons) button.setAttribute('aria-pressed', String(Number(button.dataset.pose) === index));
  if (announce) announcement.textContent = poses[index].count;
}
function stopAnimation() {
  window.clearInterval(animation); animation = undefined;
  playPoses.setAttribute('aria-pressed', 'false');
  playPoses.querySelector('span').textContent = 'پخش حرکت';
}
for (const button of [nextPose, playPoses, ...poseButtons]) button.disabled = false;
nextPose.addEventListener('click', () => { stopAnimation(); showPose(1 - selectedPose, true); });
for (const button of poseButtons) button.addEventListener('click', () => { stopAnimation(); showPose(Number(button.dataset.pose), true); });
playPoses.addEventListener('click', () => {
  if (animation) { stopAnimation(); announcement.textContent = 'حرکت متوقف شد.'; return; }
  const slow = matchMedia('(prefers-reduced-motion: reduce)').matches;
  animation = window.setInterval(() => showPose(1 - selectedPose), slow ? 950 : 560);
  playPoses.setAttribute('aria-pressed', 'true');
  playPoses.querySelector('span').textContent = 'توقف حرکت';
  announcement.textContent = 'پخش حرکت شروع شد.';
});
document.addEventListener('visibilitychange', () => { if (document.hidden && animation) stopAnimation(); });

const slug = 'scratch-costume-animation';
const endpoint = `/api/magazine/${slug}/comments`;
const form = document.querySelector('#comment-form');
const login = document.querySelector('#comment-login');
const formMessage = document.querySelector('#comment-status');
const feedMessage = document.querySelector('#comment-empty');
const feedStatus = document.querySelector('#feed-status');
const commentList = document.querySelector('#comment-list');
const older = document.querySelector('#older-comments');
const dateFormat = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeZone: 'Asia/Tehran' });
const token = () => localStorage.getItem('skillup_student_token') || localStorage.getItem('skillup_admin_token') || '';
let authenticated = false;
let nextCursor = null;
let allComments = [];
let pins = [];
const replyCache = new Map();
function status(message, error = false) { formMessage.textContent = message; formMessage.dataset.error = String(error); }
function node(tag, className, value) { const item = document.createElement(tag); if (className) item.className = className; if (value !== undefined) item.textContent = value; return item; }
async function loadSession() {
  try {
    const response = await fetch(`/api/magazine/${slug}/session`, { headers: token() ? { Authorization: `Bearer ${token()}` } : {} });
    const session = await response.json();
    authenticated = Boolean(session.authenticated);
    form.hidden = !authenticated; login.hidden = authenticated;
    if (authenticated) document.querySelector('#comment-identity').textContent = `با نام ${session.name} دیدگاه می‌گذاری.`;
  } catch { form.hidden = true; login.hidden = false; }
}
function renderComment(comment, byId, root = false) {
  const item = node(root ? 'li' : 'div', root ? 'published-comment' : 'comment-reply');
  if (!root) item.dataset.depth = String(comment.depth);
  const heading = node('header');
  heading.append(node('strong', '', comment.deleted ? 'دیدگاه حذف‌شده' : comment.name));
  if (!comment.deleted && comment.role === 'admin') heading.append(node('span', 'comment-badge', 'تیم اسکیل‌آپ'));
  if (comment.pin !== 'none') heading.append(node('span', 'comment-badge comment-pin', comment.pin === 'diamond' ? '💎 پین الماسی' : '⭐ پین طلایی'));
  const time = node('time', '', dateFormat.format(new Date(comment.createdAt))); time.dateTime = comment.createdAt; heading.append(time);
  item.append(heading);
  if (!root) item.append(node('p', 'reply-context', `در پاسخ به ${byId.get(comment.parentId)?.name || 'دیدگاه بالاتر'}`));
  item.append(node('p', '', comment.deleted ? 'این دیدگاه حذف شده است.' : comment.body));
  if (authenticated && !comment.deleted && comment.depth < 5) {
    const button = node('button', 'reply-action', 'پاسخ دادن'); button.type = 'button';
    button.addEventListener('click', () => {
      item.querySelector('.reply-form')?.remove();
      const reply = node('form', 'reply-form');
      const label = node('label', '', `پاسخ به ${comment.name}`);
      const box = node('textarea'); box.required = true; box.minLength = 2; box.maxLength = 1200; label.append(box);
      const submit = node('button', 'button primary', 'ثبت پاسخ'); submit.type = 'submit';
      reply.append(label, submit);
      reply.addEventListener('submit', async event => {
        event.preventDefault(); submit.disabled = true;
        try {
          const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ body: box.value, parentId: comment.id }) });
          const data = await response.json(); if (!response.ok) throw new Error(data.error || 'ارسال انجام نشد.');
          status('پاسخت همین حالا منتشر شد ✨'); await loadComments();
        } catch (error) { status(error.message, true); submit.disabled = false; }
      });
      item.append(reply); box.focus();
    });
    item.append(button);
  }
  for (const child of (byId.get(comment.id)?.children || [])) item.append(renderComment(child, byId));
  return item;
}
async function loadReplies(root, after = null) {
  const response = await fetch(`${endpoint}/${root.id}/replies${after ? `?after=${after}` : ''}`);
  if (!response.ok) throw new Error('پاسخ‌ها بارگیری نشدند.');
  const data = await response.json();
  const previous = replyCache.get(root.id);
  replyCache.set(root.id, { comments: after ? [...(previous?.comments || []), ...data.comments] : data.comments, next: data.next });
}
async function renderFeed() {
  commentList.replaceChildren();
  const ordered = [...pins, ...allComments.filter(item => !pins.some(pin => pin.id === item.id))];
  for (const root of ordered) {
    if (!replyCache.has(root.id)) await loadReplies(root);
    const { comments: replies, next } = replyCache.get(root.id);
    const byId = new Map([[root.id, { ...root, children: [] }]]);
    for (const reply of replies) byId.set(reply.id, { ...reply, children: [] });
    for (const reply of replies) byId.get(reply.parentId)?.children.push(byId.get(reply.id));
    const item = renderComment(byId.get(root.id), byId, true);
    if (next) {
      const more = node('button', 'reply-action', 'پاسخ‌های بیشتر'); more.type = 'button';
      more.addEventListener('click', async () => {
        more.disabled = true;
        try { await loadReplies(root, next); await renderFeed(); }
        catch { status('پاسخ‌های بیشتر بارگیری نشدند. دوباره تلاش کن.', true); more.disabled = false; }
      });
      item.append(more);
    }
    commentList.append(item);
  }
  commentList.hidden = !ordered.length; feedMessage.hidden = Boolean(ordered.length);
  older.hidden = !nextCursor;
}
async function loadComments(append = false) {
  older.disabled = true;
  try {
    const response = await fetch(`${endpoint}${append && nextCursor ? `?before=${nextCursor}` : ''}`);
    if (!response.ok) throw new Error('دیدگاه‌ها بارگیری نشدند.');
    const data = await response.json(); allComments = append ? [...allComments, ...data.comments] : data.comments; pins = data.pins; nextCursor = data.next;
    if (!append) replyCache.clear();
    await renderFeed(); feedStatus.textContent = '';
  } catch { feedStatus.textContent = 'دیدگاه‌ها بارگیری نشدند. صفحه را تازه کن و دوباره تلاش کن.'; }
  finally { older.disabled = false; }
}
older.addEventListener('click', () => loadComments(true));
form.addEventListener('submit', async event => {
  event.preventDefault(); const send = form.querySelector('button[type="submit"]'); send.disabled = true;
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ body: form.querySelector('textarea').value }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'ارسال انجام نشد.');
    form.reset(); status('دیدگاهت همین حالا منتشر شد ✨'); await loadComments();
  } catch (error) { status(error.message, true); }
  finally { send.disabled = false; }
});
await loadSession(); await loadComments();
