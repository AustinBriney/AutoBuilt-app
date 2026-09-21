import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import db from './index.js';
import { scheduleReminder } from '../lib/automations.js';
import { recordInboundMessage } from '../lib/messaging.js';

// Wipe and reseed — this is a mock-client demo environment, not production data.
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
  `INSERT INTO businesses (id, name, owner_name, phone, email, address, booking_url)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
).run(
  businessId,
  'Fade District Barbershop',
  'Marcus Reed',
  '+12255550142',
  'marcus@fadedistrict.example',
  '4400 Government St, Baton Rouge, LA',
  'https://autobuiltsystems.com/book/fade-district'
);

const services = [
  ['Signature Fade', 'Classic tapered fade, straight razor line-up.', 4000, 45],
  ['Beard Trim', 'Shape-up and line, hot towel finish.', 2000, 20],
  ['Fade + Beard Combo', 'Full fade with a beard trim, our most popular.', 5500, 60],
  ['Kids Cut (12 & under)', 'Quick clean cut for kids.', 2500, 30],
];
const serviceIds = services.map(([name, description, priceCents, durationMin]) => {
  const id = randomUUID();
  db.prepare(
    'INSERT INTO services (id, business_id, name, description, price_cents, duration_min) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, businessId, name, description, priceCents, durationMin);
  return id;
});

// Tue-Sat 9am-6pm, closed Sun/Mon
[2, 3, 4, 5, 6].forEach((weekday) => {
  db.prepare(
    'INSERT INTO availability_rules (id, business_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?, ?)'
  ).run(randomUUID(), businessId, weekday, '09:00', '18:00');
});

function addCustomer(name, phone, email) {
  const id = randomUUID();
  db.prepare('INSERT INTO customers (id, business_id, name, phone, email) VALUES (?, ?, ?, ?, ?)').run(
    id, businessId, name, phone, email
  );
  return id;
}

const dorian = addCustomer('Dorian Lewis', '+12255550101', 'dorian@example.com');
const bryce = addCustomer('Bryce Thompson', '+12255550118', null);
const alicia = addCustomer('Alicia Fontenot', '+12255550129', 'alicia@example.com');
const marquis = addCustomer('Marquis Owens', '+12255550133', null);

function addAppointment(customerId, serviceId, startAt, status, source = 'website') {
  const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
  const endAt = dayjs(startAt).add(svc.duration_min, 'minute').toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO appointments (id, business_id, customer_id, service_id, start_at, end_at, status, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, businessId, customerId, serviceId, startAt, endAt, status, source);
  return id;
}

// A completed history for Dorian (regular, going quiet -> winback candidate later)
addAppointment(dorian, serviceIds[2], dayjs().subtract(60, 'day').hour(10).minute(0).toISOString(), 'completed');
addAppointment(dorian, serviceIds[0], dayjs().subtract(30, 'day').hour(11).minute(0).toISOString(), 'completed');

// Bryce: one completed visit recently
addAppointment(bryce, serviceIds[0], dayjs().subtract(5, 'day').hour(14).minute(0).toISOString(), 'completed');

// Alicia: upcoming appointment today, later today (for the Dashboard + reminder demo)
const aliciaApptStart = dayjs().add(2, 'hour').minute(0).second(0).toISOString();
const aliciaApptId = addAppointment(alicia, serviceIds[1], aliciaApptStart, 'booked');
scheduleReminder({ businessId, customerId: alicia, appointmentId: aliciaApptId, appointmentStartAt: aliciaApptStart });

// Marquis: upcoming appointment tomorrow
const marquisApptStart = dayjs().add(1, 'day').hour(13).minute(30).second(0).toISOString();
const marquisApptId = addAppointment(marquis, serviceIds[3], marquisApptStart, 'booked');
scheduleReminder({ businessId, customerId: marquis, appointmentId: marquisApptId, appointmentStartAt: marquisApptStart });

// A little inbox activity: an inbound question from Bryce, unanswered.
recordInboundMessage({ businessId, customerId: bryce, body: 'Hey do yall take walk ins today?' });
console.log('Seed complete. Business:', businessId);
