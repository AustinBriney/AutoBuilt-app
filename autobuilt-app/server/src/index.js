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
import { requireAuth } from './middleware/requireAuth.js';
import { runAutomationTick } from './lib/automations.js';
import './db/index.js'; // ensures schema is applied on boot

const app = express();
app.use(cors());
// Keep the raw bytes around alongside the parsed body — Cal.com's webhook
// signature is an HMAC over the exact raw JSON, not the reserialized object.
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

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

app.use((err, req, res, _next) => {
  console.error(err);
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
