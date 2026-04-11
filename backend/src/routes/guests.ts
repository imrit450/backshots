import { Router, Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../index';
import { generateGuestToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';
import { getPlan } from '../config/plans';
import { config } from '../config';

const router = Router();

const createSessionSchema = z.object({
  displayName: z.string().min(1, 'Name is required').max(100),
  phoneNumber: z.string().max(20).optional(),
  deviceId: z.string().min(1).max(128).optional(),
});

const updateSessionSchema = z.object({
  displayName: z.string().min(1, 'Name is required').max(100),
  phoneNumber: z.string().max(20).optional(),
});

// Helper to build the standard event+session response
function buildSessionResponse(session: any, event: any) {
  return {
    session: {
      id: session.id,
      eventId: event.id,
      displayName: session.displayName,
      phoneNumber: session.phoneNumber,
      photoCount: session.photoCount,
      maxPhotos: event.maxPhotosPerGuest,
    },
    event: {
      id: event.id,
      title: event.title,
      iconUrl: event.iconUrl,
      theme: event.theme,
      startDatetime: event.startDatetime.toISOString(),
      uploadCutoffHours: event.uploadCutoffHours ?? 24,
      guestGalleryEnabled: event.guestGalleryEnabled,
      filtersEnabled: event.filtersEnabled,
      allowedFilters: JSON.parse(event.allowedFilters),
      maxPhotosPerGuest: event.maxPhotosPerGuest,
    },
  };
}

// GET /v1/events/:eventCode/guest-sessions/check?deviceId=xxx
// Check if this device already has a session for this event
router.get('/:eventCode/guest-sessions/check', asyncHandler(async (req: Request, res: Response) => {
  const deviceId = req.query.deviceId as string;
  if (!deviceId) {
    return res.json({ existingSession: null });
  }

  const event = await prisma.event.findUnique({
    where: { eventCode: req.params.eventCode },
  });

  if (!event || !event.isActive) {
    throw new AppError('Event not found or inactive', 404);
  }

  const existing = await prisma.guestSession.findUnique({
    where: {
      eventId_deviceId: {
        eventId: event.id,
        deviceId,
      },
    },
  });

  if (existing) {
    return res.json({
      existingSession: {
        id: existing.id,
        displayName: existing.displayName,
        phoneNumber: existing.phoneNumber,
        photoCount: existing.photoCount,
      },
    });
  }

  res.json({ existingSession: null });
}));

// Helper: extract hostId from the Authorization header if it carries a host JWT
function extractHostId(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(authHeader.substring(7), config.jwtSecret) as any;
    if (payload.type === 'host' && payload.hostId) return payload.hostId as string;
  } catch {
    // not a valid host token — fine
  }
  return null;
}

// POST /v1/events/:eventCode/guest-sessions - Guest starts session
router.post('/:eventCode/guest-sessions', asyncHandler(async (req: Request, res: Response) => {
  const body = createSessionSchema.parse(req.body);

  const event = await prisma.event.findUnique({
    where: { eventCode: req.params.eventCode },
  });

  if (!event || !event.isActive) {
    throw new AppError('Event not found or inactive', 404);
  }

  const hostId = extractHostId(req);

  // If deviceId is provided, check for an existing session from this device
  if (body.deviceId) {
    const existing = await prisma.guestSession.findUnique({
      where: {
        eventId_deviceId: {
          eventId: event.id,
          deviceId: body.deviceId,
        },
      },
    });

    if (existing) {
      // If this session isn't yet linked to a host account but we now know who it is, link it
      if (hostId && !existing.hostId) {
        await prisma.guestSession.update({
          where: { id: existing.id },
          data: { hostId },
        });
      }
      const guestToken = generateGuestToken(existing.id, event.id);
      return res.status(200).json({
        token: guestToken,
        returning: true,
        ...buildSessionResponse(existing, event),
      });
    }
  }

  // Enforce plan guest limit
  const eventHost = await prisma.host.findUnique({
    where: { id: event.hostId },
    select: { plan: true },
  });
  const plan = getPlan(eventHost?.plan || 'free');
  if (plan.maxGuestsPerEvent !== -1) {
    const guestCount = await prisma.guestSession.count({ where: { eventId: event.id } });
    if (guestCount >= plan.maxGuestsPerEvent) {
      throw new AppError(
        `This event has reached its guest limit (${plan.maxGuestsPerEvent}). The host needs to upgrade their plan.`,
        403
      );
    }
  }

  const sessionToken = uuidv4();

  const session = await prisma.guestSession.create({
    data: {
      eventId: event.id,
      hostId: hostId || null,
      deviceId: body.deviceId || null,
      displayName: body.displayName,
      phoneNumber: body.phoneNumber || null,
      token: sessionToken,
    },
  });

  const guestToken = generateGuestToken(session.id, event.id);

  res.status(201).json({
    token: guestToken,
    returning: false,
    ...buildSessionResponse(session, event),
  });
}));

// PATCH /v1/events/:eventCode/guest-sessions/:sessionId - Update guest name/phone
router.patch('/:eventCode/guest-sessions/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const body = updateSessionSchema.parse(req.body);

  const event = await prisma.event.findUnique({
    where: { eventCode: req.params.eventCode },
  });

  if (!event || !event.isActive) {
    throw new AppError('Event not found or inactive', 404);
  }

  const session = await prisma.guestSession.findFirst({
    where: { id: req.params.sessionId, eventId: event.id },
  });

  if (!session) {
    throw new AppError('Session not found', 404);
  }

  const updated = await prisma.guestSession.update({
    where: { id: session.id },
    data: {
      displayName: body.displayName,
      phoneNumber: body.phoneNumber ?? session.phoneNumber,
    },
  });

  const jwt = generateGuestToken(updated.id, event.id);

  res.json({
    token: jwt,
    ...buildSessionResponse(updated, event),
  });
}));

export default router;
