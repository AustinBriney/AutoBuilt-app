import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import db, { PERSISTENT_DIR } from '../db/index.js';
import { getSubscriptionStatus } from '../integrations/stripe.js';
import { isLiveMode } from '../integrations/twilio.js';
import { getCurrentBusinessId } from '../lib/requestContext.js';

export const businessRouter = Router();

// Logos live in a `logos/` subfolder of the SAME persistent directory the
// SQLite file lives on, so they survive redeploys exactly like the DB does.
const LOGOS_DIR = path.join(PERSISTENT_DIR, 'logos');

const LOGO_MIME_TO_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

businessRouter.get('/', (req, res) => {
  const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(getCurrentBusinessId());
  if (!biz) return res.status(404).json({ error: 'Business not found.' });
  res.json(biz);
});

businessRouter.patch('/', (req, res) => {
  const businessId = getCurrentBusinessId();
  const allowed = [
    'name', 'owner_name', 'phone', 'email', 'timezone', 'address', 'booking_url', 'theme', 'onboarded',
    'automations_missed_call', 'automations_reminder', 'automations_review', 'automations_winback',
    'winback_days', 'reminder_hours_before', 'review_delay_hours',
  ];
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update.' });

  const setClause = updates.map(([k]) => `${k} = ?`).join(', ');
  const values = updates.map(([, v]) => v);
  db.prepare(`UPDATE businesses SET ${setClause} WHERE id = ?`).run(...values, businessId);
  res.json(db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId));
});

// Accepts a data URI (simplest for a plain <input type="file"> + FileReader
// flow in the browser — avoids needing multer/multipart parsing). Writes the
// decoded image to the persistent disk under logos/<businessId>.<ext> and
// points businesses.logo_url at a servable, cache-busted URL.
businessRouter.post('/logo', (req, res) => {
  const businessId = getCurrentBusinessId();
  const { dataUrl } = req.body || {};
  if (typeof dataUrl !== 'string') return res.status(400).json({ error: 'dataUrl is required.' });

  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return res.status(400).json({ error: 'dataUrl must be a base64 data URI.' });

  const [, mimeType, base64Payload] = match;
  const ext = LOGO_MIME_TO_EXT[mimeType.toLowerCase()];
  if (!ext) return res.status(400).json({ error: 'Unsupported image type. Use PNG, JPEG, WEBP, or GIF.' });

  let buffer;
  try {
    buffer = Buffer.from(base64Payload, 'base64');
  } catch {
    return res.status(400).json({ error: 'Could not decode image data.' });
  }
  if (!buffer.length) return res.status(400).json({ error: 'Image data is empty.' });

  fs.mkdirSync(LOGOS_DIR, { recursive: true });
  const filePath = path.join(LOGOS_DIR, `${businessId}.${ext}`);
  fs.writeFileSync(filePath, buffer);

  const logoUrl = `/uploads/logos/${businessId}.${ext}?v=${Date.now()}`;
  db.prepare('UPDATE businesses SET logo_url = ? WHERE id = ?').run(logoUrl, businessId);
  res.json(db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId));
});

businessRouter.get('/integrations', async (req, res) => {
  const businessId = getCurrentBusinessId();
  const stripe = await getSubscriptionStatus(businessId);
  const business = db.prepare('SELECT calcom_webhook_secret FROM businesses WHERE id = ?').get(businessId);
  res.json({
    calcom: {
      connected: !!business?.calcom_webhook_secret,
      note: business?.calcom_webhook_secret
        ? 'Real webhook ready — see Settings for the URL and secret to paste into Cal.com.'
        : 'Using mock booking intake for the pilot client.',
    },
    twilio: { connected: isLiveMode(), note: isLiveMode() ? 'Live SMS sending.' : 'Mock mode: messages are simulated.' },
    stripe,
  });
});

// Everything Settings needs to wire a real Cal.com account to this business:
// the webhook URL to paste into Cal.com's "Webhooks" screen, and the secret
// that goes in that same form so we can verify requests really came from
// Cal.com. Cal.com signs with whatever secret you type in there, so this
// isn't a fetch of anything from Cal.com — it's just handing back what we
// already generated for this business at signup.
businessRouter.get('/calcom-webhook-info', (req, res) => {
  const businessId = getCurrentBusinessId();
  const business = db.prepare('SELECT slug, calcom_webhook_secret FROM businesses WHERE id = ?').get(businessId);
  if (!business) return res.status(404).json({ error: 'Business not found.' });
  const apiBase = process.env.AUTOBUILT_PUBLIC_API_URL || 'https://autobuilt-api.onrender.com';
  res.json({
    webhookUrl: `${apiBase}/api/public/${business.slug}/calcom-webhook`,
    secret: business.calcom_webhook_secret,
  });
});

// Lets a service be linked to a specific Cal.com event type, so a booking
// on that event type maps to this exact service instead of an unlinked one.
businessRouter.patch('/calcom-webhook-info/link-service', (req, res) => {
  const businessId = getCurrentBusinessId();
  const { serviceId, calcomEventTypeId } = req.body;
  if (!serviceId) return res.status(400).json({ error: 'serviceId is required.' });
  const service = db.prepare('SELECT id FROM services WHERE id = ? AND business_id = ?').get(serviceId, businessId);
  if (!service) return res.status(404).json({ error: 'Service not found.' });
  db.prepare('UPDATE services SET calcom_event_type_id = ? WHERE id = ?').run(calcomEventTypeId ? String(calcomEventTypeId) : null, serviceId);
  res.json(db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId));
});
