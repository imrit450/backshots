import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../index';
import { authenticateHost } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { createEventCode, eventWhereForHost } from '../utils/helpers';
import { getPlan } from '../config/plans';
import { generateQRCodeDataUrl, getEventUrl } from '../utils/qr';
import { config } from '../config';
import { getStorage } from '../services/storage';

const router = Router();

const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  startDatetime: z.string().datetime(),
  timezone: z.string().default('UTC'),
  revealDelayHours: z.number().int().min(0).max(168).default(0),
  uploadCutoffHours: z.number().int().min(0).max(720).default(24),
  maxPhotosPerGuest: z.number().int().min(1).max(100).default(20),
  maxPhotosTotal: z.number().int().min(10).max(10000).default(500),
  maxStorageMb: z.number().int().min(50).max(10000).default(500),
  guestGalleryEnabled: z.boolean().default(true),
  filtersEnabled: z.boolean().default(false),
  allowedFilters: z.array(z.string()).default([]),
  moderationMode: z.enum(['AUTO', 'APPROVE_FIRST']).default('AUTO'),
  theme: z.string().max(30).default('classic'),
});

const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  startDatetime: z.string().datetime().optional(),
  timezone: z.string().optional(),
  revealDelayHours: z.number().int().min(0).max(168).optional(),
  uploadCutoffHours: z.number().int().min(0).max(720).optional(),
  maxPhotosPerGuest: z.number().int().min(1).max(100).optional(),
  maxPhotosTotal: z.number().int().min(10).max(10000).optional(),
  maxStorageMb: z.number().int().min(50).max(10000).optional(),
  guestGalleryEnabled: z.boolean().optional(),
  filtersEnabled: z.boolean().optional(),
  allowedFilters: z.array(z.string()).optional(),
  moderationMode: z.enum(['AUTO', 'APPROVE_FIRST']).optional(),
  theme: z.string().max(30).optional(),
  isActive: z.boolean().optional(),
});

// POST /v1/events - Host creates event (requires canCreateEvents or admin role)
router.post('/', authenticateHost, asyncHandler(async (req: Request, res: Response) => {
  const host = await prisma.host.findUnique({
    where: { id: req.hostUser!.hostId },
    select: { id: true, role: true, canCreateEvents: true, plan: true },
  });

  if (!host) {
    throw new AppError('Host not found', 404);
  }

  // Resolve host plan (defaults to free) and use it to control basic event creation.
  // We rely purely on the plan's maxEvents (plus admin role) to gate creation,
  // so free users can always create up to their 1 allowed event.
  const plan = getPlan(host.plan);

  // Enforce plan event limit
  if (plan.maxEvents !== -1 && host.role !== 'admin') {
    const existingCount = await prisma.event.count({ where: { hostId: host.id } });
    if (existingCount >= plan.maxEvents) {
      throw new AppError(
        `Your ${plan.name} plan allows up to ${plan.maxEvents} event(s). Upgrade your plan to create more.`,
        403
      );
    }
  }

  const body = createEventSchema.parse(req.body);

  // Clamp settings to plan limits
  const maxGuests = plan.maxGuestsPerEvent === -1
    ? body.maxPhotosTotal
    : Math.min(body.maxPhotosTotal, plan.maxGuestsPerEvent * (plan.maxPhotosPerGuest === -1 ? 100 : plan.maxPhotosPerGuest));
  const maxPhotosPerGuest = plan.maxPhotosPerGuest === -1
    ? body.maxPhotosPerGuest
    : Math.min(body.maxPhotosPerGuest, plan.maxPhotosPerGuest);
  const maxStorageMb = Math.min(body.maxStorageMb, plan.maxStorageMb);

  const event = await prisma.event.create({
    data: {
      hostId: req.hostUser!.hostId,
      title: body.title,
      startDatetime: new Date(body.startDatetime),
      timezone: body.timezone,
      revealDelayHours: body.revealDelayHours,
      uploadCutoffHours: body.uploadCutoffHours,
      maxPhotosPerGuest,
      maxPhotosTotal: body.maxPhotosTotal,
      maxStorageMb,
      guestGalleryEnabled: body.guestGalleryEnabled,
      filtersEnabled: body.filtersEnabled,
      allowedFilters: JSON.stringify(body.allowedFilters),
      moderationMode: body.moderationMode,
      theme: body.theme,
      eventCode: createEventCode(),
    },
  });

  res.status(201).json({ event: formatEvent(event) });
}));

// GET /v1/events - Host lists their events
router.get('/', authenticateHost, asyncHandler(async (req: Request, res: Response) => {
  const events = await prisma.event.findMany({
    where: { hostId: req.hostUser!.hostId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          photos: true,
          guestSessions: true,
        },
      },
    },
  });

  res.json({
    events: events.map((e) => ({
      ...formatEvent(e),
      photoCount: e._count.photos,
      guestCount: e._count.guestSessions,
    })),
  });
}));

// GET /v1/events/:eventId - Host gets event details (owner or admin)
router.get('/:eventId', authenticateHost, asyncHandler(async (req: Request, res: Response) => {
  const where = await eventWhereForHost(prisma, req.params.eventId, req.hostUser!.hostId);

  const event = await prisma.event.findFirst({
    where,
    include: {
      _count: {
        select: {
          photos: true,
          guestSessions: true,
        },
      },
    },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  // Get detailed stats
  const [stats, storageAgg] = await Promise.all([
    prisma.photo.groupBy({
      by: ['status', 'hidden'],
      where: { eventId: event.id },
      _count: true,
    }),
    prisma.photo.aggregate({
      where: { eventId: event.id },
      _sum: { fileSize: true },
    }),
  ]);

  const pendingCount = stats
    .filter((s) => s.status === 'PENDING')
    .reduce((sum, s) => sum + s._count, 0);
  const hiddenCount = stats
    .filter((s) => s.hidden)
    .reduce((sum, s) => sum + s._count, 0);
  const approvedCount = stats
    .filter((s) => s.status === 'APPROVED')
    .reduce((sum, s) => sum + s._count, 0);
  const storageUsedBytes = storageAgg._sum.fileSize || 0;

  res.json({
    event: {
      ...formatEvent(event),
      photoCount: event._count.photos,
      guestCount: event._count.guestSessions,
      stats: {
        total: event._count.photos,
        pending: pendingCount,
        hidden: hiddenCount,
        approved: approvedCount,
        guests: event._count.guestSessions,
        storageUsedBytes,
      },
    },
  });
}));

// PATCH /v1/events/:eventId - Host updates event settings (owner or admin)
router.patch('/:eventId', authenticateHost, asyncHandler(async (req: Request, res: Response) => {
  const body = updateEventSchema.parse(req.body);

  const where = await eventWhereForHost(prisma, req.params.eventId, req.hostUser!.hostId);
  const event = await prisma.event.findFirst({ where });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const updateData: any = { ...body };
  if (body.startDatetime) {
    updateData.startDatetime = new Date(body.startDatetime);
  }
  if (body.allowedFilters) {
    updateData.allowedFilters = JSON.stringify(body.allowedFilters);
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: updateData,
  });

  res.json({ event: formatEvent(updated) });
}));

// DELETE /v1/events/:eventId - Host deletes an event they own (or admin)
router.delete('/:eventId', authenticateHost, asyncHandler(async (req: Request, res: Response) => {
  const where = await eventWhereForHost(prisma, req.params.eventId, req.hostUser!.hostId);
  const event = await prisma.event.findFirst({ where });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  // Delete child records first to satisfy FK constraints
  await prisma.photo.deleteMany({ where: { eventId: event.id } });
  await prisma.guestSession.deleteMany({ where: { eventId: event.id } });
  await prisma.export.deleteMany({ where: { eventId: event.id } });
  await prisma.event.delete({ where: { id: event.id } });

  res.status(204).send();
}));

// ── Event icon upload ──────────────────────────────────────────────────

const iconUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Invalid file type. Only JPEG, PNG, and WebP are allowed.', 400) as any);
    }
  },
});

// POST /v1/events/:eventId/icon - Upload event icon
router.post(
  '/:eventId/icon',
  authenticateHost,
  iconUpload.single('icon'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError('No icon file provided', 400);
    }

    const where = await eventWhereForHost(prisma, req.params.eventId, req.hostUser!.hostId);
    const event = await prisma.event.findFirst({ where });

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    // Process icon: resize to 256×256, convert to WebP
    const iconName = `${uuidv4()}.webp`;
    const iconPrefix = `hosts/${event.hostId}/events/${event.id}`;
    const iconKey = `${iconPrefix}/icons/${iconName}`;

    const iconBuffer = await sharp(req.file.buffer)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    const storage = getStorage();
    const iconUrl = await storage.upload(iconBuffer, iconKey, 'image/webp');

    // Delete old icon if exists
    if (event.iconUrl) {
      await storage.delete(event.iconUrl);
    }

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { iconUrl },
    });

    res.json({ event: formatEvent(updated) });
  })
);

// DELETE /v1/events/:eventId/icon - Remove event icon (owner or admin)
router.delete(
  '/:eventId/icon',
  authenticateHost,
  asyncHandler(async (req: Request, res: Response) => {
    const where = await eventWhereForHost(prisma, req.params.eventId, req.hostUser!.hostId);
    const event = await prisma.event.findFirst({ where });

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (event.iconUrl) {
      await getStorage().delete(event.iconUrl);
    }

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { iconUrl: null },
    });

    res.json({ event: formatEvent(updated) });
  })
);

// GET /v1/events/:eventId/qr - Get QR code for event (owner or admin)
router.get('/:eventId/qr', authenticateHost, asyncHandler(async (req: Request, res: Response) => {
  const where = await eventWhereForHost(prisma, req.params.eventId, req.hostUser!.hostId);
  const event = await prisma.event.findFirst({ where });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
  const origin = `${proto}://${host}`;

  const qrDataUrl = await generateQRCodeDataUrl(event.eventCode, origin);
  const eventUrl = getEventUrl(event.eventCode, origin);

  res.json({
    qrCode: qrDataUrl,
    eventUrl,
    eventCode: event.eventCode,
  });
}));

// GET /v1/events/:eventCode/public - Guest gets public event info
router.get('/:eventCode/public', asyncHandler(async (req: Request, res: Response) => {
  const event = await prisma.event.findUnique({
    where: { eventCode: req.params.eventCode },
  });

  if (!event || !event.isActive) {
    throw new AppError('Event not found or inactive', 404);
  }

  res.json({
    event: {
      id: event.id,
      title: event.title,
      iconUrl: event.iconUrl,
      startDatetime: event.startDatetime.toISOString(),
      timezone: event.timezone,
      uploadCutoffHours: event.uploadCutoffHours ?? 24,
      guestGalleryEnabled: event.guestGalleryEnabled,
      filtersEnabled: event.filtersEnabled,
      allowedFilters: JSON.parse(event.allowedFilters),
      maxPhotosPerGuest: event.maxPhotosPerGuest,
      maxPhotosTotal: event.maxPhotosTotal,
      maxStorageMb: event.maxStorageMb,
      theme: event.theme,
    },
  });
}));

function formatEvent(event: any) {
  return {
    id: event.id,
    hostId: event.hostId,
    title: event.title,
    iconUrl: event.iconUrl,
    startDatetime: event.startDatetime.toISOString(),
    timezone: event.timezone,
    revealDelayHours: event.revealDelayHours,
    uploadCutoffHours: event.uploadCutoffHours ?? 24,
    maxPhotosPerGuest: event.maxPhotosPerGuest,
    maxPhotosTotal: event.maxPhotosTotal,
    maxStorageMb: event.maxStorageMb,
    guestGalleryEnabled: event.guestGalleryEnabled,
    filtersEnabled: event.filtersEnabled,
    allowedFilters: JSON.parse(event.allowedFilters),
    moderationMode: event.moderationMode,
    theme: event.theme,
    eventCode: event.eventCode,
    isActive: event.isActive,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export default router;
