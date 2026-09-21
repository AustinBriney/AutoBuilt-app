// Mock Twilio adapter.
//
// This is the ONLY place that should ever know how an SMS actually gets sent.
// Every other module calls `sendSms()` and doesn't care whether it's hitting
// the real Twilio REST API or (as today) just writing to the local DB.
//
// To go live: swap the body of sendSms() for a real `twilio-node` client
// call, and point a real Twilio phone number's webhook at
// POST /api/public/inbound-sms (see routes/public.js) instead of whatever
// calls that route today.

const isLive = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

export async function sendSms({ to, body }) {
  if (isLive) {
    // TODO: real Twilio call, e.g.
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // return client.messages.create({ to, from: process.env.TWILIO_FROM_NUMBER, body });
    throw new Error('Live Twilio credentials found but real send path is not implemented yet.');
  }
  // Mock mode: pretend it sent. Caller is responsible for logging the
  // outbound message row; we just simulate network + carrier latency.
  console.log(`[mock-twilio] SMS -> ${to}: ${body}`);
  return { sid: `MOCK${Math.random().toString(36).slice(2, 12)}`, status: 'sent' };
}

export function isLiveMode() {
  return isLive;
}
