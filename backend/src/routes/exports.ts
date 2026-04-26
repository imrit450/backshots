import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../index';
import { authenticateHost } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { eventWhereForHost } from '../utils/helpers';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { getStorage } from '../services/storage';
import { exportToGooglePhotos } from '../services/googlePhotos';

const router = Router();

// POST /v1/events/:eventId/exports - Host generates ZIP export (owner or admin)
router.post('/:eventId/exports', authenticateHost, asyncHandler(async (req: Request, res: Response) => {
  const where = await eventWhereForHost(prisma, req.params.eventId, req.hostUser!.hostId);
  const event = await prisma.event.findFirst({ where });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const [photos, videos] = await Promise.all([
    prisma.photo.findMany({
      where: { eventId: event.id, status: 'APPROVED', hidden: false },
      include: { guestSession: { select: { displayName: true } } },
    }),
    prisma.video.findMany({
      where: { eventId: event.id, status: 'APPROVED', hidden: false },
      include: { guestSession: { select: { displayName: true } } },
    }),
  ]);

  if (photos.length === 0 && videos.length === 0) {
    throw new AppError('No approved media to export', 400);
  }

  const exportRecord = await prisma.export.create({
    data: {
      eventId: event.id,
      status: 'PROCESSING',
      photoCount: photos.length,
      videoCount: videos.length,
    },
  });

  const zipFilename = `${event.eventCode}_${exportRecord.id}.zip`;
  const zipPath = path.join(config.exportDir, zipFilename);

  generateZip(zipPath, photos, videos, exportRecord.id, event.title).catch(console.error);

  res.status(202).json({
    export: {
      id: exportRecord.id,
      status: 'PROCESSING',
      photoCount: photos.length,
      videoCount: videos.length,
    },
  });
}));

// GET /v1/events/:eventId/exports/:exportId - Host checks export status
router.get(
  '/:eventId/exports/:exportId',
  authenticateHost,
  asyncHandler(async (req: Request, res: Response) => {
    const expWhere = await eventWhereForHost(prisma, req.params.eventId, req.hostUser!.hostId);
    const event = await prisma.event.findFirst({ where: expWhere });

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const exportRecord = await prisma.export.findFirst({
      where: { id: req.params.exportId, eventId: event.id },
    });

    if (!exportRecord) {
      throw new AppError('Export not found', 404);
    }

    res.json({
      export: {
        id: exportRecord.id,
        status: exportRecord.status,
        photoCount: exportRecord.photoCount,
        videoCount: exportRecord.videoCount,
        fileUrl: exportRecord.fileUrl,
        createdAt: exportRecord.createdAt.toISOString(),
        completedAt: exportRecord.completedAt?.toISOString() || null,
      },
    });
  })
);

// GET /v1/events/:eventId/exports - Host lists exports (owner or admin)
router.get('/:eventId/exports', authenticateHost, asyncHandler(async (req: Request, res: Response) => {
  const listWhere = await eventWhereForHost(prisma, req.params.eventId, req.hostUser!.hostId);
  const event = await prisma.event.findFirst({ where: listWhere });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const exports = await prisma.export.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    exports: exports.map((e) => ({
      id: e.id,
      status: e.status,
      photoCount: e.photoCount,
      videoCount: e.videoCount,
      fileUrl: e.fileUrl,
      createdAt: e.createdAt.toISOString(),
      completedAt: e.completedAt?.toISOString() || null,
    })),
  });
}));

// POST /v1/events/:eventId/exports/google-photos — export to a new Google Photos album
router.post('/:eventId/exports/google-photos', authenticateHost, asyncHandler(async (req: Request, res: Response) => {
  const where = await eventWhereForHost(prisma, req.params.eventId, req.hostUser!.hostId);
  const event = await prisma.event.findFirst({ where });
  if (!event) throw new AppError('Event not found', 404);

  const host = await prisma.host.findUnique({
    where: { id: req.hostUser!.hostId },
    select: { googleRefreshToken: true },
  });

  if (!host?.googleRefreshToken) {
    throw new AppError('Google account not connected. Connect via Settings first.', 400);
  }

  const [photos, videos] = await Promise.all([
    prisma.photo.findMany({
      where: { eventId: event.id, status: 'APPROVED', hidden: false },
    }),
    prisma.video.findMany({
      where: { eventId: event.id, status: 'APPROVED', hidden: false },
    }),
  ]);

  if (photos.length === 0 && videos.length === 0) {
    throw new AppError('No approved media to export', 400);
  }

  // Run async — respond immediately with 202
  const albumTitle = `${event.title} — Lumora`;
  exportToGooglePhotos(host.googleRefreshToken, albumTitle, photos, videos)
    .then(async (shareUrl) => {
      // Store share URL on the export record (create a record for tracking)
      await prisma.export.create({
        data: {
          eventId: event.id,
          status: 'COMPLETED',
          photoCount: photos.length,
          fileUrl: shareUrl,
          completedAt: new Date(),
        },
      });
    })
    .catch((err) => console.error('Google Photos export failed:', err));

  res.status(202).json({
    message: `Uploading ${photos.length} photo(s) to Google Photos. You'll receive the album link shortly.`,
    photoCount: photos.length,
    videoCount: videos.length,
  });
}));

async function generateZip(
  zipPath: string,
  photos: any[],
  videos: any[],
  exportId: string,
  eventTitle: string
): Promise<void> {
  try {
    await fs.promises.mkdir(path.dirname(zipPath), { recursive: true });

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    const storage = getStorage();

    archive.pipe(output);

    let index = 1;
    for (const photo of photos) {
      const guestName = photo.guestSession.displayName || 'anonymous';
      if (photo.largeUrl) {
        try {
          const stream = await storage.getStream(photo.largeUrl);
          const ext = path.extname(photo.largeUrl) || '.avif';
          archive.append(stream, {
            name: `${eventTitle}/photos/${guestName}_${String(index).padStart(4, '0')}${ext}`,
          });
          index++;
        } catch {
          // File doesn't exist or inaccessible, skip
        }
      }
    }

    let videoIndex = 1;
    for (const video of videos) {
      const guestName = video.guestSession.displayName || 'anonymous';
      if (video.url) {
        try {
          const stream = await storage.getStream(video.url);
          const ext = path.extname(video.url) || '.mp4';
          archive.append(stream, {
            name: `${eventTitle}/videos/${guestName}_${String(videoIndex).padStart(4, '0')}${ext}`,
          });
          videoIndex++;
        } catch {
          // File doesn't exist or inaccessible, skip
        }
      }
    }

    await archive.finalize();

    await new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });

    const zipUrl = `/exports/${path.basename(zipPath)}`;

    await prisma.export.update({
      where: { id: exportId },
      data: {
        status: 'COMPLETED',
        fileUrl: zipUrl,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('ZIP generation failed:', error);
    await prisma.export.update({
      where: { id: exportId },
      data: { status: 'FAILED' },
    });
  }
}

export default router;
