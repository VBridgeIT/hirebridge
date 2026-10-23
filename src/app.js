// Request handling: sign-in check, routing and the page handlers.
import { html } from './html.js';
import { todayISO, fmtDate } from './dates.js';
import { authenticate, missingConfig } from './auth.js';
import {
  ensureSchema, insertRecord, updateRecord, deleteRecord, getEmployee, getLca, getPetition,
  lcasFor, petitionsFor, historyFor, listEmployees,
} from './db.js';
import {
  EMPLOYEE_FIELDS, LCA_FIELDS, PETITION_FIELDS, parseFields, rowToInput, checkEmployee, checkLca, checkPetition,
  optionLabel, PETITION_TYPES,
} from './fields.js';
import { layout, messagePage } from './views/layout.js';
import { formPage, crumbs } from './views/forms.js';
import { listPage, employeePage, confirmDeletePage } from './views/employees.js';
import { loadSample, removeSample } from './sample.js';

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

function respond(body, status = 200, extra = {}) {
  return new Response(String(body), { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS, ...extra } });
}
function redirect(location) {
  return new Response(null, { status: 303, headers: { Location: location, ...SECURITY_HEADERS } });
}
function page(ctx, title, body, status = 200) {
  return respond(layout({ title, user: ctx.user, body }), status);
}
function message(p) {
  return respond(p.body, p.status);
}
function notFound(ctx) {
  return message(messagePage({ title: 'Not found', heading: 'Page not found', user: ctx && ctx.user, status: 404,
    text: html`<p>That page or record does not exist. It may have been deleted.</p><p><a href="/employees">Back to employees</a></p>` }));
}

// Forms must be posted from this site (blocks cross-site form posts).
function sameOrigin(request, url) {
  const origin = request.headers.get('Origin');
  if (origin) return origin === url.origin;
  return request.headers.get('Sec-Fetch-Site') === 'same-origin';
}

const conflictError = { _conflict: 'Someone else changed this record while you were editing it, so your changes were not saved. Open the record again to see the latest version, then make your changes.' };

// ---------- Employees ----------

async function listEmployeesPage(ctx) {
  const { url } = ctx;
  const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const status = ['active', 'former', 'all'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'active';
  const sort = url.searchParams.get('sort') === 'name' ? 'name' : 'next';
  const all = await listEmployees(ctx.db);
  const needle = q.toLowerCase();
  const rows = all.filter(({ emp, lcas, petitions }) => {
    if (status !== 'all' && emp.status !== status) return false;
    if (!needle) return true;
    const hay = [emp.full_name, emp.job_title, emp.employee_number, emp.work_email,
      ...lcas.flatMap((l) => [l.case_number, l.worksite_city, l.worksite_state, l.soc_code]),
      ...petitions.map((p) => p.receipt_number)].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(needle);
  });
  return page(ctx, 'Employees', listPage({
    rows, today: ctx.today, q, status, sort, msg: url.searchParams.get('msg'), total: all.length,
    allowSample: ctx.allowSample, hasSample: all.some((r) => r.emp.is_sample),
  }));
}

function employeeForm(ctx, { emp, input, errors = {}, status = 200 }) {
  const editing = Boolean(emp);
  const body = formPage({
    crumbs: crumbs(editing ? [['Employees', '/employees'], [emp.full_name, `/employees/${emp.id}`], ['Edit', null]] : [['Employees', '/employees'], ['Add employee', null]]),
    heading: editing ? `Edit ${emp.full_name}` : 'Add employee',
    intro: editing ? null : 'Start with the basics. You can add LCAs and H-1B petitions on the next page.',
    action: editing ? `/employees/${emp.id}` : '/employees',
    fields: EMPLOYEE_FIELDS, input, errors,
    submit: editing ? 'Save changes' : 'Add employee',
    cancelHref: editing ? `/employees/${emp.id}` : '/employees',
    version: editing ? (ctx.version || emp.updated_at) : null,
  });
  return page(ctx, editing ? `Edit ${emp.full_name}` : 'Add employee', body, status);
}

async function newEmployee(ctx) {
  return employeeForm(ctx, { input: { status: 'active' } });
}

async function createEmployee(ctx) {
  const form = await ctx.request.formData();
  const { input, values, errors } = parseFields(EMPLOYEE_FIELDS, form);
  checkEmployee(values, errors);
  if (Object.keys(errors).length) return employeeForm(ctx, { input, errors, status: 422 });
  const id = await insertRecord(ctx.db, 'employee', values, { user: ctx.user, summary: `Added employee ${values.full_name}` });
  return redirect(`/employees/${id}?msg=employee-added`);
}

async function showEmployee(ctx, id) {
  const emp = await getEmployee(ctx.db, id);
  if (!emp) return notFound(ctx);
  const [lcas, petitions, history] = await Promise.all([lcasFor(ctx.db, id), petitionsFor(ctx.db, id), historyFor(ctx.db, id)]);
  return page(ctx, emp.full_name, employeePage({ emp, lcas, petitions, history, today: ctx.today, msg: ctx.url.searchParams.get('msg') }));
}

async function editEmployee(ctx, id) {
  const emp = await getEmployee(ctx.db, id);
  if (!emp) return notFound(ctx);
  return employeeForm(ctx, { emp, input: rowToInput(EMPLOYEE_FIELDS, emp) });
}

async function saveEmployee(ctx, id) {
  const emp = await getEmployee(ctx.db, id);
  if (!emp) return notFound(ctx);
  const form = await ctx.request.formData();
  ctx.version = String(form.get('version') || '');
  const { input, values, errors } = parseFields(EMPLOYEE_FIELDS, form);
  checkEmployee(values, errors);
  if (Object.keys(errors).length) return employeeForm(ctx, { emp, input, errors, status: 422 });
  const result = await updateRecord(ctx.db, 'employee', id, emp, values, {
    user: ctx.user, employeeId: id, summary: `Edited employee ${values.full_name}`, version: ctx.version,
  });
  if (result === 'conflict') return employeeForm(ctx, { emp, input, errors: conflictError, status: 409 });
  return redirect(`/employees/${id}?msg=${result === 'unchanged' ? 'no-changes' : 'employee-saved'}`);
}

// ---------- LCAs ----------

function lcaForm(ctx, { emp, lca, input, errors = {}, status = 200 }) {
  const editing = Boolean(lca);
  const body = formPage({
    crumbs: crumbs([['Employees', '/employees'], [emp.full_name, `/employees/${emp.id}`], [editing ? `Edit LCA` : 'Add LCA', null]]),
    heading: editing ? `Edit LCA ${lca.case_number}` : `Add an LCA for ${emp.full_name}`,
    intro: editing ? null : 'Copy the details from the certified Labor Condition Application (Form ETA-9035).',
    action: editing ? `/lcas/${lca.id}` : `/employees/${emp.id}/lcas`,
    fields: LCA_FIELDS, input, errors,
    submit: editing ? 'Save LCA' : 'Add LCA',
    cancelHref: `/employees/${emp.id}`,
    version: editing ? (ctx.version || lca.updated_at) : null,
  });
  return page(ctx, editing ? 'Edit LCA' : 'Add LCA', body, status);
}

async function readLcaForm(ctx, emp, selfId) {
  const form = await ctx.request.formData();
  ctx.version = String(form.get('version') || '');
  const parsed = parseFields(LCA_FIELDS, form);
  checkLca(parsed.values, parsed.errors);
  if (parsed.values.case_number && !parsed.errors.case_number) {
    const dup = (await lcasFor(ctx.db, emp.id)).find((l) => l.case_number === parsed.values.case_number && l.id !== selfId);
    if (dup) parsed.errors.case_number = `${emp.full_name} already has LCA ${dup.case_number}`;
  }
  return parsed;
}

async function newLca(ctx, empId) {
  const emp = await getEmployee(ctx.db, empId);
  if (!emp) return notFound(ctx);
  return lcaForm(ctx, { emp, input: { status: 'certified', job_title: emp.job_title || '', wage_unit: 'year' } });
}

async function createLca(ctx, empId) {
  const emp = await getEmployee(ctx.db, empId);
  if (!emp) return notFound(ctx);
  const { input, values, errors } = await readLcaForm(ctx, emp, null);
  if (Object.keys(errors).length) return lcaForm(ctx, { emp, input, errors, status: 422 });
  await insertRecord(ctx.db, 'lca', values, { user: ctx.user, employeeId: emp.id, extra: { employee_id: emp.id }, summary: `Added LCA ${values.case_number}` });
  return redirect(`/employees/${emp.id}?msg=lca-added`);
}

async function editLca(ctx, id) {
  const lca = await getLca(ctx.db, id);
  if (!lca) return notFound(ctx);
  const emp = await getEmployee(ctx.db, lca.employee_id);
  return lcaForm(ctx, { emp, lca, input: rowToInput(LCA_FIELDS, lca) });
}

async function saveLca(ctx, id) {
  const lca = await getLca(ctx.db, id);
  if (!lca) return notFound(ctx);
  const emp = await getEmployee(ctx.db, lca.employee_id);
  const { input, values, errors } = await readLcaForm(ctx, emp, lca.id);
  if (Object.keys(errors).length) return lcaForm(ctx, { emp, lca, input, errors, status: 422 });
  const result = await updateRecord(ctx.db, 'lca', id, lca, values, { user: ctx.user, employeeId: emp.id, summary: `Edited LCA ${values.case_number}`, version: ctx.version });
  if (result === 'conflict') return lcaForm(ctx, { emp, lca, input, errors: conflictError, status: 409 });
  return redirect(`/employees/${emp.id}?msg=${result === 'unchanged' ? 'no-changes' : 'lca-saved'}`);
}

async function lcaDeleteGuard(ctx, lca) {
  const linked = (await petitionsFor(ctx.db, lca.employee_id)).filter((p) => p.lca_id === lca.id);
  return linked;
}

async function confirmDeleteLca(ctx, id) {
  const lca = await getLca(ctx.db, id);
  if (!lca) return notFound(ctx);
  const emp = await getEmployee(ctx.db, lca.employee_id);
  const crumbItems = [['Employees', '/employees'], [emp.full_name, `/employees/${emp.id}`], ['Delete LCA', null]];
  const linked = await lcaDeleteGuard(ctx, lca);
  if (linked.length) {
    return page(ctx, 'Cannot delete LCA', html`${crumbs(crumbItems)}<div class="panel narrow"><h1>This LCA cannot be deleted yet</h1>
      <p>${linked.length === 1 ? 'A petition is' : `${linked.length} petitions are`} linked to LCA <span class="mono">${lca.case_number}</span>. Edit ${linked.length === 1 ? 'that petition' : 'those petitions'} to link a different LCA first.</p>
      <p><a class="btn btn-quiet" href="/employees/${emp.id}">Back to ${emp.full_name}</a></p></div>`, 409);
  }
  return page(ctx, 'Delete LCA', confirmDeletePage({
    what: 'this LCA', crumbItems, action: `/lcas/${lca.id}/delete`, cancelHref: `/employees/${emp.id}`,
    detail: html`LCA <span class="mono">${lca.case_number}</span> (${fmtDate(lca.begin_date)} to ${fmtDate(lca.end_date)}) will be removed from ${emp.full_name}'s record.`,
  }));
}

async function deleteLca(ctx, id) {
  const lca = await getLca(ctx.db, id);
  if (!lca) return notFound(ctx);
  if ((await lcaDeleteGuard(ctx, lca)).length) return confirmDeleteLca(ctx, id);
  await deleteRecord(ctx.db, 'lca', lca, { user: ctx.user, employeeId: lca.employee_id, summary: `Deleted LCA ${lca.case_number}` });
  return redirect(`/employees/${lca.employee_id}?msg=lca-deleted`);
}

// ---------- Petitions ----------

function petitionFields(lcas) {
  return PETITION_FIELDS.map((f) => (f.name === 'lca_id'
    ? { ...f, options: lcas.map((l) => [String(l.id), `${l.case_number} (${fmtDate(l.begin_date)} to ${fmtDate(l.end_date)})`]) }
    : f));
}

function petitionForm(ctx, { emp, lcas, petition, input, errors = {}, status = 200 }) {
  const editing = Boolean(petition);
  const body = formPage({
    crumbs: crumbs([['Employees', '/employees'], [emp.full_name, `/employees/${emp.id}`], [editing ? 'Edit petition' : 'Add petition', null]]),
    heading: editing ? 'Edit H-1B petition' : `Add an H-1B petition for ${emp.full_name}`,
    intro: editing ? null : (lcas.length ? 'Copy the details from the I-797 receipt or approval notice.' : 'Tip: add the LCA first so you can link it here.'),
    action: editing ? `/petitions/${petition.id}` : `/employees/${emp.id}/petitions`,
    fields: petitionFields(lcas), input, errors,
    submit: editing ? 'Save petition' : 'Add petition',
    cancelHref: `/employees/${emp.id}`,
    version: editing ? (ctx.version || petition.updated_at) : null,
  });
  return page(ctx, editing ? 'Edit petition' : 'Add petition', body, status);
}

async function readPetitionForm(ctx, lcas) {
  const form = await ctx.request.formData();
  ctx.version = String(form.get('version') || '');
  const parsed = parseFields(petitionFields(lcas), form);
  if (parsed.values.lca_id) parsed.values.lca_id = Number(parsed.values.lca_id);
  const lca = parsed.values.lca_id ? lcas.find((l) => l.id === parsed.values.lca_id) : null;
  checkPetition(parsed.values, parsed.errors, lca);
  return parsed;
}

function petitionName(values) {
  return `${optionLabel(PETITION_TYPES, values.petition_type).toLowerCase()} petition${values.receipt_number ? ` ${values.receipt_number}` : ''}`;
}

async function newPetition(ctx, empId) {
  const emp = await getEmployee(ctx.db, empId);
  if (!emp) return notFound(ctx);
  const lcas = await lcasFor(ctx.db, emp.id);
  const certified = lcas.find((l) => l.status === 'certified');
  return petitionForm(ctx, { emp, lcas, input: { petition_type: 'new', status: 'pending', lca_id: certified ? String(certified.id) : '' } });
}

async function createPetition(ctx, empId) {
  const emp = await getEmployee(ctx.db, empId);
  if (!emp) return notFound(ctx);
  const lcas = await lcasFor(ctx.db, emp.id);
  const { input, values, errors } = await readPetitionForm(ctx, lcas);
  if (Object.keys(errors).length) return petitionForm(ctx, { emp, lcas, input, errors, status: 422 });
  await insertRecord(ctx.db, 'petition', values, { user: ctx.user, employeeId: emp.id, extra: { employee_id: emp.id }, summary: `Added ${petitionName(values)}` });
  return redirect(`/employees/${emp.id}?msg=petition-added`);
}

async function editPetition(ctx, id) {
  const petition = await getPetition(ctx.db, id);
  if (!petition) return notFound(ctx);
  const emp = await getEmployee(ctx.db, petition.employee_id);
  const lcas = await lcasFor(ctx.db, emp.id);
  return petitionForm(ctx, { emp, lcas, petition, input: rowToInput(PETITION_FIELDS, petition) });
}

async function savePetition(ctx, id) {
  const petition = await getPetition(ctx.db, id);
  if (!petition) return notFound(ctx);
  const emp = await getEmployee(ctx.db, petition.employee_id);
  const lcas = await lcasFor(ctx.db, emp.id);
  const { input, values, errors } = await readPetitionForm(ctx, lcas);
  if (Object.keys(errors).length) return petitionForm(ctx, { emp, lcas, petition, input, errors, status: 422 });
  const result = await updateRecord(ctx.db, 'petition', id, petition, values, { user: ctx.user, employeeId: emp.id, summary: `Edited ${petitionName(values)}`, version: ctx.version });
  if (result === 'conflict') return petitionForm(ctx, { emp, lcas, petition, input, errors: conflictError, status: 409 });
  return redirect(`/employees/${emp.id}?msg=${result === 'unchanged' ? 'no-changes' : 'petition-saved'}`);
}

async function confirmDeletePetition(ctx, id) {
  const petition = await getPetition(ctx.db, id);
  if (!petition) return notFound(ctx);
  const emp = await getEmployee(ctx.db, petition.employee_id);
  return page(ctx, 'Delete petition', confirmDeletePage({
    what: 'this petition', action: `/petitions/${petition.id}/delete`, cancelHref: `/employees/${emp.id}`,
    crumbItems: [['Employees', '/employees'], [emp.full_name, `/employees/${emp.id}`], ['Delete petition', null]],
    detail: `The ${petitionName(petition)} will be removed from ${emp.full_name}'s record.`,
  }));
}

async function deletePetition(ctx, id) {
  const petition = await getPetition(ctx.db, id);
  if (!petition) return notFound(ctx);
  await deleteRecord(ctx.db, 'petition', petition, { user: ctx.user, employeeId: petition.employee_id, summary: `Deleted ${petitionName(petition)}` });
  return redirect(`/employees/${petition.employee_id}?msg=petition-deleted`);
}

// ---------- Sample data (test sites only) ----------

async function sampleData(ctx) {
  if (!ctx.allowSample) return notFound(ctx);
  const form = await ctx.request.formData();
  if (form.get('do') === 'remove') {
    await removeSample(ctx.db);
    return redirect('/employees?msg=sample-removed');
  }
  await loadSample(ctx.db, ctx.user, ctx.today);
  return redirect('/employees?msg=sample-loaded');
}

// ---------- Routing ----------

const ROUTES = [
  ['GET', /^\/$/, () => redirect('/employees')],
  ['GET', /^\/employees$/, listEmployeesPage],
  ['GET', /^\/employees\/new$/, newEmployee],
  ['POST', /^\/employees$/, createEmployee],
  ['GET', /^\/employees\/(\d+)$/, showEmployee],
  ['GET', /^\/employees\/(\d+)\/edit$/, editEmployee],
  ['POST', /^\/employees\/(\d+)$/, saveEmployee],
  ['GET', /^\/employees\/(\d+)\/lcas\/new$/, newLca],
  ['POST', /^\/employees\/(\d+)\/lcas$/, createLca],
  ['GET', /^\/lcas\/(\d+)\/edit$/, editLca],
  ['POST', /^\/lcas\/(\d+)$/, saveLca],
  ['GET', /^\/lcas\/(\d+)\/delete$/, confirmDeleteLca],
  ['POST', /^\/lcas\/(\d+)\/delete$/, deleteLca],
  ['GET', /^\/employees\/(\d+)\/petitions\/new$/, newPetition],
  ['POST', /^\/employees\/(\d+)\/petitions$/, createPetition],
  ['GET', /^\/petitions\/(\d+)\/edit$/, editPetition],
  ['POST', /^\/petitions\/(\d+)$/, savePetition],
  ['GET', /^\/petitions\/(\d+)\/delete$/, confirmDeletePetition],
  ['POST', /^\/petitions\/(\d+)\/delete$/, deletePetition],
  ['POST', /^\/sample$/, sampleData],
];

export async function handle(request, env, { fetchImpl = fetch, access } = {}) {
  const url = new URL(request.url);
  try {
    const missing = missingConfig(env, url);
    if (missing.length) {
      console.error('Missing settings:', missing.join(', '));
      return message(messagePage({ title: 'Not set up', heading: 'The tracker is not set up yet', status: 503,
        text: html`<p>These settings are missing in the Cloudflare Worker: ${missing.join(', ')}.</p><p>See SETUP.md in the repository.</p>` }));
    }
    const auth = await authenticate(request, env, { fetchImpl, access });
    if (!auth.email) {
      if (auth.detail) console.warn('Access token rejected:', auth.detail);
      return message(auth.status === 403
        ? messagePage({ title: 'No access', heading: 'You do not have access', status: 403,
          text: html`<p>You are signed in as ${auth.email}, but this address is not on the list of HR users. Ask RG to add you.</p><p><a href="/cdn-cgi/access/logout">Sign out</a></p>` })
        : messagePage({ title: 'Sign in', heading: 'Please sign in', status: 401,
          text: html`<p>Your sign-in could not be confirmed. Open the tracker again to sign in with your work email.</p>
            <p class="muted small">Reason code: ${auth.reason === 'no-token' ? 'no Cloudflare Access sign-in on this request' : 'Cloudflare Access sign-in could not be checked'}.</p>` }));
    }
    if (request.method === 'POST' && !sameOrigin(request, url)) {
      return message(messagePage({ title: 'Blocked', heading: 'That form could not be sent', status: 403, user: auth.email,
        text: html`<p>The form did not come from this site. Go back, reload the page and try again.</p>` }));
    }
    const route = ROUTES.find(([m, re]) => m === request.method && re.test(url.pathname));
    const ctx = { request, env, url, user: auth.email, db: env.DB, today: todayISO(), allowSample: env.ALLOW_SAMPLE_DATA === '1' };
    if (!route) {
      const otherMethod = ROUTES.some(([, re]) => re.test(url.pathname));
      if (otherMethod) return respond('Method not allowed', 405, { Allow: 'GET, POST', 'Content-Type': 'text/plain; charset=utf-8' });
      return notFound(ctx);
    }
    await ensureSchema(env.DB);
    const params = url.pathname.match(route[1]).slice(1).map(Number);
    return await route[2](ctx, ...params);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return message(messagePage({ title: 'Error', heading: 'Something went wrong', status: 500,
      text: html`<p>The page could not be loaded. Nothing was saved if you were submitting a form. Try again in a minute; if it keeps happening, tell RG.</p>` }));
  }
}
