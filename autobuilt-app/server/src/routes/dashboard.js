import { Router } from 'express';
import db from '../db/index.js';
import { getCurrentBusinessId } from './business.js';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', (req, res) => {
  const businessId = getCurrentBusinessId();

  const today = db
    .prepare(
      `SELECT a.*, c.name as customer_name, s.name as service_name
       FROM appointments a JOIN customers c ON c.id = a.customer_id
       LEFT JOIN services s ON s.id = a.service_id
       WHERE a.business_id = ? AND date(a.start_at) = date('now')
       ORDER BY a.start_at`
    )
    .all(businessId);

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
