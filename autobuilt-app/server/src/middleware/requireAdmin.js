// Austin's own internal admin dashboard has no user-login system of its
// own — this is a simple shared-secret scheme, not per-admin auth. Same
// fallback-default style as DEMO_CALCOM_SECRET in db/seed.js: use the env
// var in production, fall back to a hardcoded dev default so this works
// out of the box locally.
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'autobuilt-admin-2026';

export function requireAdmin(req, res, next) {
  const provided = req.headers['x-admin-secret'];
  if (!provided || provided !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Missing or invalid admin secret.' });
  }
  next();
}
