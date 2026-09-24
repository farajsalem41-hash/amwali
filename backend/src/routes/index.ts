import { Router } from 'express';
import authRoutes from './auth.routes';
import merchantRoutes from './merchant.routes';
import paymentRequestRoutes from './paymentRequest.routes';
import proofRoutes from './proof.routes';
import customerRoutes from './customer.routes';
import orgRoutes from './org.routes';
import invoiceRoutes from './invoice.routes';
import orderRoutes from './order.routes';
import miscRoutes from './misc.routes';
import publicRoutes from './public.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', service: 'amwali-api', time: new Date().toISOString() }));
router.use('/auth', authRoutes);
router.use('/merchant', merchantRoutes);
router.use('/payment-requests', paymentRequestRoutes);
router.use('/proofs', proofRoutes);
router.use('/customers', customerRoutes);
router.use('/org', orgRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/orders', orderRoutes);
router.use('/admin', adminRoutes);
router.use('/public', publicRoutes);
router.use('/', miscRoutes);

export default router;
