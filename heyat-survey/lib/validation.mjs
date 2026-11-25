import { questions, priorityOptions, noSuggestion, QUESTIONNAIRE_VERSION, normalizePhone, validPhone } from '../dist/questionnaire.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function text(value, max, label) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new HttpError(400, `${label} نامعتبر است.`);
  return value.trim().replace(/\r\n?/g, '\n') || null;
}

export function validateSubmission(input) {
  if (!object(input)) throw new HttpError(400, 'ساختار پاسخ نامعتبر است.');
  const allowed = new Set(['questionnaire_version', 'submission_id', 'contact', 'answers', 'improvement_priorities', 'feedback']);
  if (Object.keys(input).some(key => !allowed.has(key))) throw new HttpError(400, 'فیلد ناشناخته در پاسخ وجود دارد.');
  if (input.questionnaire_version !== QUESTIONNAIRE_VERSION) throw new HttpError(400, 'لطفاً صفحه را تازه کنید و دوباره پاسخ دهید.');
  if (typeof input.submission_id !== 'string' || !/^[a-f0-9]{32}$/i.test(input.submission_id)) throw new HttpError(400, 'شناسهٔ ارسال نامعتبر است.');
  const contact = input.contact ?? {};
  if (!object(contact) || Object.keys(contact).some(key => !['full_name', 'phone'].includes(key))) throw new HttpError(400, 'مشخصات تماس نامعتبر است.');
  const fullName = text(contact.full_name, 100, 'نام');
  const rawPhone = text(contact.phone, 24, 'شماره تماس');
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (!validPhone(phone)) throw new HttpError(400, 'شماره تماس باید مانند 09101679458، یازده رقم و با ۰۹ شروع شود؛ یا خالی بماند.');
  if (!object(input.answers) || Object.keys(input.answers).some(key => !questions.some(question => question.id === key))) throw new HttpError(400, 'پاسخ پرسش‌ها نامعتبر است.');
  const answers = {};
  for (const question of questions) {
    const value = input.answers[question.id] ?? null;
    if (value !== null && ![...question.choices, ...question.alternatives].some(option => option[0] === value)) throw new HttpError(400, `پاسخ پرسش ${question.number} نامعتبر است.`);
    answers[question.id] = value;
  }
  const priorities = input.improvement_priorities ?? [];
  const allowedPriorities = new Set([...priorityOptions, noSuggestion].map(option => option[0]));
  if (!Array.isArray(priorities) || priorities.length > 3 || priorities.some(value => !allowedPriorities.has(value)) || new Set(priorities).size !== priorities.length || (priorities.includes(noSuggestion[0]) && priorities.length !== 1)) throw new HttpError(400, 'حداکثر سه اولویت انتخاب کنید؛ گزینهٔ پیشنهاد ندارم باید به‌تنهایی انتخاب شود.');
  const feedback = text(input.feedback, 2000, 'نظر آزاد');
  const absent = answers.attendance_days === 'not_attended';
  if (absent && (priorities.length || Object.entries(answers).some(([key, value]) => key !== 'attendance_days' && value !== null))) throw new HttpError(400, 'برای فردی که حضور نداشته، فقط بخش نظر آزاد قابل ثبت است.');
  if (!feedback && !priorities.length && !Object.entries(answers).some(([key, value]) => key !== 'attendance_days' && value !== null)) throw new HttpError(400, 'دست‌کم یک ارزیابی یا نظر بنویسید.');
  return { id: input.submission_id.toLowerCase(), version: QUESTIONNAIRE_VERSION, contact: { full_name: fullName, phone }, answers, priorities: [...priorities].sort(), feedback };
}
