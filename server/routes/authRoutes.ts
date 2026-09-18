import { Router } from 'express';
import { body } from 'express-validator';
import { login, logout, getCurrentUser, sudoLogin, exitSudo } from '../controllers/authController.ts';
import { verifyJWT, requireAdmin } from '../middleware/auth.ts';
import { loginLimiter } from '../middleware/rateLimiter.ts';

const router = Router();

router.post(
  '/login',
  loginLimiter,
  [
    body('username').trim().notEmpty().withMessage('Username or email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

router.post('/logout', verifyJWT, logout);
router.get('/me', verifyJWT, getCurrentUser);
router.post('/sudo', verifyJWT, requireAdmin, sudoLogin);
router.post('/exit-sudo', verifyJWT, exitSudo);

export default router;
