import { Router } from 'express';
import * as c from '../controllers/proof.controller';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateBody } from '../utils/validate';
import { reviewProofSchema } from '../validators/payment.validator';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('proofs.review', 'payments.view'), c.listProofs);
router.post('/:id/review', requirePermission('proofs.review'), validateBody(reviewProofSchema), c.reviewProof);

export default router;
