import { Router } from 'express';
import db from '../db/index.js';
import { handleExternalBooking } from '../integrations/calcom.js';
import { verifyCalcomSignature, handleCalcomWebhook } from '../integrations/calcomWebhook.js';
import { findOrCreateCustomer } from '../lib/customers.js';
import { recordInboundMessage } from '../lib/messaging.js';
import { scheduleMissedCallText } from '../lib/automations.js';

// Everything in this router stands in for a real external webhook or a
// client's own public booking page:
//   /:slug/services       <- the client's public site listing what's bookable
//   /:slug/book           <- MOCK "booking created" (used by mock-site + Test Tools)
//   /:slug/calcom-webhook <- REAL Cal.com webhook (BOOKING_CREATED/CANCELLED/RESCHEDULED)
//   /:slug/inbound-sms    <- Twilio "message received" webhook
//   /:slug/missed-call    <- Twilio "voice call, no answer" webhook
// No login here by design — a customer booking a haircut isn't an
// AutoBuilt account holder. The :slug is what tells us which business's
// data this request belongs to, since there's no auth token to read it
// from.

export const publicRouter = Router();

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

publicRouter.post('/:slug/book', (req, res) => {
  const business = resolveBusiness(req, res);
  if (!business) return;
  const { customerName, phone, email, serviceId, startAt, durationMin = 30 } = req.body;
  if (!customerName || !phone || !startAt) {
    return res.status(400).json({ error: 'customerName, phone, and startAt are required.' });
  }
  const endAt = new Date(new Date(startAt).getTime() + durationMin * 60000).toISOString();
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
