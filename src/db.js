// Database schema and queries (Cloudflare D1, which is SQLite).
// The app applies any missing migrations itself on first use, so nobody has to run SQL by hand.

const STAMPS = `created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL`;

export const MIGRATIONS = [
  {
    version: 1,
    name: 'employees, LCAs, petitions, audit log',
    statements: [
      `CREATE TABLE employees (
        id INTEGER PRIMARY KEY,
        full_name TEXT NOT NULL,
        work_email TEXT,
        employee_number TEXT,
        job_title TEXT,
        hire_date TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','former')),
        end_date TEXT,
        work_auth_type TEXT,
        work_auth_expiry TEXT,
        i9_reverify_date TEXT,
        notes TEXT,
        is_sample INTEGER NOT NULL DEFAULT 0,
        ${STAMPS})`,
      `CREATE TABLE lcas (
        id INTEGER PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        case_number TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'certified' CHECK (status IN ('certified','withdrawn','expired')),
        job_title TEXT,
        soc_code TEXT,
        begin_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        certified_date TEXT,
        worksite_address TEXT,
        worksite_city TEXT,
        worksite_state TEXT,
        worksite_zip TEXT,
        wage_cents INTEGER,
        wage_unit TEXT CHECK (wage_unit IS NULL OR wage_unit IN ('year','hour')),
        prevailing_wage_cents INTEGER,
        pw_level TEXT,
        pw_source TEXT,
        ${STAMPS})`,
      `CREATE INDEX lcas_employee ON lcas(employee_id)`,
      `CREATE TABLE petitions (
        id INTEGER PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        lca_id INTEGER REFERENCES lcas(id) ON DELETE SET NULL,
        receipt_number TEXT,
        petition_type TEXT NOT NULL CHECK (petition_type IN ('new','extension','amendment','transfer')),
        status TEXT NOT NULL CHECK (status IN ('pending','approved','denied','withdrawn')),
        validity_start TEXT,
        validity_end TEXT,
        ${STAMPS})`,
      `CREATE INDEX petitions_employee ON petitions(employee_id)`,
      `CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY,
        at TEXT NOT NULL,
        user_email TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('create','update','delete')),
        entity TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        employee_id INTEGER,
        summary TEXT NOT NULL,
        changes TEXT)`,
      `CREATE INDEX audit_employee ON audit_log(employee_id, id)`,
    ],
  },
];

let schemaReady = false;

export async function ensureSchema(db) {
  if (schemaReady) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)').run();
  for (const m of MIGRATIONS) {
    const done = await db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').bind(m.version).first();
    if (done) continue;
    try {
      // A batch runs as one transaction, so a migration is applied completely or not at all.
      await db.batch([
        ...m.statements.map((s) => db.prepare(s)),
        db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').bind(m.version, m.name, new Date().toISOString()),
      ]);
    } catch (err) {
      // Another request may have applied it at the same moment; only fail if it is still missing.
      const now = await db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').bind(m.version).first();
      if (!now) throw err;
    }
  }
  schemaReady = true;
}

export function resetSchemaFlagForTests() { schemaReady = false; }

const TABLE = { employee: 'employees', lca: 'lcas', petition: 'petitions' };

// Columns each record type stores (besides id and the created/updated stamps).
export const COLUMNS = {
  employee: ['full_name', 'work_email', 'employee_number', 'job_title', 'hire_date', 'status', 'end_date', 'work_auth_type', 'work_auth_expiry', 'i9_reverify_date', 'notes'],
  lca: ['case_number', 'status', 'job_title', 'soc_code', 'begin_date', 'end_date', 'certified_date', 'worksite_address', 'worksite_city', 'worksite_state', 'worksite_zip', 'wage_cents', 'wage_unit', 'prevailing_wage_cents', 'pw_level', 'pw_source'],
  petition: ['receipt_number', 'petition_type', 'status', 'lca_id', 'validity_start', 'validity_end'],
};

function auditStmt(db, { user, at, action, entity, entityIdSql, entityId, employeeId, employeeIdSql, summary, changes }) {
  const sql = `INSERT INTO audit_log (at, user_email, action, entity, entity_id, employee_id, summary, changes)
    VALUES (?, ?, ?, ?, ${entityIdSql || '?'}, ${employeeIdSql || '?'}, ?, ?)`;
  const binds = [at, user, action, entity];
  if (!entityIdSql) binds.push(entityId);
  if (!employeeIdSql) binds.push(employeeId ?? null);
  binds.push(summary, changes ? JSON.stringify(changes) : null);
  return db.prepare(sql).bind(...binds);
}

// Insert a record and its audit entry in one transaction. Returns the new id.
export async function insertRecord(db, entity, values, { user, employeeId, summary, extra = {} }) {
  const at = new Date().toISOString();
  const cols = [...COLUMNS[entity], ...Object.keys(extra)];
  const all = { ...values, ...extra };
  const placeholders = cols.map(() => '?').join(', ');
  const ins = db.prepare(`INSERT INTO ${TABLE[entity]} (${cols.join(', ')}, created_at, created_by, updated_at, updated_by)
    VALUES (${placeholders}, ?, ?, ?, ?)`).bind(...cols.map((c) => all[c] ?? null), at, user, at, user);
  const changes = {};
  for (const c of COLUMNS[entity]) if (values[c] !== null && values[c] !== undefined) changes[c] = [null, values[c]];
  const audit = auditStmt(db, {
    user, at, action: 'create', entity, entityIdSql: 'last_insert_rowid()',
    employeeId, employeeIdSql: entity === 'employee' ? 'last_insert_rowid()' : null, summary, changes,
  });
  const res = await db.batch([ins, audit]);
  return res[0].meta.last_row_id;
}

// Update a record if it has not changed since the form was opened (version = updated_at).
// Returns 'saved', 'unchanged' or 'conflict'.
export async function updateRecord(db, entity, id, current, values, { user, employeeId, summary, version }) {
  const changes = {};
  for (const c of COLUMNS[entity]) {
    const before = current[c] ?? null;
    const after = values[c] ?? null;
    if (before !== after) changes[c] = [before, after];
  }
  if (!Object.keys(changes).length) return 'unchanged';
  if (version !== current.updated_at) return 'conflict';
  const at = new Date().toISOString();
  const cols = Object.keys(changes);
  const upd = db.prepare(`UPDATE ${TABLE[entity]} SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ?, updated_by = ?
    WHERE id = ? AND updated_at = ?`).bind(...cols.map((c) => changes[c][1]), at, user, id, version);
  // The audit row is written only if the UPDATE matched (changes() = 1); both run in one transaction.
  const audit = db.prepare(`INSERT INTO audit_log (at, user_email, action, entity, entity_id, employee_id, summary, changes)
    SELECT ?, ?, 'update', ?, ?, ?, ?, ? WHERE changes() = 1`)
    .bind(at, user, entity, id, employeeId ?? null, summary, JSON.stringify(changes));
  const res = await db.batch([upd, audit]);
  return res[0].meta.changes === 1 ? 'saved' : 'conflict';
}

export async function deleteRecord(db, entity, current, { user, employeeId, summary }) {
  const at = new Date().toISOString();
  const changes = {};
  for (const c of COLUMNS[entity]) if (current[c] !== null && current[c] !== undefined) changes[c] = [current[c], null];
  await db.batch([
    db.prepare(`DELETE FROM ${TABLE[entity]} WHERE id = ?`).bind(current.id),
    auditStmt(db, { user, at, action: 'delete', entity, entityId: current.id, employeeId, summary, changes }),
  ]);
}

export function getEmployee(db, id) {
  return db.prepare('SELECT * FROM employees WHERE id = ?').bind(id).first();
}
export function getLca(db, id) {
  return db.prepare('SELECT * FROM lcas WHERE id = ?').bind(id).first();
}
export function getPetition(db, id) {
  return db.prepare('SELECT * FROM petitions WHERE id = ?').bind(id).first();
}
export async function lcasFor(db, employeeId) {
  const r = await db.prepare('SELECT * FROM lcas WHERE employee_id = ? ORDER BY begin_date DESC, id DESC').bind(employeeId).all();
  return r.results;
}
export async function petitionsFor(db, employeeId) {
  const r = await db.prepare('SELECT * FROM petitions WHERE employee_id = ? ORDER BY COALESCE(validity_start, created_at) DESC, id DESC').bind(employeeId).all();
  return r.results;
}
export async function historyFor(db, employeeId, limit = 100) {
  const r = await db.prepare('SELECT * FROM audit_log WHERE employee_id = ? ORDER BY id DESC LIMIT ?').bind(employeeId, limit).all();
  return r.results;
}

export async function listEmployees(db) {
  const [e, l, p] = await db.batch([
    db.prepare('SELECT * FROM employees ORDER BY full_name COLLATE NOCASE'),
    db.prepare('SELECT * FROM lcas'),
    db.prepare('SELECT * FROM petitions'),
  ]);
  const byEmp = (rows) => {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.employee_id)) m.set(r.employee_id, []);
      m.get(r.employee_id).push(r);
    }
    return m;
  };
  const lm = byEmp(l.results), pm = byEmp(p.results);
  return e.results.map((emp) => ({ emp, lcas: lm.get(emp.id) || [], petitions: pm.get(emp.id) || [] }));
}
