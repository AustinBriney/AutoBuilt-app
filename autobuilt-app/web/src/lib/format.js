import dayjs from 'dayjs';

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
  const d = dayjs(date);
  if (d.isSame(dayjs(), 'day')) return 'Today';
  if (d.isSame(dayjs().add(1, 'day'), 'day')) return 'Tomorrow';
  return d.format('dddd, MMM D');
}

export function formatTime(date) {
  return dayjs(date).format('h:mm A');
}

// Turn a stored 24-hour "HH:MM" string into a friendly "h:mm AM/PM".
export function formatClock(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  return dayjs().hour(h).minute(m || 0).format('h:mm A');
}

export function formatRelative(date) {
  const d = dayjs(date);
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
