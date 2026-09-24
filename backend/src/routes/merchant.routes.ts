import { Router } from 'express';
import * as c from '../controllers/merchant.controller';
import * as files from '../controllers/file.controller';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateBody } from '../utils/validate';
import { updateMerchantSchema, paymentAccountSchema } from '../validators/merchant.validator';
import { uploadSingleImage } from '../middleware/upload';
import { uploadLimiter } from '../middleware/rateLimit';

const router = Router();
router.use(authenticate);

router.get('/profile', c.getProfile);
router.patch('/profile', requirePermission('merchant.settings'), validateBody(updateMerchantSchema), c.updateProfile);
router.post('/logo', requirePermission('merchant.settings'), uploadLimiter, uploadSingleImage, files.uploadLogo);

router.get('/payment-accounts', requirePermission('payment_accounts.view', 'payment_accounts.manage'), c.listPaymentAccounts);
router.post(
  '/payment-accounts',
  requirePermission('payment_accounts.manage'),
  validateBody(paymentAccountSchema),
  c.createPaymentAccount
);
router.patch('/payment-accounts/:id', requirePermission('payment_accounts.manage'), c.updatePaymentAccount);
router.post('/payment-accounts/:id/default', requirePermission('payment_accounts.manage'), c.setDefaultPaymentAccount);
router.delete('/payment-accounts/:id', requirePermission('payment_accounts.manage'), c.deletePaymentAccount);

export default router;
