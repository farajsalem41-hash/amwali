import { Router } from 'express';
import * as c from '../controllers/customer.controller';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('customers.view'), c.listCustomers);
router.post('/', requirePermission('customers.manage'), c.createCustomer);
router.get('/:id', requirePermission('customers.view'), c.getCustomer);
router.patch('/:id', requirePermission('customers.manage'), c.updateCustomer);
router.post('/:id/recalc', requirePermission('customers.manage'), c.refreshCustomerTotals);
router.delete('/:id', requirePermission('customers.manage'), c.deleteCustomer);

export default router;
