import { questions, priorityOptions, noSuggestion, QUESTIONNAIRE_VERSION, normalizePhone, validPhone } from './questionnaire.js';
const form = document.querySelector('#survey-form');
const fa = new Intl.NumberFormat('fa-IR', { useGrouping: false });

function radioOption(question, option, alternative = false) {
  const [value, label] = option;
  const id = `${question.id}-${value}`;
  if (alternative) {
    return `<label class="alternative-choice" for="${id}"><input type="radio" id="${id}" name="${question.id}" value="${value}"><span class="alternative-surface"><span class="choice-control" aria-hidden="true"></span><span>${label}</span></span></label>`;
  }
  return `<label class="choice" for="${id}"><input type="radio" id="${id}" name="${question.id}" value="${value}"><span class="choice-surface"><span class="choice-control" aria-hidden="true"></span><span class="choice-text">${label}</span></span></label>`;
}

function renderQuestion(question) {
  const className = question.type === 'count' ? ' choices-count' : question.type === 'three' ? ' choices-three' : '';
  return `<fieldset class="question" id="question-${question.id}" data-question="${question.id}">
    <legend><span class="question-title"><span class="question-number">${fa.format(question.number)}.</span><span>${question.title}</span></span></legend>
    <div class="choices${className}">${question.choices.map(option => radioOption(question, option)).join('')}</div>
    <div class="answer-footer"><div class="alternative-choices">${question.alternatives.map(option => radioOption(question, option, true)).join('')}</div><button type="button" class="clear-answer" data-clear="${question.id}" aria-label="پاک‌کردن پاسخ پرسش ${fa.format(question.number)}" hidden>پاک‌کردن پاسخ</button></div>
  </fieldset>`;
}

for (const question of questions) {
  document.getElementById(question.section).insertAdjacentHTML('beforeend', renderQuestion(question));
}

function priorityOption(value, label, none = false) {
  return `<label class="priority-choice${none ? ' priority-none' : ''}" for="priority-${value}"><input type="checkbox" id="priority-${value}" name="improvement_priorities" value="${value}"><span class="priority-surface"><span class="checkbox-control" aria-hidden="true"></span><span>${label}</span></span></label>`;
}

document.querySelector('#priority-question').innerHTML = `<fieldset class="question" id="question-improvement_priorities" data-question="improvement_priorities" aria-describedby="priority-hint priority-error">
  <legend><span class="question-title"><span class="question-number">۱۴.</span><span>برای مراسم بعدی، اصلاح کدام بخش‌ها را مهم‌تر می‌دانید؟</span></span></legend>
  <p class="question-hint" id="priority-hint">حداکثر ۳ مورد را انتخاب کنید. برای توضیح گزینهٔ «سایر» از کادر نظر آزاد استفاده کنید.</p>
  <div class="priority-grid">${priorityOptions.map(([value, label]) => priorityOption(value, label)).join('')}</div>
  ${priorityOption(...noSuggestion, true)}
  <div class="priority-meta"><p id="priority-error" class="priority-error" role="status" aria-live="polite"></p><span class="priority-counter" id="priority-counter">۰ از ۳ مورد</span></div>
  <div class="answer-footer" id="priority-clear-row" hidden><span></span><button type="button" class="clear-answer" data-clear="improvement_priorities" aria-label="پاک‌کردن پاسخ پرسش ۱۴">پاک‌کردن پاسخ</button></div>
</fieldset>`;

const phone = document.querySelector('#phone');
const phoneError = document.querySelector('#phone-error');
const feedback = document.querySelector('#feedback');
const formError = document.querySelector('#form-error');
const priorityError = document.querySelector('#priority-error');
const dialog = document.querySelector('#completion-dialog');
const experienceRegions = [...document.querySelectorAll('[data-experience]')];
const submitButton = document.querySelector('#submit-button');
let submitted = false;
let submitting = false;
let submissionId = null;

function isAbsent() {
  return form.elements.attendance_days.value === 'not_attended';
}

function updateAttendance() {
  const absent = isAbsent();
  for (const region of experienceRegions) {
    region.hidden = absent;
    for (const control of region.querySelectorAll('input, button')) control.disabled = absent;
  }
  document.querySelector('#attendance-notice').hidden = !absent;
}

function priorityInputs() {
  return [...form.querySelectorAll('[name="improvement_priorities"]')];
}

function selectedPriorities() {
  return priorityInputs().filter(input => input.checked);
}

function updateProgress() {
  const activeQuestions = [...form.querySelectorAll('[data-question]')].filter(fieldset => {
    const input = fieldset.querySelector('input');
    return input && !input.disabled;
  });
  const answered = activeQuestions.filter(fieldset => fieldset.querySelector('input:checked')).length;
  const total = activeQuestions.length;
  const progress = document.querySelector('#completion-progress');
  progress.max = total;
  progress.value = answered;
  document.querySelector('#completion-count').textContent = `${fa.format(answered)} از ${fa.format(total)} پرسش`;
  for (const fieldset of activeQuestions) {
    const clear = fieldset.querySelector('[data-clear]');
    if (clear && clear.dataset.clear !== 'improvement_priorities') clear.hidden = !fieldset.querySelector('input:checked');
  }
  const selected = selectedPriorities();
  const hasNone = selected.some(input => input.value === 'no_suggestion');
  document.querySelector('#priority-counter').textContent = hasNone ? 'پیشنهاد مشخصی ندارم' : `${fa.format(selected.length)} از ۳ مورد`;
  document.querySelector('#priority-clear-row').hidden = selected.length === 0;
}

form.addEventListener('change', event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.name === 'improvement_priorities') {
    priorityError.textContent = '';
    const others = priorityInputs().filter(option => option !== input);
    if (input.checked && input.value === 'no_suggestion') {
      for (const other of others) other.checked = false;
    } else if (input.checked) {
      document.querySelector('#priority-no_suggestion').checked = false;
      if (selectedPriorities().length > 3) {
        input.checked = false;
        priorityError.textContent = 'حداکثر ۳ مورد را انتخاب کنید؛ ابتدا یکی از انتخاب‌ها را بردارید.';
      }
    }
  }
  if (input.name === 'attendance_days') updateAttendance();
  formError.hidden = true;
  updateProgress();
});

form.addEventListener('click', event => {
  const button = event.target.closest('[data-clear]');
  if (!button) return;
  const fieldset = button.closest('[data-question]');
  for (const input of fieldset.querySelectorAll('input')) input.checked = false;
  if (button.dataset.clear === 'attendance_days') updateAttendance();
  if (button.dataset.clear === 'improvement_priorities') priorityError.textContent = '';
  updateProgress();
  fieldset.querySelector('input')?.focus();
});

function validatePhone() {
  phone.value = normalizePhone(phone.value);
  const valid = validPhone(phone.value);
  phone.setAttribute('aria-invalid', String(!valid));
  phoneError.hidden = valid;
  phoneError.textContent = valid ? '' : 'شماره تماس باید ۱۱ رقم و با ۰۹ شروع شود؛ مانند 09101679458. می‌توانید این فیلد را خالی بگذارید.';
  return valid;
}

phone.addEventListener('blur', validatePhone);
phone.addEventListener('input', () => {
  phone.value = normalizePhone(phone.value);
  if (phone.getAttribute('aria-invalid') === 'true') validatePhone();
  formError.hidden = true;
});

feedback.addEventListener('input', () => {
  document.querySelector('#feedback-count').textContent = `${fa.format(feedback.value.length)} از ۲۰۰۰ نویسه`;
  formError.hidden = true;
});

// Missing answers and non-experience codes stay separate for later analysis.
function collectResponses() {
  const answers = {};
  for (const question of questions) {
    const checked = form.querySelector(`input[name="${question.id}"]:checked:not(:disabled)`);
    answers[question.id] = checked?.value ?? null;
  }
  return {
    questionnaire_version: QUESTIONNAIRE_VERSION,
    contact: {
      full_name: form.elements.full_name.value.trim() || null,
      phone: normalizePhone(phone.value) || null,
    },
    answers,
    improvement_priorities: isAbsent() ? [] : selectedPriorities().map(input => input.value),
    feedback: feedback.value.trim() || null,
  };
}

function setBusy(busy) {
  form.setAttribute('aria-busy', String(busy));
  for (const control of form.querySelectorAll('input, textarea, button')) control.disabled = busy || submitted;
  if (!busy && !submitted) updateAttendance();
  submitButton.textContent = busy ? 'در حال ثبت نظر…' : submitted ? 'نظر شما ثبت شد' : 'ارسال نظر';
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || submitted) return;
  formError.hidden = true;
  if (!validatePhone()) {
    formError.textContent = 'شماره تماس واردشده را اصلاح کنید یا این فیلد اختیاری را خالی بگذارید.';
    formError.hidden = false;
    phone.focus();
    phone.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const response = collectResponses();
  const hasAnswer = Object.entries(response.answers).some(([key, value]) => key !== 'attendance_days' && value !== null);
  if (!hasAnswer && !response.improvement_priorities.length && !response.feedback) {
    formError.textContent = isAbsent()
      ? 'اگر در مراسم حضور نداشتید، لطفاً نظر یا پیشنهادتان را در کادر بالا بنویسید.'
      : 'دست‌کم به یک پرسش ارزیابی پاسخ دهید یا نظری بنویسید.';
    formError.hidden = false;
    formError.focus();
    return;
  }
  submissionId ??= Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  response.submission_id = submissionId;
  submitting = true;
  setBusy(true);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const result = await fetch(new URL('api/responses', document.baseURI), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response), signal: controller.signal, credentials: 'same-origin',
    });
    const data = await result.json().catch(() => null);
    if (!result.ok || !data?.receipt) throw new Error(data?.message || 'ثبت نظر انجام نشد. لطفاً دوباره تلاش کنید.');
    submitted = true;
    form.dataset.submitted = 'true';
    dialog.showModal();
  } catch (error) {
    formError.textContent = error.name === 'AbortError' || error instanceof TypeError
      ? 'ارتباط با سرور برقرار نشد. پاسخ‌های شما حفظ شده‌اند؛ لطفاً دوباره ارسال کنید.'
      : error.message;
    formError.hidden = false;
    formError.focus();
  } finally {
    clearTimeout(timer);
    submitting = false;
    setBusy(false);
  }
});

for (const button of dialog.querySelectorAll('button')) {
  button.addEventListener('click', () => dialog.close());
}
dialog.addEventListener('click', event => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }
});

submitButton.disabled = false;
updateAttendance();
updateProgress();
