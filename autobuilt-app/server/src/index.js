import express from 'express';
import cors from 'cors';
import { businessRouter } from './routes/business.js';
import { servicesRouter } from './routes/services.js';
import { availabilityRouter } from './routes/availability.js';
import { customersRouter } from './routes/customers.js';
import { appointmentsRouter } from './routes/appointments.js';
import { conversationsRouter } from './routes/conversations.js';
import { publicRouter } from './routes/public.js';
import { dashboardRouter } from './routes/dashboard.js';
import { runAutomationTick } from './lib/automations.js';
import './db/index.js'; // ensures schema is applied on boot

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/business', businessRouter);
app.use('/api/services', servicesRouter);
app.use('/api/availability', availabilityRouter);
app.use('/api/customers', customersRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/public', publicRouter);
app.use('/api/dashboard', dashboardRouter);

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
