import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../index';
import { authenticateAdmin } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { PLAN_IDS } from '../config/plans';
import { config } from '../config';
import { S3Client, ListObjectsV2Command, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getRuntimeStorageConfig, setRuntimeStorageConfig } from '../services/runtimeConfig';
import { resetStorage } from '../services/storage';

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

function requireS3() {
  const runtime = getRuntimeStorageConfig();
  if (runtime.storageType !== 's3' || !runtime.s3?.bucket || !runtime.s3.publicUrl) {
    throw new AppError('S3 storage is not enabled', 400);
  }
  return runtime.s3;
}

function makeS3Client(s3: any) {
  return new S3Client({
    region: s3.region || 'us-east-1',
    ...(s3.endpoint && { endpoint: s3.endpoint }),
    credentials: s3.accessKeyId
      ? { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey! }
      : undefined,
    forcePathStyle: s3.forcePathStyle,
  });
}

// GET /v1/admin/storage/health - Verify S3 connectivity and config
router.get('/storage/health', authenticateAdmin, asyncHandler(async (_req: Request, res: Response) => {
  try {
    const s3 = requireS3();
    const client = makeS3Client(s3);

    await client.send(new HeadBucketCommand({ Bucket: s3.bucket }));
    const list = await client.send(new ListObjectsV2Command({ Bucket: s3.bucket, MaxKeys: 1 }));

    res.json({
      ok: true,
      storageType: 's3',
      bucket: s3.bucket,
      region: s3.region,
      endpoint: s3.endpoint || null,
      publicUrl: s3.publicUrl,
      sampleKey: list.Contents?.[0]?.Key || null,
    });
  } catch (err: any) {
    res.status(200).json({
      ok: false,
      storageType: getRuntimeStorageConfig().storageType,
      error: err?.message || 'Failed to check storage',
    });
  }
}));

// GET /v1/admin/storage/config - Get current storage config (secrets masked)
router.get('/storage/config', authenticateAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const runtime = getRuntimeStorageConfig();
  res.json({
    storageType: runtime.storageType,
    s3: runtime.s3
      ? {
          bucket: runtime.s3.bucket,
          region: runtime.s3.region,
          endpoint: runtime.s3.endpoint || '',
          accessKeyId: runtime.s3.accessKeyId || '',
          secretAccessKey: runtime.s3.secretAccessKey ? '***' : '',
          publicUrl: runtime.s3.publicUrl,
          forcePathStyle: !!runtime.s3.forcePathStyle,
        }
      : null,
  });
}));

const storageConfigSchema = z.object({
  storageType: z.enum(['filesystem', 's3']),
  s3: z
    .object({
      bucket: z.string().min(1),
      region: z.string().min(1).default('us-east-1'),
      endpoint: z.string().optional().default(''),
      accessKeyId: z.string().optional().default(''),
      secretAccessKey: z.string().optional().default(''),
      publicUrl: z.string().url(),
      forcePathStyle: z.boolean().optional().default(false),
    })
    .optional(),
});

// PUT /v1/admin/storage/config - Save storage config to DB and apply runtime
router.put('/storage/config', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const body = storageConfigSchema.parse(req.body);

  if (body.storageType === 's3' && !body.s3) {
    throw new AppError('Missing s3 config', 400);
  }

  await prisma.systemConfig.upsert({
    where: { id: 1 },
    update: {
      storageType: body.storageType,
      s3Bucket: body.storageType === 's3' ? body.s3!.bucket : null,
      s3Region: body.storageType === 's3' ? body.s3!.region : null,
      s3Endpoint: body.storageType === 's3' ? (body.s3!.endpoint || null) : null,
      s3AccessKeyId: body.storageType === 's3' ? (body.s3!.accessKeyId || null) : null,
      s3SecretAccessKey: body.storageType === 's3' ? (body.s3!.secretAccessKey || null) : null,
      s3PublicUrl: body.storageType === 's3' ? body.s3!.publicUrl : null,
      s3ForcePathStyle: body.storageType === 's3' ? (body.s3!.forcePathStyle || false) : false,
    },
    create: {
      id: 1,
      storageType: body.storageType,
      s3Bucket: body.storageType === 's3' ? body.s3!.bucket : null,
      s3Region: body.storageType === 's3' ? body.s3!.region : null,
      s3Endpoint: body.storageType === 's3' ? (body.s3!.endpoint || null) : null,
      s3AccessKeyId: body.storageType === 's3' ? (body.s3!.accessKeyId || null) : null,
      s3SecretAccessKey: body.storageType === 's3' ? (body.s3!.secretAccessKey || null) : null,
      s3PublicUrl: body.storageType === 's3' ? body.s3!.publicUrl : null,
      s3ForcePathStyle: body.storageType === 's3' ? (body.s3!.forcePathStyle || false) : false,
    },
  });

  if (body.storageType === 'filesystem') {
    setRuntimeStorageConfig({ storageType: 'filesystem', s3: null });
  } else {
    setRuntimeStorageConfig({
      storageType: 's3',
      s3: {
        bucket: body.s3!.bucket,
        region: body.s3!.region,
        endpoint: body.s3!.endpoint || undefined,
        accessKeyId: body.s3!.accessKeyId || undefined,
        secretAccessKey: body.s3!.secretAccessKey || undefined,
        publicUrl: body.s3!.publicUrl,
        forcePathStyle: body.s3!.forcePathStyle || false,
      },
    } as any);
  }

  resetStorage();
  res.json({ ok: true });
}));

// POST /v1/admin/storage/test - Test a provided S3 config without saving
router.post('/storage/test', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const body = storageConfigSchema.parse(req.body);
  if (body.storageType !== 's3' || !body.s3) {
    throw new AppError('storageType must be s3 for test', 400);
  }

  // If the secret was left blank (masked in UI), fall back to the currently
  // saved runtime secret so the test can still run without re-entering it.
  let secretAccessKey = body.s3.secretAccessKey || undefined;
  if (!secretAccessKey && body.s3.accessKeyId) {
    const runtime = getRuntimeStorageConfig();
    if (runtime.s3?.secretAccessKey) {
      secretAccessKey = runtime.s3.secretAccessKey;
    }
  }

  const client = makeS3Client({
    region: body.s3.region,
    endpoint: body.s3.endpoint || undefined,
    accessKeyId: body.s3.accessKeyId || undefined,
    secretAccessKey,
    forcePathStyle: body.s3.forcePathStyle || false,
  });

  try {
    await client.send(new HeadBucketCommand({ Bucket: body.s3.bucket }));
    const list = await client.send(new ListObjectsV2Command({ Bucket: body.s3.bucket, MaxKeys: 1 }));
    res.json({ ok: true, sampleKey: list.Contents?.[0]?.Key || null });
  } catch (err: any) {
    throw new AppError(err.message || 'Connection failed', 400);
  }
}));

// GET /v1/admin/storage/list?prefix=...&limit=...&cursor=...
router.get('/storage/list', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const s3 = requireS3();
  const client = makeS3Client(s3);

  const schema = z.object({
    prefix: z.string().optional().default(''),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    cursor: z.string().optional(),
  });
  const { prefix, limit, cursor } = schema.parse(req.query);

  const out = await client.send(new ListObjectsV2Command({
    Bucket: s3.bucket,
    Prefix: prefix || undefined,
    MaxKeys: limit,
    ContinuationToken: cursor,
  }));

  const base = s3.publicUrl.replace(/\/$/, '');
  res.json({
    prefix,
    nextCursor: out.IsTruncated ? (out.NextContinuationToken || null) : null,
    objects: (out.Contents || [])
      .filter((o) => !!o.Key)
      .map((o) => ({
        key: o.Key!,
        size: o.Size ?? 0,
        lastModified: o.LastModified ? o.LastModified.toISOString() : null,
        url: `${base}/${o.Key}`,
      })),
  });
}));

export default router;
