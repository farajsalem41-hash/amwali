import { Router } from 'express';
import * as dashboard from '../controllers/dashboard.controller';
import * as notifications from '../controllers/notification.controller';
import * as reports from '../controllers/report.controller';
import * as subscription from '../controllers/subscription.controller';
import * as support from '../controllers/support.controller';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();

router.get('/plans', subscription.listPlans);

router.use(authenticate);
router.get('/dashboard', dashboard.getDashboard);

router.get('/notifications', notifications.listNotifications);
router.post('/notifications/:id/read', notifications.markRead);
router.post('/notifications/read-all', notifications.markAllRead);

router.get('/reports/summary', requirePermission('reports.view'), reports.getSummaryReport);
router.get('/reports/export/:format', requirePermission('reports.view'), reports.exportReport);

router.get('/subscription', subscription.getMySubscription);
router.get('/subscription/usage', subscription.getUsage);
router.post('/subscription/change-request', requirePermission('subscription.manage'), subscription.requestPlanChange);

router.get('/support/tickets', support.listMyTickets);
router.post('/support/tickets', support.createTicket);
router.get('/support/tickets/:id', support.getTicket);
router.post('/support/tickets/:id/reply', support.replyToTicket);
router.post('/support/tickets/:id/close', support.closeTicket);

export default router;
