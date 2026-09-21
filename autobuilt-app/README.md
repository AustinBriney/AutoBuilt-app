# AutoBuilt — client dashboard (v0 foundation)

A real, running foundation for the AutoBuilt client app — not a mockup.
One mock business ("Fade District Barbershop") is seeded so the whole
17-step flow (booking → reminder → inbox → reply → completion → review →
win-back) can be tested today, before Cal.com/Twilio/Stripe are wired in
for real.

## Run it

Two processes, two terminals:

```bash
# 1. API + automation engine (SQLite-backed)
cd server
npm install        # first time only
npm run seed       # (re)creates the mock business — wipes existing data
npm start          # http://localhost:4000

# 2. The app itself
cd web
npm install         # first time only
npm run dev          # http://localhost:5173
```

Open `http://localhost:5173` on your phone (same network) or in a mobile
device-emulated browser tab. It's a PWA — "Add to Home Screen" installs it
like a real app.

## What's real vs. mocked right now

| Piece | Status |
|---|---|
| App UI (Dashboard/Inbox/Schedule/Customers/Settings) | Real, fully working against the API |
| Database (SQLite) | Real — services, availability, customers, appointments, messages, automation log all persist |
| Automation engine (missed-call, reminders, reviews, win-back) | Real logic, real scheduling, real SMS *content* — but the "send" is mocked (logged, not actually delivered) |
| Cal.com | Mocked. `server/src/integrations/calcom.js` has one function, `handleExternalBooking()`, that a real Cal.com webhook would call instead of our test tools calling it directly. |
| Twilio | Mocked. `server/src/integrations/twilio.js`'s `sendSms()` is the only place that would change — swap in a real Twilio client call. Inbound texts would hit `POST /api/public/inbound-sms` from Twilio's webhook instead of the Settings "test tools" panel. |
| Stripe | Mocked read-only status in Settings. AutoBuilt's own billing (what the owner pays) already works via the live payment links — this is just about showing that status *inside* the app later. |

## Testing the mock client end-to-end today

Settings → **Test tools** lets you simulate the three real-world triggers
without needing live Twilio/Cal.com yet:
- "Simulate a website booking" → creates/matches a customer, books an
  appointment, schedules a reminder (fires ~automatically at the reminder
  window, or immediately if the appointment is sooner than that window).
- "Simulate a missed call" → fires the missed-call text-back within ~10s.
- "Simulate an inbound text" → drops a message into the Inbox as if the
  customer's Twilio number texted in; reply from the Inbox to send back.

Mark an appointment `completed` (via `PATCH /api/appointments/:id`, or
just wait for its end time to pass — the engine sweeps for this every 10s)
to see the review-request automation fire, and a `completed` appointment
older than the win-back window (default 45 days, in Settings) makes that
customer win-back eligible on the next sweep.

## Architecture note

Every route in `server/src/routes/public.js` is written to be a drop-in
replacement target for a real webhook (Cal.com booking-created, Twilio
inbound-message) — same shape, just a different caller. Nothing in the
app's UI or the rest of the API needs to change when that swap happens.
