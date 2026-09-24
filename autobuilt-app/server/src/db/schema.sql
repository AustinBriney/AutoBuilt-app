-- AutoBuilt core schema.
-- Single-tenant for now (one row in `businesses`), but every table carries
-- business_id so this can become multi-tenant later without a rewrite.

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  name TEXT NOT NULL,
  owner_name TEXT,
  phone TEXT,
  email TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  address TEXT,
  booking_url TEXT,
  theme TEXT NOT NULL DEFAULT 'system', -- 'light' | 'dark' | 'system'
  onboarded INTEGER NOT NULL DEFAULT 0, -- 0 until the owner finishes first-run setup
  automations_missed_call INTEGER NOT NULL DEFAULT 1,
  automations_reminder INTEGER NOT NULL DEFAULT 1,
  automations_review INTEGER NOT NULL DEFAULT 1,
  automations_winback INTEGER NOT NULL DEFAULT 1,
  winback_days INTEGER NOT NULL DEFAULT 45,
  reminder_hours_before INTEGER NOT NULL DEFAULT 24,
  review_delay_hours INTEGER NOT NULL DEFAULT 2,
  calcom_webhook_secret TEXT, -- verifies X-Cal-Signature-256 on inbound Cal.com webhooks
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One login per business owner. Multi-tenant: every other table already
-- carries business_id, this is what actually separates one client's data
-- from another's at the door instead of trusting a single-row assumption.
CREATE TABLE IF NOT EXISTS auth_accounts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  duration_min INTEGER NOT NULL DEFAULT 30,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  calcom_event_type_id TEXT, -- links this service to a Cal.com event type, for webhook -> service mapping
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Recurring weekly availability. weekday: 0=Sun..6=Sat
CREATE TABLE IF NOT EXISTS availability_rules (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  weekday INTEGER NOT NULL,
  start_time TEXT NOT NULL, -- 'HH:MM'
  end_time TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One-off closures / time off that overrides the recurring rules.
CREATE TABLE IF NOT EXISTS time_off (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(business_id, phone)
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  service_id TEXT REFERENCES services(id),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked', -- booked | confirmed | completed | cancelled | no_show
  source TEXT NOT NULL DEFAULT 'manual', -- website | manual | cal.com
  external_ref TEXT, -- Cal.com booking `uid` — lets webhook retries/cancels/reschedules find this row again
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  last_message_at TEXT NOT NULL DEFAULT (datetime('now')),
  unread INTEGER NOT NULL DEFAULT 0,
  UNIQUE(business_id, customer_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  business_id TEXT NOT NULL REFERENCES businesses(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  direction TEXT NOT NULL, -- inbound | outbound
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sms',
  status TEXT NOT NULL DEFAULT 'sent', -- queued | sent | delivered | failed
  automation_type TEXT, -- null if a human sent/received it
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automation_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  appointment_id TEXT REFERENCES appointments(id),
  type TEXT NOT NULL, -- missed_call | reminder | review_request | winback
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | sent | skipped | cancelled
  scheduled_for TEXT NOT NULL,
  sent_at TEXT,
  meta TEXT, -- JSON blob
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_appts_business ON appointments(business_id, start_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_appts_external_ref ON appointments(business_id, external_ref) WHERE external_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_autoevents_due ON automation_events(status, scheduled_for);
