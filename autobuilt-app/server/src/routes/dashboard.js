import { Router } from 'express';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import db from '../db/index.js';
import { getCurrentBusinessId } from '../lib/requestContext.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export const dashboardRouter = Router();

dashboardRouter.get('/summary', (req, res) => {
  const businessId = getCurrentBusinessId();
  const biz = db.prepare('SELECT timezone FROM businesses WHERE id = ?').get(businessId);
  const tz = biz?.timezone || 'America/Chicago';

  // "Today" is the business's local day, not the server's UTC day. Compute the
  // day's UTC bounds so an appointment a couple hours out never slips into
  // "tomorrow" just because the server clock runs in UTC.
  const dayStart = dayjs().tz(tz).startOf('day').utc().toISOString();
  const dayEnd = dayjs().tz(tz).endOf('day').utc().toISOString();

  const today = db
    .prepare(
      `SELECT a.*, c.name as customer_name, s.name as service_name
       FROM appointments a JOIN customers c ON c.id = a.customer_id
       LEFT JOIN services s ON s.id = a.service_id
       WHERE a.business_id = ? AND a.start_at >= ? AND a.start_at <= ?
         AND a.status NOT IN ('cancelled')
       ORDER BY a.start_at`
    )
    .all(businessId, dayStart, dayEnd);

  const unreadCount = db
    .prepare("SELECT COUNT(*) as n FROM conversations WHERE business_id = ? AND unread = 1")
    .get(businessId).n;

  const weekAppointments = db
    .prepare(
      `SELECT COUNT(*) as n FROM appointments WHERE business_id = ? AND start_at >= datetime('now','-7 days')`
    )
    .get(businessId).n;

  const newCustomersThisWeek = db
    .prepare(`SELECT COUNT(*) as n FROM customers WHERE business_id = ? AND created_at >= datetime('now','-7 days')`)
    .get(businessId).n;

  const recentActivity = db
    .prepare(
      `SELECT ae.*, c.name as customer_name FROM automation_events ae
       JOIN customers c ON c.id = ae.customer_id
       WHERE ae.business_id = ? AND ae.status = 'sent'
       ORDER BY ae.sent_at DESC LIMIT 8`
    )
    .all(businessId);

  res.json({ today, unreadCount, weekAppointments, newCustomersThisWeek, recentActivity });
});
