import { Router } from 'express';
import * as c from '../controllers/admin.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireAdmin());

router.get('/overview', c.getAdminOverview);
router.get('/merchants', c.listMerchants);
router.get('/merchants/:id', c.getMerchantDetail);
router.post('/merchants/:id/status', c.setMerchantStatus);

router.get('/plans', c.adminListPlans);
router.post('/plans', c.adminSavePlan);
router.patch('/plans/:id', c.adminSavePlan);

router.get('/subscription-requests', c.listSubscriptionRequests);
router.post('/subscription-requests/:id/review', c.reviewSubscriptionRequest);

router.get('/tickets', c.adminListTickets);
router.post('/tickets/:id/reply', c.adminReplyTicket);

router.get('/audit-logs', c.adminListAudit);
router.get('/backups', c.adminListBackups);

export default router;
