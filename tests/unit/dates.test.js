import test from 'node:test';
import assert from 'node:assert/strict';
import { isISODate, addYears, addDays, daysBetween, fmtDate, relativeDays, todayISO, urgency } from '../../src/dates.js';

test('isISODate accepts real dates only', () => {
  assert.equal(isISODate('2026-02-28'), true);
  assert.equal(isISODate('2028-02-29'), true);
  assert.equal(isISODate('2026-02-29'), false);
  assert.equal(isISODate('2026-13-01'), false);
  assert.equal(isISODate('10/23/2026'), false);
  assert.equal(isISODate(''), false);
});

test('addYears keeps 29 Feb on 28 Feb in non-leap years', () => {
  assert.equal(addYears('2028-02-29', 1), '2029-02-28');
  assert.equal(addYears('2026-10-23', 3), '2029-10-23');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('daysBetween and formatting', () => {
  assert.equal(daysBetween('2026-10-23', '2026-11-02'), 10);
  assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2); // across a DST change
  assert.equal(fmtDate('2026-10-23'), '10/23/2026');
  assert.equal(fmtDate(null), '');
});

test('relativeDays reads naturally', () => {
  assert.equal(relativeDays(0), 'today');
  assert.equal(relativeDays(1), 'tomorrow');
  assert.equal(relativeDays(-1), '1 day ago');
  assert.equal(relativeDays(45), 'in 45 days');
  assert.equal(relativeDays(-10), '10 days ago');
  assert.equal(relativeDays(365), 'in 12 months');
  assert.equal(relativeDays(731), 'in 2 years');
});

test('todayISO uses Charlotte time, not UTC', () => {
  // 02:00 UTC on 24 Oct is still 23 Oct in New York
  assert.equal(todayISO(new Date('2026-10-24T02:00:00Z')), '2026-10-23');
  assert.equal(todayISO(new Date('2026-10-24T05:00:00Z')), '2026-10-24');
});

test('urgency levels', () => {
  assert.equal(urgency('2026-10-20', '2026-10-23').level, 'overdue');
  assert.equal(urgency('2026-12-01', '2026-10-23').level, 'soon');
  assert.equal(urgency('2027-06-01', '2026-10-23').level, 'later');
  assert.equal(urgency(null, '2026-10-23'), null);
});
