import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../index';
import { authenticateGuest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { isPhotoVisible } from '../utils/helpers';

const router = Router();

// GET /v1/events/:eventCode/gallery - Guest gallery view
router.get('/:eventCode/gallery', authenticateGuest, asyncHandler(async (req: Request, res: Response) => {
  const event = await prisma.event.findUnique({
    where: { eventCode: req.params.eventCode },
  });

  if (!event || !event.isActive) {
    throw new AppError('Event not found or inactive', 404);
  }

  if (!event.guestGalleryEnabled) {
    throw new AppError('Guest gallery is disabled for this event', 403);
  }

  // Verify guest session belongs to this event
  if (req.guestUser!.eventId !== event.id) {
    throw new AppError('Session does not belong to this event', 403);
  }

  const { sort = 'latest', guestName, page = '1', limit = '50' } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = Math.min(parseInt(limit as string, 10), 100);

  const where: any = { eventId: event.id };

  // Filter by guest name if provided
  if (guestName) {
    const sessions = await prisma.guestSession.findMany({
      where: {
        eventId: event.id,
        displayName: { contains: guestName as string },
      },
      select: { id: true },
    });
    where.guestSessionId = { in: sessions.map((s) => s.id) };
  }

  const photos = await prisma.photo.findMany({
    where,
    orderBy: { capturedAt: sort === 'oldest' ? 'asc' : 'desc' },
    include: {
      guestSession: {
        select: { displayName: true },
      },
    },
  });

  // Apply visibility filter (reveal delay, hidden, approval status)
  const visiblePhotos = photos.filter((p) =>
    isPhotoVisible(
      { hidden: p.hidden, status: p.status, revealAt: p.revealAt },
      event.moderationMode
    )
  );

  // Paginate visible photos
  const start = (pageNum - 1) * limitNum;
  const paginatedPhotos = visiblePhotos.slice(start, start + limitNum);

  res.json({
    photos: paginatedPhotos.map((p) => ({
      id: p.id,
      thumbUrl: p.thumbUrl,
      largeUrl: p.largeUrl,
      title: p.title,
      capturedAt: p.capturedAt.toISOString(),
      guestName: p.guestSession.displayName,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: visiblePhotos.length,
      totalPages: Math.ceil(visiblePhotos.length / limitNum),
    },
  });
}));

export default router;
