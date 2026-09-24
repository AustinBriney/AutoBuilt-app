import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// In production (Render) set AUTOBUILT_JWT_SECRET to a long random value.
// The fallback is fine for local dev only — never rely on it in deploy.
const JWT_SECRET = process.env.AUTOBUILT_JWT_SECRET || 'dev-only-secret-change-me';
const TOKEN_TTL = '30d';

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken({ accountId, businessId }) {
  return jwt.sign({ accountId, businessId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
