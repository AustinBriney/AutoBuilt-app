import { randomUUID } from 'node:crypto';
import db from '../db/index.js';
import { sendSms } from '../integrations/twilio.js';

function getOrCreateConversation(businessId, customerId) {
  const existing = db
    .prepare('SELECT * FROM conversations WHERE business_id = ? AND customer_id = ?')
    .get(businessId, customerId);
  if (existing) return existing;
  const id = randomUUID();
  db.prepare('INSERT INTO conversations (id, business_id, customer_id) VALUES (?, ?, ?)').run(
    id,
    businessId,
    customerId
  );
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
}

// Records + actually sends an outbound message (human reply or automation).
export async function sendOutboundMessage({ businessId, customerId, body, automationType = null }) {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  const conversation = getOrCreateConversation(businessId, customerId);

  await sendSms({ to: customer.phone, body });

  const id = randomUUID();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, business_id, customer_id, direction, body, automation_type, status)
     VALUES (?, ?, ?, ?, 'outbound', ?, ?, 'sent')`
  ).run(id, conversation.id, businessId, customerId, body, automationType);

  db.prepare('UPDATE conversations SET last_message_at = datetime(\'now\') WHERE id = ?').run(conversation.id);

  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
}

// Records an inbound message (customer texted in). Marks the thread unread
// for the owner's Inbox badge.
export function recordInboundMessage({ businessId, customerId, body }) {
  const conversation = getOrCreateConversation(businessId, customerId);
  const id = randomUUID();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, business_id, customer_id, direction, body, status)
     VALUES (?, ?, ?, ?, 'inbound', ?, 'delivered')`
  ).run(id, conversation.id, businessId, customerId, body);

  db.prepare(
    'UPDATE conversations SET last_message_at = datetime(\'now\'), unread = 1 WHERE id = ?'
  ).run(conversation.id);

  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
}
