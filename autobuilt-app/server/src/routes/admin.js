import { Router } from 'express';
import db from '../db/index.js';

// Austin's own internal ops tool: cross-tenant by design, so it deliberately
// bypasses the normal per-business AsyncLocalStorage scoping (see
// requestContext.js) that every other route relies on. Auth is the
// shared-secret `requireAdmin` middleware mounted alongside this router in
// index.js, not the business JWT flow.
export const adminRouter = Router();

adminRouter.get('/businesses', (req, res) => {
  const apiBase = process.env.AUTOBUILT_PUBLIC_API_URL || 'https://autobuilt-api.onrender.com';
  const businesses = db
    .prepare(
      `SELECT id, slug, name, owner_name, phone, email, plan, logo_url, booking_url,
              calcom_webhook_secret, created_at
       FROM businesses
       ORDER BY created_at DESC`
    )
    .all();

  res.json(
    businesses.map((b) => ({
      ...b,
      calcomWebhookUrl: `${apiBase}/api/public/${b.slug}/calcom-webhook`,
    }))
  );
});

adminRouter.patch('/businesses/:id', (req, res) => {
  const allowed = ['plan'];
  const updates = Object.entries(req.body || {}).filter(([k]) => allowed.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update.' });

  const business = db.prepare('SELECT id FROM businesses WHERE id = ?').get(req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found.' });

  const setClause = updates.map(([k]) => `${k} = ?`).join(', ');
  const values = updates.map(([, v]) => v);
  db.prepare(`UPDATE businesses SET ${setClause} WHERE id = ?`).run(...values, req.params.id);
  res.json(db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id));
});
