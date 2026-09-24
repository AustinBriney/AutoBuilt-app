import { Router } from 'express';
import db from '../db/index.js';
import { getCurrentBusinessId } from '../lib/requestContext.js';
import { sendOutboundMessage } from '../lib/messaging.js';

export const conversationsRouter = Router();

conversationsRouter.get('/', (req, res) => {
  const businessId = getCurrentBusinessId();
  const rows = db
    .prepare(
      `SELECT conv.*, c.name as customer_name, c.phone as customer_phone,
        (SELECT body FROM messages m WHERE m.conversation_id = conv.id ORDER BY m.created_at DESC LIMIT 1) as last_message
       FROM conversations conv
       JOIN customers c ON c.id = conv.customer_id
       WHERE conv.business_id = ?
       ORDER BY conv.last_message_at DESC`
    )
    .all(businessId);
  res.json(rows);
});

conversationsRouter.get('/:id/messages', (req, res) => {
  const businessId = getCurrentBusinessId();
  const conversation = db
    .prepare(
      `SELECT conv.*, c.name as customer_name, c.phone as customer_phone
       FROM conversations conv JOIN customers c ON c.id = conv.customer_id
       WHERE conv.id = ? AND conv.business_id = ?`
    )
    .get(req.params.id, businessId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });

  const messages = db
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(req.params.id);

  db.prepare('UPDATE conversations SET unread = 0 WHERE id = ?').run(req.params.id);

  res.json({ conversation, messages });
});

conversationsRouter.post('/:id/messages', async (req, res) => {
  const businessId = getCurrentBusinessId();
  const conversation = db
    .prepare('SELECT * FROM conversations WHERE id = ? AND business_id = ?')
    .get(req.params.id, businessId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });

  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required.' });

  const message = await sendOutboundMessage({ businessId, customerId: conversation.customer_id, body });
  res.status(201).json(message);
});
