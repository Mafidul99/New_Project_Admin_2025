import express from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  getMe,
  updateProfile,
  changePassword,
  getSessions,
  revokeSession
} from '../controllers/authController.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import validate from '../middleware/validationMiddleware.js';
import { authLimiter, generalLimiter } from '../middleware/rateLimit.js';
import { authSchemas } from '../utils/zodSchemas.js';

const router = express.Router();

// Public routes with rate limiting
router.post('/register', authLimiter, validate(authSchemas.register), register);
router.post('/login', authLimiter, validate(authSchemas.login), login);
router.post('/refresh-token', generalLimiter, validate(authSchemas.refreshToken), refreshToken);

// Protected routes
router.use(authenticate); // All routes below require authentication

router.post('/logout', generalLimiter, logout);
router.post('/logout-all', generalLimiter, logoutAll);
router.get('/me', generalLimiter, getMe);
router.put('/profile', generalLimiter, validate(authSchemas.updateProfile), updateProfile);
router.put('/change-password', generalLimiter, validate(authSchemas.changePassword), changePassword);
router.get('/sessions', generalLimiter, getSessions);
router.delete('/sessions/:sessionId', generalLimiter, revokeSession);

// Admin only routes
router.get('/admin/users', authorize('admin'), async (req, res) => {
  // Admin functionality to get all users
  res.json({
    success: true,
    message: 'Admin access granted to users list'
  });
});

export default router;