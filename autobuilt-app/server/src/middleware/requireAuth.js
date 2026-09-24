import { verifyToken } from '../lib/auth.js';
import { businessContext } from '../lib/requestContext.js';

// Protects every real app route. Expects `Authorization: Bearer <token>`.
// On success, runs the rest of the request inside businessContext so every
// downstream query is automatically scoped to the caller's own business —
// no route handler has to remember to check it.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in.' });

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }

  req.businessId = payload.businessId;
  req.accountId = payload.accountId;
  businessContext.run(payload.businessId, () => next());
}
