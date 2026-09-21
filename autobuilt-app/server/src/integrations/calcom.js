// Mock Cal.com adapter.
//
// In production, a customer books on the public website, Cal.com creates the
// booking, and Cal.com's webhook (BOOKING_CREATED) hits our server, which
// calls `handleExternalBooking()` below. For the mock client, the same
// function is called directly from routes/public.js's /book endpoint,
// simulating "the website already talked to Cal.com and Cal.com told us."
//
// To go live: register a Cal.com webhook pointed at a new
// POST /api/public/calcom-webhook route that verifies the signature and
// calls this same handleExternalBooking() with the normalized fields.

import { randomUUID } from 'node:crypto';
import db from '../db/index.js';
import { findOrCreateCustomer } from '../lib/customers.js';
import { scheduleReminder } from '../lib/automations.js';

export function handleExternalBooking({ businessId, customerName, phone, email, serviceId, startAt, endAt, source = 'website' }) {
  const customer = findOrCreateCustomer({ businessId, name: customerName, phone, email });

  const id = randomUUID();
  db.prepare(
    `INSERT INTO appointments (id, business_id, customer_id, service_id, start_at, end_at, status, source)
     VALUES (?, ?, ?, ?, ?, ?, 'booked', ?)`
  ).run(id, businessId, customer.id, serviceId ?? null, startAt, endAt, source);

  scheduleReminder({ businessId, customerId: customer.id, appointmentId: id, appointmentStartAt: startAt });

  return db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
}
