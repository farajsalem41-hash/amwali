import { Router } from 'express';
import * as c from '../controllers/org.controller';
import { authenticate, requirePermission, requireFeature } from '../middleware/auth';
import { validateBody } from '../utils/validate';
import { branchSchema, employeeSchema, productSchema, courierSchema } from '../validators/merchant.validator';

const router = Router();
router.use(authenticate);

router.get('/branches', requirePermission('branches.manage', 'payment_requests.view'), c.listBranches);
router.post('/branches', requireFeature('branches'), requirePermission('branches.manage'), validateBody(branchSchema), c.createBranch);
router.patch('/branches/:id', requireFeature('branches'), requirePermission('branches.manage'), c.updateBranch);
router.delete('/branches/:id', requireFeature('branches'), requirePermission('branches.manage'), c.deleteBranch);

router.get('/employees', requirePermission('employees.manage'), c.listEmployees);
router.post('/employees', requireFeature('employees'), requirePermission('employees.manage'), validateBody(employeeSchema), c.createEmployee);
router.patch('/employees/:id', requireFeature('employees'), requirePermission('employees.manage'), c.updateEmployee);
router.delete('/employees/:id', requireFeature('employees'), requirePermission('employees.manage'), c.deleteEmployee);

router.get('/products', c.listProducts);
router.post('/products', requirePermission('products.manage'), validateBody(productSchema), c.createProduct);
router.patch('/products/:id', requirePermission('products.manage'), c.updateProduct);
router.delete('/products/:id', requirePermission('products.manage'), c.deleteProduct);

router.get('/couriers', requireFeature('delivery'), c.listCouriers);
router.post('/couriers', requireFeature('delivery'), requirePermission('couriers.manage'), validateBody(courierSchema), c.createCourier);
router.patch('/couriers/:id', requireFeature('delivery'), requirePermission('couriers.manage'), c.updateCourier);
router.delete('/couriers/:id', requireFeature('delivery'), requirePermission('couriers.manage'), c.deleteCourier);

router.get('/audit-logs', requirePermission('audit.view'), c.listAuditLogs);

export default router;
