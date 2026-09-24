import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import dayjs from 'dayjs';
import db from '../db/index.js';
import { getCurrentBusinessId } from '../lib/requestContext.js';
import { findOrCreateCustomer } from '../lib/customers.js';
import { scheduleReminder, scheduleReviewRequest } from '../lib/automations.js';

export const appointmentsRouter = Router();

appointmentsRouter.get('/', (req, res) => {
  const businessId = getCurrentBusinessId();
  const { from, to } = req.query;
  let rows;
  if (from && to) {
    rows = db
      .prepare(
        `SELECT a.*, c.name as customer_name, c.phone as customer_phone, s.name as service_name
         FROM appointments a
         JOIN customers c ON c.id = a.customer_id
         LEFT JOIN services s ON s.id = a.service_id
         WHERE a.business_id = ? AND a.start_at >= ? AND a.start_at <= ?
         ORDER BY a.start_at`
      )
      .all(businessId, from, to);
  } else {
    rows = db
      .prepare(
        `SELECT a.*, c.name as customer_name, c.phone as customer_phone, s.name as service_name
         FROM appointments a
         JOIN customers c ON c.id = a.customer_id
         LEFT JOIN services s ON s.id = a.service_id
         WHERE a.business_id = ?
         ORDER BY a.start_at`
      )
      .all(businessId);
  }
  res.json(rows);
});

// Manual add, from the Schedule screen (owner books on behalf of a walk-in
// or phone caller).
appointmentsRouter.post('/', (req, res) => {
  const businessId = getCurrentBusinessId();
  const { customerName, phone, email, serviceId, startAt, durationMin } = req.body;
  if (!customerName || !phone || !startAt) {
    return res.status(400).json({ error: 'customerName, phone, and startAt are required.' });
  }

  const customer = findOrCreateCustomer({ businessId, name: customerName, phone, email });

  let duration = durationMin;
  let resolvedServiceId = serviceId ?? null;
  if (!duration && serviceId) {
    const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
    duration = svc?.duration_min ?? 30;
  }
  duration = duration || 30;
  const endAt = dayjs(startAt).add(duration, 'minute').toISOString();

  const id = randomUUID();
  db.prepare(
    `INSERT INTO appointments (id, business_id, customer_id, service_id, start_at, end_at, status, source)
     VALUES (?, ?, ?, ?, ?, ?, 'booked', 'manual')`
  ).run(id, businessId, customer.id, resolvedServiceId, startAt, endAt);

  scheduleReminder({ businessId, customerId: customer.id, appointmentId: id, appointmentStartAt: startAt });

  res.status(201).json(db.prepare('SELECT * FROM appointments WHERE id = ?').get(id));
});

appointmentsRouter.patch('/:id', (req, res) => {
  const businessId = getCurrentBusinessId();
  const existing = db.prepare('SELECT * FROM appointments WHERE id = ? AND business_id = ?').get(req.params.id, businessId);
  if (!existing) return res.status(404).json({ error: 'Appointment not found.' });

  const fieldMap = { status: 'status', startAt: 'start_at', endAt: 'end_at', notes: 'notes' };
  const updates = Object.entries(req.body).filter(([k]) => fieldMap[k]);
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update.' });
  const setClause = updates.map(([k]) => `${fieldMap[k]} = ?`).join(', ');
  const values = updates.map(([, v]) => v);
  db.prepare(`UPDATE appointments SET ${setClause} WHERE id = ?`).run(...values, req.params.id);

  const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (req.body.status === 'completed' && existing.status !== 'completed') {
    scheduleReviewRequest({ businessId, customerId: updated.customer_id, appointmentId: updated.id });
  }
  res.json(updated);
});

// Permanently remove an appointment. Any scheduled automations tied to it
// (reminders, review requests) are cleared first so nothing fires for a
// booking that no longer exists.
appointmentsRouter.delete('/:id', (req, res) => {
  const businessId = getCurrentBusinessId();
  const remove = db.transaction((id) => {
    db.prepare('DELETE FROM automation_events WHERE appointment_id = ? AND business_id = ?').run(id, businessId);
    db.prepare('DELETE FROM appointments WHERE id = ? AND business_id = ?').run(id, businessId);
  });
  remove(req.params.id);
  res.status(204).end();
});
