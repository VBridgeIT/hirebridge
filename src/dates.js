// Dates are stored as ISO strings (YYYY-MM-DD) and shown as MM/DD/YYYY.
// "Today" is taken in Charlotte's time zone so a deadline does not flip a day early in the evening.

export const TIME_ZONE = 'America/New_York';

export function todayISO(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUTC(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysBetween(fromISO, toISO) {
  return Math.round((toUTC(toISO) - toUTC(fromISO)) / 86400000);
}

export function addYears(iso, years) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y + years, m - 1, d));
  // 29 Feb + 1 year rolls to 1 Mar; keep it on 28 Feb instead
  if (dt.getUTCMonth() !== m - 1) dt.setUTCDate(0);
  return dt.toISOString().slice(0, 10);
}

export function addDays(iso, days) {
  return new Date(toUTC(iso) + days * 86400000).toISOString().slice(0, 10);
}

export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

export function fmtTimestamp(ts) {
  if (!ts) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, month: '2-digit', day: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(ts));
}

// How soon a date needs attention: overdue, soon (within `soonDays`), or later.
export function urgency(iso, today, soonDays = 90) {
  if (!iso) return null;
  const days = daysBetween(today, iso);
  if (days < 0) return { level: 'overdue', days };
  if (days <= soonDays) return { level: 'soon', days };
  return { level: 'later', days };
}

export function relativeDays(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return '1 day ago';
  const n = Math.abs(days);
  let span;
  if (n <= 90) span = `${n} days`;
  else if (n < 730) span = `${Math.round(n / 30.44)} months`;
  else span = `${Math.floor(n / 365.25)} years`;
  return days < 0 ? `${span} ago` : `in ${span}`;
}
