// Real Cal.com webhook adapter.
//
// Cal.com calls this once a webhook subscription is set up on their side
// (Event Type -> Webhooks, or account-wide) pointed at:
//   POST https://autobuilt-api.onrender.com/api/public/:slug/calcom-webhook
// with a "Secret" that must match the business's `calcom_webhook_secret`.
//
// This file only maps Cal.com's payload shape onto our own booking/customer
// model — routes/public.js does the HTTP plumbing (resolving the business,
// verifying the signature, calling these functions).

import crypto from 'node:crypto';
import db from '../db/index.js';
import { handleExternalBooking } from './calcom.js';

// Cal.com signs the raw JSON body with HMAC-SHA256 using the webhook's
// configured secret, sent as `X-Cal-Signature-256` (hex digest, no prefix).
// If a business hasn't set a secret yet (still copying it into Cal.com for
// the first time) we allow the request through unverified rather than
// hard-failing — but we log it loudly, since that's a real gap.
export function verifyCalcomSignature({ rawBody, signatureHeader, secret }) {
  if (!secret) {
    console.warn('[calcom-webhook] No webhook secret configured for this business — accepting unverified.');
    return true;
  }
  if (!signatureHeader) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  // Constant-time compare; also guards against length mismatches throwing.
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signatureHeader), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Cal.com attendees don't always carry a phone number (it depends on the
// booking question set / location type). Check every place it's known to
// show up before giving up — an SMS-based business needs *a* number to
// text, even a rough one, more than it needs to reject the booking.
function extractPhone(payload) {
  const attendee = payload.attendees?.[0] || {};
  const responses = payload.responses || {};
  const candidates = [
    attendee.phoneNumber,
    responses.smsReminderNumber?.value ?? responses.smsReminderNumber,
    responses.phone?.value ?? responses.phone,
    responses.attendeePhoneNumber?.value ?? responses.attendeePhoneNumber,
    payload.location?.startsWith?.('+') ? payload.location : null,
  ].filter(Boolean);
  return candidates[0] || null;
}

function extractServiceId(businessId, payload) {
  const eventTypeId = payload.eventTypeId ?? payload.eventType?.id;
  if (eventTypeId == null) return null;
  const service = db
    .prepare('SELECT id FROM services WHERE business_id = ? AND calcom_event_type_id = ?')
    .get(businessId, String(eventTypeId));
  return service?.id ?? null;
}

// BOOKING_CREATED (and the "booking already exists" retry case).
export function handleBookingCreated({ businessId, payload }) {
  const uid = payload.uid;
  if (uid) {
    const existing = db.prepare('SELECT * FROM appointments WHERE business_id = ? AND external_ref = ?').get(businessId, uid);
    if (existing) return existing; // Cal.com retried the same webhook — don't double-book.
  }

  const attendee = payload.attendees?.[0] || {};
  const phone = extractPhone(payload);
  if (!attendee.name && !phone) {
    throw Object.assign(new Error('Booking has no attendee name or phone number — cannot create a customer.'), { status: 422 });
  }

  const appointment = handleExternalBooking({
    businessId,
    customerName: attendee.name || 'Cal.com booking',
    // A real client's business absolutely needs a phone to text reminders;
    // a placeholder keeps the booking from being lost while flagging it's
    // incomplete rather than silently guessing a number.
    phone: phone || 'unknown',
    email: attendee.email || null,
    serviceId: extractServiceId(businessId, payload),
    startAt: payload.startTime,
    endAt: payload.endTime,
    source: 'cal.com',
  });

  if (uid) {
    db.prepare('UPDATE appointments SET external_ref = ? WHERE id = ?').run(uid, appointment.id);
  }
  return db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointment.id);
}

// BOOKING_CANCELLED.
export function handleBookingCancelled({ businessId, payload }) {
  const uid = payload.uid;
  if (!uid) return null;
  const appointment = db.prepare('SELECT * FROM appointments WHERE business_id = ? AND external_ref = ?').get(businessId, uid);
  if (!appointment) return null; // Nothing to cancel — was never mirrored here (or already gone).
  db.prepare(`UPDATE appointments SET status = 'cancelled' WHERE id = ?`).run(appointment.id);
  return db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointment.id);
}

// BOOKING_RESCHEDULED. Cal.com sends the *new* booking's uid in `payload.uid`
// and the old one it replaced in `payload.rescheduleUid` (field name has
// varied across Cal.com API versions, so we check both spots we've seen).
export function handleBookingRescheduled({ businessId, payload }) {
  const oldUid = payload.rescheduleUid || payload.fromReschedule?.uid || null;
  const newUid = payload.uid;
  const existing = oldUid
    ? db.prepare('SELECT * FROM appointments WHERE business_id = ? AND external_ref = ?').get(businessId, oldUid)
    : null;

  if (!existing) {
    // We don't have the original — treat it as a fresh booking so it isn't lost.
    return handleBookingCreated({ businessId, payload });
  }

  db.prepare(`UPDATE appointments SET start_at = ?, end_at = ?, external_ref = ?, status = 'booked' WHERE id = ?`).run(
    payload.startTime,
    payload.endTime,
    newUid || oldUid,
    existing.id
  );
  return db.prepare('SELECT * FROM appointments WHERE id = ?').get(existing.id);
}

export function handleCalcomWebhook({ businessId, triggerEvent, payload }) {
  switch (triggerEvent) {
    case 'BOOKING_CREATED':
      return { handled: true, result: handleBookingCreated({ businessId, payload }) };
    case 'BOOKING_CANCELLED':
      return { handled: true, result: handleBookingCancelled({ businessId, payload }) };
    case 'BOOKING_RESCHEDULED':
      return { handled: true, result: handleBookingRescheduled({ businessId, payload }) };
    default:
      // Unrecognized event types (e.g. MEETING_ENDED, BOOKING_PAYMENT_INITIATED)
      // are acknowledged, not errored — Cal.com will retry-storm on non-2xx.
      return { handled: false, result: null };
  }
}
