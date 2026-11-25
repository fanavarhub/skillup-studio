export const QUESTIONNAIRE_VERSION = '1.0';
const fa = new Intl.NumberFormat('fa-IR', { useGrouping: false });
export const satisfaction = [['1', 'بسیار ناراضی'], ['2', 'ناراضی'], ['3', 'نه راضی و نه ناراضی'], ['4', 'راضی'], ['5', 'بسیار راضی']];
export const duration = [['too_short', 'خیلی کوتاه'], ['slightly_short', 'کمی کوتاه'], ['suitable', 'مناسب'], ['slightly_long', 'کمی طولانی'], ['too_long', 'خیلی طولانی']];
const notExperienced = ['not_experienced', 'این بخش را نشنیدم'];
const cannotAssess = ['unable_to_assess', 'امکان ارزیابی ندارم'];

export const questions = [
  { number: 1, id: 'attendance_days', section: 'attendance-question', title: 'در چند روز از این مراسم پنج‌روزه حضور داشتید؟', shortTitle: 'میزان حضور', type: 'count', measure: 'attendance', choices: [1, 2, 3, 4, 5].map(day => [String(day), `${fa.format(day)} روز`]), alternatives: [['not_attended', 'در این مراسم حضور نداشتم']] },
  { number: 2, id: 'overall_satisfaction', section: 'general-questions', title: 'در مجموع، چقدر از مراسم رضایت داشتید؟', shortTitle: 'رضایت کلی', measure: 'satisfaction', choices: satisfaction, alternatives: [cannotAssess] },
  { number: 3, id: 'start_time', section: 'general-questions', title: 'ساعت شروع مراسم برای شما چگونه بود؟', shortTitle: 'ساعت شروع', measure: 'preference', choices: [['too_early', 'خیلی زود'], ['slightly_early', 'کمی زود'], ['suitable', 'مناسب'], ['slightly_late', 'کمی دیر'], ['too_late', 'خیلی دیر']], alternatives: [cannotAssess] },
  { number: 4, id: 'venue_satisfaction', section: 'general-questions', title: 'از محل برگزاری مراسم چقدر رضایت داشتید؟', shortTitle: 'محل برگزاری', measure: 'satisfaction', choices: satisfaction, alternatives: [cannotAssess] },
  { number: 5, id: 'speech_satisfaction', section: 'program-questions', title: 'از سخنرانی‌های مراسم در مجموع چقدر رضایت داشتید؟', shortTitle: 'سخنرانی‌ها', measure: 'satisfaction', choices: satisfaction, alternatives: [notExperienced] },
  { number: 6, id: 'speech_duration', section: 'program-questions', title: 'مدت سخنرانی‌ها برای شما چگونه بود؟', shortTitle: 'مدت سخنرانی', measure: 'preference', choices: duration, alternatives: [notExperienced] },
  { number: 7, id: 'recitation_satisfaction', section: 'program-questions', title: 'از اجرای مداحان در مجموع چقدر رضایت داشتید؟', shortTitle: 'اجرای مداحان', measure: 'satisfaction', choices: satisfaction, alternatives: [notExperienced] },
  { number: 8, id: 'reciter_count', section: 'program-questions', title: 'تعداد مداحان در هر نوبت مراسم را چطور ارزیابی می‌کنید؟', shortTitle: 'تعداد مداحان', type: 'three', measure: 'preference', choices: [['too_few', 'کمتر از حد مناسب'], ['suitable', 'مناسب'], ['too_many', 'بیشتر از حد مناسب']], alternatives: [cannotAssess] },
  { number: 9, id: 'hospitality_satisfaction', section: 'service-questions', title: 'از پذیرایی مراسم در مجموع چقدر رضایت داشتید؟', shortTitle: 'پذیرایی', measure: 'satisfaction', choices: satisfaction, alternatives: [['not_experienced', 'از پذیرایی استفاده نکردم']] },
  { number: 10, id: 'sound_satisfaction', section: 'service-questions', title: 'از کیفیت صدای مراسم چقدر رضایت داشتید؟', shortTitle: 'کیفیت صوت', measure: 'satisfaction', choices: satisfaction, alternatives: [cannotAssess] },
  { number: 11, id: 'women_space_satisfaction', section: 'service-questions', title: 'اگر از فضای خواهران استفاده کرده‌اید، چقدر از آن رضایت داشتید؟', shortTitle: 'فضای خواهران', measure: 'satisfaction', choices: satisfaction, alternatives: [['not_experienced', 'از این فضا استفاده نکردم']] },
  { number: 12, id: 'total_duration', section: 'service-questions', title: 'مدت کل هر نوبت مراسم برای شما چگونه بود؟', shortTitle: 'مدت کل مراسم', measure: 'preference', choices: duration, alternatives: [cannotAssess] },
  { number: 13, id: 'children_satisfaction', section: 'service-questions', title: 'از بخش خواندن نونهالان چقدر رضایت داشتید؟', shortTitle: 'بخش نونهالان', measure: 'satisfaction', choices: satisfaction, alternatives: [['not_experienced', 'این بخش را ندیدم یا نشنیدم']] },
];

export const priorityOptions = [
  ['start_time', 'ساعت شروع'], ['venue', 'محل برگزاری'], ['speech', 'سخنرانی‌ها'], ['speech_duration', 'مدت سخنرانی'],
  ['recitation', 'اجرای مداحان'], ['reciter_count', 'تعداد مداحان'], ['hospitality', 'پذیرایی'], ['sound', 'صوت'],
  ['women_space', 'فضای خواهران'], ['total_duration', 'مدت کل و پایان مراسم'], ['children', 'بخش نونهالان'], ['other', 'سایر'],
];
export const noSuggestion = ['no_suggestion', 'در حال حاضر پیشنهاد مشخصی ندارم'];

export function normalizeDigits(value) {
  return value.replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632));
}
export function normalizePhone(value) { return normalizeDigits(value.trim()); }
export function validPhone(value) { return !value || /^09\d{9}$/.test(value); }
export function answerLabel(question, value) {
  if (value === null || value === undefined || value === '') return 'بدون پاسخ';
  return [...question.choices, ...question.alternatives].find(option => option[0] === value)?.[1] ?? 'نامشخص';
}
