import { questions, priorityOptions, noSuggestion, answerLabel } from './questionnaire.js';
const fa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'short', timeStyle: 'short' });
const $ = selector => document.querySelector(selector);
let csrf = '', page = 1, total = 0, searchTimer, requestNumber = 0;
const colors = ['#b9796e', '#cba285', '#8b9986', '#88b292', '#d5b777'];
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function percentage(value) { return value === null || value === undefined ? '—' : `${fa.format(value * 100)}٪`; }
async function api(path, options = {}) {
  const response = await fetch(new URL(`api/admin/${path}`, document.baseURI), { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== 'login') showLogin();
    throw new Error(data.message || 'دریافت اطلاعات ممکن نشد.');
  }
  return data;
}
function showLogin() { csrf = ''; $('#dashboard').hidden = true; $('#login-panel').hidden = false; $('#loading-message').hidden = true; }
function showDashboard() { $('#login-panel').hidden = true; $('#dashboard').hidden = false; $('#loading-message').hidden = true; }
function bar(value, fill, stacked = null) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 1000 20'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
  svg.classList.add(stacked ? 'distribution-svg' : 'bar-svg');
  let position = 1000;
  for (const segment of stacked || [{ width: value, color: fill }]) {
    const width = Math.max(0, Math.min(1, segment.width)) * 1000;
    position -= width;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    for (const [key, val] of Object.entries({ x: position, y: 0, width, height: 20, fill: segment.color })) rect.setAttribute(key, String(val));
    svg.append(rect);
  }
  return svg;
}
function metric(label, value, detail) {
  const card = node('div', 'metric');
  card.append(node('p', 'metric-label', label), node('p', 'metric-value', value), node('p', 'metric-detail', detail));
  return card;
}
function optionBar(label, count, base, color = '#d5b777') {
  const item = node('div', 'bar-item');
  const heading = node('div', 'bar-item-heading');
  heading.append(node('span', '', label), node('span', 'bar-value', `${fa.format(count)} نفر${base ? `، ${percentage(count / base)}` : ''}`));
  item.append(heading, bar(base ? count / base : 0, color));
  return item;
}
function chartFootnote(measure) {
  const noExperience = measure.alternatives.reduce((sum, option) => sum + option.count, 0);
  return `${fa.format(measure.valid)} پاسخ معتبر؛ ${fa.format(noExperience)} بدون ارزیابی؛ ${fa.format(measure.skipped)} بی‌پاسخ`;
}
function satisfactionCard(measure) {
  const card = node('article', 'chart-panel');
  const head = node('div', 'chart-head');
  head.append(node('h3', '', measure.title), node('span', 'chart-rate', `${percentage(measure.satisfaction_rate)} رضایت`));
  card.append(head);
  if (!measure.valid) card.append(node('p', 'empty-state', 'هنوز پاسخ معتبری برای این بخش ثبت نشده است.'));
  else {
    const plot = bar(0, '', measure.distribution.map((option, index) => ({ width: option.count / measure.valid, color: colors[index] })));
    const legend = node('div', 'chart-legend');
    measure.distribution.forEach((option, index) => {
      const item = node('span', 'legend-item');
      item.append(node('span', `legend-color tone-${index}`), node('span', '', `${option.label}: ${fa.format(option.count)}`));
      legend.append(item);
    });
    card.append(plot, legend);
  }
  card.append(node('p', 'chart-footnote', chartFootnote(measure)));
  return card;
}
function preferenceCard(measure) {
  const card = node('article', 'chart-panel');
  card.append(node('h3', '', measure.title));
  const options = node('div', 'option-bars');
  for (const option of measure.distribution) options.append(optionBar(option.label, option.count, measure.valid, option.value === 'suitable' ? '#88b292' : '#d5b777'));
  card.append(options, node('p', 'chart-footnote', chartFootnote(measure)));
  return card;
}
async function loadStats() {
  const data = await api('stats');
  $('#metric-grid').replaceChildren(metric('کل پاسخ‌ها', fa.format(data.total), 'از آغاز نظرسنجی'), metric('رضایت کلی', percentage(data.overall.satisfaction_rate), `از ${fa.format(data.overall.valid)} ارزیابی معتبر`), metric('پاسخ‌های امروز', fa.format(data.today), 'بر اساس ساعت تهران'), metric('نظرهای متنی', fa.format(data.comments), 'برای بررسی پیشنهادها و علت‌ها'));
  $('#satisfaction-grid').replaceChildren(...data.measures.filter(item => item.measure === 'satisfaction').map(satisfactionCard));
  $('#preferences-grid').replaceChildren(...data.measures.filter(item => item.measure === 'preference').map(preferenceCard));
  $('#priority-population').textContent = `${fa.format(data.priority_respondents)} پاسخ به این پرسش`;
  $('#priorities-chart').replaceChildren(...(data.priority_respondents ? data.priorities.map(item => optionBar(item.label, item.count, data.priority_respondents)) : [node('p', 'empty-state', 'با ثبت پاسخ‌ها، اولویت‌های بهبود اینجا نمایش داده می‌شوند.')]));
  const attendance = data.measures.find(item => item.measure === 'attendance');
  $('#attendance-chart').replaceChildren(...[...attendance.distribution, ...attendance.alternatives, { label: 'بدون پاسخ', count: attendance.skipped }].map(item => optionBar(item.label, item.count, data.total)));
}
function responseDetails(response) {
  const details = node('details', 'response-details');
  details.append(node('summary', '', 'جزئیات پاسخ'));
  const list = node('dl');
  for (const question of questions) list.append(node('dt', '', question.shortTitle), node('dd', '', answerLabel(question, response.answers[question.id])));
  const labels = new Map([...priorityOptions, noSuggestion]);
  list.append(node('dt', '', 'اولویت‌ها'), node('dd', '', response.priorities.map(value => labels.get(value)).join('؛ ') || 'بدون پاسخ'));
  details.append(list);
  return details;
}
async function loadResponses() {
  const thisRequest = ++requestNumber;
  const query = new URLSearchParams({ page: String(page), q: $('#response-search').value.trim() });
  const data = await api(`responses?${query}`);
  if (thisRequest !== requestNumber) return;
  total = data.total;
  const table = node('table');
  const caption = node('caption', 'sr-only', 'فهرست پاسخ‌های نظرسنجی');
  const header = node('thead'), headerRow = node('tr');
  for (const label of ['شناسه و زمان', 'نام', 'شماره تماس', 'رضایت کلی', 'نظر و جزئیات']) { const cell = node('th', '', label); cell.scope = 'col'; headerRow.append(cell); }
  header.append(headerRow);
  const body = node('tbody');
  for (const response of data.rows) {
    const row = node('tr');
    const idCell = node('td'); idCell.append(node('div', 'id-cell', response.id.slice(0, 12)), node('div', '', date.format(new Date(response.created_at))));
    const phone = node('td', 'phone-cell'); phone.append(node('bdi', '', response.contact.phone || '—'));
    const comment = node('td', 'comment-cell'); comment.append(node('div', '', response.feedback || 'نظر متنی ثبت نشده است.'), responseDetails(response));
    row.append(idCell, node('td', '', response.contact.full_name || 'بدون نام'), phone, node('td', '', answerLabel(questions.find(question => question.id === 'overall_satisfaction'), response.answers.overall_satisfaction)), comment);
    body.append(row);
  }
  if (!data.rows.length) { const row = node('tr'), cell = node('td', 'empty-state', data.total ? 'پاسخی در این صفحه نیست.' : 'پاسخی مطابق جست‌وجوی شما ثبت نشده است.'); cell.colSpan = 5; row.append(cell); body.append(row); }
  table.append(caption, header, body);
  $('#responses-table').replaceChildren(table);
  $('#page-label').textContent = `صفحه ${fa.format(page)} از ${fa.format(Math.max(1, Math.ceil(total / 25)))}`;
  $('#previous-page').disabled = page <= 1;
  $('#next-page').disabled = page * 25 >= total;
}
async function refresh() {
  $('#dashboard-error').hidden = true;
  $('#refresh-button').disabled = true;
  try { await Promise.all([loadStats(), loadResponses()]); }
  catch (error) { $('#dashboard-error').textContent = error.message; $('#dashboard-error').hidden = false; }
  finally { $('#refresh-button').disabled = false; }
}
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  $('#login-error').hidden = true;
  const password = $('#admin-password').value;
  if (!password) { $('#login-error').textContent = 'رمز مدیریت را وارد کنید.'; $('#login-error').hidden = false; return; }
  $('#login-button').disabled = true;
  try {
    const data = await api('login', { method: 'POST', body: JSON.stringify({ password }) });
    csrf = data.csrf_token; $('#admin-password').value = ''; showDashboard(); await refresh();
  } catch (error) { $('#login-error').textContent = error.message; $('#login-error').hidden = false; }
  finally { $('#login-button').disabled = false; }
});
$('#logout-button').addEventListener('click', async () => { try { await api('logout', { method: 'POST', body: '{}' }); showLogin(); } catch (error) { $('#dashboard-error').textContent = error.message; $('#dashboard-error').hidden = false; } });
$('#refresh-button').addEventListener('click', refresh);
$('#previous-page').addEventListener('click', () => { if (page > 1) { page--; refresh(); } });
$('#next-page').addEventListener('click', () => { if (page * 25 < total) { page++; refresh(); } });
$('#response-search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { page = 1; refresh(); }, 300); });
try { const data = await api('session'); if (data.authenticated) { csrf = data.csrf_token; showDashboard(); await refresh(); } else showLogin(); }
catch { showLogin(); $('#login-error').textContent = 'دریافت وضعیت ورود ممکن نشد؛ اتصال را بررسی و صفحه را تازه کنید.'; $('#login-error').hidden = false; }
