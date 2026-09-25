import { Router } from 'express';
import db from '../db/index.js';
import { getCurrentBusinessId } from '../lib/requestContext.js';
import { getCustomerDetail } from '../lib/customers.js';

export const customersRouter = Router();

customersRouter.get('/', (req, res) => {
  const businessId = getCurrentBusinessId();
  const { q } = req.query;
  let rows;
  if (q) {
    rows = db
      .prepare(
        `SELECT * FROM customers WHERE business_id = ? AND (name LIKE ? OR phone LIKE ?) ORDER BY name`
      )
      .all(businessId, `%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare('SELECT * FROM customers WHERE business_id = ? ORDER BY name').all(businessId);
  }

  const withHistory = rows.map((c) => {
    const last = db
      .prepare(
        `SELECT start_at FROM appointments WHERE customer_id = ? AND status = 'completed' ORDER BY start_at DESC LIMIT 1`
      )
      .get(c.id);
    const upcoming = db
      .prepare(
        `SELECT COUNT(*) as n FROM appointments WHERE customer_id = ? AND status IN ('booked','confirmed') AND start_at >= datetime('now')`
      )
      .get(c.id);
    return { ...c, lastAppointmentAt: last?.start_at ?? null, upcomingCount: upcoming.n };
  });

  res.json(withHistory);
});

customersRouter.get('/:id', (req, res) => {
  const businessId = getCurrentBusinessId();
  const detail = getCustomerDetail(businessId, req.params.id);
  if (!detail) return res.status(404).json({ error: 'Customer not found.' });
  res.json(detail);
});

customersRouter.patch('/:id', (req, res) => {
  const businessId = getCurrentBusinessId();
  const existing = db.prepare('SELECT * FROM customers WHERE id = ? AND business_id = ?').get(req.params.id, businessId);
  if (!existing) return res.status(404).json({ error: 'Customer not found.' });
  const fieldMap = { name: 'name', email: 'email', notes: 'notes' };
  const updates = Object.entries(req.body).filter(([k]) => fieldMap[k]);
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update.' });
  const setClause = updates.map(([k]) => `${fieldMap[k]} = ?`).join(', ');
  const values = updates.map(([, v]) => v);
  db.prepare(`UPDATE customers SET ${setClause} WHERE id = ?`).run(...values, req.params.id);
  res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id));
});

// Permanently remove a customer and everything tied to them (appointments,
// automations, conversation + messages). Used to clean up test/QA contacts
// or a lead who asks to be forgotten — there's no undo.
customersRouter.delete('/:id', (req, res) => {
  const businessId = getCurrentBusinessId();
  const existing = db.prepare('SELECT * FROM customers WHERE id = ? AND business_id = ?').get(req.params.id, businessId);
  if (!existing) return res.status(404).json({ error: 'Customer not found.' });

  const remove = db.transaction((id) => {
    db.prepare('DELETE FROM messages WHERE customer_id = ? AND business_id = ?').run(id, businessId);
    db.prepare('DELETE FROM conversations WHERE customer_id = ? AND business_id = ?').run(id, businessId);
    db.prepare('DELETE FROM automation_events WHERE customer_id = ? AND business_id = ?').run(id, businessId);
    db.prepare('DELETE FROM appointments WHERE customer_id = ? AND business_id = ?').run(id, businessId);
    db.prepare('DELETE FROM customers WHERE id = ? AND business_id = ?').run(id, businessId);
  });
  remove(req.params.id);
  res.status(204).end();
});
