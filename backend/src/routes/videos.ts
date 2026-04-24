import { Router, Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../index';
import { authenticateGuest, authenticateHost } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimit';
import { AppError } from '../middleware/errorHandler';
import { computeRevealAt, eventWhereForHost } from '../utils/helpers';
import { config } from '../config';
import { getStorage } from '../services/storage';
import { transcodeVideo } from '../services/videoProcessor';

const router = Router();

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Invalid file type. Only MP4 and WebM are allowed.', 400) as any);
    }
  },
});

// POST /v1/events/:eventId/videos/upload - Guest uploads a short video (<= 10s)
router.post(
  '/:eventId/videos/upload',
  authenticateGuest,
  uploadLimiter,
  upload.single('video'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError('No video file provided', 400);
    }

    const eventId = req.params.eventId;
    const sessionId = req.guestUser!.sessionId;

    if (req.guestUser!.eventId !== eventId) {
      throw new AppError('Session does not belong to this event', 403);
    }

    const [event, session] = await Promise.all([
      prisma.event.findUnique({ where: { id: eventId } }),
      prisma.guestSession.findUnique({ where: { id: sessionId } }),
    ]);

    if (!event || !event.isActive) {
      throw new AppError('Event not found or inactive', 404);
    }

    // Enforce upload cutoff (same as photos)
    if (event.uploadCutoffHours > 0) {
      const cutoffTime = new Date(event.startDatetime);
      cutoffTime.setHours(cutoffTime.getHours() + event.uploadCutoffHours);
      if (new Date() > cutoffTime) {
        throw new AppError(
          `Uploads closed. Uploads ended ${event.uploadCutoffHours} hours after the event.`,
          403,
        );
      }
    }

    if (!session) {
      throw new AppError('Guest session not found', 404);
    }

    // For now we just enforce overall storage limit (photos + videos share the same maxStorageMb).
    const photoAgg = await prisma.photo.aggregate({
      where: { eventId },
      _sum: { fileSize: true },
    });
    const videoAgg = await prisma.video.aggregate({
      where: { eventId },
      _sum: { fileSize: true },
    });
    const storageUsedBytes = (photoAgg._sum.fileSize || 0) + (videoAgg._sum.fileSize || 0);
    const storageLimitBytes = event.maxStorageMb * 1024 * 1024;
    if (storageUsedBytes >= storageLimitBytes) {
      throw new AppError(
        `Event storage limit reached (${event.maxStorageMb} MB)`,
        429,
      );
    }

    const title = (req.body.title as string)?.trim() || null;
    const description = (req.body.description as string)?.trim() || null;
    const durationSec = parseInt((req.body.durationSec as string) || '0', 10) || 0;

    if (durationSec <= 0 || durationSec > 10) {
      throw new AppError('Video duration must be between 1 and 10 seconds', 400);
    }

    const storage = getStorage();
    const videoPrefix = `hosts/${event.hostId}/events/${event.id}`;
    const ts = Date.now();
    const rawKey = `${videoPrefix}/videos/${sessionId}-${ts}.webm`;
    const url = await storage.upload(req.file.buffer, rawKey, req.file.mimetype);

    const now = new Date();
    const revealAt = computeRevealAt(now, event.revealDelayHours);
    const status = event.moderationMode === 'AUTO' ? 'APPROVED' : 'PENDING';

    const video = await prisma.video.create({
      data: {
        eventId,
        guestSessionId: sessionId,
        title,
        description,
        status,
        capturedAt: now,
        url,
        durationSec,
        fileSize: req.file.size,
      },
    });

    // Respond immediately — transcode happens in the background
    res.status(201).json({
      video: {
        id: video.id,
        title: video.title,
        description: video.description,
        status: video.status,
        url: video.url,
        durationSec: video.durationSec,
      },
    });

    // Fire-and-forget: re-encode to MP4 with normalised audio then replace the raw file
    const rawBuffer = req.file.buffer;
    const rawMime   = req.file.mimetype;
    setImmediate(async () => {
      try {
        const mp4Buffer = await transcodeVideo(rawBuffer, rawMime);
        if (!mp4Buffer) return;
        const mp4Key = `${videoPrefix}/videos/${sessionId}-${ts}.mp4`;
        const mp4Url = await storage.upload(mp4Buffer, mp4Key, 'video/mp4');
        await prisma.video.update({ where: { id: video.id }, data: { url: mp4Url, fileSize: mp4Buffer.length } });
        await storage.delete(rawKey).catch(() => {});
        console.log(`[videoProcessor] transcoded ${video.id} → ${mp4Key}`);
      } catch (err) {
        console.error(`[videoProcessor] background transcode failed for ${video.id}:`, err);
      }
    });
  }),
);

// GET /v1/events/:eventId/videos - Host lists videos for an event
router.get(
  '/:eventId/videos',
  authenticateHost,
  asyncHandler(async (req: Request, res: Response) => {
    const evWhere = await eventWhereForHost(prisma, req.params.eventId, req.hostUser!.hostId);
    const event = await prisma.event.findFirst({ where: evWhere });

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const videos = await prisma.video.findMany({
      where: { eventId: event.id },
      orderBy: { capturedAt: 'desc' },
      include: {
        guestSession: { select: { displayName: true } },
      },
    });

    res.json({
      videos: videos.map((v) => ({
        id: v.id,
        title: v.title,
        description: v.description,
        status: v.status,
        hidden: v.hidden,
        capturedAt: v.capturedAt.toISOString(),
        url: v.url,
        durationSec: v.durationSec,
        guestName: v.guestSession.displayName,
      })),
    });
  }),
);

export default router;

