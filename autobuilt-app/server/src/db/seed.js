import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import db from './index.js';
import { scheduleReminder } from '../lib/automations.js';
import { recordInboundMessage } from '../lib/messaging.js';

// Wipe and reseed — this is a mock-client demo environment, not production data.
// Intentionally minimal: exactly ONE example of each thing (service, customer,
// appointment, inbox message, weekly-hours entry) so the app reads clean and a
// new client can immediately see the shape of everything.
db.exec(`
  DELETE FROM automation_events;
  DELETE FROM messages;
  DELETE FROM conversations;
  DELETE FROM appointments;
  DELETE FROM customers;
  DELETE FROM time_off;
  DELETE FROM availability_rules;
  DELETE FROM services;
  DELETE FROM businesses;
`);

const businessId = randomUUID();
db.prepare(
  `INSERT INTO businesses (id, name, owner_name, phone, email, address, booking_url, onboarded)
   VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
).run(
  businessId,
  'Fade District Barbershop',
  'Marcus Reed',
  '+12255550142',
  'marcus@fadedistrict.example',
  '4400 Government St, Baton Rouge, LA',
  'https://autobuiltsystems.com/book/fade-district'
);

// One service
const serviceId = randomUUID();
db.prepare(
  'INSERT INTO services (id, business_id, name, description, price_cents, duration_min) VALUES (?, ?, ?, ?, ?, ?)'
).run(serviceId, businessId, 'Signature Fade', 'Classic tapered fade, straight razor line-up.', 4000, 45);

// One weekly-hours entry (Monday 9:00 AM – 5:00 PM) as the example
db.prepare(
  'INSERT INTO availability_rules (id, business_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?, ?)'
).run(randomUUID(), businessId, 1, '09:00', '17:00');

// One customer
const customerId = randomUUID();
db.prepare('INSERT INTO customers (id, business_id, name, phone, email) VALUES (?, ?, ?, ?, ?)').run(
  customerId, businessId, 'Dorian Lewis', '+12255550101', 'dorian@example.com'
);

// One upcoming appointment (today, a couple hours out) so the Dashboard has
// something to show; scheduling the reminder demonstrates the automation engine.
const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
const startAt = dayjs().add(2, 'hour').minute(0).second(0).millisecond(0).toISOString();
const endAt = dayjs(startAt).add(svc.duration_min, 'minute').toISOString();
const appointmentId = randomUUID();
db.prepare(
  `INSERT INTO appointments (id, business_id, customer_id, service_id, start_at, end_at, status, source)
   VALUES (?, ?, ?, ?, ?, ?, 'booked', 'website')`
).run(appointmentId, businessId, customerId, serviceId, startAt, endAt);
scheduleReminder({ businessId, customerId, appointmentId, appointmentStartAt: startAt });

// One inbox message: an inbound question from the same customer, unanswered.
recordInboundMessage({ businessId, customerId, body: 'Hey, do you have any openings this week?' });

console.log('Seed complete. Business:', businessId);
