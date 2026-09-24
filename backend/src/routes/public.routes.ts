import { Router } from 'express';
import * as c from '../controllers/public.controller';
import * as files from '../controllers/file.controller';
import { publicLimiter, uploadLimiter } from '../middleware/rateLimit';
import { uploadSingleImage } from '../middleware/upload';
import { validateBody } from '../utils/validate';
import { publicProofSchema, deliveryStatusSchema } from '../validators/payment.validator';

const router = Router();

router.get('/pay/:token', publicLimiter, c.getPublicPayment);
router.post(
  '/pay/:token/proof',
  uploadLimiter,
  uploadSingleImage,
  validateBody(publicProofSchema),
  c.submitPublicProof
);
router.get('/courier/:token', publicLimiter, c.getCourierOrder);
router.post('/courier/:token/status', publicLimiter, validateBody(deliveryStatusSchema), c.updateCourierStatus);
router.get('/files/:id', publicLimiter, files.serveFile);

export default router;
