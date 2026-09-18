import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 login requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Disables strict header validation warning behind reverse proxies
  message: {
    error: 'Too many login attempts from this IP address. Please try again in 15 minutes.'
  }
});
