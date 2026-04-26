import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticateHost } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../index';
import { config } from '../config';
import { getAuthUrl, exchangeCode } from '../services/googlePhotos';

const router = Router();

// GET /v1/auth/google — redirect host to Google consent screen
router.get(
  '/google',
  authenticateHost,
  asyncHandler(async (req: Request, res: Response) => {
    console.log('[googleAuth] GOOGLE_CLIENT_ID present:', !!config.googleClientId, '| GOOGLE_CLIENT_SECRET present:', !!config.googleClientSecret, '| BASE_URL:', config.baseUrl);
    if (!config.googleClientId || !config.googleClientSecret) {
      throw new AppError('Google OAuth is not configured on this server', 503);
    }
    const url = getAuthUrl(req.hostUser!.hostId);
    console.log('[googleAuth] generated auth URL:', url);
    res.json({ url });
  })
);

// GET /v1/auth/google/callback — Google redirects here after consent
router.get(
  '/google/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { code, state: hostId, error } = req.query as Record<string, string>;

    if (error || !code || !hostId) {
      return res.redirect(
        `${config.frontendUrl}/host/google?status=error&reason=${encodeURIComponent(error || 'missing_params')}`
      );
    }

    try {
      const refreshToken = await exchangeCode(code);
      await prisma.host.update({
        where: { id: hostId },
        data: { googleRefreshToken: refreshToken },
      });
      return res.redirect(`${config.frontendUrl}/host/google?status=connected`);
    } catch (err: any) {
      console.error('Google OAuth callback error:', err);
      return res.redirect(
        `${config.frontendUrl}/host/google?status=error&reason=${encodeURIComponent(err.message)}`
      );
    }
  })
);

// GET /v1/auth/google/status — check if the current host has Google connected
router.get(
  '/google/status',
  authenticateHost,
  asyncHandler(async (req: Request, res: Response) => {
    const host = await prisma.host.findUnique({
      where: { id: req.hostUser!.hostId },
      select: { googleRefreshToken: true },
    });
    res.json({ connected: !!host?.googleRefreshToken });
  })
);

// DELETE /v1/auth/google — disconnect Google account
router.delete(
  '/google',
  authenticateHost,
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.host.update({
      where: { id: req.hostUser!.hostId },
      data: { googleRefreshToken: null },
    });
    res.json({ ok: true });
  })
);

export default router;
