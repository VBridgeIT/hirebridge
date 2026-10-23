// Field definitions for each record type, and the checks run when a form is saved.
import { isISODate, addYears, fmtDate } from './dates.js';

export const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
  ['PR', 'Puerto Rico'], ['GU', 'Guam'], ['VI', 'U.S. Virgin Islands'], ['MP', 'Northern Mariana Islands'],
  ['AS', 'American Samoa'],
];

export const EMPLOYEE_STATUS = [['active', 'Active'], ['former', 'Former']];
export const WORK_AUTH_TYPES = [
  ['H-1B', 'H-1B'],
  ['F-1 cap-gap', 'F-1 cap-gap extension'],
  ['F-1 OPT', 'F-1 OPT or STEM OPT (EAD)'],
  ['Other', 'Other'],
];
export const LCA_STATUS = [['certified', 'Certified'], ['withdrawn', 'Withdrawn'], ['expired', 'Expired']];
export const WAGE_UNITS = [['year', 'per year'], ['hour', 'per hour']];
export const PW_LEVELS = [['I', 'Level I'], ['II', 'Level II'], ['III', 'Level III'], ['IV', 'Level IV'], ['N/A', 'Not applicable']];
export const PW_SOURCES = [
  ['OFLC', 'OFLC wage library (FLAG)'],
  ['PWD', 'Prevailing wage determination'],
  ['CBA', 'Collective bargaining agreement'],
  ['Survey', 'Employer or published survey'],
  ['Other', 'Other'],
];
export const PETITION_TYPES = [
  ['new', 'New employment'],
  ['extension', 'Extension'],
  ['amendment', 'Amendment'],
  ['transfer', 'Change of employer (transfer)'],
];
export const PETITION_STATUS = [['pending', 'Pending'], ['approved', 'Approved'], ['denied', 'Denied'], ['withdrawn', 'Withdrawn']];

export function optionLabel(options, value) {
  const o = options.find(([v]) => v === value);
  return o ? o[1] : value || '';
}

export const EMPLOYEE_FIELDS = [
  { name: 'full_name', label: 'Full name', type: 'text', required: true, max: 120, autocomplete: 'off' },
  { name: 'work_email', label: 'Work email', type: 'email', max: 200, hint: 'Optional' },
  { name: 'employee_number', label: 'Employee ID', type: 'text', max: 40, hint: 'Optional' },
  { name: 'job_title', label: 'Job title', type: 'text', max: 120 },
  { name: 'hire_date', label: 'Hire date', type: 'date' },
  { name: 'status', label: 'Status', type: 'select', options: EMPLOYEE_STATUS, required: true },
  { name: 'end_date', label: 'Employment end date', type: 'date', hint: 'Needed when status is Former' },
  { name: 'work_auth_type', label: 'Work authorization', type: 'select', options: WORK_AUTH_TYPES, blank: 'Choose one' },
  { name: 'work_auth_expiry', label: 'Work authorization expires', type: 'date', hint: 'The date on the I-94 or EAD' },
  { name: 'i9_reverify_date', label: 'I-9 reverification due', type: 'date', hint: 'Leave blank to use the work authorization expiry date' },
  { name: 'notes', label: 'Notes', type: 'textarea', max: 2000, hint: 'Do not enter passport, Social Security or other ID numbers' },
];

export const LCA_FIELDS = [
  { name: 'case_number', label: 'LCA case number', type: 'text', required: true, max: 20, hint: 'Format I-200-YYDDD-NNNNNN', mono: true, autocomplete: 'off' },
  { name: 'status', label: 'Status', type: 'select', options: LCA_STATUS, required: true },
  { name: 'job_title', label: 'Job title on the LCA', type: 'text', max: 120 },
  { name: 'soc_code', label: 'SOC code', type: 'text', max: 10, hint: 'For example 15-1252', mono: true },
  { name: 'begin_date', label: 'Begin date', type: 'date', required: true },
  { name: 'end_date', label: 'End date', type: 'date', required: true },
  { name: 'certified_date', label: 'Certified on', type: 'date' },
  { name: 'worksite_address', label: 'Worksite street address', type: 'text', max: 200, group: 'Worksite' },
  { name: 'worksite_city', label: 'City', type: 'text', max: 80, group: 'Worksite' },
  { name: 'worksite_state', label: 'State', type: 'select', options: US_STATES, blank: 'Choose a state', group: 'Worksite' },
  { name: 'worksite_zip', label: 'ZIP code', type: 'text', max: 10, inputmode: 'numeric', group: 'Worksite' },
  { name: 'wage', label: 'Wage paid', type: 'money', group: 'Wages', hint: 'In dollars' },
  { name: 'wage_unit', label: 'Wage unit', type: 'select', options: WAGE_UNITS, group: 'Wages' },
  { name: 'prevailing_wage', label: 'Prevailing wage', type: 'money', group: 'Wages', hint: 'Same unit as the wage paid' },
  { name: 'pw_level', label: 'Prevailing wage level', type: 'select', options: PW_LEVELS, blank: 'Choose a level', group: 'Wages' },
  { name: 'pw_source', label: 'Prevailing wage source', type: 'select', options: PW_SOURCES, blank: 'Choose a source', group: 'Wages' },
];

export const PETITION_FIELDS = [
  { name: 'receipt_number', label: 'USCIS receipt number', type: 'text', max: 13, hint: 'Three letters and ten digits, for example WAC2512345678. Leave blank until the receipt arrives.', mono: true, autocomplete: 'off' },
  { name: 'petition_type', label: 'Petition type', type: 'select', options: PETITION_TYPES, required: true },
  { name: 'status', label: 'Status', type: 'select', options: PETITION_STATUS, required: true },
  { name: 'lca_id', label: 'LCA used', type: 'select', options: [], blank: 'Not linked yet' },
  { name: 'validity_start', label: 'Valid from', type: 'date', hint: 'From the I-797 approval notice' },
  { name: 'validity_end', label: 'Valid until', type: 'date', hint: 'Needed when the petition is approved' },
];

const CASE_RE = /^I-200-\d{5}-\d{6}$/;
const RECEIPT_RE = /^[A-Z]{3}\d{10}$/;
const SOC_RE = /^\d{2}-\d{4}(\.\d{2})?$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseMoney(s) {
  const t = String(s).replace(/[$,\s]/g, '');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

export function fmtMoney(cents, unit) {
  if (cents === null || cents === undefined) return '';
  const s = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: unit === 'hour' ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100);
  return unit ? `${s} ${optionLabel(WAGE_UNITS, unit)}` : s;
}

function centsToInput(cents) {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2).replace(/\.00$/, '');
}

// Turn a stored row into form input values (money columns are stored in cents).
export function rowToInput(fields, row) {
  const v = {};
  for (const f of fields) {
    if (f.type === 'money') v[f.name] = centsToInput(row[`${f.name}_cents`]);
    else v[f.name] = row[f.name] === null || row[f.name] === undefined ? '' : String(row[f.name]);
  }
  return v;
}

// Read and check a submitted form. Returns { input, values, errors }:
// input is what the user typed (to refill the form), values are ready to store, errors maps field -> message.
export function parseFields(fields, form) {
  const input = {};
  const values = {};
  const errors = {};
  for (const f of fields) {
    let s = form.get(f.name);
    s = typeof s === 'string' ? s.trim() : '';
    if (f.type !== 'textarea') s = s.replace(/\s+/g, ' ');
    input[f.name] = s;
    if (!s) {
      if (f.required) errors[f.name] = `Enter ${f.label.toLowerCase()}`;
      if (f.type === 'money') values[`${f.name}_cents`] = null;
      else values[f.name] = null;
      continue;
    }
    if (f.max && s.length > f.max) { errors[f.name] = `${f.label} must be ${f.max} characters or fewer`; continue; }
    switch (f.type) {
      case 'date':
        if (!isISODate(s)) { errors[f.name] = `${f.label} must be a real date`; continue; }
        values[f.name] = s;
        break;
      case 'email':
        if (!EMAIL_RE.test(s)) { errors[f.name] = 'Enter an email address like name@vbridgeit.com'; continue; }
        values[f.name] = s.toLowerCase();
        break;
      case 'select':
        if (f.options.length && !f.options.some(([v]) => v === s)) { errors[f.name] = `Choose a ${f.label.toLowerCase()} from the list`; continue; }
        values[f.name] = s;
        break;
      case 'money': {
        const c = parseMoney(s);
        if (c === null) { errors[f.name] = `${f.label} must be an amount like 95000 or 52.50`; continue; }
        values[`${f.name}_cents`] = c;
        break;
      }
      default:
        values[f.name] = s;
    }
  }
  return { input, values, errors };
}

export function checkEmployee(values, errors) {
  if (values.status === 'former' && !values.end_date && !errors.end_date) errors.end_date = 'Enter the employment end date for a former employee';
  if (values.hire_date && values.end_date && values.end_date < values.hire_date && !errors.end_date) errors.end_date = 'Employment end date must be on or after the hire date';
}

export function checkLca(values, errors) {
  if (values.case_number) {
    values.case_number = values.case_number.toUpperCase();
    if (!CASE_RE.test(values.case_number)) errors.case_number = 'LCA case number must look like I-200-25190-123456';
  }
  if (values.soc_code && !SOC_RE.test(values.soc_code)) errors.soc_code = 'SOC code must look like 15-1252 or 15-1252.00';
  if (values.worksite_zip && !ZIP_RE.test(values.worksite_zip)) errors.worksite_zip = 'ZIP code must be 5 digits, or 5+4 like 28277-1234';
  if (values.begin_date && values.end_date && !errors.begin_date && !errors.end_date) {
    if (values.end_date < values.begin_date) errors.end_date = 'End date must be after the begin date';
    else if (values.end_date > addYears(values.begin_date, 3)) errors.end_date = 'An LCA can cover at most 3 years from its begin date';
  }
  if (values.certified_date && values.begin_date && !errors.certified_date && values.certified_date > values.begin_date) {
    errors.certified_date = 'Certified date must be on or before the begin date';
  }
  if (values.wage_cents !== null && values.wage_cents !== undefined && !values.wage_unit && !errors.wage) errors.wage_unit = 'Choose whether the wage is per year or per hour';
  if (values.wage_cents != null && values.prevailing_wage_cents != null && !errors.wage && !errors.prevailing_wage
      && values.wage_cents < values.prevailing_wage_cents) {
    errors.wage = 'Wage paid is below the prevailing wage. The LCA requires at least the prevailing wage.';
  }
}

export function checkPetition(values, errors, lca) {
  if (values.receipt_number) {
    values.receipt_number = values.receipt_number.toUpperCase();
    if (!RECEIPT_RE.test(values.receipt_number)) errors.receipt_number = 'Receipt number must be three letters and ten digits, like WAC2512345678';
  }
  if (values.status === 'approved') {
    if (!values.validity_start && !errors.validity_start) errors.validity_start = 'Enter the start date from the approval notice';
    if (!values.validity_end && !errors.validity_end) errors.validity_end = 'Enter the end date from the approval notice';
  }
  const s = values.validity_start, e = values.validity_end;
  if (s && e && !errors.validity_start && !errors.validity_end) {
    if (e < s) errors.validity_end = 'Valid-until date must be after the valid-from date';
    else if (e > addYears(s, 3)) errors.validity_end = 'An H-1B approval can cover at most 3 years';
  }
  if (lca) {
    if (s && !errors.validity_start && s < lca.begin_date) errors.validity_start = `Valid-from date is before the LCA begins (${fmtDate(lca.begin_date)})`;
    if (e && !errors.validity_end && e > lca.end_date) errors.validity_end = `Valid-until date is after the LCA ends (${fmtDate(lca.end_date)})`;
  }
}
