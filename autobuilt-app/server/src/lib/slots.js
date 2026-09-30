// Real availability: what times a customer can actually pick.
//
// Everything a client's public website shows on its calendar comes from
// here, so there is exactly ONE definition of "open" in the codebase. The
// site asks for slots, the customer picks one, and the booking endpoint
// runs the SAME check again before writing the appointment — that second
// pass is what stops two people who loaded the page at the same time from
// taking the same slot.
//
// A slot is open when ALL of these hold:
//   1. It starts inside one of the shop's weekly hours windows, and the
//      whole service fits before that window closes.
//   2. It doesn't overlap an existing appointment or a block of time off.
//   3. It's far enough in the future to respect the shop's minimum notice.
//   4. It's inside the shop's booking window (how far ahead they take work).

import db from '../db/index.js';

export const SLOT_CHOICES = [15, 20, 30, 45, 60];

// Booking knobs the owner controls in Settings, with the defaults a new
// shop gets. Columns are added by a migration, so an older row can still
// come back with nulls — hence the fallbacks rather than trusting the
// schema default.
export function bookingSettings(business) {
  const slotMinutes = SLOT_CHOICES.includes(business.slot_minutes) ? business.slot_minutes : 30;
  const minNoticeMin = Number.isFinite(business.min_notice_min) && business.min_notice_min >= 0
    ? business.min_notice_min
    : 60;
  const bookingWindowDays = Number.isFinite(business.booking_window_days) && business.booking_window_days > 0
    ? Math.min(business.booking_window_days, 365)
    : 30;
  return { slotMinutes, minNoticeMin, bookingWindowDays };
}

// --- Time zone handling -----------------------------------------------
//
// Hours are stored as wall-clock strings ('09:00') against a weekday,
// because that is how a shop owner thinks: "we open at nine." Appointments
// are stored as absolute UTC instants. Converting between the two has to go
// through the shop's own time zone or the calendar drifts by an hour every
// daylight-saving change. No library: Intl already knows every zone.

function zoneOffsetMs(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const p = {};
  for (const { type, value } of parts) p[type] = value;
  const asIfUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    p.hour === '24' ? 0 : Number(p.hour), Number(p.minute), Number(p.second)
  );
  return asIfUtc - instant.getTime();
}

// '2026-10-03' + 09:00 in America/Chicago -> the real UTC instant.
// Two passes because the offset itself depends on the instant we're solving
// for; the second pass settles it on either side of a DST jump.
export function wallTimeToInstant(dateStr, hh, mm, timeZone) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let ts = naive;
  for (let i = 0; i < 2; i += 1) ts = naive - zoneOffsetMs(new Date(ts), timeZone);
  return ts;
}

// Today's date where the shop is, not where the server is.
export function todayInZone(timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

// 0 = Sunday .. 6 = Saturday, matching availability_rules.weekday.
export function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function timeLabel(instantMs, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone, hour: 'numeric', minute: '2-digit',
  }).format(new Date(instantMs));
}

function parseHm(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh > 24 || mm > 59) return null;
  return [hh, mm];
}

// --- The actual calculation -------------------------------------------

// Returns one entry per day: { date, weekday, closed, slots: [{start, label}] }
// `closed` distinguishes "the shop isn't open that day" from "open but fully
// booked", because the website says something different for each.
export function availabilityForRange({ business, durationMin, fromDate, days }) {
  const timeZone = business.timezone || 'America/Chicago';
  const { slotMinutes, minNoticeMin, bookingWindowDays } = bookingSettings(business);
  const serviceMs = Math.max(5, durationMin) * 60000;

  const windowsByWeekday = new Map();
  for (const rule of db
    .prepare('SELECT weekday, start_time, end_time FROM availability_rules WHERE business_id = ? ORDER BY weekday, start_time')
    .all(business.id)) {
    const start = parseHm(rule.start_time);
    const end = parseHm(rule.end_time);
    if (!start || !end) continue;
    if (!windowsByWeekday.has(rule.weekday)) windowsByWeekday.set(rule.weekday, []);
    windowsByWeekday.get(rule.weekday).push({ start, end });
  }

  const rangeStartMs = wallTimeToInstant(fromDate, 0, 0, timeZone);
  const rangeEndMs = wallTimeToInstant(addDays(fromDate, days), 0, 0, timeZone);
  const rangeStartIso = new Date(rangeStartMs).toISOString();
  const rangeEndIso = new Date(rangeEndMs).toISOString();

  // Anything that makes a slot unavailable, flattened into plain intervals.
  // Cancelled and no-show appointments free their time back up.
  const busy = [];
  for (const row of db
    .prepare(
      `SELECT start_at, end_at FROM appointments
        WHERE business_id = ? AND status NOT IN ('cancelled', 'no_show')
          AND end_at > ? AND start_at < ?`
    )
    .all(business.id, rangeStartIso, rangeEndIso)) {
    busy.push([Date.parse(row.start_at), Date.parse(row.end_at)]);
  }
  for (const row of db
    .prepare('SELECT start_at, end_at FROM time_off WHERE business_id = ? AND end_at > ? AND start_at < ?')
    .all(business.id, rangeStartIso, rangeEndIso)) {
    busy.push([Date.parse(row.start_at), Date.parse(row.end_at)]);
  }
  const blocks = busy.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a);

  const now = Date.now();
  const earliestMs = now + minNoticeMin * 60000;
  const latestMs = now + bookingWindowDays * 86400000;

  const out = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDays(fromDate, i);
    const weekday = weekdayOf(date);
    const windows = windowsByWeekday.get(weekday) || [];
    const seen = new Set();
    const slots = [];

    for (const window of windows) {
      const openMs = wallTimeToInstant(date, window.start[0], window.start[1], timeZone);
      const closeMs = wallTimeToInstant(date, window.end[0], window.end[1], timeZone);
      for (let t = openMs; t + serviceMs <= closeMs; t += slotMinutes * 60000) {
        if (t < earliestMs || t > latestMs) continue;
        if (seen.has(t)) continue;
        const overlaps = blocks.some(([a, b]) => t < b && t + serviceMs > a);
        if (overlaps) continue;
        seen.add(t);
        slots.push({ start: new Date(t).toISOString(), label: timeLabel(t, timeZone) });
      }
    }

    slots.sort((a, b) => a.start.localeCompare(b.start));
    out.push({ date, weekday, closed: windows.length === 0, slots });
  }

  return { timeZone, slotMinutes, minNoticeMin, bookingWindowDays, days: out };
}

// The gate the booking endpoint runs. Deliberately re-derives the day's
// slots instead of doing its own cheaper overlap test, so a time can never
// be bookable by one code path and not the other.
// Returns 'open' | 'past' | 'closed' | 'taken' | 'too-far'.
export function slotStatus({ business, durationMin, startAt }) {
  const startMs = Date.parse(startAt);
  if (!Number.isFinite(startMs)) return 'closed';

  const timeZone = business.timezone || 'America/Chicago';
  const { minNoticeMin, bookingWindowDays } = bookingSettings(business);
  if (startMs < Date.now() + minNoticeMin * 60000) return 'past';
  if (startMs > Date.now() + bookingWindowDays * 86400000) return 'too-far';

  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(startMs));

  const { days } = availabilityForRange({ business, durationMin, fromDate: date, days: 1 });
  const day = days[0];
  if (!day || day.closed) return 'closed';
  const wanted = new Date(startMs).toISOString();
  if (day.slots.some((s) => s.start === wanted)) return 'open';

  // It's a day they're open — so either someone took it first, or it isn't
  // one of the start times this shop offers.
  return 'taken';
}

export const SLOT_STATUS_MESSAGES = {
  past: 'That time has already passed, or it is too soon to book. Please pick another time.',
  closed: "Sorry — we're not open then. Please pick a time from the calendar.",
  taken: 'Sorry — that time was just booked. Please pick another one.',
  'too-far': "That's further ahead than we're taking bookings right now.",
};
