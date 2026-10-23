import { html, raw } from '../html.js';
import { fmtDate, fmtTimestamp, relativeDays } from '../dates.js';
import {
  EMPLOYEE_FIELDS, LCA_FIELDS, PETITION_FIELDS, EMPLOYEE_STATUS, LCA_STATUS, PETITION_TYPES, PETITION_STATUS,
  WORK_AUTH_TYPES, PW_LEVELS, PW_SOURCES, US_STATES, optionLabel, fmtMoney,
} from '../fields.js';
import { currentLca, currentApproval, i9Date, deadlines, nextDeadline, recordNotes } from '../status.js';
import { crumbs } from './forms.js';

export const MESSAGES = {
  'employee-added': 'Employee added.',
  'employee-saved': 'Employee details saved.',
  'lca-added': 'LCA added.',
  'lca-saved': 'LCA saved.',
  'lca-deleted': 'LCA deleted.',
  'petition-added': 'Petition added.',
  'petition-saved': 'Petition saved.',
  'petition-deleted': 'Petition deleted.',
  'no-changes': 'Nothing was changed.',
  'sample-loaded': 'Sample employees loaded. They are marked “Sample”.',
  'sample-removed': 'Sample employees removed.',
};

export function flash(msg) {
  const text = MESSAGES[msg];
  return text ? html`<div class="flash" role="status">${text}</div>` : '';
}

function badge(level, text) {
  return html`<span class="badge badge-${level}">${text}</span>`;
}

export function dateBadge(d) {
  if (!d) return html`<span class="muted">—</span>`;
  const u = d.urgency;
  const level = u ? u.level : 'later';
  return html`<span class="when when-${level}"><span class="when-date">${fmtDate(d.date)}</span><span class="when-rel">${u ? relativeDays(u.days) : ''}</span></span>`;
}

function worksite(l) {
  if (!l) return '';
  return [l.worksite_city, l.worksite_state].filter(Boolean).join(', ');
}

export function listPage({ rows, today, q, status, sort, msg, allowSample, hasSample, total }) {
  const items = rows.map(({ emp, lcas, petitions }) => {
    const list = deadlines(emp, lcas, petitions, today);
    const lca = currentLca(lcas, today);
    const approval = currentApproval(petitions);
    const i9 = i9Date(emp);
    return { emp, lca, approval, i9, next: nextDeadline(list), list };
  });
  if (sort === 'next') {
    items.sort((a, b) => {
      const ad = a.next ? a.next.date : '9999', bd = b.next ? b.next.date : '9999';
      return ad < bd ? -1 : ad > bd ? 1 : a.emp.full_name.localeCompare(b.emp.full_name);
    });
  }
  const statusOpts = [['active', 'Active'], ['former', 'Former'], ['all', 'All']];
  const sortOpts = [['next', 'Next date'], ['name', 'Name']];
  return html`
  <div class="page-head">
    <h1>Employees</h1>
    <a class="btn" href="/employees/new">Add employee</a>
  </div>
  ${flash(msg)}
  <form class="filters" method="get" action="/employees" role="search">
    <div class="field"><label for="q">Search</label><input id="q" name="q" type="search" class="input" value="${q}" placeholder="Name, job title, city or case number"></div>
    <div class="field"><label for="status">Show</label><select id="status" name="status" class="input">${statusOpts.map(([v, l]) => html`<option value="${v}"${v === status ? raw(' selected') : ''}>${l}</option>`)}</select></div>
    <div class="field"><label for="sort">Sort by</label><select id="sort" name="sort" class="input">${sortOpts.map(([v, l]) => html`<option value="${v}"${v === sort ? raw(' selected') : ''}>${l}</option>`)}</select></div>
    <button class="btn btn-quiet" type="submit">Apply</button>
  </form>
  ${total === 0 ? html`<div class="panel empty">
      <h2>No employees yet</h2>
      <p>Add each H-1B employee to start tracking their LCAs, approvals and I-9 dates.</p>
      <p><a class="btn" href="/employees/new">Add the first employee</a></p>
      ${allowSample ? html`<form method="post" action="/sample"><p class="muted small">On this test site you can also load made-up sample employees to try things out.</p><button class="btn btn-quiet" type="submit" name="do" value="load">Load sample data</button></form>` : ''}
    </div>`
    : items.length === 0 ? html`<p class="panel">No employees match. <a href="/employees?status=all">Show everyone</a></p>`
    : html`<p class="count muted" aria-live="polite">${items.length} ${items.length === 1 ? 'employee' : 'employees'}</p>
  <div class="table-wrap">
  <table class="list">
    <caption class="sr-only">H-1B employees and their key dates</caption>
    <thead><tr><th scope="col">Employee</th><th scope="col">Worksite</th><th scope="col">H-1B valid until</th><th scope="col">I-9 reverification</th><th scope="col">Next date to watch</th></tr></thead>
    <tbody>
    ${items.map(({ emp, lca, approval, i9, next, list }) => html`<tr>
      <th scope="row" data-label="Employee"><a href="/employees/${emp.id}">${emp.full_name}</a>
        ${emp.status === 'former' ? badge('neutral', 'Former') : ''}${emp.is_sample ? badge('sample', 'Sample') : ''}
        <span class="sub">${emp.job_title || ''}</span></th>
      <td data-label="Worksite">${worksite(lca) || html`<span class="muted">—</span>`}</td>
      <td data-label="H-1B valid until">${approval ? fmtDate(approval.validity_end) : html`<span class="muted">—</span>`}</td>
      <td data-label="I-9 reverification">${i9 ? fmtDate(i9.date) : html`<span class="muted">—</span>`}</td>
      <td data-label="Next date">${next ? html`<span class="next-label">${next.label}</span> ${dateBadge(next)}` : html`<span class="muted">${emp.status === 'former' ? 'Not tracked' : 'No dates yet'}</span>`}</td>
    </tr>`)}
    </tbody>
  </table>
  </div>`}
  ${allowSample && hasSample ? html`<form class="sample-tools" method="post" action="/sample"><button class="btn btn-quiet btn-small" type="submit" name="do" value="remove">Remove sample employees</button></form>` : ''}`;
}

function dl(rows) {
  const shown = rows.filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== false);
  if (!shown.length) return html`<p class="muted">Nothing recorded yet.</p>`;
  return html`<dl class="facts">${shown.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>`;
}

// Labels and formatting for the change history.
const LABELS = {};
for (const f of [...EMPLOYEE_FIELDS, ...LCA_FIELDS, ...PETITION_FIELDS]) LABELS[f.type === 'money' ? `${f.name}_cents` : f.name] = f.label;
LABELS.lca_id = 'LCA used';
const OPTIONS = {
  status: [...EMPLOYEE_STATUS, ...LCA_STATUS, ...PETITION_STATUS], work_auth_type: WORK_AUTH_TYPES,
  petition_type: PETITION_TYPES, pw_level: PW_LEVELS, pw_source: PW_SOURCES, worksite_state: US_STATES,
  wage_unit: [['year', 'Per year'], ['hour', 'Per hour']],
};
function fmtValue(key, v) {
  if (v === null || v === undefined || v === '') return '(blank)';
  if (key.endsWith('_cents')) return fmtMoney(v);
  if (/_date$|_expiry$|^validity_/.test(key)) return fmtDate(v);
  if (OPTIONS[key]) return optionLabel(OPTIONS[key], v);
  if (key === 'lca_id') return `LCA record #${v}`;
  return String(v);
}

function historyList(history) {
  if (!history.length) return html`<p class="muted">No changes recorded yet.</p>`;
  return html`<ol class="history">${history.map((h) => {
    let changes = {};
    try { changes = h.changes ? JSON.parse(h.changes) : {}; } catch { changes = {}; }
    const keys = Object.keys(changes);
    return html`<li>
      <p><span class="history-when">${fmtTimestamp(h.at)}</span> · <span class="history-who">${h.user_email}</span></p>
      <p class="history-what">${h.summary}</p>
      ${keys.length ? html`<details><summary>${keys.length} ${keys.length === 1 ? 'field' : 'fields'}</summary><ul class="changes">${keys.map((k) => html`<li><span class="change-field">${LABELS[k] || k}:</span> ${h.action === 'create' ? fmtValue(k, changes[k][1]) : h.action === 'delete' ? fmtValue(k, changes[k][0]) : html`${fmtValue(k, changes[k][0])} → ${fmtValue(k, changes[k][1])}`}</li>`)}</ul></details>` : ''}
    </li>`;
  })}</ol>`;
}

function lcaCard(l, inForceId, today) {
  const statusLevel = l.status === 'certified' ? 'ok' : 'neutral';
  const pw = [l.prevailing_wage_cents != null ? fmtMoney(l.prevailing_wage_cents, l.wage_unit) : '', l.pw_level ? optionLabel(PW_LEVELS, l.pw_level) : '', l.pw_source ? optionLabel(PW_SOURCES, l.pw_source) : ''].filter(Boolean).join(' · ');
  const site = [l.worksite_address, [l.worksite_city, l.worksite_state].filter(Boolean).join(', '), l.worksite_zip].filter(Boolean).join(', ');
  return html`<article class="card" aria-labelledby="lca-${l.id}">
    <header class="card-head">
      <h3 id="lca-${l.id}"><span class="mono">${l.case_number}</span></h3>
      <div class="badges">${badge(statusLevel, optionLabel(LCA_STATUS, l.status))}${l.id === inForceId && l.begin_date <= today && l.end_date >= today ? badge('info', 'In force') : ''}</div>
    </header>
    ${dl([
      ['Period', `${fmtDate(l.begin_date)} to ${fmtDate(l.end_date)}`],
      ['Certified on', fmtDate(l.certified_date)],
      ['Job title', l.job_title],
      ['SOC code', l.soc_code ? html`<span class="mono">${l.soc_code}</span>` : ''],
      ['Worksite', site],
      ['Wage paid', l.wage_cents != null ? fmtMoney(l.wage_cents, l.wage_unit) : ''],
      ['Prevailing wage', pw],
    ])}
    <p class="card-actions"><a href="/lcas/${l.id}/edit">Edit<span class="sr-only"> LCA ${l.case_number}</span></a> <a class="danger-link" href="/lcas/${l.id}/delete">Delete<span class="sr-only"> LCA ${l.case_number}</span></a></p>
  </article>`;
}

function petitionsTable(petitions, lcas, currentId, today) {
  if (!petitions.length) return html`<p class="muted">No petitions recorded yet.</p>`;
  const caseOf = (id) => (lcas.find((l) => l.id === id) || {}).case_number;
  return html`<div class="table-wrap"><table class="list">
    <caption class="sr-only">H-1B petitions</caption>
    <thead><tr><th scope="col">Type</th><th scope="col">Receipt number</th><th scope="col">Status</th><th scope="col">Valid</th><th scope="col">LCA</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
    <tbody>${petitions.map((p) => html`<tr>
      <th scope="row" data-label="Type">${optionLabel(PETITION_TYPES, p.petition_type)}</th>
      <td data-label="Receipt"><span class="mono">${p.receipt_number || '—'}</span></td>
      <td data-label="Status">${badge(p.status === 'approved' ? 'ok' : p.status === 'pending' ? 'info' : 'neutral', optionLabel(PETITION_STATUS, p.status))}${p.id === currentId && p.validity_start <= today && p.validity_end >= today ? badge('info', 'In force') : ''}</td>
      <td data-label="Valid">${p.validity_start || p.validity_end ? `${fmtDate(p.validity_start) || '?'} to ${fmtDate(p.validity_end) || '?'}` : html`<span class="muted">—</span>`}</td>
      <td data-label="LCA"><span class="mono">${caseOf(p.lca_id) || '—'}</span></td>
      <td data-label="Actions" class="row-actions"><a href="/petitions/${p.id}/edit">Edit<span class="sr-only"> petition ${p.receipt_number || ''}</span></a> <a class="danger-link" href="/petitions/${p.id}/delete">Delete<span class="sr-only"> petition ${p.receipt_number || ''}</span></a></td>
    </tr>`)}</tbody>
  </table></div>`;
}

export function employeePage({ emp, lcas, petitions, history, today, msg }) {
  const list = deadlines(emp, lcas, petitions, today);
  const notes = recordNotes(emp, lcas, petitions, today);
  const lca = currentLca(lcas, today);
  const approval = currentApproval(petitions);
  const i9 = i9Date(emp);
  const keyDates = [
    ['H-1B approval ends', list.find((d) => d.kind === 'h1b')],
    ['LCA ends', list.find((d) => d.kind === 'lca')],
    [i9 && i9.derived ? 'I-9 reverification due (same as work authorization)' : 'I-9 reverification due', list.find((d) => d.kind === 'i9')],
  ];
  return html`${crumbs([['Employees', '/employees'], [emp.full_name, null]])}
  <div class="page-head">
    <div>
      <h1>${emp.full_name}</h1>
      <p class="sub-head">${[emp.job_title, emp.employee_number ? `ID ${emp.employee_number}` : ''].filter(Boolean).join(' · ')}
        ${badge(emp.status === 'active' ? 'ok' : 'neutral', optionLabel(EMPLOYEE_STATUS, emp.status))}${emp.is_sample ? badge('sample', 'Sample') : ''}</p>
    </div>
    <a class="btn btn-quiet" href="/employees/${emp.id}/edit">Edit employee</a>
  </div>
  ${flash(msg)}
  ${notes.length ? html`<ul class="notes" aria-label="Things to check">${notes.map((n) => html`<li class="note note-${n.level}">${n.text}</li>`)}</ul>` : ''}
  ${emp.status === 'active' ? html`<section aria-labelledby="key-dates-h"><h2 id="key-dates-h" class="sr-only">Key dates</h2>
  <ul class="keydates">${keyDates.map(([label, d]) => html`<li class="keydate keydate-${d && d.urgency ? d.urgency.level : 'none'}"><span class="keydate-label">${label}</span>${d ? dateBadge(d) : html`<span class="muted">Not recorded</span>`}</li>`)}</ul></section>` : ''}

  <section class="section" aria-labelledby="profile-h">
    <h2 id="profile-h">Employment and work authorization</h2>
    ${dl([
      ['Work email', emp.work_email],
      ['Hire date', fmtDate(emp.hire_date)],
      ['Employment ended', fmtDate(emp.end_date)],
      ['Work authorization', optionLabel(WORK_AUTH_TYPES, emp.work_auth_type)],
      ['Work authorization expires', fmtDate(emp.work_auth_expiry)],
      ['I-9 reverification due', i9 ? `${fmtDate(i9.date)}${i9.derived ? ' (same as work authorization)' : ''}` : ''],
      ['Notes', emp.notes ? html`<span class="pre">${emp.notes}</span>` : ''],
    ])}
  </section>

  <section class="section" aria-labelledby="lcas-h">
    <div class="section-head"><h2 id="lcas-h">LCAs</h2><a class="btn btn-small" href="/employees/${emp.id}/lcas/new">Add LCA</a></div>
    ${lcas.length ? html`<div class="cards">${lcas.map((l) => lcaCard(l, lca && lca.id, today))}</div>` : html`<p class="muted">No LCAs recorded yet.</p>`}
  </section>

  <section class="section" aria-labelledby="pet-h">
    <div class="section-head"><h2 id="pet-h">H-1B petitions</h2><a class="btn btn-small" href="/employees/${emp.id}/petitions/new">Add petition</a></div>
    ${petitionsTable(petitions, lcas, approval && approval.id, today)}
  </section>

  <section class="section" aria-labelledby="hist-h">
    <h2 id="hist-h">History</h2>
    <p class="muted small">Every change to this employee, their LCAs and petitions, with who made it.</p>
    ${historyList(history)}
  </section>`;
}

export function confirmDeletePage({ what, detail, action, cancelHref, crumbItems }) {
  return html`${crumbs(crumbItems)}
  <div class="panel narrow">
    <h1>Delete ${what}?</h1>
    <p>${detail}</p>
    <p class="muted">The deletion is recorded in the employee's history, including the values that were deleted.</p>
    <form method="post" action="${action}" class="actions">
      <button type="submit" class="btn btn-danger">Delete ${what}</button>
      <a class="btn btn-quiet" href="${cancelHref}">Cancel</a>
    </form>
  </div>`;
}
