import { Router } from 'express';
import * as c from '../controllers/invoice.controller';
import { authenticate, requireFeature, requirePermission } from '../middleware/auth';
import { validateBody } from '../utils/validate';
import { invoiceSchema } from '../validators/payment.validator';

const router = Router();
router.use(authenticate, requireFeature('invoices'));

router.get('/', requirePermission('invoices.view'), c.listInvoices);
router.post('/', requirePermission('invoices.manage'), validateBody(invoiceSchema), c.createInvoice);
router.get('/:id', requirePermission('invoices.view'), c.getInvoice);
router.patch('/:id', requirePermission('invoices.manage'), c.updateInvoice);

export default router;
