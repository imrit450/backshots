import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../index';
import { authenticateHost } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { deletePhotoFiles } from '../services/media';
import { eventWhereForHost } from '../utils/helpers';

const router = Router();

const moderatePhotoSchema = z.object({
  hidden: z.boolean().optional(),
  status: z.enum(['APPROVED', 'REJECTED']).optional(),
});

// PATCH /v1/events/:eventId/photos/:photoId - Host moderate photo
router.patch(
  '/:eventId/photos/:photoId',
  authenticateHost,
  asyncHandler(async (req: Request, res: Response) => {
    const body = moderatePhotoSchema.parse(req.body);

    // Verify event belongs to host (or host is admin)
    const evWhere = await eventWhereForHost(prisma, req.params.eventId, req.hostUser!.hostId);
    const event = await prisma.event.findFirst({ where: evWhere });

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const photo = await prisma.photo.findFirst({
      where: { id: req.params.photoId, eventId: event.id },
    });

    if (!photo) {
      throw new AppError('Photo not found', 404);
    }

    const updateData: any = {};
    if (body.hidden !== undefined) updateData.hidden = body.hidden;
    if (body.status !== undefined) updateData.status = body.status;

    const updated = await prisma.photo.update({
      where: { id: photo.id },
      data: updateData,
      include: {
        guestSession: {
          select: { displayName: true },
        },
      },
    });

    res.json({
      photo: {
        id: updated.id,
        status: updated.status,
        hidden: updated.hidden,
        capturedAt: updated.capturedAt.toISOString(),
        thumbUrl: updated.thumbUrl,
        largeUrl: updated.largeUrl,
        guestName: updated.guestSession.displayName,
      },
    });
  })
);

// PATCH /v1/events/:eventId/videos/:videoId - Host moderate video
router.patch(
  '/:eventId/videos/:videoId',
  authenticateHost,
  asyncHandler(async (req: Request, res: Response) => {
    const body = moderatePhotoSchema.parse(req.body); // same shape: hidden / status

    const evWhere = await eventWhereForHost(prisma, req.params.eventId, req.hostUser!.hostId);
    const event = await prisma.event.findFirst({ where: evWhere });

    if (!event) throw new AppError('Event not found', 404);

    const video = await prisma.video.findFirst({
      where: { id: req.params.videoId, eventId: event.id },
    });

    if (!video) throw new AppError('Video not found', 404);

    const updateData: any = {};
    if (body.hidden !== undefined) updateData.hidden = body.hidden;
    if (body.status !== undefined) updateData.status = body.status;

    const updated = await prisma.video.update({
      where: { id: video.id },
      data: updateData,
      include: { guestSession: { select: { displayName: true } } },
    });

    res.json({
      video: {
        id: updated.id,
        status: updated.status,
        hidden: updated.hidden,
        capturedAt: updated.capturedAt.toISOString(),
        url: updated.url,
        durationSec: updated.durationSec,
        guestName: updated.guestSession.displayName,
      },
    });
  })
);

// ── Bulk operations ────────────────────────────────────────────────────

const bulkModerateSchema = z.object({
  photoIds: z.array(z.string()).min(1).max(100),
  action: z.enum(['approve', 'reject', 'hide', 'unhide', 'delete']),
});

// POST /v1/events/:eventId/photos/bulk - Bulk moderate/delete photos
router.post(
  '/:eventId/photos/bulk',
  authenticateHost,
  asyncHandler(async (req: Request, res: Response) => {
    const { photoIds, action } = bulkModerateSchema.parse(req.body);

    const bulkWhere = await eventWhereForHost(prisma, req.params.eventId, req.hostUser!.hostId);
    const event = await prisma.event.findFirst({ where: bulkWhere });

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    // Verify all photos belong to this event
    const photos = await prisma.photo.findMany({
      where: { id: { in: photoIds }, eventId: event.id },
    });

    if (photos.length === 0) {
      throw new AppError('No matching photos found', 404);
    }

    const matchedIds = photos.map((p) => p.id);

    if (action === 'delete') {
      // Delete files from disk in parallel
      await Promise.allSettled(
        photos.map((p) =>
          deletePhotoFiles({
            originalUrl: p.originalUrl,
            largeUrl: p.largeUrl,
            thumbUrl: p.thumbUrl,
          })
        )
      );

      // Decrement photo counts per guest session, then delete records
      const sessionCounts = new Map<string, number>();
      for (const p of photos) {
        sessionCounts.set(p.guestSessionId, (sessionCounts.get(p.guestSessionId) || 0) + 1);
      }

      const ops: any[] = [
        prisma.photo.deleteMany({ where: { id: { in: matchedIds } } }),
      ];
      for (const [sessionId, count] of sessionCounts) {
        ops.push(
          prisma.guestSession.update({
            where: { id: sessionId },
            data: { photoCount: { decrement: count } },
          })
        );
      }
      await prisma.$transaction(ops);

      return res.json({ success: true, affected: matchedIds.length, action });
    }

    // For non-delete actions, build the update payload
    const updateData: any = {};
    if (action === 'approve') updateData.status = 'APPROVED';
    if (action === 'reject') updateData.status = 'REJECTED';
    if (action === 'hide') updateData.hidden = true;
    if (action === 'unhide') updateData.hidden = false;

    await prisma.photo.updateMany({
      where: { id: { in: matchedIds } },
      data: updateData,
    });

    res.json({ success: true, affected: matchedIds.length, action });
  })
);

// GET /v1/events/:eventId/stats - Host dashboard stats (owner or admin)
router.get('/:eventId/stats', authenticateHost, asyncHandler(async (req: Request, res: Response) => {
  const statsWhere = await eventWhereForHost(prisma, req.params.eventId, req.hostUser!.hostId);
  const event = await prisma.event.findFirst({ where: statsWhere });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const [totalPhotos, hiddenPhotos, pendingPhotos, approvedPhotos, rejectedPhotos, guestCount, topGuests, storageAgg] =
    await Promise.all([
      prisma.photo.count({ where: { eventId: event.id } }),
      prisma.photo.count({ where: { eventId: event.id, hidden: true } }),
      prisma.photo.count({ where: { eventId: event.id, status: 'PENDING' } }),
      prisma.photo.count({ where: { eventId: event.id, status: 'APPROVED' } }),
      prisma.photo.count({ where: { eventId: event.id, status: 'REJECTED' } }),
      prisma.guestSession.count({ where: { eventId: event.id } }),
      prisma.guestSession.findMany({
        where: { eventId: event.id },
        orderBy: { photoCount: 'desc' },
        take: 10,
        select: { displayName: true, photoCount: true },
      }),
      prisma.photo.aggregate({
        where: { eventId: event.id },
        _sum: { fileSize: true },
      }),
    ]);

  res.json({
    stats: {
      totalPhotos,
      hiddenPhotos,
      pendingPhotos,
      approvedPhotos,
      rejectedPhotos,
      guestCount,
      topGuests,
      storageUsedBytes: storageAgg._sum.fileSize || 0,
      maxPhotosTotal: event.maxPhotosTotal,
      maxStorageMb: event.maxStorageMb,
    },
  });
}));

export default router;
