import { randomUUID } from 'node:crypto';
import db from '../db/index.js';

// Normalizes to E.164-ish digits-only comparison so "(555) 123-4567" and
// "+15551234567" match the same customer. Good enough for a mock client;
// swap for a real phone-parsing library before onboarding real businesses.
export function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

export function findOrCreateCustomer({ businessId, name, phone, email }) {
  const normalized = normalizePhone(phone);
  const existing = db
    .prepare('SELECT * FROM customers WHERE business_id = ? AND phone = ?')
    .get(businessId, normalized);
  if (existing) {
    // Fill in details we didn't have before (e.g. a name learned later).
    if (name && !existing.name) {
      db.prepare('UPDATE customers SET name = ? WHERE id = ?').run(name, existing.id);
    }
    if (email && !existing.email) {
      db.prepare('UPDATE customers SET email = ? WHERE id = ?').run(email, existing.id);
    }
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(existing.id);
  }

  const id = randomUUID();
  db.prepare(
    'INSERT INTO customers (id, business_id, name, phone, email) VALUES (?, ?, ?, ?, ?)'
  ).run(id, businessId, name || 'Unknown', normalized, email || null);
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
}

export function getCustomerDetail(businessId, customerId) {
  const customer = db
    .prepare('SELECT * FROM customers WHERE id = ? AND business_id = ?')
    .get(customerId, businessId);
  if (!customer) return null;

  const appointments = db
    .prepare(
      `SELECT a.*, s.name as service_name
       FROM appointments a LEFT JOIN services s ON s.id = a.service_id
       WHERE a.customer_id = ? ORDER BY a.start_at DESC`
    )
    .all(customerId);

  const automationHistory = db
    .prepare('SELECT * FROM automation_events WHERE customer_id = ? ORDER BY created_at DESC')
    .all(customerId);

  return {
    ...customer,
    appointments,
    lastAppointmentAt: appointments.find((a) => a.status === 'completed')?.start_at ?? null,
    automationHistory,
  };
}
