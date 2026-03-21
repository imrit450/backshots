import { Router, Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../index';
import { authenticateGuest, authenticateHost } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimit';
import { AppError } from '../middleware/errorHandler';
import { processImage, deletePhotoFiles } from '../services/media';
import { analyzeImage } from '../services/imageAnalysis';
import { computeRevealAt, eventWhereForHost } from '../utils/helpers';
import { config } from '../config';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSize },
  fileFilter: (_req, file, cb) => {
    if (config.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Invalid file type. Only JPEG, PNG, and WebP are allowed.', 400) as any);
    }
  },
});

// POST /v1/events/:eventId/photos/upload - Guest uploads a photo
router.post(
  '/:eventId/photos/upload',
  authenticateGuest,
  uploadLimiter,
  upload.single('photo'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError('No photo file provided', 400);
    }

    const eventId = req.params.eventId;
    const sessionId = req.guestUser!.sessionId;

    // Verify guest session belongs to this event
    if (req.guestUser!.eventId !== eventId) {
      throw new AppError('Session does not belong to this event', 403);
    }

    // Get event and session
    const [event, session] = await Promise.all([
      prisma.event.findUnique({ where: { id: eventId } }),
      prisma.guestSession.findUnique({ where: { id: sessionId } }),
    ]);

    if (!event || !event.isActive) {
      throw new AppError('Event not found or inactive', 404);
    }

    // Enforce upload cutoff (hours after event start)
    if (event.uploadCutoffHours > 0) {
      const cutoffTime = new Date(event.startDatetime);
      cutoffTime.setHours(cutoffTime.getHours() + event.uploadCutoffHours);
      if (new Date() > cutoffTime) {
        throw new AppError(
          `Uploads closed. Photo uploads ended ${event.uploadCutoffHours} hours after the event.`,
          403
        );
      }
    }

    if (!session) {
      throw new AppError('Guest session not found', 404);
    }

    // Enforce per-guest photo limit
    if (session.photoCount >= event.maxPhotosPerGuest) {
      throw new AppError(
        `Photo limit reached (${event.maxPhotosPerGuest} per guest)`,
        429
      );
    }

    // Enforce event-wide total photo limit
    const eventPhotoCount = await prisma.photo.count({ where: { eventId } });
    if (eventPhotoCount >= event.maxPhotosTotal) {
      throw new AppError(
        `Event photo limit reached (${event.maxPhotosTotal} total)`,
        429
      );
    }

    // Enforce event-wide storage limit
    const storageAgg = await prisma.photo.aggregate({
      where: { eventId },
      _sum: { fileSize: true },
    });
    const storageUsedBytes = storageAgg._sum.fileSize || 0;
    const storageLimitBytes = event.maxStorageMb * 1024 * 1024;
    if (storageUsedBytes >= storageLimitBytes) {
      throw new AppError(
        `Event storage limit reached (${event.maxStorageMb} MB)`,
        429
      );
    }

    // Read optional title and description from form fields
    const title = (req.body.title as string)?.trim() || null;
    const description = (req.body.description as string)?.trim() || null;

    // Process image + run quality analysis in parallel
    const photoPrefix = `hosts/${event.hostId}/events/${event.id}`;
    const [processed, analysis] = await Promise.all([
      processImage(req.file.buffer, req.file.originalname, photoPrefix),
      analyzeImage(req.file.buffer).catch(() => null), // never block upload on analysis failure
    ]);

    const now = new Date();
    const revealAt = computeRevealAt(now, event.revealDelayHours);
    const status = event.moderationMode === 'AUTO' ? 'APPROVED' : 'PENDING';

    // Create photo record and update session count
    const [photo] = await prisma.$transaction([
      prisma.photo.create({
        data: {
          eventId,
          guestSessionId: sessionId,
          title,
          description,
          status,
          capturedAt: now,
          revealAt,
          originalUrl: processed.originalUrl,
          largeUrl: processed.largeUrl,
          thumbUrl: processed.thumbUrl,
          fileSize: processed.totalFileSize,
          qualityScore: analysis?.qualityScore ?? null,
          qualityIssues: analysis?.issues || null,
        },
      }),
      prisma.guestSession.update({
        where: { id: sessionId },
        data: {
          photoCount: { increment: 1 },
          lastUploadAt: now,
        },
      }),
    ]);

    res.status(201).json({
      photo: {
        id: photo.id,
        title: photo.title,
        description: photo.description,
        status: photo.status,
        thumbUrl: photo.thumbUrl,
        revealAt: photo.revealAt.toISOString(),
      },
      remainingPhotos: event.maxPhotosPerGuest - (session.photoCount + 1),
    });
  })
);

// GET /v1/events/:eventId/photos/mine - Guest gets their own photos with current status
router.get(
  '/:eventId/photos/mine',
  authenticateGuest,
  asyncHandler(async (req: Request, res: Response) => {
    const eventId = req.params.eventId;
    const sessionId = req.guestUser!.sessionId;

    if (req.guestUser!.eventId !== eventId) {
      throw new AppError('Session does not belong to this event', 403);
    }

    const photos = await prisma.photo.findMany({
      where: { eventId, guestSessionId: sessionId },
      orderBy: { capturedAt: 'desc' },
      select: {
        id: true,
        status: true,
        thumbUrl: true,
        largeUrl: true,
        title: true,
        capturedAt: true,
      },
    });

    res.json({
      photos: photos.map((p) => ({
        id: p.id,
        status: p.status,
        thumbUrl: p.thumbUrl,
        largeUrl: p.largeUrl,
        title: p.title,
        capturedAt: p.capturedAt.toISOString(),
      })),
    });
  })
);

// DELETE /v1/events/:eventId/photos/:photoId - Guest deletes own PENDING photo
router.delete(
  '/:eventId/photos/:photoId',
  authenticateGuest,
  asyncHandler(async (req: Request, res: Response) => {
    const eventId = req.params.eventId;
    const photoId = req.params.photoId;
    const sessionId = req.guestUser!.sessionId;

    if (req.guestUser!.eventId !== eventId) {
      throw new AppError('Session does not belong to this event', 403);
    }

    const photo = await prisma.photo.findFirst({
      where: { id: photoId, eventId, guestSessionId: sessionId },
    });

    if (!photo) {
      throw new AppError('Photo not found', 404);
    }

    if (photo.status !== 'PENDING') {
      throw new AppError('Only pending photos can be deleted', 403);
    }

    // Delete files from disk
    await deletePhotoFiles({
      originalUrl: photo.originalUrl,
      largeUrl: photo.largeUrl,
      thumbUrl: photo.thumbUrl,
    });

    // Delete record and decrement guest photo count in a transaction
    await prisma.$transaction([
      prisma.photo.delete({ where: { id: photo.id } }),
      prisma.guestSession.update({
        where: { id: sessionId },
        data: { photoCount: { decrement: 1 } },
      }),
    ]);

    res.json({ success: true });
  })
);

// GET /v1/events/:eventId/photos - Host gets all photos (owner or admin)
router.get('/:eventId/photos', authenticateHost, asyncHandler(async (req: Request, res: Response) => {
  const evWhere = await eventWhereForHost(prisma, req.params.eventId, req.hostUser!.hostId);
  const event = await prisma.event.findFirst({ where: evWhere });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const { status, hidden, page = '1', limit = '50' } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = Math.min(parseInt(limit as string, 10), 100);

  const photoWhere: any = { eventId: event.id };
  if (status) photoWhere.status = status;
  if (hidden !== undefined) photoWhere.hidden = hidden === 'true';

  const [photos, total] = await Promise.all([
    prisma.photo.findMany({
      where: photoWhere,
      orderBy: { capturedAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        guestSession: {
          select: { displayName: true },
        },
      },
    }),
    prisma.photo.count({ where: photoWhere }),
  ]);

  res.json({
    photos: photos.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      status: p.status,
      hidden: p.hidden,
      capturedAt: p.capturedAt.toISOString(),
      revealAt: p.revealAt.toISOString(),
      thumbUrl: p.thumbUrl,
      largeUrl: p.largeUrl,
      originalUrl: p.originalUrl,
      guestName: p.guestSession.displayName,
      filterApplied: p.filterApplied,
      qualityScore: p.qualityScore,
      qualityIssues: p.qualityIssues,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
}));

export default router;
