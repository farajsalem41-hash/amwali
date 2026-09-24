import { Router } from 'express';
import * as c from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../utils/validate';
import { authLimiter, otpLimiter } from '../middleware/rateLimit';
import {
  registerSchema,
  verifyOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../validators/auth.validator';

const router = Router();

router.post('/register', authLimiter, validateBody(registerSchema), c.register);
router.post('/resend-otp', otpLimiter, c.resendOtp);
router.post('/verify-otp', otpLimiter, validateBody(verifyOtpSchema), c.verifyOtp);
router.post('/login', authLimiter, validateBody(loginSchema), c.login);
router.post('/forgot-password', otpLimiter, validateBody(forgotPasswordSchema), c.forgotPassword);
router.post('/reset-password', authLimiter, validateBody(resetPasswordSchema), c.resetPassword);
router.post('/change-password', authenticate, validateBody(changePasswordSchema), c.changePassword);
router.get('/me', authenticate, c.me);
router.post('/logout', authenticate, c.logout);

export default router;
