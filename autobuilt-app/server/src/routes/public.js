import { Router } from 'express';
import db from '../db/index.js';
import { handleExternalBooking } from '../integrations/calcom.js';
import { verifyCalcomSignature, handleCalcomWebhook } from '../integrations/calcomWebhook.js';
import { findOrCreateCustomer } from '../lib/customers.js';
import { recordInboundMessage } from '../lib/messaging.js';
import { scheduleMissedCallText } from '../lib/automations.js';
import {
  availabilityForRange,
  bookingSettings,
  slotStatus,
  todayInZone,
  SLOT_STATUS_MESSAGES,
} from '../lib/slots.js';

// Everything in this router stands in for a real external webhook or a
// client's own public booking page:
//   /:slug/services       <- the client's public site listing what's bookable
//   /:slug/profile        <- name, phone, address, hours for the site's chrome
//   /:slug/availability   <- the open times the site's calendar draws
//   /:slug/book           <- a customer booking on the client's own site
//   /:slug/calcom-webhook <- REAL Cal.com webhook (BOOKING_CREATED/CANCELLED/RESCHEDULED)
//   /:slug/inbound-sms    <- Twilio "message received" webhook
//   /:slug/missed-call    <- Twilio "voice call, no answer" webhook
// No login here by design — a customer booking a haircut isn't an
// AutoBuilt account holder. The :slug is what tells us which business's
// data this request belongs to, since there's no auth token to read it
// from.

export const publicRouter = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'autobuilt-admin-2026';

function resolveBusiness(req, res) {
  const business = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(req.params.slug);
  if (!business) {
    res.status(404).json({ error: 'Unknown business.' });
    return null;
  }
  return business;
}

publicRouter.get('/:slug/services', (req, res) => {
  const business = resolveBusiness(req, res);
  if (!business) return;
  const services = db
    .prepare('SELECT id, name, description, price_cents, duration_min FROM services WHERE business_id = ? AND active = 1 ORDER BY sort_order, created_at')
    .all(business.id);
  res.json(services);
});

// Everything a client's own website needs to describe the business, read
// live from the app so nothing on the site is typed in by hand: change the
// hours, phone or address in the AutoBuilt app and the site reflects it on
// the next page load. Public by design (it is what would be printed on the
// site anyway); it never returns owner email, plan, secrets or customers.
publicRouter.get('/:slug/profile', (req, res) => {
  const business = resolveBusiness(req, res);
  if (!business) return;
  const hours = db
    .prepare('SELECT weekday, start_time, end_time FROM availability_rules WHERE business_id = ? ORDER BY weekday, start_time')
    .all(business.id)
    .map((r) => ({ weekday: r.weekday, start: r.start_time, end: r.end_time }));
  const { slotMinutes, minNoticeMin, bookingWindowDays } = bookingSettings(business);
  res.json({
    name: business.name,
    phone: business.phone || null,
    address: business.address || null,
    bookingUrl: business.booking_url || null,
    timezone: business.timezone,
    hours,
    slotMinutes,
    minNoticeMin,
    bookingWindowDays,
  });
});

// The open times a customer can actually pick, so the client's website can
// draw a real calendar instead of a free-text box that accepts times the
// shop is closed. One request covers a whole range of days, because the
// calendar needs to know which days to grey out before anything is picked.
//
//   GET /api/public/<slug>/availability?serviceId=<id>&from=YYYY-MM-DD&days=30
//
// serviceId matters: a 60-minute service has fewer openings than a
// 30-minute one on the same day, since the whole thing has to fit before
// closing time.
publicRouter.get('/:slug/availability', (req, res) => {
  const business = resolveBusiness(req, res);
  if (!business) return;

  let durationMin = 30;
  const { serviceId } = req.query;
  if (serviceId) {
    const service = db
      .prepare('SELECT duration_min FROM services WHERE id = ? AND business_id = ? AND active = 1')
      .get(serviceId, business.id);
    if (!service) return res.status(404).json({ error: 'Unknown service.' });
    durationMin = service.duration_min;
  }

  const timeZone = business.timezone || 'America/Chicago';
  const today = todayInZone(timeZone);
  const requestedFrom = String(req.query.from || '');
  const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedFrom) && requestedFrom >= today ? requestedFrom : today;
  const requestedDays = Number(req.query.days);
  const days = Math.min(Math.max(Number.isFinite(requestedDays) ? requestedDays : 30, 1), 62);

  res.json({ from: fromDate, ...availabilityForRange({ business, durationMin, fromDate, days }) });
});

publicRouter.post('/:slug/book', (req, res) => {
  const business = resolveBusiness(req, res);
  if (!business) return;
  const { customerName, phone, email, serviceId, startAt, durationMin = 30 } = req.body;
  if (!customerName || !phone || !startAt) {
    return res.status(400).json({ error: 'customerName, phone, and startAt are required.' });
  }

  // The service decides how long the booking runs; a duration sent by the
  // page is only a fallback for the admin test tools, which book without
  // picking a service.
  let minutes = durationMin;
  if (serviceId) {
    const service = db
      .prepare('SELECT duration_min FROM services WHERE id = ? AND business_id = ?')
      .get(serviceId, business.id);
    if (!service) return res.status(400).json({ error: 'Unknown service.' });
    minutes = service.duration_min;
  }

  // Re-check the slot at write time. The customer's page could have been
  // open for twenty minutes, and the times it drew are only a snapshot —
  // this is the check that actually prevents a double booking. The admin
  // test tools carry the admin secret and skip it on purpose, so Austin can
  // still simulate a booking at an arbitrary time.
  const isAdminTest = req.headers['x-admin-secret'] === ADMIN_SECRET;
  if (!isAdminTest) {
    const status = slotStatus({ business, durationMin: minutes, startAt });
    if (status !== 'open') {
      return res.status(409).json({ error: SLOT_STATUS_MESSAGES[status] || 'That time is no longer available.' });
    }
  }

  const endAt = new Date(new Date(startAt).getTime() + minutes * 60000).toISOString();
  const appointment = handleExternalBooking({
    businessId: business.id,
    customerName,
    phone,
    email,
    serviceId,
    startAt,
    endAt,
    source: 'website',
  });
  res.status(201).json(appointment);
});

// Real Cal.com webhook. Point a Cal.com webhook subscription (account-wide,
// or per event type) at this URL with the business's secret (Settings ->
// Cal.com shows both), and every booking/cancel/reschedule on that Cal.com
// account will flow straight into this business's AutoBuilt data.
publicRouter.post('/:slug/calcom-webhook', (req, res) => {
  const business = resolveBusiness(req, res);
  if (!business) return;

  const signatureHeader = req.get('X-Cal-Signature-256');
  const valid = verifyCalcomSignature({
    rawBody: req.rawBody,
    signatureHeader,
    secret: business.calcom_webhook_secret,
  });
  if (!valid) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  const { triggerEvent, payload } = req.body || {};
  if (!triggerEvent || !payload) {
    return res.status(400).json({ error: 'Malformed Cal.com webhook payload.' });
  }

  try {
    const { handled } = handleCalcomWebhook({ businessId: business.id, triggerEvent, payload });
    // Always 200 on a recognized shape, even for event types we ignore —
    // returning an error here makes Cal.com retry-storm the endpoint.
    res.status(200).json({ ok: true, handled });
  } catch (err) {
    console.error('[calcom-webhook]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to process webhook.' });
  }
});

publicRouter.post('/:slug/inbound-sms', (req, res) => {
  const business = resolveBusiness(req, res);
  if (!business) return;
  const { phone, name, body } = req.body;
  if (!phone || !body) return res.status(400).json({ error: 'phone and body are required.' });
  const customer = findOrCreateCustomer({ businessId: business.id, name: name || 'Unknown', phone });
  const message = recordInboundMessage({ businessId: business.id, customerId: customer.id, body });
  res.status(201).json(message);
});

publicRouter.post('/:slug/missed-call', (req, res) => {
  const business = resolveBusiness(req, res);
  if (!business) return;
  const { phone, name } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required.' });
  const customer = findOrCreateCustomer({ businessId: business.id, name: name || 'Unknown caller', phone });
  const event = scheduleMissedCallText({ businessId: business.id, customerId: customer.id });
  res.status(201).json(event);
});
