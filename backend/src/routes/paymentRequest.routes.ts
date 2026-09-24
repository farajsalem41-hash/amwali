import { Router } from 'express';
import * as c from '../controllers/paymentRequest.controller';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateBody } from '../utils/validate';
import { createPaymentRequestSchema, updatePaymentRequestSchema, addPaymentSchema } from '../validators/payment.validator';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('payment_requests.view'), c.listRequests);
router.post('/', requirePermission('payment_requests.create'), validateBody(createPaymentRequestSchema), c.createRequest);
router.get('/:id', requirePermission('payment_requests.view'), c.getRequest);
router.get('/:id/qr', requirePermission('payment_requests.view'), c.getRequestQr);
router.patch('/:id', requirePermission('payment_requests.update'), validateBody(updatePaymentRequestSchema), c.updateRequest);
router.post('/:id/cancel', requirePermission('payment_requests.cancel'), c.cancelRequest);
router.post('/:id/expire', requirePermission('payment_requests.update'), c.expireRequest);
router.get('/:id/payments', requirePermission('payments.view'), c.listPayments);
router.post('/:id/payments', requirePermission('payments.confirm'), validateBody(addPaymentSchema), c.addPayment);

export default router;
