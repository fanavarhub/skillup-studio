"""Optional independent XLSX verification after npm test; requires openpyxl."""
from pathlib import Path
import json
import sqlite3
import openpyxl

root = Path(__file__).resolve().parent.parent
report = json.loads(Path((root / 'qa/complete-export-report-path.txt').read_text(encoding='utf-8')).read_text(encoding='utf-8'))
book = openpyxl.load_workbook(report['workbook'], data_only=False)
assert book.sheetnames == ['پاسخ‌ها', 'امتیازها', 'خلاصه', 'اولویت‌ها', 'توزیع پاسخ‌ها']
assert all(sheet.sheet_view.rightToLeft and sheet.freeze_panes == 'A2' for sheet in book.worksheets)
raw = book.worksheets[0]
assert raw.max_column == 20 == report['columns']
assert raw.max_row - 1 == 27 == report['responses']
assert [cell.value for cell in raw[1]] == report['headers']
rows = {row[0].value: row for row in raw.iter_rows(min_row=2)}
assert set(rows) == {row['id'] for row in report['expected']}
for item in report['expected']:
    row = rows[item['id']]
    payload = item['payload']
    assert row[1].value and row[2].value
    assert row[3].value == payload['contact']['full_name']
    assert row[4].value == payload['contact']['phone']
    assert [cell.value for cell in row[5:18]] == item['labels']
    assert (row[18].value or '') == item['priorities_label']
    assert row[19].value == payload['feedback']
    if payload['contact']['phone']:
        assert row[4].data_type == 's' and row[4].value.startswith('09')
    if payload['contact']['full_name'] == '=1+1':
        assert row[3].data_type == 's' and row[19].data_type == 's'
assert not any(cell.data_type == 'f' for sheet in book for row in sheet for cell in row)
assert book.worksheets[1].max_row - 1 == 27
summary = list(book.worksheets[2].values)
assert len(summary) - 1 == 13
assert len(list(book.worksheets[3].values)) - 1 == 13
connection = sqlite3.connect(report['snapshot'])
try:
    assert connection.execute('select count(*) from responses').fetchone()[0] == 27
finally:
    connection.close()
print(json.dumps({'xlsx_verified': True, 'all_rows': 27, 'all_raw_columns': 20, 'worksheets': 5, 'restart_and_snapshot_verified': True, 'optional_contact_and_all_answer_states_preserved': True, 'formula_like_text_is_literal': True}))
