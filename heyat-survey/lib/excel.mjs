import { questions, priorityOptions, noSuggestion, answerLabel } from '../dist/questionnaire.js';
import { buildStatistics } from './statistics.mjs';
import { makeZip } from './zip.mjs';

const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const xml = value => String(value).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\uFFFE\uFFFF]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
function column(index) {
  let name = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + (value - 1) % 26) + name;
  return name;
}
const percent = value => value === null ? null : { value, style: 3 };
const decimal = value => value === null ? null : { value, style: 4 };
function cell(value, row, col, header = false) {
  if (value === null || value === undefined) return '';
  const content = typeof value === 'object' ? value.value : value;
  const style = header ? 1 : typeof value === 'object' ? value.style : typeof value === 'number' ? 2 : 0;
  const reference = `${column(col)}${row}`;
  if (typeof content === 'number' && Number.isFinite(content)) return `<c r="${reference}" s="${style}" t="n"><v>${content}</v></c>`;
  // All user strings, including leading '=', are explicit text, never formulas.
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(content)}</t></is></c>`;
}
function sheetXml(sheet) {
  const lastColumn = column(sheet.rows[0].length - 1);
  const lastRow = sheet.rows.length;
  const rows = sheet.rows.map((values, index) => `<row r="${index + 1}"${index === 0 ? ' ht="34" customHeight="1"' : ''}>${values.map((value, col) => cell(value, index + 1, col, index === 0)).join('')}</row>`).join('');
  const cols = sheet.rows[0].map((_, index) => `<col min="${index + 1}" max="${index + 1}" width="${sheet.widths?.[index] || 24}" customWidth="1"/>`).join('');
  return `${declaration}<worksheet xmlns="${ns}"><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0" rightToLeft="1" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="32"/><cols>${cols}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${lastColumn}${lastRow}"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9"/></worksheet>`;
}

const styles = `${declaration}<styleSheet xmlns="${ns}">
<fonts count="2"><font><sz val="11"/><name val="Tahoma"/><color rgb="FF172F25"/></font><font><b/><sz val="11"/><name val="Tahoma"/><color rgb="FFF2F1E9"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF10392D"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1" readingOrder="2"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" horizontal="center" wrapText="1" readingOrder="2"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export function createExcel(responses) {
  const stats = buildStatistics(responses);
  const priorityLabels = new Map([...priorityOptions, noSuggestion]);
  const date = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'short', timeStyle: 'short' });
  const raw = [['شناسه پاسخ', 'زمان ثبت تهران', 'زمان ثبت UTC', 'نام و نام خانوادگی', 'شماره تماس', ...questions.map(question => question.shortTitle), 'اولویت‌های بهبود', 'نظر آزاد']];
  for (const response of responses) raw.push([response.id, date.format(new Date(response.created_at)), response.created_at, response.contact.full_name, response.contact.phone, ...questions.map(question => answerLabel(question, response.answers[question.id])), response.priorities.map(value => priorityLabels.get(value)).join('؛ '), response.feedback]);
  const scored = questions.filter(question => question.measure === 'satisfaction');
  const scoreRows = [['شناسه پاسخ', ...scored.map(question => question.shortTitle)]];
  for (const response of responses) scoreRows.push([response.id, ...scored.map(question => /^[1-5]$/.test(response.answers[question.id] || '') ? Number(response.answers[question.id]) : null)]);
  const summary = [['بخش', 'نوع سنجش', 'پاسخ معتبر', 'بدون پاسخ', 'تجربه نکردم / امکان ارزیابی ندارم', 'حذف‌شده به علت عدم حضور', 'تعداد راضی', 'سهم رضایت', 'تعداد ناراضی', 'سهم نارضایتی', 'میانگین رضایت']];
  for (const measure of stats.measures) summary.push([measure.title, measure.measure === 'satisfaction' ? 'رضایت' : measure.measure === 'attendance' ? 'حضور' : 'تناسب / ترجیح', measure.valid, measure.skipped, measure.alternatives.reduce((sum, item) => sum + item.count, 0), measure.excluded_absent, measure.satisfied ?? null, percent(measure.satisfaction_rate ?? null), measure.dissatisfied ?? null, percent(measure.measure === 'satisfaction' && measure.valid ? measure.dissatisfied / measure.valid : null), decimal(measure.mean ?? null)]);
  const priorities = [['موضوع', 'تعداد انتخاب', 'تعداد پاسخ‌دهندگان این سؤال', 'سهم از پاسخ‌دهندگان']];
  for (const priority of stats.priorities) priorities.push([priority.label, priority.count, stats.priority_respondents, percent(priority.rate)]);
  const distributions = [['بخش', 'گزینه', 'تعداد', 'نوع پاسخ']];
  for (const measure of stats.measures) {
    for (const option of measure.distribution) distributions.push([measure.title, option.label, option.count, 'پاسخ ارزیابی']);
    for (const option of measure.alternatives) distributions.push([measure.title, option.label, option.count, 'بدون امتیاز']);
    distributions.push([measure.title, 'بدون پاسخ', measure.skipped, 'بدون پاسخ']);
  }
  const sheets = [
    { name: 'پاسخ‌ها', rows: raw, widths: [38, 25, 29, 25, 19, ...questions.map(() => 24), 45, 65] },
    { name: 'امتیازها', rows: scoreRows, widths: [38, ...scored.map(() => 24)] },
    { name: 'خلاصه', rows: summary },
    { name: 'اولویت‌ها', rows: priorities, widths: [30, 20, 30, 28] },
    { name: 'توزیع پاسخ‌ها', rows: distributions },
  ];
  const relationships = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
  return makeZip([
    { name: '[Content_Types].xml', data: `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `${declaration}<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: styles },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: sheetXml(sheet) })),
  ]);
}
