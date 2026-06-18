const express  = require('express');
const rateLimit = require('express-rate-limit');
const router   = express.Router();
const {
  register, registerValidators,
  verifyRegistration,
  login, loginValidators,
  verifyLoginOTP,
  resendOTP,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  verifyForgotOTP,
  resetPassword,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { success: false, message: 'Too many requests. Try again in 15 minutes.' },
  standardHeaders: true, legacyHeaders: false,
});
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 3,
  message: { success: false, message: 'Too many OTP requests. Wait 10 minutes.' },
  standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.body?.identifier || req.body?.userId || req.ip,
});

router.post('/register',               authLimiter, registerValidators, register);
router.post('/register/verify',        authLimiter, verifyRegistration);
router.post('/login',                  authLimiter, loginValidators, login);
router.post('/login/verify',           authLimiter, verifyLoginOTP);
router.post('/forgot-password',        otpLimiter,  forgotPassword);
router.post('/forgot-password/verify', authLimiter, verifyForgotOTP);
router.post('/reset-password',         authLimiter, resetPassword);
router.post('/resend-otp',             otpLimiter,  resendOTP);
router.post('/refresh',                refreshToken);
router.post('/logout',                 authenticate, logout);
router.get('/me',                      authenticate, getMe);
router.get('/health', (_, res) =>
  res.json({ success: true, message: 'Auth service healthy', timestamp: new Date().toISOString() })
);

module.exports = router;
