import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import db from '../db/index.js';
import { getCurrentBusinessId } from './business.js';

export const availabilityRouter = Router();

availabilityRouter.get('/', (req, res) => {
  const businessId = getCurrentBusinessId();
  const rules = db
    .prepare('SELECT * FROM availability_rules WHERE business_id = ? ORDER BY weekday')
    .all(businessId);
  const timeOff = db
    .prepare("SELECT * FROM time_off WHERE business_id = ? AND end_at >= datetime('now') ORDER BY start_at")
    .all(businessId);
  res.json({ rules, timeOff });
});

availabilityRouter.post('/rules', (req, res) => {
  const businessId = getCurrentBusinessId();
  const { weekday, startTime, endTime } = req.body;
  if (weekday == null || !startTime || !endTime) {
    return res.status(400).json({ error: 'weekday, startTime, endTime are required.' });
  }
  const id = randomUUID();
  db.prepare(
    'INSERT INTO availability_rules (id, business_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?, ?)'
  ).run(id, businessId, weekday, startTime, endTime);
  res.status(201).json(db.prepare('SELECT * FROM availability_rules WHERE id = ?').get(id));
});

availabilityRouter.patch('/rules/:id', (req, res) => {
  const businessId = getCurrentBusinessId();
  const existing = db.prepare('SELECT * FROM availability_rules WHERE id = ? AND business_id = ?').get(req.params.id, businessId);
  if (!existing) return res.status(404).json({ error: 'Hours entry not found.' });

  const fieldMap = { weekday: 'weekday', startTime: 'start_time', endTime: 'end_time' };
  const updates = Object.entries(req.body).filter(([k]) => fieldMap[k]);
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update.' });

  const setClause = updates.map(([k]) => `${fieldMap[k]} = ?`).join(', ');
  const values = updates.map(([, v]) => v);
  db.prepare(`UPDATE availability_rules SET ${setClause} WHERE id = ?`).run(...values, req.params.id);
  res.json(db.prepare('SELECT * FROM availability_rules WHERE id = ?').get(req.params.id));
});

availabilityRouter.delete('/rules/:id', (req, res) => {
  const businessId = getCurrentBusinessId();
  db.prepare('DELETE FROM availability_rules WHERE id = ? AND business_id = ?').run(req.params.id, businessId);
  res.status(204).end();
});

availabilityRouter.post('/time-off', (req, res) => {
  const businessId = getCurrentBusinessId();
  const { startAt, endAt, reason = '' } = req.body;
  if (!startAt || !endAt) return res.status(400).json({ error: 'startAt and endAt are required.' });
  const id = randomUUID();
  db.prepare('INSERT INTO time_off (id, business_id, start_at, end_at, reason) VALUES (?, ?, ?, ?, ?)').run(
    id, businessId, startAt, endAt, reason
  );
  res.status(201).json(db.prepare('SELECT * FROM time_off WHERE id = ?').get(id));
});

availabilityRouter.delete('/time-off/:id', (req, res) => {
  const businessId = getCurrentBusinessId();
  db.prepare('DELETE FROM time_off WHERE id = ? AND business_id = ?').run(req.params.id, businessId);
  res.status(204).end();
});
