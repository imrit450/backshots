import rateLimit from 'express-rate-limit';
import { Request } from 'express';

const isTest = process.env.NODE_ENV === 'test';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 0 : 20, // 0 = disabled in tests
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});

export const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isTest ? 0 : 10,
  message: { error: 'Too many uploads, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});

export const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isTest ? 0 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    if (isTest) return true;
    // Never rate-limit the public key endpoint — it's required for login
    if (req.path === '/v1/auth/public-key') return true;
    return false;
  },
});
