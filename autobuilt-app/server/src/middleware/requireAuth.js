import { verifyToken } from '../lib/auth.js';
import { businessContext } from '../lib/requestContext.js';

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
