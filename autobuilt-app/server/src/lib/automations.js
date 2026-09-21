import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import db from '../db/index.js';
import { sendOutboundMessage } from './messaging.js';

function getBusiness(businessId) {
  return db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
}

function insertEvent({ businessId, customerId, appointmentId = null, type, scheduledFor, meta = {} }) {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO automation_events (id, business_id, customer_id, appointment_id, type, scheduled_for, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, businessId, customerId, appointmentId, type, scheduledFor, JSON.stringify(meta));
  return db.prepare('SELECT * FROM automation_events WHERE id = ?').get(id);
}

// --- Message templates -----------------------------------------------------
// Kept here, in one place, so tone stays consistent across every business
// without the owner ever writing SMS copy themselves.

const templates = {
  missed_call: (biz) =>
    `Hi! Sorry we missed your call at ${biz.name}. You can book a time here: ${biz.booking_url || '[booking link]'} Reply STOP to opt out.`,
  reminder: (biz, { customerName, when, serviceName }) =>
    `Hi ${customerName}, this is ${biz.name} reminding you about your${serviceName ? ` ${serviceName}` : ''} appointment on ${when}. Reply C to confirm or R to reschedule.`,
  review_request: (biz) =>
    `Thanks for visiting ${biz.name}! On a scale of 1-5, how was your experience? Just reply with a number.`,
  winback: (biz) =>
    `Hi from ${biz.name} — it's been a while! We'd love to see you again. Want to grab a spot? ${biz.booking_url || '[booking link]'}`,
};

// --- Scheduling entry points -------------------------------------------------

export function scheduleMissedCallText({ businessId, customerId }) {
  const biz = getBusiness(businessId);
  if (!biz.automations_missed_call) return null;
  const event = insertEvent({ businessId, customerId, type: 'missed_call', scheduledFor: dayjs().toISOString() });
  return event;
}

export function scheduleReminder({ businessId, customerId, appointmentId, appointmentStartAt }) {
  const biz = getBusiness(businessId);
  if (!biz.automations_reminder) return null;
  const scheduledFor = dayjs(appointmentStartAt).subtract(biz.reminder_hours_before, 'hour');
  // If the appointment was booked less than reminder_hours_before away, send
  // "soon" instead of missing the window entirely.
  const when = scheduledFor.isBefore(dayjs()) ? dayjs().add(1, 'minute') : scheduledFor;
  return insertEvent({
    businessId,
    customerId,
    appointmentId,
    type: 'reminder',
    scheduledFor: when.toISOString(),
  });
}

export function scheduleReviewRequest({ businessId, customerId, appointmentId }) {
  const biz = getBusiness(businessId);
  if (!biz.automations_review) return null;
  const scheduledFor = dayjs().add(biz.review_delay_hours, 'hour');
  return insertEvent({ businessId, customerId, appointmentId, type: 'review_request', scheduledFor: scheduledFor.toISOString() });
}

function scheduleWinback({ businessId, customerId }) {
  const biz = getBusiness(businessId);
  if (!biz.automations_winback) return null;
  // Avoid duplicate winbacks: skip if one already fired in the last winback_days.
  const recent = db
    .prepare(
      `SELECT * FROM automation_events WHERE business_id = ? AND customer_id = ? AND type = 'winback'
       AND status = 'sent' AND datetime(sent_at) > datetime('now', ?)`
    )
    .get(businessId, customerId, `-${biz.winback_days} days`);
  if (recent) return null;
  return insertEvent({ businessId, customerId, type: 'winback', scheduledFor: dayjs().toISOString() });
}

// --- The runner ---------------------------------------------------------
// Processes due events (sends the SMS, marks sent) and sweeps for
// state-driven triggers: appointments that just ended (-> completed, then
// schedules a review request) and customers who've gone quiet long enough
// to be win-back eligible.

export async function runAutomationTick() {
  await processDueEvents();
  completeFinishedAppointments();
  sweepWinbackEligibility();
}

async function processDueEvents() {
  const due = db
    .prepare(`SELECT * FROM automation_events WHERE status = 'scheduled' AND datetime(scheduled_for) <= datetime('now')`)
    .all();

  for (const event of due) {
    const biz = getBusiness(event.business_id);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(event.customer_id);
    const appointment = event.appointment_id
      ? db
          .prepare(
            `SELECT a.*, s.name as service_name FROM appointments a
             LEFT JOIN services s ON s.id = a.service_id WHERE a.id = ?`
          )
          .get(event.appointment_id)
      : null;

    let body;
    if (event.type === 'reminder') {
      body = templates.reminder(biz, {
        customerName: customer.name,
        when: dayjs(appointment.start_at).format('ddd, MMM D [at] h:mm A'),
        serviceName: appointment.service_name,
      });
    } else {
      body = templates[event.type](biz);
    }

    await sendOutboundMessage({
      businessId: event.business_id,
      customerId: event.customer_id,
      body,
      automationType: event.type,
    });

    db.prepare("UPDATE automation_events SET status = 'sent', sent_at = datetime('now') WHERE id = ?").run(event.id);
  }
}

function completeFinishedAppointments() {
  const finished = db
    .prepare(
      `SELECT * FROM appointments WHERE status IN ('booked','confirmed') AND datetime(end_at) <= datetime('now')`
    )
    .all();

  for (const appt of finished) {
    db.prepare("UPDATE appointments SET status = 'completed' WHERE id = ?").run(appt.id);
    scheduleReviewRequest({ businessId: appt.business_id, customerId: appt.customer_id, appointmentId: appt.id });
  }
}

function sweepWinbackEligibility() {
  const businesses = db.prepare('SELECT * FROM businesses').all();
  for (const biz of businesses) {
    if (!biz.automations_winback) continue;
    const lapsed = db
      .prepare(
        `SELECT c.id as customer_id, MAX(a.start_at) as last_visit
         FROM customers c JOIN appointments a ON a.customer_id = c.id
         WHERE c.business_id = ? AND a.status = 'completed'
         GROUP BY c.id
         HAVING datetime(last_visit) <= datetime('now', ?)`
      )
      .all(biz.id, `-${biz.winback_days} days`);

    for (const row of lapsed) {
      scheduleWinback({ businessId: biz.id, customerId: row.customer_id });
    }
  }
}
