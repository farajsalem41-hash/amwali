import { Router } from 'express';
import * as c from '../controllers/order.controller';
import { authenticate, requireFeature, requirePermission } from '../middleware/auth';
import { validateBody } from '../utils/validate';
import { orderSchema, deliveryStatusSchema } from '../validators/payment.validator';

const router = Router();
router.use(authenticate, requireFeature('orders'));

router.get('/', requirePermission('orders.view'), c.listOrders);
router.post('/', requirePermission('orders.manage'), validateBody(orderSchema), c.createOrder);
router.get('/:id', requirePermission('orders.view'), c.getOrder);
router.patch('/:id', requirePermission('orders.manage'), c.updateOrder);
router.post('/:id/delivery-status', requirePermission('orders.manage'), validateBody(deliveryStatusSchema), c.updateDeliveryStatus);
router.post('/:id/courier-link', requirePermission('orders.manage'), c.regenerateCourierLink);

export default router;
