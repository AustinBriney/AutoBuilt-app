import { Router } from 'express';
import db from '../db/index.js';
import { getCurrentBusinessId } from './business.js';
import { handleExternalBooking } from '../integrations/calcom.js';
import { findOrCreateCustomer } from '../lib/customers.js';
import { recordInboundMessage } from '../lib/messaging.js';
import { scheduleMissedCallText } from '../lib/automations.js';

// Everything in this router stands in for a real external webhook:
//   /book          <- Cal.com "booking created" webhook
//   /inbound-sms   <- Twilio "message received" webhook
//   /missed-call   <- Twilio "voice call, no answer" webhook
// Wiring the real services later means pointing their webhooks at routes
// shaped like these (with signature verification added) instead of calling
// them directly from a fake "customer" client the way our test scripts do.

export const publicRouter = Router();

publicRouter.post('/book', (req, res) => {
  const businessId = getCurrentBusinessId();
  const { customerName, phone, email, serviceId, startAt, durationMin = 30 } = req.body;
  if (!customerName || !phone || !startAt) {
    return res.status(400).json({ error: 'customerName, phone, and startAt are required.' });
  }
  const endAt = new Date(new Date(startAt).getTime() + durationMin * 60000).toISOString();
  const appointment = handleExternalBooking({
    businessId,
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

publicRouter.post('/inbound-sms', (req, res) => {
  const businessId = getCurrentBusinessId();
  const { phone, name, body } = req.body;
  if (!phone || !body) return res.status(400).json({ error: 'phone and body are required.' });
  const customer = findOrCreateCustomer({ businessId, name: name || 'Unknown', phone });
  const message = recordInboundMessage({ businessId, customerId: customer.id, body });
  res.status(201).json(message);
});

publicRouter.post('/missed-call', (req, res) => {
  const businessId = getCurrentBusinessId();
  const { phone, name } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required.' });
  const customer = findOrCreateCustomer({ businessId, name: name || 'Unknown caller', phone });
  const event = scheduleMissedCallText({ businessId, customerId: customer.id });
  res.status(201).json(event);
});
