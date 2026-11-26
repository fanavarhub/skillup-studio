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
  for (const button of poseButtons) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.pose) === index));
  }
  if (announce) announcement.textContent = poses[index].count;
}

function stopAnimation() {
  window.clearInterval(animation);
  animation = undefined;
  playPoses.setAttribute('aria-pressed', 'false');
  playPoses.querySelector('span').textContent = 'پخش حرکت';
}

for (const button of [nextPose, playPoses, ...poseButtons]) button.disabled = false;
nextPose.addEventListener('click', () => {
  stopAnimation();
  showPose(1 - selectedPose, true);
});
for (const button of poseButtons) {
  button.addEventListener('click', () => {
    stopAnimation();
    showPose(Number(button.dataset.pose), true);
  });
}
playPoses.addEventListener('click', () => {
  if (animation) {
    stopAnimation();
    announcement.textContent = 'حرکت متوقف شد.';
    return;
  }
  const slow = matchMedia('(prefers-reduced-motion: reduce)').matches;
  animation = window.setInterval(() => showPose(1 - selectedPose), slow ? 950 : 560);
  playPoses.setAttribute('aria-pressed', 'true');
  playPoses.querySelector('span').textContent = 'توقف حرکت';
  announcement.textContent = 'پخش حرکت شروع شد.';
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && animation) stopAnimation();
});

const form = document.querySelector('#comment-form');
const formMessage = document.querySelector('#comment-status');
const feedMessage = document.querySelector('#comment-empty');
const feedStatus = document.querySelector('#feed-status');
const commentList = document.querySelector('#comment-list');
const older = document.querySelector('#older-comments');
const sendButton = form.querySelector('button');
const dateFormat = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeZone: 'Asia/Tehran' });
let nextCursor;

function showFormMessage(text, isError) {
  formMessage.textContent = text;
  formMessage.dataset.error = String(isError);
}

function addComment(comment) {
  const item = document.createElement('li');
  item.className = 'published-comment';
  const heading = document.createElement('header');
  const name = document.createElement('strong');
  const time = document.createElement('time');
  const body = document.createElement('p');
  name.textContent = comment.name;
  time.dateTime = comment.createdAt;
  time.textContent = dateFormat.format(new Date(comment.createdAt));
  body.textContent = comment.body;
  heading.append(name, time);
  item.append(heading, body);
  commentList.append(item);
}

async function loadComments(append = false) {
  const url = new URL(form.action);
  if (append && nextCursor) url.searchParams.set('before', nextCursor);
  older.disabled = true;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Could not load comments');
    const { comments, next } = await response.json();
    if (!append) commentList.replaceChildren();
    comments.forEach(addComment);
    nextCursor = next;
    commentList.hidden = commentList.childElementCount === 0;
    feedMessage.hidden = !commentList.hidden;
    older.hidden = !next;
    feedStatus.textContent = '';
  } catch {
    const message = 'دیدگاه‌ها الان بارگیری نشدن. دوباره امتحان کن.';
    if (append) {
      showFormMessage(message, true);
    } else {
      feedStatus.textContent = 'دیدگاه‌ها بارگیری نشدن. برای تلاش دوباره صفحه رو تازه کن.';
    }
  } finally {
    older.disabled = false;
  }
}
older.addEventListener('click', () => loadComments(true));
loadComments();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  sendButton.disabled = true;
  form.setAttribute('aria-busy', 'true');
  showFormMessage('در حال ارسال دیدگاه…', false);
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      showFormMessage(result.message, true);
      return;
    }
    form.reset();
    showFormMessage(result.message, false);
  } catch {
    showFormMessage('ارسال انجام نشد. متن دیدگاهت هنوز اینجاست. دوباره امتحان کن.', true);
  } finally {
    sendButton.disabled = false;
    form.removeAttribute('aria-busy');
  }
});
