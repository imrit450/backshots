import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { createClerkClient, verifyToken as verifyClerkToken } from '@clerk/backend';
import { asyncHandler } from '../utils/asyncHandler';
import { z } from 'zod';
import { prisma } from '../index';
import { generateHostToken, authenticateHost } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import { AppError } from '../middleware/errorHandler';
import { getKeyPair, decryptPassword } from '../utils/crypto';

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  encryptedPassword: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  displayName: z.string().min(1).max(100),
}).refine((d) => d.encryptedPassword ?? d.password, { message: 'Password is required', path: ['password'] });

const loginSchema = z.object({
  email: z.string().email(),
  encryptedPassword: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
}).refine((d) => d.encryptedPassword ?? d.password, { message: 'Password is required', path: ['password'] });

// GET /v1/auth/public-key — returns the RSA public key for client-side encryption
router.get('/public-key', (_req: Request, res: Response) => {
  const { publicKey } = getKeyPair();
  res.json({ publicKey });
});

// POST /v1/auth/host/signup
router.post('/host/signup', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const body = signupSchema.parse(req.body);

  let password: string;
  if (body.encryptedPassword) {
    try {
      password = decryptPassword(body.encryptedPassword);
    } catch {
      throw new AppError('Failed to decrypt password. Please refresh and try again.', 400);
    }
  } else {
    password = body.password!;
  }

  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const existing = await prisma.host.findUnique({ where: { email: body.email } });
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const host = await prisma.host.create({
    data: {
      email: body.email,
      passwordHash,
      displayName: body.displayName,
    },
  });

  const token = generateHostToken(host.id, host.email);
  res.status(201).json({
    token,
    host: {
      id: host.id,
      email: host.email,
      displayName: host.displayName,
      role: host.role,
      canCreateEvents: host.canCreateEvents,
      plan: host.plan,
    },
  });
}));

// POST /v1/auth/host/login
router.post('/host/login', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const body = loginSchema.parse(req.body);

  let password: string;
  if (body.encryptedPassword) {
    try {
      password = decryptPassword(body.encryptedPassword);
    } catch {
      throw new AppError('Failed to decrypt password. Please refresh and try again.', 400);
    }
  } else {
    password = body.password!;
  }

  const host = await prisma.host.findUnique({ where: { email: body.email } });
  if (!host) {
    throw new AppError('Invalid email or password', 401);
  }

  const valid = await bcrypt.compare(password, host.passwordHash);
  if (!valid) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = generateHostToken(host.id, host.email);
  res.json({
    token,
    host: {
      id: host.id,
      email: host.email,
      displayName: host.displayName,
      role: host.role,
      canCreateEvents: host.canCreateEvents,
      plan: host.plan,
    },
  });
}));

// GET /v1/auth/host/me
router.get('/host/me', authenticateHost, asyncHandler(async (req: Request, res: Response) => {
  const host = await prisma.host.findUnique({
    where: { id: req.hostUser!.hostId },
    select: { id: true, email: true, displayName: true, role: true, canCreateEvents: true, plan: true, createdAt: true },
  });
  if (!host) {
    throw new AppError('Host not found', 404);
  }
  res.json({ host });
}));

// POST /v1/auth/host/clerk
// Accepts a Clerk session JWT, verifies it, upserts the Host row, and
// returns a Lumora JWT so the rest of the API works unchanged.
// NOTE: No rate limiter here because Clerk session refresh + React mounts
// can legitimately trigger multiple exchanges in a short window.
router.post('/host/clerk', asyncHandler(async (req: Request, res: Response) => {
  const { clerkToken } = z.object({ clerkToken: z.string().min(1) }).parse(req.body);

  const { config } = await import('../config');

  // Build a Clerk client — works with or without keys (keyless mode).
  const clerk = createClerkClient({
    secretKey: config.clerkSecretKey,
    publishableKey: config.clerkPublishableKey,
  });

  // Verify the JWT and extract the Clerk user.
  let clerkUserId: string;
  let primaryEmail: string;
  let displayName: string;

  try {
    // verifyToken validates the JWT signature and expiry using Clerk's JWKS.
    const payload = await verifyClerkToken(clerkToken, {
      secretKey: config.clerkSecretKey,
    });
    clerkUserId = payload.sub;

    // Fetch the full user object for email + name.
    const clerkUser = await clerk.users.getUser(clerkUserId);
    primaryEmail =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
        ?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      '';
    displayName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
      clerkUser.username ||
      primaryEmail;
  } catch (err: any) {
    throw new AppError('Invalid Clerk token', 401);
  }

  if (!primaryEmail) {
    throw new AppError('Clerk account has no email address', 400);
  }

  // Upsert: find by email or create a new Host linked to the Clerk user ID.
  // We store a random unusable passwordHash so the existing schema stays valid.
  let host = await prisma.host.findUnique({ where: { email: primaryEmail } });

  if (!host) {
    const unusableHash = await bcrypt.hash(crypto.randomUUID(), 1);
    host = await prisma.host.create({
      data: {
        email: primaryEmail,
        passwordHash: unusableHash,
        displayName,
      },
    });
  }

  const token = generateHostToken(host.id, host.email);
  res.json({
    token,
    host: {
      id: host.id,
      email: host.email,
      displayName: host.displayName,
      role: host.role,
      canCreateEvents: host.canCreateEvents,
      plan: host.plan,
    },
  });
}));

export default router;
