import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../index';
import { authenticateHost } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// GET /v1/host/memories
// Returns all events the authenticated host attended as a guest, with their photos
router.get('/', authenticateHost, asyncHandler(async (req: Request, res: Response) => {
  const hostId = req.hostUser!.hostId;

  const sessions = await prisma.guestSession.findMany({
    where: { hostId },
    orderBy: { createdAt: 'desc' },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          location: true,
          startDatetime: true,
          timezone: true,
          theme: true,
          eventCode: true,
          iconUrl: true,
          hostId: true,
          host: { select: { displayName: true } },
        },
      },
      photos: {
        where: { hidden: false },
        orderBy: { capturedAt: 'asc' },
        select: {
          id: true,
          thumbUrl: true,
          largeUrl: true,
          originalUrl: true,
          capturedAt: true,
          status: true,
        },
      },
      videos: {
        where: { hidden: false },
        orderBy: { capturedAt: 'asc' },
        select: {
          id: true,
          url: true,
          durationSec: true,
          capturedAt: true,
          status: true,
        },
      },
    },
  });

  const memories = sessions.map((s) => ({
    guestSession: {
      id: s.id,
      displayName: s.displayName,
      photoCount: s.photoCount,
      createdAt: s.createdAt.toISOString(),
    },
    event: {
      id: s.event.id,
      title: s.event.title,
      location: s.event.location ?? null,
      startDatetime: s.event.startDatetime.toISOString(),
      timezone: s.event.timezone,
      theme: s.event.theme,
      eventCode: s.event.eventCode,
      iconUrl: s.event.iconUrl ?? null,
      hostName: s.event.host.displayName,
      isOwnEvent: s.event.hostId === hostId,
    },
    photos: s.photos,
    videos: s.videos,
  }));

  res.json({ memories });
}));

// GET /v1/host/memories/:sessionId
// Returns a single memory session (used when browsing a specific past event)
router.get('/:sessionId', authenticateHost, asyncHandler(async (req: Request, res: Response) => {
  const hostId = req.hostUser!.hostId;

  const session = await prisma.guestSession.findFirst({
    where: { id: req.params.sessionId, hostId },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          location: true,
          startDatetime: true,
          timezone: true,
          theme: true,
          eventCode: true,
          iconUrl: true,
          hostId: true,
          host: { select: { displayName: true } },
        },
      },
      photos: {
        where: { hidden: false },
        orderBy: { capturedAt: 'asc' },
        select: {
          id: true,
          thumbUrl: true,
          largeUrl: true,
          originalUrl: true,
          capturedAt: true,
          status: true,
        },
      },
      videos: {
        where: { hidden: false },
        orderBy: { capturedAt: 'asc' },
        select: {
          id: true,
          url: true,
          durationSec: true,
          capturedAt: true,
          status: true,
        },
      },
    },
  });

  if (!session) {
    throw new AppError('Memory not found', 404);
  }

  res.json({
    memory: {
      guestSession: {
        id: session.id,
        displayName: session.displayName,
        photoCount: session.photoCount,
        createdAt: session.createdAt.toISOString(),
      },
      event: {
        id: session.event.id,
        title: session.event.title,
        location: session.event.location ?? null,
        startDatetime: session.event.startDatetime.toISOString(),
        timezone: session.event.timezone,
        theme: session.event.theme,
        eventCode: session.event.eventCode,
        iconUrl: session.event.iconUrl ?? null,
        hostName: session.event.host.displayName,
        isOwnEvent: session.event.hostId === hostId,
      },
      photos: session.photos,
      videos: session.videos,
    },
  });
}));

export default router;
