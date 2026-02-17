import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../index';
import { authenticateAdmin } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { PLAN_IDS } from '../config/plans';

const router = Router();

function formatHost(host: any) {
  return {
    id: host.id,
    email: host.email,
    displayName: host.displayName,
    role: host.role,
    canCreateEvents: host.canCreateEvents,
    plan: host.plan,
    planExpiresAt: host.planExpiresAt?.toISOString() || null,
    createdAt: host.createdAt,
    eventCount: host._count?.events ?? 0,
  };
}

// GET /v1/admin/hosts - List all hosts
router.get('/hosts', authenticateAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const hosts = await prisma.host.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { events: true } } },
  });

  res.json({ hosts: hosts.map(formatHost) });
}));

// PATCH /v1/admin/hosts/:hostId - Update host role/permissions
const updateHostSchema = z.object({
  role: z.enum(['admin', 'user']).optional(),
  canCreateEvents: z.boolean().optional(),
  plan: z.enum(PLAN_IDS as [string, ...string[]]).optional(),
});

router.patch('/hosts/:hostId', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const body = updateHostSchema.parse(req.body);

  const host = await prisma.host.findUnique({ where: { id: req.params.hostId } });
  if (!host) {
    throw new AppError('Host not found', 404);
  }

  // Prevent admins from removing their own admin role
  if (req.params.hostId === req.hostUser!.hostId && body.role === 'user') {
    throw new AppError('You cannot remove your own admin role', 400);
  }

  const updated = await prisma.host.update({
    where: { id: req.params.hostId },
    data: {
      ...(body.role !== undefined && { role: body.role }),
      ...(body.canCreateEvents !== undefined && { canCreateEvents: body.canCreateEvents }),
      ...(body.plan !== undefined && { plan: body.plan }),
    },
    include: { _count: { select: { events: true } } },
  });

  res.json({ host: formatHost(updated) });
}));

// GET /v1/admin/events - List all events across all hosts
router.get('/events', authenticateAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const events = await prisma.event.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      host: { select: { id: true, email: true, displayName: true, plan: true } },
      _count: { select: { photos: true, guestSessions: true } },
    },
  });

  res.json({
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      iconUrl: e.iconUrl,
      eventCode: e.eventCode,
      startDatetime: e.startDatetime.toISOString(),
      isActive: e.isActive,
      theme: e.theme,
      host: e.host,
      photoCount: e._count.photos,
      guestCount: e._count.guestSessions,
      createdAt: e.createdAt,
    })),
  });
}));

// GET /v1/admin/stats - System-wide statistics
router.get('/stats', authenticateAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const [hostCount, eventCount, photoCount, guestCount] = await Promise.all([
    prisma.host.count(),
    prisma.event.count(),
    prisma.photo.count(),
    prisma.guestSession.count(),
  ]);

  res.json({
    stats: {
      totalHosts: hostCount,
      totalEvents: eventCount,
      totalPhotos: photoCount,
      totalGuests: guestCount,
    },
  });
}));

// DELETE /v1/admin/events/:eventId - Admin can delete any event
router.delete('/events/:eventId', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  // Delete related data in order
  await prisma.photo.deleteMany({ where: { eventId: event.id } });
  await prisma.export.deleteMany({ where: { eventId: event.id } });
  await prisma.guestSession.deleteMany({ where: { eventId: event.id } });
  await prisma.event.delete({ where: { id: event.id } });

  res.json({ success: true });
}));

export default router;
