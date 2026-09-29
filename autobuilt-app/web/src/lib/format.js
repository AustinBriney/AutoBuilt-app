import dayjs from 'dayjs';

// The database stamps rows with SQLite's datetime('now'), which is UTC but has
// no timezone marker ("2026-09-29 20:04:12"). dayjs reads that as LOCAL time,
// so in Central time every such timestamp looked 5 hours in the future and
// old messages showed "just now". Read those strings as UTC explicitly.
function toDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return dayjs(new Date(value.replace(' ', 'T') + 'Z'));
  }
  return dayjs(value);
}

export function formatMoney(cents) {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
}

export function formatDuration(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatDayHeading(date) {
  const d = toDate(date);
  if (d.isSame(dayjs(), 'day')) return 'Today';
  if (d.isSame(dayjs().add(1, 'day'), 'day')) return 'Tomorrow';
  return d.format('dddd, MMM D');
}

export function formatTime(date) {
  return toDate(date).format('h:mm A');
}

// Turn a stored 24-hour "HH:MM" string into a friendly "h:mm AM/PM".
export function formatClock(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  return dayjs().hour(h).minute(m || 0).format('h:mm A');
}

export function formatRelative(date) {
  const d = toDate(date);
  const now = dayjs();
  const diffMin = now.diff(d, 'minute');
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = now.diff(d, 'hour');
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = now.diff(d, 'day');
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.format('MMM D');
}

export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}
