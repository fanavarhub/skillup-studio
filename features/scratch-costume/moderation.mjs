export function escapeMarkup(text) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text).replace(/[&<>"']/g, char => entities[char]);
}

const statuses = { pending: 'در انتظار بررسی', approved: 'منتشرشده', rejected: 'ردشده' };
const dateFormat = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' });

export function adminPage({ lessonPath, adminPath, title = 'مدیریت دیدگاه‌های قسمت ۱۱', requirePassword = false,
  message, entries, state, next, publicMessage = false }) {
  const home = publicMessage ? lessonPath : adminPath;
  const statusMessage = message ? `<p>${escapeMarkup(message)}</p>` : '';
  let content = statusMessage;

  if (requirePassword) {
    content = `<form class="admin-login" action="${adminPath}/login" method="post">
      ${statusMessage}<label for="admin-password">رمز مدیریت دیدگاه‌ها</label>
      <input id="admin-password" name="password" type="password" required autocomplete="current-password">
      <button class="button primary" type="submit">ورود</button>
    </form>`;
  } else if (entries) {
    const tabs = Object.entries(statuses).map(([key, label]) =>
      `<a class="button ${state === key ? 'primary' : 'white'}" href="${adminPath}?status=${key}"${state === key ? ' aria-current="page"' : ''}>${label}</a>`).join('');
    const records = entries.map(entry => `<article class="moderation-item">
      <strong>${escapeMarkup(entry.name)}</strong>
      <time datetime="${new Date(entry.created_at).toISOString()}">${escapeMarkup(dateFormat.format(entry.created_at))}</time>
      <p>${escapeMarkup(entry.body)}</p>
      <div>${entry.state !== 'approved' ? actionForm(entry, 'approved', 'تأیید و انتشار', adminPath) : ''}
        ${entry.state !== 'rejected' ? actionForm(entry, 'rejected', entry.state === 'approved' ? 'برداشتن از صفحه' : 'رد کردن', adminPath) : ''}
      </div>
    </article>`).join('');
    content = `<nav aria-label="وضعیت دیدگاه‌ها">${tabs}</nav>
      ${records || '<p>در این فهرست دیدگاهی نیست.</p>'}
      <div class="moderator-actions">
        ${next ? `<a class="button white" href="${adminPath}?status=${state}&amp;before=${next}">دیدگاه‌های قدیمی‌تر</a>` : ''}
        <form method="post" action="${adminPath}/logout"><button class="button white" type="submit">خروج</button></form>
      </div>`;
  }

  return `<!doctype html>
  <html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow"><title>${escapeMarkup(title)} | اسکیل‌آپ</title>
  <link rel="stylesheet" href="${lessonPath}/assets/lesson.css"></head>
  <body><main class="shell moderation">
  <a href="${home}${publicMessage ? '#comments' : ''}">${publicMessage ? 'بازگشت به دیدگاه‌های درس' : 'مدیریت دیدگاه‌ها'}</a>
  <h1>${escapeMarkup(title)}</h1>${content}<p><a href="${lessonPath}">دیدن صفحهٔ درس</a></p>
  </main></body></html>`;
}

function actionForm(entry, to, label, adminPath) {
  return `<form method="post" action="${adminPath}/update">
    <input type="hidden" name="id" value="${entry.id}">
    <input type="hidden" name="from" value="${entry.state}">
    <input type="hidden" name="to" value="${to}">
    <button type="submit" class="button ${to === 'approved' ? 'primary' : 'white'}">${label}</button>
  </form>`;
}
