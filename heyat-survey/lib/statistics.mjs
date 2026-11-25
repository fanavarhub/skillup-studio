import { questions, priorityOptions, noSuggestion } from '../dist/questionnaire.js';
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' });

export function buildStatistics(responses, now = new Date()) {
  const eligible = responses.filter(response => response.answers.attendance_days !== 'not_attended');
  const measures = questions.map(question => {
    const population = question.measure === 'attendance' ? responses : eligible;
    const distribution = question.choices.map(([value, label]) => ({ value, label, count: population.filter(response => response.answers[question.id] === value).length }));
    const alternatives = question.alternatives.map(([value, label]) => ({ value, label, count: population.filter(response => response.answers[question.id] === value).length }));
    const valid = distribution.reduce((sum, option) => sum + option.count, 0);
    const skipped = population.filter(response => response.answers[question.id] === null).length;
    const result = { id: question.id, title: question.shortTitle, measure: question.measure, distribution, alternatives, valid, skipped, excluded_absent: responses.length - population.length };
    if (question.measure === 'satisfaction') {
      result.satisfied = distribution.filter(option => Number(option.value) >= 4).reduce((sum, option) => sum + option.count, 0);
      result.dissatisfied = distribution.filter(option => Number(option.value) <= 2).reduce((sum, option) => sum + option.count, 0);
      result.satisfaction_rate = valid ? result.satisfied / valid : null;
      result.mean = valid ? distribution.reduce((sum, option) => sum + Number(option.value) * option.count, 0) / valid : null;
    }
    return result;
  });
  const priorityRespondents = eligible.filter(response => response.priorities.length > 0).length;
  const priorities = [...priorityOptions, noSuggestion].map(([value, label]) => {
    const count = eligible.filter(response => response.priorities.includes(value)).length;
    return { value, label, count, rate: priorityRespondents ? count / priorityRespondents : null };
  }).sort((a, b) => b.count - a.count);
  return {
    total: responses.length,
    today: responses.filter(response => day.format(new Date(response.created_at)) === day.format(now)).length,
    comments: responses.filter(response => response.feedback).length,
    eligible: eligible.length,
    absent: responses.length - eligible.length,
    measures, priorities, priority_respondents: priorityRespondents,
    overall: measures.find(measure => measure.id === 'overall_satisfaction'),
  };
}
