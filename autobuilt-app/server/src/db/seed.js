import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dayjs from 'dayjs';
import db from './index.js';
import { hashPassword } from '../lib/auth.js';
import { scheduleReminder } from '../lib/automations.js';
import { recordInboundMessage } from '../lib/messaging.js';

// Exported so the server can call this on every boot (see src/index.js) —
// that's the ONLY place on Render that actually has the persistent disk
// mounted. Render's build command and pre-deploy command both run on
// separate, ephemeral compute with no access to the disk at all, so seeding
// from either of those silently writes to a throwaway filesystem that gets
// discarded the moment the real (disk-backed) instance starts. Calling this
// from index.js, after `import './db/index.js'` has opened the real,
// disk-backed database file, is what makes seeding (and its "only seed if
// empty" safety check) actually mean something.
//
// This must be safe to call on every boot against a database that already
// has real client data in it. If ANY business already exists, do nothing —
// seeding only ever creates the one demo business on a genuinely empty
// database.
export async function seedIfEmpty() {
  const existingCount = db.prepare('SELECT COUNT(*) as n FROM businesses').get().n;
  if (existingCount > 0) {
    console.log(`Seed skipped — ${existingCount} business(es) already exist. Data is safe.`);
    return;
  }

  const businessId = randomUUID();
  const DEMO_SLUG = 'fade-district-demo';
  const DEMO_EMAIL = 'demo@fadedistrict.example';
  const DEMO_PASSWORD = 'FadeDistrict2026!';
  // Fixed (not random) so it can be pasted into a Cal.com webhook's "Secret"
  // field ahead of time, before this code is even deployed — a real client's
  // signup-created secret is random (see routes/auth.js); this one only ever
  // backs the demo business.
  const DEMO_CALCOM_SECRET = process.env.AUTOBUILT_DEMO_CALCOM_SECRET || 'fade-district-demo-secret-2026';

  db.prepare(
    `INSERT INTO businesses (id, slug, name, owner_name, phone, email, address, booking_url, onboarded, calcom_webhook_secret)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    businessId,
    DEMO_SLUG,
    'Fade District Barbershop',
    'Marcus Reed',
    '+12255550142',
    'marcus@fadedistrict.example',
    '4400 Government St, Baton Rouge, LA',
    'https://autobuiltsystems.com/book/fade-district',
    DEMO_CALCOM_SECRET
  );

  const accountId = randomUUID();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  db.prepare('INSERT INTO auth_accounts (id, business_id, email, password_hash) VALUES (?, ?, ?, ?)').run(
    accountId, businessId, DEMO_EMAIL, passwordHash
  );

  // One service, linked to the "Signature Fade" event type on Austin's own
  // Cal.com account (app.cal.com) so a real booking there maps back to this
  // exact service instead of creating an unlinked appointment.
  const serviceId = randomUUID();
  // Real event type ID for "Signature Fade" (45m) on Austin's own Cal.com
  // account (app.cal.com/event-types/7202246), created and wired up with a
  // matching webhook (-> /api/public/fade-district-demo/calcom-webhook,
  // secret DEMO_CALCOM_SECRET above) for end-to-end testing.
  const DEMO_CALCOM_EVENT_TYPE_ID = process.env.AUTOBUILT_DEMO_CALCOM_EVENT_TYPE_ID || '7202246';
  db.prepare(
    'INSERT INTO services (id, business_id, name, description, price_cents, duration_min, calcom_event_type_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(serviceId, businessId, 'Signature Fade', 'Classic tapered fade, straight razor line-up.', 4000, 45, DEMO_CALCOM_EVENT_TYPE_ID);

  // One weekly-hours entry (Monday 9:00 AM – 5:00 PM) as the example
  db.prepare(
    'INSERT INTO availability_rules (id, business_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?, ?)'
  ).run(randomUUID(), businessId, 1, '09:00', '17:00');

  // One customer
  const customerId = randomUUID();
  db.prepare('INSERT INTO customers (id, business_id, name, phone, email) VALUES (?, ?, ?, ?, ?)').run(
    customerId, businessId, 'Dorian Lewis', '+12255550101', 'dorian@example.com'
  );

  // One upcoming appointment (today, a couple hours out) so the Dashboard has
  // something to show; scheduling the reminder demonstrates the automation engine.
  const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
  const startAt = dayjs().add(2, 'hour').minute(0).second(0).millisecond(0).toISOString();
  const endAt = dayjs(startAt).add(svc.duration_min, 'minute').toISOString();
  const appointmentId = randomUUID();
  db.prepare(
    `INSERT INTO appointments (id, business_id, customer_id, service_id, start_at, end_at, status, source)
     VALUES (?, ?, ?, ?, ?, ?, 'booked', 'website')`
  ).run(appointmentId, businessId, customerId, serviceId, startAt, endAt);
  scheduleReminder({ businessId, customerId, appointmentId, appointmentStartAt: startAt });

  // One inbox message: an inbound question from the same customer, unanswered.
  recordInboundMessage({ businessId, customerId, body: 'Hey, do you have any openings this week?' });

  console.log('Seed complete (first run — database was empty).');
  console.log('Demo business:', businessId, `(slug: ${DEMO_SLUG})`);
  console.log('Demo login ->', DEMO_EMAIL, '/', DEMO_PASSWORD);
}

// Still runnable directly (`npm run seed`, or manually) for local dev
// against the ephemeral/local DB path. Skipped when this module is only
// imported (e.g. by src/index.js on server boot).
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  await seedIfEmpty();
  process.exit(0);
}
