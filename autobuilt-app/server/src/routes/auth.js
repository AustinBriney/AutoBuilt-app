import { Router } from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import db from '../db/index.js';
import { hashPassword, verifyPassword, signToken } from '../lib/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const authRouter = Router();

function slugify(name) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'business';
  let slug = base;
  let n = 1;
  // Guarantee uniqueness even if two clients pick very similar names.
  while (db.prepare('SELECT 1 FROM businesses WHERE slug = ?').get(slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

// A brand-new client, straight from the app's "Create account" screen.
// Creates the business row (unonboarded — Settings/Onboarding fills the
// rest) and its one owner login in a single step, then signs them in.
authRouter.post('/signup', async (req, res) => {
  const { businessName, email, password } = req.body;
  if (!businessName || !email || !password) {
    return res.status(400).json({ error: 'Business name, email, and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = db.prepare('SELECT 1 FROM auth_accounts WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const businessId = randomUUID();
  const slug = slugify(businessName);
  const accountId = randomUUID();
  const passwordHash = await hashPassword(password);
  // Every business gets its own random Cal.com webhook secret at creation,
  // so Settings can show it immediately — no separate "generate" step.
  const calcomWebhookSecret = randomBytes(24).toString('hex');

  const create = db.transaction(() => {
    db.prepare('INSERT INTO businesses (id, slug, name, calcom_webhook_secret) VALUES (?, ?, ?, ?)').run(
      businessId, slug, businessName.trim(), calcomWebhookSecret
    );
    db.prepare('INSERT INTO auth_accounts (id, business_id, email, password_hash) VALUES (?, ?, ?, ?)').run(
      accountId, businessId, normalizedEmail, passwordHash
    );
  });
  create();

  const token = signToken({ accountId, businessId });
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  res.status(201).json({ token, business });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const normalizedEmail = String(email).trim().toLowerCase();
  const account = db.prepare('SELECT * FROM auth_accounts WHERE email = ?').get(normalizedEmail);
  if (!account) return res.status(401).json({ error: 'Incorrect email or password.' });

  const ok = await verifyPassword(password, account.password_hash);
  if (!ok) return res.status(401).json({ error: 'Incorrect email or password.' });

  const token = signToken({ accountId: account.id, businessId: account.business_id });
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(account.business_id);
  res.json({ token, business });
});

// Lets the app confirm a stored token is still good on launch, and re-fetch
// the business record without a separate round trip.
authRouter.get('/me', requireAuth, (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.businessId);
  if (!business) return res.status(404).json({ error: 'Business not found.' });
  res.json({ business });
});
