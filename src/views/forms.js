import { html, raw } from '../html.js';

function attrs(f) {
  let a = '';
  if (f.required) a += ' required aria-required="true"';
  if (f.max && f.type !== 'date' && f.type !== 'select') a += ` maxlength="${f.max}"`;
  if (f.autocomplete) a += ` autocomplete="${f.autocomplete}"`;
  if (f.inputmode) a += ` inputmode="${f.inputmode}"`;
  return raw(a);
}

export function field(f, value, error) {
  const id = `f-${f.name}`;
  const described = [f.hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ');
  const aria = raw(`${described ? ` aria-describedby="${described}"` : ''}${error ? ' aria-invalid="true"' : ''}`);
  const cls = `input${f.mono ? ' mono' : ''}${error ? ' has-error' : ''}`;
  let control;
  if (f.type === 'select') {
    control = html`<select id="${id}" name="${f.name}" class="${cls}"${attrs(f)}${aria}>
      ${f.blank !== undefined || !f.required ? html`<option value="">${f.blank || 'Choose one'}</option>` : ''}
      ${f.options.map(([v, label]) => html`<option value="${v}"${String(value) === String(v) ? raw(' selected') : ''}>${label}</option>`)}
    </select>`;
  } else if (f.type === 'textarea') {
    control = html`<textarea id="${id}" name="${f.name}" class="${cls}" rows="4"${attrs(f)}${aria}>${value}</textarea>`;
  } else {
    const type = f.type === 'money' ? 'text' : f.type;
    const extra = f.type === 'money' ? raw(' inputmode="decimal"') : '';
    control = html`<input id="${id}" name="${f.name}" type="${type}" class="${cls}" value="${value}"${attrs(f)}${extra}${aria}>`;
  }
  return html`<div class="field${error ? ' field-error' : ''}${f.type === 'textarea' ? ' wide' : ''}">
    <label for="${id}">${f.label}${f.required ? html` <span class="req" aria-hidden="true">*</span>` : ''}</label>
    ${f.hint ? html`<p class="hint" id="${id}-hint">${f.hint}</p>` : ''}
    ${error ? html`<p class="error-text" id="${id}-error"><span class="sr-only">Error: </span>${error}</p>` : ''}
    ${control}
  </div>`;
}

export function errorSummary(fields, errors) {
  const keys = fields.map((f) => f.name).filter((n) => errors[n]);
  for (const k of Object.keys(errors)) if (!keys.includes(k)) keys.push(k);
  if (!keys.length) return '';
  return html`<div class="error-summary" role="alert" tabindex="-1" aria-labelledby="error-summary-title">
    <h2 id="error-summary-title">Please fix ${keys.length === 1 ? 'this' : `these ${keys.length}`} before saving</h2>
    <ul>${keys.map((k) => (k.startsWith('_') ? html`<li>${errors[k]}</li>` : html`<li><a href="#f-${k}">${errors[k]}</a></li>`))}</ul>
  </div>`;
}

// Fields are laid out in sections: those without a group first, then one fieldset per group.
export function fieldsets(fields, input, errors) {
  const groups = [];
  for (const f of fields) {
    const g = f.group || '';
    let entry = groups.find((x) => x.name === g);
    if (!entry) { entry = { name: g, fields: [] }; groups.push(entry); }
    entry.fields.push(f);
  }
  return groups.map((g) => g.name
    ? html`<fieldset class="group"><legend>${g.name}</legend><div class="grid">${g.fields.map((f) => field(f, input[f.name] ?? '', errors[f.name]))}</div></fieldset>`
    : html`<div class="grid">${g.fields.map((f) => field(f, input[f.name] ?? '', errors[f.name]))}</div>`);
}

export function formPage({ heading, intro, action, fields, input, errors = {}, submit, cancelHref, version, crumbs }) {
  return html`${crumbs}
  <h1>${heading}</h1>
  ${intro ? html`<p class="lede">${intro}</p>` : ''}
  ${errorSummary(fields, errors)}
  <form method="post" action="${action}" class="form" novalidate>
    ${version ? html`<input type="hidden" name="version" value="${version}">` : ''}
    ${fieldsets(fields, input, errors)}
    <div class="actions">
      <button type="submit" class="btn">${submit}</button>
      <a class="btn btn-quiet" href="${cancelHref}">Cancel</a>
    </div>
  </form>`;
}

export function crumbs(items) {
  return html`<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map(([label, href]) => href
    ? html`<li><a href="${href}">${label}</a></li>`
    : html`<li aria-current="page">${label}</li>`)}</ol></nav>`;
}
