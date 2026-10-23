import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPLOYEE_FIELDS, LCA_FIELDS, PETITION_FIELDS, parseFields, parseMoney, fmtMoney, rowToInput, checkEmployee, checkLca, checkPetition } from '../../src/fields.js';

const form = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

test('parseMoney accepts dollar formats', () => {
  assert.equal(parseMoney('$95,000'), 9500000);
  assert.equal(parseMoney('52.5'), 5250);
  assert.equal(parseMoney('52.505'), null);
  assert.equal(parseMoney('abc'), null);
  assert.equal(fmtMoney(9500000, 'year'), '$95,000 per year');
  assert.equal(fmtMoney(5250, 'hour'), '$52.50 per hour');
});

test('employee: required name, former needs end date, end after hire', () => {
  let r = parseFields(EMPLOYEE_FIELDS, form({ full_name: '  ', status: 'active' }));
  checkEmployee(r.values, r.errors);
  assert.ok(r.errors.full_name);
  r = parseFields(EMPLOYEE_FIELDS, form({ full_name: 'A  B', status: 'former', hire_date: '2025-01-01' }));
  checkEmployee(r.values, r.errors);
  assert.equal(r.values.full_name, 'A B');
  assert.ok(r.errors.end_date);
  r = parseFields(EMPLOYEE_FIELDS, form({ full_name: 'A', status: 'former', hire_date: '2025-01-01', end_date: '2024-01-01' }));
  checkEmployee(r.values, r.errors);
  assert.match(r.errors.end_date, /on or after/);
  r = parseFields(EMPLOYEE_FIELDS, form({ full_name: 'A', status: 'bogus', work_email: 'nope' }));
  assert.ok(r.errors.status && r.errors.work_email);
});

const goodLca = { case_number: 'i-200-25190-123456', status: 'certified', begin_date: '2026-01-01', end_date: '2028-12-31', soc_code: '15-1252', worksite_zip: '28277', wage: '95000', wage_unit: 'year', prevailing_wage: '88000' };

test('LCA: good record passes and case number is upper-cased', () => {
  const r = parseFields(LCA_FIELDS, form(goodLca));
  checkLca(r.values, r.errors);
  assert.deepEqual(r.errors, {});
  assert.equal(r.values.case_number, 'I-200-25190-123456');
  assert.equal(r.values.wage_cents, 9500000);
});

test('LCA: format, 3-year limit, wage below prevailing', () => {
  const r = parseFields(LCA_FIELDS, form({ ...goodLca, case_number: 'I-200-1', soc_code: '151252', worksite_zip: '2827', end_date: '2029-01-02', wage: '80000' }));
  checkLca(r.values, r.errors);
  assert.ok(r.errors.case_number && r.errors.soc_code && r.errors.worksite_zip);
  assert.match(r.errors.end_date, /3 years/);
  assert.match(r.errors.wage, /below the prevailing wage/);
});

test('petition: approved needs dates, within LCA, receipt format', () => {
  const lca = { begin_date: '2026-01-01', end_date: '2028-12-31' };
  const fields = PETITION_FIELDS.map((f) => (f.name === 'lca_id' ? { ...f, options: [['1', 'x']] } : f));
  let r = parseFields(fields, form({ petition_type: 'new', status: 'approved', receipt_number: 'wac123' }));
  checkPetition(r.values, r.errors, null);
  assert.ok(r.errors.validity_start && r.errors.validity_end && r.errors.receipt_number);
  r = parseFields(fields, form({ petition_type: 'new', status: 'approved', receipt_number: 'wac2512345678', lca_id: '1', validity_start: '2025-12-01', validity_end: '2029-01-01' }));
  checkPetition(r.values, r.errors, lca);
  assert.equal(r.values.receipt_number, 'WAC2512345678');
  assert.match(r.errors.validity_start, /before the LCA begins \(01\/01\/2026\)/);
  r = parseFields(fields, form({ petition_type: 'new', status: 'pending', lca_id: '2' }));
  assert.ok(r.errors.lca_id, 'unknown LCA rejected');
});

test('rowToInput turns cents back into dollars', () => {
  const v = rowToInput(LCA_FIELDS, { case_number: 'I', wage_cents: 9500000, prevailing_wage_cents: 5250, soc_code: null });
  assert.equal(v.wage, '95000');
  assert.equal(v.prevailing_wage, '52.50');
  assert.equal(v.soc_code, '');
});
