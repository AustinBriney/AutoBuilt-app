import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import db, { PERSISTENT_DIR } from '../db/index.js';

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
  // Austin sets up and manages everything for a client from here, so the client
  // never has to: plan, and the business details their website/app read live.
  const allowed = ['plan', 'booking_url', 'name', 'owner_name', 'phone', 'address'];
  const updates = Object.entries(req.body || {}).filter(([k]) => allowed.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update.' });

  const business = db.prepare('SELECT id FROM businesses WHERE id = ?').get(req.params.id);
  if (!business) return res.status(404).json({ error: 'Business not found.' });

  const setClause = updates.map(([k]) => `${k} = ?`).join(', ');
  const values = updates.map(([, v]) => v);
  db.prepare(`UPDATE businesses SET ${setClause} WHERE id = ?`).run(...values, req.params.id);
  res.json(db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id));
});

// Removes a business and everything belonging to it. Without this there was
// no way to get rid of an account at all: every practice run before a
// closing, every abandoned signup, and every typo'd business name stayed in
// this dashboard permanently, which gets ugly fast once real clients are
// mixed in among them.
//
// Deliberately requires the caller to pass the business's exact name as
// `confirmName`. This endpoint destroys a client's entire account, and it
// sits behind a single shared secret — a mistyped id should not be able to
// wipe a paying client's data.
adminRouter.delete('/businesses/:id', (req, res) => {
  const { id } = req.params;
  const business = db.prepare('SELECT id, name FROM businesses WHERE id = ?').get(id);
  if (!business) return res.status(404).json({ error: 'Business not found.' });

  const { confirmName } = req.body || {};
  if (confirmName !== business.name) {
    return res.status(400).json({
      error: `To delete this business, pass confirmName exactly matching "${business.name}".`,
    });
  }

  // Children first — messages/automation_events reference conversations and
  // appointments, so deleting businesses first would trip foreign keys
  // (PRAGMA foreign_keys is ON, see db/index.js).
  const purge = db.transaction(() => {
    db.prepare('DELETE FROM messages WHERE business_id = ?').run(id);
    db.prepare('DELETE FROM automation_events WHERE business_id = ?').run(id);
    db.prepare('DELETE FROM conversations WHERE business_id = ?').run(id);
    db.prepare('DELETE FROM appointments WHERE business_id = ?').run(id);
    db.prepare('DELETE FROM customers WHERE business_id = ?').run(id);
    db.prepare('DELETE FROM time_off WHERE business_id = ?').run(id);
    db.prepare('DELETE FROM availability_rules WHERE business_id = ?').run(id);
    db.prepare('DELETE FROM services WHERE business_id = ?').run(id);
    db.prepare('DELETE FROM auth_accounts WHERE business_id = ?').run(id);
    db.prepare('DELETE FROM businesses WHERE id = ?').run(id);
  });
  purge();

  // Best-effort: drop any uploaded logo too, so the disk doesn't accumulate
  // files for accounts that no longer exist. A failure here shouldn't fail
  // the delete — the account is already gone.
  try {
    const logosDir = path.join(PERSISTENT_DIR, 'logos');
    for (const entry of fs.readdirSync(logosDir)) {
      if (entry.startsWith(`${id}.`)) fs.unlinkSync(path.join(logosDir, entry));
    }
  } catch {
    // no logos dir yet, or nothing to remove
  }

  res.status(204).end();
});
