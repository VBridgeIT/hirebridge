import test from 'node:test';
import assert from 'node:assert/strict';
import { currentLca, currentApproval, deadlines, recordNotes, i9Date } from '../../src/status.js';

const today = '2026-10-23';
const emp = { status: 'active', work_auth_type: 'H-1B', work_auth_expiry: '2027-01-15', i9_reverify_date: null };
const lcas = [
  { id: 1, status: 'certified', begin_date: '2023-11-01', end_date: '2026-10-31' },
  { id: 2, status: 'certified', begin_date: '2026-11-01', end_date: '2029-10-31' },
  { id: 3, status: 'withdrawn', begin_date: '2026-01-01', end_date: '2028-01-01' },
];
const petitions = [
  { id: 1, status: 'approved', petition_type: 'new', validity_start: '2023-11-01', validity_end: '2026-10-31' },
  { id: 2, status: 'pending', petition_type: 'extension', validity_start: null, validity_end: null },
];

test('current LCA is the certified one in force today', () => {
  assert.equal(currentLca(lcas, today).id, 1);
  assert.equal(currentLca(lcas, '2026-11-05').id, 2);
  assert.equal(currentLca([lcas[2]], today), null);
});

test('current approval is the latest approved validity', () => {
  assert.equal(currentApproval(petitions).id, 1);
  assert.equal(currentApproval([petitions[1]]), null);
});

test('deadlines are sorted and I-9 falls back to work authorization', () => {
  const d = deadlines(emp, lcas, petitions, today);
  assert.deepEqual(d.map((x) => x.kind), ['h1b', 'lca', 'i9']);
  assert.equal(d[2].date, '2027-01-15');
  assert.equal(d[0].urgency.level, 'soon');
  assert.deepEqual(i9Date(emp), { date: '2027-01-15', derived: true });
  assert.deepEqual(deadlines({ ...emp, status: 'former' }, lcas, petitions, today), []);
});

test('notes flag lapsed approvals and pending petitions', () => {
  const later = '2026-11-10';
  const notes = recordNotes(emp, lcas, petitions, later).map((n) => n.text).join(' | ');
  assert.match(notes, /approval has ended and a petition is pending/);
  assert.match(notes, /Extension petition pending/);
  const none = recordNotes(emp, lcas, [{ ...petitions[0] }], later).map((n) => n.text).join(' | ');
  assert.match(none, /no pending petition is recorded/);
  const capGap = recordNotes({ ...emp, work_auth_type: 'F-1 cap-gap' }, [], [petitions[1]], today).map((n) => n.text).join(' | ');
  assert.doesNotMatch(capGap, /LCA/);
});
