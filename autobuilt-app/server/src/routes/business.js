import { Router } from 'express';
import db from '../db/index.js';
import { getSubscriptionStatus } from '../integrations/stripe.js';
import { isLiveMode } from '../integrations/twilio.js';

export const businessRouter = Router();

function currentBusiness() {
  // Single-tenant for now: the mock client is the only row.
  return db.prepare('SELECT * FROM businesses LIMIT 1').get();
}

businessRouter.get('/', (req, res) => {
  const biz = currentBusiness();
  if (!biz) return res.status(404).json({ error: 'No business found. Run the seed script.' });
  res.json(biz);
});

businessRouter.patch('/', (req, res) => {
  const biz = currentBusiness();
  const allowed = [
    'name', 'owner_name', 'phone', 'email', 'timezone', 'address', 'booking_url', 'theme',
    'automations_missed_call', 'automations_reminder', 'automations_review', 'automations_winback',
    'winback_days', 'reminder_hours_before', 'review_delay_hours',
  ];
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update.' });

  const setClause = updates.map(([k]) => `${k} = ?`).join(', ');
  const values = updates.map(([, v]) => v);
  db.prepare(`UPDATE businesses SET ${setClause} WHERE id = ?`).run(...values, biz.id);
  res.json(db.prepare('SELECT * FROM businesses WHERE id = ?').get(biz.id));
});

businessRouter.get('/integrations', async (req, res) => {
  const biz = currentBusiness();
  const stripe = await getSubscriptionStatus(biz.id);
  res.json({
    calcom: { connected: false, note: 'Using mock booking intake for the pilot client.' },
    twilio: { connected: isLiveMode(), note: isLiveMode() ? 'Live SMS sending.' : 'Mock mode: messages are simulated.' },
    stripe,
  });
});

export function getCurrentBusinessId() {
  return currentBusiness()?.id;
}
