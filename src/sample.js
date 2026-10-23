// Made-up employees for trying the tracker on a test site. Dates are set relative to today
// so each sample shows a different situation (approval ending soon, LCA lapsed, and so on).
// Case and receipt numbers are invented and use 999 / 9999 patterns so they are easy to spot.
import { addDays, addYears } from './dates.js';
import { insertRecord } from './db.js';

function emp(fields) {
  return {
    full_name: null, work_email: null, employee_number: null, job_title: null, hire_date: null, status: 'active',
    end_date: null, work_auth_type: 'H-1B', work_auth_expiry: null, i9_reverify_date: null, notes: null, ...fields,
  };
}
function lca(fields) {
  return {
    case_number: null, status: 'certified', job_title: null, soc_code: '15-1252', begin_date: null, end_date: null,
    certified_date: null, worksite_address: null, worksite_city: 'Charlotte', worksite_state: 'NC', worksite_zip: '28277',
    wage_cents: 9500000, wage_unit: 'year', prevailing_wage_cents: 8800000, pw_level: 'II', pw_source: 'OFLC', ...fields,
  };
}
function pet(fields) {
  return { receipt_number: null, petition_type: 'new', status: 'approved', lca_id: null, validity_start: null, validity_end: null, ...fields };
}

export function samplePeople(today) {
  const d = (n) => addDays(today, n);
  return [
    { // Approval ends in about six weeks; extension filed and pending on a new LCA
      emp: emp({ full_name: 'Asha Verma', work_email: 'asha.verma@example.com', job_title: 'Software Developer', hire_date: addYears(today, -3),
        work_auth_expiry: d(45), notes: 'Sample record. Extension filed; waiting on USCIS.' }),
      lcas: [
        lca({ key: 'old', case_number: 'I-200-99001-999101', job_title: 'Software Developer', begin_date: addDays(addYears(today, -3), 45), end_date: d(45), certified_date: addDays(addYears(today, -3), 20), worksite_address: '100 Sample Park Dr' }),
        lca({ key: 'new', case_number: 'I-200-99002-999102', job_title: 'Software Developer', begin_date: d(46), end_date: addDays(addYears(today, 3), 45), certified_date: d(-60), worksite_address: '100 Sample Park Dr', wage_cents: 10200000, prevailing_wage_cents: 9100000 }),
      ],
      petitions: [
        pet({ lca: 'old', receipt_number: 'WAC9999900001', petition_type: 'new', validity_start: addDays(addYears(today, -3), 45), validity_end: d(45) }),
        pet({ lca: 'new', receipt_number: 'WAC9999900002', petition_type: 'extension', status: 'pending' }),
      ],
    },
    { // Everything in order for two more years
      emp: emp({ full_name: 'Daniel Okafor', work_email: 'daniel.okafor@example.com', job_title: 'Data Engineer', hire_date: addYears(today, -1),
        work_auth_expiry: addYears(today, 2), notes: 'Sample record.' }),
      lcas: [lca({ key: 'a', case_number: 'I-200-99003-999103', job_title: 'Data Engineer', soc_code: '15-1243', begin_date: addYears(today, -1), end_date: addYears(today, 2), certified_date: addDays(addYears(today, -1), -30), worksite_address: '200 Example Blvd', wage_cents: 11000000, prevailing_wage_cents: 9800000 })],
      petitions: [pet({ lca: 'a', receipt_number: 'EAC9999900003', petition_type: 'transfer', validity_start: addYears(today, -1), validity_end: addYears(today, 2) })],
    },
    { // F-1 student on cap-gap; H-1B petition pending; work authorization ends soon
      emp: emp({ full_name: 'Meera Iyer', work_email: 'meera.iyer@example.com', job_title: 'QA Analyst', hire_date: d(-200),
        work_auth_type: 'F-1 cap-gap', work_auth_expiry: d(20), notes: 'Sample record. Cap-gap extension in effect.' }),
      lcas: [lca({ key: 'a', case_number: 'I-200-99004-999104', job_title: 'Software Quality Assurance Analyst', soc_code: '15-1253', begin_date: d(21), end_date: addDays(addYears(today, 3), 20), certified_date: d(-90), wage_cents: 7800000, prevailing_wage_cents: 7200000, pw_level: 'I' })],
      petitions: [pet({ lca: 'a', receipt_number: 'IOE9999900004', petition_type: 'new', status: 'pending' })],
    },
    { // Moved to a client site in Texas; the LCA on file has lapsed
      emp: emp({ full_name: 'Tomás Herrera', work_email: 'tomas.herrera@example.com', job_title: 'Cloud Engineer', hire_date: addYears(today, -2),
        work_auth_expiry: d(-10), notes: 'Sample record.' }),
      lcas: [lca({ key: 'a', case_number: 'I-200-99005-999105', job_title: 'Cloud Engineer', soc_code: '15-1244', begin_date: addYears(today, -2), end_date: d(-10), certified_date: addDays(addYears(today, -2), -25), worksite_address: '300 Placeholder Ave', worksite_city: 'Dallas', worksite_state: 'TX', worksite_zip: '75201', wage_cents: 10500000, prevailing_wage_cents: 9900000 })],
      petitions: [pet({ lca: 'a', receipt_number: 'LIN9999900005', petition_type: 'new', validity_start: addYears(today, -2), validity_end: d(-10) })],
    },
    { // Left the company last year
      emp: emp({ full_name: 'Kiran Patel', work_email: 'kiran.patel@example.com', job_title: 'Business Analyst', hire_date: addYears(today, -4),
        status: 'former', end_date: d(-300), work_auth_expiry: addYears(today, -1), notes: 'Sample record. Former employee.' }),
      lcas: [lca({ key: 'a', case_number: 'I-200-99006-999106', job_title: 'Business Analyst', soc_code: '13-1111', begin_date: addYears(today, -4), end_date: addYears(today, -1), certified_date: addDays(addYears(today, -4), -20), status: 'withdrawn', wage_cents: 8200000, prevailing_wage_cents: 7900000 })],
      petitions: [pet({ lca: 'a', receipt_number: 'SRC9999900006', petition_type: 'new', validity_start: addYears(today, -4), validity_end: addYears(today, -1) })],
    },
  ];
}

export async function loadSample(db, user, today) {
  const existing = await db.prepare('SELECT COUNT(*) AS n FROM employees WHERE is_sample = 1').first();
  if (existing.n > 0) return;
  for (const person of samplePeople(today)) {
    const empId = await insertRecord(db, 'employee', person.emp, { user, summary: `Loaded sample employee ${person.emp.full_name}`, extra: { is_sample: 1 } });
    const ids = {};
    for (const l of person.lcas) {
      const { key, ...values } = l;
      ids[key] = await insertRecord(db, 'lca', values, { user, employeeId: empId, extra: { employee_id: empId }, summary: `Loaded sample LCA ${values.case_number}` });
    }
    for (const p of person.petitions) {
      const { lca: key, ...values } = p;
      values.lca_id = ids[key] ?? null;
      await insertRecord(db, 'petition', values, { user, employeeId: empId, extra: { employee_id: empId }, summary: `Loaded sample petition ${values.receipt_number}` });
    }
  }
}

export async function removeSample(db) {
  await db.batch([
    db.prepare('DELETE FROM audit_log WHERE employee_id IN (SELECT id FROM employees WHERE is_sample = 1)'),
    db.prepare('DELETE FROM employees WHERE is_sample = 1'),
  ]);
}
