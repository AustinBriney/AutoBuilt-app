import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import db from '../db/index.js';
import { getCurrentBusinessId } from './business.js';

export const servicesRouter = Router();

servicesRouter.get('/', (req, res) => {
  const businessId = getCurrentBusinessId();
  const services = db
    .prepare('SELECT * FROM services WHERE business_id = ? ORDER BY sort_order, created_at')
    .all(businessId);
  res.json(services);
});

servicesRouter.post('/', (req, res) => {
  const businessId = getCurrentBusinessId();
  const { name, description = '', priceCents, durationMin } = req.body;
  if (!name || priceCents == null || !durationMin) {
    return res.status(400).json({ error: 'name, priceCents, and durationMin are required.' });
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO services (id, business_id, name, description, price_cents, duration_min)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, businessId, name, description, priceCents, durationMin);
  res.status(201).json(db.prepare('SELECT * FROM services WHERE id = ?').get(id));
});

servicesRouter.patch('/:id', (req, res) => {
  const businessId = getCurrentBusinessId();
  const existing = db.prepare('SELECT * FROM services WHERE id = ? AND business_id = ?').get(req.params.id, businessId);
  if (!existing) return res.status(404).json({ error: 'Service not found.' });

  const fieldMap = { name: 'name', description: 'description', priceCents: 'price_cents', durationMin: 'duration_min', active: 'active' };
  const updates = Object.entries(req.body).filter(([k]) => fieldMap[k]);
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update.' });

  const setClause = updates.map(([k]) => `${fieldMap[k]} = ?`).join(', ');
  const values = updates.map(([, v]) => v);
  db.prepare(`UPDATE services SET ${setClause} WHERE id = ?`).run(...values, req.params.id);
  res.json(db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id));
});

servicesRouter.delete('/:id', (req, res) => {
  const businessId = getCurrentBusinessId();
  db.prepare('DELETE FROM services WHERE id = ? AND business_id = ?').run(req.params.id, businessId);
  res.status(204).end();
});
