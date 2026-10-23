// Works out where each employee stands: the LCA and H-1B approval in force, and the dates that need attention.
import { urgency } from './dates.js';

const PETITION_LABEL = { new: 'New employment petition', extension: 'Extension petition', amendment: 'Amendment petition', transfer: 'Change of employer petition' };

export function currentLca(lcas, today) {
  const certified = lcas.filter((l) => l.status === 'certified');
  const inForce = certified.filter((l) => l.begin_date <= today && l.end_date >= today);
  const pick = (rows) => rows.sort((a, b) => (b.end_date > a.end_date ? 1 : b.end_date < a.end_date ? -1 : b.id - a.id))[0] || null;
  return pick(inForce) || pick(certified.filter((l) => l.begin_date > today)) || pick(certified);
}

export function currentApproval(petitions) {
  const approved = petitions.filter((p) => p.status === 'approved' && p.validity_end);
  approved.sort((a, b) => (b.validity_end > a.validity_end ? 1 : b.validity_end < a.validity_end ? -1 : b.id - a.id));
  return approved[0] || null;
}

export function i9Date(emp) {
  if (emp.i9_reverify_date) return { date: emp.i9_reverify_date, derived: false };
  if (emp.work_auth_expiry) return { date: emp.work_auth_expiry, derived: true };
  return null;
}

// Dates that need watching for an active employee, soonest first.
export function deadlines(emp, lcas, petitions, today) {
  if (emp.status !== 'active') return [];
  const out = [];
  const approval = currentApproval(petitions);
  if (approval) out.push({ kind: 'h1b', label: 'H-1B approval ends', date: approval.validity_end });
  const lca = currentLca(lcas, today);
  if (lca) out.push({ kind: 'lca', label: 'LCA ends', date: lca.end_date });
  const i9 = i9Date(emp);
  if (i9) out.push({ kind: 'i9', label: 'I-9 reverification due', date: i9.date });
  if (emp.work_auth_expiry && !(i9 && i9.derived)) out.push({ kind: 'auth', label: 'Work authorization expires', date: emp.work_auth_expiry });
  for (const d of out) d.urgency = urgency(d.date, today);
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

export function nextDeadline(list) {
  return list[0] || null;
}

// Gaps in the record that HR should look at. Plain facts, not legal conclusions.
export function recordNotes(emp, lcas, petitions, today) {
  if (emp.status !== 'active') return [];
  const notes = [];
  const approval = currentApproval(petitions);
  const pending = petitions.filter((p) => p.status === 'pending');
  // LCA and petition gaps only matter once the person is working in H-1B status (not, say, on F-1 cap-gap).
  const isH1b = emp.work_auth_type === 'H-1B' || Boolean(approval && approval.validity_start && approval.validity_start <= today);
  if (isH1b && !approval && !pending.length) notes.push({ level: 'warn', text: 'No approved or pending H-1B petition is recorded.' });
  if (approval && approval.validity_end < today) {
    const ext = pending.find((p) => p.petition_type === 'extension' || p.petition_type === 'amendment' || p.petition_type === 'transfer');
    if (ext) {
      notes.push({ level: 'info', text: 'The H-1B approval has ended and a petition is pending. Depending on the petition type and when it was filed, the employee may be allowed to keep working while it is pending (for example, up to 240 days for an extension filed on time). Confirm with the immigration attorney.' });
    } else {
      notes.push({ level: 'warn', text: 'The latest H-1B approval has ended and no pending petition is recorded.' });
    }
  }
  if (isH1b) {
    const lca = currentLca(lcas, today);
    if (!lca) notes.push({ level: 'warn', text: 'No certified LCA is recorded.' });
    else if (!(lca.begin_date <= today && lca.end_date >= today)) notes.push({ level: 'warn', text: 'No certified LCA covers today.' });
  }
  for (const p of pending) {
    notes.push({ level: 'info', text: `${PETITION_LABEL[p.petition_type] || 'Petition'} pending${p.receipt_number ? ` (receipt ${p.receipt_number})` : ''}. Update it here when USCIS decides.` });
  }
  if (!emp.work_auth_expiry && !emp.i9_reverify_date) notes.push({ level: 'info', text: 'No work authorization expiry or I-9 reverification date is recorded.' });
  return notes;
}
