import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { businessRouter } from './routes/business.js';
import { servicesRouter } from './routes/services.js';
import { availabilityRouter } from './routes/availability.js';
import { customersRouter } from './routes/customers.js';
import { appointmentsRouter } from './routes/appointments.js';
import { conversationsRouter } from './routes/conversations.js';
import { publicRouter } from './routes/public.js';
import { dashboardRouter } from './routes/dashboard.js';
import { adminRouter } from './routes/admin.js';
import { requireAuth } from './middleware/requireAuth.js';
import { requireAdmin } from './middleware/requireAdmin.js';
import { runAutomationTick } from './lib/automations.js';
import { PERSISTENT_DIR } from './db/index.js'; // ensures schema is applied on boot
import { seedIfEmpty } from './db/seed.js';
import path from 'node:path';

// Render's build command and pre-deploy command both run on separate,
// ephemeral compute with NO access to the persistent disk — only the
// actual running instance (this process) has it mounted. So seeding has to
// happen here, at boot, against the real (disk-backed) database that
// './db/index.js' just opened above — not in a build/pre-deploy step,
// where it would silently write to a throwaway filesystem every single
// deploy. seedIfEmpty() only ever creates data on a genuinely empty
// database, so this is safe to run on every boot, including against a real
// client's live data.
await seedIfEmpty();

const app = express();
app.use(cors());
// Keep the raw bytes around alongside the parsed body — Cal.com's webhook
// signature is an HMAC over the exact raw JSON, not the reserialized object.
//
// The 6mb limit is for logo uploads, which arrive as a base64 data URI in
// the JSON body. Express defaults to 100kb, which silently rejected any
// real logo or phone photo before it ever reached the route. The web app
// now shrinks images before sending, so this is only a safety net for an
// unusually large file or a request that didn't come from the app.
app.use(express.json({ limit: '6mb', verify: (req, res, buf) => { req.rawBody = buf; } }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Serves uploaded business logos straight off the same persistent disk the
// SQLite file lives on (see server/src/db/index.js).
//
// Mounted TWICE, on purpose. The web app is a Render static site on a
// different domain than this API, and it reaches the API through a single
// rewrite rule: /api/* -> autobuilt-api.onrender.com/api/*. Nothing else is
// rewritten. So a logo_url of /uploads/logos/x.png resolves against the
// STATIC site, which has no such file, and the client's logo silently 404s
// even though the file is sitting right here.
//
// Putting the same directory under /api/uploads/logos means logo_url can be
// a path that the already-working rewrite carries, with no extra Render
// configuration to set up or forget. /uploads/logos stays mounted so that
// URLs written by earlier versions (and direct API-domain links) keep
// working; db/index.js rewrites those rows on boot.
const logosStatic = express.static(path.join(PERSISTENT_DIR, 'logos'));
app.use('/api/uploads/logos', logosStatic);
app.use('/uploads/logos', logosStatic);

// Signup/login issue the token; everything else below requires one.
// /api/public/:slug/* is the exception — that's the customer-facing side
// (booking pages, SMS/call webhooks), which has no AutoBuilt login of its
// own and is scoped by business slug instead of a token.
app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);

app.use('/api/business', requireAuth, businessRouter);
app.use('/api/services', requireAuth, servicesRouter);
app.use('/api/availability', requireAuth, availabilityRouter);
app.use('/api/customers', requireAuth, customersRouter);
app.use('/api/appointments', requireAuth, appointmentsRouter);
app.use('/api/conversations', requireAuth, conversationsRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);

// Austin's own internal admin dashboard — its own shared-secret auth
// scheme entirely separate from the business JWT flow above.
app.use('/api/admin', requireAdmin, adminRouter);

app.use((err, req, res, _next) => {
  console.error(err);
  // An oversized body is the caller's problem, not a server fault — say so,
  // otherwise it surfaces as a bewildering "Something went wrong" (which is
  // exactly how the old 100kb logo-upload limit presented itself).
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return res.status(413).json({ error: 'That file is too large. Please choose a smaller image.' });
  }
  res.status(500).json({ error: 'Something went wrong.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`AutoBuilt API listening on :${PORT}`);
});

// The automation "engine": in production each trigger (Cal.com webhook,
// Twilio inbound webhook, appointment end time) would fire these functions
// directly. This tick loop is the mock-mode stand-in that also does the
// job a real task queue would do: catching scheduled sends (reminders,
// review requests, win-backs) as they come due.
const TICK_MS = 10_000;
setInterval(() => {
  runAutomationTick().catch((err) => console.error('[automation tick]', err));
}, TICK_MS);
runAutomationTick().catch((err) => console.error('[automation tick]', err));
